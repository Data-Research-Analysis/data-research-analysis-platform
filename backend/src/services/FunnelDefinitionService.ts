import { AppDataSource } from '../datasources/PostgresDS.js';

export interface IFunnelCondition {
    field: 'utm_source' | 'utm_medium' | 'utm_campaign' | 'utm_term' | 'utm_content';
    operator: 'equals' | 'contains' | 'starts_with' | 'regex';
    value: string;
}

export interface IFunnelStep {
    name: string;
    order: number;
    match_type: 'all' | 'any';
    conditions: IFunnelCondition[];
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
        };
    }
}

export default FunnelDefinitionService;
