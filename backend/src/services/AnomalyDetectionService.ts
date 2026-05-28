/**
 * Anomaly Detection & AI Alerts Service
 *
 * Dedicated service for detecting anomalies in marketing metrics and generating
 * actionable alerts for CMOs. Implements four detection methods:
 *
 * 1. Sudden Change — Metric changed > 2 standard deviations from rolling 30-day average
 * 2. Trend Break — Metric direction reversed (was improving, now declining)
 * 3. Budget Pacing — Spend rate > 120% or < 80% of expected daily budget
 * 4. Performance Threshold — CPA > 2x target, ROAS < 0.5x target
 *
 * Each alert includes severity, type, metric, message, suggested action, and timestamp.
 * Alerts can be enhanced with natural-language descriptions via Gemini AI.
 */

import { DBDriver } from '../drivers/DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { MarketingKPIMatcher, IColumnClassification } from './detection/MarketingKPIMatcher.js';
import { DRATableMetadata } from '../models/DRATableMetadata.js';
import { DRADataModelSource } from '../models/DRADataModelSource.js';
import { AppDataSource } from '../datasources/PostgresDS.js';
import { GoogleGenAI } from '@google/genai';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertType = 'anomaly' | 'performance' | 'budget';

export interface IAlert {
    id: string;
    severity: AlertSeverity;
    type: AlertType;
    metric: string;
    message: string;
    suggestedAction: string;
    currentValue: number;
    expectedValue: number | null;
    deviationPercent: number | null;
    campaignContext: string | null;
    channelContext: string | null;
    date: string;
    createdAt: string;
}

export interface IDetectedAnomaly {
    metric: string;
    date: string;
    value: number;
    expected: number;
    deviationPercent: number;
    severity: AlertSeverity;
    type: AlertType;
    message: string;
    suggestedAction: string;
}

export interface IAlertsResponse {
    alerts: IAlert[];
    summary: {
        total: number;
        critical: number;
        warning: number;
        info: number;
        byType: Record<AlertType, number>;
    };
}

export interface IAnomalyDetectionOptions {
    thresholds?: {
        suddenChange?: number;     // std dev multiplier (default 2)
        budgetHigh?: number;       // upper budget threshold % (default 120)
        budgetLow?: number;        // lower budget threshold % (default 80)
        cpaMultiplier?: number;    // CPA target multiplier (default 2)
        roasMultiplier?: number;   // ROAS target multiplier (default 0.5)
    };
    includeAiEnhancement?: boolean;
    dailyBudget?: number;          // optional daily budget for pacing analysis
    cpaTarget?: number;            // optional CPA target
    roasTarget?: number;           // optional ROAS target
}

interface IDiscoveredColumns {
    tableName: string;
    fullTableName: string;
    kpiColumns: Map<string, string>;
    dimensionColumns: Map<string, string>;
    dateColumn: string | null;
    allColumns: Array<{ column_name: string; classification: IColumnClassification }>;
}

interface IDailyMetric {
    date: string;
    value: number;
}

// ---------------------------------------------------------------------------
// KPI Labels
// ---------------------------------------------------------------------------

const KPI_LABELS: Record<string, string> = {
    spend: 'Total Spend',
    impressions: 'Total Impressions',
    clicks: 'Total Clicks',
    conversions: 'Total Conversions',
    revenue: 'Total Revenue',
    leads: 'Total Leads',
    engagement: 'Total Engagement',
    opens: 'Total Opens',
    sends: 'Total Sends',
    traffic: 'Total Sessions',
    shares: 'Total Shares',
    likes: 'Total Likes',
    comments: 'Total Comments',
    video_views: 'Total Video Views',
    reach: 'Total Reach',
    bounces: 'Total Bounces',
    unsubscribes: 'Total Unsubscribes',
};

