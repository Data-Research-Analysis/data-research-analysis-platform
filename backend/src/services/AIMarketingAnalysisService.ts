/**
 * AI Marketing Analysis Service — MKT-006
 *
 * Builds a READY-MADE (non-chat) AI performance marketing analysis report for
 * a project's Intelligence Hub. Combines:
 *   - aggregated marketing metrics (channels, totals, weekly trend),
 *   - top campaigns and per-campaign ad set / ad group drill-downs,
 *   - user-defined campaign & ad set targets (target vs actual),
 *   - anomaly / budget / performance alerts,
 * and asks the AI engine to act as an experienced performance marketer and
 * senior data analyst to produce a CMO-ready report with spend
 * recommendations and charts.
 *
 * Results are cached in Redis (1 hour) to avoid repeated AI cost.
 * If the AI call fails, a deterministic data-driven fallback report is
 * returned so the CMO still gets a usable analysis.
 */

import { MarketingMetricsService } from './MarketingMetricsService.js';
import { IntelligenceReportProcessor, IIntelligenceHubSummary, IChannelMetrics } from '../processors/IntelligenceReportProcessor.js';
import { AnomalyDetectionService, IAlert } from './AnomalyDetectionService.js';
import { CampaignAnalysisService } from './CampaignAnalysisService.js';
import { CampaignTargetsService, ICampaignTarget } from './CampaignTargetsService.js';
import { GeminiService } from './GeminiService.js';
import { TierEnforcementService } from './TierEnforcementService.js';
import { TierLimitError } from '../types/TierLimitError.js';
import { MarketingAnalysisPromptContext, MarketingAnalysisPromptChannel, MarketingAnalysisPromptCampaign, MarketingAnalysisPromptAdSet, MarketingAnalysisPromptTarget, MarketingAnalysisPromptAlert, MarketingAnalysisPromptDemographics, MarketingAnalysisPromptDimensionRow } from '../templates/MarketingAnalysisPrompt.js';
import { getRedisClient } from '../config/redis.config.js';
import type {
    IAIMarketingAnalysisResponse,
    IAIMarketingAnalysisChart,
    IAIMarketingReport,
    IAIMarketingSection,
    IAIMarketingSpendRecommendation,
    IAIMarketingTargetRow,
    IAIMarketingSourceSummary,
    IMarketingAnalysisAIResponse,
} from '../types/IAIMarketingAnalysis.js';

const CACHE_TTL_SECONDS = 60 * 60; // 1 hour
const TOP_CAMPAIGNS_LIMIT = 10;
const DRILL_DOWN_CAMPAIGN_LIMIT = 5;
const AD_SET_CHART_LIMIT = 15;

const EMPTY_DEMOGRAPHICS: MarketingAnalysisPromptDemographics = {
    age: [],
    gender: [],
    device: [],
    platform: [],
};

/** Structural shape of the summary returned by MarketingMetricsService. */
interface IMetricSummary {
    kpis: Array<{ kpi: string; label: string; current: number | null; previous: number | null; changePercent: number | null }>;
    channelBreakdown: Array<{
        channel: string;
        spend: number;
        impressions: number;
        clicks: number;
        conversions: number;
        revenue: number;
        ctr: number;
        cpc: number;
        cpa: number;
        roas: number;
    }>;
    totalSpend: number;
    totalImpressions: number;
    totalClicks: number;
    totalConversions: number;
    totalRevenue: number;
    averageCtr: number;
    averageCpc: number;
    averageCpa: number;
    overallRoas: number;
    periodDays: number;
}

/** Structural shape of a campaign performance row. */
interface ICampaignPerformanceRow {
    campaignId: string;
    campaignName: string;
    channel: string;
    sourceTable: string;
    campaignColumn: string;
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
    ctr: number;
    cpc: number;
    cpa: number;
    roas: number;
    status: string;
}

/** Structural shape of an ad group / ad set dimension row from campaign analysis. */
interface IAdGroupDimensionRow {
    label: string;
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
    ctr: number;
    cpc: number;
    cpa: number;
    roas: number;
    performanceScore: number;
    status: 'outperforming' | 'on-track' | 'underperforming';
}

export class AIMarketingAnalysisService {
    private static instance: AIMarketingAnalysisService;
    private constructor() {}

    public static getInstance(): AIMarketingAnalysisService {
        if (!AIMarketingAnalysisService.instance) {
            AIMarketingAnalysisService.instance = new AIMarketingAnalysisService();
        }
        return AIMarketingAnalysisService.instance;
    }

    private get metrics() {
        return MarketingMetricsService.getInstance();
    }

    private get intelligence() {
        return IntelligenceReportProcessor.getInstance();
    }

    private get anomalies() {
        return AnomalyDetectionService.getInstance();
    }

    private get campaignAnalysis() {
        return CampaignAnalysisService.getInstance();
    }

