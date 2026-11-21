import { AppDataSource } from '../datasources/PostgresDS.js';

export interface IFunnelCondition {
    field: 'utm_source' | 'utm_medium' | 'utm_campaign' | 'utm_term' | 'utm_content';
    operator: 'equals' | 'contains' | 'starts_with' | 'regex';
    value: string;
}

export type FunnelStepType = 'condition' | 'stage';

export type FunnelSource =
    | 'google_analytics'
    | 'google_analytics_bigquery'
    | 'google_ads'
    | 'meta_ads'
    | 'linkedin_ads'
    | 'blended';

export interface IFunnelStep {
    name: string;
    order: number;
    match_type: 'all' | 'any';
    conditions: IFunnelCondition[];
    /** 'condition' (UTM-matched, default) or 'stage' (aggregate metric stage). */
    type?: FunnelStepType;
    /** Data plane for a stage step. */
    source?: FunnelSource;
    /** Metric to sum for a stage step (sessions, engaged_sessions, conversions, new_users, impressions, clicks). */
    metric?: string;
    /** Aggregation for a stage step. */
    aggregation?: 'sum' | 'count_distinct';
}

export interface IFunnel {
    id: number;
    project_id: number;
    name: string;
    steps: IFunnelStep[];
    last_analyzed_at: Date | null;
    conversion_rate: number | null;
    created_by_user_id: number | null;
    created_at: Date;
    updated_at: Date;
    is_auto: boolean;
    auto_key: string | null;
    source: string | null;
    date_range_preset: string | null;
    attribution_model: string | null;
}

export class FunnelDefinitionService {
    private static instance: FunnelDefinitionService;

    static getInstance(): FunnelDefinitionService {
        if (!FunnelDefinitionService.instance) {
            FunnelDefinitionService.instance = new FunnelDefinitionService();
        }
        return FunnelDefinitionService.instance;
    }

