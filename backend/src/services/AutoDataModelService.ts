/**
 * Auto Data Model Creation Service
 *
 * Automatically creates data models from detected schema after schema detection.
 * For each table, creates a base SELECT * data model (raw_data layer).
 * For marketing/API sources, also creates derived metric data models
 * (business_ready layer) based on MarketingKPIMatcher templates.
 *
 * Supports both single-source and multi-source batch creation with
 * automatic join detection for same-source foreign key relationships.
 */

import { AppDataSource } from '../datasources/PostgresDS.js';
import { DRADataModel } from '../models/DRADataModel.js';
import { DRADataSource } from '../models/DRADataSource.js';
import { DRADataModelSource } from '../models/DRADataModelSource.js';
import {
    SchemaAutoDetectionService,
} from './SchemaAutoDetectionService.js';
import {
    ISchemaDetectionResult,
    IDetectedTable,
    IDetectedForeignKey,
} from './detection/ISchemaDetectionResult.js';

// ─── Local Interfaces ─────────────────────────────────────────────────────────

interface IAutoCreateOptions {
    data_source_id: number;
    schema_name?: string;
    table_names?: string[];
    skip_existing: boolean;
    users_platform_id: number;
    organization_id?: number;
    workspace_id?: number;
}

/**
 * Options for multi-source batch auto-creation.
 * Each entry can target a different data source with its own table filters.
 */
interface IBatchAutoCreateOptions {
    /** Array of data source configurations to auto-create for */
    data_sources: IBatchDataSourceEntry[];
    /** Skip tables that already have auto-created data models */
    skip_existing: boolean;
    /** User creating the models */
    users_platform_id: number;
    /** Organization ID for multi-tenant scoping */
    organization_id?: number;
    /** Workspace ID for multi-tenant scoping */
    workspace_id?: number;
}

interface IBatchDataSourceEntry {
    data_source_id: number;
    schema_name?: string;
    table_names?: string[];
}

interface IDerivedMetric {
    metric_name: string;
    metric_label: string;
    category: string;
    expression: string;
    description: string;
    source_tables: string[];
    depends_on_columns: string[];
}

interface IAutoCreateResult {
    data_source_id: number;
    detection_result: ISchemaDetectionResult;
    created_models: ICreatedModel[];
    skipped_tables: string[];
    errors: IAutoCreateError[];
    join_suggestions: IJoinSuggestion[];
    summary: {
        tables_detected: number;
        tables_processed: number;
        total_models_created: number;
        base_models_created: number;
        derived_models_created: number;
        tables_skipped: number;
        errors_count: number;
        join_suggestions_count: number;
    };
}

/**
 * Result for multi-source batch auto-creation
 */
interface IBatchAutoCreateResult {
    results: IAutoCreateResult[];
    cross_source_join_suggestions: ICrossSourceJoinSuggestion[];
    summary: {
        total_data_sources: number;
        total_tables_detected: number;
        total_models_created: number;
        total_base_models: number;
        total_derived_models: number;
        total_join_suggestions: number;
        total_errors: number;
    };
}

interface ICreatedModel {
    id: number;
    name: string;
    table_name: string;
    model_type: 'base' | 'derived';
    data_layer: string;
}

interface IAutoCreateError {
    table_name: string;
    error: string;
    model_type: 'base' | 'derived';
}

/**
 * Join suggestion between two tables within the same data source
 */
interface IJoinSuggestion {
    source_table: string;
    source_column: string;
    target_table: string;
    target_column: string;
    confidence: number;
    match_type: 'foreign_key' | 'column_name' | 'data_type_pattern';
    description: string;
}

/**
 * Cross-source join suggestion for multi-source batch results
 */
interface ICrossSourceJoinSuggestion {
    left_data_source_id: number;
    left_table_name: string;
    left_column_name: string;
    right_data_source_id: number;
    right_table_name: string;
    right_column_name: string;
    confidence: number;
    match_type: 'column_name' | 'kpi_column';
    description: string;
}

// ─── Marketing Source Types ────────────────────────────────────────────────────

const MARKETING_API_SOURCES = new Set([
    'google_analytics',
    'google_ads',
    'meta_ads',
    'facebook',
    'linkedin_ads',
    'hubspot',
    'klaviyo',
    'google_ad_manager',
    'mailchimp',
    'tiktok_ads',
    'snapchat_ads',
]);

// ─── Derived Metric Templates ─────────────────────────────────────────────────

interface IDerivedMetricTemplate {
    metric_name: string;
    metric_label: string;
    category: string;
    expression: string;
    description: string;
    required_tables: string[];
    required_kpi_columns: string[];
}

/**
 * Source-specific derived metric templates for known API sources
 */
