import { IAPIConnectionDetails } from "../types/IAPIConnectionDetails.js";

/**
 * Interface for API-based data source drivers
 * Used for Google Analytics, Google Ads, and other API connectors
 */
export interface IAPIDriver {
    /**
     * Authenticate with the API using OAuth credentials
     * @param connectionDetails - API connection details with OAuth tokens
     * @returns True if authentication successful
     */
    authenticate(connectionDetails: IAPIConnectionDetails): Promise<boolean>;
    
    /**
     * Fetch data from the API and sync to internal PostgreSQL tables
     * @param dataSourceId - ID of the data source
     * @param connectionDetails - API connection details
     * @returns True if sync successful
     */
    syncToDatabase(dataSourceId: number, connectionDetails: IAPIConnectionDetails): Promise<boolean>;
    
    /**
     * Get schema metadata for the API data source  
     * Returns table/column structure that matches synced data in PostgreSQL
     * @param dataSourceId - ID of the data source
     * @param connectionDetails - API connection details
     * @returns Schema metadata
     */
    getSchema(dataSourceId: number, connectionDetails: IAPIConnectionDetails): Promise<any>;
    
    /**
     * Get last sync timestamp
     * @param dataSourceId - ID of the data source
     * @returns Last sync date or null
     */
    getLastSyncTime(dataSourceId: number): Promise<Date | null>;
    
    /**
     * Get sync history for a data source
     * @param dataSourceId - ID of the data source
     * @param limit - Maximum number of history records to return
     * @returns Array of sync history records
     */
    getSyncHistory(dataSourceId: number, limit?: number): Promise<any[]>;
}
