import { DataModelProcessor } from '../processors/DataModelProcessor.js';
import type { ITokenDetails } from '../types/ITokenDetails.js';

// ============================================================
// Types
// ============================================================

/** Supported filter operators */
export type FilterOperator =
    | 'eq'
    | 'neq'
    | 'contains'
    | 'not_contains'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'between'
    | 'is_null'
    | 'is_not_null'
    | 'in'
    | 'not_in';

/** Supported aggregation functions */
export type AggregationFunction = 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX';

/** Sort direction */
export type SortDirection = 'ASC' | 'DESC';

/** A single filter condition */
export interface ExploreFilter {
    column: string;
    operator: FilterOperator;
    value?: any;           // single value (or first value for between)
    values?: any[];        // array value for in/not_in
    value2?: any;          // second value for between
}

/** Sort configuration */
export interface ExploreSort {
    column: string;
    direction: SortDirection;
}

/** Group-by configuration */
export interface ExploreGroupBy {
    columns: string[];
    aggregations: Array<{
        column: string;
        function: AggregationFunction;
        alias?: string;
    }>;
}

/** Full explore request body */
export interface ExploreRequest {
    /** Columns to return (null/undefined = all columns) */
    columns?: string[];
    /** Filter conditions (AND logic) */
    filters?: ExploreFilter[];
    /** Sort configuration */
    sort?: ExploreSort[];
    /** Group-by with aggregation */
    groupBy?: ExploreGroupBy;
    /** Pagination: page number (1-based, default 1) */
    page?: number;
    /** Pagination: rows per page (default 50, max 1000) */
    pageSize?: number;
}

/** Explore response */
export interface ExploreResponse {
    /** Column names in the result */
    columns: string[];
    /** Result rows */
    data: any[];
    /** Total matching rows (before pagination) */
    total: number;
    /** Current page number */
    page: number;
    /** Page size used */
    pageSize: number;
    /** Total number of pages */
    totalPages: number;
    /** Whether this is a grouped result */
    isGrouped: boolean;
    /** Execution time in ms */
    execution_ms: number;
}

// ============================================================
// Service
// ============================================================

/**
 * Service for interactive data exploration on a data model's result set.
 * Supports pagination, sorting, filtering, and group-by aggregation.
 * All queries run against the already-executed data model result (in-memory).
 *
 * Ticket: DM-006 — Data Model Explorer — Backend
 */
export class DataModelExploreService {
    private static instance: DataModelExploreService;

    private constructor() {}

    public static getInstance(): DataModelExploreService {
        if (!DataModelExploreService.instance) {
            DataModelExploreService.instance = new DataModelExploreService();
        }
        return DataModelExploreService.instance;
    }

    // -----------------------------------------------------------
    // Public API
    // -----------------------------------------------------------

