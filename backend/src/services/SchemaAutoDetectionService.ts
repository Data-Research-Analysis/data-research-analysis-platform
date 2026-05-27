/**
 * Schema Auto-Detection Service (CONN-005)
 *
 * Orchestrates schema detection across all data source types.
 * Delegates to specialized detectors based on source type:
 *   - DatabaseSchemaDetector: PostgreSQL, MySQL, MariaDB
 *   - FileSchemaDetector: Excel, CSV, PDF
 *   - APISchemaDetector: Google Analytics, Google Ads, Meta Ads, HubSpot, etc.
 *
 * Integrates with the existing DataSourceProcessor and QueryEngineProcessor
 * to use the same DB connection methods.
 */

import { DBDriver } from "../drivers/DBDriver.js";
import { EDataSourceType } from "../types/EDataSourceType.js";
import { DatabaseSchemaDetector } from "./detection/DatabaseSchemaDetector.js";
import { FileSchemaDetector } from "./detection/FileSchemaDetector.js";
import { APISchemaDetector } from "./detection/APISchemaDetector.js";
import {
    ISchemaDetectionResult,
    ISchemaDetectionRequest,
    ISchemaDetectionBatchRequest,
    ISchemaDetectionBatchResult,
} from "./detection/ISchemaDetectionResult.js";

/** Source types that are database-based */
const DATABASE_SOURCE_TYPES: string[] = [
    EDataSourceType.POSTGRESQL,
    EDataSourceType.MYSQL,
    EDataSourceType.MARIADB,
];

/** Source types that are file-based (data stored in internal PostgreSQL) */
const FILE_SOURCE_TYPES: string[] = [
    EDataSourceType.EXCEL,
    EDataSourceType.CSV,
    EDataSourceType.PDF,
];

/** Source types that are API-based (data synced to internal PostgreSQL schemas) */
const API_SOURCE_TYPES: string[] = [
    EDataSourceType.GOOGLE_ANALYTICS,
    EDataSourceType.GOOGLE_ADS,
    EDataSourceType.META_ADS,
    EDataSourceType.LINKEDIN_ADS,
    EDataSourceType.HUBSPOT,
    EDataSourceType.KLAVIYO,
    EDataSourceType.GOOGLE_AD_MANAGER,
];

export class SchemaAutoDetectionService {
    private static instance: SchemaAutoDetectionService;
    private dbDetector: DatabaseSchemaDetector;
    private fileDetector: FileSchemaDetector;
    private apiDetector: APISchemaDetector;

    private constructor() {
        this.dbDetector = DatabaseSchemaDetector.getInstance();
        this.fileDetector = FileSchemaDetector.getInstance();
        this.apiDetector = APISchemaDetector.getInstance();
    }

    public static getInstance(): SchemaAutoDetectionService {
        if (!SchemaAutoDetectionService.instance) {
            SchemaAutoDetectionService.instance = new SchemaAutoDetectionService();
        }
        return SchemaAutoDetectionService.instance;
    }

    /**
     * Detect schema for a single data source.
     * Automatically routes to the correct detector based on source type.
     *
     * @param request - Detection request with source type, ID, and optional overrides
     * @returns Schema detection result
     */
    public async detect(request: ISchemaDetectionRequest): Promise<ISchemaDetectionResult> {
        const { source_type, data_source_id, schema_name, include_row_estimates } = request;

        const normalizedType = source_type.toLowerCase();

        // Route to appropriate detector
        if (DATABASE_SOURCE_TYPES.includes(normalizedType)) {
            return this.detectDatabase(request);
        }

        if (FILE_SOURCE_TYPES.includes(normalizedType)) {
            return this.detectFile(request);
        }

        if (API_SOURCE_TYPES.includes(normalizedType)) {
            return this.detectAPI(request);
        }

        // MongoDB - detect from synced data (tables are created via MongoDBImportService)
        if (normalizedType === EDataSourceType.MONGODB) {
            return this.detectMongoDB(request);
        }

        // Unknown source type
        return {
            data_source_id,
            source_type: normalizedType,
            tables: [],
            detected_at: new Date().toISOString(),
            errors: [`Unsupported source type: ${normalizedType}`],
            total_tables: 0,
            summary: {
                fact_tables: 0,
                dimension_tables: 0,
                total_columns: 0,
                total_kpi_columns: 0,
                total_dimension_columns: 0,
                total_time_columns: 0,
            },
        };
    }

