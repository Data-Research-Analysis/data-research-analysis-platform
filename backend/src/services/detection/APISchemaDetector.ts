/**
 * API Schema Detector
 *
 * Detects and classifies schema from API-connected data sources
 * (Google Analytics, Google Ads, Meta Ads, HubSpot, LinkedIn Ads, Klaviyo, etc.)
 *
 * API sources sync data into PostgreSQL schemas (e.g., dra_google_analytics).
 * This detector uses DatabaseSchemaDetector to detect schema from those synced tables.
 * It also supports direct schema metadata from API drivers' getSchema() methods.
 */

import { DBDriver } from "../../drivers/DBDriver.js";
import { EDataSourceType } from "../../types/EDataSourceType.js";
import { DatabaseSchemaDetector } from "./DatabaseSchemaDetector.js";
import { MarketingKPIMatcher } from "./MarketingKPIMatcher.js";
import {
    ISchemaDetectionResult,
    IDetectedTable,
    IDetectedColumn,
    IDetectedForeignKey,
    TableClassification,
} from "./ISchemaDetectionResult.js";

/** Schema name mapping for API source types */
const API_SCHEMA_MAP: Record<string, string> = {
    google_analytics: "dra_google_analytics",
    google_ads: "dra_google_ads",
    meta_ads: "dra_meta_ads",
    linkedin_ads: "dra_linkedin_ads",
    hubspot: "dra_hubspot",
    klaviyo: "dra_klaviyo",
    google_ad_manager: "dra_google_ad_manager",
};

export class APISchemaDetector {
    private static instance: APISchemaDetector;
    private dbDetector: DatabaseSchemaDetector;
    private matcher: MarketingKPIMatcher;

    private constructor() {
        this.dbDetector = DatabaseSchemaDetector.getInstance();
        this.matcher = MarketingKPIMatcher.getInstance();
    }

    public static getInstance(): APISchemaDetector {
        if (!APISchemaDetector.instance) {
            APISchemaDetector.instance = new APISchemaDetector();
        }
        return APISchemaDetector.instance;
    }

