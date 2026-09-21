/**
 * Campaign Targets Service
 *
 * Stores and retrieves the user-authored north-star metrics and targets that a
 * CMO/manager defines per channel campaign and per ad set / ad group. These are
 * planning inputs (not synced from the ad platforms) used to track actual
 * performance against expectations.
 *
 * Scope key: project + data source + entity level (+ parent campaign for ad
 * sets), so identical campaign ids from different ad accounts never collide.
 */

import { getAppDataSource } from '../datasources/PostgresDS.js';

export type CampaignTargetEntityLevel = 'campaign' | 'ad_set';

export interface ICampaignTarget {
    id: number;
    projectId: number;
    dataSourceId: number | null;
    channel: string | null;
    entityLevel: CampaignTargetEntityLevel;
    campaignId: string | null;
    entityId: string;
    entityName: string | null;
    buyingModel: string | null;
    audienceSize: number | null;
    targetCtr: number | null;
    targetClicks: number | null;
    targetImpressions: number | null;
    targetRoas: number | null;
    targetLeads: number | null;
    targetConversions: number | null;
    targetRevenue: number | null;
    targetCpc: number | null;
    targetCpm: number | null;
    targetCpa: number | null;
    targetCpl: number | null;
    targetFrequency: number | null;
    initialInvestment: number | null;
    dailyBudget: number | null;
    lifetimeBudget: number | null;
    currency: string | null;
    flightStartDate: string | null;
    flightEndDate: string | null;
    notes: string | null;
    createdBy: number | null;
    updatedBy: number | null;
    createdAt: string;
    updatedAt: string;
}

export interface IUpsertCampaignTargetInput {
    projectId: number;
    dataSourceId?: number | null;
    channel?: string | null;
    entityLevel: CampaignTargetEntityLevel;
    campaignId?: string | null;
    entityId: string;
    entityName?: string | null;
    buyingModel?: string | null;
    audienceSize?: number | null;
    targetCtr?: number | null;
    targetClicks?: number | null;
    targetImpressions?: number | null;
    targetRoas?: number | null;
    targetLeads?: number | null;
    targetConversions?: number | null;
    targetRevenue?: number | null;
    targetCpc?: number | null;
    targetCpm?: number | null;
    targetCpa?: number | null;
    targetCpl?: number | null;
    targetFrequency?: number | null;
    initialInvestment?: number | null;
    dailyBudget?: number | null;
    lifetimeBudget?: number | null;
    currency?: string | null;
    flightStartDate?: string | null;
    flightEndDate?: string | null;
    notes?: string | null;
}

export interface IListCampaignTargetsParams {
    projectId: number;
    dataSourceId?: number | null;
    channel?: string | null;
    campaignId?: string | null;
    entityLevel?: CampaignTargetEntityLevel | null;
}

/** A target entity to copy the source entity's settings onto. */
export interface ICopyTargetRecipient {
    entityId: string;
    entityName?: string | null;
}

export interface ICopyCampaignTargetsInput {
    projectId: number;
    dataSourceId?: number | null;
    channel?: string | null;
    campaignId?: string | null;
    entityLevel: 'ad_set';
    sourceEntityId: string;
    targets: ICopyTargetRecipient[];
    userId?: number | null;
}

const NUMERIC_FIELDS = [
    'audienceSize', 'targetCtr', 'targetClicks', 'targetImpressions', 'targetRoas',
    'targetLeads', 'targetConversions', 'targetRevenue', 'targetCpc', 'targetCpm',
    'targetCpa', 'targetCpl', 'targetFrequency', 'initialInvestment',
    'dailyBudget', 'lifetimeBudget',
] as const;

const COLUMN_MAP: Record<string, string> = {
    projectId: 'project_id',
    dataSourceId: 'data_source_id',
    channel: 'channel',
    entityLevel: 'entity_level',
    campaignId: 'campaign_id',
    entityId: 'entity_id',
    entityName: 'entity_name',
    buyingModel: 'buying_model',
    audienceSize: 'audience_size',
    targetCtr: 'target_ctr',
    targetClicks: 'target_clicks',
    targetImpressions: 'target_impressions',
    targetRoas: 'target_roas',
    targetLeads: 'target_leads',
    targetConversions: 'target_conversions',
    targetRevenue: 'target_revenue',
    targetCpc: 'target_cpc',
    targetCpm: 'target_cpm',
    targetCpa: 'target_cpa',
    targetCpl: 'target_cpl',
    targetFrequency: 'target_frequency',
    initialInvestment: 'initial_investment',
    dailyBudget: 'daily_budget',
    lifetimeBudget: 'lifetime_budget',
    currency: 'currency',
    flightStartDate: 'flight_start_date',
    flightEndDate: 'flight_end_date',
    notes: 'notes',
};