    private get targets() {
        return CampaignTargetsService.getInstance();
    }

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    public async generateAnalysis(
        projectId: number,
        startDate: Date,
        endDate: Date,
        force: boolean = false,
        userId?: number,
        campaignId?: string,
        sourceTable?: string,
        campaignColumn?: string,
        channel?: string,
        adSetLabel?: string,
    ): Promise<IAIMarketingAnalysisResponse> {
        const startKey = startDate.toISOString().split('T')[0];
        const endKey = endDate.toISOString().split('T')[0];
        const scopeKey = !campaignId
            ? 'all'
            : adSetLabel
                ? `c${campaignId}:e${this.hashString(adSetLabel)}`
                : `c${campaignId}:campaign`;
        const cacheKey = `ai-marketing-analysis:v6:${projectId}:${scopeKey}:${startKey}:${endKey}`;

        if (!force) {
            const cached = await this.readCache(cacheKey);
            if (cached) {
                return { ...cached, fromCache: true };
            }
        }

        // 1. Gather all data (each source degrades gracefully on failure).
        let hubSummary: IIntelligenceHubSummary | null = null;
        let metricSummary: IMetricSummary | null = null;
        let campaigns: ICampaignPerformanceRow[] = [];
        let drillDowns: Array<{
            campaign: ICampaignPerformanceRow;
            adGroups: IAdGroupDimensionRow[];
            targets: { campaign: ICampaignTarget | null; adSets: ICampaignTarget[] };
            breakdowns: any[];
            dailyTrend: any[];
        }> = [];
        let allTargets: ICampaignTarget[] = [];
        let alerts: IAlert[] = [];

        if (campaignId) {
            // ── Campaign-scoped (used from the campaign drill-down page) ──
            const analysis = await this.safeGather<any>(() =>
                this.campaignAnalysis.getAnalysis(projectId, campaignId, startDate, endDate, {
                    isProjectId: true,
                    sourceTable: sourceTable || undefined,
                    campaignColumn: campaignColumn || undefined,
                }),
            );
            if (analysis) {
                const row = this.campaignRowFromAnalysis(analysis, campaignId, sourceTable, campaignColumn, channel);
                if (row) {
                    campaigns = [row];
                    drillDowns = [{
                        campaign: row,
                        adGroups: this.adGroupsFromAnalysis(analysis),
                        targets: {
                            campaign: analysis.targets?.campaign ?? null,
                            adSets: Array.isArray(analysis.targets?.adSets) ? analysis.targets.adSets : [],
                        },
                        breakdowns: Array.isArray(analysis.dimensionBreakdowns) ? analysis.dimensionBreakdowns : [],
                        dailyTrend: Array.isArray(analysis.dailyTrend) ? analysis.dailyTrend : [],
                    }];
                }
                hubSummary = this.campaignHubSummary(analysis, campaigns[0]?.channel);
            }
            allTargets = (await this.safeGather<ICampaignTarget[]>(() => this.targets.list({ projectId, campaignId }))) ?? [];
            const alertsResponse = await this.safeGather(() => this.anomalies.detectAlerts(projectId, startDate, endDate, {}));
            const campaignName = campaigns[0]?.campaignName ?? '';
            alerts = (alertsResponse?.alerts ?? []).filter(a =>
                a.campaignContext && (a.campaignContext === campaignId || a.campaignContext === campaignName),
            );

            if (adSetLabel) {
                const found = drillDowns[0]?.adGroups.some(
                    row => String(row.label).toLowerCase() === adSetLabel.toLowerCase(),
                );
                if (!found) {
                    throw new Error(`AD_SET_NOT_FOUND: ${adSetLabel}`);
                }
            }
        } else {
            // ── Project-wide (full Intelligence Hub) ──
            hubSummary = await this.safeGather(() => this.intelligence.getIntelligenceHubSummary(projectId, startDate, endDate));
            metricSummary = await this.safeGather<IMetricSummary>(() =>
                this.metrics.getMarketingSummary(projectId, startDate, endDate, { isProjectId: true }),
            );
            const campaignRows = await this.safeGather<{ rows: ICampaignPerformanceRow[]; total: number }>(() =>
                this.metrics.getCampaignPerformanceList(projectId, startDate, endDate, {
                    isProjectId: true,
                    sortBy: 'spend',
                    sortDir: 'desc',
                    pageSize: TOP_CAMPAIGNS_LIMIT,
                }),
            );
            const alertsResponse = await this.safeGather(() =>
                this.anomalies.detectAlerts(projectId, startDate, endDate, {}),
            );
            allTargets = (await this.safeGather<ICampaignTarget[]>(() => this.targets.list({ projectId }))) ?? [];
            campaigns = (campaignRows?.rows ?? []).filter(c => c.spend > 0).slice(0, TOP_CAMPAIGNS_LIMIT);
            alerts = alertsResponse?.alerts ?? [];
            drillDowns = await this.gatherDrillDowns(projectId, startDate, endDate, campaigns);
        }

        // 2. Assemble prompt context.
        const context = this.buildPromptContext(projectId, startDate, endDate, hubSummary, metricSummary, campaigns, drillDowns, alerts, !!campaignId, adSetLabel);

        // 4. Ask the AI engine for a ready-made report (skip if no data at all).
        const hasData = context.totalSpend > 0 || context.topCampaigns.length > 0 || context.channels.length > 0;
        let aiResponse: IMarketingAnalysisAIResponse | null = null;
        let aiStatus: IAIMarketingAnalysisResponse['aiStatus'] = 'success';
        if (hasData) {
            // Enforce the monthly AI generation quota only when the AI is actually
            // going to be called (so no-data projects never consume a generation).
            if (userId) {
                const tierService = TierEnforcementService.getInstance();
                await tierService.canUseAIGeneration(userId);
                await tierService.incrementAIGenerationCount(userId);
            }
            try {
                const gemini = new GeminiService();
                aiResponse = await gemini.generateMarketingAnalysis(context);
            } catch (err: any) {
                if (err instanceof TierLimitError) throw err;
                console.warn('[AIMarketingAnalysisService] AI generation failed, using fallback:', err.message);
                aiStatus = 'degraded';
                aiResponse = null;
            }
        } else {
            aiStatus = 'degraded';
        }

        // 5. Assemble the final response (charts + target comparison are always deterministic).
        const report = aiResponse
            ? this.mapAIReponse(aiResponse)
            : this.buildFallbackReport(context, alerts);
        const charts = this.buildCharts(hubSummary, campaigns, drillDowns, !!campaignId);
        const targetComparison = this.buildTargetComparison(campaigns, drillDowns, adSetLabel);

        const matchedAdSet = adSetLabel
            ? drillDowns[0]?.adGroups.find(row => String(row.label).toLowerCase() === adSetLabel.toLowerCase())
            : undefined;

        const sourceSummary: IAIMarketingSourceSummary = matchedAdSet
            ? {
                hasMarketingData: matchedAdSet.spend > 0 || matchedAdSet.conversions > 0,
                campaignCount: 1,
                targetCount: allTargets?.filter(t =>
                    t.entityId === matchedAdSet.label
                    || (t.entityName && t.entityName.toLowerCase() === String(matchedAdSet.label).toLowerCase()),
                ).length ?? 0,
                alertCount: alerts.length,
                totalSpend: matchedAdSet.spend,
                totalConversions: matchedAdSet.conversions,
                overallRoas: matchedAdSet.roas,
                overallCpl: matchedAdSet.conversions > 0 ? matchedAdSet.spend / matchedAdSet.conversions : null,
            }
            : {
                hasMarketingData: (hubSummary?.totals.spend ?? 0) > 0 || (metricSummary?.totalSpend ?? 0) > 0,
                campaignCount: campaigns.length,
                targetCount: allTargets?.length ?? 0,
                alertCount: alerts.length,
                totalSpend: hubSummary?.totals.spend ?? metricSummary?.totalSpend ?? 0,
                totalConversions: hubSummary?.totals.conversions ?? metricSummary?.totalConversions ?? 0,
                overallRoas: this.overallRoas(hubSummary, metricSummary),
                overallCpl: this.overallCpl(hubSummary, metricSummary),
            };

        const result: IAIMarketingAnalysisResponse = {
            aiStatus,
            fromCache: false,
            generatedAt: new Date().toISOString(),
            dateRange: { start: startKey, end: endKey },
            report,
            charts,
            targetComparison,
            sourceSummary,
            scope: campaignId
                ? {
                    type: adSetLabel ? 'ad_set' : 'campaign',
                    campaignId,
                    campaignName: campaigns[0]?.campaignName ?? null,
                    channel: campaigns[0]?.channel ?? null,
                    adSetName: adSetLabel ?? null,
                }
                : { type: 'project', campaignId: null, campaignName: null, channel: null, adSetName: null },
            adSetScopes: campaignId
                ? [...(drillDowns[0]?.adGroups ?? [])]
                    .sort((a, b) => b.spend - a.spend)
                    .map(row => ({
                        name: row.label,
                        spend: row.spend,
                        conversions: row.conversions,
                        roas: row.roas,
                        cpl: row.conversions > 0 ? row.spend / row.conversions : null,
                        status: row.status,
                    }))
                : [],
        };

        await this.writeCache(cacheKey, result);
        return result;
    }

