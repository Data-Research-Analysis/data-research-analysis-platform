import { AppDataSource } from '../datasources/PostgresDS.js';
import { getRedisClient } from '../config/redis.config.js';
import { ScheduledBackupProcessor } from './ScheduledBackupProcessor.js';
import { ScheduledBackupService } from '../services/ScheduledBackupService.js';

export interface IAdminOverviewStats {
    users: {
        total: number;
        verified: number;
        unverified: number;
        admins: number;
    };
    platform: {
        projects: number;
        dataSources: number;
        dashboards: number;
        dataModels: number;
    };
    ai: {
        totalConversations: number;
        totalMessages: number;
        activeRedisSessions: number;
    };
    content: {
        articles: number;
        publishedArticles: number;
        draftArticles: number;
        categories: number;
        sitemapUrls: number;
    };
    syncHealth: {
        totalSources: number;
        failedSources: number;
        neverSynced: number;
    };
    dataModelHealth: {
        healthy: number;
        warning: number;
        blocked: number;
        unknown: number;
    };
}

export interface IDataSourceSyncRow {
    id: number;
    name: string;
    data_type: string;
    owner_email: string;
    last_sync: string | null;
    created_at: string | null;
    status: 'synced' | 'failed' | 'never';
}

export interface ISystemHealthStatus {
    database: boolean;
    redis: boolean;
    backupScheduler: {
        enabled: boolean;
        isRunning: boolean;
        nextRun: Date | null;
        lastRun: Date | null;
    };
    backupStats: {
        totalRuns: number;
        successfulRuns: number;
        failedRuns: number;
        totalSizeBytes: number;
    } | null;
}

export interface ITimeSeriesPoint {
    date: string;
    count: number;
}

export interface IGuestPlanSession {
    id: number;
    name: string;
    website: string | null;
    status: string;
    mode: string;
    funnelCoverage: string;
    buildMode: string;
    industry: string | null;
    platforms: string[];
    markets: string[];
    budgetTotal: number | null;
    currency: string;
    startDate: string | null;
    endDate: string | null;
    currentStep: number;
    clientBrief: string | null;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface IGuestPlanStatus {
    allTime: {
        created: number;
        claimed: number;
    };
    live: {
        total: number;
        running: number;
        paused: number;
        completed: number;
        failed: number;
        draft: number;
    };
    active: IGuestPlanSession[];
    recent: IGuestPlanSession[];
}

export class AdminStatsProcessor {
    private static instance: AdminStatsProcessor;

    private constructor() {}

    public static getInstance(): AdminStatsProcessor {
        if (!AdminStatsProcessor.instance) {
            AdminStatsProcessor.instance = new AdminStatsProcessor();
        }
        return AdminStatsProcessor.instance;
    }

    async getOverviewStats(): Promise<IAdminOverviewStats> {
        const manager = AppDataSource.manager;

        const [
            userStats,
            platformStats,
            aiStats,
            contentStats,
            syncHealthStats,
            dataModelHealthStats,
        ] = await Promise.all([
            this.queryUserStats(manager),
            this.queryPlatformStats(manager),
            this.queryAIStats(manager),
            this.queryContentStats(manager),
            this.querySyncHealthSummary(manager),
            this.queryDataModelHealthSummary(manager),
        ]);

        return {
            users: userStats,
            platform: platformStats,
            ai: aiStats,
            content: contentStats,
            syncHealth: syncHealthStats,
            dataModelHealth: dataModelHealthStats,
        };
    }

    private async queryUserStats(manager: any) {
        const rows = await manager.query(`
            SELECT
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE email_verified_at IS NOT NULL)::int AS verified,
                COUNT(*) FILTER (WHERE email_verified_at IS NULL)::int AS unverified,
                COUNT(*) FILTER (WHERE user_type = 'admin')::int AS admins
            FROM dra_users_platform
        `);
        const r = rows[0] || {};
        return {
            total: r.total || 0,
            verified: r.verified || 0,
            unverified: r.unverified || 0,
            admins: r.admins || 0,
        };
    }