const RAW_KPIS = new Set([
    'spend', 'impressions', 'clicks', 'conversions', 'revenue', 'leads',
    'engagement', 'opens', 'sends', 'traffic', 'shares', 'likes', 'comments',
    'video_views', 'reach', 'bounces', 'unsubscribes',
]);

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class AnomalyDetectionService {
    private static instance: AnomalyDetectionService;
    private constructor() {}

    public static getInstance(): AnomalyDetectionService {
        if (!AnomalyDetectionService.instance) {
            AnomalyDetectionService.instance = new AnomalyDetectionService();
        }
        return AnomalyDetectionService.instance;
    }

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    /**
     * Detect anomalies and generate actionable alerts.
     *
     * Runs all four detection methods, groups results by type, and optionally
     * enhances descriptions with Gemini AI.
     */
    public async detectAlerts(
        dataModelId: number,
        startDate: Date,
        endDate: Date,
        options: IAnomalyDetectionOptions = {},
    ): Promise<IAlertsResponse> {
        const manager = await this.getManager();
        const discoveredTables = await this.discoverColumns(dataModelId);

        if (discoveredTables.length === 0) {
            return { alerts: [], summary: { total: 0, critical: 0, warning: 0, info: 0, byType: { anomaly: 0, performance: 0, budget: 0 } } };
        }

        const allAlerts: IAlert[] = [];

        // Run all detection methods
        const suddenChangeAlerts = await this.detectSuddenChanges(manager, discoveredTables, startDate, endDate, options);
        const trendBreakAlerts = await this.detectTrendBreaks(manager, discoveredTables, startDate, endDate, options);
        const budgetPacingAlerts = await this.detectBudgetPacing(manager, discoveredTables, startDate, endDate, options);
        const perfThresholdAlerts = await this.detectPerformanceThresholds(manager, discoveredTables, startDate, endDate, options);

        allAlerts.push(...suddenChangeAlerts, ...trendBreakAlerts, ...budgetPacingAlerts, ...perfThresholdAlerts);

        // AI enhancement
        if (options.includeAiEnhancement && allAlerts.length > 0) {
            try {
                await this.enhanceAlertsWithAI(allAlerts, discoveredTables);
            } catch (err) {
                console.warn('[AnomalyDetectionService] AI enhancement failed, returning raw alerts:', err);
            }
        }

        // Sort by severity (critical first), then by deviation magnitude
        allAlerts.sort((a, b) => {
            const sevOrder: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
            if (sevOrder[a.severity] !== sevOrder[b.severity]) {
                return sevOrder[a.severity] - sevOrder[b.severity];
            }
            return Math.abs(b.deviationPercent ?? 0) - Math.abs(a.deviationPercent ?? 0);
        });

        // Build summary
        const summary = {
            total: allAlerts.length,
            critical: allAlerts.filter(a => a.severity === 'critical').length,
            warning: allAlerts.filter(a => a.severity === 'warning').length,
            info: allAlerts.filter(a => a.severity === 'info').length,
            byType: {
                anomaly: allAlerts.filter(a => a.type === 'anomaly').length,
                performance: allAlerts.filter(a => a.type === 'performance').length,
                budget: allAlerts.filter(a => a.type === 'budget').length,
            },
        };

        return { alerts: allAlerts, summary };
    }

    // -----------------------------------------------------------------------
    // Detection Method 1: Sudden Change
    // -----------------------------------------------------------------------

    /**
     * Detect sudden metric changes that exceed a threshold number of standard
     * deviations from the rolling 30-day average.
     */
    private async detectSuddenChanges(
        manager: any,
        tables: IDiscoveredColumns[],
        startDate: Date,
        endDate: Date,
        options: IAnomalyDetectionOptions,
    ): Promise<IAlert[]> {
        const alerts: IAlert[] = [];
        const stdDevMultiplier = options.thresholds?.suddenChange ?? 2;

        // Rolling average window: 30 days before the start date
        const rollingStart = new Date(startDate.getTime() - 30 * 86_400_000);
        const rollingEnd = new Date(startDate.getTime() - 86_400_000);

        for (const table of tables) {
            if (!table.dateColumn) continue;

            for (const [kpi, colName] of table.kpiColumns) {
                if (!RAW_KPIS.has(kpi)) continue;

                // Get rolling stats (30-day window)
                const rollingQuery = `
                    SELECT COALESCE(AVG(daily_sum), 0) AS avg_value,
                           COALESCE(STDDEV(daily_sum), 0) AS std_value
                    FROM (
                        SELECT DATE("${table.dateColumn}") AS d, SUM("${colName}") AS daily_sum
                        FROM ${table.fullTableName}
                        WHERE "${table.dateColumn}" BETWEEN $1 AND $2
                        GROUP BY DATE("${table.dateColumn}")
                    ) sub
                `;

                try {
                    const [rollingStats] = await manager.query(rollingQuery, [
                        rollingStart.toISOString(), rollingEnd.toISOString(),
                    ]);

                    const rollingAvg = Number(rollingStats?.avg_value || 0);
                    const rollingStd = Number(rollingStats?.std_value || 0);

                    if (rollingAvg === 0 && rollingStd === 0) continue;

                    // Get current period daily values
                    const currentQuery = `
                        SELECT DATE("${table.dateColumn}") AS date,
                               COALESCE(SUM("${colName}"), 0) AS value
                        FROM ${table.fullTableName}
                        WHERE "${table.dateColumn}" BETWEEN $1 AND $2
                        GROUP BY DATE("${table.dateColumn}")
                        ORDER BY date ASC
                    `;

                    const currentRows = await manager.query(currentQuery, [
                        startDate.toISOString(), endDate.toISOString(),
                    ]);

                    for (const row of currentRows) {
                        const value = Number(row.value);
                        const deviation = rollingAvg > 0 ? ((value - rollingAvg) / rollingAvg) * 100 : 0;

                        // Check if value exceeds threshold (using std dev if available, else percentage)
                        const thresholdExceeded = rollingStd > 0
                            ? Math.abs(value - rollingAvg) > (rollingStd * stdDevMultiplier)
                            : Math.abs(deviation) > 30; // Fallback: 30% deviation

                        if (thresholdExceeded) {
                            const severity = this.calculateSeverity(deviation, kpi);
                            const direction = deviation > 0 ? 'increased' : 'decreased';

                            alerts.push(this.createAlert({
                                severity,
                                type: 'anomaly',
                                metric: KPI_LABELS[kpi] || kpi,
                                message: `${KPI_LABELS[kpi] || kpi} ${direction} by ${Math.abs(deviation).toFixed(1)}% compared to the 30-day rolling average. ` +
                                    `Current: ${this.formatValue(value, kpi)}, Expected: ${this.formatValue(rollingAvg, kpi)}.`,
                                suggestedAction: this.getSuggestedAction(kpi, deviation),
                                currentValue: value,
                                expectedValue: rollingAvg,
                                deviationPercent: deviation,
                                date: String(row.date),
                                campaignContext: null,
                                channelContext: null,
                            }));
                        }
                    }
                } catch (err) {
                    console.warn(`[AnomalyDetectionService] Sudden change detection failed for ${kpi}:`, err);
                }
            }
        }

        return alerts;
    }

    // -----------------------------------------------------------------------
    // Detection Method 2: Trend Break
    // -----------------------------------------------------------------------

    /**
     * Detect trend reversals where a metric that was improving is now declining
     * (or vice versa). Compares the direction of the first half vs second half
     * of the period, plus the trailing 14-day trend before the period.
     */
    private async detectTrendBreaks(
        manager: any,
        tables: IDiscoveredColumns[],
        startDate: Date,
        endDate: Date,
        options: IAnomalyDetectionOptions,
    ): Promise<IAlert[]> {
        const alerts: IAlert[] = [];

        // Pre-period trend window: 14 days before start
        const preStart = new Date(startDate.getTime() - 14 * 86_400_000);
        const preEnd = new Date(startDate.getTime() - 86_400_000);

        const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / 86_400_000);
        const midDate = new Date(startDate.getTime() + (periodDays / 2) * 86_400_000);

        // Only meaningful for periods >= 7 days
        if (periodDays < 7) return alerts;

        for (const table of tables) {
            if (!table.dateColumn) continue;

            for (const [kpi, colName] of table.kpiColumns) {
                // Only check rate KPIs and high-signal raw KPIs
                if (!['spend', 'conversions', 'revenue', 'clicks', 'leads', 'traffic'].includes(kpi)) continue;

                try {
                    // Pre-period trend (first half vs second half of pre-period)
                    const preTrend = await this.getTrendDirection(manager, table, kpi, colName, preStart, preEnd);
                    if (preTrend === null) continue;

                    // Current period: first half vs second half
                    const currentTrend = await this.getTrendDirection(manager, table, kpi, colName, startDate, endDate);
                    if (currentTrend === null) continue;

                    // Check for reversal: was improving (positive), now declining (negative)
                    // or was declining (negative), now improving (positive)
                    const isReversal = (preTrend > 0 && currentTrend < 0) || (preTrend < 0 && currentTrend > 0);

                    if (isReversal) {
                        const preDirection = preTrend > 0 ? 'improving' : 'declining';
                        const curDirection = currentTrend > 0 ? 'improving' : 'declining';

                        // Calculate severity based on the magnitude of reversal
                        const reversalMagnitude = Math.abs(currentTrend - preTrend);
                        let severity: AlertSeverity = 'info';
                        if (reversalMagnitude > 30) severity = 'critical';
                        else if (reversalMagnitude > 15) severity = 'warning';

                        // Get the latest value for context
                        const latestValue = await this.getLatestDailyValue(manager, table, colName, startDate, endDate);

                        alerts.push(this.createAlert({
                            severity,
                            type: 'anomaly',
                            metric: KPI_LABELS[kpi] || kpi,
                            message: `Trend reversal detected for ${KPI_LABELS[kpi] || kpi}: was ${preDirection} over the prior 14 days, now ${curDirection}. ` +
                                `Trend shift magnitude: ${reversalMagnitude.toFixed(1)}%.`,
                            suggestedAction: this.getTrendBreakAction(kpi, preDirection, curDirection),
                            currentValue: latestValue,
                            expectedValue: null,
                            deviationPercent: reversalMagnitude,
                            date: endDate.toISOString().split('T')[0],
                            campaignContext: null,
                            channelContext: null,
                        }));
                    }
                } catch (err) {
                    console.warn(`[AnomalyDetectionService] Trend break detection failed for ${kpi}:`, err);
                }
            }
        }

        return alerts;
    }

    // -----------------------------------------------------------------------
    // Detection Method 3: Budget Pacing Anomaly
    // -----------------------------------------------------------------------

    /**
     * Detect budget pacing anomalies: spend rate is significantly above or below
     * the expected daily budget. If no explicit daily budget is provided, the
     * expected rate is derived from total spend / total days in the period.
     */
    private async detectBudgetPacing(
        manager: any,
        tables: IDiscoveredColumns[],
        startDate: Date,
        endDate: Date,
        options: IAnomalyDetectionOptions,
    ): Promise<IAlert[]> {
        const alerts: IAlert[] = [];
        const budgetHigh = options.thresholds?.budgetHigh ?? 120;
        const budgetLow = options.thresholds?.budgetLow ?? 80;

        const periodDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / 86_400_000));

        for (const table of tables) {
            if (!table.dateColumn) continue;

            const spendCol = table.kpiColumns.get('spend');
            if (!spendCol) continue;

            try {
                // Get total spend for the period
                const totalQuery = `
                    SELECT COALESCE(SUM("${spendCol}"), 0) AS total_spend
                    FROM ${table.fullTableName}
                    WHERE "${table.dateColumn}" BETWEEN $1 AND $2
                `;
                const [totalRow] = await manager.query(totalQuery, [
                    startDate.toISOString(), endDate.toISOString(),
                ]);
                const totalSpend = Number(totalRow?.total_spend || 0);
                if (totalSpend === 0) continue;

                // Determine daily budget
                let dailyBudget = options.dailyBudget;
                if (!dailyBudget) {
                    // Derive from total spend: expected average daily spend
                    dailyBudget = totalSpend / periodDays;
                }

                // Get daily spend values
                const dailyQuery = `
                    SELECT DATE("${table.dateColumn}") AS date,
                           COALESCE(SUM("${spendCol}"), 0) AS value
                    FROM ${table.fullTableName}
                    WHERE "${table.dateColumn}" BETWEEN $1 AND $2
                    GROUP BY DATE("${table.dateColumn}")
                    ORDER BY date ASC
                `;
                const dailyRows = await manager.query(dailyQuery, [
                    startDate.toISOString(), endDate.toISOString(),
                ]);

                for (const row of dailyRows) {
                    const dailySpend = Number(row.value);
                    const pacingPercent = (dailySpend / dailyBudget) * 100;

                    if (pacingPercent > budgetHigh) {
                        const overspend = pacingPercent - 100;
                        alerts.push(this.createAlert({
                            severity: pacingPercent > 150 ? 'critical' : 'warning',
                            type: 'budget',
                            metric: 'Budget Pacing',
                            message: `Daily spend of ${this.formatValue(dailySpend, 'spend')} exceeded the expected budget by ${(pacingPercent - 100).toFixed(0)}%. ` +
                                `Expected daily budget: ${this.formatValue(dailyBudget, 'spend')}.`,
                            suggestedAction: `Review active campaigns and consider pausing underperforming ad sets or reducing daily caps. ` +
                                `If this overspend continues, the total budget will be exhausted before the end of the period.`,
                            currentValue: dailySpend,
                            expectedValue: dailyBudget,
                            deviationPercent: overspend,
                            date: String(row.date),
                            campaignContext: null,
                            channelContext: null,
                        }));
                    } else if (pacingPercent < budgetLow && dailyBudget > 0) {
                        const underspend = 100 - pacingPercent;
                        alerts.push(this.createAlert({
                            severity: pacingPercent < 50 ? 'warning' : 'info',
                            type: 'budget',
                            metric: 'Budget Pacing',
                            message: `Daily spend of ${this.formatValue(dailySpend, 'spend')} is ${underspend.toFixed(0)}% below the expected budget. ` +
                                `Expected daily budget: ${this.formatValue(dailyBudget, 'spend')}.`,
                            suggestedAction: `Consider increasing bids, expanding audience targeting, or activating paused campaigns to utilize the full budget.`,
                            currentValue: dailySpend,
                            expectedValue: dailyBudget,
                            deviationPercent: -underspend,
                            date: String(row.date),
                            campaignContext: null,
                            channelContext: null,
                        }));
                    }
                }
            } catch (err) {
                console.warn(`[AnomalyDetectionService] Budget pacing detection failed:`, err);
            }
        }

        return alerts;
    }

    // -----------------------------------------------------------------------
    // Detection Method 4: Performance Threshold
    // -----------------------------------------------------------------------

    /**
     * Detect performance threshold breaches: CPA exceeds target or ROAS falls
     * below target. If no explicit targets are provided, uses 2x average CPA
     * and 0.5x average ROAS as thresholds.
     */
    private async detectPerformanceThresholds(
        manager: any,
        tables: IDiscoveredColumns[],
        startDate: Date,
        endDate: Date,
        options: IAnomalyDetectionOptions,
    ): Promise<IAlert[]> {
        const alerts: IAlert[] = [];
        const cpaMultiplier = options.thresholds?.cpaMultiplier ?? 2;
        const roasMultiplier = options.thresholds?.roasMultiplier ?? 0.5;

        for (const table of tables) {
            if (!table.dateColumn) continue;

            const spendCol = table.kpiColumns.get('spend');
            const conversionsCol = table.kpiColumns.get('conversions');
            const revenueCol = table.kpiColumns.get('revenue');

            // Build channel dimension context
            const channelCol = table.dimensionColumns.get('channel')
                || table.dimensionColumns.get('source')
                || table.dimensionColumns.get('platform')
                || null;

            const campaignCol = table.dimensionColumns.get('campaign') || null;

            // CPA check (needs spend + conversions)
            if (spendCol && conversionsCol) {
                try {
                    const groupingCols: string[] = [];
                    const selectCols: string[] = [];
                    if (channelCol) {
                        groupingCols.push(`"${channelCol}"`);
                        selectCols.push(`"${channelCol}" AS channel`);
                    }
                    if (campaignCol) {
                        groupingCols.push(`"${campaignCol}"`);
                        selectCols.push(`"${campaignCol}" AS campaign`);
                    }

                    const cpaQuery = `
                        SELECT ${selectCols.length > 0 ? selectCols.join(', ') + ',' : ''}
                               COALESCE(SUM("${spendCol}"), 0) AS total_spend,
                               COALESCE(SUM("${conversionsCol}"), 0) AS total_conversions
                        FROM ${table.fullTableName}
                        WHERE "${table.dateColumn}" BETWEEN $1 AND $2
                        ${groupingCols.length > 0 ? `GROUP BY ${groupingCols.join(', ')}` : ''}
                    `;

                    const cpaRows = await manager.query(cpaQuery, [
                        startDate.toISOString(), endDate.toISOString(),
                    ]);

                    // Compute overall average CPA for threshold baseline
                    let overallSpend = 0;
                    let overallConversions = 0;
                    for (const row of cpaRows) {
                        overallSpend += Number(row.total_spend || 0);
                        overallConversions += Number(row.total_conversions || 0);
                    }
                    const overallCpa = overallConversions > 0 ? overallSpend / overallConversions : 0;
                    const cpaTarget = options.cpaTarget ?? (overallCpa > 0 ? overallCpa : null);

                    if (cpaTarget !== null && cpaTarget > 0) {
                        for (const row of cpaRows) {
                            const spend = Number(row.total_spend || 0);
                            const conversions = Number(row.total_conversions || 0);
                            if (conversions === 0) continue;

                            const cpa = spend / conversions;
                            const cpaRatio = cpa / cpaTarget;

                            if (cpaRatio >= cpaMultiplier) {
                                const context = this.buildContext(row);
                                alerts.push(this.createAlert({
                                    severity: cpaRatio >= cpaMultiplier * 1.5 ? 'critical' : 'warning',
                                    type: 'performance',
                                    metric: 'Cost Per Acquisition (CPA)',
                                    message: `CPA${context ? ` for ${context}` : ''} is ${this.formatValue(cpa, 'spend')}, ` +
                                        `which is ${cpaRatio.toFixed(1)}x the target of ${this.formatValue(cpaTarget, 'spend')}.`,
                                    suggestedAction: `Review targeting and creative for this segment. ` +
                                        `Consider pausing low-performing campaigns and reallocating budget to higher-performing channels.`,
                                    currentValue: cpa,
                                    expectedValue: cpaTarget,
                                    deviationPercent: (cpaRatio - 1) * 100,
                                    date: endDate.toISOString().split('T')[0],
                                    campaignContext: row.campaign || null,
                                    channelContext: row.channel || null,
                                }));
                            }
                        }
                    }
                } catch (err) {
                    console.warn('[AnomalyDetectionService] CPA threshold detection failed:', err);
                }
            }

            // ROAS check (needs spend + revenue)
            if (spendCol && revenueCol) {
                try {
                    const groupingCols: string[] = [];
                    const selectCols: string[] = [];
                    if (channelCol) {
                        groupingCols.push(`"${channelCol}"`);
                        selectCols.push(`"${channelCol}" AS channel`);
                    }
                    if (campaignCol) {
                        groupingCols.push(`"${campaignCol}"`);
                        selectCols.push(`"${campaignCol}" AS campaign`);
                    }

                    const roasQuery = `
                        SELECT ${selectCols.length > 0 ? selectCols.join(', ') + ',' : ''}
                               COALESCE(SUM("${spendCol}"), 0) AS total_spend,
                               COALESCE(SUM("${revenueCol}"), 0) AS total_revenue
                        FROM ${table.fullTableName}
                        WHERE "${table.dateColumn}" BETWEEN $1 AND $2
                        ${groupingCols.length > 0 ? `GROUP BY ${groupingCols.join(', ')}` : ''}
                    `;

                    const roasRows = await manager.query(roasQuery, [
                        startDate.toISOString(), endDate.toISOString(),
                    ]);

                    // Compute overall average ROAS for threshold baseline
                    let overallSpend = 0;
                    let overallRevenue = 0;
                    for (const row of roasRows) {
                        overallSpend += Number(row.total_spend || 0);
                        overallRevenue += Number(row.total_revenue || 0);
                    }
                    const overallRoas = overallSpend > 0 ? overallRevenue / overallSpend : 0;
                    const roasTarget = options.roasTarget ?? (overallRoas > 0 ? overallRoas : null);

                    if (roasTarget !== null && roasTarget > 0) {
                        for (const row of roasRows) {
                            const spend = Number(row.total_spend || 0);
                            const revenue = Number(row.total_revenue || 0);
                            if (spend === 0) continue;

                            const roas = revenue / spend;
                            const roasRatio = roas / roasTarget;

                            if (roasRatio <= roasMultiplier) {
                                const context = this.buildContext(row);
                                alerts.push(this.createAlert({
                                    severity: roasRatio <= roasMultiplier * 0.5 ? 'critical' : 'warning',
                                    type: 'performance',
                                    metric: 'Return on Ad Spend (ROAS)',
                                    message: `ROAS${context ? ` for ${context}` : ''} is ${roas.toFixed(2)}x, ` +
                                        `which is ${roasRatio.toFixed(1)}x of the target ${roasTarget.toFixed(2)}x.`,
                                    suggestedAction: `Evaluate creative performance and audience relevance. ` +
                                        `Shift budget toward high-ROAS campaigns and pause segments below break-even.`,
                                    currentValue: roas,
                                    expectedValue: roasTarget,
                                    deviationPercent: (roasRatio - 1) * 100,
                                    date: endDate.toISOString().split('T')[0],
                                    campaignContext: row.campaign || null,
                                    channelContext: row.channel || null,
                                }));
                            }
                        }
                    }
                } catch (err) {
                    console.warn('[AnomalyDetectionService] ROAS threshold detection failed:', err);
                }
            }
        }

        return alerts;
    }

    // -----------------------------------------------------------------------
    // AI Enhancement
    // -----------------------------------------------------------------------

    /**
     * Enhance alerts with natural-language descriptions using Gemini AI.
     * Adds specific campaign/channel context to messages.
     */
    private async enhanceAlertsWithAI(
        alerts: IAlert[],
        tables: IDiscoveredColumns[],
    ): Promise<void> {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.warn('[AnomalyDetectionService] No GEMINI_API_KEY set, skipping AI enhancement');
            return;
        }

        const genAI = new GoogleGenAI({ apiKey });

        const alertSummaries = alerts.slice(0, 10).map(a => ({
            type: a.type,
            metric: a.metric,
            severity: a.severity,
            currentValue: a.currentValue,
            expectedValue: a.expectedValue,
            deviationPercent: a.deviationPercent,
            campaign: a.campaignContext,
            channel: a.channelContext,
        }));

        const prompt = `You are a marketing analytics AI assistant for a CMO dashboard.
Given these marketing metric alerts, enhance each alert message to be more specific, actionable, and include relevant campaign/channel context.

For each alert, provide:
- An enhanced message that includes specific dates, campaign names, or channels when available
- A more specific suggested action

Return ONLY valid JSON array, no markdown:
[
  {
    "index": 0,
    "enhancedMessage": "...",
    "enhancedAction": "..."
  }
]

Alerts:
${JSON.stringify(alertSummaries, null, 2)}`;

        try {
            const response = await genAI.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
            });

            const text = response.text || '';
            // Parse JSON from response (handle markdown code blocks)
            let jsonStr = text.trim();
            if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
            }

            const enhancements = JSON.parse(jsonStr);
            if (Array.isArray(enhancements)) {
                for (const enhancement of enhancements) {
                    const idx = enhancement.index;
                    if (idx >= 0 && idx < alerts.length) {
                        if (enhancement.enhancedMessage) {
                            alerts[idx].message = enhancement.enhancedMessage;
                        }
                        if (enhancement.enhancedAction) {
                            alerts[idx].suggestedAction = enhancement.enhancedAction;
                        }
                    }
                }
            }
        } catch (err) {
            console.warn('[AnomalyDetectionService] Gemini AI enhancement failed:', err);
        }
    }

    // -----------------------------------------------------------------------
    // Helper Methods
    // -----------------------------------------------------------------------

    private async getManager() {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) throw new Error('PostgreSQL driver not available');
        const concreteDriver = await driver.getConcreteDriver();
        if (!concreteDriver) throw new Error('Failed to get PostgreSQL connection');
        const manager = concreteDriver.manager;
        if (!manager) throw new Error('Database manager not available');
        return manager;
    }

    private getTableMetadataRepo() {
        return AppDataSource.getRepository(DRATableMetadata);
    }

    private getDataModelSourceRepo() {
        return AppDataSource.getRepository(DRADataModelSource);
    }

    /**
     * Discover KPI, dimension, and date columns from a data model's table metadata.
     */
    private async discoverColumns(dataModelId: number): Promise<IDiscoveredColumns[]> {
        const manager = await this.getManager();
        const kpiMatcher = MarketingKPIMatcher.getInstance();

        const dmSourceRepo = this.getDataModelSourceRepo();
        const dmSources = await dmSourceRepo.find({
            where: { data_model_id: dataModelId },
        });

        if (!dmSources || dmSources.length === 0) {
            throw new Error(`No data model sources found for data model ${dataModelId}`);
        }

        const dataSourceIds = dmSources.map(s => s.data_source_id);
        const tableRepo = this.getTableMetadataRepo();
        const tables = await tableRepo.find({
            where: dataSourceIds.map(id => ({ data_source_id: id })),
        });

        const uniqueTables = new Map<string, { schema: string; physical: string }>();
        for (const t of tables) {
            const key = `${t.schema_name || ''}.${t.physical_table_name}`;
            if (!uniqueTables.has(key)) {
                uniqueTables.set(key, { schema: t.schema_name || 'public', physical: t.physical_table_name });
            }
        }

        if (uniqueTables.size === 0) {
            throw new Error(`No tables found for data model ${dataModelId}`);
        }

        const results: IDiscoveredColumns[] = [];

        for (const table of uniqueTables.values()) {
            const columns: Array<{ column_name: string; data_type: string; ordinal_position: number }> = await manager.query(
                `SELECT column_name, data_type, ordinal_position
                 FROM information_schema.columns
                 WHERE table_schema = $1 AND table_name = $2
                 ORDER BY ordinal_position ASC`,
                [table.schema, table.physical],
            );

            if (!columns || columns.length === 0) continue;

            const kpiColumns = new Map<string, string>();
            const dimensionColumns = new Map<string, string>();
            let dateColumn: string | null = null;
            const allColumns: IDiscoveredColumns['allColumns'] = [];

            for (const col of columns) {
                const classification = kpiMatcher.classifyColumn(col.column_name, col.data_type || 'text');
                allColumns.push({ column_name: col.column_name, classification });

                if (classification.kpi_match && !kpiColumns.has(classification.kpi_match)) {
                    kpiColumns.set(classification.kpi_match, col.column_name);
                }
                if (classification.dimension_match && !dimensionColumns.has(classification.dimension_match)) {
                    dimensionColumns.set(classification.dimension_match, col.column_name);
                }
                if (classification.detected_type === 'date' && !dateColumn) {
                    dateColumn = col.column_name;
                }
            }

            const schemaPrefix = table.schema ? `"${table.schema}".` : '';
            const fullTableName = `${schemaPrefix}"${table.physical}"`;

            results.push({
                tableName: table.physical,
                fullTableName,
                kpiColumns,
                dimensionColumns,
                dateColumn,
                allColumns,
            });
        }

        return results;
    }

    /**
     * Get the trend direction (slope) for a metric over a period.
     * Returns positive if improving, negative if declining, null if insufficient data.
     */
    private async getTrendDirection(
        manager: any,
        table: IDiscoveredColumns,
        kpi: string,
        colName: string,
        start: Date,
        end: Date,
    ): Promise<number | null> {
        const query = `
            SELECT DATE("${table.dateColumn}") AS date,
                   COALESCE(SUM("${colName}"), 0) AS value
            FROM ${table.fullTableName}
            WHERE "${table.dateColumn}" BETWEEN $1 AND $2
            GROUP BY DATE("${table.dateColumn}")
            ORDER BY date ASC
        `;

        const rows = await manager.query(query, [start.toISOString(), end.toISOString()]);
        if (rows.length < 3) return null;

        const values = rows.map((r: any) => Number(r.value));
        const firstHalf = values.slice(0, Math.floor(values.length / 2));
        const secondHalf = values.slice(Math.floor(values.length / 2));

        const firstAvg = firstHalf.reduce((a: number, b: number) => a + b, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((a: number, b: number) => a + b, 0) / secondHalf.length;

        if (firstAvg === 0) return null;
        return ((secondAvg - firstAvg) / firstAvg) * 100;
    }

    /**
     * Get the latest daily value for a metric in a period.
     */
    private async getLatestDailyValue(
        manager: any,
        table: IDiscoveredColumns,
        colName: string,
        start: Date,
        end: Date,
    ): Promise<number> {
        const query = `
            SELECT COALESCE(SUM("${colName}"), 0) AS value
            FROM ${table.fullTableName}
            WHERE "${table.dateColumn}" = (
                SELECT MAX("${table.dateColumn}")
                FROM ${table.fullTableName}
                WHERE "${table.dateColumn}" BETWEEN $1 AND $2
            )
        `;
        const [row] = await manager.query(query, [start.toISOString(), end.toISOString()]);
        return Number(row?.value || 0);
    }

    /**
     * Create a unique alert ID.
     */
    private createAlert(data: Omit<IAlert, 'id' | 'createdAt'>): IAlert {
        const id = `alert_${data.type}_${data.metric}_${data.date}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        return {
            ...data,
            id,
            createdAt: new Date().toISOString(),
        };
    }

    /**
     * Calculate severity based on deviation magnitude and metric type.
     */
    private calculateSeverity(deviation: number, kpi: string): AlertSeverity {
        const absDev = Math.abs(deviation);

        // Cost metrics (spend, CPA, CPC) — higher is worse
        if (['spend'].includes(kpi) && deviation > 0) {
            if (absDev > 50) return 'critical';
            if (absDev > 30) return 'warning';
            return 'info';
        }

        // Revenue metrics (revenue, conversions) — lower is worse
        if (['revenue', 'conversions', 'clicks', 'leads'].includes(kpi) && deviation < 0) {
            if (absDev > 50) return 'critical';
            if (absDev > 30) return 'warning';
            return 'info';
        }

        // General threshold
        if (absDev > 50) return 'critical';
        if (absDev > 30) return 'warning';
        return 'info';
    }

    /**
     * Get suggested action based on the anomaly detected.
     */
    private getSuggestedAction(kpi: string, deviation: number): string {
        const isIncrease = deviation > 0;

        const actions: Record<string, { increase: string; decrease: string }> = {
            spend: {
                increase: 'Review active campaigns for uncontrolled spend. Check daily budget caps and bid strategies.',
                decrease: 'Spend drop detected — review campaign status, bid competitiveness, and audience reach.',
            },
            impressions: {
                increase: 'Impression surge may indicate expanded targeting or viral content. Monitor CTR for quality.',
                decrease: 'Impressions declining — check audience saturation, ad fatigue, or increased competition.',
            },
            clicks: {
                increase: 'Click surge detected — verify traffic quality and landing page capacity.',
                decrease: 'Click drop — review ad copy relevance, keyword performance, and audience targeting.',
            },
            conversions: {
                increase: 'Conversion spike — verify tracking accuracy and landing page performance.',
                decrease: 'Conversions declining — check landing page issues, audience quality, and offer relevance.',
            },
            revenue: {
                increase: 'Revenue surge detected — ensure attribution tracking is accurate.',
                decrease: 'Revenue declining — analyze conversion funnel and pricing strategy.',
            },
        };

        const action = actions[kpi];
        if (action) {
            return isIncrease ? action.increase : action.decrease;
        }

        return isIncrease
            ? `${KPI_LABELS[kpi] || kpi} increased significantly — investigate the root cause and ensure it\'s sustainable.`
            : `${KPI_LABELS[kpi] || kpi} decreased significantly — investigate the cause and consider corrective action.`;
    }

    /**
     * Get suggested action for trend break detection.
     */
    private getTrendBreakAction(kpi: string, priorDirection: string, currentDirection: string): string {
        if (priorDirection === 'improving' && currentDirection === 'declining') {
            return `${KPI_LABELS[kpi] || kpi} was trending upward but has started declining. ` +
                `Review recent campaign changes, market conditions, and competitor activity. Consider increasing bids or refreshing creative.`;
        }
        return `${KPI_LABELS[kpi] || kpi} was declining but has started improving. ` +
            `Identify what changed and consider scaling the successful changes.`;
    }

    /**
     * Build a context string from campaign/channel row data.
     */
    private buildContext(row: any): string {
        const parts: string[] = [];
        if (row.campaign) parts.push(`campaign "${row.campaign}"`);
        if (row.channel) parts.push(`channel "${row.channel}"`);
        return parts.length > 0 ? ` for ${parts.join(' in ')}` : '';
    }

    /**
     * Format a numeric value for display based on KPI type.
     */
    private formatValue(value: number, kpi: string): string {
        if (['spend', 'revenue', 'cpc', 'cpa'].includes(kpi) || kpi === 'spend') {
            return `$${value.toFixed(2)}`;
        }
        if (['ctr', 'roas'].includes(kpi)) {
            return `${value.toFixed(2)}x`;
        }
        if (value >= 1_000_000) {
            return `${(value / 1_000_000).toFixed(1)}M`;
        }
        if (value >= 1_000) {
            return `${(value / 1_000).toFixed(1)}K`;
        }
        return value.toFixed(0);
    }
}

export default AnomalyDetectionService;