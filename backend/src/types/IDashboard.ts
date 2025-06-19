import { IColumn } from "./IColumn";
import { IDashboardData } from "./IDashboardData";
import { IDimension } from "./IDimension";
import { ILocation } from "./ILocation";

export interface IDashboard {
    chartId: number;
    chartType: string;
    columns: IColumn[];
    data: IDashboardData[];
    dimensions: IDimension;
    location: ILocation;
}