    /**
     * Explore a data model's result set with pagination, sorting,
     * filtering, and optional group-by aggregation.
     *
     * @param dataModelId - ID of the data model to explore
     * @param tokenDetails - Authenticated user details
     * @param request - Explore request configuration
     * @param organizationId - Optional organisation context
     */
    public async explore(
        dataModelId: number,
        tokenDetails: ITokenDetails,
        request: ExploreRequest,
        organizationId?: number | null,
    ): Promise<ExploreResponse> {
        const startTime = Date.now();

        // ---- Validate request ----------------------------------------
        this.validateRequest(request);

        const page = Math.max(1, request.page || 1);
        const pageSize = Math.min(1000, Math.max(1, request.pageSize || 50));

        // ---- Execute the data model query to get all rows ------------
        const processor = DataModelProcessor.getInstance();
        const dataModel = await processor.getDataModelById(dataModelId, tokenDetails, organizationId ?? null);

        if (!dataModel) {
            throw new Error(`Data model with ID ${dataModelId} not found`);
        }

        let rows: any[];
        try {
            rows = await processor.executeDataModelQuery(dataModelId, tokenDetails, organizationId ?? null);
        } catch (error: any) {
            throw new Error(`Failed to execute data model query: ${error.message}`);
        }

        if (!rows || rows.length === 0) {
            return {
                columns: [],
                data: [],
                total: 0,
                page,
                pageSize,
                totalPages: 0,
                isGrouped: false,
                execution_ms: Date.now() - startTime,
            };
        }

        // Determine available columns from first row
        const availableColumns = Object.keys(rows[0]);

        // ---- Validate column references ------------------------------
        this.validateColumns(request, availableColumns);

        // ---- Apply filters -------------------------------------------
        let filteredRows = rows;
        if (request.filters && request.filters.length > 0) {
            filteredRows = this.applyFilters(rows, request.filters);
        }

        // ---- Group-by + aggregation ----------------------------------
        let resultColumns: string[];
        let resultRows: any[];
        let isGrouped = false;

        if (request.groupBy && request.groupBy.columns.length > 0) {
            isGrouped = true;
            const grouped = this.applyGroupBy(
                filteredRows,
                request.groupBy,
                availableColumns,
            );
            resultColumns = grouped.columns;
            resultRows = grouped.rows;
        } else {
            // ---- Column selection ------------------------------------
            if (request.columns && request.columns.length > 0) {
                resultRows = filteredRows.map((row) => {
                    const selected: any = {};
                    for (const col of request.columns!) {
                        selected[col] = row[col] !== undefined ? row[col] : null;
                    }
                    return selected;
                });
            } else {
                resultRows = filteredRows;
            }
            resultColumns = resultRows.length > 0 ? Object.keys(resultRows[0]) : availableColumns;
        }

        // ---- Sorting -------------------------------------------------
        if (request.sort && request.sort.length > 0) {
            resultRows = this.applySort(resultRows, request.sort);
        }

        // ---- Pagination ----------------------------------------------
        const total = resultRows.length;
        const totalPages = Math.ceil(total / pageSize);
        const offset = (page - 1) * pageSize;
        const paginatedRows = resultRows.slice(offset, offset + pageSize);

        return {
            columns: resultColumns,
            data: paginatedRows,
            total,
            page,
            pageSize,
            totalPages,
            isGrouped,
            execution_ms: Date.now() - startTime,
        };
    }

    // -----------------------------------------------------------
    // Validation
    // -----------------------------------------------------------

