/**
 * Mock Manager for testing DataSourceProcessor
 * Provides mock database query functionality
 */

export interface MockMetadataRecord {
    physical_table_name: string;
    schema_name: string;
    data_source_id: number;
    original_table_name?: string;
    logical_table_name?: string;
    table_type?: string;
}

export interface MockDataSourceRecord {
    id: number;
    data_type: string;
    connection_details: any;
}

export class MockManager {
    private metadata: MockMetadataRecord[] = [];
    private dataSources: MockDataSourceRecord[] = [];
    private users: any[] = [];
    
    constructor() {
        this.setupDefaultData();
    }
    
    private setupDefaultData() {
        // Add default user
        this.users = [{ id: 1, email: 'test@example.com' }];
    }
    
    /**
     * Add mock metadata records
     */
    addMetadata(records: MockMetadataRecord[]) {
        this.metadata.push(...records);
    }
    
    /**
     * Add mock data source records
     */
    addDataSources(sources: MockDataSourceRecord[]) {
        this.dataSources.push(...sources);
    }
    
    /**
     * Mock query method
     */
    async query(sql: string, params?: any[]): Promise<any[]> {
        // Handle metadata queries
        if (sql.includes('dra_table_metadata')) {
            return this.queryMetadata(sql, params);
        }
        
        // Handle data source queries
        if (sql.includes('dra_data_source')) {
            return this.queryDataSources(sql, params);
        }
        
        return [];
    }
    
    /**
     * Query metadata based on SQL and params
     */
    private queryMetadata(sql: string, params?: any[]): MockMetadataRecord[] {
        if (!params || params.length === 0) {
            return this.metadata;
        }
        
        let results = this.metadata;
        
        // Filter by data_source_id (first param)
        if (params[0] !== undefined) {
            results = results.filter(m => m.data_source_id === params[0]);
        }
        
        // Filter by original_table_name (second param)
        if (params[1] !== undefined) {
            results = results.filter(m => m.original_table_name === params[1]);
        }
        
        // Handle LIKE pattern matching
        if (sql.includes('LIKE')) {
            if (params[2] !== undefined) {
                const pattern = params[2].replace(/%/g, '.*');
                const regex = new RegExp(pattern);
                results = results.filter(m => regex.test(m.physical_table_name));
            }
        }
        
        return results;
    }
    
    /**
     * Query data sources
     */
    private queryDataSources(sql: string, params?: any[]): MockDataSourceRecord[] {
        if (!params || params.length === 0) {
            return this.dataSources;
        }
        
        // Filter by id (first param)
        if (params[0] !== undefined) {
            return this.dataSources.filter(ds => ds.id === params[0]);
        }
        
        return this.dataSources;
    }
    
    /**
     * Mock findOne method
     */
    async findOne(entity: any, options: any): Promise<any> {
        // Return default user for DRAUsersPlatform
        if (options.where?.id === 1) {
            return this.users[0];
        }
        
        // Return data source
        if (options.where?.id && this.dataSources.length > 0) {
            return this.dataSources.find(ds => ds.id === options.where.id);
        }
        
        return null;
    }
    
    /**
     * Mock save method
     */
    async save(entity: any): Promise<any> {
        return { ...entity, id: Math.floor(Math.random() * 1000) };
    }
    
    /**
     * Clear all mock data
     */
    clear() {
        this.metadata = [];
        this.dataSources = [];
        this.setupDefaultData();
    }
}

/**
 * Create a new mock manager instance
 */
export const createMockManager = (): MockManager => {
    return new MockManager();
};
