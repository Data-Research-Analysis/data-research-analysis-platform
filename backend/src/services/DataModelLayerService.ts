/**
 * Issue #361 - Medallion Architecture Layer Validation Service
 * 
 * Validates data model layer classifications and ensures models meet layer requirements.
 * Implements Bronze/Silver/Gold validation rules:
 * - Raw Data (Bronze): No validation, preserves source structure
 * - Clean Data (Silver): Requires transformation OR filtering
 * - Business Ready (Gold): Requires aggregation OR joins
 */

import { EDataLayer, ILayerConfig, ILayerValidationResult, ILayerFlowValidation } from '../types/IDataLayer.js';

export class DataModelLayerService {
    private static instance: DataModelLayerService;

    private constructor() {
        console.log('📊 Data Model Layer Service initialized');
    }

    public static getInstance(): DataModelLayerService {
        if (!DataModelLayerService.instance) {
            DataModelLayerService.instance = new DataModelLayerService();
        }
        return DataModelLayerService.instance;
    }

    /**
     * Validate that a data model meets requirements for its assigned layer
     * 
     * @param layer - The assigned data layer
     * @param queryJSON - The query definition JSON
     * @param layerConfig - Optional layer-specific configuration
     * @returns Validation result with any issues found
     */
    public validateLayerRequirements(
        layer: EDataLayer,
        queryJSON: any,
        layerConfig?: ILayerConfig
    ): ILayerValidationResult {
        const issues: Array<{ code: string; severity: 'error' | 'warning' | 'info'; message: string; suggestion?: string }> = [];

        switch (layer) {
            case EDataLayer.RAW_DATA:
                // Raw Data layer: No validation required
                // This layer is for preserving source data structure
                issues.push({
                    code: 'RAW_DATA_INFO',
                    severity: 'info',
                    message: 'Raw Data layer preserves source structure. No transformations required.'
                });
                break;

            case EDataLayer.CLEAN_DATA:
                // Clean Data layer: Must have transformation OR filtering
                this.validateCleanDataLayer(queryJSON, issues);
                break;

            case EDataLayer.BUSINESS_READY:
                // Business Ready layer: Must have aggregation OR joins
                this.validateBusinessReadyLayer(queryJSON, issues);
                break;

            default:
                issues.push({
                    code: 'UNKNOWN_LAYER',
                    severity: 'error',
                    message: `Unknown data layer: ${layer}`
                });
        }

        return {
            valid: !issues.some(i => i.severity === 'error'),
            layer,
            issues
        };
    }

    /**
     * Validate Clean Data (Silver) layer requirements
     * Must have at least one of: transformation, filtering, deduplication
     */
    private validateCleanDataLayer(
        queryJSON: any,
        issues: Array<{ code: string; severity: 'error' | 'warning' | 'info'; message: string; suggestion?: string }>
    ): void {
        const hasTransformation = this.detectTransformations(queryJSON);
        const hasFiltering = this.detectFiltering(queryJSON);
        const hasDeduplication = this.detectDeduplication(queryJSON);

        if (!hasTransformation && !hasFiltering && !hasDeduplication) {
            issues.push({
                code: 'CLEAN_DATA_NO_OPERATIONS',
                severity: 'error',
                message: 'Clean Data layer requires at least one transformation, filter, or deduplication operation',
                suggestion: 'Add a WHERE clause (filtering), calculated column (transformation), or DISTINCT (deduplication)'
            });
        } else {
            // Success - this is a properly structured Clean Data model
            const operations: string[] = [];
            if (hasTransformation) operations.push('transformations');
            if (hasFiltering) operations.push('filters');
            if (hasDeduplication) operations.push('deduplication');

            issues.push({
                code: 'CLEAN_DATA_VALID',
                severity: 'info',
                message: `Clean Data layer includes: ${operations.join(', ')}`
            });
        }
    }

    /**
     * Validate Business Ready (Gold) layer requirements
     * Must have at least one of: aggregation, joins, calculated metrics
     */
    private validateBusinessReadyLayer(
        queryJSON: any,
        issues: Array<{ code: string; severity: 'error' | 'warning' | 'info'; message: string; suggestion?: string }>
    ): void {
        const hasAggregation = this.detectAggregation(queryJSON);
        const hasJoins = this.detectJoins(queryJSON);

        if (!hasAggregation && !hasJoins) {
            issues.push({
                code: 'BUSINESS_READY_NO_OPERATIONS',
                severity: 'error',
                message: 'Business Ready layer requires aggregation (GROUP BY) or joins',
                suggestion: 'Add GROUP BY with aggregate functions (SUM, COUNT, AVG) or join multiple tables'
            });
        } else {
            // Success - this is a properly structured Business Ready model
            const operations: string[] = [];
            if (hasAggregation) operations.push('aggregation');
            if (hasJoins) operations.push('joins');

            issues.push({
                code: 'BUSINESS_READY_VALID',
                severity: 'info',
                message: `Business Ready layer includes: ${operations.join(', ')}`
            });
        }
    }

