import { AppDataSource } from '../datasources/PostgresDS.js';
import type { IFunnelStep, IFunnelCondition } from './FunnelDefinitionService.js';
import type { IAttributionEvent } from '../interfaces/IAttribution.js';
import { EDataSourceType } from '../types/EDataSourceType.js';

export interface IStageMatchResult {
    stepName: string;
    stepOrder: number;
    matchedEvents: IAttributionEvent[];
    uniqueUsers: number;
}

export interface IAdPlatformStageMetrics {
    stepName: string;
    stepOrder: number;
    /** Total spend across all campaigns matching this stage */
    spend: number;
    /** Total impressions */
    impressions: number;
    /** Total clicks */
    clicks: number;
    /** Total conversions */
    conversions: number;
    /** Total conversion value (revenue) */
    conversionValue: number;
}

export interface IAdPlatformTouchpoint {
    /** Identifier like "google_ads::123::2026-06-15" */
    id: string;
    campaignName: string;
    date: string;
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    conversionValue: number;
    channelId: number;
    channelName: string;
    /** Timestamp for attribution ordering */
    dateObj: Date;
}

export class FunnelMatcherService {
    private static instance: FunnelMatcherService;

    static getInstance(): FunnelMatcherService {
        if (!FunnelMatcherService.instance) {
            FunnelMatcherService.instance = new FunnelMatcherService();
        }
        return FunnelMatcherService.instance;
    }

    async matchFunnelSteps(
        projectId: number,
        steps: IFunnelStep[],
        dateStart: Date,
        dateEnd: Date,
    ): Promise<IStageMatchResult[]> {
        const results: IStageMatchResult[] = [];
        const matchingUserIds = new Set<string>();

        for (const step of steps) {
            const events = await this.queryEventsForStep(projectId, step, dateStart, dateEnd, matchingUserIds);
            const usersInStep = new Set(events.map(e => e.userIdentifier));

            if (results.length === 0) {
                usersInStep.forEach(u => matchingUserIds.add(u));
            } else {
                usersInStep.forEach(u => matchingUserIds.add(u));
            }

            results.push({
                stepName: step.name,
                stepOrder: step.order,
                matchedEvents: events,
                uniqueUsers: usersInStep.size,
            });
        }

        return results;
    }

    /**
     * Get all matched events across all funnel steps with user journey info,
     * ordered by user_identifier and event_timestamp for attribution calculation.
     */
    async getFunnelJourneyEvents(
        projectId: number,
        steps: IFunnelStep[],
        dateStart: Date,
        dateEnd: Date,
    ): Promise<Array<{ userIdentifier: string; events: IAttributionEvent[] }>> {
        const matchUserIds = new Set<string>();
        const stepEventsMap = new Map<string, IAttributionEvent[]>();

        for (const step of steps) {
            const events = await this.queryEventsForStep(projectId, step, dateStart, dateEnd, new Set());
            for (const ev of events) {
                const uid = ev.userIdentifier;
                matchUserIds.add(uid);
                if (!stepEventsMap.has(uid)) stepEventsMap.set(uid, []);
                stepEventsMap.get(uid)!.push(ev);
            }
        }

        const result: Array<{ userIdentifier: string; events: IAttributionEvent[] }> = [];
        for (const uid of matchUserIds) {
            const userEvents = (stepEventsMap.get(uid) || []).sort(
                (a, b) => a.eventTimestamp.getTime() - b.eventTimestamp.getTime(),
            );
            result.push({ userIdentifier: uid, events: userEvents });
        }

        return result;
    }

