/**
 * ReportGeneratorService
 *
 * Implements TICKET RPT-006: One-Click "Generate Report" from Data Model.
 *
 * Given a data model ID, this service:
 *   1. Creates a new draft DRAReport
 *   2. Auto-adds KPI card row items from auto-classified KPI columns
 *   3. Triggers AI analysis → adds AI insights section
 *   4. If data model has channel/campaign dimension → adds comparison table
 *   5. If data model has date column → adds a text note about available trend charts
 *   6. Adds a placeholder "Executive Summary" text block
 *   7. Returns the created report with all items
 */

import { DataSource } from 'typeorm';
import { AppDataSource } from '../datasources/AppData.js';
import { DataModel } from '../models/DataModel.js';
import { DRAColumn } from '../models/DRAColumn.js';
import { DRAReport } from '../models/DRAReport.js';
import { DRAReportItem } from '../models/DRAReportItem.js';
import ReportProcessor from '../processors/ReportProcessor.js';
import DataModelAnalysisService from './DataModelAnalysisService.js';
import { singleton as kpiClassificationService } from './KPIClassificationService.js';
import type { ColumnClassification } from './KPIClassificationService.js';

export interface IGenerateReportResult {
    report: DRAReport;
    items: DRAReportItem[];
    sectionsAdded: string[];
    aiInsightsGenerated: boolean;
    warnings: string[];
}

export interface IGenerateReportOptions {
    /** If true, skip the (potentially slow) AI analysis step and just add placeholder insight items */
    skipAiAnalysis?: boolean;
    /** Custom report name. If not provided, defaults to "{Data Model Name} — Auto Report" */
    reportName?: string;
    /** Custom report description */
    reportDescription?: string;
}

export default class ReportGeneratorService {
    private static instance: ReportGeneratorService;
    private dataSource: DataSource;

    private constructor() {
        this.dataSource = AppDataSource;
    }

    public static getInstance(): ReportGeneratorService {
        if (!ReportGeneratorService.instance) {
            ReportGeneratorService.instance = new ReportGeneratorService();
        }
        return ReportGeneratorService.instance;
    }

    /** Exposed for testing */
    public static setInstance(instance: ReportGeneratorService): void {
        ReportGeneratorService.instance = instance;
    }

    private async getManager() {
        if (!this.dataSource.isInitialized) {
            await this.dataSource.initialize();
        }
        return this.dataSource.manager;
    }