    async create(projectId: number, name: string, steps: IFunnelStep[], userId?: number): Promise<IFunnel> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        try {
            const result = await queryRunner.query(
                `INSERT INTO "dra_funnel_definitions" (project_id, name, steps, created_by_user_id, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING *`,
                [projectId, name, JSON.stringify(steps), userId || null],
            );
            return this.mapRow(result[0]);
        } finally {
            await queryRunner.release();
        }
    }

    async update(id: number, updates: { name?: string; steps?: IFunnelStep[] }): Promise<IFunnel | null> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        try {
            const setClauses: string[] = ['updated_at = NOW()'];
            const params: any[] = [id];
            let paramIdx = 2;

            if (updates.name !== undefined) {
                setClauses.push(`name = $${paramIdx++}`);
                params.push(updates.name);
            }
            if (updates.steps !== undefined) {
                setClauses.push(`steps = $${paramIdx++}`);
                params.push(JSON.stringify(updates.steps));
            }
            // A manual edit detaches an auto-generated funnel so regeneration
            // does not overwrite the user's changes.
            setClauses.push('is_auto = false', 'auto_key = NULL');

            params.push(id);
            const result = await queryRunner.query(
                `UPDATE "dra_funnel_definitions" SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
                params,
            );
            return result.length > 0 ? this.mapRow(result[0]) : null;
        } finally {
            await queryRunner.release();
        }
    }

    async getByProject(projectId: number): Promise<IFunnel[]> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        try {
            const results = await queryRunner.query(
                `SELECT * FROM "dra_funnel_definitions" WHERE project_id = $1 ORDER BY created_at DESC`,
                [projectId],
            );
            return results.map(this.mapRow);
        } finally {
            await queryRunner.release();
        }
    }

    async getById(id: number): Promise<IFunnel | null> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        try {
            const results = await queryRunner.query(
                `SELECT * FROM "dra_funnel_definitions" WHERE id = $1`,
                [id],
            );
            return results.length > 0 ? this.mapRow(results[0]) : null;
        } finally {
            await queryRunner.release();
        }
    }

    async delete(id: number): Promise<boolean> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        try {
            await queryRunner.query(`DELETE FROM "dra_funnel_analysis_results" WHERE funnel_id = $1`, [id]);
            const result = await queryRunner.query(
                `DELETE FROM "dra_funnel_definitions" WHERE id = $1`,
                [id],
            );
            return result[1] > 0;
        } finally {
            await queryRunner.release();
        }
    }

    async saveAnalysisResults(
        funnelId: number,
        projectId: number,
        stageResults: Array<{
            stageName: string;
            stageOrder: number;
            userCount: number;
            eventCount: number;
            conversionToNext: number | null;
            dropOffPercent: number | null;
            channelData: any;
            utmDistribution: any;
        }>,
        dateStart: string,
        dateEnd: string,
    ): Promise<void> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        try {
            await queryRunner.query(`DELETE FROM "dra_funnel_analysis_results" WHERE funnel_id = $1 AND date_start = $2 AND date_end = $3`, [funnelId, dateStart, dateEnd]);

            for (const sr of stageResults) {
                await queryRunner.query(
                    `INSERT INTO "dra_funnel_analysis_results"
                     (funnel_id, project_id, stage_name, stage_order, user_count, event_count,
                      conversion_to_next, drop_off_percent, channel_data, utm_distribution, date_start, date_end)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
                    [
                        funnelId, projectId, sr.stageName, sr.stageOrder, sr.userCount, sr.eventCount,
                        sr.conversionToNext, sr.dropOffPercent,
                        sr.channelData ? JSON.stringify(sr.channelData) : null,
                        sr.utmDistribution ? JSON.stringify(sr.utmDistribution) : null,
                        dateStart, dateEnd,
                    ],
                );
            }

            await queryRunner.query(
                `UPDATE "dra_funnel_definitions" SET last_analyzed_at = NOW(), updated_at = NOW() WHERE id = $1`,
                [funnelId],
            );
        } finally {
            await queryRunner.release();
        }
    }

    async getAnalysisResults(funnelId: number, dateStart: string, dateEnd: string): Promise<any[]> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        try {
            return await queryRunner.query(
                `SELECT * FROM "dra_funnel_analysis_results"
                 WHERE funnel_id = $1 AND date_start = $2 AND date_end = $3
                 ORDER BY stage_order ASC`,
                [funnelId, dateStart, dateEnd],
            );
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * List auto-generated funnels for a project.
     */
    async getAutoFunnels(projectId: number): Promise<IFunnel[]> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        try {
            const results = await queryRunner.query(
                `SELECT * FROM "dra_funnel_definitions"
                 WHERE project_id = $1 AND is_auto = true
                 ORDER BY created_at DESC`,
                [projectId],
            );
            return results.map(this.mapRow);
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Insert or update an auto-generated funnel, keyed by (project_id, auto_key).
     * Idempotent so it can run after every sync.
     */
    async upsertAuto(
        projectId: number,
        autoKey: string,
        name: string,
        steps: IFunnelStep[],
        source: string,
        dateRangePreset: string,
        attributionModel: string | null,
        userId?: number,
    ): Promise<IFunnel> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        try {
            const result = await queryRunner.query(
                `INSERT INTO "dra_funnel_definitions"
                    (project_id, name, steps, created_by_user_id, is_auto, auto_key, source, date_range_preset, attribution_model, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, true, $5, $6, $7, $8, NOW(), NOW())
                 ON CONFLICT (project_id, auto_key) WHERE is_auto = true
                 DO UPDATE SET
                    name = EXCLUDED.name,
                    steps = EXCLUDED.steps,
                    source = EXCLUDED.source,
                    date_range_preset = EXCLUDED.date_range_preset,
                    attribution_model = EXCLUDED.attribution_model,
                    updated_at = NOW()
                 RETURNING *`,
                [projectId, name, JSON.stringify(steps), userId || null, autoKey, source, dateRangePreset, attributionModel],
            );
            return this.mapRow(result[0]);
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Detach an auto funnel from regeneration (keeps it as a normal funnel).
     */
    async detachAuto(id: number): Promise<IFunnel | null> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        try {
            const result = await queryRunner.query(
                `UPDATE "dra_funnel_definitions"
                 SET is_auto = false, auto_key = NULL, updated_at = NOW()
                 WHERE id = $1 RETURNING *`,
                [id],
            );
            return result.length > 0 ? this.mapRow(result[0]) : null;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Delete auto-generated funnels for a project whose auto_key is no longer
     * produced by the auto-builder (for example after their data source was
     * removed). Manual funnels (is_auto = false) are never touched.
     * Returns the number of funnels removed.
     */
    async pruneAutoFunnels(projectId: number, keepAutoKeys: string[]): Promise<number> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        try {
            const keep = keepAutoKeys.length > 0 ? keepAutoKeys : [''];
            const stale: Array<{ id: number }> = await queryRunner.query(
                `SELECT id FROM "dra_funnel_definitions"
                 WHERE project_id = $1 AND is_auto = true
                   AND (auto_key IS NULL OR auto_key <> ALL($2::text[]))`,
                [projectId, keep],
            );
            if (stale.length === 0) return 0;

            const ids = stale.map(r => r.id);
            await queryRunner.query(
                `DELETE FROM "dra_funnel_analysis_results" WHERE funnel_id = ANY($1)`,
                [ids],
            );
            await queryRunner.query(
                `DELETE FROM "dra_funnel_definitions" WHERE id = ANY($1)`,
                [ids],
            );
            return ids.length;
        } finally {
            await queryRunner.release();
        }
    }

    private mapRow(row: any): IFunnel {
        return {
            id: row.id,
            project_id: row.project_id,
            name: row.name,
            steps: typeof row.steps === 'string' ? JSON.parse(row.steps) : row.steps,
            last_analyzed_at: row.last_analyzed_at ? new Date(row.last_analyzed_at) : null,
            conversion_rate: row.conversion_rate ? parseFloat(row.conversion_rate) : null,
            created_by_user_id: row.created_by_user_id,
            created_at: new Date(row.created_at),
            updated_at: new Date(row.updated_at),
            is_auto: !!row.is_auto,
            auto_key: row.auto_key ?? null,
            source: row.source ?? null,
            date_range_preset: row.date_range_preset ?? null,
            attribution_model: row.attribution_model ?? null,
        };
    }
}

export default FunnelDefinitionService;