const SOURCE_SPECIFIC_TEMPLATES: IDerivedMetricTemplate[] = [
    // Google Analytics templates
    {
        metric_name: 'ctr',
        metric_label: 'Click-Through Rate',
        category: 'engagement',
        expression: 'CASE WHEN SUM(impressions) > 0 THEN ROUND(SUM(clicks)::numeric / SUM(impressions) * 100, 2) ELSE 0 END AS ctr',
        description: 'Percentage of impressions that resulted in clicks',
        required_tables: ['campaign_report', 'traffic_sources', 'landing_pages'],
        required_kpi_columns: ['clicks', 'impressions'],
    },
    {
        metric_name: 'bounce_rate',
        metric_label: 'Bounce Rate',
        category: 'engagement',
        expression: 'CASE WHEN SUM(sessions) > 0 THEN ROUND(SUM(bounces)::numeric / SUM(sessions) * 100, 2) ELSE 0 END AS bounce_rate',
        description: 'Percentage of sessions where users left without interacting',
        required_tables: ['campaign_report', 'traffic_sources', 'landing_pages'],
        required_kpi_columns: ['sessions', 'bounces'],
    },
    {
        metric_name: 'conversion_rate',
        metric_label: 'Conversion Rate',
        category: 'performance',
        expression: 'CASE WHEN SUM(sessions) > 0 THEN ROUND(SUM(conversions)::numeric / SUM(sessions) * 100, 2) ELSE 0 END AS conversion_rate',
        description: 'Percentage of sessions that resulted in conversions',
        required_tables: ['campaign_report'],
        required_kpi_columns: ['sessions', 'conversions'],
    },
    {
        metric_name: 'revenue_per_session',
        metric_label: 'Revenue per Session',
        category: 'performance',
        expression: 'CASE WHEN SUM(sessions) > 0 THEN ROUND(SUM(revenue)::numeric / SUM(sessions), 2) ELSE 0 END AS revenue_per_session',
        description: 'Average revenue generated per session',
        required_tables: ['campaign_report'],
        required_kpi_columns: ['sessions', 'revenue'],
    },
    // Google Ads / Meta Ads templates
    {
        metric_name: 'cost_per_click',
        metric_label: 'Cost per Click (CPC)',
        category: 'cost',
        expression: 'CASE WHEN SUM(clicks) > 0 THEN ROUND(SUM(spend)::numeric / SUM(clicks), 2) ELSE 0 END AS cost_per_click',
        description: 'Average cost paid per click',
        required_tables: ['campaign_performance', 'ad_group_performance', 'ad_performance'],
        required_kpi_columns: ['spend', 'clicks'],
    },
    {
        metric_name: 'cost_per_conversion',
        metric_label: 'Cost per Conversion',
        category: 'cost',
        expression: 'CASE WHEN SUM(conversions) > 0 THEN ROUND(SUM(spend)::numeric / SUM(conversions), 2) ELSE 0 END AS cost_per_conversion',
        description: 'Average cost per conversion',
        required_tables: ['campaign_performance', 'ad_group_performance', 'ad_performance'],
        required_kpi_columns: ['spend', 'conversions'],
    },
    {
        metric_name: 'cost_per_mille',
        metric_label: 'Cost per Mille (CPM)',
        category: 'cost',
        expression: 'CASE WHEN SUM(impressions) > 0 THEN ROUND(SUM(spend)::numeric / SUM(impressions) * 1000, 2) ELSE 0 END AS cost_per_mille',
        description: 'Cost per 1000 impressions',
        required_tables: ['campaign_performance', 'ad_group_performance', 'ad_performance'],
        required_kpi_columns: ['spend', 'impressions'],
    },
    {
        metric_name: 'ad_ctr',
        metric_label: 'Ad Click-Through Rate',
        category: 'performance',
        expression: 'CASE WHEN SUM(impressions) > 0 THEN ROUND(SUM(clicks)::numeric / SUM(impressions) * 100, 2) ELSE 0 END AS ad_ctr',
        description: 'Percentage of ad impressions that resulted in clicks',
        required_tables: ['campaign_performance', 'ad_group_performance', 'ad_performance'],
        required_kpi_columns: ['clicks', 'impressions'],
    },
    {
        metric_name: 'return_on_ad_spend',
        metric_label: 'Return on Ad Spend (ROAS)',
        category: 'performance',
        expression: 'CASE WHEN SUM(spend) > 0 THEN ROUND(SUM(revenue)::numeric / SUM(spend), 2) ELSE 0 END AS return_on_ad_spend',
        description: 'Revenue generated per dollar spent on advertising',
        required_tables: ['campaign_performance', 'ad_group_performance', 'ad_performance'],
        required_kpi_columns: ['spend', 'revenue'],
    },
    // Email / Klaviyo templates
    {
        metric_name: 'open_rate',
        metric_label: 'Email Open Rate',
        category: 'engagement',
        expression: 'CASE WHEN SUM(sends) > 0 THEN ROUND(SUM(opens)::numeric / SUM(sends) * 100, 2) ELSE 0 END AS open_rate',
        description: 'Percentage of sent emails that were opened',
        required_tables: ['campaigns', 'flows'],
        required_kpi_columns: ['sends', 'opens'],
    },
    {
        metric_name: 'click_rate',
        metric_label: 'Email Click Rate',
        category: 'engagement',
        expression: 'CASE WHEN SUM(sends) > 0 THEN ROUND(SUM(clicks)::numeric / SUM(sends) * 100, 2) ELSE 0 END AS click_rate',
        description: 'Percentage of sent emails that received clicks',
        required_tables: ['campaigns', 'flows'],
        required_kpi_columns: ['sends', 'clicks'],
    },
    {
        metric_name: 'revenue_per_recipient',
        metric_label: 'Revenue per Recipient',
        category: 'performance',
        expression: 'CASE WHEN SUM(sends) > 0 THEN ROUND(SUM(revenue)::numeric / SUM(sends), 2) ELSE 0 END AS revenue_per_recipient',
        description: 'Average revenue generated per email sent',
        required_tables: ['campaigns', 'flows'],
        required_kpi_columns: ['sends', 'revenue'],
    },
    // HubSpot templates
    {
        metric_name: 'lead_to_mql_rate',
        metric_label: 'Lead to MQL Rate',
        category: 'conversion',
        expression: 'CASE WHEN SUM(leads) > 0 THEN ROUND(SUM(mqls)::numeric / SUM(leads) * 100, 2) ELSE 0 END AS lead_to_mql_rate',
        description: 'Percentage of leads that became marketing qualified',
        required_tables: ['contacts', 'deals', 'companies'],
        required_kpi_columns: ['leads', 'mqls'],
    },
    {
        metric_name: 'deal_close_rate',
        metric_label: 'Deal Close Rate',
        category: 'performance',
        expression: 'CASE WHEN COUNT(deals) > 0 THEN ROUND(SUM(CASE WHEN deal_stage = \'closedwon\' THEN 1 ELSE 0 END)::numeric / COUNT(deals) * 100, 2) ELSE 0 END AS deal_close_rate',
        description: 'Percentage of deals that were won',
        required_tables: ['deals'],
        required_kpi_columns: ['deals'],
    },
];

/**
 * Generic derived metric templates that can match ANY source with the right KPI columns.
 * These are matched against the actual detected column names (via MarketingKPIMatcher),
 * not against specific table names. This allows auto-creation of derived metrics
 * for file uploads, databases, and API sources alike.
 */
