import { ref, computed, watch } from 'vue';
import type { Ref, ComputedRef } from 'vue';
import { getAuthToken } from '@/composables/AuthToken';

/**
 * Mirrors the DataModelHealthService classification matrix on the frontend.
 * Reactive to changes in `dataTable` (state.data_table from the builder).
 *
 * Source row count is fetched ONCE via GET /data-model/:id/health when the
 * first column is dragged in and a model ID is available (edit mode). For
 * new models the source size is unknown — the classification falls back to
 * the small-source warning path.
 */

const LARGE_SOURCE_THRESHOLD = 100_000;

export const useDataModelHealth = (
    dataTable: Ref<any> | ComputedRef<any>,
    dataModelId: Ref<number | null> | ComputedRef<number | null>,
) => {
    const config = useRuntimeConfig();

    const sourceRowCount = ref<number | null>(null);
    const sourceCheckTriggered = ref(false);
    const loadingSourceCheck = ref(false);
    const settingModelType = ref(false);
    /** Locally-applied override after a successful PATCH model-type call. */
    const modelTypeOverride = ref<string | null>(null);

    // ── Reactive checks ──────────────────────────────────────────────────────

    const hasColumns = computed(() =>
        (dataTable.value?.columns?.length ?? 0) > 0,
    );

    const hasAggregation = computed(() => {
        const gb = dataTable.value?.query_options?.group_by;
        const hasRealAggFunc =
            gb?.aggregate_functions?.some(
                (a: any) => a.aggregate_function !== '' && a.column !== '',
            ) ?? false;
        const hasRealAggExpr =
            gb?.aggregate_expressions?.some(
                (a: any) => a.expression && a.expression.trim() !== '',
            ) ?? false;
        return hasRealAggFunc || hasRealAggExpr;
    });

    const hasGroupBy = computed(() =>
        (dataTable.value?.query_options?.group_by?.group_by_columns?.length ?? 0) > 0,
    );

    const hasWhere = computed(() =>
        (dataTable.value?.query_options?.where?.length ?? 0) > 0,
    );

    const effectiveModelType = computed(
        () => modelTypeOverride.value ?? dataTable.value?.model_type ?? null,
    );

    const isLargeSource = computed(
        () => sourceRowCount.value !== null && sourceRowCount.value > LARGE_SOURCE_THRESHOLD,
    );

    // ── Classification matrix (mirrors DataModelHealthService.analyse()) ─────

    const healthResult = computed(() => {
        if (!hasColumns.value) {
            return { status: 'unknown' as const, issues: [] };
        }

        // Dimension tables bypass all other checks
        if (effectiveModelType.value === 'dimension') {
            return { status: 'healthy' as const, issues: [] };
        }

        if (hasAggregation.value) {
            return { status: 'healthy' as const, issues: [] };
        }

        if (hasGroupBy.value) {
            return {
                status: 'warning' as const,
                issues: [
                    {
                        code: 'MISSING_AGGREGATE_FUNCTION',
                        title: 'GROUP BY without aggregate function',
                        description:
                            'You have GROUP BY columns but no aggregate functions (SUM, COUNT, etc.).',
                        recommendation:
                            'Add an aggregate function to complete the GROUP BY.',
                    },
                ],
            };
        }

        if (!hasWhere.value && isLargeSource.value) {
            return {
                status: 'blocked' as const,
                issues: [
                    {
                        code: 'FULL_TABLE_SCAN_LARGE_SOURCE',
                        title: 'Full table scan on large source',
                        description: `Source tables contain ${sourceRowCount.value?.toLocaleString()} rows. Without filtering or aggregation this model will exceed the row limit.`,
                        recommendation:
                            'Add GROUP BY with aggregation, or add WHERE filters to reduce the result set.',
                    },
                ],
            };
        }

        if (hasWhere.value && isLargeSource.value) {
            return {
                status: 'warning' as const,
                issues: [
                    {
                        code: 'FILTER_WITHOUT_AGGREGATION_LARGE_SOURCE',
                        title: 'Filter without aggregation on large source',
                        description:
                            'WHERE filters are applied, but without aggregation this model may still return many rows.',
                        recommendation:
                            'Add aggregate functions to summarise the filtered data.',
                    },
                ],
            };
        }

        if (hasWhere.value) {
            return {
                status: 'warning' as const,
                issues: [
                    {
                        code: 'NO_AGGREGATION_WITH_FILTER',
                        title: 'No aggregation detected',
                        description: 'This model returns individual rows, not summary data.',
                        recommendation:
                            'Add an aggregation (SUM, COUNT, etc.) to get chart-ready data.',
                    },
                ],
            };
        }

        return {
            status: 'warning' as const,
            issues: [
                {
                    code: 'NO_AGGREGATION_NO_FILTER_SMALL_SOURCE',
                    title: 'No aggregation detected',
                    description:
                        'This model returns individual rows. Consider adding aggregation for chart-ready data.',
                    recommendation:
                        'Add aggregate functions, or mark as a Dimension table if this is a lookup table.',
                },
            ],
        };
    });

    const status = computed(() => healthResult.value.status);
    const issues = computed(() => healthResult.value.issues);

    // ── Source size check (fires once on first column add, edit mode only) ───

    watch(
        [hasColumns, dataModelId],
        async ([cols, id], [prevCols]) => {
            if (cols && !prevCols && id && !sourceCheckTriggered.value) {
                sourceCheckTriggered.value = true;
                loadingSourceCheck.value = true;
                try {
                    const token = getAuthToken();
                    if (!token) return;
                    const result = await $fetch<any>(
                        `${config.public.apiBase}/data-model/${id}/health`,
                        {
                            headers: {
                                Authorization: `Bearer ${token}`,
                                'Authorization-Type': 'auth',
                            },
                        },
                    );
                    if (
                        result?.live?.source_row_count !== undefined &&
                        result.live.source_row_count !== null
                    ) {
                        sourceRowCount.value = result.live.source_row_count;
                    }
                } catch {
                    // Non-blocking — health panel still renders via client-side checks
                } finally {
                    loadingSourceCheck.value = false;
                }
            }
        },
        { immediate: false },
    );

    // ── Actions ──────────────────────────────────────────────────────────────

    /**
     * Call `PATCH /data-model/:id/model-type` and update the local override
     * so the panel immediately reflects the new type without a page reload.
     */
    const setModelType = async (
        type: 'dimension' | 'fact' | 'aggregated' | null,
    ): Promise<boolean> => {
        const id = dataModelId.value;
        if (!id) return false;
        settingModelType.value = true;
        try {
            const token = getAuthToken();
            if (!token) return false;
            await $fetch(`${config.public.apiBase}/data-model/${id}/model-type`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                    'Content-Type': 'application/json',
                },
                body: { model_type: type },
            });
            modelTypeOverride.value = type;
            return true;
        } catch {
            return false;
        } finally {
            settingModelType.value = false;
        }
    };

    return {
        status,
        issues,
        sourceRowCount,
        loadingSourceCheck,
        settingModelType,
        hasAggregation,
        hasWhere,
        hasColumns,
        hasModelId: computed(() => !!dataModelId.value),
        setModelType,
    };
};