/** Fields a caller may set/overwrite on upsert (excludes scope + audit columns). */
const MUTABLE_FIELDS = [
    'entityName', 'buyingModel', 'audienceSize', 'targetCtr', 'targetClicks',
    'targetImpressions', 'targetRoas', 'targetLeads', 'targetConversions',
    'targetRevenue', 'targetCpc', 'targetCpm', 'targetCpa', 'targetCpl',
    'targetFrequency', 'initialInvestment', 'dailyBudget', 'lifetimeBudget',
    'currency', 'flightStartDate', 'flightEndDate', 'notes',
] as const;

export class CampaignTargetsService {
    private static instance: CampaignTargetsService;

    private constructor() {}

    public static getInstance(): CampaignTargetsService {
        if (!CampaignTargetsService.instance) {
            CampaignTargetsService.instance = new CampaignTargetsService();
        }
        return CampaignTargetsService.instance;
    }

    private async manager() {
        const ds = await getAppDataSource();
        return ds.manager;
    }

    /**
     * List targets for a project, optionally narrowed to one data source,
     * campaign and/or entity level.
     */
    public async list(params: IListCampaignTargetsParams): Promise<ICampaignTarget[]> {
        const manager = await this.manager();
        const clauses: string[] = ['project_id = $1'];
        const values: any[] = [params.projectId];

        if (params.dataSourceId != null) {
            values.push(params.dataSourceId);
            clauses.push(`data_source_id = $${values.length}`);
        }
        if (params.channel) {
            values.push(params.channel);
            clauses.push(`channel = $${values.length}`);
        }
        if (params.campaignId) {
            values.push(params.campaignId);
            clauses.push(`campaign_id = $${values.length}`);
        }
        if (params.entityLevel) {
            values.push(params.entityLevel);
            clauses.push(`entity_level = $${values.length}`);
        }

        const rows = await manager.query(
            `SELECT * FROM dra_campaign_targets WHERE ${clauses.join(' AND ')} ORDER BY entity_level ASC, entity_name ASC, id ASC`,
            values,
        );
        return (rows || []).map((r: any) => this.mapRow(r));
    }

    /**
     * Fetch the campaign-level target plus all ad-set targets for one campaign.
     */
    public async getForCampaign(
        projectId: number,
        dataSourceId: number | null,
        campaignId: string,
    ): Promise<{ campaign: ICampaignTarget | null; adSets: ICampaignTarget[] }> {
        const all = await this.list({ projectId, dataSourceId });
        const campaign = all.find(t => t.entityLevel === 'campaign' && t.entityId === campaignId) || null;
        const adSets = all.filter(t => t.entityLevel === 'ad_set' && t.campaignId === campaignId);
        return { campaign, adSets };
    }

    /**
     * Create or update the single target row for a scoped entity.
     */
    public async upsert(
        input: IUpsertCampaignTargetInput,
        userId?: number | null,
    ): Promise<ICampaignTarget> {
        const manager = await this.manager();

        const scopedColumns = ['project_id', 'data_source_id', 'entity_level', 'campaign_id', 'entity_id'];
        const insertColumns: string[] = [...scopedColumns];
        const insertValues: any[] = [
            input.projectId,
            input.dataSourceId ?? null,
            input.entityLevel,
            input.campaignId ?? (input.entityLevel === 'campaign' ? input.entityId : null),
            input.entityId,
        ];

        for (const field of MUTABLE_FIELDS) {
            const col = COLUMN_MAP[field];
            insertColumns.push(col);
            insertValues.push(this.normalizeValue(field, (input as any)[field]));
        }

        insertColumns.push('created_by', 'updated_by');
        insertValues.push(userId ?? null, userId ?? null);

        const placeholders = insertValues.map((_, i) => `$${i + 1}`);

        // Upsert on the COALESCE-based unique index. Named constraint/index is
        // not directly addressable by ON CONFLICT, so use the index inference
        // clause matching the unique index definition.
        const conflictTarget = `(project_id, (COALESCE(data_source_id, 0)), entity_level, (COALESCE(campaign_id, '')), entity_id)`;

        const setParts = [
            ...MUTABLE_FIELDS.map(f => `${COLUMN_MAP[f]} = EXCLUDED.${COLUMN_MAP[f]}`),
            'channel = EXCLUDED.channel',
            'updated_by = EXCLUDED.updated_by',
            'updated_at = now()',
        ];

        const rows = await manager.query(
            `INSERT INTO dra_campaign_targets (channel, ${insertColumns.join(', ')})
             VALUES ($1, ${placeholders.map((_, i) => `$${i + 2}`).join(', ')})
             ON CONFLICT ${conflictTarget} DO UPDATE SET ${setParts.join(', ')}
             RETURNING *`,
            [input.channel ?? null, ...insertValues],
        );

        return this.mapRow(rows[0]);
    }

    /** Delete a target row, scoped to the owning project. */
    public async remove(id: number, projectId: number): Promise<boolean> {
        const manager = await this.manager();
        const rows = await manager.query(
            `DELETE FROM dra_campaign_targets WHERE id = $1 AND project_id = $2 RETURNING id`,
            [id, projectId],
        );
        return (rows || []).length > 0;
    }