const GENERIC_METRIC_TEMPLATES: IDerivedMetricTemplate[] = [
    // CTR — clicks / impressions
    {
        metric_name: 'generic_ctr',
        metric_label: 'Click-Through Rate (CTR)',
        category: 'engagement',
        expression: 'CASE WHEN SUM("impressions") > 0 THEN ROUND(SUM("clicks")::numeric / SUM("impressions") * 100, 2) ELSE 0 END AS "ctr"',
        description: 'Percentage of impressions that resulted in clicks',
        required_tables: ['*'], // match any table with the required columns
        required_kpi_columns: ['clicks', 'impressions'],
    },
    // CPC — spend / clicks
    {
        metric_name: 'generic_cpc',
        metric_label: 'Cost per Click (CPC)',
        category: 'cost',
        expression: 'CASE WHEN SUM("clicks") > 0 THEN ROUND(SUM("spend")::numeric / SUM("clicks"), 2) ELSE 0 END AS "cost_per_click"',
        description: 'Average cost per click',
        required_tables: ['*'],
        required_kpi_columns: ['spend', 'clicks'],
    },
    // CPA — spend / conversions
    {
        metric_name: 'generic_cpa',
        metric_label: 'Cost per Acquisition (CPA)',
        category: 'cost',
        expression: 'CASE WHEN SUM("conversions") > 0 THEN ROUND(SUM("spend")::numeric / SUM("conversions"), 2) ELSE 0 END AS "cost_per_acquisition"',
        description: 'Average cost per conversion/acquisition',
        required_tables: ['*'],
        required_kpi_columns: ['spend', 'conversions'],
    },
    // CPL — spend / leads
    {
        metric_name: 'generic_cpl',
        metric_label: 'Cost per Lead (CPL)',
        category: 'cost',
        expression: 'CASE WHEN SUM("leads") > 0 THEN ROUND(SUM("spend")::numeric / SUM("leads"), 2) ELSE 0 END AS "cost_per_lead"',
        description: 'Average cost per lead generated',
        required_tables: ['*'],
        required_kpi_columns: ['spend', 'leads'],
    },
    // ROAS — revenue / spend
    {
        metric_name: 'generic_roas',
        metric_label: 'Return on Ad Spend (ROAS)',
        category: 'performance',
        expression: 'CASE WHEN SUM("spend") > 0 THEN ROUND(SUM("revenue")::numeric / SUM("spend"), 2) ELSE 0 END AS "roas"',
        description: 'Revenue generated per dollar spent on advertising',
        required_tables: ['*'],
        required_kpi_columns: ['spend', 'revenue'],
    },
    // CPM — (spend / impressions) * 1000
    {
        metric_name: 'generic_cpm',
        metric_label: 'Cost per Mille (CPM)',
        category: 'cost',
        expression: 'CASE WHEN SUM("impressions") > 0 THEN ROUND(SUM("spend")::numeric / SUM("impressions") * 1000, 2) ELSE 0 END AS "cost_per_mille"',
        description: 'Cost per 1000 impressions',
        required_tables: ['*'],
        required_kpi_columns: ['spend', 'impressions'],
    },
    // Conversion Rate — conversions / clicks
    {
        metric_name: 'generic_conversion_rate',
        metric_label: 'Conversion Rate',
        category: 'performance',
        expression: 'CASE WHEN SUM("clicks") > 0 THEN ROUND(SUM("conversions")::numeric / SUM("clicks") * 100, 2) ELSE 0 END AS "conversion_rate"',
        description: 'Percentage of clicks that resulted in conversions',
        required_tables: ['*'],
        required_kpi_columns: ['clicks', 'conversions'],
    },
];

// ─── Common FK naming patterns for join detection ─────────────────────────────

const FK_COLUMN_PATTERNS: Array<{ pattern: RegExp; confidence: number }> = [
    // Explicit FK pattern: table_id or tableid
    { pattern: /(.+)[-_]id$/i, confidence: 0.95 },
    // Reference pattern: ref_table or reftable
    { pattern: /ref[_]?([a-z_]+)/i, confidence: 0.85 },
    // FK_ prefix pattern
    { pattern: /fk[_]?([a-z_]+)/i, confidence: 0.9 },
];

// ─── Service Implementation ───────────────────────────────────────────────────

export class AutoDataModelService {
    private static instance: AutoDataModelService;

    private constructor() {}

    public static getInstance(): AutoDataModelService {
        if (!AutoDataModelService.instance) {
            AutoDataModelService.instance = new AutoDataModelService();
        }
        return AutoDataModelService.instance;
    }

