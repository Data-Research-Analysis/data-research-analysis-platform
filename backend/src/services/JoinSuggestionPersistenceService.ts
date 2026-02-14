import { DataSource as TypeORMDataSource, In } from 'typeorm';
import { AppDataSource } from '../datasources/PostgresDS.js';
import { DRAAIJoinSuggestion } from '../models/DRAAIJoinSuggestion.js';
import { SchemaHashUtil } from '../utils/SchemaHashUtil.js';
import { DataSource } from 'typeorm';

export interface JoinSuggestion {
    left_table: string;
    left_column: string;
    right_table: string;
    right_column: string;
    suggested_join_type: string;
    confidence_score: number;
    reasoning?: string;
    is_junction_table?: boolean;
    metadata?: Record<string, any>;
}

export interface SaveJoinSuggestionsParams {
    dataSourceId: number;
    schemaName?: string;
    schemaHash: string;
    suggestions: JoinSuggestion[];
    userId: number;
}

/**
 * Service for persisting AI join suggestions to PostgreSQL
 * Provides permanent storage with schema-based invalidation
 */
export class JoinSuggestionPersistenceService {
    private static instance: JoinSuggestionPersistenceService;
    private repository = AppDataSource.getRepository(DRAAIJoinSuggestion);

    private constructor() {}

    public static getInstance(): JoinSuggestionPersistenceService {
        if (!JoinSuggestionPersistenceService.instance) {
            JoinSuggestionPersistenceService.instance = new JoinSuggestionPersistenceService();
        }
        return JoinSuggestionPersistenceService.instance;
    }

    /**
     * Save join suggestions to PostgreSQL
     * Replaces any existing suggestions for the same data source and schema hash
     */
    async saveJoinSuggestions(params: SaveJoinSuggestionsParams): Promise<void> {
        const { dataSourceId, schemaName, schemaHash, suggestions, userId } = params;

        // Delete existing suggestions for this data source and schema hash
        await this.repository.delete({
            data_source_id: dataSourceId,
            schema_name: schemaName || null,
        });

        // Save new suggestions
        const entities = suggestions.map(suggestion => {
            const entity = new DRAAIJoinSuggestion();
            entity.data_source_id = dataSourceId;
            entity.schema_name = schemaName;
            entity.schema_hash = schemaHash;
            entity.left_table = suggestion.left_table;
            entity.left_column = suggestion.left_column;
            entity.right_table = suggestion.right_table;
            entity.right_column = suggestion.right_column;
            entity.suggested_join_type = suggestion.suggested_join_type;
            entity.confidence_score = suggestion.confidence_score;
            entity.reasoning = suggestion.reasoning;
            entity.is_junction_table = suggestion.is_junction_table || false;
            entity.metadata = suggestion.metadata;
            entity.created_by_user_id = userId;
            return entity;
        });

        if (entities.length > 0) {
            await this.repository.save(entities);
        }
    }

    /**
     * Get join suggestions from PostgreSQL
     * Returns null if schema hash doesn't match (suggestions are stale)
     */
    async getJoinSuggestions(
        dataSourceId: number,
        schemaHash: string,
        schemaName?: string
    ): Promise<JoinSuggestion[] | null> {
        const suggestions = await this.repository.find({
            where: {
                data_source_id: dataSourceId,
                schema_hash: schemaHash,
                schema_name: schemaName || null,
            },
            order: {
                confidence_score: 'DESC',
                left_table: 'ASC',
            },
        });

        if (suggestions.length === 0) {
            return null;
        }

        return suggestions.map(s => ({
            left_table: s.left_table,
            left_column: s.left_column,
            right_table: s.right_table,
            right_column: s.right_column,
            suggested_join_type: s.suggested_join_type,
            confidence_score: s.confidence_score,
            reasoning: s.reasoning,
            is_junction_table: s.is_junction_table,
            metadata: s.metadata,
        }));
    }

