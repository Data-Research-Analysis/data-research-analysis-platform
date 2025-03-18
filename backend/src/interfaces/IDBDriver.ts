export interface IDBDriver {
    initialize(): Promise<void>;
    getConcreteDriver(): Promise<any>;
    query(query: string, params: any): Promise<any>;
    close(): Promise<void>;
}