    // -----------------------------------------------------------------------
    // Data gathering
    // -----------------------------------------------------------------------

    private async safeGather<T>(fn: () => Promise<T>): Promise<T | null> {
        try {
            return await fn();
        } catch (err: any) {
            console.warn('[AIMarketingAnalysisService] data gather failed:', err.message);
            return null;
        }
    }

    private async gatherDrillDowns(
        projectId: number,
        startDate: Date,
        endDate: Date,
        campaigns: ICampaignPerformanceRow[],
    ): Promise<Array<{
        campaign: ICampaignPerformanceRow;
        adGroups: IAdGroupDimensionRow[];
        targets: { campaign: ICampaignTarget | null; adSets: ICampaignTarget[] };
        breakdowns: any[];
        dailyTrend: any[];
    }>> {
        const results: Array<{
            campaign: ICampaignPerformanceRow;
            adGroups: IAdGroupDimensionRow[];
            targets: { campaign: ICampaignTarget | null; adSets: ICampaignTarget[] };
            breakdowns: any[];
            dailyTrend: any[];
        }> = [];

        for (const campaign of campaigns.slice(0, DRILL_DOWN_CAMPAIGN_LIMIT)) {
            const analysis = await this.safeGather<any>(() =>
                this.campaignAnalysis.getAnalysis(projectId, campaign.campaignId, startDate, endDate, {
                    isProjectId: true,
                    sourceTable: campaign.sourceTable || undefined,
                    campaignColumn: campaign.campaignColumn || undefined,
                }),
            );
            if (!analysis) continue;

            const adGroupRows: IAdGroupDimensionRow[] = (analysis.dimensionBreakdowns ?? [])
                .find((b: any) => b.dimension === 'ad_group' && b.available)
                ?.rows ?? [];

            results.push({
                campaign,
                adGroups: adGroupRows,
                targets: {
                    campaign: analysis.targets?.campaign ?? null,
                    adSets: Array.isArray(analysis.targets?.adSets) ? analysis.targets.adSets : [],
                },
                breakdowns: Array.isArray(analysis.dimensionBreakdowns) ? analysis.dimensionBreakdowns : [],
                dailyTrend: Array.isArray(analysis.dailyTrend) ? analysis.dailyTrend : [],
            });
        }

        return results;
    }

    /**
     * Extract the ad group / ad set dimension rows from a campaign analysis.
     */
    private adGroupsFromAnalysis(analysis: any): IAdGroupDimensionRow[] {
        return (analysis?.dimensionBreakdowns ?? [])
            .find((b: any) => b.dimension === 'ad_group' && b.available)
            ?.rows ?? [];
    }

    /**
     * Build a single campaign performance row from a campaign analysis
     * (used when the analysis is scoped to one campaign on the drill-down page).
     */
    private campaignRowFromAnalysis(
        analysis: any,
        campaignId: string,
        sourceTable?: string,
        campaignColumn?: string,
        channel?: string,
    ): ICampaignPerformanceRow | null {
        const trend: any[] = Array.isArray(analysis?.dailyTrend) ? analysis.dailyTrend : [];
        if (trend.length === 0) return null;
        const sum = (k: string) => trend.reduce((s, d) => s + (Number(d[k]) || 0), 0);
        const spend = sum('spend');
        const impressions = sum('impressions');
        const clicks = sum('clicks');
        const conversions = sum('conversions');
        const revenue = sum('revenue');
        return {
            campaignId,
            campaignName: analysis.campaignName || campaignId,
            channel: this.sanitizeChannel(channel, analysis.channel, sourceTable),
            sourceTable: sourceTable ?? '',
            campaignColumn: campaignColumn ?? '',
            spend,
            impressions,
            clicks,
            conversions,
            revenue,
            ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
            cpc: clicks > 0 ? spend / clicks : 0,
            cpa: conversions > 0 ? spend / conversions : 0,
            roas: spend > 0 ? revenue / spend : 0,
            status: analysis.settings?.effectiveStatus ?? 'active',
        };
    }

    /**
     * Stable short hash of a string, used to build cache keys for ad-set
     * scoped analyses without embedding the raw label.
     */
    private hashString(s: string): string {
        let h = 0;
        for (let i = 0; i < s.length; i++) {
            h = ((h << 5) - h + s.charCodeAt(i)) | 0;
        }
        return Math.abs(h).toString(36);
    }

    /**
     * Map a DRA synced source-table name to its channel (data source type).
     * Tables are named with the data source prefix, e.g. dra_meta_ads_*,
     * dra_google_ads_*, dra_linkedin_ads_*, dra_google_analytics_*,
     * dra_google_ad_manager_*, dra_hubspot_*, dra_klaviyo_*.
     */
    private inferChannelFromSourceTable(sourceTable?: string): string | null {
        if (!sourceTable) return null;
        const t = String(sourceTable).toLowerCase();
        const known = [
            'google_ads', 'meta_ads', 'linkedin_ads', 'google_analytics',
            'google_ad_manager', 'hubspot', 'klaviyo', 'tiktok_ads',
        ];
        return known.find(k => t.includes(k)) ?? null;
    }

    /**
     * Resolve the effective channel for a campaign. Prefers an explicit
     * non-unknown channel, then the analysis-derived channel, then infers
     * from the source table name, and finally falls back to 'Unknown'.
     */
    private sanitizeChannel(channel?: string, analysisChannel?: string | null, sourceTable?: string): string {
        const clean = (v?: string | null): string | null => {
            if (!v) return null;
            const s = String(v).trim();
            if (!s) return null;
            const lower = s.toLowerCase();
            if (lower === 'unknown' || lower === 'unknown channel' || lower === 'n/a' || lower === 'null') return null;
            return s;
        };
        return clean(channel) ?? clean(analysisChannel) ?? this.inferChannelFromSourceTable(sourceTable) ?? 'Unknown';
    }

    /**
     * Build a campaign-scoped hub summary from the campaign's daily trend so
     * the charts/prompt have a single-channel view for this campaign.
     */
    private campaignHubSummary(analysis: any, channelLabel?: string): IIntelligenceHubSummary | null {
        const trend: any[] = Array.isArray(analysis?.dailyTrend) ? analysis.dailyTrend : [];
        if (trend.length === 0) return null;
        const label = channelLabel || analysis.channel || 'Campaign';
        const sum = (k: string) => trend.reduce((s, d) => s + (Number(d[k]) || 0), 0);
        const spend = sum('spend');
        const impressions = sum('impressions');
        const clicks = sum('clicks');
        const conversions = sum('conversions');
        const revenue = sum('revenue');

        const weekMap = new Map<string, number>();
        for (const d of trend) {
            const date = new Date(d.date);
            if (isNaN(date.getTime())) continue;
            const day = (date.getDay() + 6) % 7; // Monday = 0
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - day);
            weekStart.setHours(0, 0, 0, 0);
            const key = weekStart.toISOString().split('T')[0];
            weekMap.set(key, (weekMap.get(key) || 0) + (Number(d.spend) || 0));
        }
        const weeklyTrend = [...weekMap.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([weekStart, weekSpend]) => ({ weekStart, byChannel: { [label]: weekSpend } as Record<string, number> }));

