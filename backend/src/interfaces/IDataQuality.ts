/**
 * Data Quality Interfaces
 * Defines types for data profiling, quality analysis, cleaning operations, and validation
 */

/**
 * Column statistics from data profiling
 */
export interface IColumnProfile {
    name: string;
    type: string;
    nullCount: number;
    nullRate: number; // Percentage (0-100)
    distinctCount: number;
    distinctRate: number; // Percentage (0-100)
    sampleValues: any[];
    min?: number | Date;
    max?: number | Date;
    mean?: number;
    median?: number;
    stdDev?: number;
}

/**
 * Complete data profile for a data model
 */
export interface IDataProfile {
    dataModelId: number;
    totalRows: number;
    columnCount: number;
    columns: IColumnProfile[];
    profiledAt: Date;
}

/**
 * Individual data quality issue detected
 */
export interface IQualityIssue {
    id: number;
    severity: 'critical' | 'high' | 'medium' | 'low';
    type: 'duplicates' | 'missing_values' | 'inconsistent_format' | 'outliers' | 'referential_integrity' | 'custom';
    column?: string;
    description: string;
    affectedRows: number;
    affectedPercent: number;
    recommendation: string;
    sqlFix?: string;
    estimatedImpact: string;
}

/**
 * Complete quality report for a data model
 */
export interface IQualityReport {
    id: number;
    dataModelId: number;
    userId: number;
    qualityScore: number; // 0-100
    completenessScore: number;
    uniquenessScore: number;
    validityScore: number;
    consistencyScore: number;
    totalRows: number;
    duplicateCount: number;
    nullCount: number;
    outlierCount: number;
    issues: IQualityIssue[];
    recommendations: string[];
    status: 'pending' | 'running' | 'completed' | 'failed';
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Configuration for cleaning operations
 */
export interface ICleaningConfig {
    dataModelId: number;
    cleaningType: 'deduplicate' | 'standardize' | 'validate' | 'impute' | 'custom';
    affectedColumns: string[];
    configuration: {
        deduplication?: {
            keyColumns: string[];
            strategy: 'keep_first' | 'keep_last' | 'keep_newest' | 'merge';
            dateColumn?: string;
        };
        standardization?: {
            rules: Array<{
                column: string;
                type: 'country' | 'phone' | 'email' | 'date' | 'custom';
                mapping?: Record<string, string>;
                pattern?: string;
            }>;
        };
        validation?: {
            rules: Array<{
                column: string;
                rule: 'not_null' | 'unique' | 'range' | 'format' | 'custom_sql';
                parameters?: any;
            }>;
        };
        imputation?: {
            method: 'mean' | 'median' | 'mode' | 'forward_fill' | 'backward_fill' | 'custom';
            columns: string[];
        };
    };
    dryRun?: boolean;
}

/**
 * SQL validation result
 */
export interface IValidationResult {
    safe: boolean;
    issues: string[];
    warnings: string[];
    allowedOperations: string[];
    blockedOperations: string[];
    estimatedAffectedRows?: number;
}

/**
 * SQL execution result
 */
export interface IExecutionResult {
    success: boolean;
    rowsAffected: number;
    executionTimeMs: number;
    dryRun: boolean;
    changes?: {
        before: any[];
        after: any[];
    };
    error?: string;
    rollbackAvailable: boolean;
}

/**
 * Cleaning history record
 */
export interface ICleaningHistory {
    id: number;
    dataModelId: number;
    userId: number;
    cleaningType: string;
    affectedColumns: string[];
    rowsAffected: number;
    configuration: any;
    status: 'completed' | 'failed' | 'rolled_back';
    errorMessage?: string;
    executionTimeMs: number;
    createdAt: Date;
}

/**
 * Data quality rule (user-defined)
 */
export interface IQualityRule {
    id: number;
    dataModelId: number;
    ruleName: string;
    ruleType: 'completeness' | 'uniqueness' | 'format' | 'range' | 'custom_sql';
    columnName: string;
    ruleConfig: {
        threshold?: number;
        pattern?: string;
        minValue?: number;
        maxValue?: number;
        customSql?: string;
    };
    threshold?: number; // Fail threshold percentage
    isActive: boolean;
    createdByUserId: number;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Quality analysis request
 */
export interface IQualityAnalysisRequest {
    dataModelId: number;
    userId: number;
    includeRecommendations?: boolean;
    autoFix?: boolean;
}

/**
 * Quality analysis response
 */
export interface IQualityAnalysisResponse {
    report: IQualityReport;
    autoFixAvailable: boolean;
    estimatedFixTime?: number; // seconds
}
