import { DRACrossSourceJoinCatalog } from '../models/DRACrossSourceJoinCatalog.js';
import { DBDriver } from '../drivers/DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { Repository } from 'typeorm';

/**
 * Interface for join suggestion with confidence score
 */
export interface IJoinSuggestion {
    leftColumn: string;   // "schema.table.column"
    rightColumn: string;  // "schema.table.column"
    leftTableName: string;
    rightTableName: string;
    leftColumnName: string;
    rightColumnName: string;
    confidence: number;   // 0-100 score
    reason: string;       // Explanation for suggestion
    suggestedJoinType: string; // 'INNER', 'LEFT', 'RIGHT'
}

/**
 * Interface for table column information
 */
export interface ITableColumn {
    schema: string;
    table_name: string;
    column_name: string;
    data_type: string;
}

/**
 * Interface for table with columns
 */
export interface ITable {
    schema: string;
    table_name: string;
    columns: ITableColumn[];
    data_source_id: number;
}

/**
 * Interface for storing join definition in catalog
 */
export interface IJoinDefinition {
    leftDataSourceId: number;
    leftTableName: string;
    leftColumnName: string;
    rightDataSourceId: number;
    rightTableName: string;
    rightColumnName: string;
    joinType: string;
    createdByUserId: number;
}

/**
 * CrossSourceJoinService - Manages join suggestions and catalog
 * 
 * Responsibilities:
 * - Suggest join columns based on name/type matching
 * - Store successful joins in catalog for reuse
 * - Track join popularity across users
 * - Provide join recommendations from catalog
 */
export class CrossSourceJoinService {
    private static instance: CrossSourceJoinService;
    private joinCatalogRepository?: Repository<DRACrossSourceJoinCatalog>;
    // Maximum length to consider for column names when computing similarities
    private static readonly MAX_COLUMN_NAME_LENGTH = 255;

    private constructor() {}

    public static getInstance(): CrossSourceJoinService {
        if (!CrossSourceJoinService.instance) {
            CrossSourceJoinService.instance = new CrossSourceJoinService();
        }
        return CrossSourceJoinService.instance;
    }

    /**
     * Initialize repository connection
     */
    private async getRepository(): Promise<Repository<DRACrossSourceJoinCatalog>> {
        if (this.joinCatalogRepository) {
            return this.joinCatalogRepository;
        }

        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) {
            throw new Error('Database driver not available');
        }