        const channels: IChannelMetrics[] = [{
            channelType: analysis.channel || 'campaign',
            channelLabel: label,
            spend,
            impressions,
            clicks,
            ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
            conversions,
            cpl: conversions > 0 ? spend / conversions : 0,
            roas: spend > 0 ? revenue / spend : 0,
            pipelineValue: revenue,
            dataSourceId: null,
        }];

        return {
            channels,
            priorChannels: [],
            totals: {
                spend,
                impressions,
                clicks,
                conversions,
                cpl: conversions > 0 ? spend / conversions : 0,
                pipelineValue: revenue,
            },
            priorPeriodTotals: { spend: 0, impressions: 0, clicks: 0, conversions: 0, cpl: 0, pipelineValue: 0 },
            weeklyTrend,
        };
    }

    // -----------------------------------------------------------------------
    // Prompt context
    // -----------------------------------------------------------------------

    private overallRoas(hub: IIntelligenceHubSummary | null, metric: IMetricSummary | null): number | null {
        if (metric && metric.totalSpend > 0) return metric.overallRoas;
        if (hub && hub.totals.spend > 0 && hub.totals.conversions > 0) {
            return null; // hub has no revenue; leave ROAS to the metrics service
        }
        return null;
    }

    private overallCpl(hub: IIntelligenceHubSummary | null, metric: IMetricSummary | null): number | null {
        if (hub && hub.totals.cpl) return hub.totals.cpl;
        if (metric && metric.totalConversions > 0) {
            return metric.averageCpa ?? null;
        }
        return null;
    }

    private buildPromptContext(
        projectId: number,
        startDate: Date,
        endDate: Date,
        hub: IIntelligenceHubSummary | null,
        metric: IMetricSummary | null,
        campaigns: ICampaignPerformanceRow[],
        drillDowns: Array<{
            campaign: ICampaignPerformanceRow;
            adGroups: IAdGroupDimensionRow[];
            targets: { campaign: ICampaignTarget | null; adSets: ICampaignTarget[] };
            breakdowns: any[];
        }>,
        alerts: IAlert[],
        campaignScoped: boolean,
        adSetLabel?: string,
    ): MarketingAnalysisPromptContext {
        const spendChangePercent = this.computeSpendChangePercent(hub);

        // When scoped to a single ad group / ad set, the prompt's authoritative
        // metrics come from that row; campaign-level tables become reference context.
        const adSetRow = adSetLabel
            ? drillDowns[0]?.adGroups.find(row => String(row.label).toLowerCase() === adSetLabel.toLowerCase())
            : undefined;

        const channels: MarketingAnalysisPromptChannel[] = adSetRow
            ? []
            : (hub?.channels ?? []).map(c => ({
                channel: c.channelLabel,
                spend: c.spend,
                impressions: c.impressions,
                clicks: c.clicks,
                conversions: c.conversions,
                revenue: c.roas * c.spend,
                ctr: c.clicks > 0 ? (c.clicks / Math.max(c.impressions, 1)) * 100 : 0,
                cpc: c.clicks > 0 ? c.spend / c.clicks : 0,
                cpa: c.conversions > 0 ? c.spend / c.conversions : 0,
                roas: c.roas,
                changePercent: this.channelChangePercent(hub, c.channelLabel),
            }));

        const weeklyTrend = (hub?.weeklyTrend ?? []).map(w => ({
            week: w.weekStart,
            spend: Object.values(w.byChannel).reduce((sum, v) => sum + (Number(v) || 0), 0),
        }));

        const promptCampaigns: MarketingAnalysisPromptCampaign[] = adSetRow
            ? []
            : campaigns.map(c => ({
                campaignId: c.campaignId,
                campaignName: c.campaignName,
                channel: c.channel,
                spend: c.spend,
                conversions: c.conversions,
                cpl: c.conversions > 0 ? c.spend / c.conversions : 0,
                roas: c.roas,
                status: c.status,
            }));

        const promptAdSets: MarketingAnalysisPromptAdSet[] = [];
        for (const dd of drillDowns) {
            let rows = [...dd.adGroups];
            if (adSetRow) {
                rows = rows.filter(row => String(row.label).toLowerCase() === adSetLabel!.toLowerCase());
            } else {
                rows = rows.sort((a, b) => b.spend - a.spend);
            }
            for (const row of rows.slice(0, 20)) {
                promptAdSets.push({
                    campaign: dd.campaign.campaignName,
                    name: row.label,
                    spend: row.spend,
                    impressions: row.impressions,
                    clicks: row.clicks,
                    conversions: row.conversions,
                    revenue: row.revenue,
                    ctr: row.ctr,
                    cpc: row.cpc,
                    cpa: row.cpa,
                    roas: row.roas,
                    cpl: row.conversions > 0 ? row.spend / row.conversions : 0,
                    status: row.status,
                });
            }
        }

        const promptTargets = this.buildPromptTargets(campaigns, drillDowns, adSetRow);

        const promptAlerts: MarketingAnalysisPromptAlert[] = (alerts ?? []).slice(0, 10).map(a => ({
            severity: a.severity,
            message: a.message,
            suggestedAction: a.suggestedAction,
        }));

        const demographics = campaignScoped
            ? this.buildDemographics(drillDowns[0]?.breakdowns)
            : EMPTY_DEMOGRAPHICS;

        return {
            projectId,
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            campaignName: campaignScoped && campaigns[0] ? campaigns[0].campaignName : null,
            campaignChannel: campaignScoped && campaigns[0] ? campaigns[0].channel : null,
            adSetName: adSetRow ? adSetRow.label : null,
            totalSpend: adSetRow ? adSetRow.spend : (hub?.totals.spend ?? metric?.totalSpend ?? 0),
            totalConversions: adSetRow ? adSetRow.conversions : (hub?.totals.conversions ?? metric?.totalConversions ?? 0),
            overallRoas: adSetRow ? adSetRow.roas : this.overallRoas(hub, metric),
            overallCpl: adSetRow
                ? (adSetRow.conversions > 0 ? adSetRow.spend / adSetRow.conversions : null)
                : this.overallCpl(hub, metric),
            spendChangePercent,
            channels,
            weeklyTrend,
            topCampaigns: promptCampaigns,
            adSets: promptAdSets,
            targets: promptTargets,
            alerts: promptAlerts,
            demographics,
        };
    }

    /**
     * Build age / gender / device / platform breakdown tables from the
     * campaign's dimension breakdowns (campaign-scoped analysis only).
     */
    private buildDemographics(breakdowns?: any[]): MarketingAnalysisPromptDemographics {
        const pick = (dimension: string): MarketingAnalysisPromptDimensionRow[] => {
            const b = (breakdowns ?? []).find((x: any) => x.dimension === dimension && x.available);
            const rows: any[] = Array.isArray(b?.rows) ? b.rows : [];
            return rows
                .filter((r: any) => r.spend > 0)
                .map((r: any) => ({
                    label: String(r.label ?? 'Unknown'),
                    spend: r.spend,
                    impressions: r.impressions,
                    clicks: r.clicks,
                    conversions: r.conversions,
                    revenue: r.revenue,
                    roas: r.roas,
                    cpl: r.conversions > 0 ? r.spend / r.conversions : 0,
                }));
        };

        return {
            age: pick('age'),
            gender: pick('gender'),
            device: pick('device'),
            platform: pick('platform'),
        };
    }

    private computeSpendChangePercent(hub: IIntelligenceHubSummary | null): number | null {
        if (!hub) return null;
        const current = hub.totals.spend;
        const prior = hub.priorPeriodTotals.spend;
        if (!prior) return null;
        return ((current - prior) / prior) * 100;
    }

    private channelChangePercent(hub: IIntelligenceHubSummary | null, channelLabel: string): number | null {
        if (!hub) return null;
        const prior = hub.priorChannels.find(c => c.channelLabel === channelLabel);
        const current = hub.channels.find(c => c.channelLabel === channelLabel);
        if (!prior || !current || !prior.spend) return null;
        return ((current.spend - prior.spend) / prior.spend) * 100;
    }

    private buildPromptTargets(
        campaigns: ICampaignPerformanceRow[],
        drillDowns: Array<{
            campaign: ICampaignPerformanceRow;
            adGroups: IAdGroupDimensionRow[];
            targets: { campaign: ICampaignTarget | null; adSets: ICampaignTarget[] };
        }>,
        adSetRow?: IAdGroupDimensionRow,
    ): MarketingAnalysisPromptTarget[] {
        const targets: MarketingAnalysisPromptTarget[] = [];

        // Campaign-level targets (from the global target list match on the campaigns we show).
        // Skipped when the report is scoped to a single ad group / ad set.
        if (!adSetRow) {
            const campaignById: Record<string, ICampaignPerformanceRow> = {};
            for (const c of campaigns) {
                campaignById[c.campaignId] = c;
            }
            const allCampaignTargets = drillDowns.map(d => d.targets.campaign).filter((t): t is ICampaignTarget => t != null);
            for (const t of allCampaignTargets) {
                const actual = campaignById[t.campaignId ?? t.entityId];
                targets.push({
                    entity: t.entityName ?? t.entityId,
                    level: t.entityLevel,
                    channel: t.channel,
                    targetRoas: t.targetRoas,
                    targetCpa: t.targetCpa,
                    targetCpl: t.targetCpl,
                    targetConversions: t.targetConversions,
                    actualRoas: actual ? actual.roas : null,
                    actualCpa: actual ? actual.cpa : null,
                    actualCpl: actual && actual.conversions > 0 ? actual.spend / actual.conversions : null,
                    actualConversions: actual ? actual.conversions : null,
                    spend: actual ? actual.spend : null,
                });
            }
        }

        // Ad set targets matched to ad group dimension rows.
        for (const dd of drillDowns) {
            for (const t of dd.targets.adSets) {
                const actual = dd.adGroups.find(
                    row => t.entityId === row.label
                        || (t.entityName && t.entityName.toLowerCase() === String(row.label).toLowerCase()),
                );
                if (adSetRow) {
                    const matches = actual
                        && (String(actual.label).toLowerCase() === String(adSetRow.label).toLowerCase());
                    if (!matches) continue;
                }
                targets.push({
                    entity: t.entityName ?? t.entityId,
                    level: t.entityLevel,
                    channel: t.channel,
                    targetRoas: t.targetRoas,
                    targetCpa: t.targetCpa,
                    targetCpl: t.targetCpl,
                    targetConversions: t.targetConversions,
                    actualRoas: actual ? actual.roas : null,
                    actualCpa: actual ? actual.cpa : null,
                    actualCpl: actual && actual.conversions > 0 ? actual.spend / actual.conversions : null,
                    actualConversions: actual ? actual.conversions : null,
                    spend: actual ? actual.spend : null,
                });
            }
        }

        return targets;
    }

    // -----------------------------------------------------------------------
    // Charts (deterministic, from real data)
    // -----------------------------------------------------------------------

    private buildCharts(
        hub: IIntelligenceHubSummary | null,
        campaigns: ICampaignPerformanceRow[],
        drillDowns: Array<{
            campaign: ICampaignPerformanceRow;
            adGroups: IAdGroupDimensionRow[];
            targets: { campaign: ICampaignTarget | null; adSets: ICampaignTarget[] };
            breakdowns: any[];
            dailyTrend: any[];
        }>,
        campaignScoped: boolean,
    ): IAIMarketingAnalysisResponse['charts'] {
        const channels = hub?.channels ?? [];
        const topChannels = [...channels].sort((a, b) => b.spend - a.spend).slice(0, 8);

        const channelSpend: IAIMarketingAnalysisChart = {
            chartType: 'vertical_bar',
            title: 'Channel Spend',
            data: topChannels.map(c => ({ label: c.channelLabel, value: Math.round(c.spend * 100) / 100 })),
        };

        const roasChannels = channels.filter(c => c.spend > 0).sort((a, b) => b.roas - a.roas);
        const channelRoas: IAIMarketingAnalysisChart = {
            chartType: 'vertical_bar',
            title: 'Channel ROAS',
            data: roasChannels.map(c => ({ label: c.channelLabel, value: Math.round(c.roas * 100) / 100 })),
        };

        const spendAllocation: IAIMarketingAnalysisChart = {
            chartType: 'donut',
            title: 'Spend Allocation by Channel',
            data: topChannels.map(c => ({ label: c.channelLabel, value: Math.round(c.spend * 100) / 100 })),
        };

        const weeklyTrendData = (hub?.weeklyTrend ?? []).map(w => ({
            week: w.weekStart,
            spend: Object.values(w.byChannel).reduce((sum, v) => sum + (Number(v) || 0), 0),
        }));
        const weeklyTrend: IAIMarketingAnalysisChart = {
            chartType: 'line',
            title: 'Weekly Spend Trend',
            data: {
                categories: weeklyTrendData.map(w => w.week),
                series: [{ name: 'Spend', data: weeklyTrendData.map(w => Math.round(w.spend * 100) / 100), color: '#4f46e5' }],
            },
        };

        const dailyRows: any[] = campaignScoped && Array.isArray(drillDowns[0]?.dailyTrend)
            ? drillDowns[0].dailyTrend
            : [];
        const toDateOnly = (value: any): string => {
            if (value == null) return '';
            const s = String(value);
            // Already a YYYY-MM-DD / ISO string
            const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
            // Date object / JS Date.toString() e.g. "Mon Sep 01 2026 00:00:00 GMT+0000"
            const d = new Date(value as any);
            if (!isNaN(d.getTime())) {
                const y = d.getUTCFullYear();
                const m = String(d.getUTCMonth() + 1).padStart(2, '0');
                const day = String(d.getUTCDate()).padStart(2, '0');
                return `${y}-${m}-${day}`;
            }
            // Fallback: pull a date substring if present
            const any = s.match(/\d{4}-\d{2}-\d{2}/);
            return any ? any[0] : s;
        };
        const dailySpend: IAIMarketingAnalysisChart = {
            chartType: 'line',
            title: 'Daily Spend Trend',
            data: {
                categories: dailyRows.map(d => toDateOnly(d.date)),
                series: [{
                    name: 'Spend',
                    data: dailyRows.map(d => Math.round((Number(d.spend) || 0) * 100) / 100),
                    color: '#4f46e5',
                }],
            },
        };

        const topCampaigns: IAIMarketingAnalysisChart = {
            chartType: 'horizontal_bar',
            title: 'Top Campaigns by Spend',
            data: campaigns.length > 1
                ? campaigns.slice(0, 10).map(c => ({ label: c.campaignName, value: Math.round(c.spend * 100) / 100 }))
                : [],
        };

        const adSetPoints: Array<{ x: number; y: number; r: number; label: string }> = [];
        for (const dd of drillDowns) {
            for (const row of dd.adGroups) {
                if (row.spend > 0 && row.roas >= 0) {
                    adSetPoints.push({
                        x: Math.round(row.spend * 100) / 100,
                        y: Math.round(row.roas * 100) / 100,
                        r: Math.max(row.conversions, 1),
                        label: `${dd.campaign.campaignName} — ${row.label}`,
                    });
                }
            }
        }
        adSetPoints.sort((a, b) => b.x - a.x);
        const adSetPerformance: IAIMarketingAnalysisChart = {
            chartType: 'bubble',
            title: 'Ad Set Efficiency — Spend vs ROAS (bubble size = conversions)',
            data: adSetPoints.slice(0, AD_SET_CHART_LIMIT),
        };

        // Demographics / device / placement charts (campaign-scoped only).
        const dimensionSpend = (dimension: string): Array<{ label: string; value: number }> => {
            const b = drillDowns[0]?.breakdowns?.find((x: any) => x.dimension === dimension && x.available);
            const rows: any[] = Array.isArray(b?.rows) ? b.rows : [];
            return rows
                .filter((r: any) => r.spend > 0)
                .map((r: any) => ({ label: String(r.label ?? 'Unknown'), value: Math.round(r.spend * 100) / 100 }))
                .sort((a, b) => b.value - a.value);
        };

        const spendByAge: IAIMarketingAnalysisChart = {
            chartType: 'vertical_bar',
            title: 'Spend by Age',
            data: campaignScoped ? dimensionSpend('age') : [],
        };
        const spendByGender: IAIMarketingAnalysisChart = {
            chartType: 'vertical_bar',
            title: 'Spend by Gender',
            data: campaignScoped ? dimensionSpend('gender') : [],
        };
        const spendByDevice: IAIMarketingAnalysisChart = {
            chartType: 'vertical_bar',
            title: 'Spend by Device',
            data: campaignScoped ? dimensionSpend('device') : [],
        };
        const spendByPlatform: IAIMarketingAnalysisChart = {
            chartType: 'vertical_bar',
            title: 'Spend by Platform / Placement',
            data: campaignScoped ? dimensionSpend('platform') : [],
        };

        return { channelSpend, channelRoas, spendAllocation, weeklyTrend, dailySpend, topCampaigns, adSetPerformance, spendByAge, spendByGender, spendByDevice, spendByPlatform };
    }

    // -----------------------------------------------------------------------
    // Target comparison
    // -----------------------------------------------------------------------

    private buildTargetComparison(
        campaigns: ICampaignPerformanceRow[],
        drillDowns: Array<{
            campaign: ICampaignPerformanceRow;
            adGroups: IAdGroupDimensionRow[];
            targets: { campaign: ICampaignTarget | null; adSets: ICampaignTarget[] };
        }>,
        adSetLabel?: string,
    ): IAIMarketingTargetRow[] {
        const rows: IAIMarketingTargetRow[] = [];

        const campaignById: Record<string, ICampaignPerformanceRow> = {};
        for (const c of campaigns) {
            campaignById[c.campaignId] = c;
        }

        for (const dd of drillDowns) {
            const c = dd.campaign;
            const campaignTarget = dd.targets.campaign;
            if (adSetLabel) {
                // Ad-set-scoped report: only this ad set's target row.
                const row = dd.adGroups.find(r => String(r.label).toLowerCase() === adSetLabel.toLowerCase());
                if (!row) continue;
                const adSetTarget = dd.targets.adSets.find(
                    t => t.entityId === row.label
                        || (t.entityName && t.entityName.toLowerCase() === String(row.label).toLowerCase()),
                );
                if (!adSetTarget) continue;
                rows.push(this.computeTargetRow(
                    adSetTarget.entityName ?? adSetTarget.entityId,
                    'ad_set',
                    c.channel,
                    row.spend,
                    row.conversions,
                    row.roas,
                    row.cpa,
                    adSetTarget,
                ));
                continue;
            }

            if (campaignTarget) {
                rows.push(this.computeTargetRow(
                    campaignTarget.entityName ?? campaignTarget.entityId,
                    'campaign',
                    c.channel,
                    c.spend,
                    c.conversions,
                    c.roas,
                    c.cpa,
                    campaignTarget,
                ));
            }

            for (const row of dd.adGroups) {
                const adSetTarget = dd.targets.adSets.find(
                    t => t.entityId === row.label
                        || (t.entityName && t.entityName.toLowerCase() === String(row.label).toLowerCase()),
                );
                if (!adSetTarget) continue;
                rows.push(this.computeTargetRow(
                    adSetTarget.entityName ?? adSetTarget.entityId,
                    'ad_set',
                    c.channel,
                    row.spend,
                    row.conversions,
                    row.roas,
                    row.cpa,
                    adSetTarget,
                ));
            }
        }

        return rows;
    }

    private computeTargetRow(
        entity: string,
        level: 'campaign' | 'ad_set',
        channel: string | null,
        spend: number,
        conversions: number,
        roas: number | null,
        cpa: number | null,
        target: ICampaignTarget,
    ): IAIMarketingTargetRow {
        const hasTarget = target.targetRoas != null || target.targetCpa != null
            || target.targetCpl != null || target.targetConversions != null;
        let status: IAIMarketingTargetRow['status'] = 'no-target';

        if (hasTarget) {
            if (target.targetRoas != null && roas != null) {
                status = roas >= target.targetRoas ? 'above-target'
                    : roas >= target.targetRoas * 0.8 ? 'on-target' : 'below-target';
            } else if (target.targetCpa != null && cpa != null) {
                status = cpa <= target.targetCpa ? 'above-target'
                    : cpa <= target.targetCpa * 1.2 ? 'on-target' : 'below-target';
            } else if (target.targetCpl != null && conversions > 0) {
                const actualCpl = spend / conversions;
                status = actualCpl <= target.targetCpl ? 'above-target'
                    : actualCpl <= target.targetCpl * 1.2 ? 'on-target' : 'below-target';
            } else if (target.targetConversions != null) {
                status = conversions >= target.targetConversions ? 'above-target'
                    : conversions >= target.targetConversions * 0.8 ? 'on-target' : 'below-target';
            } else {
                status = 'on-target';
            }
        }

        return {
            entity,
            level,
            channel,
            spend: Math.round(spend * 100) / 100,
            conversions,
            conversionsTarget: target.targetConversions,
            roas: roas == null ? null : Math.round(roas * 100) / 100,
            roasTarget: target.targetRoas,
            cpa: cpa == null ? null : Math.round(cpa * 100) / 100,
            cpaTarget: target.targetCpa,
            status,
        };
    }

    // -----------------------------------------------------------------------
    // AI response mapping / fallback
    // -----------------------------------------------------------------------

    private mapAIReponse(ai: IMarketingAnalysisAIResponse): IAIMarketingReport {
        return {
            title: ai.title,
            executiveSummary: ai.executive_summary,
            sections: ai.sections.map(s => ({
                heading: s.heading,
                content: s.content,
                recommendations: s.recommendations?.length ? s.recommendations : undefined,
            })),
            spendRecommendations: ai.spend_recommendations.map(r => ({
                entity: r.entity,
                entityType: r.entity_type,
                action: r.action,
                currentSpend: r.current_spend ?? null,
                suggestedAllocation: r.suggested_allocation ?? null,
                rationale: r.rationale,
            })),
            risksAndAlerts: ai.risks_and_alerts,
            nextSteps: ai.next_steps,
        };
    }

    private buildFallbackReport(
        context: MarketingAnalysisPromptContext,
        alerts: IAlert[],
    ): IAIMarketingReport {
        // ── Ad-set-scoped fallback: focus the report on that single ad group / ad set.
        if (context.adSetName) {
            const adSet = context.adSets[0];
            const campaignLabel = context.campaignName
                ? `campaign **${context.campaignName}**${context.campaignChannel ? ` (${context.campaignChannel})` : ''}`
                : 'the parent campaign';
            const spend = context.totalSpend;
            const conversions = context.totalConversions;
            const roas = context.overallRoas;
            const action: IAIMarketingSpendRecommendation['action'] =
                roas != null && roas >= 1.2 ? 'increase_budget'
                    : roas != null && roas <= 0.7 ? 'decrease_budget'
                        : 'maintain';

            const sections: IAIMarketingSection[] = [
                {
                    heading: 'Ad Group / Ad Set Performance',
                    content: adSet
                        ? `**${adSet.name}** spent $${spend.toLocaleString()} and produced ${conversions.toLocaleString()} conversions${
                            roas != null ? ` at ${roas.toFixed(1)}x ROAS` : ''
                        }${
                            context.overallCpl != null ? ` ($${context.overallCpl.toFixed(2)} per conversion)` : ''
                        } within ${campaignLabel} from ${context.startDate} to ${context.endDate}.`
                        : `No ad group / ad set metrics were available for ${context.adSetName} in this period.`,
                    recommendations: [
                        roas != null && roas >= 1.2
                            ? `This ad plan is performing well (${roas.toFixed(1)}x ROAS) — consider scaling its budget if the campaign has room.`
                            : roas != null && roas <= 0.7
                                ? `This ad plan is under-performing (${roas.toFixed(1)}x ROAS) — review audience, creative and offer before scaling.`
                                : 'Performance is in line with typical benchmarks — test incremental changes before changing budget.',
                    ],
                },
                {
                    heading: 'What to Do Next',
                    content: 'The AI narrative engine was temporarily unavailable, so this summary was generated directly from the metrics.',
                    recommendations: [
                        roas != null && roas >= 1.2
                            ? 'Scale this ad group / ad set first; compare it against the other ad sets in the campaign before allocating more.'
                            : 'Compare this ad group / ad set with the best-performing ad sets in the campaign and borrow what is working.',
                    ],
                },
            ];

            return {
                title: `Marketing Performance Analysis — ${adSet?.name ?? context.adSetName}`,
                executiveSummary: `This ready-made analysis covers the ad group / ad set **${context.adSetName}** within ${campaignLabel}: $${spend.toLocaleString()} spend, ${conversions.toLocaleString()} conversions${
                    roas != null ? `, ${roas.toFixed(1)}x ROAS` : ''
                } from ${context.startDate} to ${context.endDate}. The AI narrative engine was temporarily unavailable, so this summary was generated directly from the metrics.`,
                sections,
                spendRecommendations: [{
                    entity: context.adSetName,
                    entityType: 'ad_set',
                    action,
                    currentSpend: spend,
                    suggestedAllocation: action === 'increase_budget' ? '+20%' : action === 'decrease_budget' ? '-20%' : null,
                    rationale: roas != null && action === 'increase_budget'
                        ? `ROAS of ${roas.toFixed(1)}x is strong — this ad plan is winning its test.`
                        : roas != null && action === 'decrease_budget'
                            ? `ROAS of ${roas.toFixed(1)}x is weak — this ad plan is losing its test.`
                            : `ROAS of ${roas != null ? roas.toFixed(1) : 'n/a'}x is in line with expectations.`,
                }],
                risksAndAlerts: alerts.slice(0, 5).map(a => `[${a.severity}] ${a.message}`),
                nextSteps: [
                    'Compare this ad group / ad set against the other ad sets in the campaign to see which ad plan is winning.',
                    'Review audience, creative and offer against the best-performing ad set and iterate.',
                    'Set ad set targets on the Campaigns tab to unlock target-vs-actual analysis.',
                ],
            };
        }

        const channels = context.channels;
        const bestChannel = channels.length ? channels.reduce((a, b) => (b.roas > a.roas ? b : a)) : null;
        const worstChannel = channels.length ? channels.reduce((a, b) => (b.spend > 0 && b.roas < a.roas ? b : a)) : null;

        const sections: IAIMarketingSection[] = [];
        sections.push({
            heading: 'Channel Performance',
            content: this.describeChannels(context),
            recommendations: [
                bestChannel
                    ? `${bestChannel.channel} has the strongest ROAS (${bestChannel.roas.toFixed(1)}x) with $${bestChannel.spend.toLocaleString()} spend — consider increasing budget here.`
                    : 'No channel-level ROAS data was available for this period.',
                worstChannel && worstChannel !== bestChannel
                    ? `${worstChannel.channel} shows the weakest ROAS (${worstChannel.roas.toFixed(1)}x) — review targeting, creative, or pause and reallocate.`
                    : null,
            ].filter((r): r is string => r != null),
        });

        const aboveTarget = context.targets.filter(t => t.actualRoas != null && t.targetRoas != null && t.actualRoas >= t.targetRoas);
        const belowTarget = context.targets.filter(t => t.actualRoas != null && t.targetRoas != null && t.actualRoas < t.targetRoas * 0.8);
        sections.push({
            heading: 'Performance vs Targets',
            content: context.targets.length === 0
                ? 'No user-defined campaign or ad set targets were found for this period. Define targets on the Campaigns tab to enable target-vs-actual comparison.'
                : `Of ${context.targets.length} tracked target entities, ${aboveTarget.length} are above their ROAS target and ${belowTarget.length} are materially below it.`,
            recommendations: [
                aboveTarget.length
                    ? `Increase budget on: ${aboveTarget.map(t => t.entity).slice(0, 5).join(', ')}.`
                    : null,
                belowTarget.length
                    ? `Review or reduce spend on: ${belowTarget.map(t => t.entity).slice(0, 5).join(', ')}.`
                    : null,
            ].filter((r): r is string => r != null),
        });

        sections.push({
            heading: 'Spend Efficiency and Scaling',
            content: context.topCampaigns.length
                ? `Top campaigns drove $${context.topCampaigns.reduce((s, c) => s + c.spend, 0).toLocaleString()} in spend. Highest-efficiency campaign: ${
                    [...context.topCampaigns].sort((a, b) => b.roas - a.roas)[0]?.campaignName ?? 'n/a'
                }.`
                : 'No campaign-level spend data was available for this period.',
            recommendations: [
                context.adSets.length
                    ? `${context.adSets.length} ad sets / ad groups were analyzed — see the efficiency chart for the highest-ROAS entities to scale.`
                    : 'Add ad set / ad group breakdown data to enable entity-level funding recommendations.',
            ],
        });

        if (context.demographics.age.length || context.demographics.gender.length || context.demographics.device.length) {
            sections.push({
                heading: 'Audience & Device Insights',
                content: this.describeDemographics(context),
                recommendations: [
                    context.demographics.device.length
                        ? 'Review device efficiency before shifting budgets between mobile and desktop.'
                        : null,
                    context.demographics.age.length
                        ? 'Consider adjusting age targeting toward the age bands with the best cost efficiency.'
                        : null,
                ].filter((r): r is string => r != null),
            });
        }

        const spendRecommendations: IAIMarketingSpendRecommendation[] = [];
        const overallRoas = context.overallRoas ?? 1;
        for (const ch of channels) {
            if (ch.spend <= 0) continue;
            const action = ch.roas >= overallRoas * 1.2
                ? 'increase_budget'
                : ch.roas <= overallRoas * 0.7
                    ? 'decrease_budget'
                    : 'maintain';
            spendRecommendations.push({
                entity: ch.channel,
                entityType: 'channel',
                action,
                currentSpend: ch.spend,
                suggestedAllocation: action === 'increase_budget' ? '+20%' : action === 'decrease_budget' ? '-20%' : null,
                rationale: action === 'increase_budget'
                    ? `ROAS of ${ch.roas.toFixed(1)}x is above the blended average (${overallRoas.toFixed(1)}x).`
                    : action === 'decrease_budget'
                        ? `ROAS of ${ch.roas.toFixed(1)}x is below the blended average (${overallRoas.toFixed(1)}x).`
                        : `ROAS of ${ch.roas.toFixed(1)}x is in line with the blended average (${overallRoas.toFixed(1)}x).`,
            });
        }

        return {
            title: context.campaignName
                ? `Marketing Performance Analysis — ${context.campaignName}`
                : 'Marketing Performance Analysis — Data Summary',
            executiveSummary: `${
                context.campaignName
                    ? `This ready-made analysis covers the campaign **${context.campaignName}**${
                        context.campaignChannel ? ` (${context.campaignChannel})` : ''
                      }, including ${context.adSets.length} ad group(s)/ad set(s),`
                    : `This ready-made analysis covers`
            } ${
                context.totalSpend.toLocaleString()
            } in spend and ${
                context.totalConversions.toLocaleString()
            } conversions from ${context.startDate} to ${context.endDate}.${
                context.spendChangePercent != null
                    ? ` Spend is ${context.spendChangePercent >= 0 ? 'up' : 'down'} ${Math.abs(context.spendChangePercent).toFixed(1)}% versus the prior period.`
                    : ''
            } The AI narrative engine was temporarily unavailable, so this summary was generated directly from the metrics.`,
            sections,
            spendRecommendations,
            risksAndAlerts: alerts.slice(0, 5).map(a => `[${a.severity}] ${a.message}`),
            nextSteps: [
                'Review the highest-ROAS ad sets in the efficiency chart and increase budget there.',
                'Investigate under-performing entities flagged below target before adding budget.',
                'Set campaign and ad set targets on the Campaigns tab to unlock target-vs-actual analysis.',
                'Add more conversion/revenue data sources for richer ROAS and attribution analysis.',
            ],
        };
    }

    private describeChannels(context: MarketingAnalysisPromptContext): string {
        if (context.channels.length === 0) {
            return 'No channel data was available for this period. Connect an ad platform or marketing data source to enable channel analysis.';
        }
        const lines = context.channels
            .sort((a, b) => b.spend - a.spend)
            .slice(0, 8)
            .map(c => `- **${c.channel}**: $${c.spend.toLocaleString()} spend, ${c.conversions.toLocaleString()} conversions, ${c.roas.toFixed(1)}x ROAS.`);
        return lines.join('\n');
    }

    private describeDemographics(context: MarketingAnalysisPromptContext): string {
        const top = (rows: MarketingAnalysisPromptDimensionRow[]): string => {
            if (!rows.length) return 'no data';
            const best = rows.reduce((a, b) => (b.roas > a.roas ? b : a));
            return `${rows[0].label} ($${rows[0].spend.toLocaleString()} spend, ${rows[0].roas.toFixed(1)}x ROAS)`;
        };
        const lines: string[] = [];
        if (context.demographics.age.length) lines.push(`- **Age**: largest spend — ${top(context.demographics.age)}.`);
        if (context.demographics.gender.length) lines.push(`- **Gender**: largest spend — ${top(context.demographics.gender)}.`);
        if (context.demographics.device.length) lines.push(`- **Device**: largest spend — ${top(context.demographics.device)}.`);
        if (context.demographics.platform.length) lines.push(`- **Platform**: largest spend — ${top(context.demographics.platform)}.`);
        return lines.length ? lines.join('\n') : 'No demographic or device breakdowns are available for this campaign.';
    }

    // -----------------------------------------------------------------------
    // Redis cache
    // -----------------------------------------------------------------------

    private async readCache(key: string): Promise<IAIMarketingAnalysisResponse | null> {
        try {
            const client = getRedisClient();
            const raw = await client.get(key);
            if (!raw) return null;
            return JSON.parse(raw) as IAIMarketingAnalysisResponse;
        } catch (err: any) {
            console.warn('[AIMarketingAnalysisService] cache read failed:', err.message);
            return null;
        }
    }

    private async writeCache(key: string, value: IAIMarketingAnalysisResponse): Promise<void> {
        try {
            const client = getRedisClient();
            await client.set(key, JSON.stringify(value), 'EX', CACHE_TTL_SECONDS);
        } catch (err: any) {
            console.warn('[AIMarketingAnalysisService] cache write failed:', err.message);
        }
    }
}