    private validateRequest(request: ExploreRequest): void {
        if (request.filters) {
            for (const filter of request.filters) {
                if (!filter.column) {
                    throw new Error('Filter must specify a column');
                }
                if (!filter.operator) {
                    throw new Error(`Filter on column "${filter.column}" must specify an operator`);
                }
                const validOperators: FilterOperator[] = [
                    'eq', 'neq', 'contains', 'not_contains',
                    'gt', 'gte', 'lt', 'lte',
                    'between', 'is_null', 'is_not_null',
                    'in', 'not_in',
                ];
                if (!validOperators.includes(filter.operator)) {
                    throw new Error(
                        `Invalid filter operator "${filter.operator}" on column "${filter.column}". Valid operators: ${validOperators.join(', ')}`,
                    );
                }
                // Operators that require a value
                if (['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'not_contains'].includes(filter.operator)) {
                    if (filter.value === undefined || filter.value === null || filter.value === '') {
                        throw new Error(
                            `Filter operator "${filter.operator}" on column "${filter.column}" requires a value`,
                        );
                    }
                }
                if (filter.operator === 'between') {
                    if (filter.value === undefined || filter.value2 === undefined) {
                        throw new Error(
                            `Filter operator "between" on column "${filter.column}" requires value and value2`,
                        );
                    }
                }
                if (['in', 'not_in'].includes(filter.operator)) {
                    if (!filter.values || !Array.isArray(filter.values) || filter.values.length === 0) {
                        throw new Error(
                            `Filter operator "${filter.operator}" on column "${filter.column}" requires a non-empty values array`,
                        );
                    }
                }
            }
        }

        if (request.groupBy) {
            if (request.groupBy.columns.length === 0) {
                throw new Error('Group-by must specify at least one column');
            }
            if (!request.groupBy.aggregations || request.groupBy.aggregations.length === 0) {
                throw new Error('Group-by must specify at least one aggregation');
            }
            for (const agg of request.groupBy.aggregations) {
                const validFns: AggregationFunction[] = ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX'];
                if (!validFns.includes(agg.function)) {
                    throw new Error(
                        `Invalid aggregation function "${agg.function}". Valid functions: ${validFns.join(', ')}`,
                    );
                }
                if (!agg.column) {
                    throw new Error('Each aggregation must specify a column');
                }
            }
        }
    }

    /**
     * Validate that referenced columns exist in the data model result set.
     * For COUNT aggregation with '*', skip column validation.
     */
    private validateColumns(request: ExploreRequest, availableColumns: string[]): void {
        const colSet = new Set(availableColumns);

        // Validate selected columns
        if (request.columns) {
            for (const col of request.columns) {
                if (!colSet.has(col)) {
                    throw new Error(`Column "${col}" does not exist in the data model. Available columns: ${availableColumns.join(', ')}`);
                }
            }
        }

        // Validate filter columns
        if (request.filters) {
            for (const filter of request.filters) {
                if (!colSet.has(filter.column)) {
                    throw new Error(`Filter column "${filter.column}" does not exist in the data model. Available columns: ${availableColumns.join(', ')}`);
                }
            }
        }

        // Validate sort columns
        if (request.sort) {
            for (const sort of request.sort) {
                if (!colSet.has(sort.column)) {
                    throw new Error(`Sort column "${sort.column}" does not exist in the data model. Available columns: ${availableColumns.join(', ')}`);
                }
            }
        }

        // Validate group-by columns
        if (request.groupBy) {
            for (const col of request.groupBy.columns) {
                if (!colSet.has(col)) {
                    throw new Error(`Group-by column "${col}" does not exist in the data model. Available columns: ${availableColumns.join(', ')}`);
                }
            }
            for (const agg of request.groupBy.aggregations) {
                if (agg.column !== '*' && !colSet.has(agg.column)) {
                    throw new Error(`Aggregation column "${agg.column}" does not exist in the data model. Available columns: ${availableColumns.join(', ')}`);
                }
            }
        }
    }

    // -----------------------------------------------------------
    // Filtering
    // -----------------------------------------------------------

    private applyFilters(rows: any[], filters: ExploreFilter[]): any[] {
        return rows.filter((row) => {
            return filters.every((filter) => this.evaluateFilter(row, filter));
        });
    }

    private evaluateFilter(row: any, filter: ExploreFilter): boolean {
        const rawValue = row[filter.column];
        const value = rawValue !== undefined ? rawValue : null;

        switch (filter.operator) {
            case 'eq':
                return this.compareValues(value, filter.value) === 0;

            case 'neq':
                return this.compareValues(value, filter.value) !== 0;

            case 'contains':
                if (value === null || value === undefined) return false;
                return String(value).toLowerCase().includes(String(filter.value).toLowerCase());

            case 'not_contains':
                if (value === null || value === undefined) return true;
                return !String(value).toLowerCase().includes(String(filter.value).toLowerCase());

            case 'gt':
                return this.toNumber(value) > this.toNumber(filter.value);

            case 'gte':
                return this.toNumber(value) >= this.toNumber(filter.value);

            case 'lt':
                return this.toNumber(value) < this.toNumber(filter.value);

            case 'lte':
                return this.toNumber(value) <= this.toNumber(filter.value);

            case 'between': {
                const num = this.toNumber(value);
                return num >= this.toNumber(filter.value) && num <= this.toNumber(filter.value2);
            }

            case 'is_null':
                return value === null || value === undefined || value === '';

            case 'is_not_null':
                return value !== null && value !== undefined && value !== '';

            case 'in':
                return (filter.values || []).some((v) => this.compareValues(value, v) === 0);

            case 'not_in':
                return !(filter.values || []).some((v) => this.compareValues(value, v) === 0);

            default:
                return true;
        }
    }

    /**
     * Compare two values (handles null, strings, numbers, dates).
     * Returns -1, 0, or 1.
     */
    private compareValues(a: any, b: any): number {
        if (a === null || a === undefined) {
            if (b === null || b === undefined) return 0;
            return -1;
        }
        if (b === null || b === undefined) return 1;

        // Try numeric comparison
        const numA = Number(a);
        const numB = Number(b);
        if (!isNaN(numA) && !isNaN(numB)) {
            if (numA < numB) return -1;
            if (numA > numB) return 1;
            return 0;
        }

        // Try date comparison
        const dateA = new Date(a);
        const dateB = new Date(b);
        if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
            if (dateA < dateB) return -1;
            if (dateA > dateB) return 1;
            return 0;
        }

        // String comparison (case-insensitive)
        const strA = String(a).toLowerCase();
        const strB = String(b).toLowerCase();
        if (strA < strB) return -1;
        if (strA > strB) return 1;
        return 0;
    }

