import { getAppDataSource } from '../datasources/PostgresDS.js';
import { DRADataSource } from '../models/DRADataSource.js';
import { DRADataModel } from '../models/DRADataModel.js';

const MARKETING_SOURCE_TYPES = [
    'google_ads',
    'google_analytics',
    'google_ad_manager',
    'meta_ads',
    'linkedin_ads',
    'hubspot',
    'klaviyo',
];

export interface IMarketingOnboardingResult {
    sources: string[];
    modelsCreated: number;
    dashboardsCreated: number;
    errors: string[];
}

export class MarketingOnboardingService {
    private static instance: MarketingOnboardingService;

    private constructor() {}

    public static getInstance(): MarketingOnboardingService {
        if (!MarketingOnboardingService.instance) {
            MarketingOnboardingService.instance = new MarketingOnboardingService();
        }
        return MarketingOnboardingService.instance;
    }

    public async onboard(
        projectId: number,
        userId: number,
        organizationId?: number,
        workspaceId?: number
    ): Promise<IMarketingOnboardingResult> {
        const dataSource = await getAppDataSource();
        const repository = dataSource.getRepository(DRADataSource);

        const sources = await repository.find({ where: { project: { id: projectId } } });
        const marketingSources = sources.filter(
            (source) => MARKETING_SOURCE_TYPES.includes(source.data_type) || source.classification === 'marketing'
        );

        const result: IMarketingOnboardingResult = { sources: [], modelsCreated: 0, dashboardsCreated: 0, errors: [] };

        for (const source of marketingSources) {
            const modelCount = await dataSource.getRepository(DRADataModel).count({
                where: { data_source: { id: source.id } },
            });
            if (modelCount > 0) {
                result.sources.push(source.name);
                continue;
            }

            try {
                const { AutoDataModelService } = await import('./AutoDataModelService.js');
                const auto = await AutoDataModelService.getInstance().autoCreate({
                    data_source_id: source.id,
                    skip_existing: true,
                    users_platform_id: userId,
                    organization_id: organizationId,
                    workspace_id: workspaceId,
                });
                result.sources.push(source.name);
                result.modelsCreated += auto.summary?.total_models_created ?? 0;

                const createdModelIds: number[] = (auto.created_models ?? []).map((m) => m.id).filter(Boolean);
                if (createdModelIds.length > 0) {
                    try {
                        const { DashboardAutoGenerationService } = await import('./DashboardAutoGenerationService.js');
                        await DashboardAutoGenerationService.getInstance().autoGenerate({
                            data_model_id: createdModelIds[0],
                            users_platform_id: userId,
                            project_id: projectId,
                        });
                        result.dashboardsCreated += createdModelIds.length;
                    } catch (dashboardError: any) {
                        result.errors.push(`dashboard: ${dashboardError.message}`);
                    }
                }
            } catch (error: any) {
                result.errors.push(`${source.name}: ${error.message}`);
            }
        }

        return result;
    }
}