    /**
     * Get join suggestions for specific tables
     */
    async getJoinSuggestionsForTables(
        dataSourceId: number,
        schemaHash: string,
        tables: string[],
        schemaName?: string
    ): Promise<JoinSuggestion[] | null> {
        if (tables.length === 0) {
            return this.getJoinSuggestions(dataSourceId, schemaHash, schemaName);
        }

        const suggestions = await this.repository
            .createQueryBuilder('suggestion')
            .where('suggestion.data_source_id = :dataSourceId', { dataSourceId })
            .andWhere('suggestion.schema_hash = :schemaHash', { schemaHash })
            .andWhere(
                '(suggestion.left_table IN (:...tables) OR suggestion.right_table IN (:...tables))',
                { tables }
            )
            .andWhere('suggestion.schema_name = :schemaName OR suggestion.schema_name IS NULL', {
                schemaName: schemaName || null,
            })
            .orderBy('suggestion.confidence_score', 'DESC')
            .addOrderBy('suggestion.left_table', 'ASC')
            .getMany();

        if (suggestions.length === 0) {
            return null;
        }

        return suggestions.map(s => ({
            left_table: s.left_table,
            left_column: s.left_column,
            right_table: s.right_table,
            right_column: s.right_column,
            suggested_join_type: s.suggested_join_type,
            confidence_score: s.confidence_score,
            reasoning: s.reasoning,
            is_junction_table: s.is_junction_table,
            metadata: s.metadata,
        }));
    }

    /**
     * Check if suggestions exist and are valid for a data source
     */
    async hasSuggestions(
        dataSourceId: number,
        schemaHash: string,
        schemaName?: string
    ): Promise<boolean> {
        const count = await this.repository.count({
            where: {
                data_source_id: dataSourceId,
                schema_hash: schemaHash,
                schema_name: schemaName || null,
            },
        });

        return count > 0;
    }

    /**
     * Invalidate all suggestions for a data source (e.g., when schema changes)
     */
    async invalidateSuggestionsForDataSource(dataSourceId: number): Promise<void> {
        await this.repository.delete({
            data_source_id: dataSourceId,
        });
    }

    /**
     * Invalidate suggestions for a specific schema
     */
    async invalidateSuggestionsForSchema(
        dataSourceId: number,
        schemaName?: string
    ): Promise<void> {
        await this.repository.delete({
            data_source_id: dataSourceId,
            schema_name: schemaName || null,
        });
    }

    /**
     * Get statistics about cached suggestions
     */
    async getSuggestionStats(dataSourceId: number): Promise<{
        total: number;
        by_schema: Array<{ schema_name: string | null; count: number; schema_hash: string }>;
        by_confidence: Array<{ range: string; count: number }>;
    }> {
        const total = await this.repository.count({
            where: { data_source_id: dataSourceId },
        });

        const bySchema = await this.repository
            .createQueryBuilder('suggestion')
            .select('suggestion.schema_name', 'schema_name')
            .addSelect('suggestion.schema_hash', 'schema_hash')
            .addSelect('COUNT(*)', 'count')
            .where('suggestion.data_source_id = :dataSourceId', { dataSourceId })
            .groupBy('suggestion.schema_name')
            .addGroupBy('suggestion.schema_hash')
            .getRawMany();

        const byConfidence = await this.repository
            .createQueryBuilder('suggestion')
            .select(
                `CASE 
                    WHEN confidence_score >= 90 THEN 'high (90-100)'
                    WHEN confidence_score >= 70 THEN 'medium (70-89)'
                    ELSE 'low (0-69)'
                END`,
                'range'
            )
            .addSelect('COUNT(*)', 'count')
            .where('suggestion.data_source_id = :dataSourceId', { dataSourceId })
            .groupBy('range')
            .getRawMany();

        return {
            total,
            by_schema: bySchema,
            by_confidence: byConfidence,
        };
    }
}