    /**
     * Main entry point: Auto-create data models for a single data source.
     */
    public async autoCreate(options: IAutoCreateOptions): Promise<IAutoCreateResult> {
        const {
            data_source_id,
            schema_name,
            table_names,
            skip_existing = true,
            users_platform_id,
            organization_id,
            workspace_id,
        } = options;

        // Step 1: Detect schema
        const detectionService = SchemaAutoDetectionService.getInstance();
        const detectionResult: ISchemaDetectionResult = await detectionService.detect({
            source_type: await this.getSourceType(data_source_id),
            data_source_id,
            schema_name,
            include_row_estimates: false, // Skip for performance during auto-create
        });

        // Step 2: Determine which tables to process
        let tablesToProcess = detectionResult.tables;

        if (table_names && table_names.length > 0) {
            tablesToProcess = tablesToProcess.filter(t =>
                table_names.includes(t.table_name)
            );
        }

        // Filter out internal tables that are not user source data:
        //   - Materialized auto-created model tables (*_auto_)
        //   - Data model lineage/composition tables (data_model_*)
        // Without this filter, previous runs' materialized tables get detected
        // and match generic KPI templates, creating duplicate derived models
        // with double ds{id}_ prefixes (e.g. ds114_ds114_01b3c8f1_auto_).
        const autoTablePattern = /_auto_$/i;
        const dataModelTablePattern = /^data_model_/i;
        tablesToProcess = tablesToProcess.filter(t =>
            !autoTablePattern.test(t.table_name) &&
            !dataModelTablePattern.test(t.table_name)
        );

        // Step 3: Get existing models to skip already-created tables
        const manager = AppDataSource.manager;
        const existingModels = await manager.find(DRADataModel, {
            where: { data_source: { id: data_source_id } },
            relations: ['data_model_sources'],
        });

        const existingModelNames = new Set(existingModels.map(m => m.name));

        if (skip_existing) {
            const skipped: string[] = [];
            tablesToProcess = tablesToProcess.filter(t => {
                const physicalName = `ds${data_source_id}_${this.sanitizeName(t.table_name)}_auto_`;
                if (existingModelNames.has(physicalName)) {
                    skipped.push(t.table_name);
                    return false;
                }
                return true;
            });
        }

        // Step 4: Detect same-source join suggestions (PK/FK relationships)
        const joinSuggestions = this.detectJoinSuggestions(tablesToProcess, detectionResult);

        // Step 5: Create base data models (raw_data layer)
        const createdModels: ICreatedModel[] = [];
        const errors: IAutoCreateError[] = [];
        const skippedTables: string[] = [];

        // Track all model physical names (existing DB + newly created) to prevent duplicates
        const allModelNames = new Set(existingModelNames);
        const addCreatedName = (name: string) => allModelNames.add(name);

        for (const table of tablesToProcess) {
            try {
                const model = await this.createBaseModel(
                    data_source_id,
                    table,
                    users_platform_id,
                    organization_id,
                    workspace_id
                );
                addCreatedName(model.name);
                createdModels.push({
                    id: model.id,
                    name: model.name,
                    table_name: table.table_name,
                    model_type: 'base',
                    data_layer: 'raw_data',
                });
            } catch (error: any) {
                console.error(`[AutoDataModelService] Failed to create base model for table ${table.table_name}:`, error.message);
                errors.push({
                    table_name: table.table_name,
                    error: error.message,
                    model_type: 'base',
                });
            }
        }

        // Step 6: Create derived metric models
        const sourceType = await this.getSourceType(data_source_id);
        const isMarketingSource = MARKETING_API_SOURCES.has(sourceType);

        if (isMarketingSource) {
            // Use source-specific templates for known API sources
            const derivedMetrics = this.matchDerivedMetrics(tablesToProcess, sourceType);

            for (const metric of derivedMetrics) {
                const sourceTable = tablesToProcess.find(t =>
                    metric.source_tables.includes(t.table_name)
                );
                if (!sourceTable) {
                    skippedTables.push(metric.metric_name);
                    continue;
                }

                // Skip if a derived model with this physical name already exists
                const derivedPhysicalName = `ds${data_source_id}_${this.sanitizeName(metric.metric_label)}_auto_`;
                if (allModelNames.has(derivedPhysicalName)) {
                    skippedTables.push(metric.metric_name);
                    continue;
                }

                try {
                    const derivedModel = await this.createDerivedModel(
                        data_source_id,
                        metric,
                        sourceTable,
                        users_platform_id,
                        organization_id,
                        workspace_id
                    );
                    addCreatedName(derivedModel.name);
                    createdModels.push({
                        id: derivedModel.id,
                        name: derivedModel.name,
                        table_name: sourceTable.table_name,
                        model_type: 'derived',
                        data_layer: 'business_ready',
                    });
                } catch (error: any) {
                    console.error(`[AutoDataModelService] Failed to create derived model ${metric.metric_name}:`, error.message);
                    errors.push({
                        table_name: sourceTable.table_name,
                        error: error.message,
                        model_type: 'derived',
                    });
                }
            }
        }

        // Step 7: Also create generic derived metrics for ANY source that has matching KPI columns
        const genericMetrics = this.matchGenericMetrics(tablesToProcess);
        for (const metric of genericMetrics) {
            // Find the source table (first table that has the required columns)
            const sourceTable = tablesToProcess.find(t =>
                metric.source_tables.includes(t.table_name)
            );
            if (!sourceTable) continue;

            // Skip if a source-specific template already created this metric type (in this run)
            const alreadyCreated = createdModels.some(m =>
                m.model_type === 'derived' &&
                m.table_name === sourceTable.table_name &&
                this.metricsOverlap(m.name, metric.metric_label)
            );
            if (alreadyCreated) continue;

            // Skip if a derived model with this physical name already exists (from any previous run)
            const derivedPhysicalName = `ds${data_source_id}_${this.sanitizeName(metric.metric_label)}_auto_`;
            if (allModelNames.has(derivedPhysicalName)) {
                skippedTables.push(metric.metric_name);
                continue;
            }

            try {
                const derivedModel = await this.createDerivedModel(
                    data_source_id,
                    metric,
                    sourceTable,
                    users_platform_id,
                    organization_id,
                    workspace_id
                );
                addCreatedName(derivedModel.name);
                createdModels.push({
                    id: derivedModel.id,
                    name: derivedModel.name,
                    table_name: sourceTable.table_name,
                    model_type: 'derived',
                    data_layer: 'business_ready',
                });
            } catch (error: any) {
                console.error(`[AutoDataModelService] Failed to create generic derived model ${metric.metric_name}:`, error.message);
                errors.push({
                    table_name: sourceTable.table_name,
                    error: error.message,
                    model_type: 'derived',
                });
            }
        }

        // Step 8: Build summary
        const baseModels = createdModels.filter(m => m.model_type === 'base');
        const derivedModels = createdModels.filter(m => m.model_type === 'derived');

        return {
            data_source_id,
            detection_result: detectionResult,
            created_models: createdModels,
            skipped_tables: [...skippedTables],
            errors,
            join_suggestions: joinSuggestions,
            summary: {
                tables_detected: detectionResult.tables.length,
                tables_processed: tablesToProcess.length,
                total_models_created: createdModels.length,
                base_models_created: baseModels.length,
                derived_models_created: derivedModels.length,
                tables_skipped: skip_existing
                    ? detectionResult.tables.length - tablesToProcess.length
                    : 0,
                errors_count: errors.length,
                join_suggestions_count: joinSuggestions.length,
            },
        };
    }

