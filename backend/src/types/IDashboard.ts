import { IColumn } from "./IColumn.js";
import { IDashboardData } from "./IDashboardData.js";
import { IDimension } from "./IDimension.js";
import { ILocation } from "./ILocation.js";

export interface IDashboard {
    chartId: number;
    chartType: string;
    columns: IColumn[];
    data: IDashboardData[];
    dimensions: IDimension;
    location: ILocation;
}