import { EDataSourceType } from "./EDataSourceType.js";
import { IAPIConnectionDetails } from "./IAPIConnectionDetails.js";

export interface IDBConnectionDetails {
    data_source_type: EDataSourceType;
    host: string;
    port: number;
    schema: string;
    database: string;
    username: string;
    password: string;
    
    // Optional: MongoDB connection string (e.g., mongodb+srv://...)
    connection_string?: string;
    
    // Optional: For API-based sources that store data in database (e.g., Google Analytics)
    api_connection_details?: IAPIConnectionDetails;
}

// Use IDBConnectionDetails for all connection types
export type IConnectionDetails = IDBConnectionDetails;