    private async queryPlatformStats(manager: any) {
        const rows = await manager.query(`
            SELECT
                (SELECT COUNT(*)::int FROM dra_projects) AS projects,
                (SELECT COUNT(*)::int FROM dra_data_sources) AS data_sources,
                (SELECT COUNT(*)::int FROM dra_dashboards) AS dashboards,
                (SELECT COUNT(*)::int FROM dra_data_models) AS data_models
        `);
        const r = rows[0] || {};
        return {
            projects: r.projects || 0,
            dataSources: r.data_sources || 0,
            dashboards: r.dashboards || 0,
            dataModels: r.data_models || 0,
        };
    }

    private async queryAIStats(manager: any) {
        const rows = await manager.query(`
            SELECT
                (SELECT COUNT(*)::int FROM dra_ai_data_model_conversations) AS conversations,
                (SELECT COUNT(*)::int FROM dra_ai_data_model_messages) AS messages
        `);
        const r = rows[0] || {};

        let activeRedisSessions = 0;
        try {
            const redis = getRedisClient();
            const keys = await redis.keys('dra:ai:*session*');
            activeRedisSessions = keys.length;
        } catch {
            activeRedisSessions = 0;
        }

        return {
            totalConversations: r.conversations || 0,
            totalMessages: r.messages || 0,
            activeRedisSessions,
        };
    }

    private async queryContentStats(manager: any) {
        const rows = await manager.query(`
            SELECT
                (SELECT COUNT(*)::int FROM dra_articles) AS articles,
                (SELECT COUNT(*)::int FROM dra_articles WHERE publish_status = 'published') AS published,
                (SELECT COUNT(*)::int FROM dra_articles WHERE publish_status = 'draft') AS draft,
                (SELECT COUNT(*)::int FROM dra_categories) AS categories,
                (SELECT COUNT(*)::int FROM dra_sitemap_entries) AS sitemap_urls
        `);
        const r = rows[0] || {};
        return {
            articles: r.articles || 0,
            publishedArticles: r.published || 0,
            draftArticles: r.draft || 0,
            categories: r.categories || 0,
            sitemapUrls: r.sitemap_urls || 0,
        };
    }

    private async querySyncHealthSummary(manager: any) {
        // connection_details is encrypted at rest, so the last sync cannot be
        // read from its (decrypted) api_config JSON via SQL. The plaintext
        // sync_history table is the source of truth instead.
        const rows = await manager.query(`
            SELECT
                COUNT(*)::int AS total,
                COUNT(*) FILTER (
                    WHERE ds.data_type NOT IN ('postgresql','mysql','mariadb','mongodb','csv','excel','pdf')
                    AND ds.last_sync_at IS NULL
                    AND NOT EXISTS (
                        SELECT 1 FROM sync_history sh
                        WHERE sh.data_source_id = ds.id AND sh.completed_at IS NOT NULL
                    )
                )::int AS never_synced,
                0::int AS failed
            FROM dra_data_sources ds
        `);
        const r = rows[0] || {};
        return {
            totalSources: r.total || 0,
            failedSources: r.failed || 0,
            neverSynced: r.never_synced || 0,
        };
    }

    private async queryDataModelHealthSummary(manager: any) {
        const rows: { health_status: string; count: string }[] = await manager.query(
            `SELECT health_status, COUNT(*)::int AS count FROM dra_data_models GROUP BY health_status`
        );
        const result = { healthy: 0, warning: 0, blocked: 0, unknown: 0 };
        for (const row of rows) {
            const key = row.health_status as keyof typeof result;
            if (key in result) result[key] = parseInt(row.count, 10);
        }
        return result;
    }