    private toNumber(value: any): number {
        if (value === null || value === undefined || value === '') return NaN;
        const num = Number(value);
        return num;
    }

    // -----------------------------------------------------------
    // Sorting
    // -----------------------------------------------------------

    private applySort(rows: any[], sortConfigs: ExploreSort[]): any[] {
        return [...rows].sort((a, b) => {
            for (const sort of sortConfigs) {
                const cmp = this.compareValues(a[sort.column], b[sort.column]);
                if (cmp !== 0) {
                    return sort.direction === 'DESC' ? -cmp : cmp;
                }
            }
            return 0;
        });
    }

    // -----------------------------------------------------------
    // Group-by + Aggregation
    // -----------------------------------------------------------

    private applyGroupBy(
        rows: any[],
        groupBy: ExploreGroupBy,
        _availableColumns: string[],
    ): { columns: string[]; rows: any[] } {
        // Build group keys
        const groupMap = new Map<string, any[]>();

        for (const row of rows) {
            const keyParts: string[] = [];
            for (const col of groupBy.columns) {
                keyParts.push(String(row[col] ?? '__NULL__'));
            }
            const key = keyParts.join('|||');
            if (!groupMap.has(key)) {
                groupMap.set(key, []);
            }
            groupMap.get(key)!.push(row);
        }

        // Compute aggregated rows
        const resultRows: any[] = [];
        for (const [, groupRows] of groupMap) {
            const aggregated: any = {};

            // Group-by columns: take the value from first row
            for (const col of groupBy.columns) {
                aggregated[col] = groupRows[0][col];
            }

            // Aggregations
            for (const agg of groupBy.aggregations) {
                const alias = agg.alias || `${agg.function.toLowerCase()}_${agg.column}`;
                aggregated[alias] = this.computeAggregation(groupRows, agg.column, agg.function);
            }

            resultRows.push(aggregated);
        }

        // Result columns = group-by columns + aggregation aliases
        const resultColumns = [
            ...groupBy.columns,
            ...groupBy.aggregations.map(
                (a) => a.alias || `${a.function.toLowerCase()}_${a.column}`,
            ),
        ];

        return { columns: resultColumns, rows: resultRows };
    }

    private computeAggregation(
        rows: any[],
        column: string,
        fn: AggregationFunction,
    ): number | null {
        // For COUNT with * or any column, just return row count
        if (fn === 'COUNT') {
            if (column === '*') return rows.length;
            return rows.filter(
                (r) => r[column] !== null && r[column] !== undefined,
            ).length;
        }

        // Extract numeric values for the column
        const values = rows
            .map((r) => r[column])
            .filter((v) => v !== null && v !== undefined && v !== '')
            .map((v) => Number(v))
            .filter((v) => !isNaN(v));

        if (values.length === 0) return null;

        switch (fn) {
            case 'SUM':
                return values.reduce((acc, v) => acc + v, 0);
            case 'AVG':
                return values.reduce((acc, v) => acc + v, 0) / values.length;
            case 'MIN':
                return Math.min(...values);
            case 'MAX':
                return Math.max(...values);
            default:
                return null;
        }
    }
}