    /**
     * Detect schema from an API data source that has already synced data to PostgreSQL
     *
     * @param sourceType - The API source type (e.g., 'google_analytics', 'meta_ads')
     * @param dataSourceId - The data source ID
     * @param schemaName - Optional override for the schema name
     * @returns Schema detection result with marketing classifications
     */
    public async detectFromSyncedData(
        sourceType: string,
        dataSourceId: number,
        schemaName?: string
    ): Promise<ISchemaDetectionResult> {
        const schema = schemaName || API_SCHEMA_MAP[sourceType];

        if (!schema) {
            return this.buildEmptyResult(
                dataSourceId,
                sourceType,
                `Unknown API source type: ${sourceType}. No schema mapping found.`
            );
        }

        try {
            // Get the internal PostgreSQL connection
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return this.buildEmptyResult(
                    dataSourceId,
                    sourceType,
                    "Internal database driver not available"
                );
            }

            const dbConnector = await driver.getConcreteDriver();
            const dataSource = dbConnector as any; // TypeORM DataSource

            // Verify schema exists before querying
            const schemaExists = await this.checkSchemaExists(dataSource, schema);
            if (!schemaExists) {
                return this.buildEmptyResult(
                    dataSourceId,
                    sourceType,
                    `Schema "${schema}" does not exist yet. Data may not have been synced.`
                );
            }

            // Use DatabaseSchemaDetector with the specific API schema
            const result = await this.dbDetector.detect(
                dataSource,
                sourceType,
                schema,
                dataSourceId
            );

            // Add API-specific context to notes
            for (const table of result.tables) {
                table.notes = table.notes || [];
                table.notes.push(`API source: ${sourceType}`);
                table.notes.push(`Synced schema: ${schema}`);
            }

            return result;
        } catch (err: any) {
            return this.buildEmptyResult(
                dataSourceId,
                sourceType,
                `API schema detection failed: ${err.message}`
            );
        }
    }

    /**
     * Detect schema from API driver schema metadata
     * For drivers that provide their own schema definition (e.g., getSchema())
     *
     * @param driverSchema - The schema metadata from the API driver
     * @param sourceType - The API source type
     * @param dataSourceId - The data source ID
     * @returns Schema detection result
     */
    public detectFromDriverSchema(
        driverSchema: any,
        sourceType: string,
        dataSourceId: number
    ): ISchemaDetectionResult {
        const errors: string[] = [];
        const detectedTables: IDetectedTable[] = [];

        try {
            if (!driverSchema) {
                return this.buildEmptyResult(dataSourceId, sourceType, "No schema data from driver");
            }

            // Handle different schema formats from various drivers
            if (Array.isArray(driverSchema)) {
                // Array of table definitions
                for (const tableDef of driverSchema) {
                    try {
                        const table = this.classifyAPITable(tableDef, sourceType);
                        detectedTables.push(table);
                    } catch (err: any) {
                        errors.push(`Table ${tableDef.name || tableDef.table_name}: ${err.message}`);
                    }
                }
            } else if (driverSchema.tables && Array.isArray(driverSchema.tables)) {
                // Object with tables array
                for (const tableDef of driverSchema.tables) {
                    try {
                        const table = this.classifyAPITable(tableDef, sourceType);
                        detectedTables.push(table);
                    } catch (err: any) {
                        errors.push(`Table ${tableDef.name || tableDef.table_name}: ${err.message}`);
                    }
                }
            } else if (typeof driverSchema === "object") {
                // Single table or key-value schema
                for (const [tableName, columns] of Object.entries(driverSchema)) {
                    try {
                        const table = this.classifyAPITable(
                            { name: tableName, columns },
                            sourceType
                        );
                        detectedTables.push(table);
                    } catch (err: any) {
                        errors.push(`Table ${tableName}: ${err.message}`);
                    }
                }
            }
        } catch (err: any) {
            errors.push(`Driver schema parsing failed: ${err.message}`);
        }

        return this.buildResult(dataSourceId, sourceType, detectedTables, errors);
    }

    /**
     * Get the schema name for an API source type
     */
    public getSchemaName(sourceType: string): string | null {
        return API_SCHEMA_MAP[sourceType] || null;
    }

    /**
     * Check if a PostgreSQL schema exists
     */
    private async checkSchemaExists(dataSource: any, schemaName: string): Promise<boolean> {
        try {
            const result = await dataSource.query(
                "SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1",
                [schemaName]
            );
            return result.length > 0;
        } catch {
            return false;
        }
    }

    /**
     * Classify a table from API driver schema metadata
     */
    private classifyAPITable(
        tableDef: any,
        sourceType: string
    ): IDetectedTable {
        const tableName = tableDef.name || tableDef.table_name || "unknown";
        const rawColumns = tableDef.columns || [];

        const columns: IDetectedColumn[] = rawColumns.map((col: any) => {
            const columnName = col.name || col.column_name || col.field_name || "unknown";
            const nativeType = col.type || col.data_type || "varchar";

            const classification = this.matcher.classifyColumn(columnName, nativeType);

            return {
                column_name: columnName,
                native_type: nativeType,
                detected_type: classification.detected_type,
                role: classification.role,
                kpi_match: classification.kpi_match,
                dimension_match: classification.dimension_match,
                is_nullable: col.is_nullable !== false,
                is_primary_key: col.is_primary_key === true,
                column_default: col.column_default ?? null,
                max_length: col.max_length ?? col.character_maximum_length ?? null,
                confidence: classification.confidence,
            };
        });

        const factColumns = columns.filter((c) => c.role === "fact");
        const dimensionColumns = columns.filter((c) => c.role === "dimension");
        const timeColumns = columns.filter((c) => c.role === "time");

        const classification = this.classifyTableType(
            factColumns.length,
            dimensionColumns.length,
            timeColumns.length,
            columns.length
        );

        const notes: string[] = [];
        notes.push(`API source: ${sourceType}`);
        notes.push(`Schema from driver metadata`);

        return {
            table_name: tableName,
            original_name: null,
            schema_name: API_SCHEMA_MAP[sourceType] || null,
            classification,
            columns,
            primary_keys: [],
            foreign_keys: [],
            row_count_estimate: null,
            fact_column_count: factColumns.length,
            dimension_column_count: dimensionColumns.length,
            time_column_count: timeColumns.length,
            notes,
        };
    }

    /**
     * Determine table classification
     */
    private classifyTableType(
        factCount: number,
        dimensionCount: number,
        timeCount: number,
        totalColumns: number
    ): TableClassification {
        if (totalColumns === 0) return "unknown";

        const factRatio = factCount / totalColumns;
        const dimensionRatio = dimensionCount / totalColumns;

        if (factCount > 0 && factRatio >= 0.3 && timeCount > 0) return "fact_table";
        if (dimensionCount > 0 && dimensionRatio >= 0.5 && factCount <= 1) return "dimension_table";
        if (factCount > 0 && dimensionCount > 0) return "mixed";

        return "unknown";
    }

    /**
     * Build an empty result with an error message
     */
    private buildEmptyResult(
        dataSourceId: number,
        sourceType: string,
        errorMessage: string
    ): ISchemaDetectionResult {
        return this.buildResult(dataSourceId, sourceType, [], [errorMessage]);
    }

    /**
     * Build the final result with summary statistics
     */
    private buildResult(
        dataSourceId: number,
        sourceType: string,
        tables: IDetectedTable[],
        errors: string[]
    ): ISchemaDetectionResult {
        let totalColumns = 0;
        let totalKpiColumns = 0;
        let totalDimensionColumns = 0;
        let totalTimeColumns = 0;
        let factTables = 0;
        let dimensionTables = 0;

        for (const table of tables) {
            totalColumns += table.columns.length;
            totalKpiColumns += table.fact_column_count;
            totalDimensionColumns += table.dimension_column_count;
            totalTimeColumns += table.time_column_count;

            if (table.classification === "fact_table") factTables++;
            if (table.classification === "dimension_table") dimensionTables++;
        }

        return {
            data_source_id: dataSourceId,
            source_type: sourceType,
            tables,
            detected_at: new Date().toISOString(),
            errors,
            total_tables: tables.length,
            summary: {
                fact_tables: factTables,
                dimension_tables: dimensionTables,
                total_columns: totalColumns,
                total_kpi_columns: totalKpiColumns,
                total_dimension_columns: totalDimensionColumns,
                total_time_columns: totalTimeColumns,
            },
        };
    }
}