export interface IColumn {
    columnName: string;
    dataType: string;
    characterMaximumLength?: number;
    tableName: string;
    schema: string;
    aliasName: string;
}