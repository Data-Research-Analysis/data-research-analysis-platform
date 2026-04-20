<script setup lang="ts">
import _ from 'lodash';
import { useOrganizationContext } from '@/composables/useOrganizationContext';
import { useAIDataModelerStore } from '~/stores/ai-data-modeler';
import { useSubscriptionStore } from '~/stores/subscription';
import { useLoggedInUserStore } from '~/stores/logged_in_user';
import { useTierLimits } from '~/composables/useTierLimits';
import { useDataModelHealth } from '~/composables/useDataModelHealth';
import { getAuthToken } from '@/composables/AuthToken';
import MongoDBQueryEditor from '~/components/data-sources/MongoDBQueryEditor.vue';
import SQLErrorAlert from '~/components/SQLErrorAlert.vue';

const { $swal } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const aiDataModelerStore = useAIDataModelerStore();
const subscriptionStore = useSubscriptionStore();
const { modalState: tierLimitModal, hideLimitModal } = useTierLimits();
const state: any = reactive({
    show_dialog: false,
    show_calculated_column_dialog: false,
    show_alias_dialog: false,
    show_join_dialog: false,
    show_advanced_features_dialog: false,
    viewMode: 'simple', // 'simple' or 'advanced'
    isInitialized: false, // Track if component has finished loading tables
    tables: [],
    table_aliases: [],
    editing_join_index: null, // Track which JOIN is being edited (null = creating new)
    // Issue #361 - Data Model Composition: Collapsible section controls
    show_data_source_section: true,
    show_data_model_section: true,
    alias_form: {
        table: '',
        alias: ''
    },
    join_conditions: [],
    join_form: {
        left_table: '',
        left_table_alias: null,
        left_column: '',
        right_table: '',
        right_table_alias: null,
        right_column: '',
        join_type: 'INNER',
        primary_operator: '=',
        join_logic: 'AND',
        additional_conditions: []
    },
    manual_joins: [],
    data_table: {
        table_name: 'data_model_table',
        columns: [],
        query_options: {
            where: [],
            group_by: {},
            order_by: [],
            offset: -1,
            limit: -1,
        },
        calculated_columns: [],
        hidden_referenced_columns: [], // NEW: Track columns used but not displayed
    },
    loading: false,
    query_options: [
        {
            name: 'WHERE',
        },
        {
            name: 'GROUP BY',
        },
        {
            name: 'ORDER BY',
        },
        {
            name: 'OFFSET',
        },
        {
            name: 'LIMIT',
        },
    ],
    equality: ['=', '>', '<', '>=', '<=', '!=', 'IN', 'NOT IN'],
    condition: ['AND', 'OR'],
    order: ['ASC', 'DESC'],
    aggregate_functions: ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX'],
    add_column_operators: ['ADD', 'SUBTRACT', 'MULTIPLY', 'DIVIDE', 'MODULO'],
    sql_query: '',
    response_from_external_data_source_columns: [],
    response_from_external_data_source_rows: [],
    query_metadata: null, // Store row limit metadata
    calculated_column: {},
    alerts: [],
    sqlError: null,  // SQL execution error for prominent display
    transform_functions: [
        { name: 'None', value: '', close_parens: 0 },
        { name: 'DATE', value: 'DATE', close_parens: 1 },
        { name: 'YEAR', value: 'EXTRACT(YEAR FROM', close_parens: 2 },
        { name: 'MONTH', value: 'EXTRACT(MONTH FROM', close_parens: 2 },
        { name: 'DAY', value: 'EXTRACT(DAY FROM', close_parens: 2 },
        { name: 'UPPER', value: 'UPPER', close_parens: 1 },
        { name: 'LOWER', value: 'LOWER', close_parens: 1 },
        { name: 'TRIM', value: 'TRIM', close_parens: 1 },
        { name: 'ROUND', value: 'ROUND', close_parens: 1 },
    ],
    // Guard flags for component lifecycle and async operations
    is_unmounting: false,
    is_executing_query: false,
    is_applying_ai_config: false,
    is_saving_model: false,
    query_execution_count: 0,
    is_initial_load: true, // Track if component is still initializing (prevents premature suggestion fetches)
    collapsed_tables: new Map(), // Track collapsed state for each table: key = `${schema}.${table_name}.${alias || 'base'}`, value = boolean
    // Issue #361 - Data Model Composition: Staleness warning state
    staleness_warning: null,
    // Issue #361 Phase 5: Composition layer recommendation
    composition_recommendation: null,
    composition_recommendation_loading: false,
    // Issue #361: Layer assignment
    selected_layer: null,
    showLayerWalkthrough: false,
    mongo_query: {
        collection: '',
        pipeline: '[]'
    }
});

// Computed properties for tier-based row limits
const userRowLimit = computed(() => {
    const limit = subscriptionStore.subscriptionStats?.rowLimit;
    return limit === -1 ? 999999999 : (limit || 100000); // -1 means unlimited (enterprise)
});

const userTierName = computed(() => {
    return subscriptionStore.subscriptionStats?.tier?.tier_name || 'FREE';
});

const isUnlimitedTier = computed(() => {
    const limit = subscriptionStore.subscriptionStats?.rowLimit;
    return limit === -1;
});

// Check if tables have any data
const hasTableData = computed(() => {
    // Don't show warning until component is initialized (prevents brief flash during load)
    if (!state.isInitialized) {
        return true; // Hide warning during initial load
    }
    
    // If we have no tables at all (empty array), show the warning
    if (!state.tables || state.tables.length === 0) {
        return false;
    }
    
    // Check if any table has columns with data
    return state.tables.some((table: any) => table.columns && table.columns.length > 0);
});

// Issue #361 - Data Model Composition: Computed property to reactively read data models from store
const dataModelsStore = useDataModelsStore();
const dataModelTables = computed(() => {
    return dataModelsStore.dataModelSourceTables || [];
});

// Issue #361 Phase 5: Detect if user is composing data models (not just data sources)
const selectedDataModelIds = computed(() => {
    const selectedModels: any[] = [];
    
    // Check columns for data models (schema starts with 'data_models_')
    if (state.data_table.columns) {
        for (const col of state.data_table.columns) {
            if (col.schema && col.schema.startsWith('data_models_')) {
                // Find the corresponding data model from dataModelTables
                const sourceModel = dataModelTables.value.find(
                    m => m.schema === col.schema && m.table_name === col.table_name
                );
                if (sourceModel && sourceModel.data_model_id && !selectedModels.includes(sourceModel.data_model_id)) {
                    selectedModels.push(sourceModel.data_model_id);
                }
            }
        }
    }
    
    return selectedModels;
});

const isComposingDataModels = computed(() => {
    return selectedDataModelIds.value.length > 0;
});

// Issue #361 Phase 5: Fetch composition layer recommendation
async function fetchCompositionRecommendation() {
    if (selectedDataModelIds.value.length === 0) {
        state.composition_recommendation = null;
        return;
    }
    
    state.composition_recommendation_loading = true;
    try {
        const token = getAuthToken();
        if (!token) throw new Error('Authentication required');
        
        const config = useRuntimeConfig();
        const response = await $fetch<any>(
            `${config.public.apiBase}/data-model/composition-layer-recommendation`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                    'Content-Type': 'application/json',
                },
                body: {
                    sourceDataModelIds: selectedDataModelIds.value,
                },
            }
        );
        
        if (response.success) {
            state.composition_recommendation = {
                suggestedLayer: response.suggestedLayer,
                reasoning: response.reasoning,
                sourceModels: response.sourceModels,
                flowWarnings: response.flowWarnings,
            };
        }
    } catch (error: any) {
        console.error('[DataModelBuilder] Failed to fetch composition recommendation:', error);
        state.composition_recommendation = null;
    } finally {
        state.composition_recommendation_loading = false;
    }
}

// Watch for changes in selected data models and fetch recommendation
watch(selectedDataModelIds, (newIds) => {
    if (newIds.length > 0) {
        // Debounce to avoid excessive API calls
        if (import.meta.client) {
            setTimeout(() => {
                if (selectedDataModelIds.value.length > 0) {
                    fetchCompositionRecommendation();
                }
            }, 500);
        }
    } else {
        state.composition_recommendation = null;
    }
}, { deep: true });

// Enforce tier limit on LIMIT input
function enforceLimitRestriction() {
    if (state.data_table.query_options.limit > userRowLimit.value) {
        $swal.fire({
            icon: 'error',
            title: 'Row Limit Exceeded',
            html: `
                <div class="text-left">
                    <p class="mb-4">Your <strong>${userTierName.value}</strong> tier allows a maximum of 
                    <strong>${userRowLimit.value.toLocaleString()}</strong> rows per data model.</p>
                    <p>The limit has been automatically adjusted to your maximum allowed value.</p>
                </div>
            `,
            confirmButtonColor: '#3C8DBC',
            confirmButtonText: 'OK',
        });
        state.data_table.query_options.limit = userRowLimit.value;
    }
}

interface Props {
    dataModel?: any
    dataSourceTables?: any[]
    dataSource?: any
    isEditDataModel?: boolean
    isCrossSource?: boolean
    projectId?: number | null
    readOnly?: boolean
}
const props = withDefaults(defineProps<Props>(), {
    dataModel: () => ({}),
    dataSourceTables: () => [],
    dataSource: null,
    isEditDataModel: false,
    isCrossSource: false,
    projectId: null,
    readOnly: false,
});

// ── Model Health composable ──────────────────────────────────────────────────
const health = useDataModelHealth(
    computed(() => state.data_table),
    computed(() => (props.isEditDataModel && props.dataModel?.id) ? props.dataModel.id : null),
    computed(() => props.dataModel?.organization_id),
    computed(() => props.dataModel?.workspace_id),
);

async function onMarkAsDimension() {
    const confirmed = await $swal.fire({
        icon: 'warning',
        title: 'Mark as Dimension Table?',
        html: `
            <div class="text-sm text-left space-y-2">
                <p>Marking this as a dimension table means:</p>
                <ul class="list-disc pl-5 space-y-1">
                    <li>It will be used for <strong>lookups and joins only</strong></li>
                    <li><strong class="text-red-600">It will NOT appear in dashboard chart builders</strong></li>
                    <li>Aggregation and row count checks will be bypassed</li>
                    <li>No size limits will be enforced</li>
                </ul>
                <p class="text-blue-600 font-medium mt-3">✓ Best for: Small reference tables (products, categories, regions)</p>
                <p class="text-amber-600 font-medium">⚠️ Use with caution: Large transaction tables should be aggregated, not marked as dimensional</p>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Mark as Dimension',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#3C8DBC',
    });
    if (confirmed.isConfirmed) {
        const ok = await health.setModelType('dimension');
        if (!ok) {
            $swal.fire({ icon: 'error', title: 'Error', text: 'Failed to update model type. Please try again.' });
        }
    }
}

/** Show the post-run health warning above the preview results table. */
const showBlockedModelWarning = computed(() =>
    health.status.value === 'blocked' &&
    state.response_from_external_data_source_rows.length > 0,
);

const showWhereClause = computed(() => {
    return state?.data_table?.query_options?.where?.length > 0;
});
const showOrderByClause = computed(() => {
    return state?.data_table?.query_options?.order_by?.length > 0;
});
const showGroupByClause = computed(() => {
    // Show GROUP BY section if name flag is set OR if aggregate functions/expressions exist
    if (state?.data_table?.query_options?.group_by?.name) return true;
    if (state?.data_table?.query_options?.group_by?.aggregate_functions?.some(
        (agg: any) => agg.aggregate_function !== '' && agg.column !== ''
    )) return true;
    if (state?.data_table?.query_options?.group_by?.aggregate_expressions?.some(
        (expr: any) => expr.expression && expr.expression !== ''
    )) return true;
    if (state?.data_table?.query_options?.group_by?.group_by_columns?.length > 0) return true;
    return false;
});
const showDataModelControls = computed(() => {
    return state && state.data_table && state.data_table.columns && state.data_table.columns.length > 0;
})
const saveButtonEnabled = computed(() => {
    // Disabled if read-only OR if there are no selected columns
    if (props.readOnly) return false;
    return state && state.data_table && state.data_table.columns && state.data_table.columns.filter((column: any) => column.is_selected_column).length > 0;
})
const safeDataTableColumns = computed(() => {
    return (state?.data_table?.columns && Array.isArray(state.data_table.columns)) ? state.data_table.columns : [];
})
const numericColumns = computed(() => {
    // Safety check: ensure columns array exists before filtering
    if (!state?.data_table?.columns || !Array.isArray(state.data_table.columns)) {
        return [];
    }
    return [...state.data_table.columns.filter((column: any) => getDataType(column.data_type) === 'NUMBER').map((column: any) => {
        return {
            schema: column.schema,
            table_name: column.table_name,
            column_name: column.column_name,
            data_type: getDataType(column.data_type),
        }
    })];
})
const isMongoDB = computed(() => {
    return props.dataSource?.type === 'MONGODB';
});

const collectionNames = computed(() => {
    return state.tables.map((table: any) => table.table_name);
});

function onMongoQueryUpdate(payload: any) {
    state.mongo_query.collection = payload.collection;
    state.mongo_query.pipeline = payload.pipeline;
}

async function onRunMongoQuery(payload: any) {
    if (payload) {
        state.mongo_query.collection = payload.collection;
        state.mongo_query.pipeline = payload.pipeline;
    }
    await executeQueryOnExternalDataSource();
}

const allAvailableColumns = computed(() => {
    const columns: any[] = [];

    // Safety check: ensure columns array exists
    if (!state?.data_table?.columns || !Array.isArray(state.data_table.columns)) {
        return columns;
    }

    // 1. Add base table columns
    state.data_table.columns.forEach((column: any) => {
        // Use logical table name for display
        const logicalTableName = column.table_logical_name || getTableLogicalName(column.schema, column.table_name);
        
        let displayName;
        if (column.alias_name && column.alias_name.trim() !== '') {
            displayName = column.alias_name;
        } else if (column.table_alias) {
            // Show alias with logical name: alias (LogicalTableName).column_name
            displayName = `${column.table_alias} (${logicalTableName}).${column.column_name}`;
        } else {
            // Show logical name format: LogicalTableName.column_name
            displayName = `${logicalTableName}.${column.column_name}`;
        }

        columns.push({
            value: `${column.schema}.${column.table_name}.${column.column_name}`,
            display: displayName,
            type: 'column',
            data_type: column.data_type,
            is_aggregate: false
        });
    });

    // 2. Add aggregate functions
    if (state.data_table.query_options?.group_by?.aggregate_functions) {
        state.data_table.query_options.group_by.aggregate_functions.forEach((aggFunc: any, index: any) => {
            if (aggFunc.column && aggFunc.aggregate_function !== '') {
                const funcName = state.aggregate_functions[aggFunc.aggregate_function];
                const aliasName = aggFunc.column_alias_name || `${funcName.toLowerCase()}_${aggFunc.column.split('.').pop()}`;
                
                // Format column reference with logical table name
                const columnDisplay = formatColumnReferenceWithLogicalName(aggFunc.column);

                columns.push({
                    value: aliasName,
                    display: `${funcName}(${columnDisplay})${aggFunc.use_distinct ? ' [DISTINCT]' : ''} AS ${aliasName}`,
                    type: 'aggregate_function',
                    data_type: 'NUMBER',
                    is_aggregate: true,
                    aggregate_index: index
                });
            }
        });
    }

    // 3. Add aggregate expressions
    if (state.data_table.query_options?.group_by?.aggregate_expressions) {
        state.data_table.query_options.group_by.aggregate_expressions.forEach((aggExpr: any, index: any) => {
            if (aggExpr.expression && aggExpr.expression.trim() !== '') {
                const aliasName = aggExpr.column_alias_name || `expr_${index}`;
                
                // Format expressions with logical table names
                const expressionDisplay = formatExpressionWithLogicalNames(aggExpr.expression);

                columns.push({
                    value: aliasName,
                    display: `${expressionDisplay} AS ${aliasName}`,
                    type: 'aggregate_expression',
                    data_type: 'NUMBER',
                    is_aggregate: true,
                    expression_index: index
                });
            }
        });
    }

    return columns;
});

const whereColumns = computed(() => {
    return allAvailableColumns.value.filter((col: any) => !col.is_aggregate);
});

/**
 * Columns available to add to GROUP BY - excludes columns already in group_by_columns
 * and columns that are used in aggregate functions/expressions
 */
const availableGroupByColumns = computed(() => {
    const currentGroupByCols = state.data_table.query_options?.group_by?.group_by_columns || [];
    return whereColumns.value.filter((col: any) => !currentGroupByCols.includes(col.value));
});

const havingColumns = computed(() => {
    if (showGroupByClause.value) {
        return allAvailableColumns.value.filter((col: any) => col.is_aggregate);
    }
    return [];
});

const orderByColumns = computed(() => {
    const columns: any[] = [];
    
    // 1. Regular columns and calculated columns (non-aggregate)
    columns.push(...allAvailableColumns.value.filter((col: any) => !col.is_aggregate));
    
    // 2. Aggregate functions - use alias names
    if (state.data_table.query_options?.group_by?.aggregate_functions) {
        state.data_table.query_options.group_by.aggregate_functions.forEach((aggFunc: any) => {
            if (aggFunc.column && aggFunc.aggregate_function !== '' && aggFunc.column_alias_name) {
                const funcName = state.aggregate_functions[aggFunc.aggregate_function];
                columns.push({
                    value: aggFunc.column_alias_name,  // Use alias for ORDER BY
                    display: `${aggFunc.column_alias_name} (${funcName})`,
                    is_aggregate: true,
                    type: 'aggregate_function'
                });
            }
        });
    }
    
    // 3. Aggregate expressions - use alias names
    if (state.data_table.query_options?.group_by?.aggregate_expressions) {
        state.data_table.query_options.group_by.aggregate_expressions.forEach((aggExpr: any) => {
            if (aggExpr.expression && aggExpr.expression.trim() !== '' && aggExpr.column_alias_name) {
                columns.push({
                    value: aggExpr.column_alias_name,  // Use alias for ORDER BY
                    display: `${aggExpr.column_alias_name} (expression)`,
                    is_aggregate: true,
                    type: 'aggregate_expression'
                });
            }
        });
    }
    
    // 4. Calculated columns - use alias names
    if (state.data_table.calculated_columns && Array.isArray(state.data_table.calculated_columns)) {
        state.data_table.calculated_columns.forEach((calcCol: any) => {
            if (calcCol.column_name && calcCol.expression) {
                // Check if not already added from allAvailableColumns
                if (!columns.some((c: any) => c.value === calcCol.column_name)) {
                    columns.push({
                        value: calcCol.column_name,  // Use alias for ORDER BY
                        display: `${calcCol.column_name} (calculated)`,
                        is_aggregate: false,
                        type: 'calculated_column'
                    });
                }
            }
        });
    }
    
    return columns;
});

const numericColumnsWithAggregates = computed(() => {
    const columns: any[] = [];

    // Safety check: ensure columns array exists
    if (!state?.data_table?.columns || !Array.isArray(state.data_table.columns)) {
        return columns;
    }

    // 1. Add base numeric columns
    state.data_table.columns
        .filter((column: any) => getDataType(column.data_type) === 'NUMBER')
        .forEach((column: any) => {
            const logicalName = column.table_logical_name || getTableLogicalName(column.schema, column.table_name);
            const physicalName = `${column.schema}.${column.table_name}.${column.column_name}`;
            
            // Use alias if available, otherwise use fully qualified path for SQL
            const valueForSQL = column.alias_name && column.alias_name.trim() !== ''
                ? column.alias_name
                : physicalName;
            
            // Display logical name for UI
            const displayName = column.alias_name && column.alias_name.trim() !== ''
                ? column.alias_name
                : `${logicalName}.${column.column_name}`;

            columns.push({
                value: valueForSQL,
                display: `${displayName} (Base Column)`,
                display_short: displayName,
                physical_name: physicalName,
                type: 'base_column',
                schema: column.schema,
                table_name: column.table_name,
                table_logical_name: logicalName,
                column_name: column.column_name,
                data_type: 'NUMBER'
            });
        });

    // 2. Add aggregate functions (all aggregates return numeric values)
    if (state.data_table.query_options?.group_by?.aggregate_functions) {
        state.data_table.query_options.group_by.aggregate_functions.forEach((aggFunc: any, index: any) => {
            if (aggFunc.column && aggFunc.aggregate_function !== '') {
                const funcName = state.aggregate_functions[aggFunc.aggregate_function];
                const aliasName = aggFunc.column_alias_name || `${funcName.toLowerCase()}_${aggFunc.column.split('.').pop()}`;

                columns.push({
                    value: aliasName,
                    display: `${funcName}(${aggFunc.column})${aggFunc.use_distinct ? ' [DISTINCT]' : ''} → ${aliasName}`,
                    type: 'aggregate_function',
                    data_type: 'NUMBER',
                    aggregate_index: index
                });
            }
        });
    }

    // 3. Add aggregate expressions
    if (state.data_table.query_options?.group_by?.aggregate_expressions) {
        state.data_table.query_options.group_by.aggregate_expressions.forEach((aggExpr: any, index: any) => {
            if (aggExpr.expression && aggExpr.expression.trim() !== '') {
                const aliasName = aggExpr.column_alias_name || `expr_${index}`;

                columns.push({
                    value: aliasName,
                    display: `${aggExpr.func_name || aggExpr.function || 'EXPR'}(${aggExpr.expression})${aggExpr.use_distinct ? ' [DISTINCT]' : ''} → ${aliasName}`,
                    type: 'aggregate_expression',
                    data_type: 'NUMBER',
                    expression_index: index
                });
            }
        });
    }

    // 4. Add existing calculated columns (enable computed calculations)
    if (state.data_table.calculated_columns && Array.isArray(state.data_table.calculated_columns)) {
        state.data_table.calculated_columns.forEach((calcCol: any, index: any) => {
            if (calcCol.column_name && calcCol.expression) {
                columns.push({
                    value: calcCol.column_name,
                    display: `${calcCol.column_name} (Calculated)`,
                    display_short: calcCol.column_name,
                    type: 'calculated_column',
                    data_type: calcCol.column_data_type || 'NUMBER',
                    expression: calcCol.expression,
                    calculated_index: index
                });
            }
        });
    }

    return columns;
});

// Add flag to prevent multiple simultaneous drawer openings
let isDrawerOpening = false;

function openAIDataModeler() {
    // GUARD: Prevent multiple simultaneous openings
    if (isDrawerOpening) {
        return;
    }
    
    isDrawerOpening = true;
    
    // SET FLAG: Prevent watchers from triggering when drawer opens
    state.is_applying_ai_config = true;

    // If editing existing data model, pass its ID to load conversation from database
    const dataModelId = props.isEditDataModel && props.dataModel?.id
        ? props.dataModel.id
        : undefined;

    if (props.isCrossSource && props.projectId) {
        // Cross-source mode: Pass project ID and data sources
        
        // Extract data source information from tables
        const dataSources: any[] = [];
        const seenSourceIds = new Set();
        
        state.tables.forEach((table: any) => {
            if (table.data_source_id && !seenSourceIds.has(table.data_source_id)) {
                seenSourceIds.add(table.data_source_id);
                dataSources.push({
                    id: table.data_source_id,
                    name: table.data_source_name,
                    type: table.data_source_type
                });
            }
        });
        
        aiDataModelerStore.openDrawerCrossSource(props.projectId, dataSources, dataModelId);
    } else if (props.dataSource && props.dataSource.id) {
        // Single-source mode: Use existing logic
        aiDataModelerStore.openDrawer(props.dataSource.id, dataModelId);
    }

    // CLEAR FLAG: Allow watchers after drawer is open (but before any model is applied)
    // The flag will be set again when actually applying a model
    setTimeout(() => {
        state.is_applying_ai_config = false;
        isDrawerOpening = false;
    }, 1000); // Increased to 1 second to prevent rapid re-opening
}

// Debounced version to prevent rapid successive clicks
const openAIDataModelerDebounced = _.debounce(openAIDataModeler, 500, {
    leading: true,  // Execute immediately on first call
    trailing: false // Ignore subsequent calls within the debounce window
});

function toggleAdvancedFeaturesDialog() {
    state.show_advanced_features_dialog = !state.show_advanced_features_dialog;
}

function hasAdvancedFields() {
    if (!state.data_table || !state.data_table.query_options) return false;

    const queryOptions = state.data_table.query_options;

    // Check WHERE clauses
    if (queryOptions.where && queryOptions.where.length > 0) return true;

    // Check GROUP BY
    if (queryOptions.group_by) {
        if (queryOptions.group_by.name) return true;
        if (queryOptions.group_by.aggregate_functions?.length > 0) return true;
        if (queryOptions.group_by.aggregate_expressions?.length > 0) return true;
        if (queryOptions.group_by.having_conditions?.length > 0) return true;
    }

    // Check ORDER BY
    if (queryOptions.order_by && queryOptions.order_by.length > 0) return true;

    // Check OFFSET/LIMIT
    if (queryOptions.offset !== -1) return true;
    if (queryOptions.limit !== -1) return true;

    // Check calculated columns
    if (state.data_table.calculated_columns && state.data_table.calculated_columns.length > 0) return true;

    // Check column aliases
    if (state.data_table.columns) {
        const hasAliases = state.data_table.columns.some((col: any) => col.alias_name && col.alias_name.trim() !== '');
        if (hasAliases) return true;

        // Check column transformations
        const hasTransforms = state.data_table.columns.some((col: any) => col.transform && col.transform !== '');
        if (hasTransforms) return true;
    }

    // Check table aliases (for self-referencing relationships)
    if (state.data_table.table_aliases && state.data_table.table_aliases.length > 0) return true;

    // Check JOIN conditions
    if (state.data_table.join_conditions && state.data_table.join_conditions.length > 0) return true;

    return false;
}

watch(() => state.data_table.query_options, async (value: any) => {
    // Guard: Don't re-execute during save operation
    if (state.is_saving_model) {
        return;
    }
    await executeQueryOnExternalDataSource();
}, { deep: true });
watch(() => state.data_table.query_options.group_by, async (value: any) => {
    state?.data_table?.query_options?.group_by?.aggregate_functions?.forEach((aggregate_function: any) => {
        aggregate_function.column_alias_name = aggregate_function.column_alias_name.replace(/\s/g, '_').toLowerCase();
    });
    state?.data_table?.query_options?.group_by?.aggregate_expressions?.forEach((aggregate_expression: any) => {
        if (aggregate_expression.column_alias_name) {
            aggregate_expression.column_alias_name = aggregate_expression.column_alias_name.replace(/\s/g, '_').toLowerCase();
        }
    });
    await executeQueryOnExternalDataSource();
}, { deep: true });
watch(() => state.data_table.table_name, (value: any) => {
    //keep the table name to maximum length of 20 characters
    state.data_table.table_name = value.substring(0, 20).replace(/\s/g, '_').toLowerCase();
}, { deep: true });
watch(() => state.data_table.columns, async (value: any) => {
    //keep the column names to maximum length of 20 characters
    state.data_table.columns.forEach((column: any) => {
        column.alias_name = column.alias_name.replace(/\s/g, '_').toLowerCase();
    });
    await executeQueryOnExternalDataSource();
}, { deep: true });
watch(() => state.calculated_column.column_name, (value: any) => {
    //keep the calculated column name to maximum length of 20 characters
    state.calculated_column.column_name = value.substring(0, 20).replace(/\s/g, '_').toLowerCase();
}, { deep: true });
watch(() => state.data_table.calculated_columns, async (value: any) => {
    // buildCalculatedColumn();
}, { deep: true });

// Watch for changes to join_conditions in data_table and sync to state-level array
watch(() => state.data_table.join_conditions, (newValue) => {
    if (newValue && newValue.length > 0) {
        state.join_conditions = [...newValue];
    } else {
        state.join_conditions = [];
    }
}, { deep: true });

// Watch for column selection changes - fetch AI-suggested joins when user selects columns from 2+ tables (Issue #270)
// This replaces the watch on state.tables since state.tables contains ALL available tables, not selected ones
// DISABLED: Preloading suggestions on page load instead of reactive fetching
// This watch previously fetched suggestions after user selected columns from 2+ tables
// New approach: Preload all suggestions in onMounted for better UX
/*
watch(() => state.data_table.columns, async (columns) => {
    // Skip if component is still initializing (prevents fetching on page load)
    if (state.is_initial_load) {
        return;
    }
    
    // Extract unique tables from selected columns
    const uniqueTables = new Set();
    if (columns && Array.isArray(columns)) {
        columns.forEach((col: any) => {
            if (col.table_name) {
                uniqueTables.add(col.table_name);
            }
        });
    }
    
    const tableNames = Array.from(uniqueTables);
    
    // Only fetch suggestions if:
    // 1. Not cross-source (cross-source has different logic)
    // 2. Data source exists
    // 3. User has selected columns from 2+ different tables (need at least 2 to join)
    if (!props.isCrossSource && props.dataSource?.id && tableNames.length >= 2) {
        try {
            // Check user subscription/type to determine if AI should be enabled
            const loggedInUserStore = useLoggedInUserStore();
            const user = loggedInUserStore.getLoggedInUser();
            
            // Enable AI for:
            // 1. ADMIN users (always have access)
            // 2. Future: Pro/Enterprise subscription tiers (when implemented)
            const enableAI = user?.user_type === 'admin';
            
            // Fetch suggestions with AI enabled based on subscription
            await aiDataModelerStore.fetchSuggestedJoins(props.dataSource.id, tableNames, enableAI);
        } catch (error: any) {
            console.error('[Data Model Builder] Failed to fetch AI-suggested joins:', error);
        }
    } else if (tableNames.length < 2) {
        // Clear suggestions when user deselects to less than 2 tables
        if (aiDataModelerStore.suggestedJoins.length > 0) {
            aiDataModelerStore.clearSuggestions();
        }
    }
}, { deep: true });
*/

// Watch for changes to join_conditions in data_table and sync to state-level array
watch(() => state.data_table.table_aliases, (newValue) => {
    if (newValue && newValue.length > 0) {
        state.table_aliases = [...newValue];
    } else {
        state.table_aliases = [];
    }
}, { deep: true });

// Watch for manual apply trigger from AI drawer
watch(() => aiDataModelerStore.applyTrigger, (newValue, oldValue) => {
    // Guard: Don't apply during unmount
    if (state.is_unmounting) {
        return;
    }

    if (newValue !== oldValue && aiDataModelerStore.modelDraft?.tables) {
        applyAIGeneratedModel(aiDataModelerStore.modelDraft.tables);
    } else {
        console.warn('[Data Model Builder] Trigger changed but conditions not met for applying model');
    }
});

function isSQLExpression(value: any) {
    // Detect common SQL expression patterns that should NOT be quoted
    const sqlKeywords = /\b(current_date|current_timestamp|now\(\)|interval|extract|date_trunc|case|when|null)\b/i;
    const hasOperators = /[\+\-\*\/]|::|\binterval\b/i;
    const hasFunctions = /\w+\(/;
    const hasColumnReference = /\w+\.\w+\.\w+/; // schema.table.column
    
    return sqlKeywords.test(value) || hasOperators.test(value) || hasFunctions.test(value) || hasColumnReference.test(value);
}

function getColumValue(value: any, dataType: any) {
    // Check if value is a SQL expression (not a literal string)
    if (isSQLExpression(value)) {
        return value;  // Don't quote SQL expressions
    }
    
    if (getDataType(dataType) === 'NUMBER' || getDataType(dataType) === 'BOOLEAN') {
        return `${value}`;
    } else if (getDataType(dataType) === 'TEXT') {
        return `'${value}'`;
    } else {
        return `'${value}'`;
    }
}
function whereColumnChanged(event: any) {
    const selectedValue = event.target.value;
    const whereColumn = state.data_table.query_options.where.find((where_column: any) => where_column.column === selectedValue);

    if (whereColumn) {
        const columnInfo = allAvailableColumns.value.find((col: any) => col.value === selectedValue);
        if (columnInfo) {
            whereColumn.column_data_type = columnInfo.data_type;
        }
    }
    
    // Trigger preview refresh
    handleQueryOptionChanged('where-column');
}

/**
 * Handle query option changes and trigger preview refresh
 * Used by WHERE, HAVING, ORDER BY clauses to update live data preview
 */
async function handleQueryOptionChanged(source: any) {
    // Don't call buildSQLQuery() here - it has modal popups
    // executeQueryOnExternalDataSource() will build the query internally
    await nextTick();
    await executeQueryOnExternalDataSource();
}

function havingColumnChanged(event: any) {
    const selectedValue = event.target.value;
    const havingColumn = state.data_table.query_options.group_by.having_conditions.find((having_column: any) => having_column.column === selectedValue);

    if (havingColumn) {
        const columnInfo = allAvailableColumns.value.find((col: any) => col.value === selectedValue);
        if (columnInfo) {
            havingColumn.column_data_type = columnInfo.data_type;
        }
    }
}
function aggregateFunctionChanged(event: any) {
    const aggregateFunction = state.data_table.query_options.group_by.aggregate_functions.find((aggregate_function: any) => aggregate_function.aggregate_function === parseInt(event.target.value))
    if (aggregateFunction && aggregateFunction.column !== "") {
        const column = state.data_table.columns.find((column: any) => `${column.schema}.${column.table_name}.${column.column_name}` === aggregateFunction.column);
        if (column) {
            if (getDataType(column.data_type) !== 'NUMBER') {
                if (state.aggregate_functions[aggregateFunction.aggregate_function] === 'SUM' || state.aggregate_functions[aggregateFunction.aggregate_function] === 'AVG') {
                    $swal.fire({
                        icon: 'error',
                        title: `Error!`,
                        text: `The aggregate function ${state.aggregate_functions[aggregateFunction.aggregate_function]} is not supported for the column ${column.column_name} due to its data type.`,
                    });
                    return;
                }
            }
        }
    }
    // Sync GROUP BY columns after aggregate function change
    syncGroupByColumns();
}
function aggregateFunctionColumnChanged(event: any) {
    const aggregateFunction = state.data_table.query_options.group_by.aggregate_functions.find((aggregate_function: any) => aggregate_function.column === event.target.value)
    if (aggregateFunction && aggregateFunction.aggregate_function !== "") {
        const column = state.data_table.columns.find((column: any) => `${column.schema}.${column.table_name}.${column.column_name}` === aggregateFunction.column);
        if (column) {
            // Validate data type
            if (getDataType(column.data_type) !== 'NUMBER') {
                if (state.aggregate_functions[aggregateFunction.aggregate_function] === 'SUM' || state.aggregate_functions[aggregateFunction.aggregate_function] === 'AVG') {
                    $swal.fire({
                        icon: 'error',
                        title: `Error!`,
                        text: `The aggregate function ${state.aggregate_functions[aggregateFunction.aggregate_function]} is not supported for the column ${column.column_name} due to its data type.`,
                    });
                    return;
                }
            }
            
            // Track in hidden references (will add badge but not check the column)
            const aggIndex = state.data_table.query_options.group_by.aggregate_functions.indexOf(aggregateFunction);
            addHiddenReferencedColumn(
                column.schema, 
                column.table_name, 
                column.column_name, 
                'aggregate',
                `aggregate_function_${aggIndex}`
            );
        } else if (aggregateFunction.column) {
            // Column not in main list, add as hidden reference
            const parts = aggregateFunction.column.split('.');
            if (parts.length === 3) {
                const [schema, tableName, columnName] = parts;
                const aggIndex = state.data_table.query_options.group_by.aggregate_functions.indexOf(aggregateFunction);
                addHiddenReferencedColumn(
                    schema, 
                    tableName, 
                    columnName, 
                    'aggregate',
                    `aggregate_function_${aggIndex}`
                );
            }
        }
    }
    // Sync GROUP BY columns after aggregate column change
    syncGroupByColumns();
}

/**
 * Synchronizes group_by_columns array with current state
 * Ensures all non-aggregated selected columns are in GROUP BY
 * and aggregated columns are excluded
 */
function syncGroupByColumns() {
    // Only run if GROUP BY exists (has aggregates)
    const hasAggregates = state.data_table.query_options?.group_by?.aggregate_functions?.length > 0 ||
                         state.data_table.query_options?.group_by?.aggregate_expressions?.length > 0;
    
    if (!hasAggregates) {
        // No aggregates = no GROUP BY needed
        if (state.data_table.query_options?.group_by?.group_by_columns) {
            state.data_table.query_options.group_by.group_by_columns = [];
        }
        return;
    }
    
    // Build set of aggregated columns (columns used in aggregate functions/expressions)
    const aggregatedColumns = new Set();
    
    // Track columns in aggregate functions (e.g., COUNT(column), SUM(column))
    state.data_table.query_options.group_by.aggregate_functions?.forEach((aggFunc: any) => {
        if (aggFunc.column) {
            aggregatedColumns.add(aggFunc.column);
        }
    });
    
    // Track columns in aggregate expressions (e.g., COUNT(CASE WHEN column...))
    state.data_table.query_options.group_by.aggregate_expressions?.forEach((aggExpr: any) => {
        if (aggExpr.expression) {
            // Extract column references from expressions
            // Pattern 1: schema.table.column (full path)
            const fullPathMatches = aggExpr.expression.match(/\w+\.\w+\.\w+/g);
            if (fullPathMatches) {
                fullPathMatches.forEach((col: any) => aggregatedColumns.add(col));
            }
            
            // Pattern 2: Just column name (after we strip schema.table prefix)
            // This handles expressions like "CASE WHEN balance_remaining <= 0"
            // We need to match these back to full column paths
            state.data_table.columns.forEach((col: any) => {
                const fullPath = `${col.schema}.${col.table_name}.${col.column_name}`;
                // Check if just the column name appears in expression
                const columnNamePattern = new RegExp(`\\b${col.column_name}\\b`);
                if (columnNamePattern.test(aggExpr.expression)) {
                    aggregatedColumns.add(fullPath);
                }
            });
        }
    });
    
    // Rebuild group_by_columns from selected AND hidden columns with transforms
    const autoGroupByColumns = state.data_table.columns
        .filter((col: any) => {
            const fullPath = `${col.schema}.${col.table_name}.${col.column_name}`;
            const isAggregated = aggregatedColumns.has(fullPath);
            
            // Include column if:
            // 1. Not aggregated AND
            // 2. Either selected for display OR has a transform function (hidden but needed)
            return !isAggregated && (col.is_selected_column || col.transform || col.transform_function);
        })
        .map((col: any) => {
            let columnRef = `${col.schema}.${col.table_name}.${col.column_name}`;
            // Include transform functions if present
            if (col.transform_function) {
                const closeParens = ')'.repeat(col.transform_close_parens || 1);
                columnRef = `${col.transform_function}(${columnRef}${closeParens}`;
            }
            return columnRef;
        });
    
    // Add calculated columns (CASE expressions, etc.) to GROUP BY
    // Calculated columns are NOT aggregates, so they must be in GROUP BY when aggregates exist
    const calculatedColumnExpressions = state.data_table.calculated_columns
        ?.filter((calcCol: any) => calcCol.expression && calcCol.expression.trim() !== '')
        .map((calcCol: any) => calcCol.expression) || [];
    
    // Preserve manually-added GROUP BY columns that the user added via the dropdown
    // These are columns that exist in the current group_by_columns but are NOT auto-derived
    // from selected columns or calculated columns
    // CRITICAL: Do NOT filter against aggregatedColumns here - if the user explicitly added
    // a column to GROUP BY, respect that decision. The aggregatedColumns set can contain
    // false positives from aggressive regex matching against aggregate expression text.
    const currentGroupByCols = state.data_table.query_options.group_by.group_by_columns || [];
    const autoSet = new Set([...autoGroupByColumns, ...calculatedColumnExpressions]);
    const manualGroupByColumns = currentGroupByCols.filter((col: any) => {
        // Keep if not auto-derived (user manually added it via dropdown)
        return !autoSet.has(col);
    });
    
    // Combine: auto-derived columns + calculated columns + manually-added columns
    const allGroupByColumns = [...autoGroupByColumns, ...calculatedColumnExpressions, ...manualGroupByColumns];
    
    // Initialize group_by_columns if it doesn't exist
    if (!state.data_table.query_options.group_by.group_by_columns) {
        state.data_table.query_options.group_by.group_by_columns = [];
    }
    
    state.data_table.query_options.group_by.group_by_columns = allGroupByColumns;
}

function openDialog() {
    if (props.readOnly) return;
    state.show_dialog = true;
}
function closeDialog() {
    state.show_dialog = false;
}

function handleCloseWalkthrough(dontShowAgain: any) {
    if (dontShowAgain && import.meta.client) {
        localStorage.setItem('medallion_walkthrough_seen', 'true');
    }
    state.showLayerWalkthrough = false;
}

function openCalculatedColumnDialog() {
    if (props.readOnly) return;
    state.show_calculated_column_dialog = true;
    state.calculated_column = {
        column_name: '',
        columns: [
            {
                column_name: '',
                operator: null, //the first operator will always be null
                type: 'column',
                numeric_value: 0,
            },
        ],
        column_data_type: 'Number', // The calculated field will only have a number data type. The actual data type will be determined by the expression used and the data types of the columns used in the expression.
    };
}
function closeCalculatedColumnDialog() {
    state.show_calculated_column_dialog = false;
}
async function changeDataModel(event: any) {
    state.data_table.columns = state.data_table.columns.filter((column: any) => {
        // Allow foreign key columns (needed for reflexive relationships)
        if (event?.added?.element?.reference?.foreign_table_schema && event?.added?.element?.reference?.local_table_name === column?.table_name && event?.added?.element?.reference?.local_column_name === column?.column_name) {
            // Don't block it - user might be creating reflexive relationship
        }
        //remove duplicate columns (check both table_name and table_alias)
        const matchingColumns = state.data_table.columns.filter((c: any) => {
            const sameColumn = c.column_name === column.column_name;
            const sameTable = c.table_name === column.table_name;
            const sameAlias = (c.table_alias || null) === (column.table_alias || null);
            return sameColumn && sameTable && sameAlias;
        });

        if (matchingColumns.length > 1) {
            return false;
        } else {
            return true;
        }
    });
    await executeQueryOnExternalDataSource();
}
/**
 * Helper function to build fully-qualified column reference
 * @param {Object} column - Column object with schema, table_name, and column_name
 * @returns {String} Fully-qualified column reference (e.g., "test_schema.users.user_id")
 */
function buildColumnReference(column: any) {
    if (!column || !column.schema || !column.table_name || !column.column_name) {
        console.warn('[buildColumnReference] Invalid column object:', column);
        return '';
    }
    return `${column.schema}.${column.table_name}.${column.column_name}`;
}

/**
 * Ensures all columns referenced in query_options exist in columns array
 * Adds missing columns with is_selected_column: false
 * This preserves columns used in GROUP BY, WHERE, HAVING, ORDER BY
 * even if they weren't selected for display
 */
function ensureReferencedColumnsExist() {
    // Initialize hidden_referenced_columns if doesn't exist
    if (!state.data_table.hidden_referenced_columns) {
        state.data_table.hidden_referenced_columns = [];
    }
    
    // Extract column references from query_options
    const referencedColumns = new Set();
    
    // 1. FROM GROUP BY columns array (AI-generated or manually created)
    state.data_table.query_options?.group_by?.group_by_columns?.forEach((colRef: any) => {
        // Remove transform functions to get base column reference
        const baseRef = colRef.replace(/\w+\(/g, '').replace(/\)/g, '');
        const parts = baseRef.split('.');
        if (parts.length === 3) {
            const [schema, tableName, columnName] = parts;
            referencedColumns.add(`${schema}.${tableName}.${columnName}`);
            addHiddenReferencedColumn(schema, tableName, columnName, 'group_by', 'group_by_columns');
        }
    });
    
    // 2. FROM Aggregate functions
    state.data_table.query_options?.group_by?.aggregate_functions?.forEach((aggFunc: any, idx: any) => {
        if (aggFunc.column) {
            referencedColumns.add(aggFunc.column);
            const parts = aggFunc.column.split('.');
            if (parts.length === 3) {
                const [schema, tableName, columnName] = parts;
                addHiddenReferencedColumn(schema, tableName, columnName, 'aggregate', `aggregate_function_${idx}`);
            }
        }
    });
    
    // 3. FROM WHERE clauses
    state.data_table.query_options?.where?.forEach((clause: any, idx: any) => {
        if (clause.column) {
            referencedColumns.add(clause.column);
            const parts = clause.column.split('.');
            if (parts.length === 3) {
                const [schema, tableName, columnName] = parts;
                addHiddenReferencedColumn(schema, tableName, columnName, 'where', `where_${idx}`);
            }
        }
    });
    
    // 4. FROM HAVING conditions
    state.data_table.query_options?.group_by?.having_conditions?.forEach((clause: any, idx: any) => {
        if (clause.column) {
            referencedColumns.add(clause.column);
            const parts = clause.column.split('.');
            if (parts.length === 3) {
                const [schema, tableName, columnName] = parts;
                addHiddenReferencedColumn(schema, tableName, columnName, 'having', `having_${idx}`);
            }
        }
    });
    
    // 5. FROM ORDER BY clauses
    state.data_table.query_options?.order_by?.forEach((clause: any, idx: any) => {
        if (clause.column) {
            referencedColumns.add(clause.column);
            const parts = clause.column.split('.');
            if (parts.length === 3) {
                const [schema, tableName, columnName] = parts;
                addHiddenReferencedColumn(schema, tableName, columnName, 'order_by', `order_by_${idx}`);
            }
        }
    });
    
    // 6. FROM calculated columns (may reference base columns)
    state.data_table.calculated_columns?.forEach((calc: any, idx: any) => {
        // Parse expression to find column references
        // Regex to match: schema.table.column patterns
        const matches = calc.expression.match(/\b\w+\.\w+\.\w+\b/g);
        matches?.forEach((ref: any) => {
            referencedColumns.add(ref);
            const parts = ref.split('.');
            if (parts.length === 3) {
                const [schema, tableName, columnName] = parts;
                addHiddenReferencedColumn(schema, tableName, columnName, 'calculated', `calculated_${idx}`);
            }
        });
    });
}

/**
 * Open dialog to create table alias for self-referencing relationships
 */
function openAliasDialog() {
    if (props.readOnly) return;
    state.alias_form = {
        table: '',
        alias: ''
    };
    state.show_alias_dialog = true;
}

/**
 * Close alias creation dialog
 */
function closeAliasDialog() {
    state.show_alias_dialog = false;
}

/**
 * Create a new table alias for self-referencing relationships
 */
function createTableAlias() {
    const { table, alias } = state.alias_form;

    // Validation
    if (!table || !alias) {
        $swal.fire({
            icon: 'error',
            title: 'Missing Information',
            text: 'Please select a table and provide an alias name'
        });
        return;
    }

    // Check for duplicate alias names
    if (state.table_aliases.some((a: any) => a.alias === alias)) {
        $swal.fire({
            icon: 'error',
            title: 'Duplicate Alias',
            text: `The alias "${alias}" is already in use. Please choose a different name.`
        });
        return;
    }

    // Check if alias matches any existing table name (confusing)
    if (state.tables.some((t: any) => t.table_name === alias)) {
        $swal.fire({
            icon: 'warning',
            title: 'Confusing Alias Name',
            text: `The alias "${alias}" matches an existing table name. Consider using a more distinctive name.`,
            showCancelButton: true,
            confirmButtonText: 'Use Anyway',
            cancelButtonText: 'Choose Different Name'
        }).then((result) => {
            if (result.isConfirmed) {
                performCreateAlias(table, alias);
            }
        });
        return;
    }

    performCreateAlias(table, alias);
}

/**
 * Internal function to perform alias creation
 */
function performCreateAlias(table: any, alias: any) {
    const [schema, tableName] = table.split('.');

    // Add to aliases
    state.table_aliases.push({
        schema,
        original_table: tableName,
        alias
    });

    const sourceTable = state.tables.find((t: any) => 
        t.table_name === tableName && t.schema === schema
    );
    const displayName = sourceTable?.logical_name || tableName;

    $swal.fire({
        icon: 'success',
        title: 'Alias Created',
        text: `You can now add columns from "${alias}" (${displayName})`,
        timer: 2000,
        showConfirmButton: false
    });

    closeAliasDialog();
}

/**
 * Remove a table alias
 */
function removeTableAlias(index: any) {
    const alias = state.table_aliases[index];

    // Check if any columns are using this alias
    const columnsUsingAlias = state.data_table.columns.filter(
        (col: any) => col.table_alias === alias.alias
    );

    if (columnsUsingAlias.length > 0) {
        $swal.fire({
            icon: 'warning',
            title: 'Cannot Remove Alias',
            html: `The alias "<strong>${alias.alias}</strong>" is being used by <strong>${columnsUsingAlias.length}</strong> column(s). Remove those columns first.<br><br>Columns using this alias:<ul class="list-disc pl-5 mt-2">${columnsUsingAlias.map((col: any) => `<li>${col.column_name}</li>`).join('')}</ul>`
        });
        return;
    }

    state.table_aliases.splice(index, 1);

    $swal.fire({
        icon: 'success',
        title: 'Alias Removed',
        timer: 1500,
        showConfirmButton: false
    });
}

/**
 * Get combined list of regular tables and aliased tables for display
 */
/**
 * Get tables that are included via JOIN conditions
 */
function getTablesInJoins() {
    const joinedTables = new Set();

    state.join_conditions.forEach((join: any) => {
        const leftKey = `${join.left_table_schema}.${join.left_table_name}`;
        const rightKey = `${join.right_table_schema}.${join.right_table_name}`;
        joinedTables.add(leftKey);
        joinedTables.add(rightKey);
    });

    return joinedTables;
}

/**
 * Get columns used in aggregate functions (not regular SELECT columns)
 */
function getAggregateOnlyColumns() {
    const aggregateColumns: any[] = [];
    const selectedColumnPaths = new Set();

    // Track columns in regular SELECT
    state.data_table.columns.forEach((col: any) => {
        if (col.is_selected_column) {
            selectedColumnPaths.add(`${col.schema}.${col.table_name}.${col.column_name}`);
        }
    });

    // Find columns in aggregates that aren't in regular SELECT
    const aggregateFunctions = state.data_table.query_options?.group_by?.aggregate_functions || [];
    aggregateFunctions.forEach((aggFunc: any) => {
        if (aggFunc.column) {
            // Parse column path: schema.table.column
            const parts = aggFunc.column.split('.');
            if (parts.length === 3) {
                const [schema, table, column] = parts;
                const fullPath = `${schema}.${table}.${column}`;

                if (!selectedColumnPaths.has(fullPath)) {
                    aggregateColumns.push({
                        schema,
                        table_name: table,
                        column_name: column,
                        aggregate_function: ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX'][aggFunc.aggregate_function],
                        alias: aggFunc.column_alias_name,
                        fullPath
                    });
                }
            }
        }
    });

    return aggregateColumns;
}

/**
 * Check if a table is included via JOINs or aggregates (even without regular columns)
 */
function isTableIncludedViaJoinOrAggregate(schema: any, tableName: any) {
    const tableKey = `${schema}.${tableName}`;
    const joinedTables = getTablesInJoins();

    if (joinedTables.has(tableKey)) {
        return true;
    }

    // Check if any aggregate functions use this table
    const aggregateColumns = getAggregateOnlyColumns();
    return aggregateColumns.some(aggCol =>
        aggCol.schema === schema && aggCol.table_name === tableName
    );
}

function getTablesWithAliases() {
    const result: any[] = [];
    const joinedTables = getTablesInJoins();

    // Add regular tables
    state.tables.forEach((table: any) => {
        const tableKey = `${table.schema}.${table.table_name}`;
        const isJoinedOrAggregate = isTableIncludedViaJoinOrAggregate(table.schema, table.table_name);

        result.push({
            schema: table.schema,
            table_name: table.table_name,
            display_name: table.logical_name || table.table_name,
            logical_name: table.logical_name, // Include logical_name for template display
            columns: table.columns,
            references: table.references || [],
            isAlias: false,
            original_table: table.table_name,
            table_alias: null,
            isJoinedOrAggregate: isJoinedOrAggregate
        });
    });

    // Add aliased versions
    state.table_aliases.forEach((alias: any) => {
        const originalTable = state.tables.find(
            (t: any) => t.table_name === alias.original_table && t.schema === alias.schema
        );

        if (originalTable) {
            // Clone columns and mark with alias
            const aliasedColumns = originalTable.columns.map((col: any) => ({
                ...col,
                table_alias: alias.alias,
                display_column_name: `${alias.alias}.${col.column_name}`
            }));

            result.push({
                schema: alias.schema,
                table_name: alias.original_table,
                table_alias: alias.alias,
                display_name: `${alias.alias}`,
                logical_name: originalTable.logical_name || alias.original_table,
                columns: aliasedColumns,
                references: originalTable.references || [],
                isAlias: true,
                original_table: alias.original_table,
                isJoinedOrAggregate: false // Aliases are explicit
            });
        }
    });

    return result;
}

/**
 * Toggle collapse state for a table
 * @param {string} tableKey - Unique key for table: `${schema}.${table_name}.${alias || 'base'}`
 */
function toggleTableCollapse(tableKey: any) {
    const currentState = state.collapsed_tables.get(tableKey) || false;
    state.collapsed_tables.set(tableKey, !currentState);
}

/**
 * Check if table is collapsed
 * @param {string} tableKey - Unique key for table
 * @returns {boolean} True if collapsed
 */
function isTableCollapsed(tableKey: any) {
    return state.collapsed_tables.get(tableKey) || false;
}

/**
 * Get column count for a table (for display when collapsed)
 * @param {Array} columns - Array of column objects
 * @returns {number} Column count
 */
function getColumnCount(columns: any) {
    return columns?.length || 0;
}

/**
 * Collapse all tables
 */
function collapseAllTables() {
    const tablesWithAliases = getTablesWithAliases();
    tablesWithAliases.forEach(tableOrAlias => {
        const key = `${tableOrAlias.schema}.${tableOrAlias.table_name}.${tableOrAlias.table_alias || 'base'}`;
        state.collapsed_tables.set(key, true);
    });
}

/**
 * Expand all tables
 */
function expandAllTables() {
    state.collapsed_tables.clear();
}

/**
 * Check if all tables are currently collapsed
 */
const allTablesCollapsed = computed(() => {
    const tablesWithAliases = getTablesWithAliases();
    if (tablesWithAliases.length === 0) return false;
    
    return tablesWithAliases.every(tableOrAlias => {
        const key = `${tableOrAlias.schema}.${tableOrAlias.table_name}.${tableOrAlias.table_alias || 'base'}`;
        return state.collapsed_tables.get(key) === true;
    });
});

/**
 * Check if all tables are currently expanded
 */
const allTablesExpanded = computed(() => {
    const tablesWithAliases = getTablesWithAliases();
    if (tablesWithAliases.length === 0) return true;
    
    return tablesWithAliases.every(tableOrAlias => {
        const key = `${tableOrAlias.schema}.${tableOrAlias.table_name}.${tableOrAlias.table_alias || 'base'}`;
        return !state.collapsed_tables.get(key);
    });
});

/**
 * Check if data model has multiple tables (JOINs needed)
 */
function hasMultipleTables() {
    const tables = new Set();
    state.data_table.columns.forEach((col: any) => {
        const tableKey = getTableKeyForColumn(col, true);
        tables.add(tableKey);
    });
    return tables.size > 1;
}

/**
 * Get available tables for JOIN selection (from selected columns)
 */
function getAvailableTablesForJoin() {
    const tables = new Map();

    state.data_table.columns.forEach((col: any) => {
        const key = getTableKeyForColumn(col, true);

        // Use logical name if available, fallback to physical name
        const logicalName = col.table_logical_name || getTableLogicalName(col.schema, col.table_name);
        const sourceTable = findSourceTableForColumn(col);
        const sourceLabel = props.isCrossSource
            ? (sourceTable?.data_source_name || `DS ${col.data_source_id || 'unknown'}`)
            : '';
        const baseLabel = col.table_alias
            ? `${col.schema}.${col.table_alias} (${logicalName})`
            : `${col.schema}.${logicalName}`;
        const label = props.isCrossSource && sourceLabel
            ? `${sourceLabel} · ${baseLabel}`
            : baseLabel;

        if (!tables.has(key)) {
            tables.set(key, {
                value: key,
                label: label,
                schema: col.schema,
                table_name: col.table_name,
                table_alias: col.table_alias || null,
                logical_name: logicalName,
                data_source_id: col.data_source_id
            });
        }
    });

    return Array.from(tables.values());
}

/**
 * Parse table key format "schema.table::alias" or "schema.table"
 */
function parseTableKey(tableKey: any) {
    if (!tableKey) return { dataSourceId: null, schema: '', table: '', alias: null };

    const hasAlias = tableKey.includes('::');
    if (hasAlias) {
        const [schemaTable, alias] = tableKey.split('::');
        const parts = schemaTable.split('.');
        if (parts.length === 3) {
            const [dataSourceId, schema, table] = parts;
            return { dataSourceId: Number(dataSourceId) || null, schema, table, alias };
        }
        const [schema, table] = parts;
        return { dataSourceId: null, schema, table, alias };
    } else {
        const parts = tableKey.split('.');
        if (parts.length === 3) {
            const [dataSourceId, schema, table] = parts;
            return { dataSourceId: Number(dataSourceId) || null, schema, table, alias: null };
        }
        const [schema, table] = parts;
        return { dataSourceId: null, schema, table, alias: null };
    }
}

/**
 * Get columns for a specific table (for JOIN condition dropdowns)
 */
function getColumnsForTable(tableName: any, tableAlias: any = null, dataSourceId: any = null) {
    const columns = state.data_table.columns.filter((col: any) => {
        if (tableAlias) {
            if (dataSourceId && props.isCrossSource) {
                return col.table_alias === tableAlias && col.data_source_id === dataSourceId;
            }
            return col.table_alias === tableAlias;
        }
        if (dataSourceId && props.isCrossSource) {
            return col.table_name === tableName && !col.table_alias && col.data_source_id === dataSourceId;
        }
        return col.table_name === tableName && !col.table_alias;
    });

    return columns.map((col: any) => ({
        value: col.column_name,
        label: col.column_name,
        data_type: col.data_type
    }));
}

/**
 * Open JOIN creation dialog
 */
function openJoinDialog() {
    if (props.readOnly) return;
    state.editing_join_index = null; // Clear edit mode
    state.join_form = {
        left_table: '',
        left_table_alias: null,
        left_column: '',
        right_table: '',
        right_table_alias: null,
        right_column: '',
        join_type: 'INNER',
        primary_operator: '=',
        join_logic: 'AND',
        additional_conditions: []
    };
    state.show_join_dialog = true;
}

/**
 * Open dialog to edit existing JOIN condition
 */
function editJoinCondition(joinIndex: any) {
    if (props.readOnly) return;
    
    const join = state.join_conditions[joinIndex];
    state.editing_join_index = joinIndex;
    
    // Construct table keys with schema.table format (and alias if present)
    const leftTableKey = join.left_table_alias 
        ? `${join.left_table_schema}.${join.left_table_name}::${join.left_table_alias}`
        : `${join.left_table_schema}.${join.left_table_name}`;
    
    const rightTableKey = join.right_table_alias
        ? `${join.right_table_schema}.${join.right_table_name}::${join.right_table_alias}`
        : `${join.right_table_schema}.${join.right_table_name}`;
    
    // If cross-source, include data source ID
    const leftKey = props.isCrossSource && join.left_data_source_id
        ? `${leftTableKey}::${join.left_data_source_id}`
        : leftTableKey;
    
    const rightKey = props.isCrossSource && join.right_data_source_id
        ? `${rightTableKey}::${join.right_data_source_id}`
        : rightTableKey;
    
    // Populate form with existing JOIN data
    state.join_form = {
        left_table: leftKey,
        left_table_alias: join.left_table_alias,
        left_column: join.left_column_name,
        right_table: rightKey,
        right_table_alias: join.right_table_alias,
        right_column: join.right_column_name,
        join_type: join.join_type || 'INNER',
        primary_operator: join.primary_operator || '=',
        join_logic: join.join_logic || 'AND',
        additional_conditions: join.additional_conditions ? [...join.additional_conditions] : []
    };
    
    state.show_join_dialog = true;
}

/**
 * Close JOIN creation dialog
 */
function closeJoinDialog() {
    state.show_join_dialog = false;
    state.editing_join_index = null; // Clear edit mode
}

/**
 * Handle left table selection in JOIN form
 */
function onJoinFormLeftTableChange() {
    const tableInfo = parseTableKey(state.join_form.left_table);
    state.join_form.left_table_alias = tableInfo.alias;
    state.join_form.left_column = '';
}

/**
 * Handle right table selection in JOIN form
 */
function onJoinFormRightTableChange() {
    const tableInfo = parseTableKey(state.join_form.right_table);
    state.join_form.right_table_alias = tableInfo.alias;
    state.join_form.right_column = '';
}

/**
 * Get columns for JOIN form dropdowns
 */
function getColumnsForJoinForm(side: any) {
    const tableKey = side === 'left' ? state.join_form.left_table : state.join_form.right_table;
    if (!tableKey) return [];

    const tableInfo = parseTableKey(tableKey);
    return getColumnsForTable(tableInfo.table, tableInfo.alias, tableInfo.dataSourceId);
}

/**
 * Validate JOIN form
 */
function isJoinFormValid() {
    return state.join_form.left_table &&
        state.join_form.left_column &&
        state.join_form.right_table &&
        state.join_form.right_column;
}

/**
 * Get preview of JOIN SQL
 */
function getJoinFormPreview() {
    if (!isJoinFormValid()) {
        return 'Select tables and columns to see preview...';
    }

    const leftInfo = parseTableKey(state.join_form.left_table);
    const rightInfo = parseTableKey(state.join_form.right_table);

    const leftRef = leftInfo.alias || leftInfo.table;
    const rightRef = rightInfo.alias || rightInfo.table;

    return `${state.join_form.join_type} JOIN ${rightInfo.schema}.${rightInfo.table}${rightInfo.alias ? ` AS ${rightInfo.alias}` : ''} ON ${leftInfo.schema}.${leftRef}.${state.join_form.left_column} = ${rightInfo.schema}.${rightRef}.${state.join_form.right_column}`;
}

/**
 * Create new JOIN condition (or update if editing)
 */
async function createJoinCondition() {
    if (!isJoinFormValid()) {
        $swal.fire({
            icon: 'error',
            title: 'Incomplete JOIN',
            text: 'Please select both tables and columns for the JOIN'
        });
        return;
    }

    const leftInfo = parseTableKey(state.join_form.left_table);
    const rightInfo = parseTableKey(state.join_form.right_table);
    
    const isEditing = state.editing_join_index !== null;

    // Check for duplicate JOIN (skip current join if editing)
    const isDuplicate = state.join_conditions.some((join: any, index: any) => {
        // Skip duplicate check for the join being edited
        if (isEditing && index === state.editing_join_index) {
            return false;
        }
        
        const leftSourceMatch = !props.isCrossSource ||
            !leftInfo.dataSourceId ||
            join.left_data_source_id === leftInfo.dataSourceId;
        const rightSourceMatch = !props.isCrossSource ||
            !rightInfo.dataSourceId ||
            join.right_data_source_id === rightInfo.dataSourceId;

        return (
            join.left_table_name === leftInfo.table &&
            join.left_column_name === state.join_form.left_column &&
            join.right_table_name === rightInfo.table &&
            join.right_column_name === state.join_form.right_column &&
            leftSourceMatch &&
            rightSourceMatch
        );
    });

    if (isDuplicate) {
        $swal.fire({
            icon: 'warning',
            title: 'Duplicate JOIN',
            text: 'This JOIN condition already exists'
        });
        return;
    }

    // Build JOIN object
    const joinData = {
        left_table_schema: leftInfo.schema,
        left_table_name: leftInfo.table,
        left_table_alias: leftInfo.alias,
        left_data_source_id: leftInfo.dataSourceId,
        left_column_name: state.join_form.left_column,

        right_table_schema: rightInfo.schema,
        right_table_name: rightInfo.table,
        right_table_alias: rightInfo.alias,
        right_data_source_id: rightInfo.dataSourceId,
        right_column_name: state.join_form.right_column,

        join_type: state.join_form.join_type,
        primary_operator: state.join_form.primary_operator || '=',
        join_logic: state.join_form.join_logic || 'AND',
        additional_conditions: state.join_form.additional_conditions || []
    };
    
    if (isEditing) {
        // Update existing JOIN
        const existingJoin = state.join_conditions[state.editing_join_index];
        Object.assign(existingJoin, joinData);
        
        $swal.fire({
            icon: 'success',
            title: 'JOIN Updated',
            timer: 1500,
            showConfirmButton: false
        });
    } else {
        // Add new JOIN condition
        const newJoin = {
            id: Date.now(),
            is_auto_detected: false,
            ...joinData
        };
        
        state.join_conditions.push(newJoin);
        
        $swal.fire({
            icon: 'success',
            title: 'JOIN Created',
            timer: 1500,
            showConfirmButton: false
        });
    }
    
    // CRITICAL: Immediately sync to data_table before query execution
    // This ensures JOINs are included in the query JSON sent to backend
    state.data_table.join_conditions = [...state.join_conditions];

    closeJoinDialog();
    await executeQueryOnExternalDataSource();
}

/**
 * Remove JOIN condition
 */
async function removeJoinCondition(index: any) {
    const join = state.join_conditions[index];

    const result = await $swal.fire({
        title: 'Remove JOIN?',
        html: `Remove JOIN between <strong>${join.left_table_name}</strong> and <strong>${join.right_table_name}</strong>?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Remove',
        cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
        state.join_conditions.splice(index, 1);
        // Sync to data_table for persistence
        state.data_table.join_conditions = [...state.join_conditions];
        await executeQueryOnExternalDataSource();
    }
}

/**
 * Update primary operator for a JOIN condition
 */
async function updateJoinOperator(index: any, newOperator: any) {
    if (state.join_conditions[index]) {
        state.join_conditions[index].primary_operator = newOperator;
        // Sync to data_table for persistence
        state.data_table.join_conditions = [...state.join_conditions];
        await executeQueryOnExternalDataSource();
    }
}

/**
 * Update logic connector (AND/OR) for a JOIN condition
 */
async function updateJoinLogic(index: any, newLogic: any) {
    if (state.join_conditions[index]) {
        state.join_conditions[index].join_logic = newLogic;
        // Sync to data_table for persistence
        state.data_table.join_conditions = [...state.join_conditions];

        if (newLogic === 'OR') {
            console.warn('[updateJoinLogic] ⚠️ OR logic between JOINs has limitations in SQL. The query structure may need adjustment.');
        }

        await executeQueryOnExternalDataSource();
    }
}

/**
 * Add additional condition to existing JOIN
 */
function addAdditionalCondition(joinIndex: any) {
    if (!state.join_conditions[joinIndex].additional_conditions) {
        state.join_conditions[joinIndex].additional_conditions = [];
    }

    state.join_conditions[joinIndex].additional_conditions.push({
        logic: 'AND',
        left_column: '',
        operator: '=',
        right_column: ''
    });
}

/**
 * Remove additional condition from JOIN
 */
function removeAdditionalCondition(joinIndex: any, condIndex: any) {
    state.join_conditions[joinIndex].additional_conditions.splice(condIndex, 1);
    // Sync to data_table for persistence
    state.data_table.join_conditions = [...state.join_conditions];
}

/**
 * Update JOIN left table (when user changes selection)
 */
function updateJoinLeftTable(joinIndex: any) {
    state.join_conditions[joinIndex].left_column_name = '';
}

/**
 * Update JOIN right table (when user changes selection)
 */
function updateJoinRightTable(joinIndex: any) {
    state.join_conditions[joinIndex].right_column_name = '';
}

/**
 * Apply AI-suggested JOIN relationship (Issue #270)
 * Converts IInferredJoin to join_conditions format
 */
function handleApplySuggestedJoin(suggestion: any) {
    // Check if this JOIN already exists
    const isDuplicate = state.join_conditions.some((join: any) => 
        join.left_table_schema === suggestion.left_schema &&
        join.left_table_name === suggestion.left_table &&
        join.left_column_name === suggestion.left_column &&
        join.right_table_schema === suggestion.right_schema &&
        join.right_table_name === suggestion.right_table &&
        join.right_column_name === suggestion.right_column
    );

    if (isDuplicate) {
        $swal.fire({
            title: 'Duplicate JOIN',
            text: 'This JOIN relationship already exists in your model.',
            icon: 'info',
            confirmButtonText: 'OK'
        });
        return;
    }

    // Auto-select the columns involved in the JOIN if they're not already selected
    const columnsToSelect = [
        {
            schema: suggestion.left_schema,
            table_name: suggestion.left_table,
            column_name: suggestion.left_column,
            column_type: suggestion.left_column_type
        },
        {
            schema: suggestion.right_schema,
            table_name: suggestion.right_table,
            column_name: suggestion.right_column,
            column_type: suggestion.right_column_type
        }
    ];

    columnsToSelect.forEach(({ schema, table_name, column_name, column_type }) => {
        // Check if column already exists in data model
        const existingColumn = state.data_table.columns.find((col: any) =>
            col.schema === schema &&
            col.table_name === table_name &&
            col.column_name === column_name
        );

        if (existingColumn) {
            // Column exists but might not be selected - select it now
            if (!existingColumn.is_selected_column) {
                existingColumn.is_selected_column = true;
            }
        } else {
            // Column doesn't exist - find it in source tables and add it
            const sourceTable = state.tables.find((t: any) => 
                t.schema === schema && t.table_name === table_name
            );

            if (sourceTable) {
                const sourceColumn = sourceTable.columns.find((c: any) => c.column_name === column_name);
                
                if (sourceColumn) {
                    // Add column to data model with is_selected_column: true
                    const newColumn = {
                        schema: schema,
                        table_name: table_name,
                        column_name: column_name,
                        data_type: sourceColumn.data_type || column_type || 'text',
                        alias_name: '',
                        transform: '',
                        transform_close_parens: 0,
                        is_selected_column: true,
                        table_alias: null,
                        table_logical_name: sourceTable.logical_name || null
                    };
                    
                    state.data_table.columns.push(newColumn);
                } else {
                    console.warn(`[Data Model Builder] Source column not found: ${schema}.${table_name}.${column_name}`);
                }
            } else {
                console.warn(`[Data Model Builder] Source table not found: ${schema}.${table_name}`);
            }
        }
    });

    // Convert suggestion to join_conditions format
    const newJoin = {
        id: Date.now(),
        left_table_schema: suggestion.left_schema,
        left_table_name: suggestion.left_table,
        left_table_alias: null,
        left_column_name: suggestion.left_column,
        right_table_schema: suggestion.right_schema,
        right_table_name: suggestion.right_table,
        right_table_alias: null,
        right_column_name: suggestion.right_column,
        join_type: suggestion.suggested_join_type || 'INNER',
        primary_operator: '=',
        join_logic: 'AND',
        additional_conditions: [],
        is_auto_detected: false, // Manually applied by user, not auto-detected
        ai_suggested: true, // Mark as AI-suggested
        confidence_score: suggestion.confidence_score,
        reasoning: suggestion.reasoning
    };

    // Add to join conditions
    state.join_conditions.push(newJoin);
    state.data_table.join_conditions = [...state.join_conditions];

    // Mark as applied in store
    aiDataModelerStore.applySuggestion(suggestion.id);

    // Switch to advanced view to show JOIN conditions section
    if (state.viewMode !== 'advanced') {
        state.viewMode = 'advanced';
    }

    $swal.fire({
        title: 'JOIN Applied!',
        html: `
            <p class="text-sm text-gray-700 mb-2">
                ${suggestion.left_schema}.${suggestion.left_table}.${suggestion.left_column} 
                → 
                ${suggestion.right_schema}.${suggestion.right_table}.${suggestion.right_column}
            </p>
            <p class="text-xs text-gray-600 mb-2">
                <i class="fas fa-lightbulb text-yellow-500"></i> ${suggestion.reasoning}
            </p>
            <p class="text-xs text-green-600">
                <i class="fas fa-check-circle"></i> JOIN columns have been automatically selected for your data model
            </p>
        `,
        icon: 'success',
        confirmButtonText: 'OK',
        timer: 4000
    });
}

/**
 * Dismiss AI-suggested JOIN relationship (Issue #270)
 */
function handleDismissSuggestedJoin(suggestionId: any) {
    aiDataModelerStore.dismissSuggestion(suggestionId);
}

function getTableKeyForColumn(col: any, includeAlias: any = false) {
    const dataSourcePrefix = props.isCrossSource && col.data_source_id
        ? `${col.data_source_id}.`
        : '';
    const baseKey = `${dataSourcePrefix}${col.schema}.${col.table_name}`;
    if (includeAlias && col.table_alias) {
        return `${baseKey}::${col.table_alias}`;
    }
    return baseKey;
}

function findSourceTableForColumn(col: any) {
    return state.tables?.find((t: any) =>
        t.table_name === col.table_name &&
        t.schema === col.schema &&
        (!props.isCrossSource || !col.data_source_id || t.data_source_id === col.data_source_id)
    );
}

/**
 * Auto-detect JOIN conditions from foreign key relationships
 */
function autoDetectJoinConditions() {
    // Get unique tables from selected columns
    const uniqueTables = new Map();
    state.data_table.columns.forEach((col: any) => {
        const key = getTableKeyForColumn(col, true);

        if (!uniqueTables.has(key)) {
            uniqueTables.set(key, {
                schema: col.schema,
                table_name: col.table_name,
                table_alias: col.table_alias || null,
                data_source_id: col.data_source_id
            });
        }
    });

    const dataTables = Array.from(uniqueTables.values());

    if (dataTables.length < 2) {
        return;
    }

    // Get all FK relationships from metadata
    const relationshipReferences = state.tables
        .filter((table: any) => table.references && table.references.length > 0)
        .flatMap((table: any) => table.references);

    // Clear existing auto-detected JOINs (keep manual ones and AI-suggested ones)
    // AI-suggested joins that were manually applied by user should NOT be cleared
    state.join_conditions = state.join_conditions.filter((join: any) => !join.is_auto_detected || join.ai_suggested);

    // Build JOIN conditions from FK relationships
    const detectedJoins: any[] = [];

    // Track which table pairs are already connected (to prevent redundant JOINs)
    const connectedPairs = new Set();

    // Helper to check if two tables are already connected
    function areTablesConnected(schema1: any, table1: any, schema2: any, table2: any, dataSourceId1: any, dataSourceId2: any) {
        const prefix1 = props.isCrossSource && dataSourceId1 ? `${dataSourceId1}.` : '';
        const prefix2 = props.isCrossSource && dataSourceId2 ? `${dataSourceId2}.` : '';
        const key1 = `${prefix1}${schema1}.${table1}::${prefix2}${schema2}.${table2}`;
        const key2 = `${prefix2}${schema2}.${table2}::${prefix1}${schema1}.${table1}`;
        return connectedPairs.has(key1) || connectedPairs.has(key2);
    }

    // Helper to mark tables as connected
    function markTablesConnected(schema1: any, table1: any, schema2: any, table2: any, dataSourceId1: any, dataSourceId2: any) {
        const prefix1 = props.isCrossSource && dataSourceId1 ? `${dataSourceId1}.` : '';
        const prefix2 = props.isCrossSource && dataSourceId2 ? `${dataSourceId2}.` : '';
        const key = `${prefix1}${schema1}.${table1}::${prefix2}${schema2}.${table2}`;
        connectedPairs.add(key);
    }

    for (let i = 0; i < dataTables.length; i++) {
        for (let j = i + 1; j < dataTables.length; j++) {
            const table1 = dataTables[i];
            const table2 = dataTables[j];

            // Skip if tables are already connected
            if (areTablesConnected(table1.schema, table1.table_name, table2.schema, table2.table_name, table1.data_source_id, table2.data_source_id)) {
                continue;
            }

            // Find ALL FK relationships between these tables (important for self-referencing)
            const relationships = relationshipReferences.filter((ref: any) => {
                const matchForward = (
                    ref.local_table_schema === table1.schema &&
                    ref.local_table_name === table1.table_name &&
                    ref.foreign_table_schema === table2.schema &&
                    ref.foreign_table_name === table2.table_name
                );

                const matchReverse = (
                    ref.local_table_schema === table2.schema &&
                    ref.local_table_name === table2.table_name &&
                    ref.foreign_table_schema === table1.schema &&
                    ref.foreign_table_name === table1.table_name
                );

                return matchForward || matchReverse;
            });

            if (relationships.length > 0) {
                // Process each FK relationship
                relationships.forEach((relationship: any, relIndex: any) => {

                    // Check if JOIN already exists (avoid duplicates)
                    const joinExists = state.join_conditions.some((join: any) => {
                        return (
                            (join.left_table_schema === relationship.local_table_schema &&
                                join.left_table_name === relationship.local_table_name &&
                                join.right_table_schema === relationship.foreign_table_schema &&
                                join.right_table_name === relationship.foreign_table_name) ||
                            (join.right_table_schema === relationship.local_table_schema &&
                                join.right_table_name === relationship.local_table_name &&
                                join.left_table_schema === relationship.foreign_table_schema &&
                                join.left_table_name === relationship.foreign_table_name)
                        );
                    });

                    if (!joinExists) {
                        // Determine correct alias assignment based on FK relationship direction
                        let leftAlias, rightAlias;

                        // Match the FK relationship direction to the correct table with its alias
                        if (relationship.local_table_schema === table1.schema &&
                            relationship.local_table_name === table1.table_name) {
                            // table1 is the local (left) side
                            leftAlias = table1.table_alias;
                            rightAlias = table2.table_alias;
                        } else {
                            // table2 is the local (left) side
                            leftAlias = table2.table_alias;
                            rightAlias = table1.table_alias;
                        }

                        const newJoin = {
                            id: Date.now() + detectedJoins.length,
                            left_table_schema: relationship.local_table_schema,
                            left_table_name: relationship.local_table_name,
                            left_table_alias: leftAlias,
                            left_column_name: relationship.local_column_name,

                            right_table_schema: relationship.foreign_table_schema,
                            right_table_name: relationship.foreign_table_name,
                            right_table_alias: rightAlias,
                            right_column_name: relationship.foreign_column_name,

                            join_type: 'INNER',
                            primary_operator: '=',
                            join_logic: 'AND',
                            is_auto_detected: true,
                            additional_conditions: []
                        };
                        detectedJoins.push(newJoin);

                        // Mark these tables as connected
                        markTablesConnected(
                            relationship.local_table_schema,
                            relationship.local_table_name,
                            relationship.foreign_table_schema,
                            relationship.foreign_table_name,
                            table1.data_source_id,
                            table2.data_source_id
                        );
                    } else {
                    }
                }); // End forEach relationships
            } else {
                // NOTE (Issue #270): Smart column matching moved to backend service
                // AI-suggested joins are now fetched via watch() on state.tables and displayed in SuggestedJoinsPanel
                // Users can apply suggestions from the panel, which will add them to join_conditions
            }
        }
    }

    // Add detected JOINs to state
    state.join_conditions.push(...detectedJoins);
}

// NOTE (Issue #270): Old frontend pattern-matching functions removed
// Smart JOIN detection now handled by backend JoinInferenceService
// Suggestions displayed in SuggestedJoinsPanel component

async function deleteColumn(columnName: any) {
    // Find the column being deleted to get its full reference
    const columnToDelete = state.data_table.columns.find((col: any) => col.column_name === columnName);

    if (!columnToDelete) {
        console.warn(`[deleteColumn] Column ${columnName} not found in data model`);
        return;
    }

    // Build fully-qualified column reference for cleanup
    const fullColumnRef = buildColumnReference(columnToDelete);

    // 1. Remove from columns array
    state.data_table.columns = state.data_table.columns.filter((column: any) => {
        column.alias_name = "";
        return column.column_name !== columnName;
    });

    // If no columns left, reset everything
    if (state.data_table.columns.length === 0) {
        state.data_table.query_options.where = [];
        state.data_table.query_options.group_by = {};
        state.data_table.query_options.order_by = [];
        state.data_table.query_options.offset = -1;
        state.data_table.query_options.limit = -1;
        await executeQueryOnExternalDataSource();
        return;
    }

    // 2. Clean up GROUP BY columns (AI-generated string array)
    if (state.data_table.query_options?.group_by?.group_by_columns?.length > 0) {
        state.data_table.query_options.group_by.group_by_columns =
            state.data_table.query_options.group_by.group_by_columns.filter((col: any) => {
                // Remove exact matches and columns wrapped in transform functions
                return !col.includes(fullColumnRef);
            });
    }

    // 3. Clean up aggregate functions
    if (state.data_table.query_options?.group_by?.aggregate_functions?.length > 0) {
        state.data_table.query_options.group_by.aggregate_functions =
            state.data_table.query_options.group_by.aggregate_functions.filter((aggFunc: any) => {
                return aggFunc.column !== fullColumnRef;
            });

        // If no aggregate functions remain, reset GROUP BY
        if (state.data_table.query_options.group_by.aggregate_functions.length === 0) {
            state.data_table.query_options.group_by = {};
        }
    }

    // 4. Clean up aggregate expressions
    if (state.data_table.query_options?.group_by?.aggregate_expressions?.length > 0) {
        state.data_table.query_options.group_by.aggregate_expressions =
            state.data_table.query_options.group_by.aggregate_expressions.filter((aggExpr: any) => {
                return !aggExpr.expression.includes(fullColumnRef);
            });
    }
    
    // Sync GROUP BY columns after all cleanup operations
    if (state.data_table.query_options?.group_by?.aggregate_functions?.length > 0 ||
        state.data_table.query_options?.group_by?.aggregate_expressions?.length > 0) {
        syncGroupByColumns();
    }

    // 5. Clean up WHERE clauses
    if (state.data_table.query_options?.where?.length > 0) {
        state.data_table.query_options.where =
            state.data_table.query_options.where.filter((whereClause: any) => {
                return whereClause.column !== fullColumnRef;
            });
    }

    // 6. Clean up ORDER BY clauses
    if (state.data_table.query_options?.order_by?.length > 0) {
        state.data_table.query_options.order_by =
            state.data_table.query_options.order_by.filter((orderClause: any) => {
                return orderClause.column !== fullColumnRef;
            });
    }

    // 7. Clean up HAVING conditions
    if (state.data_table.query_options?.group_by?.having_conditions?.length > 0) {
        state.data_table.query_options.group_by.having_conditions =
            state.data_table.query_options.group_by.having_conditions.filter((havingClause: any) => {
                return havingClause.column !== fullColumnRef;
            });
    }

    // Execute query with cleaned-up model
    await executeQueryOnExternalDataSource();
}
function isColumnInDataModel(columnName: any, tableIdentifier: any, tableAlias: any = null) {
    return state.data_table.columns.some((column: any) => {
        const colIdentifier = column.table_alias || column.table_name;
        const checkIdentifier = tableAlias || tableIdentifier;
        return column.column_name === columnName && colIdentifier === checkIdentifier;
    });
}

/**
 * Check if a column is used in an aggregate function (but not in regular SELECT)
 */
function isColumnUsedInAggregate(columnName: any, schema: any, tableName: any) {
    const columnPath = `${schema}.${tableName}.${columnName}`;

    // Check if in regular SELECT
    const inSelect = state.data_table.columns.some((col: any) =>
        col.schema === schema &&
        col.table_name === tableName &&
        col.column_name === columnName &&
        col.is_selected_column
    );

    if (inSelect) {
        return false; // Already in regular SELECT
    }

    // Check if used in aggregate functions
    const aggregateFunctions = state.data_table.query_options?.group_by?.aggregate_functions || [];
    const inAggregateFunctions = aggregateFunctions.some((aggFunc: any) => aggFunc.column === columnPath);
    
    if (inAggregateFunctions) {
        return true;
    }
    
    // Check if used in aggregate expressions
    const aggregateExpressions = state.data_table.query_options?.group_by?.aggregate_expressions || [];
    return aggregateExpressions.some((aggExpr: any) => {
        if (!aggExpr.expression) return false;
        
        // Check if full path appears in expression
        if (aggExpr.expression.includes(columnPath)) {
            return true;
        }
        
        // Check if just column name appears (after schema.table prefix was stripped)
        const columnNamePattern = new RegExp(`\\b${columnName}\\b`);
        return columnNamePattern.test(aggExpr.expression);
    });
}

/**
 * Check if a column is referenced in GROUP BY (but not selected for display)
 */
function isColumnInGroupByButHidden(column: any) {
    if (column.is_selected_column) return false; // Not hidden
    
    const columnPath = `${column.schema}.${column.table_name}.${column.column_name}`;
    const groupByColumns = state.data_table.query_options?.group_by?.group_by_columns || [];
    
    // Check if column reference exists in group_by_columns array
    return groupByColumns.some((ref: any) => {
        // Remove transform functions to get base column reference
        const baseRef = ref.replace(/\w+\(/g, '').replace(/\)/g, '');
        return baseRef.includes(columnPath) || ref.includes(columnPath);
    });
}

/**
 * Add or update hidden referenced column tracking
 * Tracks columns used in aggregates, GROUP BY, WHERE, etc. but not displayed
 */
function addHiddenReferencedColumn(schema: any, tableName: any, columnName: any, usage: any, reference: any) {
    // Initialize if doesn't exist
    if (!state.data_table.hidden_referenced_columns) {
        state.data_table.hidden_referenced_columns = [];
    }
    
    // CRITICAL: First check if column already exists in data model
    // This handles the case when loading existing saved models
    const existingColumn = state.data_table.columns.find((col: any) =>
        col.schema === schema &&
        col.table_name === tableName &&
        col.column_name === columnName
    );
    
    // Check if already tracked
    const existing = state.data_table.hidden_referenced_columns.find((col: any) =>
        col.schema === schema &&
        col.table_name === tableName &&
        col.column_name === columnName
    );
    
    if (existing) {
        // Update existing tracking
        if (!existing.usage.includes(usage)) {
            existing.usage.push(usage);
        }
        if (reference && !existing.referenced_in.includes(reference)) {
            existing.referenced_in.push(reference);
        }
    } else {
        // Need to create new tracking entry
        // Try to get metadata from source tables first
        const sourceTable = state.tables.find((t: any) => 
            t.schema === schema && t.table_name === tableName
        );
        const sourceColumn = sourceTable?.columns?.find((c: any) => 
            c.column_name === columnName
        );
        
        // Get data type from source or existing column
        const dataType = sourceColumn?.data_type || existingColumn?.data_type || 'text';
        
        // Add new tracking entry
        state.data_table.hidden_referenced_columns.push({
            schema,
            table_name: tableName,
            column_name: columnName,
            data_type: dataType,
            usage: [usage],
            referenced_in: reference ? [reference] : []
        });
        
        // If column doesn't exist in data model yet, add it with is_selected_column: false
        if (!existingColumn) {
            if (sourceColumn) {
                state.data_table.columns.push({
                    schema,
                    table_name: tableName,
                    column_name: columnName,
                    data_type: sourceColumn.data_type,
                    alias_name: '',
                    transform: '',
                    transform_close_parens: 0,
                    is_selected_column: false,
                    table_alias: null
                });
            } else {
                console.warn(`[addHiddenReferencedColumn] Cannot add column - source not found: ${schema}.${tableName}.${columnName}`);
            }
        }
    }
}

/**
 * Remove usage tracking from hidden column
 * If no more usages exist, remove from tracking and columns array
 */
function removeHiddenColumnUsage(schema: any, tableName: any, columnName: any, usage: any, reference: any) {
    if (!state.data_table.hidden_referenced_columns) return;
    
    const hidden = state.data_table.hidden_referenced_columns.find((col: any) =>
        col.schema === schema &&
        col.table_name === tableName &&
        col.column_name === columnName
    );
    
    if (!hidden) return;
    
    // Remove specific usage
    hidden.usage = hidden.usage.filter((u: any) => u !== usage);
    if (reference) {
        hidden.referenced_in = hidden.referenced_in.filter((r: any) => r !== reference);
    }
    
    // If no more usages, remove entirely
    if (hidden.usage.length === 0) {
        state.data_table.hidden_referenced_columns = 
            state.data_table.hidden_referenced_columns.filter((col: any) =>
                !(col.schema === schema &&
                  col.table_name === tableName &&
                  col.column_name === columnName)
            );
        
        // Also remove from columns if not selected for display
        const colInList = state.data_table.columns.find((col: any) =>
            col.schema === schema &&
            col.table_name === tableName &&
            col.column_name === columnName
        );
        
        if (colInList && !colInList.is_selected_column) {
            state.data_table.columns = state.data_table.columns.filter((col: any) =>
                !(col.schema === schema &&
                  col.table_name === tableName &&
                  col.column_name === columnName)
            );
        }
    }
}

/**
 * Get list of usages for a column (for UI badges)
 */
function getColumnUsages(column: any) {
    const hidden = state.data_table.hidden_referenced_columns?.find((col: any) =>
        col.schema === column.schema &&
        col.table_name === column.table_name &&
        col.column_name === column.column_name
    );
    return hidden?.usage || [];
}

/**
 * Get logical (human-readable) table name from state.tables
 * Falls back to physical table name if no metadata exists
 */
function getTableLogicalName(schema: any, tableName: any) {
    const table = state.tables.find((t: any) => 
        t.schema === schema && t.table_name === tableName
    );
    return table?.logical_name || tableName;
}

/**
 * Extract table name from column alias
 * Aliases are in format: tableName_columnName or schema_tableName_columnName
 */
function getColumnTableName(columnAlias: any) {
    // Find the column in data_table.columns to get accurate table info
    const column = state.data_table.columns.find((col: any) => {
        const expectedAlias = col.alias_name || 
            (col.table_alias || col.table_name) + '_' + col.column_name;
        return columnAlias === expectedAlias || columnAlias.endsWith('_' + col.column_name);
    });
    
    if (column) {
        return column.table_logical_name || getTableLogicalName(column.schema, column.table_name);
    }
    
    // Fallback: parse from alias (format: table_column or schema_table_column)
    const parts = columnAlias.split('_');
    if (parts.length >= 2) {
        // Remove the last part (column name) to get table name
        const tablePart = parts.slice(0, -1).join('_');
        return tablePart;
    }
    
    return columnAlias;
}

/**
 * Get display name for column in response table
 * Shows logical table name with column name
 */
function getColumnDisplayName(columnAlias: any) {
    // Find the column in data_table.columns
    const column = state.data_table.columns.find((col: any) => {
        const expectedAlias = col.alias_name || 
            (col.table_alias || col.table_name) + '_' + col.column_name;
        return columnAlias === expectedAlias || columnAlias.endsWith('_' + col.column_name);
    });
    
    if (column) {
        const logicalTableName = column.table_logical_name || getTableLogicalName(column.schema, column.table_name);
        return `${logicalTableName}.${column.column_name}`;
    }
    
    // Fallback: use the alias as-is
    return columnAlias;
}

/**
 * Format column reference with logical table name
 * Converts schema.table.column to LogicalTableName.column
 * @param {string} columnRef - Column reference in format schema.table.column
 * @returns {string} Formatted string with logical table name
 */
function formatColumnReferenceWithLogicalName(columnRef: any) {
    if (!columnRef || typeof columnRef !== 'string') {
        return columnRef;
    }
    
    // Parse schema.table.column format
    const parts = columnRef.split('.');
    if (parts.length !== 3) {
        return columnRef; // Not a standard column reference
    }
    
    const [schema, tableName, columnName] = parts;
    
    // Find the column in data_table to get logical name
    const column = state.data_table.columns.find((col: any) => 
        col.schema === schema && 
        col.table_name === tableName && 
        col.column_name === columnName
    );
    
    if (column) {
        const logicalTableName = column.table_logical_name || getTableLogicalName(schema, tableName);
        if (column.table_alias) {
            return `${column.table_alias} (${logicalTableName}).${columnName}`;
        }
        return `${logicalTableName}.${columnName}`;
    }
    
    // Fallback: try to get logical name without column match
    const logicalName = getTableLogicalName(schema, tableName);
    return `${logicalName}.${columnName}`;
}

/**
 * Format expressions with logical table names
 * Replaces all schema.table.column references with LogicalTableName.column
 * @param {string} expression - Expression string that may contain column references
 * @returns {string} Expression with logical table names
 */
function formatExpressionWithLogicalNames(expression: any) {
    if (!expression || typeof expression !== 'string') {
        return expression;
    }
    
    // Match schema.table.column pattern (alphanumeric, underscores, dots)
    const columnRefPattern = /([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)/g;
    
    return expression.replace(columnRefPattern, (match, schema, tableName, columnName) => {
        const fullRef = `${schema}.${tableName}.${columnName}`;
        return formatColumnReferenceWithLogicalName(fullRef);
    });
}
function addQueryOption(queryOption: any) {
    if (queryOption === 'WHERE') {
        state.data_table.query_options.where.push({
            name: queryOption,
            column: '',
            column_data_type: '',
            equality: '',// equality: '=', '>', '<', '>=', '<=', '!='
            value: '',
            condition: '',// condition: 'AND', 'OR'
        });
    } else if (queryOption === 'GROUP BY') {
        if (!state?.data_table?.query_options?.group_by?.name) {
            state.data_table.query_options.group_by.name = queryOption;
        }
        if (!state?.data_table?.query_options?.group_by?.aggregate_functions) {
            state.data_table.query_options.group_by.aggregate_functions = [{
                column: '',
                column_alias_name: '',
                aggregate_function: '',// aggregate_functions: 'SUM', 'AVG', 'COUNT', 'MIN', 'MAX'
                use_distinct: false,
            }];
        } else {
            state.data_table.query_options.group_by.aggregate_functions.push({
                column: '',
                column_alias_name: '',
                aggregate_function: '',// aggregate_functions: 'SUM', 'AVG', 'COUNT', 'MIN', 'MAX'
                use_distinct: false,
            });
        }

        if (!state?.data_table?.query_options?.group_by?.aggregate_expressions) {
            state.data_table.query_options.group_by.aggregate_expressions = [];
        }

        if (!state?.data_table?.query_options?.group_by?.having_conditions) {
            state.data_table.query_options.group_by.having_conditions = [{
                column: '',
                column_data_type: '',
                equality: '',// equality: '=', '>', '<', '>=', '<=', '!='
                value: '',
                condition: '',// condition: 'AND', 'OR'
            }]
        }
        
        // Sync GROUP BY columns after structure initialization
        nextTick(() => syncGroupByColumns());
    } else if (queryOption === 'HAVING') {
        state.data_table.query_options.group_by.having_conditions.push({
            column: '',
            column_data_type: '',
            equality: '',// equality: '=', '>', '<', '>=', '<=', '!='
            value: '',
            condition: '',// condition: 'AND', 'OR'
        })
    } else if (queryOption === 'ORDER BY') {
        state.data_table.query_options.order_by.push({
            name: queryOption,
            column: '',
            order: '',// order: 'ASC', 'DESC' 
        });
    } else if (queryOption === 'OFFSET') {
        state.data_table.query_options.offset = 0;
    } else if (queryOption === 'LIMIT') {
        state.data_table.query_options.limit = 1;
    }
    state.show_dialog = false;
}
function addAggregateExpression() {
    // Initialize GROUP BY object ONLY if it doesn't exist (minimal structure)
    if (!state?.data_table?.query_options?.group_by) {
        state.data_table.query_options.group_by = {};
    }
    
    // Initialize ONLY aggregate_expressions array (don't touch other GROUP BY properties)
    if (!state.data_table.query_options.group_by.aggregate_expressions) {
        state.data_table.query_options.group_by.aggregate_expressions = [];
    }

    // Add new aggregate expression
    state.data_table.query_options.group_by.aggregate_expressions.push({
        expression: '',
        column_alias_name: '',
        column_data_type: 'text', // Default to text, will be inferred from expression
    });
    
    // Sync GROUP BY columns after adding expression
    nextTick(() => syncGroupByColumns());
}
function removeAggregateExpression(index: any) {
    state.data_table.query_options.group_by.aggregate_expressions.splice(index, 1);
    
    // Sync GROUP BY columns after removing expression
    syncGroupByColumns();
}

/**
 * Add a column to group_by_columns from dropdown selection
 */
function addGroupByColumn(event: any) {
    const columnRef = event.target.value;
    if (!columnRef) return;
    
    // Initialize arrays if needed
    if (!state.data_table.query_options.group_by) {
        state.data_table.query_options.group_by = {};
    }
    if (!state.data_table.query_options.group_by.group_by_columns) {
        state.data_table.query_options.group_by.group_by_columns = [];
    }
    
    // Don't add duplicates
    if (!state.data_table.query_options.group_by.group_by_columns.includes(columnRef)) {
        state.data_table.query_options.group_by.group_by_columns.push(columnRef);
        
        // Ensure GROUP BY name flag is set for SQL generation
        if (!state.data_table.query_options.group_by.name) {
            state.data_table.query_options.group_by.name = 'GROUP BY';
        }
    }
    
    // Reset dropdown
    event.target.value = '';
}

/**
 * Remove a column from group_by_columns by index
 */
function removeGroupByColumn(index: any) {
    if (state.data_table.query_options?.group_by?.group_by_columns) {
        state.data_table.query_options.group_by.group_by_columns.splice(index, 1);
    }
}
function onTransformChange(element: any, event: any) {
    const selectedFunc = state.transform_functions.find((f: any) => f.value === event.target.value);
    element.transform_close_parens = selectedFunc?.close_parens || 0;
}
function getValuePlaceholder(equalityIndex: any) {
    const operator = state.equality[equalityIndex];
    if (operator === 'IN' || operator === 'NOT IN') {
        return "'value1','value2','value3'";
    }
    return 'Enter value';
}
function removeQueryOption(queryOption: any, index: any) {
    if (queryOption === 'WHERE') {
        state.data_table.query_options.where.splice(index, 1);
    } else if (queryOption === 'GROUP BY') {
        if (state.data_table.query_options.group_by.aggregate_functions.length > 1) {
            state.data_table.query_options.group_by.aggregate_functions.splice(index, 1);
        } else {
            state.data_table.query_options.group_by = {};
        }
    } else if (queryOption === 'ORDER BY') {
        state.data_table.query_options.order_by.splice(index, 1);
    } else if (queryOption === 'HAVING') {
        state.data_table.query_options.group_by.having_conditions.splice(index, 1);
    } else if (queryOption === 'OFFSET') {
        state.data_table.query_options.offset = -1;
    } else if (queryOption === 'LIMIT') {
        state.data_table.query_options.limit = -1;
    }
}
function addCalculatedColumnOperation(type: any) {
    state.calculated_column.columns.push({
        column_name: '',
        operator: null, //the first operator will always be null
        type: type,
        numeric_value: 0,
    });
}
function deleteCalculatedColumnOperation(index: any) {
    if (state.calculated_column.columns.length > 1) {
        state.calculated_column.columns.splice(index, 1);
    } else {
        $swal.fire({
            icon: 'error',
            title: `Error!`,
            text: `You must have at least one calculated column operation.`,
        });
    }
}

/**
 * Recursively expand calculated column references in an expression
 * Replaces calculated column aliases with their full expressions
 * @param {string} expression - The expression to expand
 * @returns {string} - Fully expanded expression with all calculated columns inlined
 */
function expandCalculatedColumnReferences(expression: any) {
    if (!expression || typeof expression !== 'string') {
        return expression;
    }
    
    let expandedExpression = expression;
    let changed = true;
    let iterations = 0;
    const maxIterations = 10; // Prevent infinite loops
    
    // Keep expanding until no more calculated column references found
    while (changed && iterations < maxIterations) {
        changed = false;
        iterations++;
        
        // Check each calculated column to see if it's referenced in the expression
        state.data_table.calculated_columns?.forEach((calcCol: any) => {
            if (!calcCol.column_name || !calcCol.expression) return;
            
            // Create regex to match the column name as a whole word
            const columnNameRegex = new RegExp(`\\b${calcCol.column_name}\\b`, 'g');
            
            if (columnNameRegex.test(expandedExpression)) {
                // Replace all occurrences with the expression (wrapped in parentheses)
                expandedExpression = expandedExpression.replace(columnNameRegex, `(${calcCol.expression})`);
                changed = true;
            }
        });
    }
    
    if (iterations >= maxIterations) {
        console.warn('[expandCalculatedColumnReferences] Max iterations reached, possible circular reference');
    }
    
    return expandedExpression;
}

/**
 * Check for circular references in calculated columns
 * @param {string} newColumnName - Name of the calculated column being created
 * @param {Array} selectedColumns - Array of column references in the expression
 * @param {Set} visited - Set of visited column names (for recursion)
 * @returns {boolean} - True if circular reference detected
 */
function hasCircularReference(newColumnName: any, selectedColumns: any, visited: any = new Set()) {
    if (visited.has(newColumnName)) {
        return true;
    }
    visited.add(newColumnName);

    // Check each column reference in the expression
    for (const colRef of selectedColumns) {
        if (colRef.type === 'column') {
            // Find if this is a calculated column
            const referencedCalcCol = state.data_table.calculated_columns?.find((c: any) => c.column_name === colRef.column_name);
            
            if (referencedCalcCol) {
                // Parse the referenced calculated column's expression to find its dependencies
                const referencedColDeps = state.calculated_column.columns
                    .filter((c: any) => c.type === 'column' && referencedCalcCol.expression.includes(c.column_name));
                
                // Recursively check for circular references
                if (hasCircularReference(colRef.column_name, referencedColDeps, new Set(visited))) {
                    return true;
                }
            }
        }
    }

    return false;
}

async function addCalculatedColumn() {
    if (state.calculated_column.column_name === '') {
        $swal.fire({
            icon: 'error',
            title: `Error!`,
            text: `Please enter a name for the calculated column.`,
        });
        return;
    }
    
    if (state.calculated_column.columns.length === 0 || state.calculated_column.columns.filter((column: any) => column.column_name === '' && column.type === 'column').length > 0) {
        $swal.fire({
            icon: 'error',
            title: `Error!`,
            text: `Please select at least one column to the calculated column.`,
        });
        return;
    }
    
    if (state.calculated_column.columns.length === 0 || state.calculated_column.columns.filter((column: any, index: any) => index > 0 && column.operator === null).length > 0) {
        $swal.fire({
            icon: 'error',
            title: `Error!`,
            text: `Please select at least one operator to the calculated column.`,
        });
        return;
    }

    // Validate aggregate usage
    const usesAggregates = state.calculated_column.columns.some((col: any) => {
        const colInfo = numericColumnsWithAggregates.value.find((c: any) => c.value === col.column_name);
        return colInfo && (colInfo.type === 'aggregate_function' || colInfo.type === 'aggregate_expression');
    });

    if (usesAggregates && !showGroupByClause.value) {
        $swal.fire({
            icon: 'error',
            title: `Error!`,
            text: `Cannot use aggregate columns in calculations without GROUP BY. Please add GROUP BY first.`,
        });
        return;
    }
    
    // Validation 5: Check for circular references
    if (hasCircularReference(state.calculated_column.column_name, state.calculated_column.columns)) {
        $swal.fire({
            icon: 'error',
            title: `Circular Reference Detected!`,
            text: `This calculated column creates a circular reference. Calculated columns cannot reference themselves directly or indirectly.`,
        });
        return;
    }
    
    let expression = "";
    for (let i = 0; i < state.calculated_column.columns.length; i++) {
        const column = state.calculated_column.columns[i];
        const operator = column.operator;
        const type = column.type;

        // Get the proper column reference (fully qualified for base columns, alias for others)
        let columnRef = column.column_name;
        if (type === 'column') {
            const colInfo = numericColumnsWithAggregates.value.find((c: any) => c.value === column.column_name);
            if (colInfo && colInfo.type === 'base_column') {
                // Use fully qualified name for base columns
                columnRef = `${colInfo.schema}.${colInfo.table_name}.${colInfo.column_name}`;
            }
            // For aggregates and calculated columns, use the alias name
            // Calculated column references will be expanded later via expandCalculatedColumnReferences()
        }

        if (i === 0) {
            //the first operator will always be null, so we skip it
            expression += `${columnRef}`;
        } else {
            let value = type === 'column' ? columnRef : column.numeric_value;
            if (operator === 'ADD') {
                expression += ` + ${value}`;
            } else if (operator === 'SUBTRACT') {
                expression += ` - ${value}`;
            } else if (operator === 'MULTIPLY') {
                expression += ` * ${value}`;
            } else if (operator === 'DIVIDE') {
                expression += ` / ${value}`;
            } else if (operator === 'MODULO') {
                expression += ` % ${value}`;
            }
        }
    }
    
    // Expand any calculated column references in the expression
    const expandedExpression = expandCalculatedColumnReferences(expression);
    
    const finalColumn = {
        column_name: state.calculated_column.column_name,
        expression: `ROUND(${expandedExpression}, 2)`,
        column_data_type: state.calculated_column.column_data_type,
    };
    
    state.data_table.calculated_columns.push(finalColumn);
    
    // Sync GROUP BY to include calculated column expressions
    if (state.data_table.query_options?.group_by?.aggregate_functions?.length > 0 ||
        state.data_table.query_options?.group_by?.aggregate_expressions?.length > 0) {
        syncGroupByColumns();
    }
    
    state.show_calculated_column_dialog = false;
    await executeQueryOnExternalDataSource();
}
async function deleteCalculatedColumn(index: any) {
    state.data_table.calculated_columns.splice(index, 1);
    
    // Sync GROUP BY to remove deleted calculated column
    if (state.data_table.query_options?.group_by?.aggregate_functions?.length > 0 ||
        state.data_table.query_options?.group_by?.aggregate_expressions?.length > 0) {
        syncGroupByColumns();
    }
    
    await executeQueryOnExternalDataSource();
}
function buildSQLQuery(silent = false) {
    let sqlQuery = '';
    let fromJoinClause: any[] = [];

    // Build table references including aliases
    // Format: "schema.table_name::alias" if aliased, "schema.table_name" if not
    let dataTables = state.data_table.columns.map((column: any) => {
        const tableRef = column.table_alias
            ? `${column.schema}.${column.table_name}::${column.table_alias}`
            : `${column.schema}.${column.table_name}`;
        return tableRef;
    });

    let fromJoinClauses = [];
    const tableCombinations = [];
    dataTables = _.uniq(dataTables);
    console.error('[DEBUG] dataTables.length:', dataTables.length, 'Tables:', dataTables);
    if (dataTables.length === 1) {
        // Single table (possibly aliased)
        const tableRef = dataTables[0];
        const hasAlias = tableRef.includes('::');

        if (hasAlias) {
            const [schemaTable, alias] = tableRef.split('::');
            fromJoinClause.push(`FROM ${schemaTable} AS ${alias}`);
        } else {
            fromJoinClause.push(`FROM ${tableRef}`);
        }

        // Build set of columns used in aggregate functions (these should not appear in SELECT as regular columns)
        const aggregateColumns = new Set();
        state?.data_table?.query_options?.group_by?.aggregate_functions?.forEach((aggFunc: any) => {
            if (aggFunc.column && aggFunc.aggregate_function !== '') {
                aggregateColumns.add(aggFunc.column);
            }
        });

        sqlQuery = `SELECT ${state.data_table.columns.filter((column: any) => {
            // Exclude columns that are ONLY used in aggregates (not for grouping)
            if (!column.is_selected_column) return false;
            
            const columnFullPath = `${column.schema}.${column.table_name}.${column.column_name}`;
            const isAggregateOnly = aggregateColumns.has(columnFullPath);
            
            return !isAggregateOnly;
        }).map((column: any) => {
            const tableName = column.table_name.length > 20 ? column.table_name.slice(-20) : column.table_name;
            const tableRef = column.table_alias || tableName;
            const aliasName = column?.alias_name !== '' ? column.alias_name : `${tableRef}_${column.column_name}`;
            // Use 2-part identifier (table.column) - schema is already in FROM clause
            const columnRef = column.table_alias
                ? `${column.table_alias}.${column.column_name}`
                : `${column.table_name}.${column.column_name}`;
            return `${columnRef} AS ${aliasName}`;
        }).join(', ')}`;
    } else {
        // Use state.join_conditions for JOIN generation

        // Convert state.join_conditions to fromJoinClauses format
        fromJoinClauses = state.join_conditions.map((join: any) => ({
            local_table_schema: join.left_table_schema,
            local_table_name: join.left_table_name,
            local_table_alias: join.left_table_alias,
            local_column_name: join.left_column_name,
            foreign_table_schema: join.right_table_schema,
            foreign_table_name: join.right_table_name,
            foreign_table_alias: join.right_table_alias,
            foreign_column_name: join.right_column_name,
            join_type: join.join_type || 'INNER',
            additional_conditions: join.additional_conditions || []
        }));

        // Detect orphaned tables (tables with no JOINs to other selected tables)
        const tablesInJoins = new Set();
        fromJoinClauses.forEach((clause: any) => {
            const leftKey = clause.local_table_alias
                ? `${clause.local_table_schema}.${clause.local_table_name}::${clause.local_table_alias}`
                : `${clause.local_table_schema}.${clause.local_table_name}`;
            const rightKey = clause.foreign_table_alias
                ? `${clause.foreign_table_schema}.${clause.foreign_table_name}::${clause.foreign_table_alias}`
                : `${clause.foreign_table_schema}.${clause.foreign_table_name}`;
            tablesInJoins.add(leftKey);
            tablesInJoins.add(rightKey);
        });

        const orphanedTables = dataTables.filter((table: any) => {
            // For tables with aliases, check with :: format
            return !tablesInJoins.has(table);
        });

        if (orphanedTables.length > 0) {
            const orphanedAlert = {
                type: 'warning',
                message: `Warning: The following tables have no JOIN conditions: ${orphanedTables.join(', ')}. The query will use CROSS JOIN (Cartesian product), which may return unexpected results. Consider adding JOIN conditions.`
            };
            console.warn('[Data Model Builder - buildSQLQuery] ORPHANED TABLE WARNING:', orphanedAlert.message);
            if (!state.alerts.find((a: any) => a.type === 'warning' && a.message.includes('no JOIN conditions'))) {
                state.alerts.push(orphanedAlert);
            }
        } else {
            // Remove orphaned table warning if it exists and no longer applies
            state.alerts = state.alerts.filter((a: any) => !(a.type === 'warning' && a.message.includes('no JOIN conditions')));
            state.alerts = state.alerts.filter((a: any) => !(a.type === 'error' && a.message.includes('no JOIN conditions')));
            state.alerts = state.alerts.filter((a: any) => !(a.type === 'error' && a.message.includes('no foreign key relationships')));
        }

        /**
         * Reordering the fromJoinClauses using topological sort to ensure proper JOIN order.
         * A table can only be joined if all tables it references are already in the FROM clause.
         */
        const sortedClauses = [];
        const addedTables = new Set();
        const clausesToProcess = [...fromJoinClauses];

        // Keep processing until all clauses are added or we detect a circular dependency
        let lastCount = -1;
        while (clausesToProcess.length > 0 && lastCount !== clausesToProcess.length) {
            lastCount = clausesToProcess.length;

            for (let i = clausesToProcess.length - 1; i >= 0; i--) {
                const clause = clausesToProcess[i];
                const localTable = `${clause.local_table_schema}.${clause.local_table_name}`;
                const foreignTable = `${clause.foreign_table_schema}.${clause.foreign_table_name}`;

                // Check if both tables referenced in this join are available
                // A table is available if: it's in addedTables OR it will be added by this clause
                const localAvailable = addedTables.has(localTable);
                const foreignAvailable = addedTables.has(foreignTable);

                // We can add this clause if at least one of the tables is already available
                if (localAvailable || foreignAvailable || addedTables.size === 0) {
                    sortedClauses.push(clause);
                    addedTables.add(localTable);
                    addedTables.add(foreignTable);
                    clausesToProcess.splice(i, 1);
                }
            }
        }

        // If there are still unprocessed clauses, add them anyway (circular dependency case)
        sortedClauses.push(...clausesToProcess);
        fromJoinClauses = sortedClauses;

        // Determine primary table: the table with the most selected columns
        const tableColumnCounts: Record<string, number> = {};
        state.data_table.columns.filter((col: any) => col.is_selected_column).forEach((col: any) => {
            const tableKey = getTableKeyForColumn(col);
            tableColumnCounts[tableKey] = (tableColumnCounts[tableKey] || 0) + 1;
        });

        let primaryTable = null;
        let maxCount = 0;
        for (const [table, count] of Object.entries(tableColumnCounts) as [string, number][]) {
            if (count > maxCount) {
                maxCount = count;
                primaryTable = table;
            }
        }

        // Reorder fromJoinClauses to start with the primary table
        if (primaryTable && fromJoinClauses.length > 0) {
            const parsedPrimary = parseTableKey(primaryTable);
            const primarySchema = parsedPrimary.schema;
            const primaryTableName = parsedPrimary.table;

            // Find a JOIN that includes the primary table
            const primaryJoinIndex = fromJoinClauses.findIndex(clause =>
                (clause.local_table_schema === primarySchema && clause.local_table_name === primaryTableName) ||
                (clause.foreign_table_schema === primarySchema && clause.foreign_table_name === primaryTableName)
            );

            if (primaryJoinIndex > 0) {
                // Move primary JOIN to the beginning
                const primaryJoin = fromJoinClauses[primaryJoinIndex];
                fromJoinClauses.splice(primaryJoinIndex, 1);

                // If primary table is on the right side, swap it to left
                if (primaryJoin.foreign_table_schema === primarySchema && primaryJoin.foreign_table_name === primaryTableName) {
                    const temp = {
                        local_table_schema: primaryJoin.foreign_table_schema,
                        local_table_name: primaryJoin.foreign_table_name,
                        local_table_alias: primaryJoin.foreign_table_alias,
                        local_column_name: primaryJoin.foreign_column_name,
                        foreign_table_schema: primaryJoin.local_table_schema,
                        foreign_table_name: primaryJoin.local_table_name,
                        foreign_table_alias: primaryJoin.local_table_alias,
                        foreign_column_name: primaryJoin.local_column_name,
                        join_type: primaryJoin.join_type,
                        primary_operator: primaryJoin.primary_operator,
                        additional_conditions: primaryJoin.additional_conditions
                    };
                    fromJoinClauses.unshift(temp);
                } else {
                    fromJoinClauses.unshift(primaryJoin);
                }
            }
        }

        // Helper function to find alias for a table in selected columns
        const getTableAlias = (schema: any, tableName: any) => {
            const col = state.data_table.columns.find((c: any) =>
                c.schema === schema && c.table_name === tableName && c.table_alias
            );
            return col?.table_alias || null;
        };

        fromJoinClauses.forEach((clause: any, index: any) => {
            // Get aliases if they exist
            const localAlias = clause.local_table_alias || getTableAlias(clause.local_table_schema, clause.local_table_name);
            const foreignAlias = clause.foreign_table_alias || getTableAlias(clause.foreign_table_schema, clause.foreign_table_name);

            // Build table references with AS clauses if aliased
            const localTableFull = `${clause.local_table_schema}.${clause.local_table_name}`;
            const foreignTableFull = `${clause.foreign_table_schema}.${clause.foreign_table_name}`;

            const localTableSQL = localAlias ? `${localTableFull} AS ${localAlias}` : localTableFull;
            const foreignTableSQL = foreignAlias ? `${foreignTableFull} AS ${foreignAlias}` : foreignTableFull;

            // For ON conditions, use alias if it exists, otherwise use table name
            const localRef = localAlias || clause.local_table_name;
            const foreignRef = foreignAlias || clause.foreign_table_name;

            // Get JOIN type (default to INNER if not specified)
            const joinType = clause.join_type || 'INNER';

            if (index === 0) {
                const operator = clause.primary_operator || '=';
                fromJoinClause.push(`FROM ${localTableSQL}`)
                fromJoinClause.push(`${joinType} JOIN ${foreignTableSQL}`)
                fromJoinClause.push(`ON ${clause.local_table_schema}.${localRef}.${clause.local_column_name} ${operator} ${clause.foreign_table_schema}.${foreignRef}.${clause.foreign_column_name}`)

                // Add additional conditions if present
                if (clause.additional_conditions && clause.additional_conditions.length > 0) {
                    clause.additional_conditions.forEach((addCond: any) => {
                        if (addCond.left_column && addCond.right_column && addCond.operator) {
                            fromJoinClause.push(`${addCond.logic} ${clause.local_table_schema}.${localRef}.${addCond.left_column} ${addCond.operator} ${clause.foreign_table_schema}.${foreignRef}.${addCond.right_column}`);
                        }
                    });
                }
            } else {
                // More precise table existence check - both tables must be added independently
                const localTableRef = localAlias
                    ? `${localTableFull} AS ${localAlias}`
                    : localTableFull;
                const foreignTableRef = foreignAlias
                    ? `${foreignTableFull} AS ${foreignAlias}`
                    : foreignTableFull;

                // Check if table (with or without alias) already exists
                const localTableExists = fromJoinClause.some(entry =>
                    entry.includes(`FROM ${localTableFull}`) || entry.includes(`JOIN ${localTableFull}`)
                );
                const foreignTableExists = fromJoinClause.some(entry =>
                    entry.includes(`FROM ${foreignTableFull}`) || entry.includes(`JOIN ${foreignTableFull}`)
                );

                // Determine which table to JOIN (the one that doesn't exist yet)
                // The ON clause will reference both tables
                let needsNewJoin = false;

                if (!localTableExists && !foreignTableExists) {
                    // Neither table exists - add the foreign table (it will be the new join target)
                    fromJoinClause.push(`${joinType} JOIN ${foreignTableSQL}`);
                    needsNewJoin = true;
                } else if (!localTableExists) {
                    // Only local table missing - add it
                    fromJoinClause.push(`${joinType} JOIN ${localTableSQL}`);
                    needsNewJoin = true;
                } else if (!foreignTableExists) {
                    // Only foreign table missing - add it
                    fromJoinClause.push(`${joinType} JOIN ${foreignTableSQL}`);
                    needsNewJoin = true;
                }

                // Add the ON/AND condition using aliases if available
                const operator = clause.primary_operator || '=';
                const joinCondition = `${clause.local_table_schema}.${localRef}.${clause.local_column_name} ${operator} ${clause.foreign_table_schema}.${foreignRef}.${clause.foreign_column_name}`;

                if (needsNewJoin) {
                    // New table was added, use ON
                    fromJoinClause.push(`ON ${joinCondition}`);

                    // Add additional conditions if present
                    if (clause.additional_conditions && clause.additional_conditions.length > 0) {
                        clause.additional_conditions.forEach((addCond: any) => {
                            if (addCond.left_column && addCond.right_column && addCond.operator) {
                                fromJoinClause.push(`${addCond.logic} ${clause.local_table_schema}.${localRef}.${addCond.left_column} ${addCond.operator} ${clause.foreign_table_schema}.${foreignRef}.${addCond.right_column}`);
                            }
                        });
                    }
                } else {
                    // Both tables already exist - this JOIN is redundant, skip it
                }
            }
        });

        // CRITICAL FIX: If no JOIN conditions exist but we have multiple tables, add them with CROSS JOIN
        if (fromJoinClause.length === 0 && dataTables.length > 0) {
            
            // Get table aliases if they exist
            const getTableAlias = (schema: any, tableName: any) => {
                const col = state.data_table.columns.find((c: any) =>
                    c.schema === schema && c.table_name === tableName && c.table_alias
                );
                return col?.table_alias || null;
            };

            dataTables.forEach((tableRef: any, index: any) => {
                const [schema, tableName] = tableRef.split('.');
                const alias = getTableAlias(schema, tableName);
                const tableSQL = alias ? `${tableRef} AS ${alias}` : tableRef;

                if (index === 0) {
                    fromJoinClause.push(`FROM ${tableSQL}`);
                } else {
                    // Use CROSS JOIN for subsequent tables (explicit Cartesian product)
                    fromJoinClause.push(`CROSS JOIN ${tableSQL}`);
                }
            });
        }

        // Check if any JOINs use OR logic and log warning
        const hasOrLogic = fromJoinClauses.some((clause: any) => clause.join_logic === 'OR');
        if (hasOrLogic) {
            console.warn('[buildSQLQuery] ⚠️ One or more JOINs use OR logic. Note: SQL does not natively support OR between JOIN clauses. The query will execute with AND logic. Consider using UNION or subqueries for true OR behavior.');
        }

        // Build set of columns used in aggregate functions (these should not appear in SELECT as regular columns)
        const aggregateColumns = new Set();
        state?.data_table?.query_options?.group_by?.aggregate_functions?.forEach((aggFunc: any) => {
            if (aggFunc.column && aggFunc.aggregate_function !== '') {
                aggregateColumns.add(aggFunc.column);
            }
        });
        
        // Also track columns used in aggregate expressions
        state?.data_table?.query_options?.group_by?.aggregate_expressions?.forEach((aggExpr: any) => {
            if (aggExpr.expression) {
                // Extract full column paths (schema.table.column)
                const fullPathMatches = aggExpr.expression.match(/\w+\.\w+\.\w+/g);
                if (fullPathMatches) {
                    fullPathMatches.forEach((col: any) => aggregateColumns.add(col));
                }
                
                // Also check for just column names and match to full paths
                state.data_table.columns.forEach((col: any) => {
                    const fullPath = `${col.schema}.${col.table_name}.${col.column_name}`;
                    const columnNamePattern = new RegExp(`\\b${col.column_name}\\b`);
                    if (columnNamePattern.test(aggExpr.expression)) {
                        aggregateColumns.add(fullPath);
                    }
                });
            }
        });

        // CRITICAL: Reorder columns to match table order in JOIN clauses
        // This prevents referencing tables before they're introduced in the FROM/JOIN clause
        const tableOrderMap = new Map();
        fromJoinClauses.forEach((clause: any, index: any) => {
            const leftKey = `${clause.local_table_schema}.${clause.local_table_name}`;
            const rightKey = `${clause.foreign_table_schema}.${clause.foreign_table_name}`;
            if (!tableOrderMap.has(leftKey)) tableOrderMap.set(leftKey, index * 2);
            if (!tableOrderMap.has(rightKey)) tableOrderMap.set(rightKey, index * 2 + 1);
        });

        // Sort columns by table order
        const orderedColumns = [...state.data_table.columns].sort((a, b) => {
            const keyA = `${a.schema}.${a.table_name}`;
            const keyB = `${b.schema}.${b.table_name}`;
            const orderA = tableOrderMap.get(keyA) ?? 999;
            const orderB = tableOrderMap.get(keyB) ?? 999;
            return orderA - orderB;
        });
        
        // Check for columns that are selected but will be hidden by aggregates
        const hiddenByAggregates = orderedColumns.filter((col: any) => {
            const columnFullPath = `${col.schema}.${col.table_name}.${col.column_name}`;
            return col.is_selected_column && aggregateColumns.has(columnFullPath);
        });
        
        if (hiddenByAggregates.length > 0) {
            console.warn('[buildSQLQuery] ⚠️ The following columns are selected but will NOT appear in results (used in aggregates):', 
                hiddenByAggregates.map((col: any) => `${col.schema}.${col.table_name}.${col.column_name}`));
        }

        sqlQuery = `SELECT ${orderedColumns.filter((column: any) => {
            // Exclude columns that are ONLY used in aggregates (not for grouping)
            const columnFullPath = `${column.schema}.${column.table_name}.${column.column_name}`;
            const isAggregateOnly = aggregateColumns.has(columnFullPath);
            return column.is_selected_column && !isAggregateOnly;
        }).map((column: any) => {
            // Generate alias name - special handling for dra_google_analytics, dra_google_ad_manager, dra_excel, dra_pdf
            let aliasName;
            if (column.alias_name && column.alias_name !== '') {
                aliasName = column.alias_name;
            } else if (column.schema === 'dra_google_analytics' || column.schema === 'dra_google_ad_manager' || column.schema === 'dra_excel' || column.schema === 'dra_pdf') {
                // For special schemas, always use table_name (preserves datasource IDs like device_15)
                aliasName = column.table_name.length > 20
                    ? `${column.table_name.slice(-20)}_${column.column_name}`
                    : `${column.table_name}_${column.column_name}`;
            } else {
                // For regular schemas, use table_alias if available, otherwise table_name
                const tableRef = column.table_alias || column.table_name;
                aliasName = `${column.schema}_${tableRef}_${column.column_name}`;
            }

            // Use table alias in column reference if it exists
            // Use 2-part identifier (table.column) - schema is already in FROM/JOIN clause
            let columnRef = column.table_alias
                ? `${column.table_alias}.${column.column_name}`
                : `${column.table_name}.${column.column_name}`;

            if (column.transform_function) {
                const closeParens = ')'.repeat(column.transform_close_parens || 1);
                columnRef = `${column.transform_function}(${columnRef}${closeParens}`;
            }

            return `${columnRef} AS ${aliasName}`;
        }).join(', ')}`;
    }
    
    // Track if we have any base columns in SELECT to handle comma placement
    const hasBaseColumns = state.data_table.columns.some((col: any) => {
        const columnFullPath = `${col.schema}.${col.table_name}.${col.column_name}`;
        const aggregateColumns = new Set();
        state?.data_table?.query_options?.group_by?.aggregate_functions?.forEach((aggFunc: any) => {
            if (aggFunc.column && aggFunc.aggregate_function !== '') {
                aggregateColumns.add(aggFunc.column);
            }
        });
        return col.is_selected_column && !aggregateColumns.has(columnFullPath);
    });
    
    state?.data_table?.query_options?.group_by?.aggregate_functions?.forEach((aggregate_function: any) => {
        if (aggregate_function.aggregate_function !== '' && aggregate_function.column !== '') {
            const distinctKeyword = aggregate_function.use_distinct ? 'DISTINCT ' : '';
            const aggregateFunc = state.aggregate_functions[aggregate_function.aggregate_function];

            // Generate default alias if none provided
            let aliasName = aggregate_function.column_alias_name;
            if (!aliasName || aliasName === '') {
                const columnParts = aggregate_function.column.split('.');
                const columnName = columnParts[columnParts.length - 1];
                aliasName = `${aggregateFunc.toLowerCase()}_${columnName}`;
            }

            // Add comma only if there are base columns or previous aggregates
            const needsComma = hasBaseColumns || sqlQuery.includes(' AS ');
            sqlQuery += `${needsComma ? ', ' : ''}${aggregateFunc}(${distinctKeyword}${aggregate_function.column}) AS ${aliasName}`;
        }
    });

    state?.data_table?.query_options?.group_by?.aggregate_expressions?.forEach((agg_expr: any) => {
        if (agg_expr.expression && agg_expr.expression.trim() !== '') {
            // Clean up expression: remove square brackets (invalid PostgreSQL syntax from AI)
            let cleanExpression = agg_expr.expression.replace(/\[\[/g, '').replace(/\]\]/g, '').replace(/\[/g, '').replace(/\]/g, '');
            
            // Remove schema.table prefixes from column references (e.g., dra_excel.ds75_e922dab5.balance_remaining -> balance_remaining)
            // This regex matches patterns like schema.table.column and replaces with just column
            cleanExpression = cleanExpression.replace(/(\w+)\.(\w+)\.(\w+)/g, '$3');
            
            const aliasName = agg_expr?.column_alias_name && agg_expr.column_alias_name !== '' ? ` AS ${agg_expr.column_alias_name}` : '';
            // Add comma only if there are previous columns/aggregates in SELECT
            const needsComma = sqlQuery.includes(' AS ');
            sqlQuery += `${needsComma ? ', ' : ''}${cleanExpression}${aliasName}`;
        }
    });

    // Add calculated columns AFTER aggregates so they can reference aggregate aliases
    if (state?.data_table?.calculated_columns?.length) {
        state.data_table.calculated_columns.forEach((column: any) => {
            // Replace aggregate aliases with full aggregate expressions for PostgreSQL compatibility
            let finalExpression = column.expression;

            // Replace aggregate function aliases
            state?.data_table?.query_options?.group_by?.aggregate_functions?.forEach((aggFunc: any) => {
                if (aggFunc.aggregate_function !== '' && aggFunc.column !== '') {
                    const funcName = state.aggregate_functions[aggFunc.aggregate_function];
                    const aliasName = aggFunc.column_alias_name || `${funcName.toLowerCase()}_${aggFunc.column.split('.').pop()}`;
                    const distinctKeyword = aggFunc.use_distinct ? 'DISTINCT ' : '';
                    const fullExpression = `${funcName}(${distinctKeyword}${aggFunc.column})`;

                    // Replace all occurrences of the alias with the full expression
                    const aliasRegex = new RegExp(`\\b${aliasName}\\b`, 'g');
                    finalExpression = finalExpression.replace(aliasRegex, fullExpression);
                }
            });

            // Replace aggregate expression aliases
            state?.data_table?.query_options?.group_by?.aggregate_expressions?.forEach((aggExpr: any) => {
                if (aggExpr.expression && aggExpr.expression.trim() !== '') {
                    const aliasName = aggExpr.column_alias_name;
                    if (aliasName) {
                        // Clean up expression: remove square brackets (invalid PostgreSQL syntax)
                        const fullExpression = aggExpr.expression.replace(/\[\[/g, '').replace(/\]\]/g, '').replace(/\[/g, '').replace(/\]/g, '');

                        // Replace all occurrences of the alias with the full expression
                        const aliasRegex = new RegExp(`\\b${aliasName}\\b`, 'g');
                        finalExpression = finalExpression.replace(aliasRegex, fullExpression);
                    }
                }
            });

            sqlQuery += `, ${finalExpression} AS ${column.column_name}`;
        })
    }

    sqlQuery += ` ${fromJoinClause.join(' ')}`;

    //determining whether to save the value with single quotes or not depending on the data type of the column
    state.data_table.query_options.where.forEach((clause: any, index: any) => {
        if (clause.column !== '' && clause.equality !== '' && clause.value !== '') {
            const operator = state.equality[clause.equality];
            let value;

            if (operator === 'IN' || operator === 'NOT IN') {
                value = `(${clause.value})`; // User enters: 'val1','val2','val3'
            } else {
                value = getColumValue(clause.value, clause.column_data_type);
            }

            if (index === 0) {
                //first WHERE clause - use WHERE keyword
                sqlQuery += ` WHERE ${clause.column} ${operator} ${value}`;
            } else {
                //subsequent WHERE clauses - use AND/OR from condition
                // Safety check: if condition is empty/undefined, default to AND
                const connector = clause.condition !== '' && clause.condition !== null && clause.condition !== undefined
                    ? state.condition[clause.condition]
                    : 'AND';
                sqlQuery += ` ${connector} ${clause.column} ${operator} ${value}`;
            }
        }
    });
    if (showGroupByClause.value) {
        // CRITICAL: Respect synced group_by_columns array
        // If group_by_columns exists (even if empty), use it - DO NOT fallback to selected columns
        // Empty array = aggregate-only query with no grouping
        // Undefined/null = legacy query, fallback to selected columns
        let groupByColumns;
        if (state.data_table.query_options?.group_by?.group_by_columns !== undefined && 
            state.data_table.query_options?.group_by?.group_by_columns !== null) {
            // group_by_columns exists (synced by syncGroupByColumns) - use as-is
            groupByColumns = state.data_table.query_options.group_by.group_by_columns;
        } else {
            // Legacy fallback: build from selected columns
            groupByColumns = state.data_table.columns.filter((column: any) => column.is_selected_column).map((column: any) => {
                let columnRef = `${column.schema}.${column.table_name}.${column.column_name}`;

                if (column.transform_function) {
                    const closeParens = ')'.repeat(column.transform_close_parens || 1);
                    columnRef = `${column.transform_function}(${columnRef}${closeParens}`;
                }

                return columnRef;
            });
        }

        // Only add GROUP BY if there are columns to group by
        if (groupByColumns.length > 0) {
            sqlQuery += ` GROUP BY ${groupByColumns.join(', ')}`;
        }
        state?.data_table?.query_options?.group_by?.having_conditions?.forEach((clause: any, index: any) => {
            // CRITICAL: PostgreSQL requires full aggregate expressions in HAVING, not aliases
            // Replace aggregate alias with full expression
            let havingColumn = clause.column;
            let value;
            
            // Check if this is an aggregate function alias
            const aggregateFunc = state.data_table.query_options?.group_by?.aggregate_functions?.find((aggFunc: any) => {
                if (aggFunc.aggregate_function !== '' && aggFunc.column !== '') {
                    const funcName = state.aggregate_functions[aggFunc.aggregate_function];
                    const aliasName = aggFunc.column_alias_name || `${funcName.toLowerCase()}_${aggFunc.column.split('.').pop()}`;
                    return aliasName === clause.column;
                }
                return false;
            });
            
            // Check if this is an aggregate expression alias
            const aggregateExpr = state.data_table.query_options?.group_by?.aggregate_expressions?.find((aggExpr: any) => {
                return aggExpr.column_alias_name === clause.column;
            });
            
            if (aggregateFunc) {
                // Replace alias with full aggregate function expression
                const funcName = state.aggregate_functions[aggregateFunc.aggregate_function];
                const distinctKeyword = aggregateFunc.use_distinct ? 'DISTINCT ' : '';
                havingColumn = `${funcName}(${distinctKeyword}${aggregateFunc.column})`;
                
                // Aggregate results are always numeric - don't quote
                const operator = state.equality[clause.equality];
                if (operator === 'IN' || operator === 'NOT IN') {
                    value = `(${clause.value})`;
                } else {
                    value = clause.value; // No quotes for numeric aggregate values
                }
            } else if (aggregateExpr) {
                // Replace alias with full aggregate expression (use as-is)
                // Clean up expression: remove square brackets (invalid PostgreSQL syntax)
                havingColumn = aggregateExpr.expression.replace(/\[\[/g, '').replace(/\]\]/g, '').replace(/\[/g, '').replace(/\]/g, '');
                
                // Aggregate results are always numeric - don't quote
                const operator = state.equality[clause.equality];
                if (operator === 'IN' || operator === 'NOT IN') {
                    value = `(${clause.value})`;
                } else {
                    value = clause.value; // No quotes for numeric aggregate values
                }
            } else {
                // Not an aggregate - use data type from column
                value = getColumValue(clause.value, clause.column_data_type);
            }
            
            if (clause.column !== '' && clause.equality !== '' && clause.value !== '') {
                if (index === 0) {
                    //first HAVING clause - use HAVING keyword
                    sqlQuery += ` HAVING ${havingColumn} ${state.equality[clause.equality]} ${value}`;
                } else {
                    //subsequent HAVING clauses - use AND/OR from condition
                    // Safety check: if condition is empty/undefined, default to AND
                    const connector = clause.condition !== '' && clause.condition !== null && clause.condition !== undefined
                        ? state.condition[clause.condition]
                        : 'AND';
                    sqlQuery += ` ${connector} ${havingColumn} ${state.equality[clause.equality]} ${value}`;
                }
            }
        });
    }
    state.data_table.query_options.order_by.forEach((clause: any, index: any) => {
        if (clause.column !== '' && clause.order !== '') {
            let orderByColumn = clause.column;

            // Check if this is a base column with a transform function
            const baseColumn = state.data_table.columns.find((col: any) =>
                `${col.schema}.${col.table_name}.${col.column_name}` === clause.column
            );

            if (baseColumn && baseColumn.transform_function) {
                // Use the transformed column expression
                const closeParens = ')'.repeat(baseColumn.transform_close_parens || 1);
                orderByColumn = `${baseColumn.transform_function}(${clause.column}${closeParens}`;
            } else {
                // Check if this is an aggregate alias
                const isAggregateAlias =
                    state.data_table.query_options?.group_by?.aggregate_functions?.some((aggFunc: any) => {
                        if (aggFunc.aggregate_function !== '' && aggFunc.column !== '') {
                            const funcName = state.aggregate_functions[aggFunc.aggregate_function];
                            const aliasName = aggFunc.column_alias_name || `${funcName.toLowerCase()}_${aggFunc.column.split('.').pop()}`;
                            return aliasName === clause.column;
                        }
                        return false;
                    }) ||
                    state.data_table.query_options?.group_by?.aggregate_expressions?.some((aggExpr: any) => {
                        return aggExpr.column_alias_name === clause.column;
                    });

                // If it's an aggregate alias, keep it as-is (PostgreSQL allows aliases in ORDER BY)
                // Otherwise, it's a regular column reference
            }

            if (index === 0) {
                sqlQuery += ` ORDER BY ${orderByColumn} ${state.order[clause.order]}`;
            } else {
                sqlQuery += `, ${orderByColumn} ${state.order[clause.order]}`;
            }
        }
    });

    return sqlQuery;
}
async function saveDataModel() {
    // Health gate: BLOCK save when model health is 'blocked'
    if (health.status.value === 'blocked') {
        const rowInfo = health.sourceRowCount.value 
            ? `<p class="mb-2">Source table contains <strong>${health.sourceRowCount.value.toLocaleString()}</strong> rows</p>`
            : '';
        
        const choice = await $swal.fire({
            icon: 'error',
            title: 'Cannot Save Model',
            html: `
                <div class="text-left">
                    <p class="mb-2">This data model cannot be saved because it would exceed the platform row limit.</p>
                    ${rowInfo}
                    <p class="mb-2">You must add aggregation (GROUP BY) or filters (WHERE) to reduce the row count before saving.</p>
                </div>
            `,
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonText: 'OK',
            denyButtonText: 'Ask AI to Fix This',
            confirmButtonColor: '#EF4444',
            denyButtonColor: '#3C8DBC',
            cancelButtonText: 'Cancel',
        });
        if (choice.isDenied) {
            openAIDataModelerDebounced();
        }
        // Always block the save - no "continue anyway" option
        return;
    }

    // Check tier limits for new data models (not when editing existing ones)
    if (!props.isEditDataModel && !props.dataModel?.id) {
        const { checkDataModelLimit } = useTierLimits();
        if (!checkDataModelLimit()) {
            return; // Shows modal, prevents save
        }
    }
    
    // PHASE 2 REQUIREMENT: Validate workspace selection before allowing data model save
    const { requireWorkspace } = useOrganizationContext();
    const validation = requireWorkspace();
    if (!validation.valid) {
        await $swal.fire({
            title: 'Workspace Required',
            text: validation.error || 'Please select a workspace before saving a data model.',
            icon: 'warning',
            confirmButtonColor: '#3C8DBC',
        });
        return;
    }
    
    // Set flag to prevent watch from triggering during save
    state.is_saving_model = true;
    
    try {
        if (isMongoDB.value) {
            // MongoDB specific save logic
            state.sql_query = state.mongo_query.pipeline; // Use pipeline as headers/query representation
            
            // Build the data model
            const token = getAuthToken();
            let url = `${baseUrl()}/data-source/build-data-model-on-query`;
            if (props.isEditDataModel) {
                url = `${baseUrl()}/data-model/update-data-model-on-query`;
            }

            const responseData = await $fetch(url, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
                body: {
                    data_source_id: props.isCrossSource ? null : route.params.datasourceid,
                    project_id: props.isCrossSource ? props.projectId : null,
                    query: state.mongo_query.pipeline, // Send pipeline string as query
                    query_json: JSON.stringify({
                        collection: state.mongo_query.collection,
                        pipeline: JSON.parse(state.mongo_query.pipeline)
                    }),
                    data_model_name: state.data_table.table_name,
                    data_model_id: props.isEditDataModel ? props.dataModel.id : null,
                    is_cross_source: false, // MongoDB doesn't support cross-source yet
                    data_layer: state.selected_layer || undefined,
                }
            });
            
            // Show success message before navigation
            await $swal.fire({
                icon: 'success',
                title: `Data Model Saved!`,
                text: 'Your MongoDB data model has been successfully saved.',
                timer: 1500,
                showConfirmButton: false
            });

            // Navigate after success modal
            if (route.params.datasourceid) {
                router.push(`/projects/${route.params.projectid}/data-sources/${route.params.datasourceid}/data-models`);
            } else {
                router.push(`/projects/${route.params.projectid}/data-models`);
            }
        } else {
            // Existing SQL Save Logic
            // VALIDATION: Check if this is truly cross-source or same-source with multiple tables
            if (props.isCrossSource) {
                const uniqueDataSourceIds = new Set(
                    state.data_table.columns
                        .filter((col: any) => col.data_source_id)
                        .map((col: any) => col.data_source_id)
                );
                
                if (uniqueDataSourceIds.size === 1) {
                    const result = await $swal.fire({
                        icon: 'warning',
                        title: 'Same Data Source Detected',
                        html: `All columns are from the same data source (ID: ${Array.from(uniqueDataSourceIds)[0]}). Cross-source mode is designed for combining data from <strong>different</strong> data sources.<br /><br />This may cause resolution issues. Continue anyway?`,
                        showCancelButton: true,
                        confirmButtonColor: '#3C8DBC',
                        cancelButtonColor: '#DD4B39',
                        confirmButtonText: 'Continue Anyway',
                        cancelButtonText: 'Cancel'
                    });
                    
                    if (!result.isConfirmed) {
                        state.is_saving_model = false;
                        return;
                    }
                }
            }
            
            // Ensure JOIN conditions and table aliases are synced to data_table before save
            state.data_table.join_conditions = [...state.join_conditions];
            state.data_table.table_aliases = [...state.table_aliases];
            
            // Sync group_by_columns before save using the canonical sync function
            // This preserves manually-added GROUP BY columns while ensuring
            // auto-derived columns are up to date
            syncGroupByColumns();

            let offsetStr = 'OFFSET 0';
            let limitStr = 'LIMIT 5';
            let sqlQuery = buildSQLQuery();

            if (state.data_table.query_options.offset > -1) {
                offsetStr = `OFFSET ${state.data_table.query_options.offset}`;
            } else {
                offsetStr = 'OFFSET 0';
            }
            if (state.data_table.query_options.limit > -1) {
                // CRITICAL: Enforce tier limit - never allow exceeding user's allowed limit
                const tierLimit = Number((subscriptionStore as any).subscription?.subscription_tier?.max_rows_per_data_model ?? 100000);
                const effectiveLimit = tierLimit === -1 ? state.data_table.query_options.limit : Math.min(state.data_table.query_options.limit, tierLimit);
                
                if (state.data_table.query_options.limit > tierLimit && tierLimit !== -1) {
                    console.warn(`[saveDataModel] User attempted to set limit ${state.data_table.query_options.limit} exceeding tier limit ${tierLimit}. Capping to tier limit.`);
                    state.data_table.query_options.limit = tierLimit;
                }
                
                limitStr = `LIMIT ${effectiveLimit}`;
            } else {
                // Use user's tier limit as default
                const userRowLimit = Number((subscriptionStore as any).subscription?.subscription_tier?.max_rows_per_data_model ?? 100000);
                limitStr = `LIMIT ${userRowLimit}`;
            }
            sqlQuery += ` ${limitStr} ${offsetStr}`;
            state.sql_query = sqlQuery;
            const { value: confirmDelete } = await $swal.fire({
                icon: "success",
                title: "SQL Query Generated!",
                html: `Your SQL query has been generated and is a follows:<br /><br /> <span style='font-weight: bold;'>${sqlQuery}</span><br /><br /> Do you want to proceed with this SQL query to build your data model?`,
                showCancelButton: true,
                confirmButtonColor: "#3C8DBC",
                cancelButtonColor: "#DD4B39",
                confirmButtonText: "Yes, build my model now!",
            });
            if (!confirmDelete) {
                // User cancelled, clear the flag and return
                state.is_saving_model = false;
                return;
            }
            //build the data model
            const token = getAuthToken();
            let url = `${baseUrl()}/data-source/build-data-model-on-query`;
            if (props.isEditDataModel) {
                url = `${baseUrl()}/data-model/update-data-model-on-query`;
            }

            // CRITICAL FIX: Send ALL columns with their is_selected_column state preserved
            // Backend will filter for table creation, but preserve full array in query JSON
            // This prevents permanent loss of unchecked columns
            const dataTableForSave = {
                ...state.data_table,
                columns: state.data_table.columns // Send ALL columns - don't filter!
            };

            const responseData = await $fetch<any>(url, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
                body: {
                    data_source_id: props.isCrossSource ? null : route.params.datasourceid,
                    project_id: props.isCrossSource ? props.projectId : null,
                    query: state.sql_query,
                    query_json: JSON.stringify(dataTableForSave),
                    data_model_name: state.data_table.table_name,
                    data_model_id: props.isEditDataModel ? props.dataModel.id : null,
                    is_cross_source: props.isCrossSource || false,
                    data_layer: state.selected_layer || undefined,
                }
            });
            
            // Save AI conversation if one exists
            if (aiDataModelerStore.conversationId && aiDataModelerStore.messages.length > 0) {
                try {
                    const dataModelId = props.isEditDataModel
                        ? props.dataModel.id
                        : responseData.data_model_id;

                    if (dataModelId) {
                        // Ensure currentDataSourceId is set before saving (it should be from initializeConversation)
                        // But set it as fallback in case the drawer was closed
                        if (!aiDataModelerStore.currentDataSourceId) {
                            aiDataModelerStore.currentDataSourceId = Number(route.params.datasourceid);
                        }

                        await aiDataModelerStore.saveConversation(
                            dataModelId,
                            state.data_table.table_name || 'AI Generated Model'
                        );
                    }
                } catch (error: any) {
                    // Log error but don't block the data model save success
                    console.error('Failed to save AI conversation:', error);
                }
            }
            
            // Show success message before navigation
            await $swal.fire({
                icon: 'success',
                title: props.isEditDataModel ? 'Data Model Updated!' : 'Data Model Created!',
                text: 'Your data model has been successfully ' + (props.isEditDataModel ? 'updated' : 'created') + '.',
                timer: 1500,
                showConfirmButton: false
            });
            
            // Navigate to data models list after successful save
            router.push(`/projects/${route.params.projectid}/data-models`);
        }
    } catch (error: any) {
        console.error('[saveDataModel] Error:', error);
        
        // Check if the error is a DataModelOversizedException (422 status)
        if (error?.status === 422 || error?.data?.error === 'DATA_MODEL_OVERSIZED') {
            const errorData = error?.data || error;
            
            // Show blocking modal with error details
            const rowCountFormatted = errorData.rowCount?.toLocaleString() || 'unknown';
            const thresholdFormatted = errorData.threshold?.toLocaleString() || 'unknown';
            
            let issuesList = '';
            if (errorData.healthIssues?.length) {
                const items = errorData.healthIssues.map((issue: any) => {
                    return '<li class="mb-1">• ' + issue.message + '</li>';
                });
                issuesList = '<ul class="text-left mt-2">' + items.join('') + '</ul>';
            }
            
            await $swal.fire({
                icon: 'error',
                title: 'Data Model Too Large',
                html: `
                    <div class="text-left">
                        <p class="mb-2">This data model cannot be saved because it exceeds the platform limit.</p>
                        <p class="mb-2 font-bold">Row Count: ${rowCountFormatted} / ${thresholdFormatted} allowed</p>
                        ${issuesList}
                        <p class="mt-3 text-sm text-gray-600">Please add aggregations (GROUP BY) or filters (WHERE) to reduce the number of rows before saving.</p>
                    </div>
                `,
                confirmButtonText: 'OK',
                confirmButtonColor: '#EF4444',
                allowOutsideClick: false,
            });
            
            // Scroll to health panel if it exists
            if (import.meta.client) {
                nextTick(() => {
                    const healthPanel = document.querySelector('.health-panel');
                    if (healthPanel) {
                        healthPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                });
            }
            
            return; // Exit early, don't show the SQL error
        }
        
        // Parse and display SQL error prominently for other errors
        state.sqlError = parseBackendError(error);
        
        // Scroll to error alert on client
        if (import.meta.client) {
            nextTick(() => {
                const errorElement = document.querySelector('.sql-error-alert');
                if (errorElement) {
                    errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
        }
    } finally {
        // Always clear the flag
        state.is_saving_model = false;
    }
}
async function executeQueryOnExternalDataSource() {
    // Guard: Component is unmounting, abort all operations
    if (state.is_unmounting) {
        return;
    }

    // Guard: Prevent concurrent executions
    if (state.is_executing_query) {
        console.trace('[executeQuery] Call stack:');
        return;
    }

    // Guard: Don't execute during AI configuration application
    if (state.is_applying_ai_config) {
        console.trace('[executeQuery] Call stack:');
        return;
    }

    // Guard: Don't execute during save operation
    if (state.is_saving_model) {
        console.trace('[executeQuery] Call stack:');
        return;
    }

    // Guard: Detect runaway loops
    state.query_execution_count++;
    if (state.query_execution_count > 10) {
        console.error('[CRITICAL] Too many query executions! Possible loop detected.');
        console.trace('[executeQuery] Call stack:');
        $swal.fire({
            icon: 'error',
            title: 'Too Many Queries',
            text: 'Query execution loop detected. Please refresh the page.',
        });
        return;
    }

    // Reset counter after 5 seconds
    setTimeout(() => {
        state.query_execution_count = 0;
    }, 5000);

    state.is_executing_query = true;

    try {
        state.response_from_external_data_source_columns = [];
        state.response_from_external_data_source_rows = [];
        
        let url = `${baseUrl()}/data-source/execute-query-on-external-data-source`;
        let requestBody: Record<string, any> = {};
        
        if (isMongoDB.value) {
            // MongoDB Execution Path
            state.sql_query = state.mongo_query.pipeline; // For display/debug
            
            requestBody = {
                 data_source_id: route.params.datasourceid,
                 query: state.mongo_query.pipeline, // Send pipeline string for compatibility/logging
                 query_json: JSON.stringify({
                     collection: state.mongo_query.collection,
                     pipeline: JSON.parse(state.mongo_query.pipeline)
                 })
            };

            // Basic client-side validation for MongoDB
            if (!state.mongo_query.collection) {
                 state.is_executing_query = false;
                 return;
            }
        } else {
            // SQL Execution Path
            
            // CRITICAL: For cross-source models, ensure all columns have data_source_id
            if (props.isCrossSource) {
                let missingCount = 0;
                state.data_table.columns.forEach((col: any) => {
                    if (!col.data_source_id) {
                        // Backfill from state.tables metadata
                        const sourceTable = state.tables.find((t: any) => 
                            t.table_name === col.table_name && t.schema === col.schema
                        );
                        if (sourceTable?.data_source_id) {
                            col.data_source_id = sourceTable.data_source_id;
                            missingCount++;
                        } else {
                            console.error(`[executeQuery] CRITICAL: Cannot find data_source_id for ${col.schema}.${col.table_name}.${col.column_name}`);
                        }
                    }
                });
            }
            
            // CRITICAL: Sync JOIN conditions to data_table before building query
            state.data_table.join_conditions = [...state.join_conditions];
            state.data_table.table_aliases = [...state.table_aliases];
            
            state.sql_query = buildSQLQuery();
            state.sql_query += ` LIMIT 5 OFFSET 0`;
            
            requestBody = {
                query: state.sql_query,
                query_json: JSON.stringify(state.data_table),
            };

            if (props.isCrossSource) {
                requestBody.project_id = props.projectId;
                requestBody.is_cross_source = true;
            } else {
                requestBody.data_source_id = route.params.datasourceid;
            }
        }

        const token = getAuthToken();
        const response = await $fetch<any>(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
            body: requestBody
        });

        // Store metadata if present (includes row limit info)
        if (response.metadata) {
            state.query_metadata = response.metadata;
        }
        
        const data = response.results || response;
        
        if (data && data.length) {
            if (!isMongoDB.value) {
                // Check for array values (only applicable to SQL cartesian products usually)
                const hasArrayValues = data.some((row: any) =>
                    Object.values(row).some((value: any) => Array.isArray(value))
                );

                if (hasArrayValues) {
                    const errorAlert = {
                        type: 'error',
                        message: 'The query result contains array values, which may indicate a cartesian product or improper join. Please review your table and column selections.'
                    };
                    if (!state.alerts.find((a: any) => a.type === 'error' && a.message.includes('array values'))) {
                        state.alerts.push(errorAlert);
                    }
                } else {
                    state.alerts = state.alerts.filter((a: any) => !(a.type === 'error' && a.message.includes('array values')));
                }
            }

            const columns = Object.keys(data[0]);
            
            state.response_from_external_data_source_columns = columns;
            state.response_from_external_data_source_rows = data;
            
            // Note: Health status is computed in real-time and displayed in the UI.
            // Modal alerts are only shown during save operations (see saveDataModel).
        }
    } catch (error: any) {
        console.error('[executeQuery] Error:', error);
        
        // Parse and display SQL error
        state.sqlError = parseBackendError(error);
        
        // Scroll to error alert on client
        if (import.meta.client) {
            nextTick(() => {
                const errorElement = document.querySelector('.sql-error-alert');
                if (errorElement) {
                    errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
        }
    } finally {
        state.is_executing_query = false;
    }
}

/**
 * Parses backend SQL errors and returns user-friendly error object
 * @param {Error} error - The caught error from API call
 * @returns {Object} Formatted error object
 */
function parseBackendError(error: any) {
    const errorObj: any = {
        type: 'error',
        title: 'Query Error',
        message: '',
        technicalMessage: '',
        suggestions: [],
        dismissible: true
    };
    
    // Extract error message
    const errorMessage = error?.data?.message || error?.message || 'Unknown error occurred';
    errorObj.technicalMessage = errorMessage;
    
    // Pattern matching for common SQL errors
    
    // 1. GROUP BY errors
    if (errorMessage.includes('must appear in GROUP BY clause')) {
        const columnMatch = errorMessage.match(/column "([^"]+)"/i);
        const columnName = columnMatch ? columnMatch[1] : 'a column';
        
        errorObj.title = 'Missing GROUP BY Column';
        errorObj.message = `The column "${columnName}" needs to be included in the GROUP BY section or used with an aggregate function (SUM, AVG, COUNT, etc.).`;
        errorObj.suggestions = [
            'Add this column to the "Group By Columns" section',
            'Remove this column from the query',
            'Apply an aggregate function (SUM, AVG, COUNT, MIN, MAX) to this column'
        ];
    }
    
    // 2. Column does not exist
    else if (errorMessage.includes('column') && errorMessage.includes('does not exist')) {
        const columnMatch = errorMessage.match(/column "([^"]+)"/i);
        const columnName = columnMatch ? columnMatch[1] : 'unknown';
        
        errorObj.title = 'Column Not Found';
        errorObj.message = `The column "${columnName}" doesn't exist in your data source.`;
        errorObj.suggestions = [
            'Check the column name for typos',
            'Verify the column exists in the selected table',
            'Refresh your data source schema if it was recently modified'
        ];
    }
    
    // 3. Table does not exist
    else if (errorMessage.includes('relation') && errorMessage.includes('does not exist')) {
        const tableMatch = errorMessage.match(/relation "([^"]+)"/i);
        const tableName = tableMatch ? tableMatch[1] : 'unknown';
        
        errorObj.title = 'Table Not Found';
        errorObj.message = `The table "${tableName}" doesn't exist or isn't accessible.`;
        errorObj.suggestions = [
            'Verify the table exists in your data source',
            'Check if you have permission to access this table',
            'Refresh your data source connection'
        ];
    }
    
    // 4. Invalid ORDER BY reference
    else if (errorMessage.includes('ORDER BY') || errorMessage.includes('for SELECT DISTINCT, ORDER BY')) {
        errorObj.title = 'Invalid ORDER BY Column';
        errorObj.message = 'You cannot order by a column that is not in the SELECT clause.';
        errorObj.suggestions = [
            'Add the column to your query results',
            'Remove it from the ORDER BY section',
            'Use an alias if ordering by a calculated or aggregate column'
        ];
    }
    
    // 5. Type mismatch errors
    else if ((errorMessage.includes('type') || errorMessage.includes('datatype')) && (errorMessage.includes('cannot') || errorMessage.includes('invalid'))) {
        errorObj.title = 'Data Type Mismatch';
        errorObj.message = 'There is a data type incompatibility in your query.';
        errorObj.suggestions = [
            'Cast columns to the correct type using the transform functions',
            'Check filters for matching data types (numbers vs text)',
            'Verify aggregate functions are used with numeric columns'
        ];
    }
    
    // 6. Division by zero
    else if (errorMessage.includes('division by zero')) {
        errorObj.title = 'Division by Zero';
        errorObj.message = 'Your calculation attempts to divide by zero.';
        errorObj.suggestions = [
            'Add a WHERE clause to filter out zero values',
            'Modify calculated columns to handle zero divisors',
            'Add conditional logic to handle zero values'
        ];
    }
    
    // 7. Syntax errors
    else if (errorMessage.includes('syntax error')) {
        errorObj.title = 'SQL Syntax Error';
        errorObj.message = 'There is a syntax error in the generated SQL query.';
        errorObj.suggestions = [
            'Check calculated column expressions for errors',
            'Verify all filter values are properly formatted',
            'Review join conditions for correctness'
        ];
    }
    
    // 8. Permission errors
    else if (errorMessage.includes('permission denied') || errorMessage.includes('access denied')) {
        errorObj.title = 'Permission Denied';
        errorObj.message = 'You do not have permission to access this data.';
        errorObj.suggestions = [
            'Contact your database administrator',
            'Verify you have SELECT permission on the table',
            'Check if the data source credentials are correct'
        ];
    }
    
    // 9. Aggregate function errors
    else if (errorMessage.includes('aggregate function')) {
        errorObj.title = 'Aggregate Function Error';
        errorObj.message = 'There is an issue with how aggregate functions are being used.';
        errorObj.suggestions = [
            'Aggregate functions (SUM, AVG, COUNT, etc.) can only be used with appropriate column types',
            'Ensure all non-aggregate columns are in the GROUP BY section',
            'Check for nested aggregate functions (not allowed)'
        ];
    }
    
    // 10. Generic fallback
    else {
        errorObj.title = 'Query Execution Error';
        errorObj.message = 'An error occurred while executing your query.';
        errorObj.suggestions = [
            'Review your query configuration for any issues',
            'Check the technical error message below for details',
            'Try simplifying your query to isolate the issue'
        ];
    }
    
    return errorObj;
}
async function toggleColumnInDataModel(column: any, tableName: any, tableAlias: any = null) {
    const identifier = tableAlias || tableName;

    if (isColumnInDataModel(column.column_name, tableName, tableAlias)) {
        // Remove
        state.data_table.columns = state.data_table.columns.filter((c: any) => {
            const colIdentifier = c.table_alias || c.table_name;
            return !(c.column_name === column.column_name && colIdentifier === identifier);
        });
        if (state.data_table.columns.length === 0) {
            state.data_table.query_options.where = [];
            state.data_table.query_options.group_by = {};
            state.data_table.query_options.order_by = [];
            state.data_table.query_options.offset = -1;
            state.data_table.query_options.limit = -1;
            state.join_conditions = [];  // Clear JOINs when no columns
        }

        // Re-detect JOIN conditions after column removal
        autoDetectJoinConditions();

        await executeQueryOnExternalDataSource();
    } else {
        // Add
        const newColumn = _.cloneDeep(column);
        newColumn.table_name = tableName;
        newColumn.table_alias = tableAlias;
        
        // Get logical name for display
        const sourceTable = state.tables.find((t: any) => 
            t.table_name === tableName && t.schema === newColumn.schema
        );
        newColumn.table_logical_name = sourceTable?.logical_name || tableName;
        
        // CRITICAL: For cross-source models, include data_source_id so backend can map tables
        newColumn.data_source_id = sourceTable?.data_source_id;
        
        newColumn.display_name = tableAlias
            ? `${tableAlias}.${column.column_name}`
            : `${newColumn.table_logical_name}.${column.column_name}`;
        newColumn.is_selected_column = true;
        newColumn.alias_name = "";
        newColumn.transform_function = '';
        newColumn.transform_close_parens = 0;

        state.data_table.columns.push(newColumn);

        // Auto-detect JOIN conditions when columns are added
        autoDetectJoinConditions();

        await executeQueryOnExternalDataSource();
    }
}

/**
 * Apply AI-generated data model to the builder
 */
async function applyAIGeneratedModel(model: any) {
    // Guard: Don't apply during unmount
    if (state.is_unmounting) {
        return;
    }

    // Guard: Check if model exists (race condition prevention)
    if (!model || (Array.isArray(model) && model.length === 0)) {
        console.error('[applyAIGeneratedModel] No model provided or model array is empty');
        $swal.fire({
            title: 'No Model Found',
            text: 'The AI model is no longer available. Please generate a new model.',
            icon: 'warning'
        });
        return;
    }

    // SET FLAG: Prevent watchers from triggering during config application
    state.is_applying_ai_config = true;
    state.loading = true;

    try {
        // Handle array of models (take first one, or latest)
        let modelToApply = model;
        if (Array.isArray(model)) {
            if (model.length === 0) {
                $swal.fire({
                    title: 'No Model Found',
                    text: 'The AI response does not contain any data models.',
                    icon: 'warning'
                });
                return;
            }
            modelToApply = model[0];
        }

        // Validate and transform AI model to match builder structure
        const transformedModel = validateAndTransformAIModel(modelToApply);

        if (!transformedModel) {
            // Error already shown in validateAndTransformAIModel
            // Note: User can still close drawer manually or try again
            // We don't auto-close here to let them see the error and potentially fix it
            return;
        }

        // Store previous state for potential undo
        const previousModel = JSON.parse(JSON.stringify(state.data_table));

        try {
            // Clear existing model first to ensure clean replacement

            // Reset to default empty state
            state.data_table.table_name = '';
            state.data_table.columns = [];
            state.data_table.calculated_columns = [];
            state.data_table.query_options = {
                where: [],
                group_by: {
                    columns: [],
                    aggregate_functions: [],
                    aggregate_expressions: [],
                    having_conditions: [],
                    name: false
                },
                order_by: [],
                offset: -1,
                limit: 1000
            };

            // Now apply the new model - use Object.assign to maintain reactivity
            
            Object.assign(state.data_table, transformedModel);
            
            // CRITICAL: Validate that columns were actually assigned
            if (!state.data_table.columns || state.data_table.columns.length === 0) {
                console.error('[Data Model Builder] CRITICAL: Columns array is empty after Object.assign!');
                console.error('[Data Model Builder] Transformed model:', transformedModel);
                throw new Error('Model assignment failed: columns array is empty. This may be due to validation failures or an incompatible model structure.');
            }
            
            // Preserve table_display_name if provided by AI
            if (modelToApply.table_display_name) {
                state.data_table.table_display_name = modelToApply.table_display_name;
            }

            // Initialize join_conditions and table_aliases arrays if not present
            if (!state.data_table.join_conditions) {
                state.data_table.join_conditions = [];
            }
            if (!state.data_table.table_aliases) {
                state.data_table.table_aliases = [];
            }

            // Wait for DOM update to complete
            await nextTick();

            // Register table aliases from AI model to state.data_table.table_aliases
            const aliasMap = new Map();
            state.data_table.columns.forEach((col: any) => {
                if (col.table_alias) {
                    const key = getTableKeyForColumn(col);
                    if (!aliasMap.has(key)) {
                        aliasMap.set(key, new Set());
                    }
                    aliasMap.get(key).add(col.table_alias);
                }
            });

            // Add aliases to state if not already present
            aliasMap.forEach((aliases, tableKey) => {
                const parsed = parseTableKey(tableKey);
                const schema = parsed.schema;
                const table = parsed.table;
                const dataSourceId = parsed.dataSourceId;
                aliases.forEach((alias: any) => {
                    const exists = state.data_table.table_aliases.some((a: any) =>
                        a.schema === schema &&
                        a.original_table === table &&
                        a.alias === alias &&
                        (!props.isCrossSource || !dataSourceId || a.data_source_id === dataSourceId)
                    );
                    if (!exists) {
                        state.data_table.table_aliases.push({
                            schema: schema,
                            original_table: table,
                            alias: alias,
                            data_source_id: dataSourceId || null
                        });
                    }
                });
            });

            // DEFENSIVE FIX: Ensure aggregate-only columns are marked correctly
            // This is a safety net in case validateAndTransformAIModel missed anything
            if (state.data_table.query_options?.group_by?.aggregate_functions?.length > 0) {
                const aggregateColumns = new Set();
                state.data_table.query_options.group_by.aggregate_functions.forEach((aggFunc: any) => {
                    if (aggFunc.column) {
                        aggregateColumns.add(aggFunc.column);
                    }
                });

                state.data_table.columns.forEach((col: any) => {
                    const fullPath = `${col.schema}.${col.table_name}.${col.column_name}`;
                    if (aggregateColumns.has(fullPath) && col.is_selected_column === true) {
                        console.warn(`[applyAIGeneratedModel] WARNING: ${fullPath} is aggregate-only but has is_selected_column=true, fixing...`);
                        col.is_selected_column = false;
                    }
                });

                // DEFENSIVE FIX: Also filter GROUP BY columns array
                if (state.data_table.query_options.group_by.group_by_columns) {
                    const beforeCount = state.data_table.query_options.group_by.group_by_columns.length;
                    state.data_table.query_options.group_by.group_by_columns =
                        state.data_table.query_options.group_by.group_by_columns.filter((col: any) =>
                            !aggregateColumns.has(col)
                        );
                    const afterCount = state.data_table.query_options.group_by.group_by_columns.length;
                    if (beforeCount !== afterCount) {
                        console.warn(`[applyAIGeneratedModel] DEFENSIVE: Filtered GROUP BY from ${beforeCount} to ${afterCount} columns`);
                    }
                }
            }

            // Auto-detect JOIN conditions from foreign key relationships
            autoDetectJoinConditions();

            // CRITICAL FIX: Sync JOIN conditions to data_table so backend receives them
            // state.join_conditions is used by buildSQLQuery() for frontend display
            // state.data_table.join_conditions is sent to backend in JSON
            // Both must have the same data!
            state.data_table.join_conditions = [...state.join_conditions];

            // Also sync table_aliases if they exist
            if (state.table_aliases && state.table_aliases.length > 0) {
                state.data_table.table_aliases = [...state.table_aliases];
            }

            // Switch to advanced view if model has advanced features
            if (hasAdvancedFields()) {
                state.viewMode = 'advanced';
            }
            
            // Sync GROUP BY columns after model application
            nextTick(() => {
                syncGroupByColumns();
            });

            // Wait for all reactive updates to complete before clearing flag
            await nextTick();
            
            // Additional wait to ensure DOM updates are complete
            // This prevents Vue internal errors during component unmounting/remounting
            await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error: any) {
            console.error('[Data Model Builder] Error applying AI model:', error);
            console.error('[Data Model Builder] Error details:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
            console.error('[Data Model Builder] Model state at failure:', JSON.stringify(state.data_table, null, 2));

            // Check if this is a Vue internal error (component unmounting race condition)
            // These are typically harmless and the model was actually applied successfully
            const isVueInternalError = error.message && (
                error.message.includes('reading \'type\'') ||
                error.message.includes('unmountComponent') ||
                error.message.includes('Cannot read properties of null')
            );

            if (isVueInternalError) {
                console.warn('[Data Model Builder] Vue internal error detected (likely harmless race condition)');
                console.warn('[Data Model Builder] Model may have been applied successfully despite error');
                
                // Don't revert - the model was likely applied correctly
                // Just clear the flag and continue
            } else {
                // Real error - revert to previous state
                state.data_table = previousModel;

                $swal.fire({
                    title: 'Failed to Apply Model',
                    text: `Could not apply the AI-generated model: ${error.message || 'Unknown error'}. The model has been reverted.`,
                    icon: 'error',
                    confirmButtonText: 'Understood'
                });
                return;
            }
        }

    } catch (error: any) {
        console.error('[Data Model Builder] Unexpected error applying AI model:', error);
        $swal.fire({
            title: 'Unexpected Error',
            text: `Failed to apply AI-generated model: ${error.message || 'Unknown error'}`,
            icon: 'error'
        });
        return;
    } finally {
        // CLEAR FLAG: Allow watchers to resume
        state.is_applying_ai_config = false;
        state.loading = false;
    }

    // Execute query ONCE after all changes applied
    
    // Verify model was actually applied before executing query
    if (!state.data_table.columns || state.data_table.columns.length === 0) {
        console.error('[applyAIGeneratedModel] CRITICAL: Model columns are empty, cannot execute query');
        $swal.fire({
            title: 'Model Apply Failed',
            text: 'The model structure is incomplete. Please try generating a new model.',
            icon: 'error'
        });
        return;
    }
    
    try {
        await executeQueryOnExternalDataSource();

        // Success notification
        $swal.fire({
            title: 'Applied!',
            text: 'AI data model has been applied successfully',
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
        });
        
        // Close the AI drawer after successful application
        aiDataModelerStore.closeDrawer(false); // false = don't cleanup session (keep for potential edits)
        
    } catch (queryError) {
        console.error('[Data Model Builder] Query execution failed after successful model application:', queryError);
        $swal.fire({
            title: 'Model Applied',
            text: 'Model was applied successfully, but could not preview data. You can still save this model.',
            icon: 'warning',
            confirmButtonText: 'OK'
        });
        
        // Still close the drawer even if query preview failed
        aiDataModelerStore.closeDrawer(false);
    }
}

/**
 * Normalize schema name from AI response
 * AI returns schemas like "dra_excel.ds72_xxxx" but we need just "dra_excel"
 * 
 * @param schema - Raw schema from AI (may include table name)
 * @returns Normalized schema name
 */
function normalizeSchemaName(schema: any) {
    if (!schema || !schema.includes('.')) {
        return schema;
    }
    
    const parts = schema.split('.');
    // For Excel/PDF/Google services, schema is the first part
    if (parts[0] === 'dra_excel' || parts[0] === 'dra_pdf' || 
        parts[0] === 'dra_google_analytics' || parts[0] === 'dra_google_ad_manager' || 
        parts[0] === 'dra_google_ads') {
        return parts[0];
    }
    
    // For regular databases, keep as-is
    return schema;
}

/**
 * Infer column data type from SQL expression
 * Analyzes CASE expressions, functions, and literals to determine the correct type
 * 
 * @param {string} expression - SQL expression to analyze
 * @returns {string} - PostgreSQL data type (text, numeric, boolean, timestamp, etc.)
 */
function inferDataTypeFromExpression(expression: any) {
    if (!expression || typeof expression !== 'string') {
        return 'numeric'; // Default fallback
    }
    
    const expr = expression.trim();
    const exprUpper = expr.toUpperCase();
    
    // Check for CASE expressions - analyze THEN/ELSE clauses
    if (exprUpper.includes('CASE')) {
        // More robust pattern that captures quoted strings with spaces
        // Pattern: THEN 'value' or THEN "value" or THEN value
        const thenPattern = /THEN\s+('[^']*'|"[^"]*"|\S+)/gi;
        const elsePattern = /ELSE\s+('[^']*'|"[^"]*"|\S+)/i;
        
        const thenMatches = [];
        let match;
        while ((match = thenPattern.exec(expr)) !== null) {
            thenMatches.push(match[1]);
        }
        
        const elseMatch = expr.match(elsePattern);
        const allClauses = [
            ...thenMatches,
            ...(elseMatch ? [elseMatch[1]] : [])
        ];
        
        if (allClauses.length > 0) {
            // If any clause is a string literal (quoted), it returns text
            const hasStringLiteral = allClauses.some((clause: any) => {
                const trimmed = clause.trim();
                return (trimmed.startsWith("'") && trimmed.endsWith("'")) || 
                       (trimmed.startsWith('"') && trimmed.endsWith('"'));
            });
            
            if (hasStringLiteral) {
                return 'text';
            }
            
            // If all clauses are numeric literals or NULL, it's numeric
            const allNumericOrNull = allClauses.every((clause: any) => {
                const trimmed = clause.trim().toUpperCase();
                if (trimmed === 'NULL') return true;
                // Remove quotes if present
                const unquoted = trimmed.replace(/^['"]|['"]$/g, '');
                return !isNaN(Number(unquoted));
            });
            
            if (allNumericOrNull) {
                return 'numeric';
            }
            
            // Mixed or unknown - default to text for safety
            return 'text';
        }
    }
    
    // Check for string functions (return text)
    const stringFunctions = ['CONCAT', 'SUBSTRING', 'UPPER', 'LOWER', 'TRIM', 'REPLACE', 'LEFT', 'RIGHT'];
    if (stringFunctions.some(func => expr.includes(func + '('))) {
        return 'text';
    }
    
    // Check for date functions (return date/timestamp)
    const dateFunctions = ['DATE', 'CURRENT_DATE', 'CURRENT_TIMESTAMP', 'NOW', 'DATE_TRUNC', 'EXTRACT'];
    if (dateFunctions.some(func => expr.includes(func))) {
        return 'timestamp without time zone';
    }
    
    // Check for aggregate functions (usually numeric)
    const aggregateFunctions = ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX'];
    if (aggregateFunctions.some(func => expr.includes(func + '('))) {
        // COUNT always returns integer
        if (expr.includes('COUNT')) {
            return 'bigint';
        }
        return 'numeric';
    }
    
    // Check for boolean expressions
    const booleanKeywords = ['TRUE', 'FALSE', 'AND', 'OR', 'NOT'];
    if (booleanKeywords.some(keyword => expr.includes(keyword))) {
        return 'boolean';
    }
    
    // Check for string literals
    if (expr.startsWith("'") || expr.startsWith('"')) {
        return 'text';
    }
    
    // Check for numeric literals
    if (!isNaN(Number(expr))) {
        return 'numeric';
    }
    
    // Default to numeric for unknown expressions
    return 'numeric';
}

/**
 * Validate and transform AI model to builder format
 * 
 * This function performs critical transformations:
 * 1. Validates model structure (table_name, columns array)
 * 2. Transforms column format (handles both "schema.table.column" and separate fields)
 * 3. Validates each column exists in available tables
 * 4. Translates logical table names to physical names (e.g., "orders" -> "ds2_7e1dc7cf")
 * 5. Marks aggregate-only columns with is_selected_column=false
 * 6. Validates and normalizes query_options (WHERE, ORDER BY, GROUP BY, HAVING)
 * 7. Ensures GROUP BY includes all non-aggregate selected columns
 * 8. Normalizes ORDER BY to use numeric indices (0=ASC, 1=DESC)
 * 
 * @param {Object} aiModel - Raw model from AI (may have logical table names)
 * @returns {Object|null} - Validated model with physical table names, or null if validation fails
 */
function validateAndTransformAIModel(aiModel: any) {
    const errors = [];

    try {
        // Validate model structure
        if (!aiModel) {
            errors.push('AI model is empty or undefined');
            throw new Error('Empty model');
        }

        // Validate required fields
        if (!aiModel.table_name) {
            errors.push('Missing table_name');
        }

        if (!aiModel.columns) {
            errors.push('Missing columns array');
        } else if (!Array.isArray(aiModel.columns)) {
            errors.push('Columns is not an array');
        } else if (aiModel.columns.length === 0) {
            errors.push('No columns specified');
        }

        // If critical errors exist, show detailed message
        if (errors.length > 0) {
            console.error('[Data Model Builder] Validation errors:', errors);
            $swal.fire({
                title: 'Invalid AI Model',
                html: `<div class="text-left"><p class="mb-2">The AI-generated model has the following issues:</p><ul class="list-disc pl-5">${errors.map(e => `<li>${e}</li>`).join('')}</ul></div>`,
                icon: 'error',
                confirmButtonText: 'Understood'
            });
            return null;
        }

        // STEP 1: Detect and transform column format
        // AI-generated models may use fully-qualified column names (schema.table.column)
        // while the builder expects separate fields (schema, table_name, column_name)

        // Log is_selected_column values before any processing
        aiModel.columns.forEach((col: any, idx: any) => {
        });

        const transformedColumns = aiModel.columns.map((col: any, index: any) => {
            // Check if column uses fully-qualified format (schema.table.column)
            if (col.column && typeof col.column === 'string' && !col.column_name) {
                const parts = col.column.split('.');

                if (parts.length === 3) {
                    // Parse: schema.table.column
                    return {
                        schema: parts[0],
                        table_name: parts[1],
                        column_name: parts[2],
                        data_type: col.data_type || 'text',
                        is_selected_column: col.is_selected_column !== undefined ? col.is_selected_column : undefined,
                        alias_name: col.alias_name || '',
                        transform_function: col.transform_function || '',
                        character_maximum_length: col.character_maximum_length || null,
                        reference: {
                            foreign_table_schema: '',
                            foreign_table_name: '',
                            foreign_column_name: '',
                            local_table_name: '',
                            local_column_name: ''
                        }
                    };
                } else if (parts.length === 2) {
                    // Parse: table.column (assume default schema from model)
                    return {
                        schema: aiModel.schema || 'public',
                        table_name: parts[0],
                        column_name: parts[1],
                        data_type: col.data_type || 'text',
                        is_selected_column: col.is_selected_column !== undefined ? col.is_selected_column : undefined,
                        alias_name: col.alias_name || '',
                        transform_function: col.transform_function || '',
                        character_maximum_length: col.character_maximum_length || null,
                        reference: {
                            foreign_table_schema: '',
                            foreign_table_name: '',
                            foreign_column_name: '',
                            local_table_name: '',
                            local_column_name: ''
                        }
                    };
                } else {
                    console.warn(`[Data Model Builder] Column ${index + 1} has invalid format: ${col.column}`);
                    return null;
                }
            }

            // Column already in builder format - return as is
            return col;
        }).filter((col: any) => col !== null);

        // Replace original columns with transformed ones
        aiModel.columns = transformedColumns;

        // STEP 1.5: Detect and validate reflexive relationships (self-joins)
        const tableUsageCounts: Record<string, number> = {};
        aiModel.columns.forEach((col: any) => {
            const key = getTableKeyForColumn(col);
            tableUsageCounts[key] = (tableUsageCounts[key] || 0) + 1;
        });

        // Check if any table appears multiple times (potential reflexive relationship)
        const reflexiveTables = Object.entries(tableUsageCounts).filter(([_, count]) => count > 1);

        if (reflexiveTables.length > 0) {

            reflexiveTables.forEach(([tableKey, count]) => {
                // Verify all instances have distinct aliases
                const columnsForTable = aiModel.columns.filter(
        (col: any) => getTableKeyForColumn(col) === tableKey
                );

                const aliases = columnsForTable.map((col: any) => col.table_alias).filter(Boolean);
                const uniqueAliases = new Set(aliases);

                // If table appears multiple times but has fewer unique aliases than instances
                if (uniqueAliases.size > 0 && uniqueAliases.size < 2 && count > 1) {
                    errors.push(
                        `Self-referencing table ${tableKey} requires unique aliases for each usage, ` +
                        `but found insufficient aliases (${uniqueAliases.size} unique aliases, ${count} total usages). ` +
                        `Each instance should have a distinct table_alias like "employees" and "managers".`
                    );
                }

                // Auto-create table aliases if AI provided them
                if (uniqueAliases.size >= 2) {

                    // Ensure aliases are registered in state
                    uniqueAliases.forEach(alias => {
                        const parsed = parseTableKey(tableKey);
                        const schema = parsed.schema;
                        const tableName = parsed.table;
                        const dataSourceId = parsed.dataSourceId;

                        // Check if alias already exists
                        const aliasExists = state.table_aliases.some((a: any) =>
                            a.schema === schema &&
                            a.original_table === tableName &&
                            a.alias === alias &&
                            (!props.isCrossSource || !dataSourceId || a.data_source_id === dataSourceId)
                        );

                        if (!aliasExists) {
                            state.table_aliases.push({
                                schema,
                                original_table: tableName,
                                alias,
                                data_source_id: dataSourceId || null
                            });
                        }
                    });
                }
            });
        }

        // If errors were found, display them
        if (errors.length > 0) {
            console.error('[Data Model Builder] Validation errors after alias check:', errors);
            $swal.fire({
                title: 'Invalid AI Model',
                html: `<div class="text-left"><p class="mb-2">The AI-generated model has the following issues:</p><ul class="list-disc pl-5">${errors.map(e => `<li>${e}</li>`).join('')}</ul></div>`,
                icon: 'error',
                confirmButtonText: 'Understood'
            });
            return null;
        }

        // STEP 2: Validate and fix each column
        const validColumns = [];
        const columnErrors = [];

        for (let i = 0; i < aiModel.columns.length; i++) {
            const col = aiModel.columns[i];
            const colIndex = i + 1;

            if (!col.schema) {
                columnErrors.push(`Column ${colIndex} (${col.column_name || col.column || 'unknown'}): Missing schema`);
                continue;
            }
            if (!col.table_name) {
                columnErrors.push(`Column ${colIndex} (${col.column_name || col.column || 'unknown'}): Missing table_name`);
                continue;
            }
            if (!col.column_name) {
                columnErrors.push(`Column ${colIndex} (${col.column || 'unknown'}): Missing column_name`);
                continue;
            }

            // CRITICAL FIX: AI returns schema as "dra_excel.ds72_xxxx" but we need just "dra_excel"
            // Normalize the schema name to handle combined schema.table references
            const schemaToMatch = normalizeSchemaName(col.schema);

            // Check if this column exists in the available tables
            const availableTables = state.tables || [];
            
            // CRITICAL FIX: Support both physical and logical table names
            // AI models use logical names (e.g., "user_acquisition", "loans")
            // while state.tables uses physical names (e.g., "ds52_2b702ce5", "ds72_1d68512e")
            
            const sourceTable = availableTables.find((t: any) => {
                if (props.isCrossSource && col.data_source_id && t.data_source_id !== col.data_source_id) {
                    return false;
                }
                
                // Match by physical name (backwards compatible)
                if (t.table_name === col.table_name && t.schema === schemaToMatch) {
                    return true;
                }
                // Match by logical name (supports AI-generated models with human-readable names)
                if (t.logical_name === col.table_name && t.schema === schemaToMatch) {
                    // IMPORTANT: Update col.table_name to physical name for subsequent processing
                    col.table_name = t.table_name;
                    // Also update col.schema to the normalized schema
                    col.schema = schemaToMatch;
                    if (props.isCrossSource && !col.data_source_id && t.data_source_id) {
                        col.data_source_id = t.data_source_id;
                    }
                    return true;
                }
                return false;
            });

            if (!sourceTable) {
                columnErrors.push(`Column ${colIndex}: Table ${schemaToMatch}.${col.table_name} does not exist in data source`);
                continue;
            }

            const columnExists = sourceTable.columns?.some((c: any) => c.column_name === col.column_name);
            if (!columnExists) {
                console.warn(`[DEBUG - AI Model Validation] ⚠️ Column not found: ${col.column_name} in table ${sourceTable.table_name}`);
                console.warn(`[DEBUG - AI Model Validation] Available columns in ${sourceTable.table_name}:`,
                    sourceTable.columns?.map((c: any) => c.column_name).join(', ')
                );
                columnErrors.push(`Column ${colIndex}: ${col.column_name} does not exist in table ${col.table_name}`);
                continue;
            }

            // Ensure required fields exist with defaults
            // Note: Keep is_selected_column as undefined if not set - will be processed later
            col.is_selected_column = col.is_selected_column !== undefined ? col.is_selected_column : undefined;
            col.alias_name = col.alias_name || '';
            col.transform_function = col.transform_function || '';
            col.character_maximum_length = col.character_maximum_length || null;
            col.data_type = col.data_type || 'text';

            // Initialize reference if not present
            if (!col.reference) {
                col.reference = {
                    foreign_table_schema: '',
                    foreign_table_name: '',
                    foreign_column_name: '',
                    local_table_name: '',
                    local_column_name: ''
                };
            }

            validColumns.push(col);
        }

        // If some columns had errors but we have valid ones, continue with warning
        if (columnErrors.length > 0 && validColumns.length > 0) {
            console.warn('[Data Model Builder] Column validation warnings:', columnErrors);
            $swal.fire({
                title: 'Model Applied with Warnings',
                html: `<div class="text-left"><p class="mb-2">Some columns were skipped due to errors:</p><ul class="list-disc pl-5">${columnErrors.slice(0, 5).map(e => `<li>${e}</li>`).join('')}${columnErrors.length > 5 ? `<li>...and ${columnErrors.length - 5} more</li>` : ''}</ul></div>`,
                icon: 'warning',
                timer: 4000
            });
        } else if (validColumns.length === 0) {
            $swal.fire({
                title: 'No Valid Columns',
                text: 'All columns in the AI model have validation errors. Cannot apply model.',
                icon: 'error'
            });
            return null;
        }

        aiModel.columns = validColumns;

        // STEP 3: Validate JOIN conditions against available inferred joins and foreign keys
        if (aiModel.join_conditions && Array.isArray(aiModel.join_conditions) && aiModel.join_conditions.length > 0) {
            
            // Get available inferred joins from store
            const availableInferredJoins = aiDataModelerStore.preloadedSuggestions || [];
            
            const validJoins: any[] = [];
            const joinErrors: any[] = [];
            
            aiModel.join_conditions.forEach((join: any, index: any) => {
                // CRITICAL: AI returns left_table/right_table (no schema), but validation needs schema
                // Extract schema from column metadata if not present in JOIN
                if (!join.left_table_schema || !join.left_table_name) {
                    // First, try to find in columns array
                    let leftColumn = aiModel.columns.find((col: any) =>
                        col.table_name === join.left_table && col.column_name === join.left_column
                    );
                    
                    // If not found in columns, search in state.tables
                    if (!leftColumn) {
                        const leftTable = state.tables?.find((t: any) => 
                            t.table_name === join.left_table || t.logical_name === join.left_table
                        );
                        if (leftTable) {
                            const leftTableColumn = leftTable.columns?.find((c: any) => 
                                c.column_name === join.left_column
                            );
                            if (leftTableColumn) {
                                join.left_table_schema = leftTable.schema;
                                join.left_table_name = leftTable.table_name;
                                join.left_column_name = join.left_column;
                            }
                        }
                    } else {
                        join.left_table_schema = leftColumn.schema;
                        join.left_table_name = leftColumn.table_name;
                        join.left_column_name = leftColumn.column_name;
                    }
                }
                
                if (!join.right_table_schema || !join.right_table_name) {
                    // First, try to find in columns array
                    let rightColumn = aiModel.columns.find((col: any) =>
                        col.table_name === join.right_table && col.column_name === join.right_column
                    );
                    
                    // If not found in columns, search in state.tables
                    if (!rightColumn) {
                        const rightTable = state.tables?.find((t: any) => 
                            t.table_name === join.right_table || t.logical_name === join.right_table
                        );
                        if (rightTable) {
                            const rightTableColumn = rightTable.columns?.find((c: any) => 
                                c.column_name === join.right_column
                            );
                            if (rightTableColumn) {
                                join.right_table_schema = rightTable.schema;
                                join.right_table_name = rightTable.table_name;
                                join.right_column_name = join.right_column;
                            }
                        }
                    } else {
                        join.right_table_schema = rightColumn.schema;
                        join.right_table_name = rightColumn.table_name;
                        join.right_column_name = rightColumn.column_name;
                    }
                }
                
                // CRITICAL: Skip JOIN if we couldn't resolve schema information
                if (!join.left_table_schema || !join.left_table_name || !join.left_column_name) {
                    console.error(`[Data Model Builder] Could not resolve left side of JOIN ${index + 1}:`, {
                        left_table: join.left_table,
                        left_column: join.left_column,
                        resolved_schema: join.left_table_schema,
                        resolved_table: join.left_table_name,
                        resolved_column: join.left_column_name
                    });
                    joinErrors.push(
                        `JOIN ${index + 1}: Could not resolve left table metadata for ${join.left_table}.${join.left_column}`
                    );
                    return;
                }
                
                if (!join.right_table_schema || !join.right_table_name || !join.right_column_name) {
                    console.error(`[Data Model Builder] Could not resolve right side of JOIN ${index + 1}:`, {
                        right_table: join.right_table,
                        right_column: join.right_column,
                        resolved_schema: join.right_table_schema,
                        resolved_table: join.right_table_name,
                        resolved_column: join.right_column_name
                    });
                    joinErrors.push(
                        `JOIN ${index + 1}: Could not resolve right table metadata for ${join.right_table}.${join.right_column}`
                    );
                    return;
                }
                
                // CRITICAL FIX: Normalize schemas (they may be combined like "dra_excel.ds72_xxxx")
                join.left_table_schema = normalizeSchemaName(join.left_table_schema);
                join.right_table_schema = normalizeSchemaName(join.right_table_schema);
                
                // Check if both tables exist in data source
                const leftTableExists = state.tables?.some((t: any) =>
                    t.schema === join.left_table_schema &&
                    (t.table_name === join.left_table_name || t.logical_name === join.left_table_name)
                );
                
                const rightTableExists = state.tables?.some((t: any) =>
                    t.schema === join.right_table_schema &&
                    (t.table_name === join.right_table_name || t.logical_name === join.right_table_name)
                );
                
                if (!leftTableExists) {
                    joinErrors.push(`JOIN ${index + 1}: Left table ${join.left_table_schema}.${join.left_table_name} does not exist`);
                    return;
                }
                
                if (!rightTableExists) {
                    joinErrors.push(`JOIN ${index + 1}: Right table ${join.right_table_schema}.${join.right_table_name} does not exist`);
                    return;
                }
                
                // Translate logical table names to physical names
                const leftTable = state.tables?.find((t: any) =>
                    t.schema === join.left_table_schema &&
                    (t.table_name === join.left_table_name || t.logical_name === join.left_table_name)
                );
                const rightTable = state.tables?.find((t: any) =>
                    t.schema === join.right_table_schema &&
                    (t.table_name === join.right_table_name || t.logical_name === join.right_table_name)
                );
                
                if (leftTable && leftTable.table_name !== join.left_table_name) {
                    join.left_table_name = leftTable.table_name;
                }
                
                if (rightTable && rightTable.table_name !== join.right_table_name) {
                    join.right_table_name = rightTable.table_name;
                }
                
                // Check if JOIN matches an inferred join or foreign key relationship
                const matchesInferredJoin = availableInferredJoins.some(inferred =>
                    (inferred.left_schema === join.left_table_schema &&
                     inferred.left_table === join.left_table_name &&
                     inferred.left_column === join.left_column_name &&
                     inferred.right_schema === join.right_table_schema &&
                     inferred.right_table === join.right_table_name &&
                     inferred.right_column === join.right_column_name) ||
                    // Check reverse direction
                    (inferred.right_schema === join.left_table_schema &&
                     inferred.right_table === join.left_table_name &&
                     inferred.right_column === join.left_column_name &&
                     inferred.left_schema === join.right_table_schema &&
                     inferred.left_table === join.right_table_name &&
                     inferred.left_column === join.right_column_name)
                );
                
                if (matchesInferredJoin) {
                    join.ai_suggested = true; // Mark as AI-suggested
                    validJoins.push(join);
                } else {
                    // Check if it's a foreign key relationship
                    const matchesForeignKey = leftTable?.foreignKeys?.some((fk: any) =>
                        fk.column_name === join.left_column_name &&
                        fk.foreign_table_name === join.right_table_name &&
                        fk.foreign_column_name === join.right_column_name
                    ) || rightTable?.foreignKeys?.some((fk: any) =>
                        fk.column_name === join.right_column_name &&
                        fk.foreign_table_name === join.left_table_name &&
                        fk.foreign_column_name === join.left_column_name
                    );
                    
                    if (matchesForeignKey) {
                        join.is_auto_detected = true;
                        validJoins.push(join);
                    } else {
                        // Hallucinated join - AI invented a relationship that doesn't exist
                        joinErrors.push(
                            `JOIN ${index + 1}: No relationship found between ` +
                            `${join.left_table_schema}.${join.left_table_name}.${join.left_column_name} and ` +
                            `${join.right_table_schema}.${join.right_table_name}.${join.right_column_name}. ` +
                            `This JOIN is not supported by the data source.`
                        );
                    }
                }
            });
            
            if (joinErrors.length > 0) {
                console.error('[Data Model Builder] JOIN validation errors:', joinErrors);
                $swal.fire({
                    title: 'Invalid JOINs in AI Model',
                    html: `<div class="text-left">
                        <p class="mb-2">The AI generated JOINs that don't exist in your data:</p>
                        <ul class="list-disc pl-5 text-sm">${joinErrors.map(e => `<li>${e}</li>`).join('')}</ul>
                        <p class="mt-3 text-xs text-gray-600">
                            <strong>Note:</strong> The AI can only use relationships that exist in your schema 
                            (foreign keys or pattern-detected joins). JOINs have been removed from the model.
                        </p>
                    </div>`,
                    icon: 'warning',
                    confirmButtonText: 'Continue Without JOINs'
                });
                
                // Remove invalid joins but continue with the model
                aiModel.join_conditions = validJoins;
            } else {
                aiModel.join_conditions = validJoins;
            }
        }

        // CRITICAL FIX: Translate logical table names to physical names in query_options
        // After column validation, we've already translated col.table_name from logical to physical
        // Now we need to update references in GROUP BY, aggregates, WHERE, ORDER BY, etc.
        const createTableNameMapping = () => {
            const mapping = new Map();
            aiModel.columns.forEach((col: any) => {
                // Each column now has the physical table_name after validation
                // We need to create a mapping for translating full paths in query_options
                const physicalPath = `${col.schema}.${col.table_name}.${col.column_name}`;
                // Store for later use
                mapping.set(physicalPath, col);
            });
            return mapping;
        };

        const columnMapping = createTableNameMapping();

        // Initialize query_options with validation
        if (!aiModel.query_options) {
            aiModel.query_options = {
                where: [],
                group_by: {},
                order_by: [],
                offset: -1,
                limit: -1
            };
        } else {
            // Validate and sanitize query_options
            aiModel.query_options.where = Array.isArray(aiModel.query_options.where) ? aiModel.query_options.where : [];
            aiModel.query_options.group_by = typeof aiModel.query_options.group_by === 'object' ? aiModel.query_options.group_by : {};
            aiModel.query_options.order_by = Array.isArray(aiModel.query_options.order_by) ? aiModel.query_options.order_by : [];
            aiModel.query_options.offset = typeof aiModel.query_options.offset === 'number' ? aiModel.query_options.offset : -1;
            aiModel.query_options.limit = typeof aiModel.query_options.limit === 'number' ? aiModel.query_options.limit : -1;

            // VALIDATION: Filter out invalid ORDER BY clauses
            if (aiModel.query_options.order_by && aiModel.query_options.order_by.length > 0) {
                const validOrderByClauses: any[] = [];
                aiModel.query_options.order_by.forEach((orderByClause: any, index: any) => {
                    if (!orderByClause) {
                        return;
                    }
                    if (!orderByClause.column || orderByClause.column === '') {
                        return;
                    }
                    
                    // Normalize order value: handle both numeric (0=ASC, 1=DESC) and string formats
                    if (typeof orderByClause.order === 'number') {
                        // Convert numeric to index: 0 = ASC, 1 = DESC
                        if (orderByClause.order === 0 || orderByClause.order === 1) {
                            // Valid numeric order
                        } else {
                            console.warn(`[Data Model Builder] ORDER BY clause ${index}: invalid numeric order ${orderByClause.order}, defaulting to 0 (ASC)`);
                            orderByClause.order = 0;
                        }
                    } else if (typeof orderByClause.order === 'string') {
                        // Convert string to numeric index for consistency with builder
                        const upperOrder = orderByClause.order.toUpperCase();
                        if (upperOrder === 'ASC') {
                            orderByClause.order = 0;
                        } else if (upperOrder === 'DESC') {
                            orderByClause.order = 1;
                        } else {
                            console.warn(`[Data Model Builder] ORDER BY clause ${index}: invalid string order "${orderByClause.order}", defaulting to 0 (ASC)`);
                            orderByClause.order = 0;
                        }
                    } else {
                        console.warn(`[Data Model Builder] ORDER BY clause ${index}: invalid or missing order, defaulting to 0 (ASC)`);
                        orderByClause.order = 0;
                    }
                    
                    validOrderByClauses.push(orderByClause);
                });
                
                aiModel.query_options.order_by = validOrderByClauses;
            }

            // VALIDATION: Filter out invalid WHERE clauses
            if (aiModel.query_options.where && aiModel.query_options.where.length > 0) {
                const validWhereClauses: any[] = [];
                aiModel.query_options.where.forEach((whereClause: any, index: any) => {
                    if (!whereClause) {
                        console.warn(`[Data Model Builder] Skipping null WHERE clause at index ${index}`);
                        return;
                    }
                    if (!whereClause.column || whereClause.column === '') {
                        console.warn(`[Data Model Builder] Skipping WHERE clause ${index}: missing column`);
                        return;
                    }
                    if (!whereClause.operator || whereClause.operator === '') {
                        console.warn(`[Data Model Builder] Skipping WHERE clause ${index}: missing operator`);
                        return;
                    }
                    
                    validWhereClauses.push(whereClause);
                });
                
                if (validWhereClauses.length !== aiModel.query_options.where.length) {
                    console.warn(`[Data Model Builder] Filtered WHERE clauses: ${aiModel.query_options.where.length} → ${validWhereClauses.length}`);
                }
                aiModel.query_options.where = validWhereClauses;
            }

            // Populate column_data_type for WHERE conditions from columns array
            if (aiModel.query_options.where.length > 0) {
                aiModel.query_options.where.forEach((whereClause: any) => {
                    if (!whereClause.column_data_type && whereClause.column) {
                        // Look up column data type from columns array
                        const column = aiModel.columns.find((col: any) => 
                            `${col.schema}.${col.table_name}.${col.column_name}` === whereClause.column
                        );
                        if (column) {
                            whereClause.column_data_type = column.data_type;
                        } else {
                            console.warn(`[Data Model Builder] Could not find column definition for WHERE clause: ${whereClause.column}`);
                        }
                    }
                });
            }

                // CRITICAL: If group_by has aggregate_functions, set the name flag
                // This flag is required for the UI to show the GROUP BY section
                // 
                // IMPORTANT: aggregate_function uses numeric indices:
                // 0 = SUM, 1 = AVG, 2 = COUNT, 3 = MIN, 4 = MAX
                // DO NOT use falsy checks (!) on aggregate_function as 0 (SUM) is valid!
                // 
                // Set GROUP BY name flag when ANY aggregation is present (functions OR expressions)
                // This flag controls UI visibility and SQL generation
                if (aiModel.query_options.group_by &&
                    (aiModel.query_options.group_by.aggregate_functions?.length > 0 ||
                     aiModel.query_options.group_by.aggregate_expressions?.some(
                         (expr: any) => expr.expression && expr.expression !== ''
                     ) ||
                     aiModel.query_options.group_by.group_by_columns?.length > 0)) {
                    aiModel.query_options.group_by.name = 'GROUP BY';
                    // CRITICAL: Translate logical table names to physical in aggregate functions
                // Aggregate functions reference columns like "schema.table.column"
                // where table might still be a logical name that needs translation
                
                // VALIDATION: Filter out invalid aggregate functions before processing
                if (aiModel.query_options.group_by.aggregate_functions) {
                    const validAggregateFunctions: any[] = [];
                    aiModel.query_options.group_by.aggregate_functions.forEach((aggFunc: any, index: any) => {
                        // Validate required fields
                        if (!aggFunc) {
                            console.warn(`[Data Model Builder] Skipping null aggregate function at index ${index}`);
                            return;
                        }
                        // CRITICAL FIX: aggregate_function can be 0 (SUM), so check for null/undefined, not falsy
                        if (aggFunc.aggregate_function === null || aggFunc.aggregate_function === undefined || aggFunc.aggregate_function === '') {
                            console.warn(`[Data Model Builder] Skipping aggregate function ${index}: missing or empty aggregate_function field (value: ${aggFunc.aggregate_function})`);
                            return;
                        }
                        if (!aggFunc.column || aggFunc.column === '') {
                            console.warn(`[Data Model Builder] Skipping aggregate function ${index}: missing or empty column field`);
                            return;
                        }
                        
                        // Ensure column_alias_name exists
                        if (!aggFunc.column_alias_name) {
                            // aggregate_function is numeric index (0=SUM, 1=AVG, 2=COUNT, 3=MIN, 4=MAX)
                            const functionNames = ['sum', 'avg', 'count', 'min', 'max'];
                            const funcName = functionNames[aggFunc.aggregate_function] || 'aggregate';
                            const columnName = aggFunc.column.split('.').pop();
                            aggFunc.column_alias_name = `${funcName}_${columnName}`;
                        }
                        
                        validAggregateFunctions.push(aggFunc);
                    });
                    
                    if (validAggregateFunctions.length !== aiModel.query_options.group_by.aggregate_functions.length) {
                        console.warn(`[Data Model Builder] Filtered aggregate functions: ${aiModel.query_options.group_by.aggregate_functions.length} → ${validAggregateFunctions.length}`);
                    }
                    aiModel.query_options.group_by.aggregate_functions = validAggregateFunctions;
                }
                
                aiModel.query_options.group_by.aggregate_functions?.forEach((aggFunc: any) => {
                    if (aggFunc.column) {
                        const parts = aggFunc.column.split('.');
                        if (parts.length === 3) {
                            const [schema, tableName, columnName] = parts;
                            // Find the matching column that was already translated
                            const translatedCol = aiModel.columns.find((c: any) =>
                                c.schema === schema && c.column_name === columnName
                            );
                            if (translatedCol) {
                                const newPath = `${translatedCol.schema}.${translatedCol.table_name}.${translatedCol.column_name}`;
                                if (aggFunc.column !== newPath) {
                                    aggFunc.column = newPath;
                                }
                            }
                        }
                    }
                });

                // Translate logical table names in GROUP BY columns array
                if (aiModel.query_options.group_by.group_by_columns) {
                    aiModel.query_options.group_by.group_by_columns = aiModel.query_options.group_by.group_by_columns.map((colRef: any) => {
                        // Handle transform functions like DATE(schema.table.column)
                        const match = colRef.match(/^(.+?\()?([\w]+)\.([\w]+)\.([\w]+)(\).*)?$/);
                        if (match) {
                            const [, prefix, schema, tableName, columnName, suffix] = match;
                            // Find the translated column
                            const translatedCol = aiModel.columns.find((c: any) =>
                                c.schema === schema && c.column_name === columnName
                            );
                            if (translatedCol) {
                                const newPath = `${translatedCol.schema}.${translatedCol.table_name}.${translatedCol.column_name}`;
                                const oldPath = `${schema}.${tableName}.${columnName}`;
                                if (oldPath !== newPath) {
                                    const newRef = `${prefix || ''}${newPath}${suffix || ''}`;
                                    return newRef;
                                }
                            }
                        }
                        return colRef;
                    });
                }

                // SOLUTION B: Mark columns that are ONLY used in aggregates (not in regular SELECT)
                // Build a Set of columns used in aggregate functions
                const aggregateColumns = new Set();
                aiModel.query_options.group_by.aggregate_functions?.forEach((aggFunc: any) => {
                    if (aggFunc.column) {
                        aggregateColumns.add(aggFunc.column);
                    }
                });

                // VALIDATION: Filter out invalid aggregate expressions before processing
                if (aiModel.query_options.group_by.aggregate_expressions) {
                    const validAggregateExpressions: any[] = [];
                    aiModel.query_options.group_by.aggregate_expressions.forEach((aggExpr: any, index: any) => {
                        if (!aggExpr) {
                            console.warn(`[Data Model Builder] Skipping null aggregate expression at index ${index}`);
                            return;
                        }
                        if (!aggExpr.expression || aggExpr.expression.trim() === '') {
                            console.warn(`[Data Model Builder] Skipping aggregate expression ${index}: missing or empty expression field`);
                            return;
                        }
                        
                        // Ensure column_alias_name exists
                        if (!aggExpr.column_alias_name) {
                            aggExpr.column_alias_name = `expr_${index}`;
                        }
                        
                        // CRITICAL: Infer data type from expression (especially for CASE statements)
                        if (!aggExpr.column_data_type) {
                            aggExpr.column_data_type = inferDataTypeFromExpression(aggExpr.expression);
                        }
                        
                        validAggregateExpressions.push(aggExpr);
                    });
                    
                    if (validAggregateExpressions.length !== aiModel.query_options.group_by.aggregate_expressions.length) {
                        console.warn(`[Data Model Builder] Filtered aggregate expressions: ${aiModel.query_options.group_by.aggregate_expressions.length} → ${validAggregateExpressions.length}`);
                    }
                    aiModel.query_options.group_by.aggregate_expressions = validAggregateExpressions;
                }

                // Process aggregate expressions that reference columns
                aiModel.query_options.group_by.aggregate_expressions?.forEach((aggExpr: any) => {
                    if (aggExpr.expression) {
                        // Extract column references from expressions like "schema.table.column"
                        const columnMatches = aggExpr.expression.match(/\w+\.\w+\.\w+/g);
                        if (columnMatches) {
                            columnMatches.forEach((col: any) => aggregateColumns.add(col));
                        }
                    }
                });

                // Mark columns that are ONLY in aggregates (set is_selected_column = false)
                // These columns should NOT appear in SELECT or GROUP BY clauses
                // FORCE override regardless of AI's value - aggregate-only means NOT in SELECT
                aiModel.columns.forEach((col: any) => {
                    const fullPath = `${col.schema}.${col.table_name}.${col.column_name}`;
                    if (aggregateColumns.has(fullPath)) {
                        // FORCE to false - this column is ONLY for aggregate functions
                        col.is_selected_column = false;
                    }
                });

                // CRITICAL FIX: Also filter these columns from group_by_columns array
                // Backend uses this array to reconstruct GROUP BY clause
                if (aiModel.query_options.group_by.group_by_columns) {
                    aiModel.query_options.group_by.group_by_columns =
                        aiModel.query_options.group_by.group_by_columns.filter((col: any) =>
                            !aggregateColumns.has(col)
                        );
                }
                
                // PROACTIVE FIX: Ensure all non-aggregate selected columns are in GROUP BY
                // This fixes AI models that provide incomplete group_by_columns arrays
                if (!aiModel.query_options.group_by.group_by_columns) {
                    aiModel.query_options.group_by.group_by_columns = [];
                }
                
                const currentGroupBy = new Set(aiModel.query_options.group_by.group_by_columns);
                let addedCount = 0;
                
                aiModel.columns.forEach((col: any) => {
                    if (col.is_selected_column) {
                        const fullPath = `${col.schema}.${col.table_name}.${col.column_name}`;
                        // If column is NOT aggregated and NOT in GROUP BY, add it
                        if (!aggregateColumns.has(fullPath) && !currentGroupBy.has(fullPath)) {
                            let columnRef = fullPath;
                            // Include transform functions if present
                            if (col.transform_function) {
                                const closeParens = ')'.repeat(col.transform_close_parens || 1);
                                columnRef = `${col.transform_function}(${columnRef}${closeParens}`;
                            }
                            aiModel.query_options.group_by.group_by_columns.push(columnRef);
                            addedCount++;
                        }
                    }
                });
                
                // VALIDATION: Filter out invalid HAVING clauses
                if (aiModel.query_options.group_by.having_conditions && aiModel.query_options.group_by.having_conditions.length > 0) {
                    const validHavingClauses: any[] = [];
                    aiModel.query_options.group_by.having_conditions.forEach((havingClause: any, index: any) => {
                        if (!havingClause) {
                            console.warn(`[Data Model Builder] Skipping null HAVING clause at index ${index}`);
                            return;
                        }
                        if (!havingClause.column || havingClause.column === '') {
                            console.warn(`[Data Model Builder] Skipping HAVING clause ${index}: missing column`);
                            return;
                        }
                        if (!havingClause.operator || havingClause.operator === '') {
                            console.warn(`[Data Model Builder] Skipping HAVING clause ${index}: missing operator`);
                            return;
                        }
                        
                        validHavingClauses.push(havingClause);
                    });
                    
                    if (validHavingClauses.length !== aiModel.query_options.group_by.having_conditions.length) {
                        console.warn(`[Data Model Builder] Filtered HAVING clauses: ${aiModel.query_options.group_by.having_conditions.length} → ${validHavingClauses.length}`);
                    }
                    aiModel.query_options.group_by.having_conditions = validHavingClauses;
                }
                
                // Populate column_data_type for HAVING conditions
                // HAVING conditions reference aggregate functions, so use NUMERIC type
                if (aiModel.query_options.group_by.having_conditions?.length > 0) {
                    aiModel.query_options.group_by.having_conditions.forEach((havingClause: any) => {
                        if (!havingClause.column_data_type && havingClause.column) {
                            // Check if it's an aggregate function alias
                            const aggFunc = aiModel.query_options.group_by.aggregate_functions?.find((af: any) => 
                                af.column_alias_name === havingClause.column
                            );
                            
                            if (aggFunc) {
                                // Aggregate functions typically return numeric values
                                havingClause.column_data_type = 'numeric';
                            } else {
                                // Try to find in base columns
                                const column = aiModel.columns.find((col: any) => 
                                    `${col.schema}.${col.table_name}.${col.column_name}` === havingClause.column
                                );
                                if (column) {
                                    havingClause.column_data_type = column.data_type;
                                }
                            }
                        }
                    });
                }
            }
        }

        // FINAL STEP: Default any remaining undefined is_selected_column to true (regular SELECT columns)
        aiModel.columns.forEach((col: any) => {
            if (col.is_selected_column === undefined || col.is_selected_column === null) {
                col.is_selected_column = true;
            }
        });

        // Initialize calculated_columns with validation
        if (!aiModel.calculated_columns) {
            aiModel.calculated_columns = [];
        } else if (!Array.isArray(aiModel.calculated_columns)) {
            console.warn('[Data Model Builder] calculated_columns is not an array, resetting to empty array');
            aiModel.calculated_columns = [];
        }

        // Ensure table_name exists
        if (!aiModel.table_name) {
            aiModel.table_name = 'ai_generated_model';
        }

        // CRITICAL: Ensure columns array exists (required for draggable component)
        if (!aiModel.columns) {
            console.error('[Data Model Builder] Model has no columns array, creating empty array');
            aiModel.columns = [];
        } else if (!Array.isArray(aiModel.columns)) {
            console.error('[Data Model Builder] Model columns is not an array, converting to array');
            aiModel.columns = Array.isArray(validColumns) ? validColumns : [];
        }
        
        // FINAL VALIDATION: Ensure we have at least one column to display
        const selectedColumns = aiModel.columns?.filter((c: any) => c.is_selected_column) || [];
        if (selectedColumns.length === 0 && aiModel.columns?.length > 0) {
            console.warn('[Data Model Builder] No columns marked for display, but columns exist. This might cause display issues.');
        }
        
        // CRITICAL: Detect multi-table models WITHOUT JOIN conditions
        // This is a common AI model issue where columns reference multiple tables
        // but no explicit JOINs are defined
        const uniqueTables = new Set();
        const tablePhysicalToLogical = new Map(); // Map physical names to logical names
        
        aiModel.columns.forEach((col: any) => {
            const tableKey = getTableKeyForColumn(col);
            uniqueTables.add(tableKey);
            
            // Find the logical name for this physical table
            const sourceTable = findSourceTableForColumn(col);
            
            if (sourceTable) {
                const logicalName = sourceTable.logical_name || sourceTable.table_name;
                const displayPrefix = props.isCrossSource && col.data_source_id
                    ? `${col.data_source_id}.`
                    : '';
                tablePhysicalToLogical.set(tableKey, `${displayPrefix}${col.schema}.${logicalName}`);
            } else {
                // Fallback to physical name if not found
                tablePhysicalToLogical.set(tableKey, tableKey);
            }
        });
        
        if (uniqueTables.size > 1) {
            // Check if we have any manual joins or join conditions defined
            // CRITICAL: Check aiModel.join_conditions (the validated model) NOT state.join_conditions (not yet applied)
            const hasJoinConditions = aiModel.join_conditions && aiModel.join_conditions.length > 0;
            const hasManualJoins = state.manual_joins && state.manual_joins.length > 0;
            
            if (!hasJoinConditions && !hasManualJoins) {
                // Build table list with logical names for user-friendly display
                const tableDisplayNames = Array.from(uniqueTables).map(physicalKey => {
                    const logicalKey = tablePhysicalToLogical.get(physicalKey) || physicalKey;
                    return `<li><strong>${logicalKey}</strong></li>`;
                }).join('');
                
                // Show error - cannot proceed without JOINs
                $swal.fire({
                    title: 'Missing JOIN Conditions',
                    html: `
                        <div class="text-left">
                            <p class="mb-4">The AI model uses columns from <strong>${uniqueTables.size} different tables</strong> but did not specify how they should be joined.</p>
                            <p class="mb-4"><strong>Tables involved:</strong></p>
                            <ul class="list-disc pl-5 mb-4">
                                ${tableDisplayNames}
                            </ul>
                            <p class="mb-2"><strong>How to fix this:</strong></p>
                            <ol class="list-decimal pl-5">
                                <li>Ask the AI to include JOIN conditions in the model</li>
                                <li>OR manually add JOIN conditions using the "Add Join" button</li>
                                <li>OR use the model with only one table at a time</li>
                            </ol>
                        </div>
                    `,
                    icon: 'error',
                    confirmButtonText: 'Understood',
                    width: 600
                });
                
                return null; // Abort model application
            }
        }
        
        return aiModel;

    } catch (error: any) {
        console.error('[Data Model Builder] Critical error validating AI model:', error);
        $swal.fire({
            title: 'Validation Failed',
            text: 'The AI model could not be validated. Please try generating a new model.',
            icon: 'error'
        });
        return null;
    }
}

// Issue #361 - Data Model Composition: Check if data model is stale
async function checkStaleness() {
    if (!props.dataModel?.id) return;
    
    try {
        const config = useRuntimeConfig();
        const token = getAuthToken();
        if (!token) return;
        
        const response = await $fetch<any>(
            `${config.public.apiBase}/data-model/staleness/${props.dataModel.id}`,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Authorization-Type': 'auth'
                }
            }
        );
        
        if (response.success) {
            state.staleness_warning = {
                isStale: response.isStale,
                staleParents: response.staleParents
            };
        }
    } catch (error: any) {
        console.error('[Data Model Builder] Failed to check staleness:', error);
    }
}

// Helper function to format dates for staleness banner
function formatDate(dateString: any) {
    if (!dateString) return 'unknown time';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    
    // For older dates, show the actual date
    return date.toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

// Helper function to clean model names (remove UUID suffix)
function cleanModelName(name: any) {
    if (!name) return '';
    // Remove UUID suffix pattern: _abc123def456 (12 hex characters)
    return name.replace(/_[a-f0-9]{12}$/, '');
}

onMounted(async () => {
    // Check if user has seen the layer walkthrough (browser localStorage)
    if (import.meta.client) {
        const hasSeenWalkthrough = localStorage.getItem('medallion_walkthrough_seen');
        if (!hasSeenWalkthrough) {
            state.showLayerWalkthrough = true;
        }
    }

    // Load subscription stats for row limit enforcement
    try {
        await subscriptionStore.fetchSubscription();
    } catch (error: any) {
        console.error('[Data Model Builder] Failed to load subscription stats:', error);
    }
    
    // CRITICAL: Load tables FIRST before processing data model
    // This ensures state.tables is available when ensureReferencedColumnsExist() runs

    // Diagnostic: Check each table for duplicates
    props.dataSourceTables.forEach((table, tIndex) => {

        if (table.columns && Array.isArray(table.columns)) {
            // Check for duplicate column names
            const columnNames = table.columns.map((c: any) => c.column_name);
            const duplicates = columnNames.filter((name: any, index: any) =>
                columnNames.indexOf(name) !== index
            );

            if (duplicates.length > 0) {
                console.error(`[DEBUG - Data Model Builder] ⚠️ DUPLICATES FOUND in ${table.table_name}:`, [...new Set(duplicates)]);
                console.error(`[DEBUG - Data Model Builder] Full duplicate columns:`,
                    table.columns.filter((c: any) => duplicates.includes(c.column_name))
                );
            }

            // Check for columns that don't match table name
            const mismatchedColumns = table.columns.filter((c: any) => c.table_name !== table.table_name);
            if (mismatchedColumns.length > 0) {
                console.error(`[DEBUG - Data Model Builder] ⚠️ MISMATCHED TABLE NAMES in ${table.table_name}:`,
                    mismatchedColumns.map((c: any) => `${c.column_name} (says it belongs to ${c.table_name})`)
                );
            }
        }
    });

    state.tables = props.dataSourceTables;
    state.isInitialized = true; // Mark as initialized after tables are loaded

    // PRELOAD JOIN SUGGESTIONS: Fetch all possible joins immediately for better UX
    // This provides proactive guidance before users select columns
    
    try {
        const loggedInUserStore = useLoggedInUserStore();
        const user = loggedInUserStore.getLoggedInUser();
        const enableAI = user?.user_type === 'admin';
        
        if (props.isCrossSource && props.projectId) {
            // Cross-source mode: Use project-level endpoint
            await aiDataModelerStore.preloadCrossSourceSuggestions(props.projectId, enableAI);
        } else if (!props.isCrossSource && props.dataSource?.id) {
            // Single-source mode: Use data source endpoint
            await aiDataModelerStore.preloadSuggestionsForDataSource(props.dataSource.id, enableAI);
        } else {
            console.warn('[Data Model Builder] Cannot preload suggestions: missing required props');
        }
    } catch (error: any) {
        console.error('[Data Model Builder] Failed to preload join suggestions:', error);
    }

    if (props.dataModel && props.dataModel.query) {
        state.data_table = props.dataModel.query;
        
        // Issue #361: Initialize layer selection when editing existing model
        if (props.dataModel.data_layer) {
            state.selected_layer = props.dataModel.data_layer;
        }

        // Enrich columns with logical table names from metadata (for legacy models)
        if (state.data_table.columns) {
            state.data_table.columns.forEach((col: any) => {
                if (!col.table_logical_name) {
                    const sourceTable = state.tables.find((t: any) => 
                        t.table_name === col.table_name && t.schema === col.schema
                    );
                    if (sourceTable?.logical_name) {
                        col.table_logical_name = sourceTable.logical_name;
                    }
                }
            });
        }

        // Ensure join_conditions exists (for backward compatibility with older saved models)
        if (!state.data_table.join_conditions) {
            state.data_table.join_conditions = [];
        }

        // Ensure table_aliases exists (for backward compatibility)
        if (!state.data_table.table_aliases) {
            state.data_table.table_aliases = [];
        }

        // Migrate existing join_conditions to include primary_operator and join_logic if missing
        if (state.data_table.join_conditions) {
            state.data_table.join_conditions.forEach((join: any) => {
                if (!join.primary_operator) {
                    join.primary_operator = '=';
                }
                if (!join.join_logic) {
                    join.join_logic = 'AND';
                }
            });
        }

        // Copy JOIN conditions from data_table to state-level array for UI binding
        if (state.data_table.join_conditions && state.data_table.join_conditions.length > 0) {
            state.join_conditions = [...state.data_table.join_conditions];
        }

        // Copy table aliases from data_table to state-level array for UI binding
        if (state.data_table.table_aliases && state.data_table.table_aliases.length > 0) {
            state.table_aliases = [...state.data_table.table_aliases];
        }

        // Ensure GROUP BY structure is properly initialized (for backward compatibility)
        if (state.data_table.query_options?.group_by) {
            // Ensure aggregate_functions array exists
            if (!state.data_table.query_options.group_by.aggregate_functions) {
                state.data_table.query_options.group_by.aggregate_functions = [];
            }

            // Ensure aggregate_expressions array exists
            if (!state.data_table.query_options.group_by.aggregate_expressions) {
                state.data_table.query_options.group_by.aggregate_expressions = [];
            }

            // Ensure having_conditions array exists
            if (!state.data_table.query_options.group_by.having_conditions) {
                state.data_table.query_options.group_by.having_conditions = [];
            }

            // Ensure group_by_columns array exists
            if (!state.data_table.query_options.group_by.group_by_columns) {
                state.data_table.query_options.group_by.group_by_columns = [];
            }
        }

        // CRITICAL: Ensure all referenced columns exist in state
        // This restores columns used in GROUP BY, WHERE, HAVING, ORDER BY
        // even if they weren't selected for display (is_selected_column: false)
        ensureReferencedColumnsExist();

        // Backward compatibility: Migrate existing hidden columns to tracking system
        if (!state.data_table.hidden_referenced_columns) {
            state.data_table.hidden_referenced_columns = [];
        }
        
        // Check existing columns and track those that are hidden but used
        state.data_table.columns.forEach((col: any) => {
            if (!col.is_selected_column) {
                const colPath = `${col.schema}.${col.table_name}.${col.column_name}`;
                
                // Check if in GROUP BY
                const inGroupBy = state.data_table.query_options?.group_by?.group_by_columns?.some(
                    (ref: any) => {
                        const baseRef = ref.replace(/\w+\(/g, '').replace(/\)/g, '');
                        return baseRef.includes(colPath) || ref.includes(colPath);
                    }
                );
                
                // Check if in aggregates
                const inAggregate = state.data_table.query_options?.group_by?.aggregate_functions?.some(
                    (aggFunc: any) => aggFunc.column === colPath
                );
                
                // Check if in WHERE
                const inWhere = state.data_table.query_options?.where?.some(
                    (clause: any) => clause.column === colPath
                );
                
                // Check if in HAVING
                const inHaving = state.data_table.query_options?.group_by?.having_conditions?.some(
                    (clause: any) => clause.column === colPath
                );
                
                // Check if in ORDER BY
                const inOrderBy = state.data_table.query_options?.order_by?.some(
                    (clause: any) => clause.column === colPath
                );
                
                // If used anywhere, ensure it's tracked
                if (inGroupBy || inAggregate || inWhere || inHaving || inOrderBy) {
                    const alreadyTracked = state.data_table.hidden_referenced_columns.some(
                        (tracked: any) => tracked.schema === col.schema &&
                                   tracked.table_name === col.table_name &&
                                   tracked.column_name === col.column_name
                    );
                    
                    if (!alreadyTracked) {
                        // Will be properly tracked by ensureReferencedColumnsExist
                    }
                }
            }
        });

        // Auto-switch to advanced view if data model has advanced fields
        if (hasAdvancedFields()) {
            state.viewMode = 'advanced';
        }
        
        // Issue #361 - Data Model Composition: Check staleness of data models
        checkStaleness();
    }

    // NOTE: AI-suggested joins are now fetched dynamically when user selects columns from multiple tables
    // See watch() on state.data_table.columns below (Issue #270)
    
    // Mark initial load as complete - allows column selection watch to trigger suggestions
    // This prevents fetching suggestions on page load/refresh when editing existing models
    nextTick(() => {
        state.is_initial_load = false;
    });
})

onBeforeUnmount(() => {
    state.is_unmounting = true;
    state.is_executing_query = false;
    state.is_applying_ai_config = false;
    state.is_saving_model = false;
    
    // Clear AI-suggested joins to prevent stale data
    aiDataModelerStore.clearSuggestions();
});

</script>
<template>
    <div>
        <!-- Read-Only Mode Banner -->
        <div v-if="readOnly" class="mb-4 p-4 bg-yellow-50 border-2 border-yellow-400 rounded-lg flex items-center gap-3">
            <font-awesome icon="fas fa-eye" class="text-yellow-600 text-2xl" />
            <div>
                <h3 class="font-bold text-yellow-800">View-Only Mode</h3>
                <p class="text-sm text-yellow-700">You are viewing this data model in read-only mode. All controls are disabled.</p>
            </div>
        </div>
        
        <!-- ── Model Health Panel ──────────────────────────────────── -->
        <div v-if="showDataModelControls" class="mb-4 rounded-lg border-2 p-4"
            :class="{
                'bg-green-50 border-green-300': health.status.value === 'healthy',
                'bg-amber-50 border-amber-300': health.status.value === 'warning',
                'bg-red-50 border-red-300': health.status.value === 'blocked',
                'bg-gray-50 border-gray-300': health.status.value === 'unknown',
            }">

            <!-- Header row -->
            <div class="flex items-center gap-2 font-bold mb-2"
                :class="{
                    'text-green-700': health.status.value === 'healthy',
                    'text-amber-700': health.status.value === 'warning',
                    'text-red-700': health.status.value === 'blocked',
                    'text-gray-500': health.status.value === 'unknown',
                }">
                <font-awesome-icon v-if="health.status.value === 'healthy'" :icon="['fas', 'circle-check']" />
                <font-awesome-icon v-else-if="health.status.value === 'warning'" :icon="['fas', 'triangle-exclamation']" />
                <font-awesome-icon v-else-if="health.status.value === 'blocked'" :icon="['fas', 'circle-xmark']" />
                <font-awesome-icon v-else :icon="['fas', 'circle-info']" />
                <span>Model Health</span>
                <span class="text-xs font-medium px-2 py-0.5 rounded-full"
                    :class="{
                        'bg-green-100 text-green-700': health.status.value === 'healthy',
                        'bg-amber-100 text-amber-700': health.status.value === 'warning',
                        'bg-red-100 text-red-700': health.status.value === 'blocked',
                        'bg-gray-100 text-gray-500': health.status.value === 'unknown',
                    }">
                    <template v-if="health.status.value === 'healthy'">Ready for charts</template>
                    <template v-else-if="health.status.value === 'warning'">Review recommended</template>
                    <template v-else-if="health.status.value === 'blocked'">Cannot be used for charts</template>
                    <template v-else>Add columns to see health</template>
                </span>
            </div>

            <!-- Dimensional table info message intentionally removed:
                 previously depended on undefined effectiveModelType and caused runtime errors -->

            <!-- Issue details -->
            <div v-if="health.issues.value.length > 0" class="space-y-2 mb-3">
                <div v-for="issue in health.issues.value" :key="issue.code" class="text-sm">
                    <div class="font-medium"
                        :class="{
                            'text-amber-700': health.status.value === 'warning',
                            'text-red-700': health.status.value === 'blocked',
                        }">
                        {{ issue.title }}
                    </div>
                    <div class="text-gray-600 mt-0.5">{{ issue.description }}</div>
                    <div class="text-gray-500 mt-0.5 italic text-xs">{{ issue.recommendation }}</div>
                </div>
            </div>

            <!-- Healthy with aggregation — affirming message -->
            <div v-if="health.status.value === 'healthy' && health.hasAggregation.value"
                class="text-xs text-green-700 mb-2 flex items-center gap-1">
                <font-awesome-icon :icon="['fas', 'check']" />
                Aggregation detected — model will produce summary data
            </div>

            <!-- Source row count -->
            <div v-if="health.sourceRowCount.value !== null"
                class="text-xs text-gray-500 mb-2">
                Source: {{ health.sourceRowCount.value.toLocaleString() }} rows
            </div>

            <!-- Source check in progress -->
            <div v-if="health.loadingSourceCheck.value"
                class="text-xs text-gray-400 mb-2 flex items-center gap-1">
                <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin" />
                Checking source table size…
            </div>

            <!-- Actions (warning / blocked states only, edit mode only) -->
            <div v-if="(health.status.value === 'blocked' || health.status.value === 'warning') && health.hasModelId.value && !readOnly"
                class="flex flex-wrap gap-2 mt-1">
                <button
                    :disabled="health.settingModelType.value"
                    @click="onMarkAsDimension"
                    class="text-xs px-3 py-1.5 rounded border border-gray-400 bg-white text-gray-700 hover:bg-gray-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                    <font-awesome-icon v-if="health.settingModelType.value" :icon="['fas', 'spinner']" class="animate-spin mr-1" />
                    Mark as Dimension table
                </button>
            </div>
        </div>
        <!-- ── End Model Health Panel ──────────────────────────────── -->
        
        <!-- No Data Warning Banner -->
        <div v-if="!hasTableData" class="mb-4 p-4 bg-orange-50 border-2 border-orange-400 rounded-lg flex items-center gap-3">
            <font-awesome icon="fas fa-exclamation-triangle" class="text-orange-600 text-2xl" />
            <div class="flex-1">
                <h3 class="font-bold text-orange-800">No Data Available in Tables</h3>
                <p class="text-sm text-orange-700 mt-1">
                    The connected data source tables contain no rows. Data models cannot be created until the tables have been populated with data.
                </p>
                <p class="text-sm text-orange-600 mt-2">
                    Please ensure your data source contains data before attempting to build a data model.
                </p>
            </div>
        </div>
        
        <!-- Issue #361 - Data Model Composition: Staleness Warning Banner -->
        <div v-if="state.staleness_warning?.isStale" class="mb-4 p-5 bg-orange-50 border-2 border-orange-400 rounded-lg shadow-md">
            <div class="flex items-start gap-4">
                <font-awesome-icon :icon="['fas', 'triangle-exclamation']" class="text-orange-600 text-3xl flex-shrink-0 mt-1" />
                <div class="flex-1">
                    <h3 class="font-bold text-orange-800 text-lg mb-2">Source Data Models Have Been Updated</h3>
                    <p class="text-sm text-orange-700 mb-3">
                        This data model uses other data models as sources, and those parent models have been refreshed since this model was last built.
                        The data in this model may be outdated.
                    </p>
                    
                    <!-- List of stale parent models -->
                    <div class="mb-4 bg-white p-3 rounded border border-orange-300">
                        <p class="text-sm font-semibold text-orange-800 mb-2">Updated Parent Models:</p>
                        <ul class="text-sm text-gray-700 space-y-1">
                            <li v-for="parent in state.staleness_warning.staleParents" :key="parent.id" class="flex items-center gap-2">
                                <font-awesome-icon :icon="['fas', 'layer-group']" class="text-purple-600 text-xs" />
                                <span class="font-medium">{{ parent.name }}</span>
                                <span class="text-xs text-gray-500">(refreshed {{ formatDate(parent.lastRefreshed) }})</span>
                            </li>
                        </ul>
                    </div>
                    
                    <div class="flex gap-3">
                        <button 
                            @click="executeQueryOnExternalDataSource" 
                            :disabled="readOnly"
                            :class="[
                                'px-4 py-2 font-medium shadow rounded-lg transition-colors duration-200 flex items-center gap-2',
                                readOnly 
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                                    : 'bg-orange-600 text-white hover:bg-orange-700 cursor-pointer'
                            ]">
                            <font-awesome-icon :icon="['fas', 'rotate']" />
                            Rebuild This Model Now
                        </button>
                        <button 
                            @click="state.staleness_warning = null" 
                            class="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200 cursor-pointer">
                            Dismiss
                        </button>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Issue #361 Phase 5: Composition Layer Recommendation -->
        <div v-if="isComposingDataModels && state.composition_recommendation" class="mb-4 p-5 bg-purple-50 border-2 border-purple-400 rounded-lg shadow-md">
            <div class="flex items-start gap-4">
                <font-awesome-icon :icon="['fas', 'layer-group']" class="text-purple-600 text-3xl flex-shrink-0 mt-1" />
                <div class="flex-1">
                    <h3 class="font-bold text-purple-800 text-lg mb-2 flex items-center gap-2">
                        <span>Data Layer Recommendation</span>
                        <font-awesome-icon :icon="['fas', 'sparkles']" class="text-yellow-500 text-sm" />
                    </h3>
                    <p class="text-sm text-purple-700 mb-3">
                        You're composing data from existing models. Here's our AI recommendation for the appropriate data layer:
                    </p>
                   
                    <!-- Recommended Layer -->
                    <div class="mb-4 bg-white p-4 rounded border border-purple-300">
                        <div class="flex items-center justify-between mb-3">
                            <span class="text-sm font-semibold text-purple-800">Suggested Layer:</span>
                            <DataModelLayerBadge 
                                :layer="state.composition_recommendation.suggestedLayer" 
                                :show-alternative-name="true" 
                            />
                        </div>
                        <p class="text-sm text-gray-700 italic">
                            {{ state.composition_recommendation.reasoning }}
                        </p>
                    </div>
                    
                    <!-- Source Models -->
                    <div class="mb-4 bg-white p-3 rounded border border-purple-300">
                        <p class="text-sm font-semibold text-purple-800 mb-2">Source Models:</p>
                        <div class="flex flex-wrap gap-2">
                            <div 
                                v-for="sourceModel in state.composition_recommendation.sourceModels" 
                                :key="sourceModel.id"
                                class="flex items-center gap-2 px-3 py-1.5 bg-purple-50 rounded-lg border border-purple-200"
                            >
                                <span class="text-sm font-medium text-gray-800">{{ cleanModelName(sourceModel.name) }}</span>
                                <DataModelLayerBadge 
                                    v-if="sourceModel.layer" 
                                    :layer="sourceModel.layer" 
                                />
                                <span v-else class="text-xs text-gray-500 italic">Unclassified</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Flow Warnings -->
                    <div v-if="state.composition_recommendation.flowWarnings && state.composition_recommendation.flowWarnings.length > 0" 
                        class="mb-3 bg-amber-50 p-3 rounded border border-amber-300">
                        <div class="flex items-start gap-2">
                            <font-awesome-icon :icon="['fas', 'triangle-exclamation']" class="text-amber-600 text-sm mt-0.5 flex-shrink-0" />
                            <div class="flex-1">
                                <p class="text-sm font-semibold text-amber-800 mb-1">Layer Flow Warnings:</p>
                                <ul class="text-xs text-amber-700 space-y-1">
                                    <li v-for="(warning, idx) in state.composition_recommendation.flowWarnings" :key="idx">
                                        {{ warning }}
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    
                    <p class="text-xs text-purple-600">
                        💡 You can assign this layer manually using the layer selector after saving the model, or follow the recommendation for best practices.
                    </p>
                </div>
            </div>
        </div>
        
        <!-- Loading indicator for composition recommendation -->
        <div v-if="isComposingDataModels && state.composition_recommendation_loading && !state.composition_recommendation" 
            class="mb-4 p-4 bg-purple-50 border border-purple-300 rounded-lg">
            <div class="flex items-center gap-3">
                <font-awesome-icon :icon="['fas', 'spinner']" class="text-purple-600 animate-spin" />
                <span class="text-sm text-purple-700">Analyzing composition and generating layer recommendation...</span>
            </div>
        </div>
        
        <div class="flex flex-row flex-wrap justify-between items-center gap-2 mb-5">
            <div class="font-bold text-xl md:text-2xl">
                Create A Data Model from the Connected Data Source(s)
            </div>
            <button v-if="(props.dataSource && props.dataSource.id) || (props.isCrossSource && props.projectId)" @click="openAIDataModelerDebounced"
                :disabled="readOnly"
                :class="[
                    'flex items-center gap-2 px-4 py-2 font-medium shadow-md rounded-lg transition-colors duration-200',
                    readOnly 
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                        : 'bg-primary-blue-100 text-white hover:bg-primary-blue-300 cursor-pointer'
                ]">
                <font-awesome icon="fas fa-wand-magic-sparkles" class="w-5 h-5" />
                Build with AI
            </button>
        </div>
        <div class="text-sm md:text-base mb-4 md:mb-10">
            You can create a new data model from the tables given below by dragging into the empty block shown in the
            data model section to the right.
        </div>

        <!-- SQL Error Alert (Prominent) -->
        <SQLErrorAlert 
            :error="state.sqlError" 
            @dismiss="state.sqlError = null"
            class="sticky top-20 z-30"
        />
        
        <!-- Alerts Section -->
        <div v-if="state.alerts && state.alerts.length > 0" class="flex flex-col mb-5">
            <div v-for="(alert, index) in state.alerts" :key="index"
                class="flex flex-row items-center p-4 mb-2 rounded border" :class="{
                    'bg-yellow-50 border-yellow-400 text-yellow-800': alert.type === 'warning',
                    'bg-red-50 border-red-400 text-red-800': alert.type === 'error'
                }">
                <font-awesome
                    :icon="alert.type === 'warning' ? 'fas fa-exclamation-triangle' : 'fas fa-exclamation-circle'"
                    class="mr-3 text-xl" :class="{
                        'text-yellow-600': alert.type === 'warning',
                        'text-red-600': alert.type === 'error'
                    } as any" />
                <span class="flex-1">{{ alert.message }}</span>
                <font-awesome icon="fas fa-times" class="ml-3 cursor-pointer hover:opacity-70"
                    @click="state.alerts.splice(index, 1)" />
            </div>
        </div>

        <div v-if="state.response_from_external_data_source_columns && state.response_from_external_data_source_columns.length"
            class="flex flex-col overflow-auto">
            <h3 class="font-bold text-left mb-5">Response From External Data Source</h3>
            
            <!-- Row Limit Warning -->
            <RowLimitWarning 
                v-if="state.query_metadata?.wasLimited"
                :rowsReturned="state.query_metadata.rowsReturned"
                :rowLimit="state.query_metadata.rowLimit"
                :tierName="(subscriptionStore as any).subscription?.subscription_tier?.tier_name || 'current'"
                :wasLimited="state.query_metadata.wasLimited"
                :isBlocking="true"
                class="mb-4"
            />

            <!-- Post-run health warning: blocked model with preview results -->
            <div v-if="showBlockedModelWarning"
                class="mb-4 rounded-lg border-2 border-red-300 bg-red-50 p-4">
                <div class="flex items-center gap-2 font-bold text-red-700 mb-2">
                    <font-awesome-icon :icon="['fas', 'circle-xmark']" />
                    <span>This data model cannot be used for chart building</span>
                </div>
                <p class="text-sm text-red-700 mb-3">
                    The source tables are large and this model has no aggregation or insufficient filtering.
                    Without reducing the result set, the saved model will exceed the row limit and be blocked from charts.
                </p>
                <div class="flex flex-wrap gap-2">
                    <button @click="addQueryOption('GROUP BY')"
                        class="text-xs px-3 py-1.5 rounded border border-red-400 bg-white text-red-700 hover:bg-red-50 cursor-pointer">
                        <font-awesome-icon :icon="['fas', 'plus']" class="mr-1" />
                        Add aggregation (GROUP BY)
                    </button>
                    <button @click="addQueryOption('WHERE')"
                        class="text-xs px-3 py-1.5 rounded border border-red-400 bg-white text-red-700 hover:bg-red-50 cursor-pointer">
                        <font-awesome-icon :icon="['fas', 'plus']" class="mr-1" />
                        Add WHERE filters
                    </button>
                    <button v-if="health.hasModelId.value && !readOnly"
                        @click="onMarkAsDimension"
                        class="text-xs px-3 py-1.5 rounded border border-gray-400 bg-white text-gray-700 hover:bg-gray-50 cursor-pointer">
                        Mark as Dimension table
                    </button>
                    <button @click="openAIDataModelerDebounced"
                        class="text-xs px-3 py-1.5 rounded border border-blue-400 bg-white text-blue-700 hover:bg-blue-50 cursor-pointer">
                        <font-awesome-icon :icon="['fas', 'wand-magic-sparkles']" class="mr-1" />
                        Ask AI to suggest a fix
                    </button>
                </div>
                <p class="text-xs text-red-500 mt-3">Preview results (first 5 rows shown below):</p>
            </div>
            
            <div class="rounded-lg overflow-auto ring-1 ring-primary-blue-100 ring-inset mb-2">
                <table class="w-full">
                <thead>
                    <tr>
                        <th v-for="column in state.response_from_external_data_source_columns"
                            class="bg-blue-100 border border-primary-blue-100 border-solid p-2 text-center font-bold rounded-tl-lg">
                            <div class="flex flex-col">
                                <span class="font-bold">{{ getColumnDisplayName(column) }}</span>
                                <span v-if="getColumnTableName(column) !== getColumnDisplayName(column)" class="text-xs text-gray-600 mt-1">({{ column }})</span>
                            </div>
                        </th>
                    </tr>
                    <tr v-for="(row, rowIndex) in state.response_from_external_data_source_rows.slice(0, 5)"
                        :key="rowIndex"
                        class="border border-primary-blue-100 border-solid p-2 text-center font-bold rounded-tr-lg">
                        <td v-for="column in state.response_from_external_data_source_columns"
                            class="border border-primary-blue-100 border-solid p-2 text-center">
                            {{ row[column] }}
                        </td>
                    </tr>
                </thead>
            </table>
            </div>
            <div class="w-full h-1 bg-blue-300 mt-5 mb-5"></div>
        </div>

        <!-- MongoDB Query Editor (Replaces SQL Builder for MongoDB) -->
        <div v-if="isMongoDB" class="m-10">
            <div class="flex flex-col gap-4 mb-4">
                <div class="flex flex-row justify-center bg-gray-300 text-center font-bold p-1 rounded-lg">
                     <h4 class="w-full font-bold">
                         <input type="text" class="border border-primary-blue-100 border-solid p-2 rounded w-1/2"
                             placeholder="Enter Data Model Name" v-model="state.data_table.table_name" />
                     </h4>
                </div>
                
                <!-- Issue #361: Layer Selector for MongoDB -->
                <div class="px-2 cursor-pointer">
                    <label class="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <span>Data Layer (Medallion Architecture)</span>
                        <button
                            @click="state.showLayerWalkthrough = true"
                            type="button"
                            class="text-primary-blue-600 hover:text-primary-blue-700 transition-colors cursor-pointer"
                            title="Learn about data layers"
                        >
                            <font-awesome-icon :icon="['fas', 'circle-question']" class="text-base" />
                        </button>
                    </label>
                    <DataModelLayerSelector
                        v-model="state.selected_layer"
                        :disabled="readOnly"
                        placeholder="Select layer (optional)"
                        :allowNoLayer="true"
                    />
                    <p class="text-xs text-gray-500 mt-1">
                        Classify your data quality: Raw Data (Bronze), Clean Data (Silver), or Business Ready (Gold)
                    </p>
                </div>
            </div>
            <MongoDBQueryEditor
                :modelValue="{ collection: state.mongo_query.collection, pipeline: state.mongo_query.pipeline }"
                :collections="collectionNames"
                @update:modelValue="onMongoQueryUpdate"
                @run-query="onRunMongoQuery"
            />
        </div>

        <!-- View Mode Toggle (Only for SQL) -->
        <div v-if="!isMongoDB" class="flex justify-end mb-4">
            <div class="inline-flex items-center gap-2">
                <div class="inline-flex shadow-sm" role="group">
                    <button type="button" @click="state.viewMode = 'simple'" :disabled="readOnly" :class="[
                        'px-4 py-2 text-sm font-medium transition-all duration-200 border border-2 border-solid border-gray-200 rounded-tl-lg',
                        readOnly ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
                        state.viewMode === 'simple'
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    ]">
                        Simple View
                    </button>
                    <button type="button" @click="state.viewMode = 'advanced'" :disabled="readOnly" :class="[
                        'px-4 py-2 text-sm font-medium transition-all duration-200 border border-2 border-solid border-gray-200 rounded-tr-lg',
                        readOnly ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
                        state.viewMode === 'advanced'
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    ]">
                        Advanced View
                    </button>
                </div>
                <button 
                    type="button" 
                    @click="toggleAdvancedFeaturesDialog"
                    class="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-all duration-200 cursor-pointer"
                    v-tippy="{ content: 'Learn about Advanced View features', placement: 'top' }">
                    <font-awesome icon="fas fa-lightbulb" class="text-xl" />
                </button>
            </div>
        </div>

        <div v-if="!isMongoDB" class="flex flex-col md:flex-row mx-2 my-4 md:m-10">
            <div class="w-full md:w-1/2 flex flex-col md:pr-5 md:mr-5 border-b-2 md:border-b-0 md:border-r-2 border-primary-blue-100 pb-5 md:pb-0">
                <!-- Table Alias Manager -->
                <div v-if="state.viewMode === 'advanced'" class="mb-6 p-4 border-2 border-blue-200 bg-blue-50 rounded-lg">
                    <h3 class="font-bold mb-3 flex items-center text-blue-800">
                        <font-awesome icon="fas fa-layer-group" class="mr-2" />
                        Table Aliases (For Self-Referencing Relationships)
                    </h3>
                    <p class="text-sm text-gray-700 mb-3">
                        Use aliases when you need to join a table to itself (e.g., employees and managers, user
                        friendships).
                    </p>

                    <div v-if="state.table_aliases.length === 0" class="text-gray-600 italic mb-3 text-sm">
                        No table aliases defined. Click "Add Alias" to create one for self-referencing queries.
                    </div>

                    <div v-else class="mb-3 space-y-2">
                        <div v-for="(alias, index) in state.table_aliases" :key="index"
                            class="flex items-center justify-between bg-white p-3 border border-blue-300 rounded-lg">
                            <div class="flex flex-col">
                                <span class="font-medium text-sm">
                                    {{ alias.schema }}.{{ alias.original_table }}
                                    <font-awesome icon="fas fa-arrow-right" class="mx-2 text-blue-600" />
                                    <span class="text-blue-700 font-bold">"{{ alias.alias }}"</span>
                                </span>
                                <span class="text-xs text-gray-600 mt-1">
                                    This alias lets you use {{ alias.original_table }} in multiple roles
                                </span>
                            </div>
                            <button @click="removeTableAlias(index)" :disabled="readOnly"
                                :class="[
                                    'px-3 py-1 text-sm transition-colors rounded-lg',
                                    readOnly ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-red-500 text-white hover:bg-red-600 cursor-pointer'
                                ]">
                                Remove
                            </button>
                        </div>
                    </div>

                    <button @click="openAliasDialog()" :disabled="readOnly"
                        :class="[
                            'px-4 py-2 transition-colors flex items-center gap-2 rounded-lg',
                            readOnly ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                        ]">
                        <font-awesome icon="fas fa-plus" />
                        Add Table Alias
                    </button>
                </div>

                <!-- Loading state while preloading suggestions -->
                <div v-if="!props.isCrossSource && aiDataModelerStore.isPreloading" 
                     class="mb-6 p-4 border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-sm">
                    <div class="flex items-center gap-3">
                        <font-awesome icon="fas fa-spinner" spin class="text-blue-600 text-xl" />
                        <div>
                            <p class="font-semibold text-blue-800">Analyzing table relationships...</p>
                            <p class="text-sm text-blue-600">Discovering intelligent JOIN suggestions for your data</p>
                        </div>
                    </div>
                </div>

                <!-- AI-Suggested JOINs Panel (Issue #270) - PRELOADED MODE -->
                <!-- Always show if suggestions exist, dynamically filter to selected tables -->
                <SuggestedJoinsPanel
                    v-if="aiDataModelerStore.preloadedSuggestions.length > 0"
                    :suggestions="aiDataModelerStore.relevantSuggestions"
                    :all-suggestions="aiDataModelerStore.preloadedSuggestions"
                    :loading="aiDataModelerStore.isPreloading"
                    :applied-suggestions="aiDataModelerStore.appliedSuggestions"
                    :dismissed-suggestions="aiDataModelerStore.dismissedSuggestions"
                    :tables="state.tables"
                    @apply="handleApplySuggestedJoin"
                    @dismiss="handleDismissSuggestedJoin"
                    class="mb-6"
                />

                <!-- JOIN Conditions Manager -->
                <div v-if="state.viewMode === 'advanced' && hasMultipleTables()"
                    class="mb-6 p-4 border-2 border-green-200 bg-green-50 rounded-lg">
                    <h3 class="font-bold mb-3 flex items-center text-green-800">
                        <font-awesome icon="fas fa-link" class="mr-2" />
                        JOIN Conditions
                    </h3>
                    <p class="text-sm text-gray-700 mb-3">
                        Manage how tables are joined together. Auto-detected JOINs are shown below, or create custom
                        ones.
                    </p>

                    <div v-if="state.join_conditions.length === 0" class="text-gray-600 italic mb-3 text-sm">
                        No JOIN conditions defined yet. Click "Add JOIN" or use AI to auto-detect from foreign keys.
                    </div>

                    <div v-else class="mb-3 space-y-3">
                        <template v-for="(join, joinIndex) in state.join_conditions" :key="join.id">
                            <!-- AND/OR Logic Connector (between JOINs) -->
                            <div v-if="Number(joinIndex) > 0" class="flex justify-center items-center my-3">
                                <div
                                    class="flex items-center gap-2 bg-yellow-50 border-2 border-yellow-400 px-4 py-2 rounded-lg shadow-sm">
                                    <font-awesome icon="fas fa-code-branch" class="text-yellow-700" />
                                    <span class="text-xs font-semibold text-gray-600">Connect with:</span>
                                    <select :value="join.join_logic || 'AND'"
                                        @change="updateJoinLogic(joinIndex, ($event as any).target.value)" :disabled="readOnly"
                                        class="px-3 py-1 border-2 border-yellow-500 rounded bg-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-yellow-600"
                                        :class="readOnly ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'">
                                        <option value="AND">AND - Both conditions must match</option>
                                        <option value="OR">OR - Either condition can match</option>
                                    </select>
                                    <span v-if="join.join_logic === 'OR'"
                                        class="text-xs text-orange-600 flex items-center gap-1">
                                        <font-awesome icon="fas fa-exclamation-triangle" />
                                        Complex query
                                    </span>
                                </div>
                            </div>

                            <div class="bg-white p-4 border-2"
                                :class="join.is_auto_detected ? 'border-purple-300' : 'border-green-400'">
                                <!-- Main JOIN Condition -->
                                <div class="flex items-start justify-between mb-3">
                                    <div class="flex-1">
                                        <div class="flex items-center mb-2">
                                            <span class="px-2 py-1 text-xs font-bold mr-2 rounded-lg" :class="join.join_type === 'INNER' ? 'bg-blue-200 text-blue-800' :
                                                join.join_type === 'LEFT' ? 'bg-yellow-200 text-yellow-800' :
                                                    join.join_type === 'RIGHT' ? 'bg-orange-200 text-orange-800' :
                                                        'bg-purple-200 text-purple-800'">
                                                {{ join.join_type }} JOIN
                                            </span>
                                            <span v-if="join.is_auto_detected"
                                                class="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded">
                                                <font-awesome icon="fas fa-magic" class="mr-1" />
                                                Auto-detected
                                            </span>
                            <span v-if="join.ai_suggested"
                                class="px-2 py-1 text-xs bg-gradient-to-r from-blue-100 to-indigo-100 text-indigo-700 rounded flex items-center gap-1"
                                :title="`AI Suggested (${Math.round((join.confidence_score || 0) * 100)}% confidence): ${join.reasoning}`">
                                <span class="text-sm">🤖</span>
                                <span>AI-Suggested</span>
                                <span class="font-bold">({{ Math.round((join.confidence_score || 0) * 100) }}%)</span>
                            </span>
                        </div>                                        <div
                                            class="font-mono text-sm bg-gray-100 p-2 border border-gray-300 flex items-center wrap-anywhere rounded">
                                            <span class="font-semibold text-blue-700">
                                                {{ join.left_table_schema }}.{{ join.left_table_alias ||
                                                    getTableLogicalName(join.left_table_schema, join.left_table_name) }}.{{ join.left_column_name }}
                                            </span>
                                            <select :value="join.primary_operator || '='"
                                                @change="updateJoinOperator(joinIndex, ($event as any).target.value)" :disabled="readOnly"
                                                class="mx-2 px-2 py-1 border border-gray-400 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg"
                                                :class="readOnly ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'">
                                                <option value="=">=</option>
                                                <option value="!=">!=</option>
                                                <option value=">">&gt;</option>
                                                <option value="<">&lt;</option>
                                                <option value=">=">&gt;=</option>
                                                <option value="<=">&lt;=</option>
                                            </select>
                                            <span class="font-semibold text-green-700">
                                                {{ join.right_table_schema }}.{{ join.right_table_alias ||
                                                    getTableLogicalName(join.right_table_schema, join.right_table_name) }}.{{ join.right_column_name }}
                                            </span>
                                        </div>

                                        <!-- Additional Conditions -->
                                        <div v-if="join.additional_conditions && join.additional_conditions.length > 0"
                                            class="mt-2 ml-4">
                                            <div v-for="(addCond, condIndex) in join.additional_conditions"
                                                :key="condIndex" class="flex items-center gap-2 mb-1 text-sm">
                                                <select v-model="addCond.logic" :disabled="readOnly"
                                                    class="px-2 py-1 border border-gray-300 text-xs rounded-lg"
                                                    :class="readOnly ? 'cursor-not-allowed opacity-50' : ''">
                                                    <option value="AND">AND</option>
                                                    <option value="OR">OR</option>
                                                </select>

                                                <select v-model="addCond.left_column" :disabled="readOnly"
                                                    class="px-2 py-1 border border-gray-300 flex-1 text-xs"
                                                    :class="readOnly ? 'cursor-not-allowed opacity-50' : ''">
                                                    <option value="">Select column...</option>
                                                    <option
                                                        v-for="col in getColumnsForTable(join.left_table_name, join.left_table_alias, join.left_data_source_id)"
                                                        :key="col.value" :value="col.value">
                                                        {{ col.label }}
                                                    </option>
                                                </select>

                                                <select v-model="addCond.operator" :disabled="readOnly"
                                                    class="px-2 py-1 border border-gray-300 text-xs"
                                                    :class="readOnly ? 'cursor-not-allowed opacity-50' : ''">
                                                    <option value="=">=</option>
                                                    <option value="!=">!=</option>
                                                    <option value=">">&gt;</option>
                                                    <option value="<">&lt;</option>
                                                    <option value=">=">&gt;=</option>
                                                    <option value="<=">&lt;=</option>
                                                </select>

                                                <select v-model="addCond.right_column" :disabled="readOnly"
                                                    class="px-2 py-1 border border-gray-300 flex-1 text-xs"
                                                    :class="readOnly ? 'cursor-not-allowed opacity-50' : ''">
                                                    <option value="">Select column...</option>
                                                    <option
                                                        v-for="col in getColumnsForTable(join.right_table_name, join.right_table_alias, join.right_data_source_id)"
                                                        :key="col.value" :value="col.value">
                                                        {{ col.label }}
                                                    </option>
                                                </select>

                                                <button @click="removeAdditionalCondition(joinIndex, condIndex)" :disabled="readOnly"
                                                    :class="[
                                                        'px-2 py-1 text-xs',
                                                        readOnly ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-red-500 text-white hover:bg-red-600 cursor-pointer'
                                                    ]">
                                                    <font-awesome icon="fas fa-times" />
                                                </button>
                                            </div>
                                        </div>

                                        <button @click="addAdditionalCondition(joinIndex)" :disabled="readOnly"
                                            :class="[
                                                'mt-2 text-xs rounded-lg',
                                                readOnly ? 'text-gray-400 cursor-not-allowed' : 'text-blue-600 hover:text-blue-800 cursor-pointer'
                                            ]">
                                            <font-awesome icon="fas fa-plus" class="mr-1" />
                                            Add AND/OR condition
                                        </button>
                                    </div>

                                    <div class="flex gap-2">
                                        <button @click="editJoinCondition(joinIndex)" :disabled="readOnly"
                                            :class="[
                                                'px-3 py-1 text-sm transition-colors rounded-lg flex items-center gap-1',
                                                readOnly ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-500 text-white hover:bg-blue-600 cursor-pointer'
                                            ]"
                                            v-tippy="{ content: 'Edit this JOIN condition', placement: 'top' }">
                                            <font-awesome icon="fas fa-edit" />
                                            Edit
                                        </button>
                                        <button @click="removeJoinCondition(joinIndex)" :disabled="readOnly"
                                            :class="[
                                                'px-3 py-1 text-sm transition-colors rounded-lg',
                                                readOnly ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-red-500 text-white hover:bg-red-600 cursor-pointer'
                                            ]">
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </template>
                    </div>

                    <button @click="openJoinDialog()" :disabled="readOnly"
                        :class="[
                            'px-4 py-2 transition-colors flex items-center gap-2 rounded-lg',
                            readOnly ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700 cursor-pointer'
                        ]">
                        <font-awesome icon="fas fa-plus" />
                        Add JOIN Condition
                    </button>
                </div>

                <div class="flex items-center mb-5">
                    <div class="flex-1"></div>
                    <h2 class="font-bold">Tables</h2>
                    <div class="flex-1 flex gap-2 justify-end">
                        <button 
                            @click="collapseAllTables"
                            class="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-all cursor-pointer flex items-center gap-1"
                            :class="{ 'invisible': allTablesCollapsed }"
                            v-tippy="{ content: 'Collapse all tables to hide columns', placement: 'top' }">
                            <font-awesome icon="fas fa-compress-alt" class="text-xs" />
                            Collapse All
                        </button>
                        <button 
                            @click="expandAllTables"
                            class="px-3 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-all cursor-pointer flex items-center gap-1"
                            :class="{ 'invisible': allTablesExpanded }"
                            v-tippy="{ content: 'Expand all tables to show columns', placement: 'top' }">
                            <font-awesome icon="fas fa-expand-alt" class="text-xs" />
                            Expand All
                        </button>
                    </div>
                </div>

                <!-- Aggregate-Only Columns Info Box -->
                <div v-if="getAggregateOnlyColumns().length > 0"
                    class="mb-4 p-3 bg-purple-50 border-2 border-purple-300 rounded">
                    <div class="flex items-center mb-2">
                        <font-awesome icon="fas fa-calculator" class="text-purple-600 mr-2" />
                        <h4 class="font-bold text-purple-800">Columns Used in Aggregates Only</h4>
                    </div>
                    <div class="text-sm text-gray-700 space-y-1">
                        <p class="mb-2 italic">These columns are used in aggregate functions (COUNT, SUM, etc.) but not
                            displayed as
                            regular columns:</p>
                        <div v-for="aggCol in getAggregateOnlyColumns()" :key="aggCol.fullPath"
                            class="bg-white p-2 border border-purple-200 rounded flex items-center justify-between">
                            <span class="font-mono text-xs">
                                <strong class="text-purple-700">{{ aggCol.aggregate_function }}</strong>(
                                <span class="text-blue-600">{{ aggCol.schema }}.{{ aggCol.table_name }}.{{
                                    aggCol.column_name }}</span>
                                ) AS <strong>{{ aggCol.alias }}</strong>
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Issue #361 - Data Model Composition: Data Sources Collapsible Section -->
                <div class="mb-6">
                    <!-- Data Sources Section Header -->
                    <div 
                        @click="state.show_data_source_section = !state.show_data_source_section"
                        class="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-green-100 to-emerald-100 border-2 border-green-300 rounded-lg cursor-pointer hover:from-green-150 hover:to-emerald-150 transition-all duration-200 shadow-sm"
                    >
                        <div class="flex items-center gap-3">
                            <font-awesome-icon :icon="['fas', 'database']" class="text-green-700 text-xl" />
                            <div>
                                <h3 class="font-bold text-green-800 text-lg">Data Sources</h3>
                                <p class="text-sm text-green-700">Tables from connected data sources</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="px-3 py-1 bg-white rounded-full text-sm font-semibold text-green-700 shadow-sm">
                                {{ state.tables.length }} {{ state.tables.length === 1 ? 'table' : 'tables' }}
                            </span>
                            <font-awesome-icon 
                                :icon="state.show_data_source_section ? 'fas fa-chevron-up' : 'fas fa-chevron-down'" 
                                class="text-green-700 text-lg transition-transform duration-200"
                            />
                        </div>
                    </div>

                    <!-- Data Sources Content (Collapsible) -->
                    <Transition
                        enter-active-class="transition-all duration-300 ease-out"
                        leave-active-class="transition-all duration-200 ease-in"
                        enter-from-class="opacity-0 -translate-y-2"
                        enter-to-class="opacity-100 translate-y-0"
                        leave-from-class="opacity-100 translate-y-0"
                        leave-to-class="opacity-0 -translate-y-2"
                    >
                        <div v-show="state.show_data_source_section" class="mt-4">
                            <div class="grid grid-cols-1 sm:grid-cols-2 md:Grid-cols-3 md:gap-2">
                                <div v-for="tableOrAlias in getTablesWithAliases()"
                                    :key="`${tableOrAlias.schema}.${tableOrAlias.table_name}.${tableOrAlias.table_alias || 'base'}`"
                                    class="flex flex-col border border-solid p-1 rounded-lg" :class="{
                                        'border-blue-400 bg-blue-50': tableOrAlias.isAlias,
                                        'border-green-400 bg-green-50': tableOrAlias.isJoinedOrAggregate && !tableOrAlias.isAlias,
                                        'border-primary-blue-100': !tableOrAlias.isAlias && !tableOrAlias.isJoinedOrAggregate
                                    }">
                                    <!-- Clickable header with collapse toggle -->
                                    <div @click="toggleTableCollapse(`${tableOrAlias.schema}.${tableOrAlias.table_name}.${tableOrAlias.table_alias || 'base'}`)"
                                        class="cursor-pointer hover:opacity-80 transition-opacity duration-150"
                                        :aria-expanded="!isTableCollapsed(`${tableOrAlias.schema}.${tableOrAlias.table_name}.${tableOrAlias.table_alias || 'base'}`)"
                                        role="button">
                            <h4 class="text-center font-bold p-1 mb-2 overflow-clip text-ellipsis wrap-anywhere flex items-center justify-between" :class="{
                                'bg-blue-200': tableOrAlias.isAlias,
                                'bg-green-200': tableOrAlias.isJoinedOrAggregate && !tableOrAlias.isAlias,
                                'bg-gray-300': !tableOrAlias.isAlias && !tableOrAlias.isJoinedOrAggregate
                            }">
                                <span class="flex-1">
                                    {{ tableOrAlias.display_name }}
                                    <span v-if="tableOrAlias.isAlias" class="text-xs text-blue-700 block mt-1">
                                        (Alias of {{ tableOrAlias.original_table }})
                                    </span>
                                    <span v-if="tableOrAlias.isJoinedOrAggregate && !tableOrAlias.isAlias"
                                        class="text-xs text-green-800 block mt-1 flex items-center justify-center gap-1">
                                        <font-awesome icon="fas fa-link" class="text-xs" />
                                        Joined/Aggregate Table
                                    </span>
                                    <!-- Show column count when collapsed -->
                                    <span v-if="isTableCollapsed(`${tableOrAlias.schema}.${tableOrAlias.table_name}.${tableOrAlias.table_alias || 'base'}`)" 
                                        class="text-xs text-gray-600 block mt-1">
                                        {{ getColumnCount(tableOrAlias.columns) }} column{{ getColumnCount(tableOrAlias.columns) !== 1 ? 's' : '' }}
                                    </span>
                                </span>
                                <!-- Caret icon -->
                                <font-awesome 
                                    :icon="isTableCollapsed(`${tableOrAlias.schema}.${tableOrAlias.table_name}.${tableOrAlias.table_alias || 'base'}`) 
                                        ? 'fas fa-caret-down' 
                                        : 'fas fa-caret-up'" 
                                    class="text-lg mr-2 flex-shrink-0 cursor-pointer text-gray-600 hover:text-gray-800 transition-colors"
                                />
                            </h4>
                        </div>
                        
                        <!-- Table metadata (always visible) -->
                        <div class="p-1 m-2 p-2 wrap-anywhere rounded-lg"
                            :class="tableOrAlias.isAlias ? 'bg-blue-100' : 'bg-gray-300'">
                            Table Schema: {{ tableOrAlias.schema }} <br />
                            Table Name: {{ tableOrAlias.logical_name || tableOrAlias.table_name }}
                            <span v-if="tableOrAlias.logical_name && tableOrAlias.logical_name !== tableOrAlias.table_name" class="text-xs text-gray-600 block mt-1">
                                Physical: {{ tableOrAlias.table_name }}
                            </span>
                            <span v-if="tableOrAlias.isAlias" class="block mt-1">
                                <br />Alias: <strong class="text-blue-700">{{ tableOrAlias.table_alias }}</strong>
                            </span>
                        </div>
                        
                        <!-- Collapsible columns section -->
                        <Transition
                            enter-active-class="transition-all duration-300 ease-out"
                            leave-active-class="transition-all duration-200 ease-in"
                            enter-from-class="opacity-0 -translate-y-2"
                            enter-to-class="opacity-100 translate-y-0"
                            leave-from-class="opacity-100 translate-y-0"
                            leave-to-class="opacity-0 -translate-y-2"
                        >
                            <div v-show="!isTableCollapsed(`${tableOrAlias.schema}.${tableOrAlias.table_name}.${tableOrAlias.table_alias || 'base'}`)">
                                <draggable :list="(tableOrAlias && tableOrAlias.columns) ? tableOrAlias.columns : []" :group="{
                                    name: 'tables',
                                    pull: readOnly ? false : 'clone',
                                    put: false,
                                }" itemKey="name">
                            <template v-if="!tableOrAlias.columns || tableOrAlias.columns.length === 0" #header>
                                <div class="p-6 text-center text-gray-500 italic">
                                    <font-awesome icon="fas fa-inbox" class="text-4xl mb-3 text-gray-400" />
                                    <p class="text-sm font-medium">No columns/data available</p>
                                    <p class="text-xs mt-1">This table is empty</p>
                                </div>
                            </template>
                            <template #item="{ element, index }">
                                <div class="cursor-pointer p-1 ml-2 mr-2 rounded-lg" :class="{
                                    'bg-gray-200': !element.reference.foreign_table_schema && !isColumnUsedInAggregate(element.column_name, tableOrAlias.schema, tableOrAlias.table_name) ? index % 2 === 0 : false,
                                    'bg-blue-100': tableOrAlias.isAlias && !element.reference.foreign_table_schema && index % 2 === 0,
                                    'bg-red-100 border-t-1 border-b-1 border-red-300': isColumnInDataModel(element.column_name, tableOrAlias.table_name, tableOrAlias.table_alias),
                                    'bg-purple-100 border-t-1 border-b-1 border-purple-300': isColumnUsedInAggregate(element.column_name, tableOrAlias.schema, tableOrAlias.table_name),
                                    'hover:bg-green-100': !isColumnInDataModel(element.column_name, tableOrAlias.table_name, tableOrAlias.table_alias) && !isColumnUsedInAggregate(element.column_name, tableOrAlias.schema, tableOrAlias.table_name),
                                }">
                                    <div class="flex flex-row">
                                        <div class="w-2/3 ml-2 wrap-anywhere">
                                            Column: <strong>{{ element.display_column_name || element.column_name
                                            }}</strong>
                                            <span
                                                v-if="isColumnUsedInAggregate(element.column_name, tableOrAlias.schema, tableOrAlias.table_name)"
                                                class="text-xs text-purple-700 ml-2 inline-flex items-center gap-1">
                                                <font-awesome icon="fas fa-calculator" class="text-xs" />
                                                Used in aggregate
                                            </span>
                                            <br />
                                            Column Data Type: {{ element.data_type }}<br />
                                            <div v-if="element.reference && element.reference.foreign_table_schema">
                                                <strong>Foreign Key Relationship Reference:</strong><br />
                                                <div class="border border-primary-blue-100 border-solid p-2 m-1 rounded">
                                                    Foreign Table Name: <strong>{{
                                                        element.reference.foreign_table_schema }}.{{
                                                            element.reference.foreign_table_name }}</strong><br />
                                                    Foreign Column Name: <strong>{{
                                                        element.reference.foreign_column_name }}</strong><br />
                                                </div>
                                            </div>
                                        </div>
                                        <div class="w-1/3 flex flex-col justify-center">
                                            <div class="flex flex-col justify-center mr-2">
                                                <input type="checkbox" :disabled="readOnly" 
                                                    :class="readOnly ? 'cursor-not-allowed scale-200' : 'cursor-pointer scale-200'"
                                                    :checked="isColumnInDataModel(element.column_name, tableOrAlias.table_name, tableOrAlias.table_alias)"
                                                    @change="toggleColumnInDataModel(element, tableOrAlias.table_name, tableOrAlias.table_alias)"
                                                    v-tippy="{ content: isColumnInDataModel(element.column_name, tableOrAlias.table_name, tableOrAlias.table_alias) ? 'Uncheck to remove from data model' : 'Check to add to data model', placement: 'top' }" />
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            </template>
                        </draggable>
                            </div>
                        </Transition>
                    </div>
                </div>
            </div>
        </Transition>
    </div>

                <!-- Issue #361 - Data Model Composition: Data Models Collapsible Section -->
                <div class="mb-6">
                    <!-- Data Models Section Header -->
                    <div 
                        @click="state.show_data_model_section = !state.show_data_model_section"
                        class="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-100 to-pink-100 border-2 border-purple-300 rounded-lg cursor-pointer hover:from-purple-150 hover:to-pink-150 transition-all duration-200 shadow-sm"
                    >
                        <div class="flex items-center gap-3">
                            <font-awesome-icon :icon="['fas', 'layer-group']" class="text-purple-700 text-xl" />
                            <div>
                                <h3 class="font-bold text-purple-800 text-lg">Data Models</h3>
                                <p class="text-sm text-purple-700">Pre-built models you can build upon</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="px-3 py-1 bg-white rounded-full text-sm font-semibold text-purple-700 shadow-sm">
                                {{ dataModelTables.length }} {{ dataModelTables.length === 1 ? 'model' : 'models' }}
                            </span>
                            <font-awesome-icon 
                                :icon="state.show_data_model_section ? 'fas fa-chevron-up' : 'fas fa-chevron-down'" 
                                class="text-purple-700 text-lg transition-transform duration-200"
                            />
                        </div>
                    </div>

                    <!-- Data Models Content (Collapsible) -->
                    <Transition
                        enter-active-class="transition-all duration-300 ease-out"
                        leave-active-class="transition-all duration-200 ease-in"
                        enter-from-class="opacity-0 -translate-y-2"
                        enter-to-class="opacity-100 translate-y-0"
                        leave-from-class="opacity-100 translate-y-0"
                        leave-to-class="opacity-0 -translate-y-2"
                    >
                        <div v-show="state.show_data_model_section" class="mt-4">
                            <!-- Empty State -->
                            <div v-if="dataModelTables.length === 0" class="p-8 text-center bg-purple-50 border-2 border-dashed border-purple-300 rounded-lg">
                                <font-awesome-icon :icon="['fas', 'layer-group']" class="text-5xl mb-4 text-purple-300" />
                                <p class="text-lg font-semibold text-purple-800 mb-2">No data models available yet</p>
                                <p class="text-sm text-purple-600">Create your first data model from data sources to see it here</p>
                            </div>

                            <!-- Data Models Grid -->
                            <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:Grid-cols-3 md:gap-2">
                                <div v-for="modelTable in dataModelTables"
                                    :key="`${modelTable.schema}.${modelTable.table_name}`"
                                    class="flex flex-col border-2 border-solid p-1 rounded-lg border-purple-400 bg-purple-50">
                                    <!-- Clickable header with collapse toggle -->
                                    <div @click="toggleTableCollapse(`${modelTable.schema}.${modelTable.table_name}.base`)"
                                        class="cursor-pointer hover:opacity-80 transition-opacity duration-150"
                                        :aria-expanded="!isTableCollapsed(`${modelTable.schema}.${modelTable.table_name}.base`)"
                                        role="button">
                                        <h4 class="text-center font-bold p-1 mb-2 overflow-clip text-ellipsis wrap-anywhere flex items-center justify-between bg-purple-200">
                                            <span class="flex-1">
                                                {{ modelTable.logical_name }}
                                                <span class="text-xs text-purple-800 block mt-1 flex items-center justify-center gap-1">
                                                    <font-awesome-icon :icon="['fas', 'layer-group']" class="text-xs" />
                                                    Data Model
                                                </span>
                                                <!-- Show column count when collapsed -->
                                                <span v-if="isTableCollapsed(`${modelTable.schema}.${modelTable.table_name}.base`)" 
                                                    class="text-xs text-gray-600 block mt-1">
                                                    {{ getColumnCount(modelTable.columns) }} column{{ getColumnCount(modelTable.columns) !== 1 ? 's' : '' }}
                                                </span>
                                            </span>
                                            <!-- Caret icon -->
                                            <font-awesome-icon 
                                                :icon="isTableCollapsed(`${modelTable.schema}.${modelTable.table_name}.base`) 
                                                    ? 'fas fa-caret-down' 
                                                    : 'fas fa-caret-up'" 
                                                class="text-lg mr-2 flex-shrink-0 cursor-pointer text-gray-600 hover:text-gray-800 transition-colors"
                                            />
                                        </h4>
                                    </div>
                                    
                                    <!-- Table metadata (always visible) -->
                                    <div class="p-1 m-2 p-2 wrap-anywhere rounded-lg bg-purple-100">
                                        Table Schema: {{ modelTable.schema }} <br />
                                        Table Name: {{ modelTable.logical_name || modelTable.table_name }}
                                        <span v-if="modelTable.logical_name && modelTable.logical_name !== modelTable.table_name" class="text-xs text-gray-600 block mt-1">
                                            Physical: {{ modelTable.table_name }}
                                        </span>
                                        <span v-if="modelTable.row_count !== undefined" class="text-xs text-purple-700 block mt-1">
                                            Rows: {{ modelTable.row_count.toLocaleString() }}
                                        </span>
                                        <!-- Issue #361 Phase 5: Layer badge for data models -->
                                        <div v-if="(modelTable as any).data_layer" class="mt-2 flex items-center justify-center">
                                            <DataModelLayerBadge :layer="(modelTable as any).data_layer" :show-alternative-name="true" />
                                        </div>
                                    </div>
                                    
                                    <!-- Collapsible columns section -->
                                    <Transition
                                        enter-active-class="transition-all duration-300 ease-out"
                                        leave-active-class="transition-all duration-200 ease-in"
                                        enter-from-class="opacity-0 -translate-y-2"
                                        enter-to-class="opacity-100 translate-y-0"
                                        leave-from-class="opacity-100 translate-y-0"
                                        leave-to-class="opacity-0 -translate-y-2"
                                    >
                                        <div v-show="!isTableCollapsed(`${modelTable.schema}.${modelTable.table_name}.base`)">
                                            <draggable :list="(modelTable && modelTable.columns) ? modelTable.columns : []" :group="{
                                                name: 'tables',
                                                pull: readOnly ? false : 'clone',
                                                put: false,
                                            }" itemKey="name">
                                        <template v-if="!modelTable.columns || modelTable.columns.length === 0" #header>
                                            <div class="p-6 text-center text-gray-500 italic">
                                                <font-awesome-icon :icon="['fas', 'inbox']" class="text-4xl mb-3 text-gray-400" />
                                                <p class="text-sm font-medium">No columns available</p>
                                                <p class="text-xs mt-1">This model is empty</p>
                                            </div>
                                        </template>
                                        <template #item="{ element, index }">
                                            <div class="cursor-pointer p-1 ml-2 mr-2 rounded-lg" :class="{
                                                'bg-purple-100': index % 2 === 0,
                                                'bg-red-100 border-t-1 border-b-1 border-red-300': isColumnInDataModel(element.column_name, modelTable.table_name, null),
                                                'hover:bg-purple-200': !isColumnInDataModel(element.column_name, modelTable.table_name, null),
                                            }">
                                                <div class="flex flex-row">
                                                    <div class="w-2/3 ml-2 wrap-anywhere">
                                                        Column: <strong>{{ element.column_name }}</strong>
                                                        <br />
                                                        Column Data Type: {{ element.data_type }}<br />
                                                    </div>
                                                    <div class="w-1/3 flex flex-col justify-center">
                                                        <div class="flex flex-col justify-center mr-2">
                                                            <input type="checkbox" :disabled="readOnly" 
                                                                :class="readOnly ? 'cursor-not-allowed scale-200' : 'cursor-pointer scale-200'"
                                                                :checked="isColumnInDataModel(element.column_name, modelTable.table_name, null)"
                                                                @change="toggleColumnInDataModel(element, modelTable.table_name, null)"
                                                                v-tippy="{ content: isColumnInDataModel(element.column_name, modelTable.table_name, null) ? 'Uncheck to remove from data model' : 'Check to add to data model', placement: 'top' }" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </template>
                                    </draggable>
                                        </div>
                                    </Transition>
                                </div>
                            </div>
                        </div>
                    </Transition>
                </div>
            </div>
            <div class="w-full md:w-1/2 flex h-full flex-col">
                <h2 class="font-bold text-center mb-5">Data Model</h2>
                <div class="w-full border border-primary-blue-100 border-solid draggable rounded-lg" id="data-model-container">
                    <div class="flex flex-col p-5">
                        <div class="flex flex-row justify-center bg-gray-300 text-center font-bold p-1 mb-2 rounded-lg">
                            <h4 class="w-full font-bold">
                                <input type="text" class="border border-primary-blue-100 border-solid p-2 rounded"
                                    placeholder="Enter Data Table Name" v-model="state.data_table.table_name" />
                            </h4>
                        </div>
                        
                        <!-- Issue #361: Layer Selector -->
                        <div class="mb-4 px-2 cursor-pointer">
                            <label class="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                <span>Data Layer (Medallion Architecture)</span>
                                <button
                                    @click="state.showLayerWalkthrough = true"
                                    type="button"
                                    class="text-primary-blue-600 hover:text-primary-blue-700 transition-colors cursor-pointer"
                                    title="Learn about data layers"
                                >
                                    <font-awesome-icon :icon="['fas', 'circle-question']" class="text-base" />
                                </button>
                            </label>
                            <DataModelLayerSelector
                                v-model="state.selected_layer"
                                :disabled="readOnly"
                                placeholder="Select layer (optional)"
                                :allowNoLayer="true"
                            />
                            <p class="text-xs text-gray-500 mt-1">
                                Classify your data quality: Raw Data (Bronze), Clean Data (Silver), or Business Ready (Gold)
                            </p>
                        </div>
                        <draggable class="min-h-1000 bg-gray-100 rounded-lg" :list="safeDataTableColumns" :group="readOnly ? 'disabled' : 'tables'"
                            :disabled="readOnly" @change="changeDataModel" itemKey="name">
                            <template #header>
                                <div
                                    class="w-3/4 border border-gray-400 border-dashed h-10 flex text-center self-center items-center font-bold m-auto p-5 mt-5 mb-5 text-gray-500 rounded-lg">
                                    Drag columns from the tables given in the left into this area to build your data
                                    model.
                                </div>
                            </template>
                            <template #item="{ element, index }">
                                <div class="cursor-pointer p-1 ml-2 mr-2">
                                    <div class="flex flex-col rounded-lg" :class="{
                                        'bg-gray-200': index % 2 === 0,
                                    }">
                                        <div class="m-2 rounded-lg overflow-hidden ring-1 ring-primary-blue-100 ring-inset">
                                            <table class="w-full">
                                                <thead>
                                                    <tr>
                                                        <th
                                                            class="bg-blue-100 border border-primary-blue-100 border-solid p-2 text-center font-bold rounded-tl">
                                                            Table Name
                                                        </th>
                                                        <th
                                                            class="bg-blue-100 border border-primary-blue-100 border-solid p-2 text-center font-bold ">
                                                            Column Name
                                                        </th>
                                                        <th
                                                            class="bg-blue-100 border border-primary-blue-100 border-solid p-2 text-center font-bold rounded-tr">
                                                            Column Data Type
                                                        </th>
                                                    </tr>
                                                    <tr
                                                        class="border border-primary-blue-100 border-solid p-2 text-center font-bold">
                                                        <td
                                                            class="border border-primary-blue-100 border-solid p-2 text-center wrap-anywhere">
                                                            {{ element.table_logical_name || getTableLogicalName(element.schema, element.table_name) }}
                                                            <span v-if="(element.table_logical_name || getTableLogicalName(element.schema, element.table_name)) !== element.table_name" class="block text-xs text-gray-600 mt-1">
                                                                ({{ element.table_name }})
                                                            </span>
                                                        </td>
                                                        <td
                                                            class="border border-primary-blue-100 border-solid p-2 text-center wrap-anywhere">
                                                            {{ element.column_name }}
                                                        </td>
                                                        <td
                                                            class="border border-primary-blue-100 border-solid p-2 text-center wrap-anywhere">
                                                            {{ element.data_type }}
                                                        </td>

                                                    </tr>
                                                </thead>
                                            </table>

                                        </div>
                                        <div class="m-2 rounded-lg overflow-hidden ring-1 ring-primary-blue-100 ring-inset">
                                            <table class="w-full">
                                                <thead>
                                                    <tr>
                                                        <th v-if="state.viewMode === 'advanced'"
                                                            class="bg-blue-100 border border-primary-blue-100 border-solid p-2 text-center font-bold ">
                                                            Transform Function
                                                        </th>
                                                        <th
                                                            class="bg-blue-100 border border-primary-blue-100 border-solid p-2 text-center font-bold ">
                                                            Column Alias Name
                                                        </th>
                                                        <th
                                                            class="bg-blue-100 border border-primary-blue-100 border-solid p-2 text-center font-bold ">
                                                            Actions
                                                        </th>
                                                    </tr>
                                                    <tr
                                                        class="border border-primary-blue-100 border-solid p-2 text-center font-bold">
                                                        <td v-if="state.viewMode === 'advanced'"
                                                            class="border border-primary-blue-100 border-solid p-2 text-center">
                                                            <div class="flex flex-col mr-2">
                                                                <select :disabled="readOnly"
                                                                    :class="[
                                                                        'w-full border border-primary-blue-100 border-solid p-2 rounded-lg',
                                                                        readOnly ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                                                                    ]"
                                                                    v-model="element.transform_function"
                                                                    @change="onTransformChange(element, $event)">
                                                                    <option v-for="func in state.transform_functions"
                                                                        :key="func.value" :value="func.value">
                                                                        {{ func.name }}
                                                                    </option>
                                                                </select>
                                                            </div>
                                                        </td>
                                                        <td
                                                            class="border border-primary-blue-100 border-solid p-2 text-center">
                                                            <input type="text" :disabled="readOnly"
                                                                :class="[
                                                                    'w-full border border-primary-blue-100 border-solid p-2 rounded-lg',
                                                                    readOnly ? 'cursor-not-allowed opacity-50' : ''
                                                                ]"
                                                                placeholder="Enter Column Alias Name"
                                                                v-model="element.alias_name"
                                                                @input="element.alias_name = element.alias_name.replace(/\s/g, '_').toLowerCase()" />
                                                        </td>
                                                        <td
                                                            class="border border-primary-blue-100 border-solid p-2 text-center">
                                                            <div class="flex flex-col justify-between">
                                                                <input type="checkbox" :disabled="readOnly"
                                                                    :class="readOnly ? 'cursor-not-allowed scale-150 mb-2' : 'cursor-pointer scale-150 mb-2'"
                                                                    v-model="element.is_selected_column"
                                                                    v-tippy="{ content: element.is_selected_column ? 'Uncheck to prevent the column from being added to the data model' : 'Check to add the column to the data model', placement: 'top' }" />
                                                                
                                                                <!-- Warning for columns selected but hidden by aggregates -->
                                                                <div v-if="element.is_selected_column && isColumnUsedInAggregate(element.column_name, element.schema, element.table_name)"
                                                                    class="flex flex-col items-center mb-2">
                                                                    <span class="text-xs px-2 py-1 rounded-md font-semibold bg-orange-100 text-orange-800 border border-orange-300"
                                                                        v-tippy="{ content: 'This column is used in an aggregate function and will NOT appear as a regular column in results. Only aggregated values will be shown.', placement: 'top' }">
                                                                        ⚠️ HIDDEN BY AGGREGATE
                                                                    </span>
                                                                </div>
                                                                
                                                                <!-- Usage badges for hidden columns -->
                                                                <div v-if="!element.is_selected_column && getColumnUsages(element).length > 0" 
                                                                    class="flex flex-wrap gap-1 mb-2 justify-center">
                                                                    <span v-for="usage in getColumnUsages(element)" :key="usage"
                                                                        class="text-xs px-2 py-0.5 rounded-full font-semibold"
                                                                        :class="{
                                                                            'bg-blue-100 text-blue-700': usage === 'group_by',
                                                                            'bg-purple-100 text-purple-700': usage === 'aggregate',
                                                                            'bg-yellow-100 text-yellow-700': usage === 'where',
                                                                            'bg-red-100 text-red-700': usage === 'having',
                                                                            'bg-green-100 text-green-700': usage === 'order_by',
                                                                            'bg-gray-100 text-gray-700': usage === 'calculated'
                                                                        }"
                                                                        v-tippy="{ content: `Used in ${usage.toUpperCase().replace('_', ' ')}`, placement: 'top' }">
                                                                        {{ usage.toUpperCase().replace('_', ' ') }}
                                                                    </span>
                                                                </div>
                                                                
                                                                <div :class="[
                                                                        'h-10 flex items-center self-center mr-2 p-5 font-bold rounded-lg',
                                                                        readOnly ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-red-500 hover:bg-red-300 cursor-pointer text-white'
                                                                    ]"
                                                                    @click="!readOnly && deleteColumn(element.column_name)">
                                                                    Delete
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                </thead>
                                            </table>
                                        </div>
                                    </div>
                                    <div class="w-full h-[3px] bg-blue-200 mt-4"></div>
                                </div>
                            </template>
                            <template #footer>
                                <div class="p-5">
                                    <h2 v-if="state.data_table.calculated_columns.length">Calculated Fields</h2>
                                    <div v-for="(calculated_column, index) in state.data_table.calculated_columns"
                                        class="flex flex-row justify-between">
                                        <div class="flex flex-col w-full mr-2">
                                            <h5 class="font-bold mb-2">Calculated Column Name</h5>
                                            <input type="text"
                                                class="w-full border border-primary-blue-100 border-solid p-2 rounded-lg"
                                                placeholder="Enter Calculated Column Name"
                                                v-model="calculated_column.column_name" disabled />
                                            <div class="flex flex-col mt-2">
                                                <h5 class="font-bold mb-2">Expression</h5>
                                                <input type="text"
                                                    class="w-full border border-primary-blue-100 border-solid p-2 rounded-lg"
                                                    placeholder="Enter Expression"
                                                    v-model="calculated_column.expression" disabled />
                                            </div>
                                        </div>
                                        <div :class="[
                                                'h-10 flex items-center self-center mr-2 mt-8 p-5 font-bold rounded-lg',
                                                readOnly ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-red-500 hover:bg-red-300 cursor-pointer text-white'
                                            ]"
                                            @click="!readOnly && deleteCalculatedColumn(index)">
                                            Delete
                                        </div>

                                    </div>
                                    
                                    <!-- Aggregate Expressions Section - Separate from GROUP BY -->
                                    <div v-if="state.data_table.query_options?.group_by?.aggregate_expressions?.length > 0" class="w-full flex flex-col mt-5">
                                        <h3 class="font-bold mb-2">Aggregate Expressions</h3>
                                        <div class="bg-purple-50 border-l-4 border-purple-400 p-4 mb-4 rounded-r-lg">
                                            <div class="flex items-start">
                                                <font-awesome-icon :icon="['fas', 'circle-info']" class="h-5 w-5 text-purple-400 mt-0.5 mr-3 flex-shrink-0" />
                                                <div>
                                                    <p class="text-sm text-purple-700 font-medium">
                                                        <strong>Complex Aggregates:</strong> Create custom aggregate calculations from expressions (e.g., SUM(quantity * price), COUNT(CASE WHEN...))
                                                    </p>
                                                    <p class="text-xs text-purple-600 mt-1">
                                                        Use this for aggregates that involve multiple columns or conditional logic.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div class="flex flex-col bg-gray-100 p-5 rounded-lg">
                                            <!-- Show existing aggregate expressions -->
                                            <div v-if="state.data_table.query_options.group_by?.aggregate_expressions && state.data_table.query_options.group_by.aggregate_expressions.length > 0">
                                                <div v-for="(expr, index) in state.data_table.query_options.group_by.aggregate_expressions"
                                                    :key="index"
                                                    class="bg-white p-3 mb-3 rounded-lg border border-gray-300 shadow-sm">
                                                    <div class="flex flex-row justify-between items-start">
                                                        <div class="flex flex-col w-3/5 mr-2">
                                                            <h5 class="font-bold mb-2">Expression</h5>
                                                            <input type="text" :disabled="readOnly"
                                                                :class="[
                                                                    'w-full border border-primary-blue-100 border-solid p-2 rounded-lg',
                                                                    readOnly ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                                                                ]"
                                                                v-model="expr.expression"
                                                                placeholder="e.g., SUM(quantity * price) or COUNT(CASE WHEN status = 'active' THEN 1 END)" />
                                                            <span class="text-xs text-gray-600 mt-1">
                                                                Complete SQL expression including aggregate function (SUM, AVG, COUNT, MIN, MAX, etc.)
                                                            </span>
                                                        </div>

                                                        <div class="flex flex-col w-2/5 mr-2">
                                                            <h5 class="font-bold mb-2">Alias</h5>
                                                            <input type="text" :disabled="readOnly"
                                                                :class="[
                                                                    'w-full border border-primary-blue-100 border-solid p-2 rounded-lg',
                                                                    readOnly ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                                                                ]"
                                                                v-model="expr.column_alias_name"
                                                                @input="expr.column_alias_name = expr.column_alias_name.replace(/\s/g, '_').toLowerCase()"
                                                                placeholder="e.g., total_revenue" />
                                                        </div>

                                                        <div class="flex items-center pt-8">
                                                            <div :class="[
                                                                    'h-10 flex items-center px-5 py-2 font-bold rounded-lg whitespace-nowrap',
                                                                    readOnly ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-red-500 hover:bg-red-300 cursor-pointer text-white'
                                                                ]"
                                                                @click="!readOnly && removeAggregateExpression(index)">
                                                                Delete
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div v-if="showWhereClause" class="w-full flex flex-col mt-5">
                                        <h3 class="font-bold mb-2">Where</h3>
                                        <div class="flex flex-col bg-gray-100 p-5 rounded-lg">
                                            <div v-for="(clause, index) in state.data_table.query_options.where"
                                                class="flex flex-col sm:flex-row flex-wrap gap-x-2 mb-3 last:mb-0">
                                                <div v-if="Number(index) > 0" class="flex flex-col w-full mr-2">
                                                    <h5 class="font-bold mb-2">Condition</h5>
                                                    <select :disabled="readOnly"
                                                        :class="[
                                                            'w-full border border-primary-blue-100 border-solid p-2',
                                                            readOnly ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                                                        ]"
                                                        v-model="clause.condition"
                                                        @change="handleQueryOptionChanged('where-condition')">
                                                        <option v-for="(condition, index) in state.condition"
                                                            :key="index" :value="index">{{ condition }}</option>
                                                    </select>
                                                </div>
                                                <div class="flex flex-col w-full mr-2">
                                                    <h5 class="font-bold mb-2">Column</h5>
                                                    <select :disabled="readOnly"
                                                        :class="[
                                                            'w-full border border-primary-blue-100 border-solid p-2',
                                                            readOnly ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                                                        ]"
                                                        v-model="clause.column" @change="whereColumnChanged">
                                                        <option v-for="col in whereColumns" :key="col.value"
                                                            :value="col.value">
                                                            {{ col.display }}
                                                        </option>
                                                    </select>
                                                </div>
                                                <div class="flex flex-col w-full mr-2">
                                                    <h5 class="font-bold mb-2">Equality</h5>
                                                    <select :disabled="readOnly"
                                                        :class="[
                                                            'w-full border border-primary-blue-100 border-solid p-2',
                                                            readOnly ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                                                        ]"
                                                        v-model="clause.equality"
                                                        @change="handleQueryOptionChanged('where-equality')">
                                                        <option v-for="(equality, index) in state.equality" :key="index"
                                                            :value="index">{{ equality }}</option>
                                                    </select>
                                                </div>
                                                <div class="flex flex-col w-full mr-2">
                                                    <h5 class="font-bold mb-2">Value</h5>
                                                    <input 
                                                        :type="clause.column_data_type && (clause.column_data_type === 'numeric' || clause.column_data_type === 'integer' || clause.column_data_type === 'bigint' || clause.column_data_type === 'double precision' || clause.column_data_type === 'real') ? 'number' : 'text'"
                                                        :disabled="readOnly"
                                                        :class="[
                                                            'w-full border border-primary-blue-100 border-solid p-2 rounded-lg',
                                                            readOnly ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                                                        ]"
                                                        v-model="clause.value"
                                                        @blur="handleQueryOptionChanged('where-value')"
                                                        :placeholder="getValuePlaceholder(clause.equality)" />
                                                    <span
                                                        v-if="state.equality[clause.equality] === 'IN' || state.equality[clause.equality] === 'NOT IN'"
                                                        class="text-xs text-gray-600 mt-1">
                                                        Format: 'value1','value2','value3'
                                                    </span>
                                                </div>
                                                <div :class="[
                                                        'h-10 flex items-center self-center mr-2 p-5 font-bold sm:mt-8 rounded-lg',
                                                        readOnly ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-red-500 hover:bg-red-300 cursor-pointer text-white'
                                                    ]"
                                                    @click="!readOnly && removeQueryOption('WHERE', index)">
                                                    Delete
                                                </div>
                                                <div v-if="index === state.data_table.query_options.where.length - 1"
                                                    :class="[
                                                        'h-10 flex items-center self-center mr-2 p-5 font-bold sm:mt-8 rounded-lg',
                                                        readOnly ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-300 cursor-pointer text-white'
                                                    ]"
                                                    @click="!readOnly && addQueryOption('WHERE')">
                                                    Add
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <!-- GROUP BY Columns Section -->
                                    <div v-if="showGroupByClause" class="w-full flex flex-col mt-5">
                                        <h3 class="font-bold mb-2">GROUP BY Columns</h3>
                                        <div class="bg-green-50 border-l-4 border-green-400 p-4 mb-4 rounded-r-lg">
                                            <div class="flex items-start">
                                                <font-awesome-icon :icon="['fas', 'circle-info']" class="h-5 w-5 text-green-400 mt-0.5 mr-3 flex-shrink-0" />
                                                <div>
                                                    <p class="text-sm text-green-700 font-medium">
                                                        <strong>GROUP BY:</strong> Columns that your results will be grouped by. Each unique combination of these columns will produce one row in the output.
                                                    </p>
                                                    <p class="text-xs text-green-600 mt-1">
                                                        These columns are auto-detected from your selected columns, but you can manually add or remove them.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="flex flex-col bg-gray-100 p-5 rounded-lg">
                                            <!-- Current GROUP BY columns -->
                                            <div v-if="state.data_table.query_options?.group_by?.group_by_columns?.length > 0" class="flex flex-wrap gap-2 mb-3">
                                                <div v-for="(col, index) in state.data_table.query_options.group_by.group_by_columns"
                                                    :key="index"
                                                    class="flex items-start bg-white border border-green-300 rounded-lg px-3 py-2 shadow-sm min-w-0 max-w-full">
                                                    <div class="flex flex-col min-w-0 mr-2">
                                                        <span class="text-sm text-gray-700 break-all">{{ col.split('.').pop() }}</span>
                                                        <span class="text-xs text-gray-400 break-all" :title="col">{{ col }}</span>
                                                    </div>
                                                    <div v-if="!readOnly"
                                                        class="text-red-400 hover:text-red-600 cursor-pointer ml-1 font-bold flex-shrink-0"
                                                        @click="removeGroupByColumn(index)"
                                                        title="Remove from GROUP BY">
                                                        &times;
                                                    </div>
                                                </div>
                                            </div>
                                            <div v-else class="text-sm text-gray-500 mb-3 italic">
                                                No GROUP BY columns added. Add columns below to group your results.
                                            </div>
                                            
                                            <!-- Add column dropdown -->
                                            <div class="w-full min-w-0">
                                                <select :disabled="readOnly || availableGroupByColumns.length === 0"
                                                    :class="[
                                                        'w-full min-w-0 border border-green-300 border-solid p-2 rounded-lg',
                                                        readOnly || availableGroupByColumns.length === 0 ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                                                    ]"
                                                    @change="addGroupByColumn($event)">
                                                    <option value="" selected>+ Add column to GROUP BY...</option>
                                                    <option v-for="col in availableGroupByColumns"
                                                        :key="col.value"
                                                        :value="col.value">
                                                        {{ col.display }}
                                                    </option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <div v-if="showGroupByClause" class="w-full flex flex-col mt-5">
                                        <h3 class="font-bold mb-2">Aggregate Functions</h3>
                                        <!-- Aggregate Function Disclaimer -->
                                        <div class="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4 rounded-r-lg">
                                            <div class="flex items-start">
                                                <font-awesome-icon :icon="['fas', 'circle-info']" class="h-5 w-5 text-blue-400 mt-0.5 mr-3 flex-shrink-0" />
                                                <div>
                                                    <p class="text-sm text-blue-700 font-medium">
                                                        <strong>Note:</strong> Columns used in aggregate functions (SUM, AVG, COUNT, etc.) will not appear as individual values in your results.
                                                    </p>
                                                    <p class="text-xs text-blue-600 mt-1">
                                                        Only the calculated aggregate values (e.g., total_sales, count_status) will be shown alongside your GROUP BY columns.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="flex flex-col bg-gray-100 p-5 rounded-lg">
                                            <div
                                                v-for="(clause, index) in state.data_table.query_options.group_by.aggregate_functions">
                                                <div class="flex flex-col">
                                                    <div class="flex flex-col sm:flex-row flex-wrap gap-x-2">
                                                        <div class="flex flex-col w-full sm:w-1/3 mr-2">
                                                            <h5 class="font-bold mb-2">Aggregate Function</h5>
                                                            <select :disabled="readOnly"
                                                                :class="[
                                                                    'w-full border border-primary-blue-100 border-solid p-2',
                                                                    readOnly ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                                                                ]"
                                                                v-model="clause.aggregate_function"
                                                                @change="aggregateFunctionChanged">
                                                                <option
                                                                    v-for="(aggregate_function, index) in state.aggregate_functions"
                                                                    :key="index" :value="index">{{ aggregate_function }}
                                                                </option>
                                                            </select>
                                                        </div>
                                                        <div class="flex flex-col w-full sm:w-1/3 mr-2">
                                                            <h5 class="font-bold mb-2">Column</h5>
                                                            <select :disabled="readOnly"
                                                                :class="[
                                                                    'w-full border border-primary-blue-100 border-solid p-2',
                                                                    readOnly ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                                                                ]"
                                                                v-model="clause.column"
                                                                @change="aggregateFunctionColumnChanged">
                                                                <option v-for="col in whereColumns"
                                                                    :key="col.value"
                                                                    :value="col.value">
                                                                    {{ col.display }}
                                                                </option>
                                                            </select>
                                                        </div>
                                                        <div class="flex flex-col w-full sm:w-1/4 mr-2">
                                                            <h5 class="font-bold mb-2">Column Alias Name</h5>
                                                            <input type="text" :disabled="readOnly"
                                                                :class="[
                                                                    'w-full border border-primary-blue-100 border-solid p-2 rounded-lg',
                                                                    readOnly ? 'cursor-not-allowed opacity-50' : ''
                                                                ]"
                                                                placeholder="Enter Column Alias Name"
                                                                v-model="clause.column_alias_name"
                                                                @input="clause.column_alias_name = clause.column_alias_name.replace(/\s/g, '_').toLowerCase()" />
                                                        </div>
                                                        <Transition
                                                            enter-active-class="transition-all duration-300 ease-out"
                                                            leave-active-class="transition-all duration-200 ease-in"
                                                            enter-from-class="opacity-0 -translate-x-4"
                                                            enter-to-class="opacity-100 translate-x-0"
                                                            leave-from-class="opacity-100 translate-x-0"
                                                            leave-to-class="opacity-0 translate-x-4">
                                                            <div v-if="state.viewMode === 'advanced'"
                                                                class="flex flex-col w-1/12 mr-2">
                                                                <h5 class="font-bold mb-2">DISTINCT</h5>
                                                                <div class="flex items-center justify-center h-full">
                                                                    <input type="checkbox" :disabled="readOnly"
                                                                        :class="readOnly ? 'cursor-not-allowed scale-150' : 'cursor-pointer scale-150'"
                                                                        v-model="clause.use_distinct"
                                                                        v-tippy="{ content: 'Apply DISTINCT to eliminate duplicate values', placement: 'top' }" />
                                                                </div>
                                                            </div>
                                                        </Transition>
                                                    </div>
                                                    <div class="flex flex-row justify-end w-full mt-2">
                                                        <div :class="[
                                                                'h-10 flex items-center self-center mr-2 p-5 font-bold rounded-lg',
                                                                readOnly ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-red-500 hover:bg-red-300 cursor-pointer text-white'
                                                            ]"
                                                            @click="!readOnly && removeQueryOption('GROUP BY', index)">
                                                            Delete
                                                        </div>
                                                        <div v-if="index === state.data_table.query_options.group_by.aggregate_functions.length - 1"
                                                            :class="[
                                                                'h-10 flex items-center self-center mr-2 p-5 font-bold rounded-lg',
                                                                readOnly ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-300 cursor-pointer text-white'
                                                            ]"
                                                            @click="!readOnly && addQueryOption('GROUP BY')">
                                                            Add
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <!-- Add first aggregate function button - shows when list is empty -->
                                            <div v-if="!state.data_table.query_options.group_by.aggregate_functions || state.data_table.query_options.group_by.aggregate_functions.length === 0"
                                                class="flex justify-center mt-2">
                                                <div :class="[
                                                        'h-10 flex items-center self-center p-5 font-bold rounded-lg border-2 border-dashed',
                                                        readOnly ? 'border-gray-300 text-gray-500 cursor-not-allowed' : 'border-blue-400 text-blue-500 hover:bg-blue-50 cursor-pointer'
                                                    ]"
                                                    @click="!readOnly && addQueryOption('GROUP BY')">
                                                    + Add Aggregate Function
                                                </div>
                                            </div>

                                            <!-- HAVING Section - Always show when GROUP BY exists -->
                                            <div v-if="showGroupByClause" class="mt-4">
                                                <h4 class="font-bold mb-2">
                                                    Having
                                                    <span class="text-sm font-normal text-gray-600 ml-2">(Filter aggregate
                                                        results)</span>
                                                </h4>
                                                
                                                <!-- Show existing HAVING clauses -->
                                                <div v-if="state.data_table.query_options.group_by.having_conditions && state.data_table.query_options.group_by.having_conditions.length > 0"
                                                    v-for="(clause, index) in state.data_table.query_options.group_by.having_conditions">
                                                    <div class="flex flex-col">
                                                        <div class="flex flex-col sm:flex-row flex-wrap gap-x-2">
                                                            <div v-if="Number(index) > 0" class="flex flex-col w-full sm:w-auto mr-2">
                                                                <h5 class="font-bold mb-2">Condition</h5>
                                                                <select
                                                                    class="w-full border border-primary-blue-100 border-solid p-2 cursor-pointer rounded-lg"
                                                                    v-model="clause.condition"
                                                                    @change="handleQueryOptionChanged('having-condition')">
                                                                    <option v-for="(condition, index) in state.condition"
                                                                        :key="index" :value="index">{{ condition }}</option>
                                                                </select>
                                                            </div>
                                                            <div class="flex flex-col w-full mr-2">
                                                                <h5 class="font-bold mb-2">Aggregate Column</h5>
                                                                <select
                                                                    class="w-full border border-primary-blue-100 border-solid p-2 cursor-pointer rounded-lg"
                                                                    v-model="clause.column" 
                                                                    @change="havingColumnChanged($event); handleQueryOptionChanged('having-column')">
                                                                    <optgroup label="Aggregate Columns">
                                                                        <option v-for="col in havingColumns"
                                                                            :key="col.value" :value="col.value">
                                                                            {{ col.display }}
                                                                        </option>
                                                                    </optgroup>
                                                                    <optgroup v-if="whereColumns.length > 0"
                                                                        label="Base Columns (use WHERE instead)">
                                                                        <option v-for="col in whereColumns" :key="col.value"
                                                                            :value="col.value" disabled>
                                                                            {{ col.display }}
                                                                        </option>
                                                                    </optgroup>
                                                                </select>
                                                            </div>
                                                            <div class="flex flex-col w-full mr-2">
                                                                <h5 class="font-bold mb-2">Equality</h5>
                                                                <select :disabled="readOnly"
                                                                    :class="[
                                                                        'w-full border border-primary-blue-100 border-solid p-2 rounded-lg',
                                                                        readOnly ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                                                                    ]"
                                                                    v-model="clause.equality"
                                                                    @change="handleQueryOptionChanged('having-equality')">
                                                                    <option v-for="(equality, index) in state.equality"
                                                                        :key="index" :value="index">{{ equality }}</option>
                                                                </select>
                                                            </div>
                                                            <div class="flex flex-col w-full mr-2">
                                                                <h5 class="font-bold mb-2">Value</h5>
                                                                <input type="text" :disabled="readOnly"
                                                                    :class="[
                                                                        'w-full border border-primary-blue-100 border-solid p-2 rounded-lg',
                                                                        readOnly ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                                                                    ]"
                                                                    v-model="clause.value"
                                                                    @blur="handleQueryOptionChanged('having-value')" />
                                                            </div>
                                                        </div>
                                                        <div class="flex flex-row justify-end w-full mt-2">
                                                            <div :class="[
                                                                    'h-10 flex items-center self-center mr-2 p-5 font-bold rounded-lg',
                                                                    readOnly ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-red-500 hover:bg-red-300 cursor-pointer text-white'
                                                                ]"
                                                                @click="!readOnly && removeQueryOption('HAVING', index)">
                                                                Delete
                                                            </div>
                                                            <div v-if="index === state.data_table.query_options.group_by.having_conditions.length - 1"
                                                                :class="[
                                                                    'h-10 flex items-center self-center mr-2 p-5 font-bold rounded-lg',
                                                                    readOnly ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-300 cursor-pointer text-white'
                                                                ]"
                                                                @click="!readOnly && addQueryOption('HAVING')">
                                                                Add
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <!-- Show "Add HAVING" button when no clauses exist -->
                                                <div v-if="!state.data_table.query_options.group_by.having_conditions || state.data_table.query_options.group_by.having_conditions.length === 0">
                                                    <div :class="[
                                                            'w-full border border-blue-400 border-dashed h-12 flex items-center justify-center font-bold text-blue-600 rounded-lg',
                                                            readOnly ? 'cursor-not-allowed bg-gray-50 text-gray-400' : 'cursor-pointer hover:bg-blue-50'
                                                        ]"
                                                        @click="!readOnly && addQueryOption('HAVING')">
                                                        + Add HAVING Condition
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div v-if="showOrderByClause" class="w-full flex flex-col mt-5">
                                        <h3 class="font-bold mb-2">Order By</h3>
                                        <div class="flex flex-col bg-gray-100 p-5 rounded-lg">
                                            <div v-for="(clause, index) in state.data_table.query_options.order_by"
                                                class="flex flex-col sm:flex-row flex-wrap gap-x-2 mb-3 last:mb-0">
                                                <div class="flex flex-col w-full mr-2">
                                                    <h5 class="font-bold mb-2">Column</h5>
                                                    <select :disabled="readOnly"
                                                        :class="[
                                                            'w-full border border-primary-blue-100 border-solid p-2 rounded-lg',
                                                            readOnly ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                                                        ]"
                                                        v-model="clause.column"
                                                        @change="handleQueryOptionChanged('order-by-column')">
                                                        <option value="">Select column to order by</option>
                                                        <optgroup label="Regular Columns">
                                                            <option v-for="col in orderByColumns.filter((c: any) => !c.is_aggregate && c.type !== 'calculated_column')" 
                                                                :key="col.value"
                                                                :value="col.value">
                                                                {{ col.display }}
                                                            </option>
                                                        </optgroup>
                                                        <optgroup v-if="orderByColumns.filter((c: any) => c.type === 'calculated_column').length > 0"
                                                            label="Calculated Columns">
                                                            <option v-for="col in orderByColumns.filter((c: any) => c.type === 'calculated_column')" 
                                                                :key="col.value"
                                                                :value="col.value">
                                                                {{ col.display }}
                                                            </option>
                                                        </optgroup>
                                                        <optgroup v-if="orderByColumns.filter((c: any) => c.is_aggregate).length > 0"
                                                            label="Aggregates">
                                                            <option v-for="col in orderByColumns.filter((c: any) => c.is_aggregate)" 
                                                                :key="col.value"
                                                                :value="col.value">
                                                                {{ col.display }}
                                                            </option>
                                                        </optgroup>
                                                    </select>
                                                </div>
                                                <div class="flex flex-col w-full mr-2">
                                                    <h5 class="font-bold mb-2">Order</h5>
                                                    <select :disabled="readOnly"
                                                        :class="[
                                                            'w-full border border-primary-blue-100 border-solid p-2 rounded-lg',
                                                            readOnly ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                                                        ]"
                                                        v-model="clause.order"
                                                        @change="handleQueryOptionChanged('order-by-order')">
                                                        <option v-for="(order, index) in state.order" :key="index"
                                                            :value="index">{{ order }}</option>
                                                    </select>
                                                </div>
                                                <div :class="[
                                                        'h-10 flex items-center self-center mr-2 p-5 font-bold sm:mt-8 rounded-lg',
                                                        readOnly ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-red-500 hover:bg-red-300 cursor-pointer text-white'
                                                    ]"
                                                    @click="!readOnly && removeQueryOption('ORDER BY', index)">
                                                    Delete
                                                </div>
                                                <div v-if="index === state.data_table.query_options.order_by.length - 1"
                                                    :class="[
                                                        'h-10 flex items-center self-center mr-2 p-5 font-bold sm:mt-8 rounded-lg',
                                                        readOnly ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-300 cursor-pointer text-white'
                                                    ]"
                                                    @click="!readOnly && addQueryOption('ORDER BY')">
                                                    Add
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div v-if="state.data_table.query_options.offset > -1"
                                        class="w-full flex flex-col mt-5">
                                        <h3 class="font-bold">Offset</h3>
                                        <div class="flex flex-col bg-gray-100 p-5 rounded-lg">
                                            <div class="flex flex-row justify-between">
                                                <div class="flex flex-col w-full mr-2">
                                                    <h5 class="font-bold mb-2">Value</h5>
                                                    <div class="flex flex-row justify-between">
                                                        <input type="number" :disabled="readOnly"
                                                            :class="[
                                                                'w-full border border-primary-blue-100 border-solid p-2 rounded-lg',
                                                                readOnly ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                                                            ]"
                                                            v-model="state.data_table.query_options.offset" min="0" />
                                                        <div :class="[
                                                                'h-10 flex items-center self-center ml-2 mr-2 p-5 font-bold rounded-lg',
                                                                readOnly ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-red-500 hover:bg-red-300 cursor-pointer text-white'
                                                            ]"
                                                            @click="!readOnly && removeQueryOption('OFFSET', 0)">
                                                            Delete
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div v-if="state.data_table.query_options.limit > -1"
                                        class="w-full flex flex-col mt-5">
                                        <h3 class="font-bold">Limit</h3>
                                        <div class="flex flex-col bg-gray-100 p-5 rounded-lg">
                                            <!-- Tier limit info -->
                                            <div class="text-sm mb-3 p-3 rounded-lg" :class="isUnlimitedTier ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-blue-50 text-blue-700 border border-blue-200'">
                                                <font-awesome :icon="isUnlimitedTier ? 'fas fa-infinity' : 'fas fa-info-circle'" class="mr-2" />
                                                <template v-if="isUnlimitedTier">
                                                    Your <strong>{{ userTierName }}</strong> tier has unlimited rows per data model.
                                                </template>
                                                <template v-else>
                                                    Your <strong>{{ userTierName }}</strong> tier allows up to <strong>{{ userRowLimit.toLocaleString() }}</strong> rows per data model.
                                                </template>
                                            </div>
                                            
                                            <div class="flex flex-row justify-between">
                                                <div class="flex flex-col w-full mr-2">
                                                    <h5 class="font-bold mb-2">Value</h5>
                                                    <div class="flex flex-row justify-between">
                                                        <input type="number" :disabled="readOnly"
                                                            :class="[
                                                                'w-full border border-primary-blue-100 border-solid p-2 rounded-lg',
                                                                readOnly ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                                                            ]"
                                                            v-model="state.data_table.query_options.limit" 
                                                            min="1" 
                                                            :max="userRowLimit"
                                                            @input="enforceLimitRestriction"
                                                            :placeholder="`Maximum: ${userRowLimit.toLocaleString()}`" />
                                                        <div :class="[
                                                                'h-10 flex items-center self-center ml-2 mr-2 p-5 font-bold rounded-lg',
                                                                readOnly ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-red-500 hover:bg-red-300 cursor-pointer text-white'
                                                            ]"
                                                            @click="!readOnly && removeQueryOption('LIMIT', 0)">
                                                            Delete
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div v-if="showDataModelControls"
                                        :class="[
                                            'w-full border border-gray-400 border-dashed h-15 flex items-center justify-center mb-5 mt-5 font-bold rounded-lg',
                                            readOnly ? 'cursor-not-allowed bg-gray-100 text-gray-400' : 'cursor-pointer hover:bg-gray-100'
                                        ]"
                                        @click="!readOnly && openDialog()">
                                        + Add Query Clause (for example: where, group by, order by)
                                    </div>
                                    <div v-if="showDataModelControls"
                                        :class="[
                                            'w-full border border-gray-400 border-dashed h-15 flex items-center justify-center mb-5 mt-5 font-bold rounded-lg',
                                            readOnly ? 'cursor-not-allowed bg-gray-100 text-gray-400' : 'cursor-pointer hover:bg-gray-100'
                                        ]"
                                        @click="!readOnly && openCalculatedColumnDialog()">
                                        + Add Calculated Column/Field
                                    </div>
                                    <div v-if="showDataModelControls"
                                        :class="[
                                            'w-full border border-purple-400 border-dashed h-15 flex items-center justify-center mb-5 mt-5 font-bold rounded-lg',
                                            readOnly ? 'cursor-not-allowed bg-gray-100 text-gray-400' : 'cursor-pointer hover:bg-purple-50'
                                        ]"
                                        @click="!readOnly && addAggregateExpression()">
                                        + Add Aggregate Expression
                                    </div>
                                    <template v-if="showDataModelControls && saveButtonEnabled && hasTableData">
                                        <div v-if="showDataModelControls"
                                            :class="[
                                                'w-full justify-center text-center items-center self-center mb-5 p-2 font-bold shadow-md select-none',
                                                state.is_saving_model
                                                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                                                    : 'bg-primary-blue-100 text-white hover:bg-primary-blue-300 cursor-pointer'
                                            ]"
                                            @click="!state.is_saving_model && saveDataModel()">
                                            <template v-if="state.is_saving_model">
                                                <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin mr-2" />
                                                Saving...
                                            </template>
                                            <template v-else>
                                                <template v-if="props.isEditDataModel">Update</template><template v-else>Save</template> Data Model
                                            </template>
                                        </div>
                                    </template>
                                    <template v-else-if="showDataModelControls && !hasTableData">
                                        <div
                                            class="w-full justify-center text-center items-center self-center mb-5 p-2 bg-orange-300 text-orange-900 cursor-not-allowed font-bold shadow-md select-none">
                                            Cannot Save - No Data in Tables
                                        </div>
                                    </template>
                                    <template v-else-if="showDataModelControls">
                                        <div
                                            class="w-full justify-center text-center items-center self-center mb-5 p-2 bg-gray-300 text-black cursor-not-allowed font-bold shadow-md select-none">
                                            <template v-if="props.isEditDataModel">Update</template><template
                                                v-else>Save</template> Data Model
                                        </div>
                                    </template>
                                </div>
                            </template>
                        </draggable>
                    </div>
                </div>

            </div>
        </div>
        <overlay-dialog v-if="state.show_dialog" @close="closeDialog">
            <template #overlay>
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    <template v-for="queryOption in state.query_options" :key="queryOption.name">
                        <div :class="[
                                'w-full border border-primary-blue-100 border-solid p-10 font-bold text-center shadow-md select-none rounded-lg',
                                readOnly ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'hover:bg-gray-200 cursor-pointer'
                            ]"
                            @click="!readOnly && addQueryOption(queryOption.name)">
                            {{ queryOption.name }}
                        </div>
                    </template>
                </div>
            </template>
        </overlay-dialog>
        <overlay-dialog v-if="state.show_calculated_column_dialog" :enable-scrolling="false"
            @close="closeCalculatedColumnDialog">
            <template #overlay>
                <div class="flex flex-col border border-primary-blue-100 border-solid p-5 rounded-lg">
                    <h5 class="font-bold mb-2">Column Name</h5>
                    <input type="text" :disabled="readOnly" 
                        :class="[
                            'w-full border border-primary-blue-100 border-solid p-2 rounded-lg',
                            readOnly ? 'cursor-not-allowed opacity-50' : ''
                        ]"
                        v-model="state.calculated_column.column_name" />

                    <!-- Helper text -->
                    <div class="text-sm text-gray-600 bg-blue-50 border border-blue-200 p-3 rounded-lg mt-2 mb-2">
                        <font-awesome icon="fas fa-info-circle" class="mr-2 text-blue-600" />
                        <strong>Tip:</strong> You can use base columns, aggregate columns, and other calculated columns in calculations.
                        Example: Calculate margin as <code class="bg-gray-200 px-1 rounded">profit / revenue * 100</code> where profit is another calculated column.
                    </div>

                    <h5 class="font-bold mb-2 mt-2">Operations<font-awesome icon="fas fa-circle-info"
                            class="text-lg text-black cursor-pointer ml-1"
                            :v-tippy-content="'You can select base columns, aggregate columns, and other calculated columns. Aggregates must be defined first in GROUP BY section.'" />
                    </h5>
                    <div v-for="(column, index) in state.calculated_column.columns">
                        <div v-if="Number(index) > 0" class="flex flex-col w-full mr-2">
                            <h5 class="font-bold mb-2">Operator</h5>
                            <select :disabled="readOnly" 
                                :class="[
                                    'w-full border border-primary-blue-100 border-solid p-2 rounded-lg',
                                    readOnly ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                                ]"
                                v-model="column.operator">
                                <option v-for="(operator, index) in state.add_column_operators" :key="index"
                                    :value="operator">{{ operator }}</option>
                            </select>
                        </div>
                        <div v-if="column.type === 'column'" class="flex flex-col w-full mr-2">
                            <h5 class="font-bold mb-2">Column / Aggregate</h5>
                            <select :disabled="readOnly" 
                                :class="[
                                    'w-full border border-primary-blue-100 border-solid p-2 rounded-lg',
                                    readOnly ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                                ]"
                                v-model="column.column_name">
                                <optgroup label="Base Columns">
                                    <option
                                        v-for="(col, index) in numericColumnsWithAggregates.filter((c: any) => c.type === 'base_column')"
                                        :key="'base_' + index" :value="col.value"
                                        :title="col.display_short !== col.physical_name ? col.physical_name : ''">
                                        {{ col.display }}
                                    </option>
                                </optgroup>
                                <optgroup
                                    v-if="numericColumnsWithAggregates.filter((c: any) => ['aggregate_function', 'aggregate_expression'].includes(c.type)).length > 0"
                                    label="Aggregate Columns">
                                    <option
                                        v-for="(col, index) in numericColumnsWithAggregates.filter((c: any) => ['aggregate_function', 'aggregate_expression'].includes(c.type))"
                                        :key="'agg_' + index" :value="col.value">
                                        {{ col.display }}
                                    </option>
                                </optgroup>
                                <optgroup
                                    v-if="numericColumnsWithAggregates.filter((c: any) => c.type === 'calculated_column').length > 0"
                                    label="Calculated Columns">
                                    <option
                                        v-for="(col, index) in numericColumnsWithAggregates.filter((c: any) => c.type === 'calculated_column')"
                                        :key="'calc_' + index" :value="col.value"
                                        :title="`Expression: ${col.expression}`">
                                        {{ col.display }}
                                    </option>
                                </optgroup>
                            </select>
                        </div>
                        <div v-else-if="column.type === 'numeric-value'" class="flex flex-col w-full mr-2">
                            <h5 class="font-bold mb-2">Numeric Value</h5>
                            <input :disabled="readOnly" 
                                :class="[
                                    'w-full border border-primary-blue-100 border-solid p-2',
                                    readOnly ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                                ]"
                                type="number" v-model="column.numeric_value" />
                        </div>

                        <div class="flex flex-row">
                            <div v-if="Number(index) > 0"
                                :class="[
                                    'flex flex-row justify-center w-full h-10 flex items-center self-center mr-2 p-5 text-center font-bold mt-8 rounded-lg',
                                    readOnly ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-red-500 hover:bg-red-300 cursor-pointer text-white'
                                ]"
                                @click="!readOnly && deleteCalculatedColumnOperation(index)">
                                Delete Column
                            </div>
                            <div v-if="index === state.calculated_column.columns.length - 1"
                                :class="[
                                    'flex flex-row justify-center w-full h-10 flex items-center self-center mr-2 p-5 text-center font-bold mt-8 rounded-lg',
                                    readOnly ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-300 cursor-pointer text-white'
                                ]"
                                @click="!readOnly && addCalculatedColumnOperation('column')">
                                Add Column
                            </div>
                            <div v-if="index === state.calculated_column.columns.length - 1"
                                :class="[
                                    'flex flex-row justify-center w-full h-10 flex items-center self-center mr-2 p-5 text-sm text-center font-bold mt-8 rounded-lg',
                                    readOnly ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-300 cursor-pointer text-white'
                                ]"
                                @click="!readOnly && addCalculatedColumnOperation('numeric-value')">
                                Add Numeric Value
                            </div>
                        </div>
                    </div>

                    <div :class="[
                            'flex flex-row justify-center w-50 h-10 items-center self-center mt-2 p-5 text-sm text-center font-bold select-none rounded-lg',
                            readOnly ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-primary-blue-100 hover:bg-primary-blue-300 cursor-pointer text-white'
                        ]"
                        @click="!readOnly && addCalculatedColumn()">
                        Add Calulated Column
                    </div>
                </div>
            </template>
        </overlay-dialog>

        <!-- AI Data Modeler Drawer -->
        <AiDataModelerDrawer />

        <!-- JOIN Condition Creation Dialog -->
        <div v-if="state.show_join_dialog"
            class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white p-6 w-[600px] shadow-2xl max-h-[90vh] overflow-y-auto">
                <h3 class="text-xl font-bold mb-4 text-gray-800 flex items-center">
                    <font-awesome icon="fas fa-link" class="mr-2 text-green-600" />
                    {{ state.editing_join_index !== null ? 'Edit JOIN Condition' : 'Create JOIN Condition' }}
                </h3>

                <p class="text-sm text-gray-600 mb-4">
                    Define how two tables should be joined together. Select tables and columns that should match.
                </p>

                <!-- JOIN Type Selection -->
                <div class="mb-4">
                    <label class="block mb-2 font-medium text-gray-700">JOIN Type:</label>
                    <select v-model="state.join_form.join_type"
                        class="w-full border border-gray-300 p-2 cursor-pointer focus:border-green-500 focus:ring-1 focus:ring-green-500">
                        <option value="INNER">INNER JOIN - Only matching rows from both tables</option>
                        <option value="LEFT">LEFT JOIN - All rows from left table + matching from right</option>
                        <option value="RIGHT">RIGHT JOIN - All rows from right table + matching from left</option>
                        <option value="FULL OUTER">FULL OUTER JOIN - All rows from both tables</option>
                    </select>
                </div>

                <!-- Primary Operator Selection -->
                <div class="mb-4">
                    <label class="block mb-2 font-medium text-gray-700">Primary Operator:</label>
                    <select v-model="state.join_form.primary_operator"
                        class="w-full border border-gray-300 p-2 cursor-pointer focus:border-green-500 focus:ring-1 focus:ring-green-500">
                        <option value="=">= (Equal to)</option>
                        <option value="!=">!= (Not equal to)</option>
                        <option value=">">&gt; (Greater than)</option>
                        <option value="<">&lt; (Less than)</option>
                        <option value=">=">&gt;= (Greater than or equal)</option>
                        <option value="<=">&lt;= (Less than or equal)</option>
                    </select>
                </div>

                <!-- Left Table Selection -->
                <div class="mb-4">
                    <label class="block mb-2 font-medium text-gray-700">Left Table:</label>
                    <select v-model="state.join_form.left_table" @change="onJoinFormLeftTableChange()"
                        class="w-full border border-gray-300 p-2 cursor-pointer focus:border-green-500 focus:ring-1 focus:ring-green-500">
                        <option value="">-- Select Left Table --</option>
                        <option v-for="table in getAvailableTablesForJoin()" :key="table.value" :value="table.value">
                            {{ table.label }}
                        </option>
                    </select>
                </div>

                <!-- Left Column Selection -->
                <div class="mb-4">
                    <label class="block mb-2 font-medium text-gray-700">Left Column:</label>
                    <select v-model="state.join_form.left_column" :disabled="!state.join_form.left_table"
                        class="w-full border border-gray-300 p-2 cursor-pointer focus:border-green-500 focus:ring-1 focus:ring-green-500 disabled:bg-gray-100">
                        <option value="">-- Select Left Column --</option>
                        <option v-for="col in getColumnsForJoinForm('left')" :key="col.value" :value="col.value">
                            {{ col.label }} ({{ col.data_type }})
                        </option>
                    </select>
                </div>

                <div class="flex justify-center mb-4">
                    <font-awesome icon="fas fa-equals" class="text-3xl text-gray-400" />
                </div>

                <!-- Right Table Selection -->
                <div class="mb-4">
                    <label class="block mb-2 font-medium text-gray-700">Right Table:</label>
                    <select v-model="state.join_form.right_table" @change="onJoinFormRightTableChange()"
                        class="w-full border border-gray-300 p-2 cursor-pointer focus:border-green-500 focus:ring-1 focus:ring-green-500">
                        <option value="">-- Select Right Table --</option>
                        <option v-for="table in getAvailableTablesForJoin()" :key="table.value" :value="table.value">
                            {{ table.label }}
                        </option>
                    </select>
                </div>

                <!-- Right Column Selection -->
                <div class="mb-4">
                    <label class="block mb-2 font-medium text-gray-700">Right Column:</label>
                    <select v-model="state.join_form.right_column" :disabled="!state.join_form.right_table"
                        class="w-full border border-gray-300 p-2 cursor-pointer focus:border-green-500 focus:ring-1 focus:ring-green-500 disabled:bg-gray-100">
                        <option value="">-- Select Right Column --</option>
                        <option v-for="col in getColumnsForJoinForm('right')" :key="col.value" :value="col.value">
                            {{ col.label }} ({{ col.data_type }})
                        </option>
                    </select>
                </div>

                <!-- JOIN Preview -->
                <div class="bg-green-50 border border-green-200 p-3 mb-4">
                    <strong class="text-green-800 block mb-2">SQL Preview:</strong>
                    <div
                        class="font-mono text-sm text-gray-700 bg-white p-2 border border-gray-300 whitespace-pre-wrap break-all wrap-anywhere">
                        {{ getJoinFormPreview() }}
                    </div>
                </div>

                <div class="bg-blue-50 border border-blue-200 p-3 mb-4 text-sm">
                    <strong class="text-blue-800">Tip:</strong>
                    <div class="mt-2 text-gray-700">
                        • Most JOINs use INNER JOIN (only matching rows)<br />
                        • Use LEFT JOIN to keep all rows from the left table even if no match<br />
                        • For self-referencing relationships, use table aliases first
                    </div>
                </div>

                <div class="flex justify-end gap-2">
                    <button @click="closeJoinDialog()"
                        class="px-4 py-2 border border-gray-300 hover:bg-gray-50 transition-colors cursor-pointer">
                        Cancel
                    </button>
                    <button @click="createJoinCondition()" :disabled="!isJoinFormValid()"
                        class="px-4 py-2 bg-green-600 text-white hover:bg-green-700 transition-colors cursor-pointer disabled:bg-gray-400 disabled:cursor-not-allowed">
                        {{ state.editing_join_index !== null ? 'Save Changes' : 'Create JOIN' }}
                    </button>
                </div>
            </div>
        </div>

        <!-- Table Alias Creation Dialog -->
        <div v-if="state.show_alias_dialog"
            class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white p-6 w-96 shadow-2xl">
                <h3 class="text-xl font-bold mb-4 text-gray-800 flex items-center">
                    <font-awesome icon="fas fa-layer-group" class="mr-2 text-blue-600" />
                    Create Table Alias
                </h3>

                <p class="text-sm text-gray-600 mb-4">
                    Table aliases allow you to use the same table multiple times in different roles (e.g., employees and
                    managers from the same users table).
                </p>

                <div class="mb-4">
                    <label class="block mb-2 font-medium text-gray-700">Select Table:</label>
                    <select v-model="state.alias_form.table"
                        class="w-full border border-gray-300 p-2 cursor-pointer focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                        <option value="">-- Select Table --</option>
                        <option v-for="table in state.tables" :key="`${table.schema}.${table.table_name}`"
                            :value="`${table.schema}.${table.table_name}`">
                            {{ table.schema }}.{{ table.logical_name || table.table_name }}
                        </option>
                    </select>
                </div>

                <div class="mb-4">
                    <label class="block mb-2 font-medium text-gray-700">Alias Name:</label>
                    <input v-model="state.alias_form.alias" type="text"
                        placeholder="e.g., employees, managers, requesters"
                        class="w-full border border-gray-300 p-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                    <p class="text-xs text-gray-500 mt-1">
                        <font-awesome icon="fas fa-lightbulb" class="text-yellow-500 mr-1" />
                        Use a descriptive name that reflects the role this table plays in your query
                    </p>
                </div>

                <div class="bg-blue-50 border border-blue-200 p-3 mb-4 text-sm">
                    <strong class="text-blue-800">Example:</strong>
                    <div class="mt-2 text-gray-700">
                        <strong>Table:</strong> users<br />
                        <strong>Alias 1:</strong> "employees" (for employee info)<br />
                        <strong>Alias 2:</strong> "managers" (for manager info)<br />
                        <strong>Join:</strong> employees.manager_id = managers.user_id
                    </div>
                </div>

                <div class="flex justify-end gap-2">
                    <button @click="closeAliasDialog()"
                        class="px-4 py-2 border border-gray-300 hover:bg-gray-50 transition-colors cursor-pointer">
                        Cancel
                    </button>
                    <button @click="createTableAlias()"
                        class="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 transition-colors cursor-pointer">
                        Create Alias
                    </button>
                </div>
            </div>
        </div>

        <!-- Advanced Features Info Dialog -->
        <overlay-dialog v-if="state.show_advanced_features_dialog" @close="toggleAdvancedFeaturesDialog">
            <template #overlay>
                <div class="max-w-2xl mx-auto">
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center gap-3">
                            <font-awesome icon="fas fa-lightbulb" class="text-blue-600 text-3xl" />
                            <h2 class="text-2xl font-bold text-blue-800">Advanced View Features</h2>
                        </div>
                    </div>

                    <div class="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <p class="text-sm text-blue-800">
                            <strong>Advanced View</strong> includes everything in Simple View, plus these powerful features:
                        </p>
                    </div>

                    <div class="space-y-4">
                        <div class="border-l-4 border-blue-500 pl-4 py-2">
                            <h3 class="font-bold text-lg text-gray-800 mb-1">Table Aliases</h3>
                            <p class="text-sm text-gray-600">
                                Create self-referencing relationships (e.g., employees → managers). Essential for queries where a table needs to join to itself.
                            </p>
                        </div>

                        <div class="border-l-4 border-green-500 pl-4 py-2">
                            <h3 class="font-bold text-lg text-gray-800 mb-1">JOIN Conditions Manager</h3>
                            <p class="text-sm text-gray-600">
                                Define custom table relationships with AND/OR logic. Build complex multi-table queries with precise control over how tables connect.
                            </p>
                        </div>

                        <div class="border-l-4 border-purple-500 pl-4 py-2">
                            <h3 class="font-bold text-lg text-gray-800 mb-1">Transform Functions</h3>
                            <p class="text-sm text-gray-600">
                                Apply functions to GROUP BY columns (UPPER, LOWER, DATE_TRUNC, EXTRACT, etc.). Transform data during aggregation for flexible reporting.
                            </p>
                        </div>

                        <div class="border-l-4 border-orange-500 pl-4 py-2">
                            <h3 class="font-bold text-lg text-gray-800 mb-1">DISTINCT Option</h3>
                            <p class="text-sm text-gray-600">
                                Remove duplicate values in aggregate functions. Useful for counting unique items within grouped data.
                            </p>
                        </div>

                        <div class="border-l-4 border-red-500 pl-4 py-2">
                            <h3 class="font-bold text-lg text-gray-800 mb-1">Aggregate Expressions</h3>
                            <p class="text-sm text-gray-600">
                                Build complex calculations (e.g., SUM(quantity × price)). Combine multiple columns and operations within a single aggregate.
                            </p>
                        </div>
                    </div>

                    <div class="mt-6 p-4 bg-gray-50 border border-gray-300 rounded-lg">
                        <p class="text-xs text-gray-700">
                            <font-awesome icon="fas fa-info-circle" class="text-blue-600 mr-1" />
                            <strong>Note:</strong> Simple View already includes WHERE clauses, GROUP BY, ORDER BY, calculated columns, column aliases, and OFFSET/LIMIT controls.
                        </p>
                    </div>

                    <div class="flex justify-end mt-6">
                        <button @click="toggleAdvancedFeaturesDialog"
                            class="px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 transition-colors cursor-pointer rounded-lg">
                            Got it!
                        </button>
                    </div>
                </div>
            </template>
        </overlay-dialog>
        
        <!-- Medallion Layer Walkthrough Modal -->
        <MedallionLayerWalkthroughModal
            :isOpen="state.showLayerWalkthrough"
            @close="handleCloseWalkthrough"
        />
        
        <!-- Tier Limit Modal -->
        <TierLimitModal
            :show="tierLimitModal.show"
            :resource="tierLimitModal.resource"
            :current-usage="tierLimitModal.currentUsage"
            :tier-limit="tierLimitModal.tierLimit"
            :tier-name="tierLimitModal.tierName"
            :upgrade-tiers="tierLimitModal.upgradeTiers"
            @close="hideLimitModal"
        />
    </div>
</template>

