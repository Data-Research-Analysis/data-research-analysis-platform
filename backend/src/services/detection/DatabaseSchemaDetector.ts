/**
 * Database Schema Detector (CONN-005)
 *
 * Detects and classifies schema from database sources (PostgreSQL, MySQL, MariaDB, MongoDB).
 * Wraps the existing SchemaCollectorService to get raw schema, then enriches with
 * marketing KPI classification via MarketingKPIMatcher.
 */

import { DataSource } from "typeorm";
import { SchemaCollectorService } from "../SchemaCollectorService.js";
import { MarketingKPIMatcher } from "./MarketingKPIMatcher.js";
import {
    ISchemaDetectionResult,
    IDetectedTable,
    IDetectedColumn,
    IDetectedForeignKey,
    TableClassification,
} from "./ISchemaDetectionResult.js";

export class DatabaseSchemaDetector {
    private static instance: DatabaseSchemaDetector;
    private schemaCollector: SchemaCollectorService;
    private matcher: MarketingKPIMatcher;

    private constructor() {
        this.schemaCollector = new SchemaCollectorService();
        this.matcher = MarketingKPIMatcher.getInstance();
    }

    public static getInstance(): DatabaseSchemaDetector {
        if (!DatabaseSchemaDetector.instance) {
            DatabaseSchemaDetector.instance = new DatabaseSchemaDetector();
        }
        return DatabaseSchemaDetector.instance;
    }

    /**
     * Detect schema from a live database connection
     *
     * @param dataSource - TypeORM DataSource already connected to the target database
     * @param sourceType - The data source type string (e.g. 'postgresql', 'mysql', 'mongodb')
     * @param schemaName - Optional schema name override
     * @param dataSourceId - Optional data source ID for result metadata
     * @returns Structured schema detection result with marketing classifications
     */
    public async detect(
        dataSource: DataSource,
        sourceType: string,
        schemaName?: string,
        dataSourceId?: number | null
    ): Promise<ISchemaDetectionResult> {
        const errors: string[] = [];

        try {
            // Use existing SchemaCollectorService to collect raw schema
            const rawTables = await this.schemaCollector.collectSchema(dataSource, schemaName);

            const detectedTables: IDetectedTable[] = [];

            for (const rawTable of rawTables) {
                try {
                    const detectedTable = this.classifyTable(
                        rawTable.tableName,
                        rawTable.schema,
                        rawTable.columns.map((col: any) => ({
                            column_name: col.column_name,
                            data_type: col.data_type || "unknown",
                            is_nullable: col.is_nullable || "YES",
                            column_default: col.column_default ?? null,
                            character_maximum_length: col.character_maximum_length ?? null,
                        })),
                        rawTable.primaryKeys,
                        rawTable.foreignKeys.map((fk: any) => ({
                            constraint_name: fk.constraint_name || "",
                            table_name: fk.table_name || rawTable.tableName,
                            column_name: fk.column_name || "",
                            foreign_table_name: fk.foreign_table_name || "",
                            foreign_column_name: fk.foreign_column_name || "",
                        }))
                    );
                    detectedTables.push(detectedTable);
                } catch (err: any) {
                    errors.push(`Table ${rawTable.tableName}: ${err.message}`);
                }
            }

            return this.buildResult(dataSourceId ?? null, sourceType, detectedTables, errors);
        } catch (err: any) {
            errors.push(`Schema collection failed: ${err.message}`);
            return this.buildResult(dataSourceId ?? null, sourceType, [], errors);
        }
    }

    /**
     * Estimate row counts for detected tables by running COUNT(*) queries.
     * Updates each table's row_count_estimate in place.
     *
     * @param dataSource - TypeORM DataSource connected to the target database
     * @param tables - Array of detected tables to enrich with row counts
     * @param schemaName - The schema to count rows in
     */
    public async detectRowEstimates(
        dataSource: DataSource,
        tables: IDetectedTable[],
        schemaName: string
    ): Promise<void> {
        for (const table of tables) {
            try {
                const schema = table.schema_name || schemaName;
                const quotedTable = `"${schema}"."${table.table_name}"`;
                const result = await dataSource.query(`SELECT COUNT(*) AS cnt FROM ${quotedTable}`);
                const count = parseInt(result[0]?.cnt ?? result[0]?.COUNT ?? "0", 10);
                table.row_count_estimate = isNaN(count) ? null : count;
            } catch (err: any) {
                // Row estimation is best-effort; leave as null on failure
                table.row_count_estimate = null;
                table.notes.push(`Row count estimation failed: ${err.message}`);
            }
        }
    }

    /**
     * Classify a single table and its columns with marketing metadata
     */
    private classifyTable(
        tableName: string,
        schemaName: string | null,
        rawColumns: Array<{
            column_name: string;
            data_type: string;
            is_nullable: string;
            column_default: string | null;
            character_maximum_length: number | null;
        }>,
        primaryKeys: string[],
        foreignKeys: IDetectedForeignKey[]
    ): IDetectedTable {
        const pkSet = new Set(primaryKeys.map((pk) => pk.toLowerCase()));

        const columns: IDetectedColumn[] = rawColumns.map((col) => {
            const classification = this.matcher.classifyColumn(
                col.column_name,
                col.data_type
            );

            return {
                column_name: col.column_name,
                native_type: col.data_type,
                detected_type: classification.detected_type,
                role: classification.role,
                kpi_match: classification.kpi_match,
                dimension_match: classification.dimension_match,
                is_nullable: col.is_nullable === "YES",
                is_primary_key: pkSet.has(col.column_name.toLowerCase()),
                column_default: col.column_default,
                max_length: col.character_maximum_length,
                confidence: classification.confidence,
            };
        });

        const factColumns = columns.filter((c) => c.role === "fact");
        const dimensionColumns = columns.filter((c) => c.role === "dimension");
        const timeColumns = columns.filter((c) => c.role === "time");

        // Classify the table based on its column composition
        const classification = this.classifyTableType(
            factColumns.length,
            dimensionColumns.length,
            timeColumns.length,
            columns.length
        );

        const notes: string[] = [];
        if (columns.length === 0) {
            notes.push("Table has no columns detected");
        }
        if (factColumns.length === 0 && dimensionColumns.length === 0) {
            notes.push("No marketing KPI or dimension columns detected");
        }

        return {
            table_name: tableName,
            original_name: null,
            schema_name: schemaName,
            classification,
            columns,
            primary_keys: primaryKeys,
            foreign_keys: foreignKeys,
            row_count_estimate: null,
            fact_column_count: factColumns.length,
            dimension_column_count: dimensionColumns.length,
            time_column_count: timeColumns.length,
            notes,
        };
    }

    /**
     * Determine table classification based on column role distribution
     */
    private classifyTableType(
        factCount: number,
        dimensionCount: number,
        timeCount: number,
        totalColumns: number
    ): TableClassification {
        if (totalColumns === 0) {
            return "unknown";
        }

        // A table with many fact columns relative to dimensions is a fact table
        const factRatio = factCount / totalColumns;
        const dimensionRatio = dimensionCount / totalColumns;

        if (factCount > 0 && factRatio >= 0.3 && timeCount > 0) {
            return "fact_table";
        }

        if (dimensionCount > 0 && dimensionRatio >= 0.5 && factCount <= 1) {
            return "dimension_table";
        }

        if (factCount > 0 && dimensionCount > 0) {
            return "mixed";
        }

        return "unknown";
    }

    /**
     * Build the final result object with summary statistics
     */
    private buildResult(
        dataSourceId: number | null,
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