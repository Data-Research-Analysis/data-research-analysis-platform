/**
 * AI-002: Data Model Context Builder
 * 
 * Builds rich context from data model metadata for use in AI prompts.
 * Extracts structure, lineage, health, classification, and data source info
 * from actual DRADataModel fields and related entities.
 */

import { getAppDataSource } from '../datasources/PostgresDS.js';
import { DRADataModel } from '../models/DRADataModel.js';
import { DRADataModelLineage } from '../models/DRADataModelLineage.js';
import { DRADataSource } from '../models/DRADataSource.js';
import { In, IsNull, Not } from 'typeorm';

export interface DataModelContext {
    /** Data model ID */
    id: number;
    /** Logical model name */
    name: string;
    /** Schema name */
    schema: string;
    /** SQL query used to build this model */
    sqlQuery: string;
    /** Query structure (table, columns, etc.) */
    queryStructure: Record<string, any>;
    /** Physical table name extracted from query */
    tableName: string;
    /** Data layer classification (Bronze/Silver/Gold) */
    dataLayer?: string;
    /** Model type classification */
    modelType?: string;
    /** Health status */
    healthStatus: string;
    /** Health issues if any */
    healthIssues: Record<string, any>[];
    /** Whether this model spans multiple data sources */
    isCrossSource: boolean;
    /** Row count from materialized data */
    rowCount?: number;
    /** Source row count across all source tables */
    sourceRowCount?: number;
    /** Layer-specific configuration */
    layerConfig: Record<string, any>;
    /** Execution metadata */
    executionMetadata: Record<string, any>;
    /** Parent data models this is composed from (lineage) */
    parentModels: LineageRelationship[];
    /** Child data models that depend on this one */
    childModels: LineageRelationship[];
    /** Connected data sources */
    dataSources: DataSourceInfo[];
}

export interface LineageRelationship {
    modelId: number;
    modelName?: string;
    modelSchema?: string;
    dataLayer?: string;
    modelType?: string;
}

export interface DataSourceInfo {
    dataSourceId: number;
    name?: string;
    sourceType?: string;
}

export interface DataContextResult {
    /** Rich context for each data model */
    models: DataModelContext[];
    /** Cross-model lineage graph */
    lineageGraph: LineageEdge[];
}

export interface LineageEdge {
    fromModel: string;
    fromId: number;
    toModel: string;
    toId: number;
    direction: 'parent' | 'child';
}

export class DataModelContextBuilder {

    /**
     * Build rich data model context for a set of data model IDs.
     * Loads full metadata including lineage, health, classification, and data sources.
     */
    async buildContext(dataModelIds: number[]): Promise<DataContextResult> {
        if (!dataModelIds || dataModelIds.length === 0) {
            return { models: [], lineageGraph: [] };
        }

        const dataSource = await getAppDataSource();
        const manager = dataSource.manager;

        // Load data models with lineage and source relations
        const dataModels = await manager.find(DRADataModel, {
            where: { id: In(dataModelIds) },
            relations: ['parent_lineages', 'parent_lineages.parent_data_model', 'child_lineages', 'child_lineages.child_data_model', 'data_model_sources', 'data_model_sources.data_source']
        });

        if (!dataModels || dataModels.length === 0) {
            return { models: [], lineageGraph: [] };
        }

        // Build context for each model
        const models: DataModelContext[] = [];
        const lineageGraph: LineageEdge[] = [];

        for (const dm of dataModels) {
            const context = this.buildSingleModelContext(dm);
            models.push(context);

            // Extract lineage graph edges
            for (const parent of context.parentModels) {
                lineageGraph.push({
                    fromModel: context.name,
                    fromId: context.id,
                    toModel: parent.modelName || `model_${parent.modelId}`,
                    toId: parent.modelId,
                    direction: 'parent'
                });
            }
            for (const child of context.childModels) {
                lineageGraph.push({
                    fromModel: context.name,
                    fromId: context.id,
                    toModel: child.modelName || `model_${child.modelId}`,
                    toId: child.modelId,
                    direction: 'child'
                });
            }
        }

        return { models, lineageGraph };
    }

    /**
     * Build context for a single data model entity.
     */
    private buildSingleModelContext(dm: DRADataModel): DataModelContext {
        const queryObj = (dm.query || {}) as Record<string, any>;
        const tableName = queryObj.table || dm.name || 'unknown';

        // Parse parent lineage
        const parentModels: LineageRelationship[] = [];
        if (dm.parent_lineages && dm.parent_lineages.length > 0) {
            for (const lineage of dm.parent_lineages) {
                const parent = lineage.parent_data_model;
                if (parent) {
                    parentModels.push({
                        modelId: parent.id,
                        modelName: parent.name,
                        modelSchema: parent.schema,
                        dataLayer: parent.data_layer || undefined,
                        modelType: parent.model_type || undefined
                    });
                }
            }
        }

        // Parse child lineage
        const childModels: LineageRelationship[] = [];
        if (dm.child_lineages && dm.child_lineages.length > 0) {
            for (const lineage of dm.child_lineages) {
                const child = lineage.child_data_model;
                if (child) {
                    childModels.push({
                        modelId: child.id,
                        modelName: child.name,
                        modelSchema: child.schema,
                        dataLayer: child.data_layer || undefined,
                        modelType: child.model_type || undefined
                    });
                }
            }
        }

        // Parse data sources
        const dataSources: DataSourceInfo[] = [];
        if (dm.data_model_sources && dm.data_model_sources.length > 0) {
            for (const src of dm.data_model_sources) {
                dataSources.push({
                    dataSourceId: src.data_source?.id || src.data_source_id,
                    name: (src.data_source as any)?.name,
                    sourceType: (src.data_source as any)?.source_type
                });
            }
        }

        return {
            id: dm.id,
            name: dm.name,
            schema: dm.schema,
            sqlQuery: dm.sql_query,
            queryStructure: queryObj,
            tableName,
            dataLayer: dm.data_layer || undefined,
            modelType: dm.model_type || undefined,
            healthStatus: dm.health_status,
            healthIssues: Array.isArray(dm.health_issues) ? dm.health_issues : [],
            isCrossSource: dm.is_cross_source,
            rowCount: dm.row_count || undefined,
            sourceRowCount: dm.source_row_count || undefined,
            layerConfig: dm.layer_config || {},
            executionMetadata: dm.execution_metadata || {},
            parentModels,
            childModels,
            dataSources
        };
    }

