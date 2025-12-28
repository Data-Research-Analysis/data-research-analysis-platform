import type { IDataSource } from "./IDataSource";

export interface IProject {
    id: number;
    user_platform_id: number;
    name: string;
    description?: string;
    created_at?: string;
    // Counts from backend API
    data_sources_count?: number;
    data_models_count?: number;
    dashboards_count?: number;
    // Full relations (for backward compatibility)
    DataSources: IDataSource[];
}