    /**
     * Multi-source batch auto-create: Creates data models for multiple data sources
     * and generates cross-source join suggestions.
     */
    public async autoCreateBatch(options: IBatchAutoCreateOptions): Promise<IBatchAutoCreateResult> {
        const {
            data_sources,
            skip_existing,
            users_platform_id,
            organization_id,
            workspace_id,
        } = options;

        const results: IAutoCreateResult[] = [];
        const crossSourceJoinSuggestions: ICrossSourceJoinSuggestion[] = [];

        // Create data models for each data source
        for (const ds of data_sources) {
            try {
                const result = await this.autoCreate({
                    data_source_id: ds.data_source_id,
                    schema_name: ds.schema_name,
                    table_names: ds.table_names,
                    skip_existing,
                    users_platform_id,
                    organization_id,
                    workspace_id,
                });
                results.push(result);
            } catch (error: any) {
                console.error(`[AutoDataModelService] Batch auto-create failed for data source ${ds.data_source_id}:`, error.message);
                // Create a minimal error result
                results.push({
                    data_source_id: ds.data_source_id,
                    detection_result: {
                        data_source_id: ds.data_source_id,
                        source_type: 'unknown',
                        tables: [],
                        detected_at: new Date().toISOString(),
                        errors: [error.message],
                        total_tables: 0,
                        summary: {
                            fact_tables: 0,
                            dimension_tables: 0,
                            total_columns: 0,
                            total_kpi_columns: 0,
                            total_dimension_columns: 0,
                            total_time_columns: 0,
                        },
                    },
                    created_models: [],
                    skipped_tables: [],
                    errors: [{ table_name: '*', error: error.message, model_type: 'base' }],
                    join_suggestions: [],
                    summary: {
                        tables_detected: 0,
                        tables_processed: 0,
                        total_models_created: 0,
                        base_models_created: 0,
                        derived_models_created: 0,
                        tables_skipped: 0,
                        errors_count: 1,
                        join_suggestions_count: 0,
                    },
                });
            }
        }

        // Generate cross-source join suggestions between data sources
        if (results.length > 1) {
            for (let i = 0; i < results.length; i++) {
                for (let j = i + 1; j < results.length; j++) {
                    const suggestions = this.detectCrossSourceJoins(
                        results[i].data_source_id,
                        results[i].detection_result.tables,
                        results[j].data_source_id,
                        results[j].detection_result.tables
                    );
                    crossSourceJoinSuggestions.push(...suggestions);
                }
            }
        }

        // Build aggregate summary
        let totalModelsCreated = 0;
        let totalBaseModels = 0;
        let totalDerivedModels = 0;
        let totalTablesDetected = 0;
        let totalErrors = 0;
        let totalJoinSuggestions = 0;

        for (const r of results) {
            totalModelsCreated += r.summary.total_models_created;
            totalBaseModels += r.summary.base_models_created;
            totalDerivedModels += r.summary.derived_models_created;
            totalTablesDetected += r.summary.tables_detected;
            totalErrors += r.summary.errors_count;
            totalJoinSuggestions += r.summary.join_suggestions_count;
        }

        return {
            results,
            cross_source_join_suggestions: crossSourceJoinSuggestions,
            summary: {
                total_data_sources: results.length,
                total_tables_detected: totalTablesDetected,
                total_models_created: totalModelsCreated,
                total_base_models: totalBaseModels,
                total_derived_models: totalDerivedModels,
                total_join_suggestions: totalJoinSuggestions + crossSourceJoinSuggestions.length,
                total_errors: totalErrors,
            },
        };
    }

    /**
     * Detect same-source join suggestions based on column naming patterns and FK metadata.
     */
    private detectJoinSuggestions(
        tables: IDetectedTable[],
        detectionResult: ISchemaDetectionResult
    ): IJoinSuggestion[] {
        const suggestions: IJoinSuggestion[] = [];
        const tableNameSet = new Set(tables.map(t => t.table_name.toLowerCase().replace(/[_\s]/g, '')));

        // Strategy 1: Use explicitly detected foreign keys from schema detection
        for (const table of tables) {
            for (const fk of table.foreign_keys) {
                suggestions.push({
                    source_table: table.table_name,
                    source_column: fk.column_name,
                    target_table: fk.foreign_table_name,
                    target_column: fk.foreign_column_name,
                    confidence: 1.0,
                    match_type: 'foreign_key',
                    description: `Foreign key constraint "${fk.constraint_name}" detected between ${table.table_name}.${fk.column_name} and ${fk.foreign_table_name}.${fk.foreign_column_name}`,
                });
            }
        }

        // Strategy 2: Pattern-based FK detection from column names
        for (const table of tables) {
            for (const col of table.columns) {
                const colName = col.column_name.toLowerCase();

                for (const fkPattern of FK_COLUMN_PATTERNS) {
                    const match = colName.match(fkPattern.pattern);
                    if (!match) continue;

                    // Extract the referenced table name from the column name
                    let refTableName = match[1];
                    if (!refTableName) continue;

                    // Normalize: "campaign_id" → "campaign", "campaign_ref" → "campaign"
                    refTableName = refTableName.replace(/[_-]$/, '');

                    // Check if this matches any detected table name
                    const normalizedRef = refTableName.toLowerCase().replace(/[_\s]/g, '');
                    const matchedTable = tables.find(t => {
                        const normalizedT = t.table_name.toLowerCase().replace(/[_\s]/g, '');
                        return normalizedT === normalizedRef ||
                               normalizedT === normalizedRef + 's' ||
                               normalizedT === normalizedRef + 'es' ||
                               normalizedT + 's' === normalizedRef ||
                               normalizedT + 'es' === normalizedRef;
                    });

                    if (matchedTable && matchedTable.table_name !== table.table_name) {
                        // Check for duplicate
                        const exists = suggestions.some(s =>
                            s.source_table === table.table_name &&
                            s.source_column === col.column_name &&
                            s.target_table === matchedTable.table_name
                        );
                        if (!exists) {
                            // Determine the target column (usually 'id' or the table's PK)
                            const targetColumn = matchedTable.primary_keys.length > 0
                                ? matchedTable.primary_keys[0]
                                : 'id';

                            suggestions.push({
                                source_table: table.table_name,
                                source_column: col.column_name,
                                target_table: matchedTable.table_name,
                                target_column: targetColumn,
                                confidence: fkPattern.confidence,
                                match_type: 'column_name',
                                description: `Column "${col.column_name}" in "${table.table_name}" appears to reference table "${matchedTable.table_name}" based on naming convention`,
                            });
                        }
                    }
                }
            }
        }

        // Deduplicate and sort by confidence
        const deduped = this.deduplicateJoinSuggestions(suggestions);
        deduped.sort((a, b) => b.confidence - a.confidence);

        return deduped;
    }

