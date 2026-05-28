/**
 * File Schema Detector — part of Schema Auto-Detection Service
 *
 * Detects and classifies schema from file uploads (Excel, CSV, PDF).
 * Uses the existing ExcelFileService / FileParserFactory to parse files,
 * then enriches with marketing KPI classification via MarketingKPIMatcher.
 */

import path from "path";
import { ExcelFileService } from "../ExcelFileService.js";
import { MarketingKPIMatcher } from "./MarketingKPIMatcher.js";
import {
    ISchemaDetectionResult,
    IDetectedTable,
    IDetectedColumn,
    IDetectedForeignKey,
    TableClassification,
} from "./ISchemaDetectionResult.js";

import { DBDriver } from "../../drivers/DBDriver.js";
import { EDataSourceType } from "../../types/EDataSourceType.js";

export class FileSchemaDetector {
    private static instance: FileSchemaDetector;
    private excelService: ExcelFileService;
    private matcher: MarketingKPIMatcher;

    private constructor() {
        this.excelService = ExcelFileService.getInstance();
        this.matcher = MarketingKPIMatcher.getInstance();
    }

    public static getInstance(): FileSchemaDetector {
        if (!FileSchemaDetector.instance) {
            FileSchemaDetector.instance = new FileSchemaDetector();
        }
        return FileSchemaDetector.instance;
    }

    /**
     * Detect schema from an internal PostgreSQL schema where file data is stored.
     * File-based sources (Excel, CSV, PDF) are loaded into internal schemas named dra_ds_{data_source_id}.
     * This method reads column metadata from information_schema.columns and classifies them.
     *
     * @param dataSourceId - The data source ID
     * @param sourceType - 'excel' | 'csv' | 'pdf'
     * @param internalSchema - The internal PostgreSQL schema name (e.g., 'dra_ds_123')
     * @returns Structured schema detection result
     */
    public async detect(
        dataSourceId: number,
        sourceType: string,
        internalSchema: string
    ): Promise<ISchemaDetectionResult> {
        const errors: string[] = [];
        const detectedTables: IDetectedTable[] = [];

        try {
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                errors.push("Internal PostgreSQL driver not available");
                return this.buildResult(dataSourceId, sourceType, detectedTables, errors);
            }

            const dbConnector = await driver.getConcreteDriver();
            const dataSource = dbConnector as any;

            // Query information_schema to get all tables and columns in the internal schema
            const columnsResult = await dataSource.query(
                `SELECT table_name, column_name, data_type, is_nullable, column_default, character_maximum_length
                 FROM information_schema.columns
                 WHERE table_schema = $1
                 ORDER BY table_name, ordinal_position`,
                [internalSchema]
            );

            // Also get row counts per table
            let rowCounts: Record<string, number> = {};
            try {
                const tablesResult = await dataSource.query(
                    `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_type = 'BASE TABLE'`,
                    [internalSchema]
                );
                for (const t of tablesResult) {
                    try {
                        const countResult = await dataSource.query(
                            `SELECT COUNT(*) AS cnt FROM "${internalSchema}"."${t.table_name}"`
                        );
                        rowCounts[t.table_name] = parseInt(countResult[0]?.cnt ?? "0", 10) || 0;
                    } catch {
                        // Skip tables that can't be counted
                    }
                }
            } catch {
                // Row counts are optional
            }

            // Group columns by table_name
            const tableMap = new Map<string, Array<{
                column_name: string;
                data_type: string;
                is_nullable: string;
                column_default: string | null;
                character_maximum_length: number | null;
            }>>();

            for (const col of columnsResult) {
                if (!tableMap.has(col.table_name)) {
                    tableMap.set(col.table_name, []);
                }
                tableMap.get(col.table_name)!.push({
                    column_name: col.column_name,
                    data_type: col.data_type || "unknown",
                    is_nullable: col.is_nullable || "YES",
                    column_default: col.column_default ?? null,
                    character_maximum_length: col.character_maximum_length ?? null,
                });
            }

            // Classify each table
            for (const [tableName, rawColumns] of tableMap) {
                try {
                    const table = this.classifyFileSheet(
                        tableName,
                        rawColumns.map((col) => ({
                            title: col.column_name,
                            key: col.column_name,
                            type: this.sqlTypeToDetectedType(col.data_type),
                            column_name: col.column_name,
                        })),
                        [], // No raw rows needed for classification
                        rowCounts[tableName] ?? 0
                    );

                    // Override is_nullable and other metadata from actual schema
                    for (let i = 0; i < table.columns.length && i < rawColumns.length; i++) {
                        table.columns[i].is_nullable = rawColumns[i].is_nullable === "YES";
                        table.columns[i].column_default = rawColumns[i].column_default;
                        table.columns[i].max_length = rawColumns[i].character_maximum_length;
                    }

                    table.schema_name = internalSchema;
                    table.row_count_estimate = rowCounts[tableName] ?? null;

                    detectedTables.push(table);
                } catch (err: any) {
                    errors.push(`Table "${tableName}": ${err.message}`);
                }
            }
        } catch (err: any) {
            errors.push(`Internal schema query failed: ${err.message}`);
        }

