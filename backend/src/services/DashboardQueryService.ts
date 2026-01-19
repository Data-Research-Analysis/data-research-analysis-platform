import { DataSource } from 'typeorm';
import { DRADataModel } from '../models/DRADataModel.js';
import { PostgresDataSource } from '../datasources/PostgresDataSource.js';
import { MySQLDataSource } from '../datasources/MySQLDataSource.js';
import { MariaDBDataSource } from '../datasources/MariaDBDataSource.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import dotenv from 'dotenv';

dotenv.config();

export interface ChartQueryConfig {
    data_model_id: number;
    query: string;
    query_params?: Record<string, any>;
}

export interface ChartQueryResult {
    columns: string[];
    rows: any[];
    rowCount: number;
    executionTimeMs: number;
}

/**
 * Service for executing dynamic queries on data models for dashboards
 * Replaces static cached data with real-time query execution
 */
export class DashboardQueryService {
    private static instance: DashboardQueryService;

    private constructor() {}

    public static getInstance(): DashboardQueryService {
        if (!DashboardQueryService.instance) {
            DashboardQueryService.instance = new DashboardQueryService();
        }
        return DashboardQueryService.instance;
    }

    /**
     * Get the application data source
     */
    private getAppDataSource(): DataSource {
        const host = process.env.POSTGRESQL_HOST || 'localhost';
        const port = parseInt(process.env.POSTGRESQL_PORT || '5432');
        const database = process.env.POSTGRESQL_DB_NAME || 'postgres_dra_db';
        const username = process.env.POSTGRESQL_USERNAME || 'postgres';
        const password = process.env.POSTGRESQL_PASSWORD || 'password';
        return PostgresDataSource.getInstance().getDataSource(host, port, database, username, password);
    }

    /**
     * Execute a query on a data model and return formatted results
     * @param dataModelId - ID of the data model to query
     * @param query - SQL SELECT query to execute (validated for safety)
     * @param queryParams - Optional parameters for parameterized queries
     */
    public async executeChartQuery(
        dataModelId: number,
        query: string,
        queryParams?: Record<string, any>
    ): Promise<ChartQueryResult> {
        const startTime = Date.now();

        try {
            // Validate query safety
            this.validateQuery(query);

            // Get data model
            const appDataSource = this.getAppDataSource();
            if (!appDataSource.isInitialized) {
                await appDataSource.initialize();
            }

            const dataModel = await appDataSource
                .getRepository(DRADataModel)
                .findOne({
                    where: { id: dataModelId },
                    relations: ['data_source']
                });

            if (!dataModel) {
                throw new Error(`Data model with ID ${dataModelId} not found`);
            }

            // Get data source connection for the model
            const dataSourceConnection = await this.getDataSourceConnection(dataModel);

            if (!dataSourceConnection.isInitialized) {
                await dataSourceConnection.initialize();
            }

            // Execute query with timeout protection
            const queryRunner = dataSourceConnection.createQueryRunner();
            
            try {
                // Set statement timeout (30 seconds)
                await queryRunner.query('SET statement_timeout = 30000');

                // Execute the query
                const rawResult = await queryRunner.query(query, queryParams ? Object.values(queryParams) : []);

                // Format results
                const columns = rawResult.length > 0 ? Object.keys(rawResult[0]) : [];
                const rows = rawResult;

                const executionTimeMs = Date.now() - startTime;

                console.log(`[DashboardQueryService] Query executed in ${executionTimeMs}ms, returned ${rows.length} rows`);

                return {
                    columns,
                    rows,
                    rowCount: rows.length,
                    executionTimeMs
                };

            } finally {
                await queryRunner.release();
            }

        } catch (error: any) {
            const executionTimeMs = Date.now() - startTime;
            console.error(`[DashboardQueryService] Query failed after ${executionTimeMs}ms:`, error.message);
            throw new Error(`Query execution failed: ${error.message}`);
        }
    }

    /**
     * Get a data source connection for a specific data model
     */
    private async getDataSourceConnection(dataModel: DRADataModel): Promise<DataSource> {
        const dataSource = dataModel.data_source;
        
        if (!dataSource) {
            throw new Error('Data model has no associated data source');
        }

        const connectionDetails = dataSource.connection_details;

        switch (dataSource.type) {
            case EDataSourceType.POSTGRESQL:
                return PostgresDataSource.getInstance().getDataSource(
                    connectionDetails.host,
                    connectionDetails.port,
                    connectionDetails.database_name,
                    connectionDetails.username,
                    connectionDetails.password
                );

            case EDataSourceType.MYSQL:
                return MySQLDataSource.getInstance().getDataSource(
                    connectionDetails.host,
                    connectionDetails.port,
                    connectionDetails.database_name,
                    connectionDetails.username,
                    connectionDetails.password
                );

            case EDataSourceType.MARIADB:
                return MariaDBDataSource.getInstance().getDataSource(
                    connectionDetails.host,
                    connectionDetails.port,
                    connectionDetails.database_name,
                    connectionDetails.username,
                    connectionDetails.password
                );

            default:
                throw new Error(`Unsupported data source type: ${dataSource.type}`);
        }
    }

    /**
     * Validate query for safety (prevent SQL injection, DML operations)
     */
    private validateQuery(query: string): void {
        const trimmedQuery = query.trim().toUpperCase();

        // Must be a SELECT query
        if (!trimmedQuery.startsWith('SELECT')) {
            throw new Error('Only SELECT queries are allowed');
        }

        // Blacklist dangerous keywords
        const dangerousKeywords = [
            'DROP', 'DELETE', 'INSERT', 'UPDATE', 'ALTER', 'CREATE',
            'TRUNCATE', 'GRANT', 'REVOKE', 'EXECUTE', 'EXEC',
            'DECLARE', 'CURSOR', 'CALL', 'INTO'
        ];

        for (const keyword of dangerousKeywords) {
            // Use word boundaries to avoid false positives (e.g., "SELECTED")
            const regex = new RegExp(`\\b${keyword}\\b`, 'i');
            if (regex.test(query)) {
                throw new Error(`Dangerous keyword detected: ${keyword}`);
            }
        }

        // Check for potential command injection
        if (query.includes(';') && !query.trim().endsWith(';')) {
            throw new Error('Multiple statements are not allowed');
        }

        // Validate query length (prevent DoS)
        if (query.length > 10000) {
            throw new Error('Query too long (max 10000 characters)');
        }
    }

    /**
     * Build a default query for a data model
     * Returns all columns with LIMIT clause
     */
    public buildDefaultQuery(dataModel: DRADataModel, limit: number = 1000): string {
        const schemaName = dataModel.data_source_schema;
        const tableName = dataModel.physical_table_name;

        return `SELECT * FROM "${schemaName}"."${tableName}" LIMIT ${limit}`;
    }
}
