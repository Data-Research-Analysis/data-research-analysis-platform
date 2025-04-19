export interface IDataModelColumn {
    id: number;
    name: string;
    cardinality: string;
    local_data_model_id: number;
    foreign_data_model_id: number;
    local_column_id: number;
    foreign_column_id: number;
    user_platform_id: number;
}