        return this.buildResult(dataSourceId, sourceType, detectedTables, errors);
    }

    /**
     * Convert SQL data type to a simplified detected type string
     */
    private sqlTypeToDetectedType(sqlType: string): string {
        const t = sqlType.toLowerCase();
        if (t.includes("int") || t.includes("numeric") || t.includes("decimal") || t.includes("float") || t.includes("double") || t.includes("real") || t.includes("bigint") || t.includes("smallint")) return "numeric";
        if (t.includes("timestamp") || t.includes("date") || t.includes("time")) return "date";
        if (t === "boolean" || t === "bool") return "boolean";
        if (t.includes("json") || t.includes("jsonb")) return "json";
        return "varchar";
    }

    /**
     * Detect schema from a file path (Excel, CSV)
     * Each sheet becomes a "table" in the result.
     *
     * @param filePath - Absolute or project-relative path to the file
     * @param sourceType - 'excel' | 'csv' | 'pdf'
     * @param dataSourceId - Optional data source ID for result metadata
     * @returns Structured schema detection result with marketing classifications
     */
    public async detectFromFile(
        filePath: string,
        sourceType: string,
        dataSourceId: number | null = null
    ): Promise<ISchemaDetectionResult> {
        const errors: string[] = [];
        const detectedTables: IDetectedTable[] = [];

        try {
            const parsed = await this.excelService.parseExcelFileFromPath(filePath);

            for (const sheet of parsed.sheets) {
                try {
                    const table = this.classifyFileSheet(
                        sheet.name,
                        sheet.columns,
                        sheet.rows,
                        sheet.metadata?.rowCount ?? sheet.rows.length
                    );
                    detectedTables.push(table);
                } catch (err: any) {
                    errors.push(`Sheet "${sheet.name}": ${err.message}`);
                }
            }
        } catch (err: any) {
            errors.push(`File parsing failed: ${err.message}`);
        }

        return this.buildResult(dataSourceId, sourceType, detectedTables, errors);
    }

    /**
     * Detect schema from an already-parsed sheet structure
     * Useful when the caller already has the parsed data (e.g., from preview flow)
     *
     * @param sheets - Array of parsed sheets with columns and rows
     * @param sourceType - Source type string
     * @param dataSourceId - Optional data source ID
     * @returns Structured schema detection result
     */
    public detectFromParsedSheets(
        sheets: Array<{
            name: string;
            columns: Array<{ title: string; key: string; type: string; column_name: string }>;
            rows: any[];
            metadata?: { rowCount: number; columnCount: number };
        }>,
        sourceType: string,
        dataSourceId: number | null = null
    ): ISchemaDetectionResult {
        const errors: string[] = [];
        const detectedTables: IDetectedTable[] = [];

        for (const sheet of sheets) {
            try {
                const table = this.classifyFileSheet(
                    sheet.name,
                    sheet.columns,
                    sheet.rows,
                    sheet.metadata?.rowCount ?? sheet.rows.length
                );
                detectedTables.push(table);
            } catch (err: any) {
                errors.push(`Sheet "${sheet.name}": ${err.message}`);
            }
        }

        return this.buildResult(dataSourceId, sourceType, detectedTables, errors);
    }

    /**
     * Classify columns from a file sheet
     */
    private classifyFileSheet(
        sheetName: string,
        columns: Array<{ title: string; key: string; type: string; column_name: string }>,
        rows: any[],
        rowCount: number
    ): IDetectedTable {
        // Map file column types to native type strings for MarketingKPIMatcher
        const detectedColumns: IDetectedColumn[] = columns.map((col) => {
            const columnName = col.column_name || col.title || col.key;
            const nativeType = this.inferNativeType(col, rows, col.key);
            const classification = this.matcher.classifyColumn(columnName, nativeType);

            return {
                column_name: columnName,
                native_type: nativeType,
                detected_type: classification.detected_type,
                role: classification.role,
                kpi_match: classification.kpi_match,
                dimension_match: classification.dimension_match,
                is_nullable: true, // File columns are always nullable
                is_primary_key: false, // Files have no PKs
                column_default: null,
                max_length: null,
                confidence: classification.confidence,
            };
        });

        const factColumns = detectedColumns.filter((c) => c.role === "fact");
        const dimensionColumns = detectedColumns.filter((c) => c.role === "dimension");
        const timeColumns = detectedColumns.filter((c) => c.role === "time");

        const classification = this.classifyTableType(
            factColumns.length,
            dimensionColumns.length,
            timeColumns.length,
            detectedColumns.length
        );

        const notes: string[] = [];
        if (detectedColumns.length === 0) {
            notes.push("Sheet has no columns detected");
        }
        notes.push(`Source: file sheet "${sheetName}"`);
        notes.push(`${rowCount} data rows`);

        return {
            table_name: sheetName,
            original_name: null,
            schema_name: null,
            classification,
            columns: detectedColumns,
            primary_keys: [],
            foreign_keys: [],
            row_count_estimate: rowCount,
            fact_column_count: factColumns.length,
            dimension_column_count: dimensionColumns.length,
            time_column_count: timeColumns.length,
            notes,
        };
    }

    /**
     * Infer a native type string from file column metadata and sample data
     */
    private inferNativeType(
        col: { title: string; key: string; type: string; column_name: string },
        rows: any[],
        key: string
    ): string {
        // Use the parser-provided type if available and reliable
        if (col.type && col.type !== "unknown" && col.type !== "string") {
            return this.normalizeFileType(col.type);
        }

        // Sample first 20 rows to infer type
        const sampleSize = Math.min(rows.length, 20);
        let numericCount = 0;
        let dateCount = 0;
        let boolCount = 0;

        for (let i = 0; i < sampleSize; i++) {
            const val = rows[i]?.[key];
            if (val === null || val === undefined || val === "") continue;

            if (typeof val === "number" || (typeof val === "string" && !isNaN(Number(val)) && val.trim() !== "")) {
                numericCount++;
            } else if (val instanceof Date || (typeof val === "string" && !isNaN(Date.parse(val)) && /\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(val))) {
                dateCount++;
            } else if (typeof val === "boolean" || val === "true" || val === "false" || val === "TRUE" || val === "FALSE") {
                boolCount++;
            }
        }

        const threshold = sampleSize * 0.6;

        if (numericCount >= threshold) return "numeric";
        if (dateCount >= threshold) return "date";
        if (boolCount >= threshold) return "boolean";

        return "varchar"; // Default to string/categorical
    }

    /**
     * Normalize file parser type names to standard SQL-like type names
     */
    private normalizeFileType(type: string): string {
        const t = type.toLowerCase();
        if (t === "number" || t === "numeric" || t === "float" || t === "double" || t === "integer" || t === "int") return "numeric";
        if (t === "date" || t === "datetime" || t === "timestamp") return "date";
        if (t === "boolean" || t === "bool") return "boolean";
        if (t === "string" || t === "text" || t === "varchar") return "varchar";
        return t;
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
     * Build the final result with summary statistics
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