    /**
     * Detect schemas for multiple data sources in a single call.
     *
     * @param request - Batch detection request
     * @returns Array of detection results
     */
    public async detectBatch(request: ISchemaDetectionBatchRequest): Promise<ISchemaDetectionBatchResult> {
        const results: ISchemaDetectionResult[] = [];
        const errors: string[] = [];

        for (const dsRequest of request.data_sources) {
            try {
                const result = await this.detect(dsRequest);
                results.push(result);
                if (result.errors.length > 0) {
                    errors.push(...result.errors.map((e) => `[${dsRequest.data_source_id}] ${e}`));
                }
            } catch (err: any) {
                errors.push(`[${dsRequest.data_source_id}] Detection failed: ${err.message}`);
                results.push({
                    data_source_id: dsRequest.data_source_id,
                    source_type: dsRequest.source_type,
                    tables: [],
                    detected_at: new Date().toISOString(),
                    errors: [err.message],
                    total_tables: 0,
                    summary: {
                        fact_tables: 0,
                        dimension_tables: 0,
                        total_columns: 0,
                        total_kpi_columns: 0,
                        total_dimension_columns: 0,
                        total_time_columns: 0,
                    },
                });
            }
        }

        return { results, errors };
    }

    /**
     * Detect schema for a database source (PostgreSQL, MySQL, MariaDB).
     * Uses the DataSourceProcessor's connection approach to connect to the external DB.
     */
    private async detectDatabase(request: ISchemaDetectionRequest): Promise<ISchemaDetectionResult> {
        const { source_type, data_source_id, schema_name } = request;

        try {
            // Get the data source entity to obtain connection details
            const { DRADataSource } = await import("../models/DRADataSource.js");
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return this.buildErrorResult(data_source_id, source_type, "Internal database driver not available");
            }

            const dbConnector = await driver.getConcreteDriver();
            const manager = dbConnector.manager;

            const dataSource = await manager.findOne(DRADataSource, {
                where: { id: data_source_id },
            });

            if (!dataSource) {
                return this.buildErrorResult(data_source_id, source_type, `Data source ${data_source_id} not found`);
            }

            const connectionDetails = dataSource.connection_details as any;

            if (!connectionDetails) {
                return this.buildErrorResult(data_source_id, source_type, "No connection details found");
            }

            // Connect to the external database using QueryEngineProcessor's approach
            const externalDB = await this.connectToExternalDB(source_type, connectionDetails);
            if (!externalDB) {
                return this.buildErrorResult(data_source_id, source_type, "Failed to connect to external database");
            }

            try {
                const schema = schema_name || connectionDetails.schema || connectionDetails.database || "public";
                const result = await this.dbDetector.detect(externalDB, source_type, schema, data_source_id);

                // Apply row estimates if requested
                if (request.include_row_estimates) {
                    await this.dbDetector.detectRowEstimates(externalDB, result.tables, schema);
                }

                return result;
            } finally {
                // Always close the external connection
                await externalDB.destroy().catch(() => {});
            }
        } catch (err: any) {
            return this.buildErrorResult(data_source_id, source_type, `Database detection failed: ${err.message}`);
        }
    }

    /**
     * Detect schema for a file source (Excel, CSV, PDF).
     * Files are loaded into PostgreSQL schemas via ExcelDataSourceProcessor / PDFDataSourceProcessor.
     */
    private async detectFile(request: ISchemaDetectionRequest): Promise<ISchemaDetectionResult> {
        const { source_type, data_source_id } = request;

        try {
            // For file sources, the schema is stored in the internal PostgreSQL DB
            // The schema name follows the pattern: dra_ds_{data_source_id}
            const internalSchema = `dra_ds_${data_source_id}`;

            const result = await this.fileDetector.detect(data_source_id, source_type, internalSchema);

            // Apply row estimates if requested
            if (request.include_row_estimates) {
                try {
                    const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
                    if (driver) {
                        const dbConnector = await driver.getConcreteDriver();
                        const dataSource = dbConnector as any;
                        await this.dbDetector.detectRowEstimates(dataSource, result.tables, internalSchema);
                    }
                } catch (rowErr: any) {
                    result.errors.push(`Row estimation failed: ${rowErr.message}`);
                }
            }

            return result;
        } catch (err: any) {
            return this.buildErrorResult(data_source_id, source_type, `File detection failed: ${err.message}`);
        }
    }

    /**
     * Detect schema for an API source (Google Analytics, Meta Ads, etc.).
     * API sources sync data into internal PostgreSQL schemas (e.g., dra_google_analytics).
     */
    private async detectAPI(request: ISchemaDetectionRequest): Promise<ISchemaDetectionResult> {
        const { source_type, data_source_id, schema_name } = request;

        try {
            const result = await this.apiDetector.detectFromSyncedData(
                source_type,
                data_source_id,
                schema_name
            );

            // Apply row estimates if requested
            if (request.include_row_estimates) {
                try {
                    const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
                    if (driver) {
                        const dbConnector = await driver.getConcreteDriver();
                        const dataSource = dbConnector as any;
                        const schema = schema_name || this.apiDetector.getSchemaName(source_type);
                        if (schema) {
                            await this.dbDetector.detectRowEstimates(dataSource, result.tables, schema);
                        }
                    }
                } catch (rowErr: any) {
                    result.errors.push(`Row estimation failed: ${rowErr.message}`);
                }
            }

            return result;
        } catch (err: any) {
            return this.buildErrorResult(data_source_id, source_type, `API detection failed: ${err.message}`);
        }
    }

    /**
     * Detect schema for MongoDB source.
     * MongoDB data is synced to PostgreSQL tables via MongoDBImportService.
     * We detect from the internal dra_mongodb schema.
     */
    private async detectMongoDB(request: ISchemaDetectionRequest): Promise<ISchemaDetectionResult> {
        const { source_type, data_source_id } = request;

        try {
            // MongoDB data lands in the dra_mongodb schema via MongoDBImportService
            const result = await this.apiDetector.detectFromSyncedData(
                source_type,
                data_source_id,
                "dra_mongodb"
            );

            return result;
        } catch (err: any) {
            return this.buildErrorResult(data_source_id, source_type, `MongoDB detection failed: ${err.message}`);
        }
    }

    /**
     * Connect to an external database using the same approach as QueryEngineProcessor.
     *
     * @param sourceType - The database source type
     * @param connectionDetails - Connection details from the DRADataSource entity
     * @returns TypeORM DataSource for the external database
     */
    private async connectToExternalDB(
        sourceType: string,
        connectionDetails: any
    ): Promise<any> {
        try {
            const { DataSource } = await import("typeorm");

            const host = connectionDetails.host || "localhost";
            const port = connectionDetails.port || this.getDefaultPort(sourceType);
            const database = connectionDetails.database_name || connectionDetails.database || "";
            const username = connectionDetails.username || "";
            const password = connectionDetails.password || "";
            const schema = connectionDetails.schema || "public";

            let type: string;
            let extraOptions: any = {};

            switch (sourceType) {
                case EDataSourceType.POSTGRESQL:
                    type = "postgres";
                    break;
                case EDataSourceType.MYSQL:
                    type = "mysql";
                    break;
                case EDataSourceType.MARIADB:
                    type = "mariadb";
                    extraOptions = { charset: "utf8mb4" };
                    break;
                default:
                    throw new Error(`Unsupported database type: ${sourceType}`);
            }

            const ds = new DataSource({
                type: type as any,
                host,
                port: Number(port),
                database,
                username,
                password,
                schema,
                synchronize: false,
                logging: false,
                ...extraOptions,
            });

            await ds.initialize();
            return ds;
        } catch (err: any) {
            console.error(`[SchemaAutoDetection] Failed to connect to external ${sourceType}:`, err.message);
            return null;
        }
    }

    /**
     * Get default port for a database source type
     */
    private getDefaultPort(sourceType: string): number {
        switch (sourceType) {
            case EDataSourceType.POSTGRESQL:
                return 5432;
            case EDataSourceType.MYSQL:
                return 3306;
            case EDataSourceType.MARIADB:
                return 3306;
            default:
                return 5432;
        }
    }

    /**
     * Build an error result for failed detections
     */
    private buildErrorResult(
        dataSourceId: number,
        sourceType: string,
        errorMessage: string
    ): ISchemaDetectionResult {
        return {
            data_source_id: dataSourceId,
            source_type: sourceType,
            tables: [],
            detected_at: new Date().toISOString(),
            errors: [errorMessage],
            total_tables: 0,
            summary: {
                fact_tables: 0,
                dimension_tables: 0,
                total_columns: 0,
                total_kpi_columns: 0,
                total_dimension_columns: 0,
                total_time_columns: 0,
            },
        };
    }

    /**
     * Determine if a source type is supported for schema detection
     */
    public isSupported(sourceType: string): boolean {
        const normalized = sourceType.toLowerCase();
        return (
            DATABASE_SOURCE_TYPES.includes(normalized) ||
            FILE_SOURCE_TYPES.includes(normalized) ||
            API_SOURCE_TYPES.includes(normalized) ||
            normalized === EDataSourceType.MONGODB
        );
    }

    /**
     * Get the detection strategy for a source type (for debugging/logging)
     */
    public getDetectionStrategy(sourceType: string): string {
        const normalized = sourceType.toLowerCase();
        if (DATABASE_SOURCE_TYPES.includes(normalized)) return "database";
        if (FILE_SOURCE_TYPES.includes(normalized)) return "file";
        if (API_SOURCE_TYPES.includes(normalized)) return "api";
        if (normalized === EDataSourceType.MONGODB) return "mongodb";
        return "unsupported";
    }
}