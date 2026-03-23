import { DBDriver } from '../drivers/DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { DRACampaign } from '../models/DRACampaign.js';
import { DRACampaignChannel } from '../models/DRACampaignChannel.js';
import { DRAProject } from '../models/DRAProject.js';

const VALID_OBJECTIVES = [
    'brand_awareness',
    'lead_generation',
    'demand_generation',
    'customer_acquisition',
    'retention',
    'product_launch',
    'event_promotion',
    'other',
];

const VALID_STATUSES = ['draft', 'active', 'paused', 'completed', 'archived'];

const VALID_CHANNEL_TYPES = [
    // digital
    'google_ads',
    'meta_ads',
    'linkedin_ads',
    'tiktok_ads',
    'google_analytics',
    'google_ad_manager',
    // offline
    'events',
    'print',
    'out_of_home',
    'direct_mail',
    'tv',
    'radio',
    'pr',
    'sponsorship',
    'other',
];

export interface ICreateCampaignDTO {
    name: string;
    description?: string | null;
    objective: string;
    status?: string;
    budget_total?: number | null;
    target_leads?: number | null;
    target_cpl?: number | null;
    target_roas?: number | null;
    target_impressions?: number | null;
    start_date?: string | null;
    end_date?: string | null;
}

export interface IUpdateCampaignDTO {
    name?: string;
    description?: string | null;
    objective?: string;
    budget_total?: number | null;
    target_leads?: number | null;
    target_cpl?: number | null;
    target_roas?: number | null;
    target_impressions?: number | null;
    start_date?: string | null;
    end_date?: string | null;
}

export interface IAddChannelDTO {
    channel_type: string;
    data_source_id?: number | null;
    channel_name?: string | null;
    is_offline?: boolean;
    platform_campaign_id?: string | null;
    platform_campaign_name?: string | null;
}

export interface IUpdateChannelDTO {
    data_source_id?: number | null;
    platform_campaign_id?: string | null;
    platform_campaign_name?: string | null;
}

export interface IAvailablePlatformCampaign {
    id: string;
    name: string;
    status: string;
    objective?: string;
}

export interface IAvailablePlatformCampaignsResult {
    campaigns: IAvailablePlatformCampaign[];
    channelInfo?: string;
}

export class CampaignProcessor {
    private static instance: CampaignProcessor;
    private constructor() {}

    public static getInstance(): CampaignProcessor {
        if (!CampaignProcessor.instance) {
            CampaignProcessor.instance = new CampaignProcessor();
        }
        return CampaignProcessor.instance;
    }

