export interface IMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

export interface ISchemaSummary {
    tableCount: number;
    totalColumns: number;
    totalForeignKeys: number;
    avgColumnsPerTable: number;
}

export interface ITableInfo {
    name: string;
    columnCount: number;
    hasTimestamps: boolean;
    foreignKeyReferences: string[];
}

export interface ISchemaDetails {
    tables: ITableInfo[];
}