    /**
     * Generate a fully populated report from a data model.
     */
    public async generateReport(
        dataModelId: number,
        userId: number,
        projectId?: number,
        options: IGenerateReportOptions = {},
    ): Promise<IGenerateReportResult> {
        const manager = await this.getManager();

        // ── Step 0: Validate data model exists ──
        const where: any = { id: dataModelId };
        if (projectId) where.project_id = projectId;
        const dataModel = await manager.findOne(DataModel, {
            where,
        });
        if (!dataModel) {
            const err: any = new Error('Data model not found or does not belong to this project');
            err.status = 404;
            throw err;
        }

        const columns = await manager.find(DRAColumn, {
            where: { data_model_id: dataModelId },
        });
        if (!columns.length) {
            const err: any = new Error('Data model has no columns. Analyze a data source first.');
            err.status = 400;
            throw err;
        }

        const warnings: string[] = [];
        const sectionsAdded: string[] = [];

        // ── Step 1: Create the report ──
        const reportName = options.reportName || `${dataModel.name} — Auto Report`;
        const reportDescription = options.reportDescription || `Auto-generated report for data model "${dataModel.name}"`;
        const report = await (ReportProcessor.getInstance() as any).createReport(
            projectId,
            userId,
            reportName,
            reportDescription,
        );

        // ── Step 2: Classify columns and add KPI card items ──
        let classifications: ColumnClassification[] = [];
        try {
            classifications = kpiClassificationService.classifyAllColumns(columns);
        } catch (err) {
            console.warn('[ReportGenerator] KPI classification failed, skipping KPI section:', err);
            warnings.push('KPI classification failed — no KPI cards added.');
        }

        const kpiColumns = classifications.filter((c) => c.isKPI);

        if (kpiColumns.length) {
            // Add a row of KPI cards (one item per KPI column)
            for (let i = 0; i < kpiColumns.length; i++) {
                const cls = kpiColumns[i];
                const col = columns.find((c) => c.id === cls.columnId);
                if (!col) continue;

                await (ReportProcessor.getInstance() as any).reportItemsService.createItem(report.id, {
                    item_type: 'kpi_card',
                    data_model_id: dataModelId,
                    display_order: i,
                    title_override: cls.pattern?.label || col.name,
                    payload: {
                        column_name: col.name,
                        column_id: col.id,
                        aggregation: cls.pattern?.aggregation || 'count',
                        format: cls.pattern?.format || 'number',
                        label: cls.pattern?.label || col.name,
                        pattern_id: cls.pattern?.id || null,
                        data_model_id: dataModelId,
                    },
                });
            }
            sectionsAdded.push('kpi_cards');
        } else {
            warnings.push('No KPI columns detected — skipped KPI cards section.');
        }

        // ── Step 3: AI Insights section ──
        let aiInsightsGenerated = false;
        if (options.skipAiAnalysis) {
            // Add a placeholder AI insight item
            await (ReportProcessor.getInstance() as any).reportItemsService.createItem(report.id, {
                item_type: 'ai_insight',
                data_model_id: dataModelId,
                display_order: kpiColumns.length + 1,
                title_override: 'AI Insights (Pending)',
                payload: {
                    category: 'general',
                    markdown: '*AI analysis will appear here once triggered.*',
                    data_model_id: dataModelId,
                    placeholder: true,
                },
            });
            sectionsAdded.push('ai_insights_placeholder');
        } else {
            try {
                // Trigger AI analysis (Gemini)
                const analysisService = DataModelAnalysisService.getInstance();
                const aiResult = await analysisService.analyze(dataModelId, projectId, userId);

                if (aiResult?.insights?.length) {
                    for (let i = 0; i < aiResult.insights.length; i++) {
                        const insight = aiResult.insights[i];
                        await (ReportProcessor.getInstance() as any).reportItemsService.createItem(report.id, {
                            item_type: 'ai_insight',
                            data_model_id: dataModelId,
                            display_order: kpiColumns.length + 1 + i,
                            title_override: insight.category || 'AI Insight',
                            payload: {
                                category: insight.category || 'general',
                                markdown: insight.markdown || insight.text || '',
                                severity: insight.severity || 'info',
                                data_model_id: dataModelId,
                            },
                        });
                    }
                    aiInsightsGenerated = true;
                    sectionsAdded.push('ai_insights');
                } else {
                    // Add placeholder if no insights
                    await (ReportProcessor.getInstance() as any).reportItemsService.createItem(report.id, {
                        item_type: 'ai_insight',
                        data_model_id: dataModelId,
                        display_order: kpiColumns.length + 1,
                        title_override: 'AI Insights',
                        payload: {
                            category: 'general',
                            markdown: '*No AI insights could be generated for this data model.*',
                            data_model_id: dataModelId,
                        },
                    });
                    sectionsAdded.push('ai_insights_empty');
                    warnings.push('AI analysis returned no insights.');
                }
            } catch (err: any) {
                console.warn('[ReportGenerator] AI analysis failed:', err.message);
                warnings.push(`AI analysis failed: ${err.message}`);
                // Add a placeholder so the section isn't empty
                await (ReportProcessor.getInstance() as any).reportItemsService.createItem(report.id, {
                    item_type: 'ai_insight',
                    data_model_id: dataModelId,
                    display_order: kpiColumns.length + 1,
                    title_override: 'AI Insights (Error)',
                    payload: {
                        category: 'general',
                        markdown: `*AI analysis could not be completed: ${err.message}*`,
                        data_model_id: dataModelId,
                    },
                });
                sectionsAdded.push('ai_insights_error');
            }
        }

        // ── Step 4: Comparison table (if dimension columns exist) ──
        let nextOrder = kpiColumns.length + 2;
        const dimensionColumns = classifications.filter((c) => !c.isKPI && c.dimensionality === 'high');

        if (dimensionColumns.length) {
            // Pick the first dimension column for comparison
            const dimCol = dimensionColumns[0];
            const col = columns.find((c) => c.id === dimCol.columnId);

            // Find a metric column to compare
            const metricCol = kpiColumns.length ? kpiColumns[0] : null;
            const metricColumn = metricCol ? columns.find((c) => c.id === metricCol.columnId) : null;

            if (col && metricColumn) {
                await (ReportProcessor.getInstance() as any).reportItemsService.createItem(report.id, {
                    item_type: 'comparison_table',
                    data_model_id: dataModelId,
                    display_order: nextOrder,
                    title_override: `${col.name} Comparison`,
                    payload: {
                        dimension_column: col.name,
                        dimension_column_id: col.id,
                        metric_column: metricColumn.name,
                        metric_column_id: metricColumn.id,
                        metric_aggregation: metricCol?.pattern?.aggregation || 'sum',
                        data_model_id: dataModelId,
                    },
                });
                sectionsAdded.push('comparison_table');
                nextOrder++;
            } else if (col) {
                // No metric column but dimension exists — still add with count aggregation
                await (ReportProcessor.getInstance() as any).reportItemsService.createItem(report.id, {
                    item_type: 'comparison_table',
                    data_model_id: dataModelId,
                    display_order: nextOrder,
                    title_override: `${col.name} Breakdown`,
                    payload: {
                        dimension_column: col.name,
                        dimension_column_id: col.id,
                        metric_column: null,
                        metric_aggregation: 'count',
                        data_model_id: dataModelId,
                    },
                });
                sectionsAdded.push('comparison_table');
                nextOrder++;
            }
        } else {
            warnings.push('No high-cardinality dimension columns detected — skipped comparison table.');
        }

        // ── Step 5: Date column trend note ──
        const dateColumn = columns.find(
            (c) =>
                c.data_type?.toLowerCase().includes('date') ||
                c.data_type?.toLowerCase().includes('timestamp') ||
                c.data_type?.toLowerCase().includes('time'),
        );

        if (dateColumn) {
            await (ReportProcessor.getInstance() as any).reportItemsService.createItem(report.id, {
                item_type: 'text_block',
                data_model_id: dataModelId,
                display_order: nextOrder,
                title_override: 'Trend Analysis Available',
                payload: {
                    content: `📈 **Trend Charts Available**\n\nThis data model contains a date/time column (\`${dateColumn.name}\`). You can use the report builder to add trend charts that visualize how metrics change over time.`,
                    style: 'info',
                    data_model_id: dataModelId,
                },
            });
            sectionsAdded.push('trend_note');
            nextOrder++;
        }

        // ── Step 6: Executive Summary placeholder ──
        await (ReportProcessor.getInstance() as any).reportItemsService.createItem(report.id, {
            item_type: 'text_block',
            data_model_id: dataModelId,
            display_order: nextOrder,
            title_override: 'Executive Summary',
            payload: {
                content: `# Executive Summary\n\n*This report was auto-generated from data model **${dataModel.name}**.*\n\nUse the report builder to customize this section with your analysis narrative.`,
                style: 'default',
                data_model_id: dataModelId,
            },
        });
        sectionsAdded.push('executive_summary');

        // ── Fetch the fully populated report ──
        const fullReport = await (ReportProcessor.getInstance() as any).getReport(report.id);

        return {
            report: fullReport,
            items: fullReport?.items || [],
            sectionsAdded,
            aiInsightsGenerated,
            warnings,
        };
    }
}