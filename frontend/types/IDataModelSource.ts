import type { IDataSource } from "./IDataSource";

export interface IDataModelSource {
    id: number;
    data_model_id: number;
    data_source_id: number;
    data_source: IDataSource;
    created_at: string;
}
