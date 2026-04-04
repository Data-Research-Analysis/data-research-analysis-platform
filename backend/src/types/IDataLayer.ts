/**
 * Issue #361 - Medallion Architecture Types
 * 
 * Type definitions for the Bronze/Silver/Gold layer classification system.
 * User-facing labels use plain language; backend uses technical enum values.
 */

/**
 * Data layer enum values (technical, used in database/API)
 */
export enum EDataLayer {
    RAW_DATA = 'raw_data',           // Bronze: Preserves source data
    CLEAN_DATA = 'clean_data',       // Silver: Cleaned/transformed
    BUSINESS_READY = 'business_ready' // Gold: Aggregated/business-ready
}

/**
 * User-facing display labels for data layers
 */
export const DATA_LAYER_LABELS: Record<EDataLayer, string> = {
    [EDataLayer.RAW_DATA]: 'Raw Data',
    [EDataLayer.CLEAN_DATA]: 'Clean Data',
    [EDataLayer.BUSINESS_READY]: 'Business Ready'
};

/**
 * Layer descriptions for UI tooltips/wizards
 */
export const DATA_LAYER_DESCRIPTIONS: Record<EDataLayer, string> = {
    [EDataLayer.RAW_DATA]: 'Preserves original source data structure with minimal or no transformation',
    [EDataLayer.CLEAN_DATA]: 'Cleaned, filtered, and deduplicated data with basic transformations',
    [EDataLayer.BUSINESS_READY]: 'Aggregated metrics and analytics-ready data for dashboards and reports'
};

/**
 * Layer-specific configuration structure
 * Stored in layer_config JSONB column
 */
export interface ILayerConfig {
    // Raw Data layer config
    sampling_enabled?: boolean;
    sample_size?: number;
    
    // Clean Data layer config
    data_quality_checks?: Array<{
        column: string;
        rule: 'not_null' | 'unique' | 'range' | 'pattern';
        params?: any;
    }>;
    deduplication_keys?: string[];
    
    // Business Ready layer config
    aggregation_grain?: string[]; // GROUP BY columns
    metric_definitions?: Array<{
        name: string;
        formula: string;
        description: string;
    }>;
    star_schema?: {
        fact_table: boolean;
        dimension_tables?: string[];
    };
}

/**
 * Layer validation result
 */
export interface ILayerValidationResult {
    valid: boolean;
    layer: EDataLayer;
    issues: Array<{
        code: string;
        severity: 'error' | 'warning' | 'info';
        message: string;
        suggestion?: string;
    }>;
}

/**
 * Layer flow validation (for best practices checking)
 */
export interface ILayerFlowValidation {
    isStandardFlow: boolean; // Raw → Clean → Business
    warnings: string[];
}
