import { IColumn } from "./IColumn.js";
import { IDashboardData } from "./IDashboardData.js";
import { IDimension } from "./IDimension.js";
import { ILocation } from "./ILocation.js";

/**
 * Represents a single chart within a dashboard
 */
export interface IDashboardChart {
    chart_id: number;
    chart_type: string;
    columns: IColumn[];
    data: IDashboardData[] | any[]; // Can be various data formats depending on chart type
    dimensions: IDimension;
    location: ILocation;
    x_axis_label?: string;
    y_axis_label?: string;
    stack_keys?: string[];
    line_data?: any;
}

/**
 * Represents the data structure stored in the dashboard's data JSONB field
 * Contains an array of charts and their configurations
 */
export interface IDashboardDataStructure {
    charts: IDashboardChart[];
}

// For backward compatibility during transition
export type IDashboard = IDashboardDataStructure;