    /**
     * Match funnel steps against ad platform physical tables instead of
     * dra_attribution_events. Queries Google Ads, Meta Ads, and LinkedIn Ads
     * tables discovered via DRATableMetadata for the project.
     *
     * Returns aggregated metrics per funnel step (spend, impressions, clicks,
     * conversions, conversion value) — no per-user data.
     */
    async matchFunnelStepsFromAdPlatforms(
        projectId: number,
        steps: IFunnelStep[],
        dateStart: Date,
        dateEnd: Date,
    ): Promise<IAdPlatformStageMetrics[]> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        try {
            // Find all ad platform data sources for this project
            const sources = await queryRunner.query(
                `SELECT id, data_type FROM "dra_data_sources"
                 WHERE project_id = $1
                   AND data_type IN ('google_ads', 'meta_ads', 'linkedin_ads', 'google_analytics')`,
                [projectId],
            );

            // Find all physical tables for these sources
            const sourceIds = sources.map((s: any) => s.id);
            if (sourceIds.length === 0) {
                return steps.map(s => ({
                    stepName: s.name,
                    stepOrder: s.order,
                    spend: 0,
                    impressions: 0,
                    clicks: 0,
                    conversions: 0,
                    conversionValue: 0,
                }));
            }

            const tables = await queryRunner.query(
                `SELECT tm.data_source_id, tm.schema_name, tm.physical_table_name, tm.logical_table_name,
                        ds.data_type
                 FROM "dra_table_metadata" tm
                 JOIN "dra_data_sources" ds ON ds.id = tm.data_source_id
                 WHERE tm.data_source_id = ANY($1)
                   AND tm.logical_table_name IN ('campaigns', 'insights', 'campaign_analytics', 'user_acquisition')`,
                [sourceIds],
            );

            const startStr = dateStart.toISOString().split('T')[0];
            const endStr = dateEnd.toISOString().split('T')[0];

            const results: IAdPlatformStageMetrics[] = [];

            for (const step of steps) {
                let totalSpend = 0;
                let totalImpressions = 0;
                let totalClicks = 0;
                let totalConversions = 0;
                let totalConversionValue = 0;

                for (const table of tables) {
                    const fullName = `${table.schema_name}.${table.physical_table_name}`;
                    const dataType = table.data_type;

                    const [dateCol, spendCol, impressionCol, clickCol, conversionCol, valueCol] = this.getPlatformTableColumns(dataType, table.logical_table_name);
                    if (!dateCol) continue;

                    const stepConditions = this.buildAdPlatformWhereClause(step, dataType);
                    if (!stepConditions) continue;

                    let sql: string;
                    let params: any[];

                    if (dataType === 'google_ads') {
                        sql = `
                            SELECT COALESCE(SUM(COALESCE(${spendCol},0))/1000000, 0) AS spend,
                                   COALESCE(SUM(${impressionCol}), 0) AS impressions,
                                   COALESCE(SUM(${clickCol}), 0) AS clicks,
                                   COALESCE(SUM(${conversionCol}), 0) AS conversions,
                                   COALESCE(SUM(${valueCol}), 0) AS conversion_value
                            FROM ${fullName}
                            WHERE date BETWEEN $1 AND $2
                              AND ${stepConditions.where}`
                        ;
                        params = [startStr, endStr, ...stepConditions.params];
                    } else if (dataType === 'google_analytics') {
                        sql = `
                            SELECT 0 AS spend,
                                   0 AS impressions,
                                   0 AS clicks,
                                   COALESCE(SUM(${conversionCol}), 0) AS conversions,
                                   0 AS conversion_value
                            FROM ${fullName}
                            WHERE ${stepConditions.where}
                              AND date BETWEEN $1 AND $2`
                        ;
                        params = [...stepConditions.params, startStr, endStr];
                    } else {
                        sql = `
                            SELECT COALESCE(SUM(${spendCol}), 0) AS spend,
                                   COALESCE(SUM(${impressionCol}), 0) AS impressions,
                                   COALESCE(SUM(${clickCol}), 0) AS clicks,
                                   COALESCE(SUM(${conversionCol}), 0) AS conversions,
                                   COALESCE(SUM(${valueCol}), 0) AS conversion_value
                            FROM ${fullName}
                            WHERE ${stepConditions.where}`
                        ;
                        params = stepConditions.params;

                        if (dataType === 'meta_ads') {
                            sql = sql.replace(
                                'WHERE',
                                `WHERE date_start BETWEEN $1 AND $2 AND`
                            );
                            params = [startStr, endStr, ...stepConditions.params];
                        } else if (dataType === 'linkedin_ads') {
                            sql = sql.replace(
                                'WHERE',
                                `WHERE date_start BETWEEN $1 AND $2 AND`
                            );
                            params = [startStr, endStr, ...stepConditions.params];
                        }
                    }

                    try {
                        const rows = await queryRunner.query(sql, params);
                        if (rows?.[0]) {
                            totalSpend += Number(rows[0].spend) || 0;
                            totalImpressions += Number(rows[0].impressions) || 0;
                            totalClicks += Number(rows[0].clicks) || 0;
                            totalConversions += Number(rows[0].conversions) || 0;
                            totalConversionValue += Number(rows[0].conversion_value) || 0;
                        }
                    } catch (err) {
                        console.warn(`[FunnelMatcher] Skipping table ${fullName}:`, (err as Error).message);
                    }
                }

                results.push({
                    stepName: step.name,
                    stepOrder: step.order,
                    spend: totalSpend,
                    impressions: totalImpressions,
                    clicks: totalClicks,
                    conversions: totalConversions,
                    conversionValue: totalConversionValue,
                });
            }

            return results;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Get all campaign-level touchpoints from ad platform tables for attribution
     * calculation. Returns each campaign×date combo as a touchpoint with
     * spend, clicks, conversions, and conversion_value.
     */
    async getAdPlatformTouchpoints(
        projectId: number,
        steps: IFunnelStep[],
        dateStart: Date,
        dateEnd: Date,
    ): Promise<IAdPlatformTouchpoint[]> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        try {
            const sources = await queryRunner.query(
                `SELECT id, data_type FROM "dra_data_sources"
                 WHERE project_id = $1
                   AND data_type IN ('google_ads', 'meta_ads', 'linkedin_ads', 'google_analytics')`,
                [projectId],
            );

            const sourceIds = sources.map((s: any) => s.id);
            if (sourceIds.length === 0) return [];

            const tables = await queryRunner.query(
                `SELECT tm.data_source_id, tm.schema_name, tm.physical_table_name, tm.logical_table_name,
                        ds.data_type
                 FROM "dra_table_metadata" tm
                 JOIN "dra_data_sources" ds ON ds.id = tm.data_source_id
                 WHERE tm.data_source_id = ANY($1)
                   AND tm.logical_table_name IN ('campaigns', 'insights', 'campaign_analytics', 'user_acquisition')`,
                [sourceIds],
            );

            const startStr = dateStart.toISOString().split('T')[0];
            const endStr = dateEnd.toISOString().split('T')[0];

            const channelNameMap: Record<string, string> = {
                google_ads: 'Google Ads',
                meta_ads: 'Meta Ads',
                linkedin_ads: 'LinkedIn Ads',
                google_analytics: 'Google Analytics',
            };

            const touchpoints: IAdPlatformTouchpoint[] = [];
            const seenKeys = new Set<string>();

            for (const table of tables) {
                const fullName = `${table.schema_name}.${table.physical_table_name}`;
                const dataType = table.data_type;
                const dataSourceId = table.data_source_id;

                const [dateCol, spendCol, impressionCol, clickCol, conversionCol, valueCol] = this.getPlatformTableColumns(dataType, table.logical_table_name);
                if (!dateCol) continue;

                const allConditions: string[] = [];
                const allParams: any[] = [];

                for (const step of steps) {
                    const stepConds = this.buildAdPlatformWhereClause(step, dataType);
                    if (stepConds) {
                        allConditions.push(`(${stepConds.where})`);
                        allParams.push(...stepConds.params);
                    }
                }

                if (allConditions.length === 0) continue;

                const combinedWhere = allConditions.join(' OR ');

                let sql: string;
                let params: any[];

                if (dataType === 'google_ads') {
                    sql = `
                        SELECT campaign_name AS campaign_name,
                               date,
                               COALESCE(cost, 0)/1000000 AS spend,
                               COALESCE(impressions, 0) AS impressions,
                               COALESCE(clicks, 0) AS clicks,
                               COALESCE(conversions, 0) AS conversions,
                               COALESCE(conversion_value, 0) AS conversion_value
                        FROM ${fullName}
                        WHERE date BETWEEN $1 AND $2
                          AND (${combinedWhere})
                        ORDER BY date ASC`
                    ;
                    params = [startStr, endStr, ...allParams];
                } else if (dataType === 'meta_ads') {
                    sql = `
                        SELECT campaign_name,
                               date_start AS date,
                               spend,
                               impressions,
                               clicks,
                               conversions,
                               conversion_value
                        FROM ${fullName}
                        WHERE date_start BETWEEN $1 AND $2
                          AND (${combinedWhere})
                        ORDER BY date_start ASC`
                    ;
                    params = [startStr, endStr, ...allParams];
                } else if (dataType === 'google_analytics') {
                    sql = `
                        SELECT first_user_campaign_id AS campaign_name,
                               date,
                               0 AS spend,
                               0 AS impressions,
                               0 AS clicks,
                               conversions,
                               0 AS conversion_value
                        FROM ${fullName}
                        WHERE date BETWEEN $1 AND $2
                          AND (${combinedWhere})
                        ORDER BY date ASC`
                    ;
                    params = [startStr, endStr, ...allParams];
                } else {
                    continue;
                }

                try {
                    const rows = await queryRunner.query(sql, params);
                    for (const row of rows) {
                        const campaignName = row.campaign_name || `Campaign ${dataSourceId}`;
                        const key = `${dataType}::${campaignName}::${row.date}`;
                        if (seenKeys.has(key)) continue;
                        seenKeys.add(key);

                        const dateObj = new Date(row.date);
                        touchpoints.push({
                            id: key,
                            campaignName,
                            date: row.date,
                            spend: Number(row.spend) || 0,
                            impressions: Number(row.impressions) || 0,
                            clicks: Number(row.clicks) || 0,
                            conversions: Number(row.conversions) || 0,
                            conversionValue: Number(row.conversion_value) || 0,
                            channelId: dataSourceId,
                            channelName: channelNameMap[dataType] || dataType,
                            dateObj,
                        });
                    }
                } catch (err) {
                    console.warn(`[FunnelMatcher] Skipping table ${fullName}:`, (err as Error).message);
                }
            }

            return touchpoints;
        } finally {
            await queryRunner.release();
        }
    }