    private async getManager() {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) throw new Error('PostgreSQL driver not available');
        const concreteDriver = await driver.getConcreteDriver();
        if (!concreteDriver) throw new Error('Failed to get PostgreSQL connection');
        const manager = concreteDriver.manager;
        if (!manager) throw new Error('Database manager not available');
        return manager;
    }

    async listProjectCampaigns(projectId: number): Promise<DRACampaign[]> {
        const manager = await this.getManager();
        return manager.find(DRACampaign, {
            where: { project_id: projectId },
            relations: { channels: true },
            order: { created_at: 'DESC' },
        });
    }

    async getCampaignById(campaignId: number): Promise<DRACampaign | null> {
        const manager = await this.getManager();
        return manager.findOne(DRACampaign, {
            where: { id: campaignId },
            relations: { channels: true },
        });
    }

    async createCampaign(
        projectId: number,
        userId: number,
        data: ICreateCampaignDTO,
    ): Promise<DRACampaign> {
        if (!data.name?.trim()) throw new Error('Campaign name is required');
        if (!VALID_OBJECTIVES.includes(data.objective)) {
            throw new Error(`Invalid objective. Must be one of: ${VALID_OBJECTIVES.join(', ')}`);
        }
        if (data.status && !VALID_STATUSES.includes(data.status)) {
            throw new Error(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
        }

        const manager = await this.getManager();
        
        // REQUIRED: Load project to get organization_id and workspace_id (Phase 2)
        const project = await manager.findOne(DRAProject, { where: { id: projectId } });
        if (!project) {
            throw new Error('Project not found');
        }
        
        const campaign = new DRACampaign();
        campaign.project_id = projectId;
        campaign.created_by = userId;
        campaign.name = data.name.trim();
        campaign.description = data.description ?? null;
        campaign.objective = data.objective;
        campaign.status = data.status ?? 'draft';
        campaign.budget_total = data.budget_total ?? null;
        campaign.target_leads = data.target_leads ?? null;
        campaign.target_cpl = data.target_cpl ?? null;
        campaign.target_roas = data.target_roas ?? null;
        campaign.target_impressions = data.target_impressions ?? null;
        campaign.start_date = data.start_date ? new Date(data.start_date) : null;
        campaign.end_date = data.end_date ? new Date(data.end_date) : null;
        
        // REQUIRED: Inherit organization_id and workspace_id from parent project (Phase 2)
        campaign.organization_id = project.organization_id;
        campaign.workspace_id = project.workspace_id;

        return manager.save(campaign);
    }

    async updateCampaign(
        campaignId: number,
        data: IUpdateCampaignDTO,
    ): Promise<DRACampaign | null> {
        const manager = await this.getManager();
        const campaign = await manager.findOne(DRACampaign, { where: { id: campaignId } });
        if (!campaign) return null;

        if (data.name !== undefined) campaign.name = data.name.trim();
        if (data.description !== undefined) campaign.description = data.description;
        if (data.objective !== undefined) {
            if (!VALID_OBJECTIVES.includes(data.objective)) {
                throw new Error(`Invalid objective. Must be one of: ${VALID_OBJECTIVES.join(', ')}`);
            }
            campaign.objective = data.objective;
        }
        if (data.budget_total !== undefined) campaign.budget_total = data.budget_total;
        if (data.target_leads !== undefined) campaign.target_leads = data.target_leads;
        if (data.target_cpl !== undefined) campaign.target_cpl = data.target_cpl;
        if (data.target_roas !== undefined) campaign.target_roas = data.target_roas;
        if (data.target_impressions !== undefined) campaign.target_impressions = data.target_impressions;
        if (data.start_date !== undefined) campaign.start_date = data.start_date ? new Date(data.start_date) : null;
        if (data.end_date !== undefined) campaign.end_date = data.end_date ? new Date(data.end_date) : null;

        return manager.save(campaign);
    }

    async updateCampaignStatus(campaignId: number, status: string): Promise<boolean> {
        if (!VALID_STATUSES.includes(status)) {
            throw new Error(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
        }
        const manager = await this.getManager();
        const result = await manager.update(DRACampaign, { id: campaignId }, { status });
        return (result.affected ?? 0) > 0;
    }

    async deleteCampaign(campaignId: number): Promise<boolean> {
        const manager = await this.getManager();
        const result = await manager.delete(DRACampaign, { id: campaignId });
        return (result.affected ?? 0) > 0;
    }

    async addChannel(campaignId: number, channelData: IAddChannelDTO): Promise<DRACampaignChannel> {
        if (!VALID_CHANNEL_TYPES.includes(channelData.channel_type)) {
            throw new Error(`Invalid channel_type. Must be one of: ${VALID_CHANNEL_TYPES.join(', ')}`);
        }
        const manager = await this.getManager();
        const channel = new DRACampaignChannel();
        channel.campaign_id = campaignId;
        channel.channel_type = channelData.channel_type;
        channel.data_source_id = channelData.data_source_id ?? null;
        channel.channel_name = channelData.channel_name ?? null;
        channel.is_offline = channelData.is_offline ?? false;
        channel.platform_campaign_id = channelData.platform_campaign_id ?? null;
        channel.platform_campaign_name = channelData.platform_campaign_name ?? null;
        return manager.save(channel);
    }

    async updateChannel(channelId: number, data: IUpdateChannelDTO): Promise<DRACampaignChannel | null> {
        const manager = await this.getManager();
        const channel = await manager.findOne(DRACampaignChannel, { where: { id: channelId } });
        if (!channel) return null;
        if (data.data_source_id !== undefined) channel.data_source_id = data.data_source_id;
        if (data.platform_campaign_id !== undefined) channel.platform_campaign_id = data.platform_campaign_id;
        if (data.platform_campaign_name !== undefined) channel.platform_campaign_name = data.platform_campaign_name;
        return manager.save(channel);
    }

    async removeChannel(channelId: number): Promise<boolean> {
        const manager = await this.getManager();
        const result = await manager.delete(DRACampaignChannel, { id: channelId });
        return (result.affected ?? 0) > 0;
    }

    async getAvailablePlatformCampaigns(
        dataSourceId: number,
        channelType: string,
    ): Promise<IAvailablePlatformCampaignsResult> {
        if (channelType === 'tiktok_ads') {
            return { campaigns: [], channelInfo: 'not_integrated' };
        }
        if (channelType === 'google_analytics') {
            return { campaigns: [], channelInfo: 'no_campaign_entities' };
        }

        const manager = await this.getManager();

        type TableRow = { schema_name: string; physical_table_name: string };

        const getPhysicalTables = async (logicalName: string): Promise<TableRow[]> => {
            return manager.query(
                `SELECT schema_name, physical_table_name FROM dra_table_metadata
                 WHERE data_source_id = $1 AND logical_table_name = $2`,
                [dataSourceId, logicalName],
            );
        };

        const getPhysicalTablesLike = async (logicalPattern: string): Promise<TableRow[]> => {
            return manager.query(
                `SELECT schema_name, physical_table_name FROM dra_table_metadata
                 WHERE data_source_id = $1 AND logical_table_name LIKE $2`,
                [dataSourceId, logicalPattern],
            );
        };

        const campaigns: IAvailablePlatformCampaign[] = [];

        if (channelType === 'google_ads') {
            const tables = await getPhysicalTables('campaigns');
            for (const t of tables) {
                const rows = await manager.query(
                    `SELECT DISTINCT campaign_id::text AS id, campaign_name AS name, COALESCE(campaign_status, '') AS status
                     FROM "${t.schema_name}"."${t.physical_table_name}"
                     WHERE campaign_id IS NOT NULL AND campaign_name IS NOT NULL
                     ORDER BY campaign_name`,
                );
                for (const r of rows) {
                    if (!campaigns.find((c) => c.id === r.id)) {
                        campaigns.push({ id: r.id, name: r.name, status: r.status });
                    }
                }
            }
        } else if (channelType === 'meta_ads') {
            const tables = await getPhysicalTables('campaigns');
            for (const t of tables) {
                const rows = await manager.query(
                    `SELECT DISTINCT id::text AS id, name, COALESCE(status, '') AS status, COALESCE(objective, '') AS objective
                     FROM "${t.schema_name}"."${t.physical_table_name}"
                     WHERE id IS NOT NULL AND name IS NOT NULL
                     ORDER BY name`,
                );
                for (const r of rows) {
                    if (!campaigns.find((c) => c.id === r.id)) {
                        campaigns.push({ id: r.id, name: r.name, status: r.status, objective: r.objective });
                    }
                }
            }
        } else if (channelType === 'linkedin_ads') {
            const tables = await getPhysicalTables('campaigns');
            for (const t of tables) {
                const rows = await manager.query(
                    `SELECT DISTINCT id::text AS id, name, COALESCE(status, '') AS status,
                            COALESCE(objective_type, '') AS objective
                     FROM "${t.schema_name}"."${t.physical_table_name}"
                     WHERE id IS NOT NULL AND name IS NOT NULL
                     ORDER BY name`,
                );
                for (const r of rows) {
                    if (!campaigns.find((c) => c.id === r.id)) {
                        campaigns.push({ id: r.id, name: r.name, status: r.status, objective: r.objective });
                    }
                }
            }
        } else if (channelType === 'google_ad_manager') {
            const tables = await getPhysicalTablesLike('orders%');
            for (const t of tables) {
                const rows = await manager.query(
                    `SELECT DISTINCT order_id::text AS id, order_name AS name,
                            '' AS status, COALESCE(advertiser_name, '') AS objective
                     FROM "${t.schema_name}"."${t.physical_table_name}"
                     WHERE order_id IS NOT NULL AND order_name IS NOT NULL
                     ORDER BY order_name`,
                );
                for (const r of rows) {
                    if (!campaigns.find((c) => c.id === r.id)) {
                        campaigns.push({ id: r.id, name: r.name, status: r.status, objective: r.objective });
                    }
                }
            }
        } else {
            throw new Error(`getAvailablePlatformCampaigns: unsupported channelType '${channelType}'`);
        }

        return { campaigns };
    }

    async listCampaignChannels(campaignId: number): Promise<DRACampaignChannel[]> {
        const manager = await this.getManager();
        return manager.find(DRACampaignChannel, {
            where: { campaign_id: campaignId },
            order: { created_at: 'ASC' },
        });
    }
}