    /**
     * Detect cross-source join suggestions between tables from different data sources.
     * Uses column name matching and KPI column alignment.
     */
    private detectCrossSourceJoins(
        leftDataSourceId: number,
        leftTables: IDetectedTable[],
        rightDataSourceId: number,
        rightTables: IDetectedTable[]
    ): ICrossSourceJoinSuggestion[] {
        const suggestions: ICrossSourceJoinSuggestion[] = [];

        for (const leftTable of leftTables) {
            for (const leftCol of leftTable.columns) {
                const leftName = leftCol.column_name.toLowerCase();

                // Check dimension columns — these are likely join keys across sources
                if (leftCol.role !== 'dimension' && leftCol.role !== 'time') continue;

                for (const rightTable of rightTables) {
                    for (const rightCol of rightTable.columns) {
                        const rightName = rightCol.column_name.toLowerCase();

                        if (rightCol.role !== 'dimension' && rightCol.role !== 'time') continue;

                        // Exact name match on dimension/time columns
                        if (leftName === rightName) {
                            const exists = suggestions.some(s =>
                                s.left_table_name === leftTable.table_name &&
                                s.left_column_name === leftCol.column_name &&
                                s.right_table_name === rightTable.table_name &&
                                s.right_column_name === rightCol.column_name
                            );
                            if (!exists) {
                                suggestions.push({
                                    left_data_source_id: leftDataSourceId,
                                    left_table_name: leftTable.table_name,
                                    left_column_name: leftCol.column_name,
                                    right_data_source_id: rightDataSourceId,
                                    right_table_name: rightTable.table_name,
                                    right_column_name: rightCol.column_name,
                                    confidence: 0.85,
                                    match_type: 'column_name',
                                    description: `Dimension column "${leftCol.column_name}" exists in both "${leftTable.table_name}" (DS ${leftDataSourceId}) and "${rightTable.table_name}" (DS ${rightDataSourceId})`,
                                });
                            }
                        }

                        // Match on the same KPI pattern (e.g., both match "campaign" dimension)
                        if (leftCol.dimension_match && leftCol.dimension_match === rightCol.dimension_match &&
                            leftName !== rightName) {
                            const exists = suggestions.some(s =>
                                s.left_table_name === leftTable.table_name &&
                                s.left_column_name === leftCol.column_name &&
                                s.right_table_name === rightTable.table_name &&
                                s.right_column_name === rightCol.column_name
                            );
                            if (!exists) {
                                suggestions.push({
                                    left_data_source_id: leftDataSourceId,
                                    left_table_name: leftTable.table_name,
                                    left_column_name: leftCol.column_name,
                                    right_data_source_id: rightDataSourceId,
                                    right_table_name: rightTable.table_name,
                                    right_column_name: rightCol.column_name,
                                    confidence: 0.7,
                                    match_type: 'kpi_column',
                                    description: `Both columns match dimension pattern "${leftCol.dimension_match}": "${leftCol.column_name}" in "${leftTable.table_name}" ↔ "${rightCol.column_name}" in "${rightTable.table_name}"`,
                                });
                            }
                        }
                    }
                }
            }
        }

        suggestions.sort((a, b) => b.confidence - a.confidence);
        return suggestions;
    }

    /**
     * Deduplicate join suggestions, keeping the highest confidence match for each unique pair
     */
    private deduplicateJoinSuggestions(suggestions: IJoinSuggestion[]): IJoinSuggestion[] {
        const map = new Map<string, IJoinSuggestion>();

        for (const s of suggestions) {
            const key = `${s.source_table}:${s.source_column}:${s.target_table}:${s.target_column}`;
            const existing = map.get(key);
            if (!existing || s.confidence > existing.confidence) {
                map.set(key, s);
            }
        }

        return Array.from(map.values());
    }

    /**
     * Match detected tables against source-specific derived metric templates.
     */
    private matchDerivedMetrics(
        tables: IDetectedTable[],
        sourceType: string
    ): IDerivedMetric[] {
        const matched: IDerivedMetric[] = [];
        const tableNames = new Set(tables.map(t => t.table_name));

        for (const template of SOURCE_SPECIFIC_TEMPLATES) {
            const hasRequiredTable = template.required_tables.some(rt =>
                tableNames.has(rt)
            );

            if (!hasRequiredTable) continue;

            const matchedTable = tables.find(t =>
                template.required_tables.includes(t.table_name)
            );
            if (!matchedTable) continue;

            const columnNames = new Set(matchedTable.columns.map(c => c.column_name.toLowerCase()));
            const hasRequiredColumns = template.required_kpi_columns.every(col =>
                columnNames.has(col.toLowerCase())
            );

            if (!hasRequiredColumns) continue;

            matched.push({
                metric_name: template.metric_name,
                metric_label: template.metric_label,
                category: template.category,
                expression: template.expression,
                description: template.description,
                source_tables: template.required_tables.filter(rt => tableNames.has(rt)),
                depends_on_columns: template.required_kpi_columns,
            });
        }

        return matched;
    }

    /**
     * Match generic derived metric templates against detected KPI columns.
     * These use MarketingKPIMatcher's column classification to find tables
     * that have the required KPI columns regardless of source type.
     */
    private matchGenericMetrics(tables: IDetectedTable[]): IDerivedMetric[] {
        const matched: IDerivedMetric[] = [];

        for (const template of GENERIC_METRIC_TEMPLATES) {
            for (const table of tables) {
                // Build a set of normalized column names for this table
                const columnNames = new Set(
                    table.columns.map(c => c.column_name.toLowerCase().replace(/[_\s]/g, ''))
                );

                // Also check kpi_match columns
                const kpiColumns = new Set(
                    table.columns
                        .filter(c => c.kpi_match)
                        .map(c => c.kpi_match!.toLowerCase())
                );

                // Check if all required KPI columns exist (by name or kpi_match)
                const hasAllColumns = template.required_kpi_columns.every(requiredCol => {
                    const normalizedRequired = requiredCol.toLowerCase().replace(/[_\s]/g, '');
                    return columnNames.has(normalizedRequired) || kpiColumns.has(normalizedRequired);
                });

                if (!hasAllColumns) continue;

                // Build the expression using the actual column names from the table
                const expression = this.buildGenericExpression(template, table);

                matched.push({
                    metric_name: `${template.metric_name}_${table.table_name}`,
                    metric_label: `${template.metric_label}`,
                    category: template.category,
                    expression,
                    description: template.description,
                    source_tables: [table.table_name],
                    depends_on_columns: template.required_kpi_columns,
                });
            }
        }

        return matched;
    }

