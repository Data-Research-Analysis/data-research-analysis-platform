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
        nextRun: string | null;
        lastRun: string | null;
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
