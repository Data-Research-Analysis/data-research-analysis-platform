import { DBDriver } from '../drivers/DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { DRACampaignOfflineData } from '../models/DRACampaignOfflineData.js';
import { DRACampaignChannel } from '../models/DRACampaignChannel.js';

export interface IOfflineDataEntryDTO {
    entry_date: string;
    actual_spend: number;
    impressions_estimated?: number | null;
    leads_generated?: number | null;
    pipeline_value?: number | null;
    notes?: string | null;
}

export interface IOfflineChannelSummary {
    channel_id: number;
    channel_type: string;
    channel_name: string | null;
    total_spend: number;
    total_leads: number;
    total_impressions: number;
    total_pipeline_value: number;
    cpl: number | null;
}

export interface IOfflineCampaignSummary {
    total_spend: number;
    total_leads: number;
    total_impressions: number;
    total_pipeline_value: number;
    offline_cpl: number | null;
    by_channel: IOfflineChannelSummary[];
}

export class OfflineTrackingProcessor {
    private static instance: OfflineTrackingProcessor;
    private constructor() {}

    public static getInstance(): OfflineTrackingProcessor {
        if (!OfflineTrackingProcessor.instance) {
            OfflineTrackingProcessor.instance = new OfflineTrackingProcessor();
        }
        return OfflineTrackingProcessor.instance;
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

    // -----------------------------------------------------------------------
    // CRUD
    // -----------------------------------------------------------------------

    async addEntry(
        channelId: number,
        data: IOfflineDataEntryDTO,
    ): Promise<DRACampaignOfflineData> {
        if (data.actual_spend < 0) throw new Error('actual_spend must be non-negative');
        if (data.impressions_estimated !== undefined && data.impressions_estimated !== null && data.impressions_estimated < 0) {
            throw new Error('impressions_estimated must be non-negative');
        }
        if (data.leads_generated !== undefined && data.leads_generated !== null && data.leads_generated < 0) {
            throw new Error('leads_generated must be non-negative');
        }

        const manager = await this.getManager();

        // Check channel exists
        const channel = await manager.findOne(DRACampaignChannel, { where: { id: channelId } });
        if (!channel) throw new Error('Channel not found');

        const entry = new DRACampaignOfflineData();
        entry.campaign_channel_id = channelId;
        entry.entry_date = data.entry_date;
        entry.actual_spend = data.actual_spend;
        entry.impressions_estimated = data.impressions_estimated ?? null;
        entry.leads_generated = data.leads_generated ?? null;
        entry.pipeline_value = data.pipeline_value ?? null;
        entry.notes = data.notes ?? null;

        return manager.save(entry);
    }

    async updateEntry(
        entryId: number,
        data: Partial<IOfflineDataEntryDTO>,
    ): Promise<DRACampaignOfflineData | null> {
        if (data.actual_spend !== undefined && data.actual_spend < 0) {
            throw new Error('actual_spend must be non-negative');
        }
        if (data.impressions_estimated !== undefined && data.impressions_estimated !== null && data.impressions_estimated < 0) {
            throw new Error('impressions_estimated must be non-negative');
        }
        if (data.leads_generated !== undefined && data.leads_generated !== null && data.leads_generated < 0) {
            throw new Error('leads_generated must be non-negative');
        }

        const manager = await this.getManager();
        const entry = await manager.findOne(DRACampaignOfflineData, { where: { id: entryId } });
        if (!entry) return null;

        if (data.entry_date !== undefined) entry.entry_date = data.entry_date;
        if (data.actual_spend !== undefined) entry.actual_spend = data.actual_spend;
        if (data.impressions_estimated !== undefined) entry.impressions_estimated = data.impressions_estimated ?? null;
        if (data.leads_generated !== undefined) entry.leads_generated = data.leads_generated ?? null;
        if (data.pipeline_value !== undefined) entry.pipeline_value = data.pipeline_value ?? null;
        if (data.notes !== undefined) entry.notes = data.notes ?? null;

        return manager.save(entry);
    }

    async deleteEntry(entryId: number): Promise<boolean> {
        const manager = await this.getManager();
        const result = await manager.delete(DRACampaignOfflineData, { id: entryId });
        return (result.affected ?? 0) > 0;
    }

    async getEntriesForChannel(channelId: number): Promise<DRACampaignOfflineData[]> {
        const manager = await this.getManager();
        return manager.find(DRACampaignOfflineData, {
            where: { campaign_channel_id: channelId },
            order: { entry_date: 'ASC' },
        });
    }

    // -----------------------------------------------------------------------
    // Aggregation
    // -----------------------------------------------------------------------

    async getOfflineSummaryForCampaign(campaignId: number): Promise<IOfflineCampaignSummary> {
        const manager = await this.getManager();

        // Load all offline channels for this campaign
        const channels = await manager.find(DRACampaignChannel, {
            where: { campaign_id: campaignId, is_offline: true },
        });

        if (channels.length === 0) {
            return {
                total_spend: 0,
                total_leads: 0,
                total_impressions: 0,
                total_pipeline_value: 0,
                offline_cpl: null,
                by_channel: [],
            };
        }

        const channelIds = channels.map((c) => c.id);
        const entries = await manager
            .createQueryBuilder(DRACampaignOfflineData, 'od')
            .where('od.campaign_channel_id IN (:...channelIds)', { channelIds })
            .getMany();

        const byChannel: IOfflineChannelSummary[] = channels.map((ch) => {
            const channelEntries = entries.filter((e) => e.campaign_channel_id === ch.id);
            const total_spend = channelEntries.reduce((s, e) => s + Number(e.actual_spend), 0);
            const total_leads = channelEntries.reduce((s, e) => s + (Number(e.leads_generated) || 0), 0);
            const total_impressions = channelEntries.reduce((s, e) => s + (Number(e.impressions_estimated) || 0), 0);
            const total_pipeline_value = channelEntries.reduce((s, e) => s + (Number(e.pipeline_value) || 0), 0);
            return {
                channel_id: ch.id,
                channel_type: ch.channel_type,
                channel_name: ch.channel_name,
                total_spend,
                total_leads,
                total_impressions,
                total_pipeline_value,
                cpl: total_leads > 0 ? total_spend / total_leads : null,
            };
        });

        const total_spend = byChannel.reduce((s, c) => s + c.total_spend, 0);
        const total_leads = byChannel.reduce((s, c) => s + c.total_leads, 0);
        const total_impressions = byChannel.reduce((s, c) => s + c.total_impressions, 0);
        const total_pipeline_value = byChannel.reduce((s, c) => s + c.total_pipeline_value, 0);

        return {
            total_spend,
            total_leads,
            total_impressions,
            total_pipeline_value,
            offline_cpl: total_leads > 0 ? total_spend / total_leads : null,
            by_channel: byChannel,
        };
    }

    async getOfflineSpendByDate(
        campaignId: number,
    ): Promise<Array<{ date: string; spend: number }>> {
        const manager = await this.getManager();

        const channels = await manager.find(DRACampaignChannel, {
            where: { campaign_id: campaignId, is_offline: true },
        });
        if (channels.length === 0) return [];

        const channelIds = channels.map((c) => c.id);
        const rows = await manager
            .createQueryBuilder(DRACampaignOfflineData, 'od')
            .select('od.entry_date', 'date')
            .addSelect('SUM(od.actual_spend)', 'spend')
            .where('od.campaign_channel_id IN (:...channelIds)', { channelIds })
            .groupBy('od.entry_date')
            .orderBy('od.entry_date', 'ASC')
            .getRawMany();

        return rows.map((r) => ({ date: r.date, spend: Number(r.spend) }));
    }
}
