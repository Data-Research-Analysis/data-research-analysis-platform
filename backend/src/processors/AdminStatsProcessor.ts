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
        ] = await Promise.all([
            this.queryUserStats(manager),
            this.queryPlatformStats(manager),
            this.queryAIStats(manager),
            this.queryContentStats(manager),
            this.querySyncHealthSummary(manager),
        ]);

        return {
            users: userStats,
            platform: platformStats,
            ai: aiStats,
            content: contentStats,
            syncHealth: syncHealthStats,
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
        const rows = await manager.query(`
            SELECT
                COUNT(*)::int AS total,
                COUNT(*) FILTER (
                    WHERE data_type NOT IN ('postgresql','mysql','mariadb','mongodb','csv','excel','pdf')
                    AND (
                        connection_details->'api_connection_details'->'api_config'->>'last_sync' IS NULL
                        OR connection_details->'api_connection_details'->'api_config'->>'last_sync' = 'null'
                    )
                )::int AS never_synced,
                0::int AS failed
            FROM dra_data_sources
        `);
        const r = rows[0] || {};
        return {
            totalSources: r.total || 0,
            failedSources: r.failed || 0,
            neverSynced: r.never_synced || 0,
        };
    }

    async getSyncHealthData(): Promise<IDataSourceSyncRow[]> {
        const manager = AppDataSource.manager;
        const rows = await manager.query(`
            SELECT
                ds.id,
                ds.name,
                ds.data_type,
                ds.created_at,
                u.email AS owner_email,
                ds.connection_details->'api_connection_details'->'api_config'->>'last_sync' AS last_sync
            FROM dra_data_sources ds
            LEFT JOIN dra_users_platform u ON ds.users_platform_id = u.id
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
}
