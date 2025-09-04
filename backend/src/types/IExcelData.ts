import { IExcelColumn } from "./IExcelColumn.js";

export interface IExcelData {
    columns: Array<IExcelColumn>;
    file_name: string;
}