    async estimateMatchCount(
        projectId: number,
        conditions: IFunnelCondition[],
        matchType: 'all' | 'any',
        dateStart?: Date,
        dateEnd?: Date,
    ): Promise<number> {
        if (!conditions || conditions.length === 0) return 0;
        const touchpoints = await this.getAdPlatformTouchpoints(
            projectId,
            [{ name: 'estimate', order: 0, match_type: matchType, conditions }],
            dateStart ?? new Date('2020-01-01'),
            dateEnd ?? new Date(),
        );
        const unique = new Set<string>();
        for (const tp of touchpoints) {
            unique.add(`${tp.channelName}|${tp.campaignName}|${tp.date}`);
        }
        return unique.size;
    }

    async getTotalMatchedUsers(
        projectId: number,
        conditions: IFunnelCondition[],
        matchType: 'all' | 'any',
        dateStart?: Date,
        dateEnd?: Date,
    ): Promise<number> {
        if (conditions.length === 0) return 0;

        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        try {
            const whereClauses: string[] = ['project_id = $1'];
            const params: any[] = [projectId];
            let paramIdx = 2;

            if (dateStart) {
                whereClauses.push(`event_timestamp >= $${paramIdx++}`);
                params.push(dateStart.toISOString());
            }
            if (dateEnd) {
                whereClauses.push(`event_timestamp <= $${paramIdx++}`);
                params.push(dateEnd.toISOString());
            }

            const conditionClauses: string[] = [];
            for (const cond of conditions) {
                const colName = this.fieldToColumn(cond.field);
                if (!colName) continue;
                const valIdx = paramIdx++;
                params.push(cond.value);
                switch (cond.operator) {
                    case 'equals':
                        conditionClauses.push(`"${colName}" = $${valIdx}`);
                        break;
                    case 'contains':
                        conditionClauses.push(`"${colName}" ILIKE '%' || $${valIdx} || '%'`);
                        break;
                    case 'starts_with':
                        conditionClauses.push(`"${colName}" ILIKE $${valIdx} || '%'`);
                        break;
                    case 'regex':
                        conditionClauses.push(`"${colName}" ~ $${valIdx}`);
                        break;
                }
            }

            if (conditionClauses.length === 0) return 0;
            const joinOp = matchType === 'all' ? ' AND ' : ' OR ';
            whereClauses.push(`(${conditionClauses.join(joinOp)})`);

            const sql = `SELECT COUNT(DISTINCT user_identifier) AS cnt FROM "dra_attribution_events" WHERE ${whereClauses.join(' AND ')}`;
            const result = await queryRunner.query(sql, params);
            return parseInt(result[0]?.cnt || '0', 10);
        } finally {
            await queryRunner.release();
        }
    }

