import type { IAPIConnectionDetails } from './IGoogleAnalytics';

/**
 * Database Connection Details
 * For traditional database connections (PostgreSQL, MySQL, etc.)
 */
export interface IDBConnectionDetails {
    host: string;
    port: number;
    schema: string;
    database: string;
    user: string;
    password: string;
}

/**
 * Union type supporting both database and API connections
 */
export type IDataSourceConnectionDetails = IDBConnectionDetails | IAPIConnectionDetails;