    /**
     * Format data model context as a markdown section for AI prompts.
     * This produces a structured text block that gives the AI full visibility
     * into the data model's structure, lineage, health, and classification.
     */
    formatContextAsMarkdown(result: DataContextResult): string {
        const parts: string[] = [];

        if (result.models.length === 0) {
            return '';
        }

        parts.push('# Data Model Context\n');

        // Overview
        parts.push(`## Overview`);
        parts.push(`This analysis covers ${result.models.length} data model(s):\n`);
        for (const model of result.models) {
            const layerLabel = model.dataLayer ? ` [${model.dataLayer}]` : '';
            const typeLabel = model.modelType ? ` (${model.modelType})` : '';
            parts.push(`- **${model.name}**${layerLabel}${typeLabel} — schema: ${model.schema}, table: ${model.tableName}`);
        }

        // Per-model details
        for (const model of result.models) {
            parts.push(`\n---\n## Model: ${model.name}`);

            // Classification
            parts.push(`\n### Classification`);
            parts.push(`- **Data Layer:** ${model.dataLayer || 'Unclassified'}`);
            parts.push(`- **Model Type:** ${model.modelType || 'Unclassified'}`);
            parts.push(`- **Health Status:** ${model.healthStatus}`);
            parts.push(`- **Cross-Source:** ${model.isCrossSource ? 'Yes' : 'No'}`);

            // Scale
            parts.push(`\n### Scale`);
            if (model.rowCount !== undefined) {
                parts.push(`- **Materialized Rows:** ${model.rowCount.toLocaleString()}`);
            }
            if (model.sourceRowCount !== undefined) {
                parts.push(`- **Source Rows (all tables):** ${model.sourceRowCount.toLocaleString()}`);
            }

            // Health Issues
            if (model.healthIssues.length > 0) {
                parts.push(`\n### Health Issues`);
                for (const issue of model.healthIssues) {
                    const severity = issue.severity || 'info';
                    const message = issue.message || issue.description || JSON.stringify(issue);
                    parts.push(`- [${severity}] ${message}`);
                }
            }

            // SQL Query
            parts.push(`\n### SQL Query`);
            parts.push('```sql');
            parts.push(model.sqlQuery);
            parts.push('```');

            // Query Structure
            const queryKeys = Object.keys(model.queryStructure);
            if (queryKeys.length > 0) {
                parts.push(`\n### Query Structure`);
                parts.push('```json');
                parts.push(JSON.stringify(model.queryStructure, null, 2));
                parts.push('```');
            }

            // Layer Config
            const layerKeys = Object.keys(model.layerConfig);
            if (layerKeys.length > 0) {
                parts.push(`\n### Layer Configuration`);
                parts.push('```json');
                parts.push(JSON.stringify(model.layerConfig, null, 2));
                parts.push('```');
            }

            // Data Sources
            if (model.dataSources.length > 0) {
                parts.push(`\n### Data Sources`);
                for (const src of model.dataSources) {
                    parts.push(`- **${src.name || 'Source #' + src.dataSourceId}** (type: ${src.sourceType || 'unknown'})`);
                }
            }

            // Parent Lineage (what this model is composed from)
            if (model.parentModels.length > 0) {
                parts.push(`\n### Composed From (Parent Models)`);
                for (const parent of model.parentModels) {
                    const layerLabel = parent.dataLayer ? ` [${parent.dataLayer}]` : '';
                    const typeLabel = parent.modelType ? ` (${parent.modelType})` : '';
                    parts.push(`- **${parent.modelName || 'Model #' + parent.modelId}**${layerLabel}${typeLabel} (schema: ${parent.modelSchema || 'unknown'})`);
                }
            }

            // Child Lineage (what depends on this model)
            if (model.childModels.length > 0) {
                parts.push(`\n### Dependent Models (Children)`);
                for (const child of model.childModels) {
                    const layerLabel = child.dataLayer ? ` [${child.dataLayer}]` : '';
                    const typeLabel = child.modelType ? ` (${child.modelType})` : '';
                    parts.push(`- **${child.modelName || 'Model #' + child.modelId}**${layerLabel}${typeLabel} (schema: ${child.modelSchema || 'unknown'})`);
                }
            }
        }

        // Cross-model lineage graph
        if (result.lineageGraph.length > 0) {
            parts.push(`\n---\n## Data Model Lineage Graph`);
            parts.push('The following shows parent-child composition relationships:\n');
            for (const edge of result.lineageGraph) {
                if (edge.direction === 'parent') {
                    parts.push(`- ${edge.fromModel} **is composed from** ${edge.toModel}`);
                } else {
                    parts.push(`- ${edge.fromModel} **feeds into** ${edge.toModel}`);
                }
            }
        }

        return parts.join('\n');
    }
}