        const dataSource = await driver.getConcreteDriver();
        this.joinCatalogRepository = dataSource.getRepository(DRACrossSourceJoinCatalog);
        return this.joinCatalogRepository;
    }

    /**
     * Calculate Levenshtein distance between two strings
     * Used for fuzzy column name matching
     */
    private levenshteinDistance(str1: string, str2: string): number {
        // Normalize inputs to strings and ensure we do not process excessively long values
        let a = String(str1);
        let b = String(str2);

        if (a.length > CrossSourceJoinService.MAX_COLUMN_NAME_LENGTH) {
            a = a.slice(0, CrossSourceJoinService.MAX_COLUMN_NAME_LENGTH);
        }
        if (b.length > CrossSourceJoinService.MAX_COLUMN_NAME_LENGTH) {
            b = b.slice(0, CrossSourceJoinService.MAX_COLUMN_NAME_LENGTH);
        }

        const len1 = a.length;
        const len2 = b.length;
        const matrix: number[][] = [];

        for (let i = 0; i <= len1; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= len2; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,      // deletion
                    matrix[i][j - 1] + 1,      // insertion
                    matrix[i - 1][j - 1] + cost // substitution
                );
            }
        }

        return matrix[len1][len2];
    }

    /**
     * Normalize column name for comparison
     * Removes common prefixes/suffixes and converts to lowercase
     */
    private normalizeColumnName(columnName: string): string {
        // Ensure we do not process excessively long strings to avoid DoS via Levenshtein distance
        if (columnName.length > CrossSourceJoinService.MAX_COLUMN_NAME_LENGTH) {
            columnName = columnName.slice(0, CrossSourceJoinService.MAX_COLUMN_NAME_LENGTH);
        }

        let normalized = columnName.toLowerCase();
        
        // Remove common suffixes
        normalized = normalized.replace(/_id$/, '');
        normalized = normalized.replace(/_key$/, '');
        normalized = normalized.replace(/_code$/, '');
        
        // Remove underscores for comparison
        normalized = normalized.replace(/_/g, '');
        
        return normalized;
    }

    /**
     * Check if two data types are compatible for joining
     */
    private areTypesCompatible(type1: string, type2: string): boolean {
        const normalizeType = (type: string): string => {
            type = type.toLowerCase();
            
            // Integer types
            if (/int|integer|serial|bigint|smallint/.test(type)) return 'integer';
            
            // String types
            if (/varchar|char|text|string/.test(type)) return 'string';
            
            // Numeric types
            if (/numeric|decimal|float|double|real/.test(type)) return 'numeric';
            
            // Date types
            if (/date|timestamp|time/.test(type)) return 'date';
            
            // Boolean
            if (/bool/.test(type)) return 'boolean';
            
            return type;
        };

        return normalizeType(type1) === normalizeType(type2);
    }

    /**
     * Calculate confidence score for column name match
     * Returns 0-100 score
     */
    private calculateNameMatchConfidence(col1: string, col2: string): number {
        const norm1 = this.normalizeColumnName(col1);
        const norm2 = this.normalizeColumnName(col2);

        // Exact match after normalization
        if (norm1 === norm2) {
            return 95;
        }

        // Calculate similarity based on Levenshtein distance
        const distance = this.levenshteinDistance(norm1, norm2);
        const maxLength = Math.max(norm1.length, norm2.length);
        const similarity = 1 - (distance / maxLength);

        // Convert to 0-100 scale
        const score = Math.round(similarity * 100);

        // Only consider matches above 60% similar
        return score >= 60 ? score : 0;
    }

    /**
     * Suggest join columns between two tables based on heuristics
     */
    public async suggestJoins(leftTable: ITable, rightTable: ITable): Promise<IJoinSuggestion[]> {
        const suggestions: IJoinSuggestion[] = [];

        // Iterate through all column pairs
        for (const leftCol of leftTable.columns) {
            for (const rightCol of rightTable.columns) {
                // Check type compatibility first (faster check)
                if (!this.areTypesCompatible(leftCol.data_type, rightCol.data_type)) {
                    continue;
                }

                // Calculate name similarity
                const confidence = this.calculateNameMatchConfidence(
                    leftCol.column_name,
                    rightCol.column_name
                );

                if (confidence > 0) {
                    const leftFullPath = `${leftCol.schema}.${leftCol.table_name}.${leftCol.column_name}`;
                    const rightFullPath = `${rightCol.schema}.${rightCol.table_name}.${rightCol.column_name}`;

                    let reason = '';
                    if (confidence >= 95) {
                        reason = 'Column names are identical or nearly identical';
                    } else if (confidence >= 80) {
                        reason = `Column names are very similar (${leftCol.column_name} ≈ ${rightCol.column_name})`;
                    } else {
                        reason = `Column names are similar (${leftCol.column_name} ≈ ${rightCol.column_name})`;
                    }

                    reason += ` and types are compatible (${leftCol.data_type}, ${rightCol.data_type})`;

                    suggestions.push({
                        leftColumn: leftFullPath,
                        rightColumn: rightFullPath,
                        leftTableName: leftTable.table_name,
                        rightTableName: rightTable.table_name,
                        leftColumnName: leftCol.column_name,
                        rightColumnName: rightCol.column_name,
                        confidence,
                        reason,
                        suggestedJoinType: 'INNER'
                    });
                }
            }
        }

        // Sort by confidence (highest first)
        suggestions.sort((a, b) => b.confidence - a.confidence);

        // Return top 5 suggestions
        return suggestions.slice(0, 5);
    }

    /**
     * Save a successful join to the catalog for future reuse
     */
    public async saveJoinToCatalog(joinDef: IJoinDefinition): Promise<void> {
        try {
            const repository = await this.getRepository();

            // Check if this join already exists
            const existing = await repository.findOne({
                where: {
                    left_data_source_id: joinDef.leftDataSourceId,
                    left_table_name: joinDef.leftTableName,
                    left_column_name: joinDef.leftColumnName,
                    right_data_source_id: joinDef.rightDataSourceId,
                    right_table_name: joinDef.rightTableName,
                    right_column_name: joinDef.rightColumnName
                }
            });

            if (existing) {
                // Increment usage count
                existing.usage_count += 1;
                await repository.save(existing);
                console.log(`[CrossSourceJoinService] Incremented usage count for existing join (now ${existing.usage_count})`);
            } else {
                // Create new catalog entry
                const newEntry = repository.create({
                    left_data_source_id: joinDef.leftDataSourceId,
                    left_table_name: joinDef.leftTableName,
                    left_column_name: joinDef.leftColumnName,
                    right_data_source_id: joinDef.rightDataSourceId,
                    right_table_name: joinDef.rightTableName,
                    right_column_name: joinDef.rightColumnName,
                    join_type: joinDef.joinType,
                    usage_count: 1,
                    created_by_user_id: joinDef.createdByUserId
                });

                await repository.save(newEntry);
                console.log('[CrossSourceJoinService] Saved new join to catalog');
            }
        } catch (error) {
            console.error('[CrossSourceJoinService] Error saving join to catalog:', error);
            throw error;
        }
    }

    /**
     * Get popular joins between two data sources from catalog
     * Returns most frequently used joins
     */
    public async getPopularJoins(
        leftDataSourceId: number,
        rightDataSourceId: number,
        limit: number = 10
    ): Promise<DRACrossSourceJoinCatalog[]> {
        try {
            const repository = await this.getRepository();

            const joins = await repository.find({
                where: [
                    {
                        left_data_source_id: leftDataSourceId,
                        right_data_source_id: rightDataSourceId
                    },
                    // Also check reverse direction
                    {
                        left_data_source_id: rightDataSourceId,
                        right_data_source_id: leftDataSourceId
                    }
                ],
                order: {
                    usage_count: 'DESC',
                    created_at: 'DESC'
                },
                take: limit
            });

            return joins;
        } catch (error) {
            console.error('[CrossSourceJoinService] Error fetching popular joins:', error);
            return [];
        }
    }

    /**
     * Get join suggestions combining heuristics and catalog
     * Returns catalog suggestions first (higher confidence), then heuristic suggestions
     */
    public async getCombinedSuggestions(
        leftTable: ITable,
        rightTable: ITable
    ): Promise<IJoinSuggestion[]> {
        const suggestions: IJoinSuggestion[] = [];

        // 1. Get suggestions from catalog (most reliable)
        const catalogJoins = await this.getPopularJoins(
            leftTable.data_source_id,
            rightTable.data_source_id,
            5
        );

        for (const catalogJoin of catalogJoins) {
            // Check if these tables are in the catalog join
            const matchesDirection1 = 
                catalogJoin.left_table_name === leftTable.table_name &&
                catalogJoin.right_table_name === rightTable.table_name;

            const matchesDirection2 = 
                catalogJoin.left_table_name === rightTable.table_name &&
                catalogJoin.right_table_name === leftTable.table_name;

            if (matchesDirection1 || matchesDirection2) {
                suggestions.push({
                    leftColumn: matchesDirection1 
                        ? `${leftTable.schema}.${catalogJoin.left_table_name}.${catalogJoin.left_column_name}`
                        : `${leftTable.schema}.${catalogJoin.right_table_name}.${catalogJoin.right_column_name}`,
                    rightColumn: matchesDirection1
                        ? `${rightTable.schema}.${catalogJoin.right_table_name}.${catalogJoin.right_column_name}`
                        : `${rightTable.schema}.${catalogJoin.left_table_name}.${catalogJoin.left_column_name}`,
                    leftTableName: leftTable.table_name,
                    rightTableName: rightTable.table_name,
                    leftColumnName: matchesDirection1 ? catalogJoin.left_column_name : catalogJoin.right_column_name,
                    rightColumnName: matchesDirection1 ? catalogJoin.right_column_name : catalogJoin.left_column_name,
                    confidence: 100, // Catalog joins get max confidence
                    reason: `Previously used join (${catalogJoin.usage_count} times)`,
                    suggestedJoinType: catalogJoin.join_type
                });
            }
        }

        // 2. Add heuristic suggestions
        const heuristicSuggestions = await this.suggestJoins(leftTable, rightTable);
        
        // Filter out duplicates already in catalog
        for (const heuristic of heuristicSuggestions) {
            const isDuplicate = suggestions.some(
                s => s.leftColumnName === heuristic.leftColumnName &&
                     s.rightColumnName === heuristic.rightColumnName
            );

            if (!isDuplicate) {
                suggestions.push(heuristic);
            }
        }

        return suggestions;
    }
}
