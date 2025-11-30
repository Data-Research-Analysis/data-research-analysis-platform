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
