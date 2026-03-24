import type { IDataSource } from "./IDataSource";
import type { IUsersPlatform } from "./IUsersPlatform";
import type { IDataModelSource } from "./IDataModelSource";

export type DataModelType = 'dimension' | 'fact' | 'aggregated' | null;
export type DataModelHealthStatus = 'healthy' | 'warning' | 'blocked' | 'unknown';

export interface IHealthIssue {
    code: string;
    severity: 'info' | 'warning' | 'error';
    title: string;
    description: string;
    recommendation: string;
}

export interface IDataModel {
    id: number;
    schema: string;
    name: string;
    sql_query: string;
    data_source?: IDataSource; // Now optional since cross-source models may not have a single data source
    users_platform: IUsersPlatform;
    is_cross_source?: boolean; // Flag indicating if this is a cross-source data model
    data_model_sources?: IDataModelSource[]; // Array of data sources for cross-source models
    execution_metadata?: Record<string, any>; // Metadata for query execution
    created_at?: string; // Creation timestamp
    // ── Health enforcement fields (Issue #1) ──────────────────────────────
    model_type?: DataModelType;
    health_status?: DataModelHealthStatus;
    health_issues?: IHealthIssue[];
    source_row_count?: number | null;
    row_count?: number | null;
}