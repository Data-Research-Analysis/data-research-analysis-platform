import { IAPIConnectionDetails } from '../types/IAPIConnectionDetails.js';

/**
 * Interface for API Drivers
 * Ensures consistent implementation of sync and status methods across different data sources
 */
export interface IAPIDriver {
    authenticate(connectionDetails: IAPIConnectionDetails): Promise<boolean>;
    syncToDatabase(dataSourceId: number, usersPlatformId: number, connectionDetails: IAPIConnectionDetails): Promise<boolean>;
    
    // Required metadata and status methods
    getSchema(dataSourceId: number, connectionDetails: IAPIConnectionDetails): Promise<any>;
    getLastSyncTime(dataSourceId: number): Promise<Date | null>;
    getSyncHistory(dataSourceId: number, limit?: number): Promise<any[]>;
}