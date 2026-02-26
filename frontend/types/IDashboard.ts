import type { IColumn } from "./IColumn";
import type { IDashboardDataExportMetaData } from "./IDashboardDataExportMetaData";
import type { IDimension } from "./IDimension";
import type { ILocation } from "./ILocation";
import type { IProject } from "./IProject";
import type { IUsersPlatform } from "./IUsersPlatform";

/**
 * Represents a single chart within a dashboard
 */
export interface IDashboardChart {
    chart_id: number;
    chart_type: string;
    columns: IColumn[];
    data: any[]; // Can be various data formats depending on chart type
    dimensions: IDimension;
    location: ILocation;
    x_axis_label?: string;
    y_axis_label?: string;
    stack_keys?: string[];
    line_data?: any;
    config?: {
        drag_enabled?: boolean;
        resize_enabled?: boolean;
        add_columns_enabled?: boolean;
        width?: number;
        height?: number;
    };
}

/**
 * Represents the data structure stored in the dashboard's data JSONB field
 * Contains an array of charts and their configurations
 */
export interface IDashboardDataStructure {
    charts: IDashboardChart[];
}

/**
 * Represents the dashboard entity as returned by the API
 * This matches the backend DRADashboard entity structure
 */
export interface IDashboard {
    id: number;
    name?: string | null;
    data: IDashboardDataStructure;
    project: IProject;
    project_id?: number; // May not be serialized by TypeORM
    users_platform: IUsersPlatform;
    user_platform_id?: number; // May not be serialized by TypeORM
    export_meta_data: IDashboardDataExportMetaData[];
    is_template?: boolean;
    source_template_id?: number | null;
}