    /**
     * Detect transformations in query (calculated columns, CASE statements, CAST, etc.)
     */
    private detectTransformations(queryJSON: any): boolean {
        if (!queryJSON?.select || !Array.isArray(queryJSON.select)) {
            return false;
        }

        // Check for calculated columns (expressions vs simple column references)
        return queryJSON.select.some((col: any) => {
            if (typeof col !== 'string') {
                // Complex column object likely indicates transformation
                return true;
            }
            
            const colUpper = col.toUpperCase();
            
            // CASE statements
            if (colUpper.includes('CASE ') && colUpper.includes(' END')) {
                return true;
            }
            
            // Type casting
            if (colUpper.includes('CAST(') || colUpper.includes('::')) {
                return true;
            }
            
            // String operations
            if (colUpper.match(/CONCAT\(|SUBSTRING\(|TRIM\(|UPPER\(|LOWER\(|REPLACE\(/)) {
                return true;
            }
            
            // Date operations
            if (colUpper.match(/DATE_TRUNC\(|EXTRACT\(|TO_CHAR\(/)) {
                return true;
            }
            
            // Math operations
            if (col.match(/[\+\-\*\/]/)) {
                return true;
            }
            
            // Coalesce/NullIf
            if (colUpper.includes('COALESCE(') || colUpper.includes('NULLIF(')) {
                return true;
            }

            return false;
        });
    }

    /**
     * Detect filtering in query (WHERE clauses)
     */
    private detectFiltering(queryJSON: any): boolean {
        // WHERE clause filtering
        if (queryJSON?.where && Object.keys(queryJSON.where).length > 0) {
            return true;
        }

        // HAVING clause filtering (post-aggregation)
        if (queryJSON?.having && Object.keys(queryJSON.having).length > 0) {
            return true;
        }

        return false;
    }

    /**
     * Detect deduplication in query (DISTINCT, GROUP BY without aggregates)
     */
    private detectDeduplication(queryJSON: any): boolean {
        // DISTINCT keyword
        if (queryJSON?.distinct === true) {
            return true;
        }

        // GROUP BY without aggregate functions (deduplication pattern)
        if (queryJSON?.groupBy && Array.isArray(queryJSON.groupBy) && queryJSON.groupBy.length > 0) {
            // Check if select has no aggregate functions
            const hasAggregates = this.detectAggregation(queryJSON);
            if (!hasAggregates) {
                return true; // GROUP BY without aggregates = deduplication
            }
        }

        return false;
    }

    /**
     * Detect aggregation in query (GROUP BY with aggregate functions)
     */
    private detectAggregation(queryJSON: any): boolean {
        if (!queryJSON?.select || !Array.isArray(queryJSON.select)) {
            return false;
        }

        // Check for aggregate functions in SELECT
        const hasAggregateFunctions = queryJSON.select.some((col: any) => {
            const colStr = typeof col === 'string' ? col : JSON.stringify(col);
            const colUpper = colStr.toUpperCase();
            
            return colUpper.match(/\b(COUNT|SUM|AVG|MIN|MAX|ARRAY_AGG|STRING_AGG|STDDEV|VARIANCE)\s*\(/);
        });

        // Aggregation requires both GROUP BY and aggregate functions
        const hasGroupBy = queryJSON?.groupBy && Array.isArray(queryJSON.groupBy) && queryJSON.groupBy.length > 0;

        return hasAggregateFunctions && hasGroupBy;
    }

    /**
     * Detect joins in query
     */
    private detectJoins(queryJSON: any): boolean {
        // Check for explicit join arrays
        if (queryJSON?.join && Array.isArray(queryJSON.join) && queryJSON.join.length > 0) {
            return true;
        }

        if (queryJSON?.leftJoin && Array.isArray(queryJSON.leftJoin) && queryJSON.leftJoin.length > 0) {
            return true;
        }

        if (queryJSON?.innerJoin && Array.isArray(queryJSON.innerJoin) && queryJSON.innerJoin.length > 0) {
            return true;
        }

        // Check for multiple FROM tables (implicit cross join or explicit joins)
        if (queryJSON?.from && Array.isArray(queryJSON.from) && queryJSON.from.length > 1) {
            return true;
        }

        return false;
    }

    /**
     * Validate layer flow for a data model that uses other data models as sources
     * Checks if the layer progression follows best practices (Raw → Clean → Business)
     * 
     * @param currentLayer - The layer of the current model being built
     * @param sourceModels - Array of source data models with their layers
     * @returns Flow validation result with warnings if non-standard flow detected
     */
    public validateLayerFlow(
        currentLayer: EDataLayer,
        sourceModels: Array<{ id: number; name: string; data_layer?: EDataLayer | null }>
    ): ILayerFlowValidation {
        const warnings: string[] = [];

        // Standard flow progressions (allowed patterns)
        const standardFlows: Record<EDataLayer, EDataLayer[]> = {
            [EDataLayer.RAW_DATA]: [], // Raw should not depend on other models (warning)
            [EDataLayer.CLEAN_DATA]: [EDataLayer.RAW_DATA], // Clean should use Raw
            [EDataLayer.BUSINESS_READY]: [EDataLayer.CLEAN_DATA, EDataLayer.RAW_DATA] // Business can use Clean or Raw
        };

        // Check if Raw Data model uses other models as sources (anti-pattern)
        if (currentLayer === EDataLayer.RAW_DATA && sourceModels.length > 0) {
            warnings.push(
                'Raw Data layer models should typically not depend on other data models. ' +
                'Consider using a direct data source connection instead.'
            );
        }

        // Check each source model's layer
        for (const sourceModel of sourceModels) {
            if (!sourceModel.data_layer) {
                warnings.push(
                    `Source model "${sourceModel.name}" has no layer assigned. ` +
                    'Consider assigning layers to all models for clearer data lineage.'
                );
                continue;
            }

            const allowedSourceLayers = standardFlows[currentLayer];
            
            if (!allowedSourceLayers.includes(sourceModel.data_layer)) {
                // Non-standard flow detected
                const layerNames: Record<EDataLayer, string> = {
                    [EDataLayer.RAW_DATA]: 'Raw Data',
                    [EDataLayer.CLEAN_DATA]: 'Clean Data',
                    [EDataLayer.BUSINESS_READY]: 'Business Ready'
                };

                warnings.push(
                    `Non-standard layer flow: ${layerNames[currentLayer]} model uses ` +
                    `${layerNames[sourceModel.data_layer]} model "${sourceModel.name}". ` +
                    `Best practice: ${layerNames[currentLayer]} should use ${allowedSourceLayers.map(l => layerNames[l]).join(' or ')} models.`
                );
            }
        }

        return {
            isStandardFlow: warnings.length === 0,
            warnings
        };
    }

    /**
     * Get recommended layer for a query based on its characteristics
     * 
     * @param queryJSON - The query definition JSON
     * @returns Recommended layer and reasoning
     */
    public recommendLayer(queryJSON: any): {
        layer: EDataLayer;
        reasoning: string;
        confidence: 'high' | 'medium' | 'low';
    } {
        const hasTransformation = this.detectTransformations(queryJSON);
        const hasFiltering = this.detectFiltering(queryJSON);
        const hasDeduplication = this.detectDeduplication(queryJSON);
        const hasAggregation = this.detectAggregation(queryJSON);
        const hasJoins = this.detectJoins(queryJSON);

        // Business Ready: Has aggregation or joins
        if (hasAggregation || hasJoins) {
            const features: string[] = [];
            if (hasAggregation) features.push('aggregation');
            if (hasJoins) features.push('joins');

            return {
                layer: EDataLayer.BUSINESS_READY,
                reasoning: `Query includes ${features.join(' and ')}, making it suitable for business analytics`,
                confidence: 'high'
            };
        }

        // Clean Data: Has transformations, filtering, or deduplication
        if (hasTransformation || hasFiltering || hasDeduplication) {
            const features: string[] = [];
            if (hasTransformation) features.push('transformations');
            if (hasFiltering) features.push('filtering');
            if (hasDeduplication) features.push('deduplication');

            return {
                layer: EDataLayer.CLEAN_DATA,
                reasoning: `Query includes ${features.join(', ')}, making it suitable for cleaned data`,
                confidence: 'high'
            };
        }

        // Raw Data: Simple SELECT with no transformations
        return {
            layer: EDataLayer.RAW_DATA,
            reasoning: 'Query performs simple selection with no transformations or aggregations',
            confidence: 'medium'
        };
    }
}
