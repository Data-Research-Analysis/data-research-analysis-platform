import type { IColumn } from "./IColumn";
import type { IDashboardData } from "./IDashboardData";
import type { IDashboardDataExportMetaData } from "./IDashboardDataExportMetaData";
import type { IDimension } from "./IDimension";
import type { ILocation } from "./ILocation";
import type { IProject } from "./IProject";
import type { IUsersPlatform } from "./IUsersPlatform";

export interface IDashboard {
    chartId: number;
    chartType: string;
    columns: IColumn[];
    data: IDashboardData[];
    dimensions: IDimension;
    location: ILocation;
    export_meta_data: IDashboardDataExportMetaData[];
    project: IProject;
    user_platform: IUsersPlatform;
}