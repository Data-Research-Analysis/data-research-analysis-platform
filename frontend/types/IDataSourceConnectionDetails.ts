export interface IDataSourceConnectionDetails {
    host: string;
    port: number;
    schema: string;
    database: string;
    user: string;
    password: string;
    ssl: boolean;
    ssl_mode: string;
}