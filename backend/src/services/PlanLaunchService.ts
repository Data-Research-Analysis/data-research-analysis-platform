import { getAppDataSource } from '../datasources/PostgresDS.js';
import { PaidMediaPlanService } from './PaidMediaPlanService.js';
import { PlanEventService } from './PlanEventService.js';
import { ProductAnalyticsService } from './ProductAnalyticsService.js';
import { CampaignTargetsService } from './CampaignTargetsService.js';
import { CampaignProcessor } from '../processors/CampaignProcessor.js';

const PLATFORM_TO_CHANNEL: Record<string, string> = {
    google_search: 'google_ads',
    google_display: 'google_ads',
    meta_ads: 'meta_ads',
    linkedin_ads: 'linkedin_ads',
    tiktok_ads: 'tiktok_ads',
};

const FUNNEL_TO_OBJECTIVE: Record<string, string> = {
    bofu: 'lead_generation',
    bofu_mofu: 'demand_generation',
    full_funnel: 'customer_acquisition',
};

export interface IPlanLaunchResult {
    campaigns: Array<{ campaignId: number; name: string; platform: string }>;
    targets: number;
}

export class PlanLaunchService {
    private static instance: PlanLaunchService;

    private constructor() {}

    public static getInstance(): PlanLaunchService {
        if (!PlanLaunchService.instance) {
            PlanLaunchService.instance = new PlanLaunchService();
        }
        return PlanLaunchService.instance;
    }

    public async publish(planId: number, options: { createCampaigns: boolean; userId: number }): Promise<IPlanLaunchResult> {
        const service = PaidMediaPlanService.getInstance();
        const plan = await service.get(planId);
        const dataSource = await getAppDataSource();

        await service.setStatus(planId, 'completed');

        const campaigns: IPlanLaunchResult['campaigns'] = [];
        let targets = 0;

        if (options.createCampaigns && plan.platforms.length > 0) {
            const budgetPerPlatform = plan.budgetTotal && plan.platforms.length > 0
                ? Math.round((plan.budgetTotal / plan.platforms.length) * 100) / 100
                : null;
            const processor = CampaignProcessor.getInstance();

            for (const platform of plan.platforms) {
                const channelType = PLATFORM_TO_CHANNEL[platform];
                if (!channelType) continue;

                const campaign = await processor.createCampaign(plan.projectId, options.userId, {
                    name: `${plan.name} - ${platform.replace('_', ' ')}`,
                    objective: FUNNEL_TO_OBJECTIVE[plan.funnelCoverage] ?? 'lead_generation',
                    status: 'draft',
                    budget_total: budgetPerPlatform,
                    start_date: plan.startDate ?? undefined,
                    end_date: plan.endDate ?? undefined,
                });

                if (!campaign) continue;

                await processor.addChannel(campaign.id, {
                    channel_type: channelType,
                    channel_name: plan.name,
                    is_offline: false,
                });

                await service.linkCampaign(planId, campaign.id);
                campaigns.push({ campaignId: campaign.id, name: campaign.name, platform });

                await PlanEventService.getInstance().record({
                    planId,
                    stepId: null,
                    eventType: 'plan_campaign_linked',
                    message: `Campaign created from plan: ${campaign.name}`,
                    data: { campaignId: campaign.id, platform },
                });
            }

            targets = await this.createTargets(plan, campaigns, options.userId);
        }

        await PlanEventService.getInstance().record({
            planId,
            stepId: null,
            eventType: 'plan_published',
            message: `Plan published${options.createCampaigns ? ` with ${campaigns.length} campaign(s)` : ''}`,
            data: { createCampaigns: options.createCampaigns, campaigns: campaigns.length },
        });

        await ProductAnalyticsService.getInstance().record({
            eventName: 'plan_published',
            userId: plan.createdBy,
            projectId: plan.projectId,
            organizationId: plan.organizationId,
            workspaceId: plan.workspaceId,
            planId,
            properties: { createCampaigns: options.createCampaigns, campaigns: campaigns.length, targets },
        });

        return { campaigns, targets };
    }

    private async createTargets(plan: any, campaigns: Array<{ campaignId: number; name: string; platform: string }>, userId: number): Promise<number> {
        const targetService = CampaignTargetsService.getInstance();
        let created = 0;

        for (const campaign of campaigns) {
            const channelType = PLATFORM_TO_CHANNEL[campaign.platform] ?? campaign.platform;
            const entityId = String(campaign.campaignId);
            await targetService.upsert(
                {
                    projectId: plan.projectId,
                    entityLevel: 'campaign',
                    entityId,
                    entityName: campaign.name,
                    channel: channelType,
                    targetCtr: null,
                    targetClicks: null,
                    targetImpressions: null,
                    targetRoas: null,
                    targetLeads: null,
                    targetConversions: null,
                    targetRevenue: null,
                    targetCpc: null,
                    targetCpm: null,
                    targetCpa: null,
                    targetCpl: null,
                    targetFrequency: null,
                    dailyBudget: plan.budgetTotal && campaigns.length ? Math.round((plan.budgetTotal / campaigns.length) * 100) / 100 : null,
                    lifetimeBudget: plan.budgetTotal ?? null,
                    flightStartDate: plan.startDate ?? null,
                    flightEndDate: plan.endDate ?? null,
                },
                userId
            );
            created += 1;
        }
        return created;
    }
}
