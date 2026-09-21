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
import { CampaignTargetsService, ICampaignTarget } from './CampaignTargetsService.js';
import { DRATableMetadata } from '../models/DRATableMetadata.js';
import { DRADataModelSource } from '../models/DRADataModelSource.js';
import { DRADataSource } from '../models/DRADataSource.js';
import { AppDataSource } from '../datasources/PostgresDS.js';
import { GoogleGenAI } from '@google/genai';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertType = 'anomaly' | 'performance' | 'budget';
export type AlertUnit = 'currency' | 'percent' | 'ratio' | 'count';

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
    /** How to render `currentValue` / `expectedValue` on the client. */
    unit: AlertUnit;
    campaignContext: string | null;
    adSetContext: string | null;
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
    /** True when the project has at least one CMO-defined target saved. */
    hasTargets: boolean;
    /** Number of saved target rows considered for this analysis. */
    targetCount: number;
}

export interface IAnomalyDetectionOptions {
    thresholds?: {
        suddenChange?: number;     // std dev multiplier (default 2)
        budgetHigh?: number;       // upper budget threshold % (default 120)
        budgetLow?: number;        // lower budget threshold % (default 80)
        cpaMultiplier?: number;    // CPA target multiplier (default 2)
        roasMultiplier?: number;   // ROAS target multiplier (default 0.5)
    };
    /** Thresholds used when comparing actuals against CMO-defined targets. */
    targetThresholds?: ITargetThresholds;
    includeAiEnhancement?: boolean;
    dailyBudget?: number;          // optional daily budget for pacing analysis
    cpaTarget?: number;            // optional CPA target
    roasTarget?: number;           // optional ROAS target
}

/**
 * Multipliers that decide when the gap between an actual metric and its
 * CMO-defined target becomes a warning or a critical alert.
 */
export interface ITargetThresholds {
    cpaBreach?: number;         // actual / target CPA (default 1.2)
    cpaCritical?: number;       // default 2
    cplBreach?: number;         // default 1.2
    cplCritical?: number;       // default 2
    cpcBreach?: number;         // default 1.2
    cpcCritical?: number;       // default 1.5
    cpmBreach?: number;         // default 1.2
    cpmCritical?: number;       // default 1.5
    frequencyBreach?: number;   // default 1.2
    frequencyCritical?: number; // default 1.5
    roasBreach?: number;        // target / actual ROAS (default 1.25)
    roasCritical?: number;      // default 2
    ctrBreach?: number;         // target / actual CTR (default 1.25)
    ctrCritical?: number;       // default 2
    attainmentWarning?: number; // actual / target volume (default 0.8)
    attainmentCritical?: number;// default 0.5
}

/**
 * Everything the target-aware detectors need to measure actual performance
 * against the settings the CMO/manager defined: north-star targets stored in
 * `dra_campaign_targets` and the budgets configured on the ad platform.
 */
export interface IAlertTargetContext {
    campaignTargets: Map<string, ICampaignTarget>;
    adSetTargets: Map<string, ICampaignTarget>;
    platformBudgets: Map<string, { dailyBudget: number | null; lifetimeBudget: number | null }>;
    hasAnyTarget: boolean;
    targetCount: number;
}

interface IDiscoveredColumns {
    tableName: string;
    logicalTableName: string;
    fullTableName: string;
    dataSourceId: number | null;
    kpiColumns: Map<string, string>;
    dimensionColumns: Map<string, string>;
    dateColumn: string | null;
    allColumns: Array<{ column_name: string; classification: IColumnClassification }>;
}

interface IDailyMetric {
    date: string;
    value: number;
}

/** Aggregated actuals for one campaign or ad set over the reporting period. */
interface IContextActuals {
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
    leads: number;
    frequency: number | null;
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

