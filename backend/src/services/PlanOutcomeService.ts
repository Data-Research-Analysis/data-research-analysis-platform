import { getAppDataSource } from '../datasources/PostgresDS.js';
import { IntelligenceReportProcessor } from '../processors/IntelligenceReportProcessor.js';
import { PlanEventService } from './PlanEventService.js';
import { ProductAnalyticsService } from './ProductAnalyticsService.js';
import { DRACampaign } from '../models/DRACampaign.js';
import { DRAPlanOutcome } from '../models/DRAPlanOutcome.js';
import { PlanOutcomeSource, IPlanOutcome } from '../types/IPaidMediaPlan.js';

export interface ISyncOutcomeOptions {
    startDate?: string | null;
    endDate?: string | null;
}

function toDTO(row: DRAPlanOutcome): IPlanOutcome {
    return {
        id: row.id,
        planId: row.plan_id,
        campaignId: row.campaign_id,
        channelType: row.channel_type,
        market: row.market,
        periodStart: row.period_start ? row.period_start.toISOString().slice(0, 10) : null,
        periodEnd: row.period_end ? row.period_end.toISOString().slice(0, 10) : null,
        spend: Number(row.spend),
        impressions: Number(row.impressions),
        clicks: row.clicks,
        conversions: row.conversions,
        revenue: Number(row.revenue),
        source: row.source,
        raw: row.raw,
        createdAt: row.created_at.toISOString(),
    };
}

export class PlanOutcomeService {
    private static instance: PlanOutcomeService;

    private constructor() {}

    public static getInstance(): PlanOutcomeService {
        if (!PlanOutcomeService.instance) {
            PlanOutcomeService.instance = new PlanOutcomeService();
        }
        return PlanOutcomeService.instance;
    }

    public async sync(planId: number, options: ISyncOutcomeOptions = {}): Promise<IPlanOutcome[]> {
        const dataSource = await getAppDataSource();
        const outcomeRepository = dataSource.getRepository(DRAPlanOutcome);

        const campaigns = await dataSource.getRepository(DRACampaign).find({ where: { plan_id: planId } });
        if (campaigns.length === 0) {
            throw new Error('No campaigns are linked to this plan. Publish the plan with campaign creation first.');
        }

        const endDate = options.endDate ? new Date(options.endDate) : new Date();
        let startDate: Date;
        if (options.startDate) {
            startDate = new Date(options.startDate);
        } else {
            startDate = new Date();
            startDate.setMonth(startDate.getMonth() - 1);
        }

        const created: IPlanOutcome[] = [];
        const intelligence = IntelligenceReportProcessor.getInstance();

        for (const campaign of campaigns) {
            const digital = await intelligence.getDigitalChannelMetrics(campaign.id, startDate, endDate);

            for (const metrics of digital) {
                const row = outcomeRepository.create({
                    plan_id: planId,
                    campaign_id: campaign.id,
                    channel_type: metrics.channelType,
                    market: null,
                    period_start: startDate,
                    period_end: endDate,
                    spend: Math.round(metrics.spend * 100) / 100,
                    impressions: metrics.impressions,
                    clicks: metrics.clicks,
                    conversions: metrics.conversions,
                    revenue: 0,
                    source: 'platform_sync',
                    raw: metrics as unknown as Record<string, any>,
                });
                await outcomeRepository.save(row);
                created.push(toDTO(row));
            }

            const offline = await this.fetchOfflineMetrics(campaign.id, startDate, endDate);
            for (const metrics of offline) {
                const row = outcomeRepository.create({
                    plan_id: planId,
                    campaign_id: campaign.id,
                    channel_type: metrics.channelType,
                    market: null,
                    period_start: startDate,
                    period_end: endDate,
                    spend: metrics.spend,
                    impressions: metrics.impressions,
                    clicks: metrics.clicks,
                    conversions: metrics.conversions,
                    revenue: metrics.revenue,
                    source: 'offline',
                    raw: metrics as unknown as Record<string, any>,
                });
                await outcomeRepository.save(row);
                created.push(toDTO(row));
            }
        }

        await PlanEventService.getInstance().record({
            planId,
            stepId: null,
            eventType: 'plan_results_synced',
            message: `Results synced for ${created.length} outcome row(s)`,
            data: { count: created.length, startDate: startDate.toISOString().slice(0, 10), endDate: endDate.toISOString().slice(0, 10) },
        });

        const plan = await (await import('./PaidMediaPlanService.js')).PaidMediaPlanService.getInstance().get(planId);
        await ProductAnalyticsService.getInstance().record({
            eventName: 'plan_results_synced',
            userId: plan.createdBy,
            projectId: plan.projectId,
            organizationId: plan.organizationId,
            workspaceId: plan.workspaceId,
            planId,
            properties: { count: created.length },
        });

        return created;
    }

    private async fetchOfflineMetrics(
        campaignId: number,
        startDate: Date,
        endDate: Date
    ): Promise<Array<{ channelType: string; spend: number; impressions: number; clicks: number; conversions: number; revenue: number }>> {
        const dataSource = await getAppDataSource();
        const start = startDate.toISOString().split('T')[0];
        const end = endDate.toISOString().split('T')[0];

        const rows = await dataSource.manager.query(
            `SELECT cc.channel_type, cc.channel_name,
                    COALESCE(SUM(od.actual_spend), 0) AS spend,
                    COALESCE(SUM(od.impressions_estimated), 0) AS impressions,
                    COALESCE(SUM(od.leads_generated), 0) AS conversions,
                    COALESCE(SUM(od.pipeline_value), 0) AS revenue
             FROM dra_campaign_channels cc
             LEFT JOIN dra_campaign_offline_data od
                    ON od.campaign_channel_id = cc.id
                   AND od.entry_date BETWEEN $1 AND $2
             WHERE cc.campaign_id = $3 AND cc.is_offline = true
             GROUP BY cc.id, cc.channel_type, cc.channel_name`,
            [start, end, campaignId]
        );

        return rows.map((row: any) => ({
            channelType: `offline_${row.channel_type}`,
            spend: Number(row.spend) || 0,
            impressions: Number(row.impressions) || 0,
            clicks: 0,
            conversions: Number(row.conversions) || 0,
            revenue: Number(row.revenue) || 0,
        }));
    }
}