    /**
     * Build a SQL expression for a generic metric template, using actual column names from the table.
     */
    private buildGenericExpression(template: IDerivedMetricTemplate, table: IDetectedTable): string {
        let expression = template.expression;

        // Replace generic column references with actual column names from the table
        for (const requiredCol of template.required_kpi_columns) {
            const normalizedRequired = requiredCol.toLowerCase().replace(/[_\s]/g, '');

            // Find the actual column in the table
            const actualCol = table.columns.find(c => {
                const normalizedColName = c.column_name.toLowerCase().replace(/[_\s]/g, '');
                return normalizedColName === normalizedRequired ||
                       (c.kpi_match && c.kpi_match.toLowerCase() === normalizedRequired);
            });

            if (actualCol && actualCol.column_name !== requiredCol) {
                // Replace the generic name with the actual column name in the expression
                expression = expression.replace(
                    new RegExp(`"${requiredCol}"`, 'g'),
                    `"${actualCol.column_name}"`
                );
            }
        }

        return expression;
    }

    /**
     * Check if a metric label overlaps with an existing model name
     * (to avoid creating duplicate derived metrics)
     */
    private metricsOverlap(existingName: string, newLabel: string): boolean {
        const normalizeExisting = existingName.toLowerCase().replace(/\(auto\)/g, '').trim();
        const normalizeNew = newLabel.toLowerCase().trim();
        return normalizeExisting.includes(normalizeNew) || normalizeNew.includes(normalizeExisting);
    }

    /**
     * Create a base SELECT * data model for a table.
     */
    private async createBaseModel(
        dataSourceId: number,
        table: IDetectedTable,
        usersPlatformId: number,
        organizationId?: number,
        workspaceId?: number
    ): Promise<DRADataModel> {
        const manager = AppDataSource.manager;
        const dataSource = await manager.findOne(DRADataSource, { where: { id: dataSourceId } });
        if (!dataSource) {
            throw new Error(`Data source ${dataSourceId} not found`);
        }

        const schemaPrefix = table.schema_name ? `"${table.schema_name}".` : '';
        const tableName = table.table_name;

        const logicalName = `${this.sanitizeName(tableName)}_auto_`;
        const physicalName = `ds${dataSourceId}_${logicalName}`;

        const queryJSON: Record<string, any> = this.buildDataTableJSON(
            logicalName,
            table,
            table.schema_name || 'public'
        );

        const sqlQuery = `SELECT * FROM ${schemaPrefix}"${tableName}"`;

        const dataModel = new DRADataModel();
        dataModel.schema = 'public';
        dataModel.name = physicalName;
        dataModel.query = JSON.parse(JSON.stringify(queryJSON));
        dataModel.sql_query = sqlQuery;
        dataModel.data_source = dataSource;
        dataModel.users_platform = { id: usersPlatformId } as any;
        dataModel.data_layer = 'raw_data';
        dataModel.model_type = 'dimension';
        dataModel.auto_refresh_enabled = true;
        dataModel.is_auto_created = true;
        if (organizationId) dataModel.organization_id = organizationId;
        if (workspaceId) dataModel.workspace_id = workspaceId;

        const savedModel = await manager.save(DRADataModel, dataModel);

        const junction = new DRADataModelSource();
        junction.data_model_id = savedModel.id;
        junction.data_source_id = dataSourceId;
        junction.users_platform_id = usersPlatformId;
        if (organizationId) junction.organization_id = organizationId;
        if (workspaceId) junction.workspace_id = workspaceId;
        await manager.save(DRADataModelSource, junction);

        await this.materializeTable(manager, savedModel);

        console.log(`[AutoDataModelService] Created base model "${physicalName}" (ID: ${savedModel.id})`);
        return savedModel;
    }

    /**
     * Create a derived metric data model.
     */
    private async createDerivedModel(
        dataSourceId: number,
        metric: IDerivedMetric,
        sourceTable: IDetectedTable,
        usersPlatformId: number,
        organizationId?: number,
        workspaceId?: number
    ): Promise<DRADataModel> {
        const manager = AppDataSource.manager;
        const dataSource = await manager.findOne(DRADataSource, { where: { id: dataSourceId } });
        if (!dataSource) {
            throw new Error(`Data source ${dataSourceId} not found`);
        }

        const schemaPrefix = sourceTable.schema_name ? `"${sourceTable.schema_name}".` : '';
        const tableName = sourceTable.table_name;

        const logicalName = `${this.sanitizeName(metric.metric_label)}_auto_`;
        const physicalName = `ds${dataSourceId}_${logicalName}`;

        const queryJSON: Record<string, any> = this.buildDerivedDataTableJSON(
            logicalName,
            sourceTable,
            metric,
            sourceTable.schema_name || 'public'
        );

        const sqlQuery = `SELECT ${metric.expression} FROM ${schemaPrefix}"${tableName}"`;

        const dataModel = new DRADataModel();
        dataModel.schema = 'public';
        dataModel.name = physicalName;
        dataModel.query = JSON.parse(JSON.stringify(queryJSON));
        dataModel.sql_query = sqlQuery;
        dataModel.data_source = dataSource;
        dataModel.users_platform = { id: usersPlatformId } as any;
        dataModel.data_layer = 'business_ready';
        dataModel.model_type = 'aggregated';
        dataModel.auto_refresh_enabled = true;
        dataModel.is_auto_created = true;
        if (organizationId) dataModel.organization_id = organizationId;
        if (workspaceId) dataModel.workspace_id = workspaceId;

        const savedModel = await manager.save(DRADataModel, dataModel);

        const junction = new DRADataModelSource();
        junction.data_model_id = savedModel.id;
        junction.data_source_id = dataSourceId;
        junction.users_platform_id = usersPlatformId;
        if (organizationId) junction.organization_id = organizationId;
        if (workspaceId) junction.workspace_id = workspaceId;
        await manager.save(DRADataModelSource, junction);

        await this.materializeTable(manager, savedModel);

        console.log(`[AutoDataModelService] Created derived model "${physicalName}" (ID: ${savedModel.id})`);
        return savedModel;
    }