    /**
     * Dimensions that mark a table as a breakdown of a campaign rather than a
     * campaign/ad set aggregate. Such tables are excluded from target
     * comparisons to avoid repeating the same campaign figures.
     */
    private static readonly BREAKDOWN_DIMENSIONS = [
        'ad', 'device', 'demographic', 'placement', 'geo', 'keyword', 'content', 'audience',
    ];

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
        dataModelIdOrProjectId: number,
        startDate: Date,
        endDate: Date,
        options: IAnomalyDetectionOptions = {},
    ): Promise<IAlertsResponse> {
        const manager = await this.getManager();
        // Support both projectId and dataModelId; treat positive numbers > 10000 or if no data model exists as projectId
        const { tables: discoveredTables, projectId } = await this.resolveTables(dataModelIdOrProjectId);

        if (discoveredTables.length === 0) {
            return {
                alerts: [],
                summary: { total: 0, critical: 0, warning: 0, info: 0, byType: { anomaly: 0, performance: 0, budget: 0 } },
                hasTargets: false,
                targetCount: 0,
            };
        }

        // Load the CMO-defined north-star targets and the ad platform budgets so
        // alerts measure actual performance against expectations instead of
        // self-referential averages.
        const targetContext = await this.loadTargetContext(projectId, discoveredTables);

        const allAlerts: IAlert[] = [];

        // Run all detection methods
        const suddenChangeAlerts = await this.detectSuddenChanges(manager, discoveredTables, startDate, endDate, options);
        const trendBreakAlerts = await this.detectTrendBreaks(manager, discoveredTables, startDate, endDate, options);
        const budgetPacingAlerts = await this.detectBudgetPacing(manager, discoveredTables, startDate, endDate, options, targetContext);
        const perfThresholdAlerts = await this.detectPerformanceThresholds(manager, discoveredTables, startDate, endDate, options, targetContext);

        allAlerts.push(...suddenChangeAlerts, ...trendBreakAlerts, ...budgetPacingAlerts, ...perfThresholdAlerts);

        // Sort by severity (critical first), then by deviation magnitude, so the
        // most significant alert wins when duplicates are collapsed below.
        allAlerts.sort((a, b) => {
            const sevOrder: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
            if (sevOrder[a.severity] !== sevOrder[b.severity]) {
                return sevOrder[a.severity] - sevOrder[b.severity];
            }
            return Math.abs(b.deviationPercent ?? 0) - Math.abs(a.deviationPercent ?? 0);
        });

        // Collapse duplicates. A project can expose multiple tables for the same
        // platform (campaign-level insights plus adset/demographic/device/
        // placement breakdowns) that each repeat the same daily KPIs, so an
        // anomaly is detected once per table. Keep a single alert per
        // type + metric + date + context + message.
        const seenAlertKeys = new Set<string>();
        const alerts = allAlerts.filter((alert) => {
            const key = [
                alert.type,
                alert.metric,
                alert.date,
                alert.campaignContext ?? '',
                alert.adSetContext ?? '',
                alert.channelContext ?? '',
                alert.message,
            ].join('|');
            if (seenAlertKeys.has(key)) return false;
            seenAlertKeys.add(key);
            return true;
        });

        // AI enhancement
        if (options.includeAiEnhancement && alerts.length > 0) {
            try {
                await this.enhanceAlertsWithAI(alerts, discoveredTables);
            } catch (err) {
                console.warn('[AnomalyDetectionService] AI enhancement failed, returning raw alerts:', err);
            }
        }

        // Build summary
        const summary = {
            total: alerts.length,
            critical: alerts.filter(a => a.severity === 'critical').length,
            warning: alerts.filter(a => a.severity === 'warning').length,
            info: alerts.filter(a => a.severity === 'info').length,
            byType: {
                anomaly: alerts.filter(a => a.type === 'anomaly').length,
                performance: alerts.filter(a => a.type === 'performance').length,
                budget: alerts.filter(a => a.type === 'budget').length,
            },
        };

        return { alerts, summary, hasTargets: targetContext.hasAnyTarget, targetCount: targetContext.targetCount };
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
                                adSetContext: null,
                                channelContext: this.channelFromTable(table),
                                unit: this.unitForKpi(kpi),
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
                            adSetContext: null,
                            channelContext: this.channelFromTable(table),
                            unit: this.unitForKpi(kpi),
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
     * Detect budget pacing anomalies: period spend is significantly above or
     * below the budget the CMO/manager defined.
     *
     * The expected budget is taken, in priority order, from the ad set target,
     * the ad set's budget configured on the ad platform, or the parent
     * campaign target. Tables that expose no campaign/ad set context, and
     * contexts with no known budget, are skipped so alerts never compare spend
     * against a self-derived average.
     */
    private async detectBudgetPacing(
        manager: any,
        tables: IDiscoveredColumns[],
        startDate: Date,
        endDate: Date,
        options: IAnomalyDetectionOptions,
        targetContext: IAlertTargetContext,
    ): Promise<IAlert[]> {
        const alerts: IAlert[] = [];
        const budgetHigh = options.thresholds?.budgetHigh ?? 120;
        const budgetLow = options.thresholds?.budgetLow ?? 80;
        const periodDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / 86_400_000));

        for (const table of tables) {
            if (!table.dateColumn || !this.isCanonicalPerformanceTable(table)) continue;

            const spendCol = table.kpiColumns.get('spend');
            const campaignCol = table.dimensionColumns.get('campaign') || null;
            if (!spendCol || !campaignCol) continue;

            const adSetCol = table.dimensionColumns.get('ad_group') || null;
            const channel = this.channelFromTable(table);
            const campaignNameCol = this.nameColumnFor(table, 'campaign');
            const adSetNameCol = adSetCol ? this.nameColumnFor(table, 'ad_group') : null;

            const groupCols: string[] = [`"${campaignCol}"`];
            const selectCols: string[] = [`"${campaignCol}" AS campaign_id`];
            if (campaignNameCol) {
                groupCols.push(`"${campaignNameCol}"`);
                selectCols.push(`"${campaignNameCol}" AS campaign_name`);
            }
            if (adSetCol) {
                groupCols.push(`"${adSetCol}"`);
                selectCols.push(`"${adSetCol}" AS adset_id`);
            }
            if (adSetNameCol) {
                groupCols.push(`"${adSetNameCol}"`);
                selectCols.push(`"${adSetNameCol}" AS adset_name`);
            }

            const query = `
                SELECT ${selectCols.join(', ')},
                       COALESCE(SUM("${spendCol}"), 0) AS period_spend
                FROM ${table.fullTableName}
                WHERE "${table.dateColumn}" BETWEEN $1 AND $2
                GROUP BY ${groupCols.join(', ')}
            `;

            try {
                const rows = await manager.query(query, [
                    startDate.toISOString(), endDate.toISOString(),
                ]);

                for (const row of rows) {
                    const campaignId = row.campaign_id != null ? String(row.campaign_id) : null;
                    const adSetId = adSetCol && row.adset_id != null ? String(row.adset_id) : null;
                    const periodSpend = Number(row.period_spend || 0);

                    const budget = this.resolveExpectedDailyBudget(
                        campaignId, adSetId, targetContext, periodDays, options.dailyBudget,
                    );
                    if (!budget || budget.value <= 0) continue;

                    const expectedPeriod = budget.value * periodDays;
                    const pacingPercent = (periodSpend / expectedPeriod) * 100;
                    const campaignLabel = row.campaign_name ? String(row.campaign_name) : campaignId;
                    const adSetLabel = row.adset_name ? String(row.adset_name) : adSetId;
                    const subject = adSetLabel
                        ? `Ad set "${adSetLabel}"${campaignLabel ? ` (campaign "${campaignLabel}")` : ''}`
                        : `Campaign "${campaignLabel}"`;

                    if (pacingPercent > budgetHigh) {
                        const overspend = pacingPercent - 100;
                        alerts.push(this.createAlert({
                            severity: pacingPercent > 150 ? 'critical' : 'warning',
                            type: 'budget',
                            metric: 'Budget Pacing',
                            message: `${subject} spent ${this.formatValue(periodSpend, 'spend')} over the last ${periodDays} days, ` +
                                `${overspend.toFixed(0)}% above its ${budget.source} of ${this.formatValue(budget.value, 'spend')}/day ` +
                                `(expected ${this.formatValue(expectedPeriod, 'spend')}).`,
                            suggestedAction: `Review pacing for this ${adSetLabel ? 'ad set' : 'campaign'} and consider lowering the budget or ` +
                                `pausing underperforming placements so the budget is not exhausted before the flight ends.`,
                            currentValue: periodSpend,
                            expectedValue: expectedPeriod,
                            deviationPercent: overspend,
                            date: endDate.toISOString().split('T')[0],
                            campaignContext: campaignLabel,
                            adSetContext: adSetLabel,
                            channelContext: channel,
                            unit: 'currency',
                        }));
                    } else if (pacingPercent < budgetLow) {
                        const underspend = 100 - pacingPercent;
                        alerts.push(this.createAlert({
                            severity: pacingPercent < 50 ? 'warning' : 'info',
                            type: 'budget',
                            metric: 'Budget Pacing',
                            message: `${subject} spent ${this.formatValue(periodSpend, 'spend')} over the last ${periodDays} days, ` +
                                `${underspend.toFixed(0)}% below its ${budget.source} of ${this.formatValue(budget.value, 'spend')}/day ` +
                                `(expected ${this.formatValue(expectedPeriod, 'spend')}).`,
                            suggestedAction: `Consider increasing bids, widening targeting, or reactivating paused ` +
                                `${adSetLabel ? 'ad sets' : 'campaigns'} to deliver the planned budget.`,
                            currentValue: periodSpend,
                            expectedValue: expectedPeriod,
                            deviationPercent: -underspend,
                            date: endDate.toISOString().split('T')[0],
                            campaignContext: campaignLabel,
                            adSetContext: adSetLabel,
                            channelContext: channel,
                            unit: 'currency',
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
     * Detect performance threshold breaches by comparing actual performance
     * against the CMO-defined targets for each campaign and ad set.
     *
     * Checks efficiency targets (CPA, CPL, CPC, CPM, frequency, ROAS, CTR) and
     * the attainment of volume targets (conversions, leads, revenue, clicks,
     * impressions). When a context has no target, it is compared against the
     * account average so a materially worse performer is still surfaced.
     */
    private async detectPerformanceThresholds(
        manager: any,
        tables: IDiscoveredColumns[],
        startDate: Date,
        endDate: Date,
        options: IAnomalyDetectionOptions,
        targetContext: IAlertTargetContext,
    ): Promise<IAlert[]> {
        const alerts: IAlert[] = [];
        const date = endDate.toISOString().split('T')[0];

        for (const table of tables) {
            if (!table.dateColumn || !this.isCanonicalPerformanceTable(table)) continue;

            const campaignCol = table.dimensionColumns.get('campaign') || null;
            if (!campaignCol) continue;

            const adSetCol = table.dimensionColumns.get('ad_group') || null;
            const channel = this.channelFromTable(table);
            const campaignNameCol = this.nameColumnFor(table, 'campaign');
            const adSetNameCol = adSetCol ? this.nameColumnFor(table, 'ad_group') : null;

            const metricCols = new Map<string, string>();
            for (const key of ['spend', 'impressions', 'clicks', 'conversions', 'revenue', 'leads', 'frequency']) {
                const col = table.kpiColumns.get(key);
                if (col) metricCols.set(key, col);
            }
            if (metricCols.size === 0) continue;

            const groupCols: string[] = [`"${campaignCol}"`];
            const selectCols: string[] = [`"${campaignCol}" AS campaign_id`];
            if (campaignNameCol) {
                groupCols.push(`"${campaignNameCol}"`);
                selectCols.push(`"${campaignNameCol}" AS campaign_name`);
            }
            if (adSetCol) {
                groupCols.push(`"${adSetCol}"`);
                selectCols.push(`"${adSetCol}" AS adset_id`);
            }
            if (adSetNameCol) {
                groupCols.push(`"${adSetNameCol}"`);
                selectCols.push(`"${adSetNameCol}" AS adset_name`);
            }
            for (const [key, col] of metricCols) {
                selectCols.push(`COALESCE(SUM("${col}"), 0) AS "${key}"`);
            }

            const query = `
                SELECT ${selectCols.join(', ')}
                FROM ${table.fullTableName}
                WHERE "${table.dateColumn}" BETWEEN $1 AND $2
                GROUP BY ${groupCols.join(', ')}
            `;

            let rows: any[] = [];
            try {
                rows = await manager.query(query, [startDate.toISOString(), endDate.toISOString()]);
            } catch (err) {
                console.warn('[AnomalyDetectionService] Target threshold detection failed:', err);
                continue;
            }
            if (!rows || rows.length === 0) continue;

            const actualsFor = (row: any): IContextActuals => ({
                spend: Number(row.spend || 0),
                impressions: Number(row.impressions || 0),
                clicks: Number(row.clicks || 0),
                conversions: Number(row.conversions || 0),
                revenue: Number(row.revenue || 0),
                leads: Number(row.leads || 0),
                frequency: metricCols.has('frequency') ? Number(row.frequency || 0) : null,
            });

            // Primary path: compare each context against its own target.
            let targetedContexts = 0;
            for (const row of rows) {
                const campaignId = row.campaign_id != null ? String(row.campaign_id) : null;
                const adSetId = adSetCol && row.adset_id != null ? String(row.adset_id) : null;
                const target = this.resolveTargetForContext(campaignId, adSetId, targetContext);
                if (!target) continue;

                targetedContexts++;
                alerts.push(...this.evaluateContextAgainstTarget({
                    target,
                    actuals: actualsFor(row),
                    date,
                    channel,
                    campaignLabel: row.campaign_name ? String(row.campaign_name) : campaignId,
                    adSetLabel: row.adset_name ? String(row.adset_name) : adSetId,
                    thresholds: options.targetThresholds ?? {},
                    availableMetrics: new Set(metricCols.keys()),
                }));
            }

            // Fallback: no targets configured for this table, so surface the
            // contexts that diverge from the account average.
            if (targetedContexts === 0 && rows.length >= 2) {
                alerts.push(...this.detectContextsAgainstAverage(rows, actualsFor, {
                    date,
                    channel,
                    cpaMultiplier: options.thresholds?.cpaMultiplier ?? 2,
                    roasMultiplier: options.thresholds?.roasMultiplier ?? 0.5,
                    adSetDimension: !!adSetCol,
                }));
            }
        }

        return alerts;
    }

    /**
     * Compare one campaign/ad set's actuals against the targets its CMO set,
     * emitting an alert for every target that is missed.
     */
    private evaluateContextAgainstTarget(args: {
        target: ICampaignTarget;
        actuals: IContextActuals;
        date: string;
        channel: string | null;
        campaignLabel: string | null;
        adSetLabel: string | null;
        thresholds: ITargetThresholds;
        availableMetrics: Set<string>;
    }): IAlert[] {
        const { target, actuals, date, channel, campaignLabel, adSetLabel, thresholds, availableMetrics } = args;
        const alerts: IAlert[] = [];
        const has = (metric: string) => availableMetrics.has(metric);

        const subject = adSetLabel
            ? `ad set "${adSetLabel}"${campaignLabel ? ` (campaign "${campaignLabel}")` : ''}`
            : campaignLabel ? `campaign "${campaignLabel}"` : 'this segment';
        const shared = {
            campaignContext: campaignLabel ?? null,
            adSetContext: adSetLabel ?? null,
            channelContext: channel,
        };
        const severityForRatio = (ratio: number, breach: number, critical: number): AlertSeverity | null =>
            ratio >= critical ? 'critical' : ratio >= breach ? 'warning' : null;

        // ── Cost efficiency targets: actual must stay below the target ──
        const costChecks: Array<{
            value: number | null; actual: number; label: string; metric: string;
            kpi: string; breach: number; critical: number; action: string; requires: string;
        }> = [
            {
                value: target.targetCpa, actual: actuals.conversions > 0 ? actuals.spend / actuals.conversions : 0,
                label: 'CPA', metric: 'Cost Per Acquisition (CPA)', kpi: 'cpa',
                breach: thresholds.cpaBreach ?? 1.2, critical: thresholds.cpaCritical ?? 2, requires: 'conversions',
                action: 'Review targeting and creative for this segment, and shift budget away from the weakest ad sets.',
            },
            {
                value: target.targetCpl, actual: actuals.leads > 0 ? actuals.spend / actuals.leads : 0,
                label: 'CPL', metric: 'Cost Per Lead (CPL)', kpi: 'cpl',
                breach: thresholds.cplBreach ?? 1.2, critical: thresholds.cplCritical ?? 2, requires: 'leads',
                action: 'Inspect lead-form quality and audience targeting, and pause the placements driving expensive leads.',
            },
            {
                value: target.targetCpc, actual: actuals.clicks > 0 ? actuals.spend / actuals.clicks : 0,
                label: 'CPC', metric: 'Cost Per Click (CPC)', kpi: 'cpc',
                breach: thresholds.cpcBreach ?? 1.2, critical: thresholds.cpcCritical ?? 1.5, requires: 'clicks',
                action: 'Refresh creative and tighten targeting to improve click-through and lower the cost per click.',
            },
            {
                value: target.targetCpm, actual: actuals.impressions > 0 ? (actuals.spend / actuals.impressions) * 1000 : 0,
                label: 'CPM', metric: 'Cost Per Mille (CPM)', kpi: 'cpm',
                breach: thresholds.cpmBreach ?? 1.2, critical: thresholds.cpmCritical ?? 1.5, requires: 'impressions',
                action: 'Review audience size, placements and auction competition to bring delivery costs back in line.',
            },
            {
                value: target.targetFrequency, actual: actuals.frequency ?? 0,
                label: 'Frequency', metric: 'Ad Frequency', kpi: 'frequency',
                breach: thresholds.frequencyBreach ?? 1.2, critical: thresholds.frequencyCritical ?? 1.5, requires: 'frequency',
                action: 'Broaden the audience or refresh creative to avoid fatigue from over-frequency.',
            },
        ];

        for (const check of costChecks) {
            if (!has(check.requires)) continue;
            if (check.value == null || check.value <= 0 || check.actual <= 0) continue;
            const ratio = check.actual / check.value;
            const severity = severityForRatio(ratio, check.breach, check.critical);
            if (!severity) continue;
            alerts.push(this.createAlert({
                severity,
                type: 'performance',
                metric: check.metric,
                message: `${check.label} for ${subject} is ${this.formatValue(check.actual, check.kpi)}, ` +
                    `${((ratio - 1) * 100).toFixed(0)}% above the target of ${this.formatValue(check.value, check.kpi)}.`,
                suggestedAction: check.action,
                currentValue: check.actual,
                expectedValue: check.value,
                deviationPercent: (ratio - 1) * 100,
                date,
                unit: this.unitForKpi(check.kpi),
                ...shared,
            }));
        }

        // ── Rate targets where the actual must stay above the target ──
        const floorChecks: Array<{
            value: number | null; actual: number; label: string; metric: string;
            kpi: string; breach: number; critical: number; action: string; requires: string[];
        }> = [
            {
                value: target.targetRoas, actual: actuals.spend > 0 ? actuals.revenue / actuals.spend : 0,
                label: 'ROAS', metric: 'Return on Ad Spend (ROAS)', kpi: 'roas',
                breach: thresholds.roasBreach ?? 1.25, critical: thresholds.roasCritical ?? 2, requires: ['revenue'],
                action: 'Evaluate creative and audience relevance, and shift budget toward high-ROAS ad sets.',
            },
            {
                value: target.targetCtr, actual: actuals.impressions > 0 ? (actuals.clicks / actuals.impressions) * 100 : 0,
                label: 'CTR', metric: 'Click-Through Rate (CTR)', kpi: 'ctr',
                breach: thresholds.ctrBreach ?? 1.25, critical: thresholds.ctrCritical ?? 2, requires: ['clicks', 'impressions'],
                action: 'Test new hooks and creatives; low CTR usually signals creative fatigue or poor audience fit.',
            },
        ];

        for (const check of floorChecks) {
            if (!check.requires.every(has)) continue;
            if (check.value == null || check.value <= 0 || check.actual <= 0) continue;
            const ratio = check.value / check.actual; // > 1 means the actual is below target
            const severity = severityForRatio(ratio, check.breach, check.critical);
            if (!severity) continue;
            alerts.push(this.createAlert({
                severity,
                type: 'performance',
                metric: check.metric,
                message: `${check.label} for ${subject} is ${this.formatValue(check.actual, check.kpi)}, ` +
                    `${((1 - check.actual / check.value) * 100).toFixed(0)}% below the target of ${this.formatValue(check.value, check.kpi)}.`,
                suggestedAction: check.action,
                currentValue: check.actual,
                expectedValue: check.value,
                deviationPercent: (check.actual / check.value - 1) * 100,
                date,
                unit: this.unitForKpi(check.kpi),
                ...shared,
            }));
        }

        // ── Volume targets: attainment of the goal for the period ──
        const attainmentChecks: Array<{
            value: number | null; actual: number; label: string; kpi: string; action: string; requires: string;
        }> = [
            { value: target.targetConversions, actual: actuals.conversions, label: 'Conversions', kpi: 'conversions', requires: 'conversions', action: 'Review the conversion path, landing pages and offer fit; consider reallocating budget to converters.' },
            { value: target.targetLeads, actual: actuals.leads, label: 'Leads', kpi: 'leads', requires: 'leads', action: 'Widen prospecting audiences and test new lead magnets to recover lead volume.' },
            { value: target.targetRevenue, actual: actuals.revenue, label: 'Revenue', kpi: 'revenue', requires: 'revenue', action: 'Inspect conversion value and mix; prioritise the products and audiences driving revenue.' },
            { value: target.targetClicks, actual: actuals.clicks, label: 'Clicks', kpi: 'clicks', requires: 'clicks', action: 'Increase reach or improve creative relevance to drive more clicks.' },
            { value: target.targetImpressions, actual: actuals.impressions, label: 'Impressions', kpi: 'impressions', requires: 'impressions', action: 'Review budget and audience size to ensure the plan can deliver the expected impressions.' },
        ];

        const attainmentWarning = thresholds.attainmentWarning ?? 0.8;
        const attainmentCritical = thresholds.attainmentCritical ?? 0.5;

        for (const check of attainmentChecks) {
            if (!has(check.requires)) continue;
            if (check.value == null || check.value <= 0) continue;
            const ratio = check.actual / check.value;
            if (ratio > attainmentWarning) continue;
            const severity: AlertSeverity = ratio <= attainmentCritical ? 'critical' : 'warning';
            alerts.push(this.createAlert({
                severity,
                type: 'performance',
                metric: `${check.label} vs target`,
                message: `${check.label} for ${subject} reached ${this.formatValue(check.actual, check.kpi)} against a target of ` +
                    `${this.formatValue(check.value, check.kpi)} (${(ratio * 100).toFixed(0)}% of goal).`,
                suggestedAction: check.action,
                currentValue: check.actual,
                expectedValue: check.value,
                deviationPercent: (ratio - 1) * 100,
                date,
                unit: this.unitForKpi(check.kpi),
                ...shared,
            }));
        }

        return alerts;
    }

    /**
     * Legacy fallback used when no targets exist: flag campaign/ad set contexts
     * whose CPA is far above, or ROAS far below, the account average.
     */
    private detectContextsAgainstAverage(
        rows: any[],
        actualsFor: (row: any) => IContextActuals,
        opts: { date: string; channel: string | null; cpaMultiplier: number; roasMultiplier: number; adSetDimension: boolean },
    ): IAlert[] {
        const alerts: IAlert[] = [];

        let totalSpend = 0;
        let totalConversions = 0;
        let totalRevenue = 0;
        for (const row of rows) {
            const a = actualsFor(row);
            totalSpend += a.spend;
            totalConversions += a.conversions;
            totalRevenue += a.revenue;
        }
        const avgCpa = totalConversions > 0 ? totalSpend / totalConversions : 0;
        const avgRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;

        const labelsFor = (row: any) => {
            const campaignLabel = row.campaign_name ? String(row.campaign_name) : (row.campaign_id != null ? String(row.campaign_id) : null);
            const adSetLabel = opts.adSetDimension
                ? (row.adset_name ? String(row.adset_name) : (row.adset_id != null ? String(row.adset_id) : null))
                : null;
            const subject = adSetLabel
                ? `ad set "${adSetLabel}"${campaignLabel ? ` (campaign "${campaignLabel}")` : ''}`
                : campaignLabel ? `campaign "${campaignLabel}"` : 'this segment';
            return { campaignLabel, adSetLabel, subject };
        };

        for (const row of rows) {
            const a = actualsFor(row);
            const { campaignLabel, adSetLabel, subject } = labelsFor(row);
            const shared = { campaignContext: campaignLabel, adSetContext: adSetLabel, channelContext: opts.channel };

            if (avgCpa > 0 && a.conversions > 0) {
                const cpa = a.spend / a.conversions;
                const ratio = cpa / avgCpa;
                if (ratio >= opts.cpaMultiplier) {
                    alerts.push(this.createAlert({
                        severity: ratio >= opts.cpaMultiplier * 1.5 ? 'critical' : 'warning',
                        type: 'performance',
                        metric: 'Cost Per Acquisition (CPA)',
                        message: `CPA for ${subject} is ${this.formatValue(cpa, 'cpa')}, ${ratio.toFixed(1)}x the account average of ${this.formatValue(avgCpa, 'cpa')}.`,
                        suggestedAction: 'Review targeting and creative for this segment, and shift budget toward lower-cost ad sets.',
                        currentValue: cpa,
                        expectedValue: avgCpa,
                        deviationPercent: (ratio - 1) * 100,
                        date: opts.date,
                        unit: 'currency',
                        ...shared,
                    }));
                }
            }

            if (avgRoas > 0 && a.spend > 0) {
                const roas = a.revenue / a.spend;
                const ratio = roas / avgRoas;
                if (ratio <= opts.roasMultiplier) {
                    alerts.push(this.createAlert({
                        severity: ratio <= opts.roasMultiplier * 0.5 ? 'critical' : 'warning',
                        type: 'performance',
                        metric: 'Return on Ad Spend (ROAS)',
                        message: `ROAS for ${subject} is ${roas.toFixed(2)}x, ${ratio.toFixed(1)}x the account average of ${avgRoas.toFixed(2)}x.`,
                        suggestedAction: 'Evaluate creative and audience relevance, and pause segments below break-even.',
                        currentValue: roas,
                        expectedValue: avgRoas,
                        deviationPercent: (ratio - 1) * 100,
                        date: opts.date,
                        unit: 'ratio',
                        ...shared,
                    }));
                }
            }
        }

        return alerts;
    }

    /**
     * Resolve the target that applies to a campaign/ad set context. Ad set
     * targets take precedence over the parent campaign target.
     */
    private resolveTargetForContext(
        campaignId: string | null,
        adSetId: string | null,
        context: IAlertTargetContext,
    ): ICampaignTarget | null {
        if (adSetId) {
            const adSetTarget = context.adSetTargets.get(adSetId);
            if (adSetTarget) return adSetTarget;
        }
        if (campaignId) {
            const campaignTarget = context.campaignTargets.get(campaignId);
            if (campaignTarget) return campaignTarget;
        }
        return null;
    }

    /**
     * Resolve the expected daily budget for a context, preferring the CMO's
     * target, then the ad platform's configured budget, then the campaign target.
     */
    private resolveExpectedDailyBudget(
        campaignId: string | null,
        adSetId: string | null,
        context: IAlertTargetContext,
        periodDays: number,
        fallbackDailyBudget?: number,
    ): { value: number; source: string } | null {
        const fromTarget = (t: ICampaignTarget | undefined | null): { value: number; source: string } | null => {
            if (!t) return null;
            if (t.dailyBudget != null && t.dailyBudget > 0) return { value: t.dailyBudget, source: 'target daily budget' };
            if (t.lifetimeBudget != null && t.lifetimeBudget > 0) {
                return { value: t.lifetimeBudget / periodDays, source: 'target lifetime budget' };
            }
            return null;
        };

        if (adSetId) {
            const fromAdSetTarget = fromTarget(context.adSetTargets.get(adSetId));
            if (fromAdSetTarget) return fromAdSetTarget;

            const platform = context.platformBudgets.get(adSetId);
            if (platform?.dailyBudget != null && platform.dailyBudget > 0) {
                return { value: platform.dailyBudget, source: 'ad set daily budget' };
            }
            if (platform?.lifetimeBudget != null && platform.lifetimeBudget > 0) {
                return { value: platform.lifetimeBudget / periodDays, source: 'ad set lifetime budget' };
            }
        }

        const fromCampaignTarget = fromTarget(campaignId ? context.campaignTargets.get(campaignId) : null);
        if (fromCampaignTarget) return fromCampaignTarget;

        if (fallbackDailyBudget != null && fallbackDailyBudget > 0) {
            return { value: fallbackDailyBudget, source: 'configured daily budget' };
        }
        return null;
    }

    /**
     * A table is used for target comparison only when it aggregates at campaign
     * or ad set level. Breakdown tables (device, demographic, placement, geo,
     * ad, keyword) describe a slice of a campaign and would otherwise repeat
     * the same campaign figures.
     */
    private isCanonicalPerformanceTable(table: IDiscoveredColumns): boolean {
        return !AnomalyDetectionService.BREAKDOWN_DIMENSIONS.some(dim => table.dimensionColumns.has(dim));
    }

    /** Prefer a human-readable `<dimension>_name` column over the id column. */
    private nameColumnFor(table: IDiscoveredColumns, dimension: 'campaign' | 'ad_group'): string | null {
        const candidates = dimension === 'campaign'
            ? ['campaign_name']
            : ['adset_name', 'ad_set_name', 'adgroup_name', 'ad_group_name'];
        for (const candidate of candidates) {
            const match = table.allColumns.find(c => c.column_name.toLowerCase() === candidate);
            if (match) return match.column_name;
        }
        return null;
    }

    /** Derive a channel key (e.g. `meta_ads`) from the discovered table schema. */
    private channelFromTable(table: IDiscoveredColumns): string | null {
        const match = /^"([^"]+)"/.exec(table.fullTableName);
        const schema = match?.[1] || null;
        if (!schema) return null;
        return schema.startsWith('dra_') ? schema.slice(4) : schema;
    }

    /**
     * Resolve both projectId and the discovered tables. The identifier may be a
     * project id (preferred) or a legacy data model id.
     */
    private async resolveTables(id: number): Promise<{ tables: IDiscoveredColumns[]; projectId: number | null }> {
        const projectTables = await this.discoverColumnsByProject(id);
        if (projectTables.length > 0) return { tables: projectTables, projectId: id };

        let tables: IDiscoveredColumns[] = [];
        try {
            tables = await this.discoverColumns(id);
        } catch {
            // No data model sources/tables found — report nothing rather than
            // failing the whole request.
            return { tables: [], projectId: null };
        }

        const dataSourceId = tables.find(t => t.dataSourceId != null)?.dataSourceId ?? null;
        const projectId = dataSourceId != null ? await this.projectIdForDataSource(dataSourceId) : null;
        return { tables, projectId };
    }

    private async projectIdForDataSource(dataSourceId: number): Promise<number | null> {
        try {
            const manager = await this.getManager();
            const rows = await manager.query(
                `SELECT project_id FROM dra_data_sources WHERE id = $1 LIMIT 1`,
                [dataSourceId],
            );
            return rows?.[0]?.project_id != null ? Number(rows[0].project_id) : null;
        } catch {
            return null;
        }
    }

    /**
     * Load the CMO-defined north-star targets and the budgets configured on the
     * ad platform, so alerts can measure actuals against expectations.
     */
    private async loadTargetContext(
        projectId: number | null,
        tables: IDiscoveredColumns[],
    ): Promise<IAlertTargetContext> {
        const context: IAlertTargetContext = {
            campaignTargets: new Map(),
            adSetTargets: new Map(),
            platformBudgets: new Map(),
            hasAnyTarget: false,
            targetCount: 0,
        };

        if (projectId != null) {
            try {
                const targets = await CampaignTargetsService.getInstance().list({ projectId });
                for (const target of targets) {
                    if (target.entityLevel === 'campaign') context.campaignTargets.set(String(target.entityId), target);
                    else if (target.entityLevel === 'ad_set') context.adSetTargets.set(String(target.entityId), target);
                }
                context.hasAnyTarget = targets.length > 0;
                context.targetCount = targets.length;
            } catch (err) {
                console.warn('[AnomalyDetectionService] Failed to load campaign targets:', err);
            }
        }

        const adSetTable = tables.find(t => t.logicalTableName === 'adsets');
        if (adSetTable) {
            try {
                const manager = await this.getManager();
                const rows = await manager.query(
                    `SELECT "id" AS id, "daily_budget" AS daily_budget, "lifetime_budget" AS lifetime_budget
                     FROM ${adSetTable.fullTableName}`,
                );
                for (const row of rows || []) {
                    context.platformBudgets.set(String(row.id), {
                        dailyBudget: row.daily_budget != null ? Number(row.daily_budget) : null,
                        lifetimeBudget: row.lifetime_budget != null ? Number(row.lifetime_budget) : null,
                    });
                }
            } catch (err) {
                console.warn('[AnomalyDetectionService] Failed to load ad platform budgets:', err);
            }
        }

        return context;
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
            adSet: a.adSetContext,
            channel: a.channelContext,
        }));

        const prompt = `You are a marketing analytics AI assistant for a CMO dashboard.
Given these marketing metric alerts, enhance each alert message to be more specific, actionable, and include relevant campaign/ad set/channel context.

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

    private getDataSourceRepo() {
        return AppDataSource.getRepository(DRADataSource);
    }

    /**
     * Discover columns from a project's data sources (bypasses data model layer).
     */
    private async discoverColumnsByProject(projectId: number): Promise<IDiscoveredColumns[]> {
        const manager = await this.getManager();
        const kpiMatcher = MarketingKPIMatcher.getInstance();

        const dsRepo = this.getDataSourceRepo();
        const dataSources = await dsRepo.find({ where: { project: { id: projectId } } });
        if (!dataSources || dataSources.length === 0) return [];

        const dataSourceIds = dataSources.map(ds => ds.id);
        const tableRepo = this.getTableMetadataRepo();
        const tables = await tableRepo.find({
            where: dataSourceIds.map(id => ({ data_source_id: id })),
        });

        const uniqueTables = new Map<string, { schema: string; physical: string; logical: string; dataSourceId: number | null }>();
        for (const t of tables) {
            const key = `${t.schema_name || ''}.${t.physical_table_name}`;
            if (!uniqueTables.has(key)) {
                uniqueTables.set(key, {
                    schema: t.schema_name || 'public',
                    physical: t.physical_table_name,
                    logical: t.logical_table_name || '',
                    dataSourceId: t.data_source_id != null ? Number(t.data_source_id) : null,
                });
            }
        }
        if (uniqueTables.size === 0) return [];

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
                logicalTableName: table.logical,
                fullTableName,
                dataSourceId: table.dataSourceId,
                kpiColumns,
                dimensionColumns,
                dateColumn,
                allColumns,
            });
        }
        return results;
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

        const uniqueTables = new Map<string, { schema: string; physical: string; logical: string; dataSourceId: number | null }>();
        for (const t of tables) {
            const key = `${t.schema_name || ''}.${t.physical_table_name}`;
            if (!uniqueTables.has(key)) {
                uniqueTables.set(key, {
                    schema: t.schema_name || 'public',
                    physical: t.physical_table_name,
                    logical: t.logical_table_name || '',
                    dataSourceId: t.data_source_id != null ? Number(t.data_source_id) : null,
                });
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
                logicalTableName: table.logical,
                fullTableName,
                dataSourceId: table.dataSourceId,
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
     * Map a KPI key to the unit the client should use when rendering the
     * alert's current/expected values.
     */
    private unitForKpi(kpi: string): AlertUnit {
        if (['spend', 'revenue', 'cpc', 'cpa', 'cpm', 'cpl', 'cost'].includes(kpi)) return 'currency';
        if (kpi === 'ctr') return 'percent';
        if (kpi === 'roas' || kpi === 'frequency') return 'ratio';
        return 'count';
    }

    /**
     * Format a numeric value for display based on KPI type.
     */
    private formatValue(value: number, kpi: string): string {
        if (['spend', 'revenue', 'cpc', 'cpa', 'cpm', 'cpl'].includes(kpi)) {
            return `$${value.toFixed(2)}`;
        }
        if (kpi === 'ctr') {
            return `${value.toFixed(2)}%`;
        }
        if (kpi === 'roas' || kpi === 'frequency') {
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