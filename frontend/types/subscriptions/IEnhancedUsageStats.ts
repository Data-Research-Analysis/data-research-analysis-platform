export interface IEnhancedUsageStats {
    tier: string;
    tierDetails: {
        id: number;
        tierName: string;
        pricePerMonth: number;
    };
    rowLimit: number;
    projectCount: number;
    maxProjects: number | null;
    dataSourceCount: number;
    maxDataSources: number | null;
    dataModelCount: number;
    maxDataModels: number | null;
    dashboardCount: number;
    maxDashboards: number | null;
    aiGenerationsPerMonth: number | null;
    aiGenerationsUsed: number;
    canCreateProject: boolean;
    canCreateDataSource: boolean;
    canCreateDataModel: boolean;
    canCreateDashboard: boolean;
    canUseAIGeneration: boolean;
}