    private async queryEventsForStep(
        projectId: number,
        step: IFunnelStep,
        dateStart: Date,
        dateEnd: Date,
        priorUserIds: Set<string>,
    ): Promise<IAttributionEvent[]> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        try {
            const whereClauses: string[] = ['e.project_id = $1'];
            const params: any[] = [projectId];
            let paramIdx = 2;

            whereClauses.push(`e.event_timestamp >= $${paramIdx++}`);
            params.push(dateStart.toISOString());
            whereClauses.push(`e.event_timestamp <= $${paramIdx++}`);
            params.push(dateEnd.toISOString());

            if (step.conditions.length > 0) {
                const conditionClauses: string[] = [];
                for (const cond of step.conditions) {
                    const colName = this.fieldToColumn(cond.field);
                    if (!colName) continue;
                    const valIdx = paramIdx++;
                    params.push(cond.value);
                    switch (cond.operator) {
                        case 'equals':
                            conditionClauses.push(`e."${colName}" = $${valIdx}`);
                            break;
                        case 'contains':
                            conditionClauses.push(`e."${colName}" ILIKE '%' || $${valIdx} || '%'`);
                            break;
                        case 'starts_with':
                            conditionClauses.push(`e."${colName}" ILIKE $${valIdx} || '%'`);
                            break;
                        case 'regex':
                            conditionClauses.push(`e."${colName}" ~ $${valIdx}`);
                            break;
                    }
                }
                if (conditionClauses.length > 0) {
                    const joinOp = step.match_type === 'all' ? ' AND ' : ' OR ';
                    whereClauses.push(`(${conditionClauses.join(joinOp)})`);
                }
            }

            const sql = `SELECT e.* FROM "dra_attribution_events" e WHERE ${whereClauses.join(' AND ')} ORDER BY e.event_timestamp ASC`;
            const rows = await queryRunner.query(sql, params);
            return rows.map((row: any) => this.mapEvent(row));
        } finally {
            await queryRunner.release();
        }
    }

    private fieldToColumn(field: string): string | null {
        const mapping: Record<string, string> = {
            utm_source: 'utm_source',
            utm_medium: 'utm_medium',
            utm_campaign: 'utm_campaign',
            utm_term: 'utm_term',
            utm_content: 'utm_content',
        };
        return mapping[field] || null;
    }

    private mapEvent(row: any): IAttributionEvent {
        return {
            id: row.id,
            projectId: row.project_id,
            userIdentifier: row.user_identifier,
            sessionId: row.session_id,
            eventType: row.event_type,
            eventName: row.event_name,
            eventValue: row.event_value ? parseFloat(row.event_value) : undefined,
            channelId: row.channel_id,
            utmSource: row.utm_source,
            utmMedium: row.utm_medium,
            utmCampaign: row.utm_campaign,
            utmTerm: row.utm_term,
            utmContent: row.utm_content,
            referrer: row.referrer,
            landingPage: row.landing_page,
            pageUrl: row.page_url,
            metadata: row.metadata,
            eventTimestamp: new Date(row.event_timestamp),
            createdAt: new Date(row.created_at),
        };
    }

    /**
     * Map funnel step conditions to ad platform table WHERE clauses.
     * UTM fields are mapped to campaign_name for all platforms.
     * Returns null if conditions can't be meaningfully mapped.
     */
    private buildAdPlatformWhereClause(step: IFunnelStep, dataType: string): { where: string; params: any[] } | null {
        const conditions = step.conditions;
        if (!conditions || conditions.length === 0) return null;

        const clauses: string[] = [];
        const params: any[] = [];
        let paramIdx = 1;

        for (const cond of conditions) {
            const colName = this.utmFieldToAdPlatformColumn(cond.field, dataType);
            if (!colName) continue;

            const valIdx = paramIdx++;
            params.push(cond.value);

            switch (cond.operator) {
                case 'equals':
                    clauses.push(`"${colName}" = $${valIdx}`);
                    break;
                case 'contains':
                    clauses.push(`"${colName}" ILIKE '%' || $${valIdx} || '%'`);
                    break;
                case 'starts_with':
                    clauses.push(`"${colName}" ILIKE $${valIdx} || '%'`);
                    break;
                case 'regex':
                    clauses.push(`"${colName}" ~ $${valIdx}`);
                    break;
            }
        }

        if (clauses.length === 0) return null;
        const joinOp = step.match_type === 'all' ? ' AND ' : ' OR ';
        return { where: clauses.join(joinOp), params };
    }

    /**
     * Map a UTM field to the appropriate column in an ad platform physical table.
     */
    private utmFieldToAdPlatformColumn(field: string, dataType: string): string | null {
        if (field === 'utm_source') {
            if (dataType === 'google_analytics') return 'first_user_source';
            return null;
        }
        if (field === 'utm_medium') {
            if (dataType === 'google_analytics') return 'first_user_medium';
            return null;
        }
        if (field === 'utm_campaign') {
            if (dataType === 'google_analytics') return 'first_user_campaign_id';
            return 'campaign_name';
        }
        if (field === 'utm_term') {
            return dataType === 'google_ads' ? 'keyword_text' : null;
        }
        if (field === 'utm_content') {
            return null;
        }
        return null;
    }

    /**
     * Return the appropriate column names for querying a platform's physical table.
     * Returns [dateCol, spendCol, impressionCol, clickCol, conversionCol, valueCol].
     * Returns null entries if the table type is not supported.
     */
    private getPlatformTableColumns(
        dataType: string,
        logicalTableName: string,
    ): [string | null, string, string, string, string, string] {
        if (dataType === 'google_ads' && logicalTableName === 'campaigns') {
            return ['date', 'cost', 'impressions', 'clicks', 'conversions', 'conversion_value'];
        }
        if (dataType === 'meta_ads' && logicalTableName === 'insights') {
            return ['date_start', 'spend', 'impressions', 'clicks', 'conversions', 'conversion_value'];
        }
        if (dataType === 'linkedin_ads' && logicalTableName === 'campaign_analytics') {
            return ['date_start', 'cost_usd', 'impressions', 'clicks', 'external_conversions', 'cost_usd'];
        }
        if (dataType === 'google_analytics' && logicalTableName === 'user_acquisition') {
            return ['date', '0', '0', '0', 'conversions', '0'];
        }
        return [null, '0', '0', '0', '0', '0'];
    }
}

export default FunnelMatcherService;
