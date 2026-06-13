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
import { AppDataSource } from '../datasources/PostgresDS.js';
import { DRADataModel } from '../models/DRADataModel.js';
import { DRAColumn } from '../models/DRAColumn.js';
import { DRAReport } from '../models/DRAReport.js';
import { DRAReportItem } from '../models/DRAReportItem.js';
import { ReportProcessor } from '../processors/ReportProcessor.js';
import { DataModelAnalysisService } from './DataModelAnalysisService.js';
import { singleton as kpiClassificationService } from './KPIClassificationService.js';
import type { ColumnClassification } from './KPIClassificationService.js';
import {
    REPORT_TEMPLATES,
    resolvePlaceholders,
    evaluateCondition,
    checkTemplateCompatibility,
    getTemplateById,
    type IReportTemplate,
    type ITemplateSection,
} from '../templates/reportTemplates.js';

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
        const dataModel = await manager.findOne(DRADataModel, {
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
                const aiResult = await analysisService.analyzeModel(dataModelId, userId, projectId);

                // Convert statistical analysis results into insight items
                const insightItems: Array<{ category: string; markdown: string; severity: string }> = [];

                if (aiResult.anomalies?.length) {
                    for (const anomaly of aiResult.anomalies) {
                        insightItems.push({
                            category: 'anomaly',
                            markdown: `**Anomaly detected in \`${anomaly.column_name}\`**: Z-score ${anomaly.z_score?.toFixed(2)}, value ${anomaly.value}, severity: ${anomaly.severity}`,
                            severity: anomaly.severity === 'high' ? 'warning' : 'info',
                        });
                    }
                }

                if (aiResult.trends?.length) {
                    for (const trend of aiResult.trends) {
                        insightItems.push({
                            category: 'trend',
                            markdown: `**Trend in \`${trend.column_name}\`**: ${trend.direction} trend (momentum: ${trend.momentum}, R²: ${trend.r_squared?.toFixed(3)})`,
                            severity: 'info',
                        });
                    }
                }

                if (aiResult.correlations?.length) {
                    for (const corr of aiResult.correlations) {
                        insightItems.push({
                            category: 'correlation',
                            markdown: `**Correlation between \`${corr.column_a}\` and \`${corr.column_b}\`**: ${corr.correlation?.toFixed(2)} (${corr.strength}, ${corr.direction})`,
                            severity: 'info',
                        });
                    }
                }

                if (insightItems.length > 0) {
                    for (let i = 0; i < insightItems.length; i++) {
                        const insight = insightItems[i];
                        await (ReportProcessor.getInstance() as any).reportItemsService.createItem(report.id, {
                            item_type: 'ai_insight',
                            data_model_id: dataModelId,
                            display_order: kpiColumns.length + 1 + i,
                            title_override: insight.category || 'AI Insight',
                            payload: {
                                category: insight.category || 'general',
                                markdown: insight.markdown,
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

        // ── Step 4: Date column trend note ──
        let nextOrder = kpiColumns.length + 2;
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

    /**
     * Get all available templates with compatibility info for a given data model.
     * Used by the template picker UI to show which templates are available.
     */
    public async getTemplatesWithCompatibility(
        dataModelId: number,
        projectId?: number,
    ): Promise<Array<IReportTemplate & { compatible: boolean; compatibilityReason?: string }>> {
        const manager = await this.getManager();

        const where: any = { id: dataModelId };
        if (projectId) where.project_id = projectId;
        const dataModel = await manager.findOne(DRADataModel, { where });
        if (!dataModel) {
            const err: any = new Error('Data model not found');
            err.status = 404;
            throw err;
        }

        const columns = await manager.find(DRAColumn, {
            where: { data_model_id: dataModelId },
        });

        // Classify columns to determine KPIs and dimensions
        let classifications: ColumnClassification[] = [];
        try {
            classifications = kpiClassificationService.classifyAllColumns(columns);
        } catch {
            // If classification fails, treat all columns as non-KPI
        }

        const kpiColumnCount = classifications.filter((c) => c.isKPI).length;
        const dimensionColumnCount = classifications.filter((c) => !c.isKPI && c.dimensionality === 'high').length;
        const hasDateColumn = columns.some(
            (c) =>
                c.data_type?.toLowerCase().includes('date') ||
                c.data_type?.toLowerCase().includes('timestamp') ||
                c.data_type?.toLowerCase().includes('time'),
        );
        const numericColumnCount = columns.filter(
            (c) =>
                c.data_type?.toLowerCase().includes('int') ||
                c.data_type?.toLowerCase().includes('float') ||
                c.data_type?.toLowerCase().includes('decimal') ||
                c.data_type?.toLowerCase().includes('numeric') ||
                c.data_type?.toLowerCase().includes('double') ||
                c.data_type?.toLowerCase().includes('number'),
        ).length;

        const context = { kpiColumnCount, dimensionColumnCount, hasDateColumn, numericColumnCount };

        return REPORT_TEMPLATES.map((template) => {
            const { compatible, reason } = checkTemplateCompatibility(template, context);
            return {
                ...template,
                compatible,
                compatibilityReason: reason,
            };
        });
    }

    /**
     * Generate a report from a template and data model.
     * Resolves template sections, evaluates conditions against the data model,
     * and creates report items accordingly.
     */
    public async generateFromTemplate(
        dataModelId: number,
        userId: number,
        projectId: number,
        templateId: string,
        options: IGenerateReportOptions = {},
    ): Promise<IGenerateReportResult & { templateId: string; templateName: string }> {
        const manager = await this.getManager();

        // ── Step 0: Validate data model and template ──
        const where: any = { id: dataModelId };
        if (projectId) where.project_id = projectId;
        const dataModel = await manager.findOne(DRADataModel, { where });
        if (!dataModel) {
            const err: any = new Error('Data model not found or does not belong to this project');
            err.status = 404;
            throw err;
        }

        const template = getTemplateById(templateId);
        if (!template) {
            const err: any = new Error(`Template "${templateId}" not found`);
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

        // ── Step 1: Classify columns ──
        let classifications: ColumnClassification[] = [];
        try {
            classifications = kpiClassificationService.classifyAllColumns(columns);
        } catch (err) {
            console.warn('[ReportGenerator] KPI classification failed:', err);
            warnings.push('KPI classification failed — some sections may be incomplete.');
        }

        const kpiColumns = classifications.filter((c) => c.isKPI);
        const dimensionColumns = classifications.filter((c) => !c.isKPI && c.dimensionality === 'high');
        const dateColumn = columns.find(
            (c) =>
                c.data_type?.toLowerCase().includes('date') ||
                c.data_type?.toLowerCase().includes('timestamp') ||
                c.data_type?.toLowerCase().includes('time'),
        );

        const conditionContext = {
            kpiColumnCount: kpiColumns.length,
            dimensionColumnCount: dimensionColumns.length,
            hasDateColumn: !!dateColumn,
            numericColumnCount: columns.filter(
                (c) =>
                    c.data_type?.toLowerCase().includes('int') ||
                    c.data_type?.toLowerCase().includes('float') ||
                    c.data_type?.toLowerCase().includes('decimal') ||
                    c.data_type?.toLowerCase().includes('numeric') ||
                    c.data_type?.toLowerCase().includes('double') ||
                    c.data_type?.toLowerCase().includes('number'),
            ).length,
        };

        // Check template compatibility
        const compatibility = checkTemplateCompatibility(template, conditionContext);
        if (!compatibility.compatible) {
            const err: any = new Error(`Template "${template.name}" is not compatible with this data model: ${compatibility.reason}`);
            err.status = 400;
            throw err;
        }

        // ── Step 2: Create the report ──
        const reportName = options.reportName || `${dataModel.name} — ${template.name}`;
        const reportDescription = options.reportDescription || `Report generated from data model "${dataModel.name}" using the "${template.name}" template.`;
        const report = await (ReportProcessor.getInstance() as any).createReport(
            projectId,
            userId,
            reportName,
            reportDescription,
        );

        // ── Step 3: Process each template section ──
        let displayOrder = 0;
        const firstKpi = kpiColumns.length ? kpiColumns[0] : null;
        const firstKpiCol = firstKpi ? columns.find((c) => c.id === firstKpi.columnId) : null;

        // Find dimension column based on template's dimension selection strategy
        const findDimensionColumn = (strategy: string | undefined) => {
            switch (strategy) {
                case 'first_high_cardinality':
                    return dimensionColumns.length ? dimensionColumns[0] : null;
                case 'first_dimension':
                    // Any non-KPI column
                    return classifications.find((c) => !c.isKPI) || null;
                default:
                    return dimensionColumns.length ? dimensionColumns[0] : null;
            }
        };

        for (const section of template.sections) {
            // Evaluate condition
            const shouldInclude = evaluateCondition(section.condition, conditionContext);

            if (!shouldInclude) {
                if (section.required) {
                    warnings.push(`Required section "${section.title}" could not be included — condition not met.`);
                }
                continue;
            }

            // Resolve placeholders in title
            const resolvedTitle = resolvePlaceholders(section.title, {
                dataModelName: dataModel.name,
                dimensionName: findDimensionColumn(section.dimensionSelection)
                    ? columns.find((c) => c.id === findDimensionColumn(section.dimensionSelection)!.columnId)?.name
                    : undefined,
                metricName: firstKpiCol?.name,
            });

            switch (section.type) {
                case 'kpi_row': {
                    let kpisToAdd = kpiColumns;
                    if (section.kpiSlots === 'top3') {
                        kpisToAdd = kpiColumns.slice(0, 3);
                    } else if (section.kpiSlots === 'primary') {
                        kpisToAdd = kpiColumns.slice(0, 1);
                    }
                    // 'all' uses all kpiColumns

                    for (let i = 0; i < kpisToAdd.length; i++) {
                        const cls = kpisToAdd[i];
                        const col = columns.find((c) => c.id === cls.columnId);
                        if (!col) continue;

                        await (ReportProcessor.getInstance() as any).reportItemsService.createItem(report.id, {
                            item_type: 'kpi_card',
                            data_model_id: dataModelId,
                            display_order: displayOrder,
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
                        displayOrder++;
                    }
                    if (kpisToAdd.length) {
                        sectionsAdded.push(section.id);
                    } else {
                        warnings.push(`KPI section "${section.id}" has no KPI columns to display.`);
                    }
                    break;
                }

                case 'ai_insights': {
                    if (options.skipAiAnalysis) {
                        await (ReportProcessor.getInstance() as any).reportItemsService.createItem(report.id, {
                            item_type: 'ai_insight',
                            data_model_id: dataModelId,
                            display_order: displayOrder,
                            title_override: `${resolvedTitle} (Pending)`,
                            payload: {
                                category: 'general',
                                markdown: '*AI analysis will appear here once triggered.*',
                                data_model_id: dataModelId,
                                placeholder: true,
                            },
                        });
                        displayOrder++;
                        sectionsAdded.push(`${section.id}_placeholder`);
                    } else {
                        try {
                            const analysisService = DataModelAnalysisService.getInstance();
                            const aiResult = await analysisService.analyzeModel(dataModelId, userId, projectId);

                            // Convert statistical analysis results into insight items
                            const insightItems: Array<{ category: string; markdown: string; severity: string }> = [];

                            if (aiResult.anomalies?.length) {
                                for (const anomaly of aiResult.anomalies) {
                                    insightItems.push({
                                        category: 'anomaly',
                                        markdown: `**Anomaly detected in \`${anomaly.column_name}\`**: Z-score ${anomaly.z_score?.toFixed(2)}, value ${anomaly.value}, severity: ${anomaly.severity}`,
                                        severity: anomaly.severity === 'high' ? 'warning' : 'info',
                                    });
                                }
                            }

                            if (aiResult.trends?.length) {
                                for (const trend of aiResult.trends) {
                                    insightItems.push({
                                        category: 'trend',
                                        markdown: `**Trend in \`${trend.column_name}\`**: ${trend.direction} trend (momentum: ${trend.momentum}, R²: ${trend.r_squared?.toFixed(3)})`,
                                        severity: 'info',
                                    });
                                }
                            }

                            if (aiResult.correlations?.length) {
                                for (const corr of aiResult.correlations) {
                                    insightItems.push({
                                        category: 'correlation',
                                        markdown: `**Correlation between \`${corr.column_a}\` and \`${corr.column_b}\`**: ${corr.correlation?.toFixed(2)} (${corr.strength}, ${corr.direction})`,
                                        severity: 'info',
                                    });
                                }
                            }

                            if (insightItems.length > 0) {
                                for (const insight of insightItems) {
                                    await (ReportProcessor.getInstance() as any).reportItemsService.createItem(report.id, {
                                        item_type: 'ai_insight',
                                        data_model_id: dataModelId,
                                        display_order: displayOrder,
                                        title_override: insight.category || resolvedTitle,
                                        payload: {
                                            category: insight.category || 'general',
                                            markdown: insight.markdown,
                                            severity: insight.severity || 'info',
                                            data_model_id: dataModelId,
                                        },
                                    });
                                    displayOrder++;
                                }
                                sectionsAdded.push(section.id);
                            } else {
                                await (ReportProcessor.getInstance() as any).reportItemsService.createItem(report.id, {
                                    item_type: 'ai_insight',
                                    data_model_id: dataModelId,
                                    display_order: displayOrder,
                                    title_override: resolvedTitle,
                                    payload: {
                                        category: 'general',
                                        markdown: '*No AI insights could be generated for this data model.*',
                                        data_model_id: dataModelId,
                                    },
                                });
                                displayOrder++;
                                sectionsAdded.push(`${section.id}_empty`);
                                warnings.push('AI analysis returned no insights.');
                            }
                        } catch (err: any) {
                            console.warn('[ReportGenerator] AI analysis failed:', err.message);
                            warnings.push(`AI analysis failed: ${err.message}`);
                            await (ReportProcessor.getInstance() as any).reportItemsService.createItem(report.id, {
                                item_type: 'ai_insight',
                                data_model_id: dataModelId,
                                display_order: displayOrder,
                                title_override: `${resolvedTitle} (Error)`,
                                payload: {
                                    category: 'general',
                                    markdown: `*AI analysis could not be completed: ${err.message}*`,
                                    data_model_id: dataModelId,
                                },
                            });
                            displayOrder++;
                            sectionsAdded.push(`${section.id}_error`);
                        }
                    }
                    break;
                }

                case 'trend_note': {
                    if (dateColumn) {
                        await (ReportProcessor.getInstance() as any).reportItemsService.createItem(report.id, {
                            item_type: 'text_block',
                            data_model_id: dataModelId,
                            display_order: displayOrder,
                            title_override: resolvedTitle,
                            payload: {
                    content: `📈 **Trend Charts Available**\n\nThis data model contains a date/time column (\`${dateColumn.name}\`). You can use the report builder to add trend visualizations that track how metrics change over time.`,
                                style: 'info',
                                data_model_id: dataModelId,
                            },
                        });
                        displayOrder++;
                        sectionsAdded.push(section.id);
                    }
                    break;
                }

                case 'text_block': {
                    const resolvedContent = resolvePlaceholders(section.content || '', {
                        dataModelName: dataModel.name,
                        dimensionName: findDimensionColumn(section.dimensionSelection)
                            ? columns.find((c) => c.id === findDimensionColumn(section.dimensionSelection)!.columnId)?.name
                            : undefined,
                        metricName: firstKpiCol?.name,
                    });

                    await (ReportProcessor.getInstance() as any).reportItemsService.createItem(report.id, {
                        item_type: 'text_block',
                        data_model_id: dataModelId,
                        display_order: displayOrder,
                        title_override: resolvedTitle,
                        payload: {
                            content: resolvedContent,
                            style: 'default',
                            data_model_id: dataModelId,
                        },
                    });
                    displayOrder++;
                    sectionsAdded.push(section.id);
                    break;
                }
            }
        }

        // ── Step 4: Fetch the fully populated report ──
        const fullReport = await (ReportProcessor.getInstance() as any).getReport(report.id);

        return {
            report: fullReport,
            items: fullReport?.items || [],
            sectionsAdded,
            aiInsightsGenerated: sectionsAdded.some((s) => s.includes('ai_') && !s.includes('placeholder') && !s.includes('error') && !s.includes('empty')),
            warnings,
            templateId: template.id,
            templateName: template.name,
        };
    }
}