    async getSyncHealthData(): Promise<IDataSourceSyncRow[]> {
        const manager = AppDataSource.manager;
        // connection_details is encrypted at rest (see DRADataSource), so the
        // api_config.last_sync JSON path is unreadable via SQL. Use the most
        // recent completed sync_history row, falling back to the plaintext
        // last_sync_at column.
        const rows = await manager.query(`
            SELECT
                ds.id,
                ds.name,
                ds.data_type,
                ds.created_at,
                u.email AS owner_email,
                COALESCE(sh.completed_at, ds.last_sync_at) AS last_sync
            FROM dra_data_sources ds
            LEFT JOIN dra_users_platform u ON ds.users_platform_id = u.id
            LEFT JOIN LATERAL (
                SELECT completed_at
                FROM sync_history
                WHERE data_source_id = ds.id
                  AND completed_at IS NOT NULL
                ORDER BY completed_at DESC
                LIMIT 1
            ) sh ON true
            ORDER BY ds.id DESC
            LIMIT 200
        `);

        return rows.map((r: any) => {
            const isFileOrDb = ['postgresql', 'mysql', 'mariadb', 'mongodb', 'csv', 'excel', 'pdf'].includes(r.data_type);
            let status: 'synced' | 'failed' | 'never' = 'synced';
            if (!isFileOrDb) {
                if (!r.last_sync || r.last_sync === 'null') {
                    status = 'never';
                } else {
                    const lastSyncDate = new Date(r.last_sync);
                    const hoursSinceSync = (Date.now() - lastSyncDate.getTime()) / 3600000;
                    status = hoursSinceSync > 72 ? 'failed' : 'synced';
                }
            }
            return {
                id: r.id,
                name: r.name,
                data_type: r.data_type,
                owner_email: r.owner_email || 'Unknown',
                last_sync: r.last_sync || null,
                created_at: r.created_at || null,
                status,
            };
        });
    }

    async getSystemHealth(): Promise<ISystemHealthStatus> {
        let dbHealthy = false;
        let redisHealthy = false;

        try {
            await AppDataSource.manager.query('SELECT 1');
            dbHealthy = true;
        } catch {
            dbHealthy = false;
        }

        try {
            const redis = getRedisClient();
            await redis.ping();
            redisHealthy = true;
        } catch {
            redisHealthy = false;
        }

        let schedulerHealth = {
            enabled: false,
            isRunning: false,
            nextRun: null as Date | null,
            lastRun: null as Date | null,
        };
        let backupStats = null;
        try {
            const schedulerStatus = await ScheduledBackupService.getInstance().getStatus();
            schedulerHealth = {
                enabled: schedulerStatus.scheduler_enabled,
                isRunning: schedulerStatus.is_running,
                nextRun: schedulerStatus.next_run,
                lastRun: schedulerStatus.last_run,
            };
            const stats = await ScheduledBackupProcessor.getInstance().getBackupStats();
            backupStats = {
                totalRuns: stats.total_runs,
                successfulRuns: stats.successful_runs,
                failedRuns: stats.failed_runs,
                totalSizeBytes: stats.total_backup_size_bytes,
            };
        } catch {
            // Backup service may not be configured
        }

        return {
            database: dbHealthy,
            redis: redisHealthy,
            backupScheduler: schedulerHealth,
            backupStats,
        };
    }

    async getTimeSeriesData(metric: string, days: number): Promise<ITimeSeriesPoint[]> {
        const manager = AppDataSource.manager;
        const safeMetric = metric.replace(/[^a-z_]/gi, '');
        const safeDays = Math.min(Math.max(parseInt(String(days), 10) || 30, 1), 365);

        const tableMap: Record<string, { table: string; dateCol: string; filter?: string }> = {
            signups: { table: 'dra_users_platform', dateCol: 'email_verified_at' },
            projects: { table: 'dra_projects', dateCol: 'created_at' },
            data_sources: { table: 'dra_data_sources', dateCol: 'created_at' },
            ai_messages: { table: 'dra_ai_data_model_messages', dateCol: 'created_at' },
            ai_conversations: { table: 'dra_ai_data_model_conversations', dateCol: 'created_at' },
            ai_calls: { table: 'ai_call_logs', dateCol: 'created_at' },
            cancellations: { table: 'dra_account_cancellations', dateCol: 'created_at' },
        };

        const config = tableMap[safeMetric];
        if (!config) return [];

        try {
            const rows = await manager.query(`
                SELECT
                    TO_CHAR(DATE_TRUNC('day', ${config.dateCol}), 'YYYY-MM-DD') AS date,
                    COUNT(*)::int AS count
                FROM ${config.table}
                WHERE ${config.dateCol} >= NOW() - INTERVAL '${safeDays} days'
                  AND ${config.dateCol} IS NOT NULL
                ${config.filter ? `AND ${config.filter}` : ''}
                GROUP BY 1
                ORDER BY 1
            `);
            return rows.map((r: any) => ({ date: r.date, count: r.count }));
        } catch {
            return [];
        }
    }

