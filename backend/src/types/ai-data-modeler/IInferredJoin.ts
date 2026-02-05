/**
 * Interface for AI-suggested JOIN relationships detected via pattern matching
 * Used when explicit foreign key relationships are not available (Excel, PDF, CSV sources)
 * 
 * @see JoinInferenceService for generation logic
 * @see Issue #270: AI-Suggested Join Relationships for Non-FK Tables
 */
export interface IInferredJoin {
    /**
     * Unique identifier for tracking this suggestion
     * Format: `inferred_join_{timestamp}_{random}`
     */
    id: string;

    /**
     * Left table schema name
     * Example: 'public', 'dra_excel'
     */
    left_schema: string;

    /**
     * Left table name
     * Example: 'orders'
     */
    left_table: string;

    /**
     * Left column name
     * Example: 'customer_id'
     */
    left_column: string;

    /**
     * Left column data type
     * Example: 'integer', 'varchar', 'timestamp'
     */
    left_column_type: string;

    /**
     * Right table schema name
     * Example: 'public', 'dra_excel'
     */
    right_schema: string;

    /**
     * Right table name
     * Example: 'customers'
     */
    right_table: string;

    /**
     * Right column name
     * Example: 'id'
     */
    right_column: string;

    /**
     * Right column data type
     * Example: 'integer', 'varchar', 'timestamp'
     */
    right_column_type: string;

    /**
     * Confidence level category
     * - high: >70% confidence (e.g., standard FK patterns)
     * - medium: 40-70% confidence (e.g., name matches, cross-source)
     * - low: <40% confidence (use with caution)
     */
    confidence: 'high' | 'medium' | 'low';

    /**
     * Numeric confidence score (0.0-1.0)
     * Example: 0.85 = 85% confidence
     */
    confidence_score: number;

    /**
     * Human-readable explanation of why this join was suggested
     * Example: "Standard FK pattern: customer_id likely references customers.id"
     */
    reasoning: string;

    /**
     * Recommended JOIN type
     * - INNER: Both tables must have matching rows
     * - LEFT: Keep all left table rows, match right where possible
     * - RIGHT: Keep all right table rows, match left where possible
     */
    suggested_join_type: 'INNER' | 'LEFT' | 'RIGHT';

    /**
     * Array of pattern names that matched for this suggestion
     * Examples: ['id_suffix', 'type_match'], ['exact_name_match'], ['plural_singular']
     */
    matched_patterns: string[];

    /**
     * Optional: Timestamp when suggestion was generated
     */
    created_at?: Date;

    /**
     * Optional: Whether this suggestion was applied by user
     */
    applied?: boolean;

    /**
     * Optional: Whether this suggestion was dismissed by user
     */
    dismissed?: boolean;
}

/**
 * Metadata for join inference results
 */
export interface IInferredJoinMetadata {
    /**
     * Data source ID that was analyzed
     */
    data_source_id: number;

    /**
     * Schema name that was analyzed
     */
    schema_name: string;

    /**
     * Total number of tables analyzed
     */
    total_tables: number;

    /**
     * Total number of suggestions generated
     */
    total_suggestions: number;

    /**
     * Count by confidence level
     */
    high_confidence_count: number;
    medium_confidence_count: number;
    low_confidence_count: number;

    /**
     * Timestamp of analysis
     */
    generated_at: Date;

    /**
     * Time taken to generate suggestions (milliseconds)
     */
    processing_time_ms: number;
}

/**
 * Response format for suggested joins API endpoint
 */
export interface IInferredJoinResponse {
    success: boolean;
    data: IInferredJoin[];
    metadata: IInferredJoinMetadata;
    cached: boolean;
    timestamp: string;
    error?: string;
}