    /**
     * Get the data source type for a given data source ID.
     */
    private async getSourceType(dataSourceId: number): Promise<string> {
        const manager = AppDataSource.manager;
        const dataSource = await manager.findOne(DRADataSource, {
            where: { id: dataSourceId },
            select: ['data_type'],
        });
        if (!dataSource) {
            throw new Error(`Data source ${dataSourceId} not found`);
        }
        return dataSource.data_type;
    }

    private sanitizeName(name: string): string {
        return name
            .replace(/[^a-zA-Z0-9_]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '');
    }

    /**
     * Parse an aggregate expression from metric templates into expression body and alias.
     * Metric expressions have the format:
     *   CASE WHEN SUM("clicks") > 0 THEN ... END AS "alias_name"
     * or:
     *   SUM("clicks") AS "total_clicks"
     */
    private parseAggregateExpression(expression: string): { expressionBody: string; alias: string } {
        const asMatch = expression.match(/\s+AS\s+(?:"([^"]+)"|(\w+))\s*$/i);
        if (asMatch) {
            const alias = asMatch[1] || asMatch[2];
            const expressionBody = expression.slice(0, asMatch.index).trim();
            return { expressionBody, alias };
        }
        return { expressionBody: expression, alias: expression };
    }

    /**
     * Build a frontend-builder-compatible data_table JSON structure from a detected table.
     * Auto-created models need this format so they can be opened and edited in the
     * data model builder without crashing (the builder expects state.data_table.columns
     * to be a populated array).
     */
    private buildDataTableJSON(
        logicalName: string,
        table: IDetectedTable,
        schema: string = 'public'
    ): Record<string, any> {
        const columns = table.columns.map(col => ({
            schema,
            table_name: table.table_name,
            column_name: col.column_name,
            data_type: col.native_type || col.detected_type || 'text',
            is_selected_column: true,
            alias_name: '',
            transform_function: '',
            table_logical_name: table.original_name || table.table_name || '',
            table_alias: null,
            character_maximum_length: col.max_length,
            reference: null,
        }));

        return {
            table_name: logicalName,
            columns,
            query_options: {
                where: [],
                group_by: {},
                order_by: [],
                offset: -1,
                limit: -1,
            },
            calculated_columns: [],
            hidden_referenced_columns: [],
            join_conditions: [],
            table_aliases: [],
        };
    }

    /**
     * Build a frontend-builder-compatible data_table JSON structure for a derived
     * (aggregated) metric model. Unlike buildDataTableJSON, this sets all source
     * columns as unselected and stores the aggregation expression in both
     * aggregate_expressions (for SQL reconstruction) and calculated_columns
     * (for builder UI display).
     */
    private buildDerivedDataTableJSON(
        logicalName: string,
        table: IDetectedTable,
        metric: IDerivedMetric,
        schema: string = 'public'
    ): Record<string, any> {
        const { expressionBody, alias } = this.parseAggregateExpression(metric.expression);

        const columns = table.columns.map(col => ({
            schema,
            table_name: table.table_name,
            column_name: col.column_name,
            data_type: col.native_type || col.detected_type || 'text',
            is_selected_column: false,
            alias_name: '',
            transform_function: '',
            table_logical_name: table.original_name || table.table_name || '',
            table_alias: null,
            character_maximum_length: col.max_length,
            reference: null,
        }));

        return {
            table_name: logicalName,
            columns,
            query_options: {
                where: [],
                group_by: {
                    group_by_columns: [],
                    aggregate_functions: [],
                    aggregate_expressions: [
                        {
                            expression: expressionBody,
                            column_alias_name: alias,
                            column_data_type: 'NUMERIC',
                        },
                    ],
                    having_conditions: [],
                },
                order_by: [],
                offset: -1,
                limit: -1,
            },
            calculated_columns: [
                {
                    column_name: alias,
                    expression: expressionBody,
                    data_type: 'NUMERIC',
                },
            ],
            hidden_referenced_columns: [],
            join_conditions: [],
            table_aliases: [],
        };
    }

    private async materializeTable(manager: any, dataModel: DRADataModel): Promise<void> {
        const schema = dataModel.schema || 'public';
        const modelName = dataModel.name;
        const timestamp = Date.now();
        const tempTableName = `${modelName}_temp_${timestamp}`;

        try {
            const createQuery = `CREATE TABLE "${schema}"."${tempTableName}" AS ${dataModel.sql_query}`;
            await manager.query(createQuery);

            const rowCount = await manager.query(
                `SELECT COUNT(*) as count FROM "${schema}"."${tempTableName}"`,
            );
            const count = parseInt(rowCount[0].count);

            if (count === 0) {
                await manager.query(`DROP TABLE IF EXISTS "${schema}"."${tempTableName}" CASCADE`);
                console.warn(`[AutoDataModelService] Skipping materialization for "${modelName}" — query returned 0 rows`);
                return;
            }

            await manager.query(`DROP TABLE IF EXISTS "${schema}"."${modelName}" CASCADE`);
            await manager.query(`ALTER TABLE "${schema}"."${tempTableName}" RENAME TO "${modelName}"`);

            console.log(`[AutoDataModelService] Materialized "${modelName}" with ${count} rows`);
        } catch (error: any) {
            await manager.query(`DROP TABLE IF EXISTS "${schema}"."${tempTableName}" CASCADE`);
            console.error(`[AutoDataModelService] Failed to materialize "${modelName}": ${error.message}`);
            throw error;
        }
    }
}