    async getDataSourceTypeBreakdown(): Promise<{ data_type: string; count: number }[]> {
        const manager = AppDataSource.manager;
        const rows = await manager.query(`
            SELECT data_type, COUNT(*)::int AS count
            FROM dra_data_sources
            GROUP BY data_type
            ORDER BY count DESC
        `);
        return rows.map((r: any) => ({ data_type: r.data_type, count: r.count }));
    }

    /**
     * Guest paid-media plan ("session") status.
     *
     * Guest plans are anonymous lead-in builds (is_guest = true) that are
     * hard-deleted 24h after creation unless claimed, so a durable all-time
     * count comes from the `guest_plan_created` / `guest_plan_claimed`
     * product events; the live breakdown and the running/recent rows come
     * from the plan table itself.
     */
    async getGuestPlanStatus(): Promise<IGuestPlanStatus> {
        const manager = AppDataSource.manager;

        const [eventRows, liveRows, rows] = await Promise.all([
            manager.query(`
                SELECT
                    COUNT(*) FILTER (WHERE event_name = 'guest_plan_created')::int AS created,
                    COUNT(*) FILTER (WHERE event_name = 'guest_plan_claimed')::int AS claimed
                FROM dra_product_events
            `),
            manager.query(`
                SELECT
                    COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE status = 'running')::int AS running,
                    COUNT(*) FILTER (WHERE status = 'paused')::int AS paused,
                    COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
                    COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
                    COUNT(*) FILTER (WHERE status = 'draft')::int AS draft
                FROM dra_paid_media_plans
                WHERE is_guest = true
            `),
            this.queryGuestPlanRows(manager),
        ]);

        const e = eventRows[0] || {};
        const l = liveRows[0] || {};

        return {
            allTime: {
                created: e.created || 0,
                claimed: e.claimed || 0,
            },
            live: {
                total: l.total || 0,
                running: l.running || 0,
                paused: l.paused || 0,
                completed: l.completed || 0,
                failed: l.failed || 0,
                draft: l.draft || 0,
            },
            active: rows.filter((r) => r.status === 'running'),
            recent: rows,
        };
    }

    private async queryGuestPlanRows(manager: any): Promise<IGuestPlanSession[]> {
        const rows = await manager.query(`
            SELECT
                p.id,
                p.name,
                p.status,
                p.mode,
                p.funnel_coverage,
                p.build_mode,
                p.platforms,
                p.markets,
                p.budget_total,
                p.currency,
                p.start_date,
                p.end_date,
                p.current_step,
                p.created_at,
                p.updated_at,
                p.state->'core_facts'->>'website' AS website,
                p.state->'core_facts'->>'industry' AS industry,
                p.state->'core_facts'->>'notes' AS notes,
                p.state->>'client_brief' AS client_brief
            FROM dra_paid_media_plans p
            WHERE p.is_guest = true
            ORDER BY p.created_at DESC
            LIMIT 200
        `);

        return rows.map((r: any) => ({
            id: r.id,
            name: r.name,
            website: r.website ?? null,
            status: r.status,
            mode: r.mode,
            funnelCoverage: r.funnel_coverage,
            buildMode: r.build_mode,
            industry: r.industry ?? null,
            platforms: Array.isArray(r.platforms) ? r.platforms : [],
            markets: Array.isArray(r.markets) ? r.markets : [],
            budgetTotal: r.budget_total != null ? Number(r.budget_total) : null,
            currency: r.currency,
            startDate: r.start_date ?? null,
            endDate: r.end_date ?? null,
            currentStep: r.current_step ?? 0,
            clientBrief: r.client_brief ?? null,
            notes: r.notes ?? null,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
        }));
    }
}