    /**
     * Copy one entity's target settings onto a list of recipient entities within
     * the same scope (project + data source + campaign). Each recipient gets its
     * own row via upsert, so existing targets are overwritten.
     */
    public async copyTo(input: ICopyCampaignTargetsInput): Promise<ICampaignTarget[]> {
        const scope = await this.list({
            projectId: input.projectId,
            dataSourceId: input.dataSourceId,
            channel: input.channel,
            campaignId: input.campaignId,
            entityLevel: input.entityLevel,
        });
        const source = scope.find(t => t.entityId === input.sourceEntityId);
        if (!source) {
            throw new Error('Source ad set / ad group targets not found');
        }

        const results: ICampaignTarget[] = [];
        for (const recipient of input.targets || []) {
            if (String(recipient.entityId) === String(input.sourceEntityId)) continue;
            const row = await this.upsert(
                {
                    projectId: input.projectId,
                    dataSourceId: input.dataSourceId,
                    channel: input.channel,
                    entityLevel: input.entityLevel,
                    campaignId: input.campaignId,
                    entityId: String(recipient.entityId),
                    entityName: recipient.entityName ?? null,
                    buyingModel: source.buyingModel,
                    audienceSize: source.audienceSize,
                    targetCtr: source.targetCtr,
                    targetClicks: source.targetClicks,
                    targetImpressions: source.targetImpressions,
                    targetRoas: source.targetRoas,
                    targetLeads: source.targetLeads,
                    targetConversions: source.targetConversions,
                    targetRevenue: source.targetRevenue,
                    targetCpc: source.targetCpc,
                    targetCpm: source.targetCpm,
                    targetCpa: source.targetCpa,
                    targetCpl: source.targetCpl,
                    targetFrequency: source.targetFrequency,
                    initialInvestment: source.initialInvestment,
                    dailyBudget: source.dailyBudget,
                    lifetimeBudget: source.lifetimeBudget,
                    currency: source.currency,
                    flightStartDate: source.flightStartDate,
                    flightEndDate: source.flightEndDate,
                    notes: source.notes,
                },
                input.userId,
            );
            results.push(row);
        }
        return results;
    }

    private normalizeValue(field: string, value: any): any {
        if (value === undefined) return null;
        if (value === null) return null;
        if ((NUMERIC_FIELDS as readonly string[]).includes(field)) {
            const n = Number(value);
            return Number.isFinite(n) ? n : null;
        }
        if (field === 'flightStartDate' || field === 'flightEndDate') {
            return value === '' ? null : value;
        }
        if (field === 'entityName' || field === 'buyingModel' || field === 'currency' || field === 'notes') {
            return value === '' ? null : value;
        }
        return value;
    }

    private mapRow(r: any): ICampaignTarget {
        return {
            id: Number(r.id),
            projectId: Number(r.project_id),
            dataSourceId: r.data_source_id != null ? Number(r.data_source_id) : null,
            channel: r.channel ?? null,
            entityLevel: r.entity_level as CampaignTargetEntityLevel,
            campaignId: r.campaign_id ?? null,
            entityId: String(r.entity_id),
            entityName: r.entity_name ?? null,
            buyingModel: r.buying_model ?? null,
            audienceSize: this.toNumber(r.audience_size),
            targetCtr: this.toNumber(r.target_ctr),
            targetClicks: this.toNumber(r.target_clicks),
            targetImpressions: this.toNumber(r.target_impressions),
            targetRoas: this.toNumber(r.target_roas),
            targetLeads: this.toNumber(r.target_leads),
            targetConversions: this.toNumber(r.target_conversions),
            targetRevenue: this.toNumber(r.target_revenue),
            targetCpc: this.toNumber(r.target_cpc),
            targetCpm: this.toNumber(r.target_cpm),
            targetCpa: this.toNumber(r.target_cpa),
            targetCpl: this.toNumber(r.target_cpl),
            targetFrequency: this.toNumber(r.target_frequency),
            initialInvestment: this.toNumber(r.initial_investment),
            dailyBudget: this.toNumber(r.daily_budget),
            lifetimeBudget: this.toNumber(r.lifetime_budget),
            currency: r.currency ?? null,
            flightStartDate: r.flight_start_date ? this.toDateString(r.flight_start_date) : null,
            flightEndDate: r.flight_end_date ? this.toDateString(r.flight_end_date) : null,
            notes: r.notes ?? null,
            createdBy: r.created_by != null ? Number(r.created_by) : null,
            updatedBy: r.updated_by != null ? Number(r.updated_by) : null,
            createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
            updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
        };
    }

    private toNumber(value: any): number | null {
        if (value === null || value === undefined) return null;
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }

    private toDateString(value: any): string {
        if (value instanceof Date) return value.toISOString().split('T')[0];
        return String(value).split('T')[0];
    }
}
