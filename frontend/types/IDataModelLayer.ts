/**
 * Issue #361 - Medallion Architecture Frontend Types
 * 
 * Frontend type definitions for data model layer classification system.
 * These mirror the backend types but are adapted for Vue/Nuxt usage.
 */

/**
 * Data layer enum values (matches backend EDataLayer)
 */
export enum EDataLayer {
    RAW_DATA = 'raw_data',
    CLEAN_DATA = 'clean_data',
    BUSINESS_READY = 'business_ready'
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
 * Alternative names (Bronze/Silver/Gold metaphor)
 */
export const DATA_LAYER_ALTERNATIVE_NAMES: Record<EDataLayer, string> = {
    [EDataLayer.RAW_DATA]: 'Bronze Layer',
    [EDataLayer.CLEAN_DATA]: 'Silver Layer',
    [EDataLayer.BUSINESS_READY]: 'Gold Layer'
};

/**
 * Layer colors for badges and icons
 */
export const DATA_LAYER_COLORS: Record<EDataLayer, { bg: string; text: string; border: string }> = {
    [EDataLayer.RAW_DATA]: {
        bg: 'bg-amber-100',
        text: 'text-amber-800',
        border: 'border-amber-300'
    },
    [EDataLayer.CLEAN_DATA]: {
        bg: 'bg-gray-100',
        text: 'text-gray-700',
        border: 'border-gray-300'
    },
    [EDataLayer.BUSINESS_READY]: {
        bg: 'bg-yellow-100',
        text: 'text-yellow-800',
        border: 'border-yellow-300'
    }
};

/**
 * Layer icons (Font Awesome)
 */
export const DATA_LAYER_ICONS: Record<EDataLayer, [string, string]> = {
    [EDataLayer.RAW_DATA]: ['fas', 'database'],
    [EDataLayer.CLEAN_DATA]: ['fas', 'filter'],
    [EDataLayer.BUSINESS_READY]: ['fas', 'chart-line']
};

/**
 * Layer-specific configuration structure
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
    aggregation_grain?: string[];
    metric_definitions?: Array<{
        name: string;
        formula: string;
        description: string;
    }>;
    star_schema?: {
        fact_table: boolean;
        dimension_tables?: string[];
    };

    // Flow warnings (populated by backend validation)
    flow_warnings?: string[];
}

/**
 * Layer validation result (from backend)
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
 * Layer recommendation (from backend)
 */
export interface ILayerRecommendation {
    layer: EDataLayer;
    reasoning: string;
    confidence: 'high' | 'medium' | 'low';
}

/**
 * Extended data model interface with layer properties
 */
export interface IDataModelWithLayer {
    id: number;
    name: string;
    data_layer?: EDataLayer | null;
    layer_config?: ILayerConfig;
    health_status?: string;
    health_issues?: any[];
    // ... other data model properties
}
