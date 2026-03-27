import { ref, computed, watch, nextTick } from 'vue';
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
    organizationId?: Ref<number | undefined> | ComputedRef<number | undefined>,
    workspaceId?: Ref<number | undefined> | ComputedRef<number | undefined>,
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

    // ── Source size check (fires on mount if edit mode with data, or on first column add) ───

    const fetchSourceRowCount = async () => {
        const id = dataModelId.value;
        if (!id || sourceCheckTriggered.value) return;
        
        sourceCheckTriggered.value = true;
        loadingSourceCheck.value = true;
        try {
            const token = getAuthToken();
            if (!token) return;
            
            // Build headers with organization and workspace context
            const headers: Record<string, string> = {
                Authorization: `Bearer ${token}`,
                'Authorization-Type': 'auth',
            };
            
            const orgId = organizationId?.value;
            const wsId = workspaceId?.value;
            
            if (orgId) {
                headers['X-Organization-Id'] = String(orgId);
            }
            if (wsId) {
                headers['X-Workspace-Id'] = String(wsId);
            }
            
            const result = await $fetch<any>(
                `${config.public.apiBase}/data-model/${id}/health`,
                { headers },
            );
            if (
                result?.live?.source_row_count !== undefined &&
                result.live.source_row_count !== null
            ) {
                sourceRowCount.value = result.live.source_row_count;
            }
            
            // Check health status after fetching and show alert if warning detected
            // Use nextTick to ensure reactive values are updated
            await nextTick();
            if (status.value === 'warning' && issues.value.length > 0) {
                showHealthWarningAlert();
            }
        } catch {
            // Non-blocking — health panel still renders via client-side checks
        } finally {
            loadingSourceCheck.value = false;
        }
    };

    /**
     * Show a SweetAlert when health warnings are detected
     */
    const showHealthWarningAlert = async () => {
        const { $swal } = useNuxtApp();
        
        // Build HTML list of issues with recommendations
        const issuesList = issues.value
            .map(issue => `
                <div class="text-left mb-3">
                    <strong class="text-yellow-700">${issue.title}</strong>
                    <p class="text-sm text-gray-600 mt-1">${issue.description}</p>
                    <p class="text-sm text-blue-600 mt-1"><strong>💡 Recommendation:</strong> ${issue.recommendation}</p>
                </div>
            `)
            .join('');

        await $swal.fire({
            icon: 'warning',
            title: 'Data Model Health Warning',
            html: `
                <div class="text-left">
                    <p class="text-sm text-gray-700 mb-4">Your data model has potential issues that may affect chart performance:</p>
                    ${issuesList}
                </div>
            `,
            confirmButtonText: 'I Understand',
            confirmButtonColor: '#f59e0b',
            width: 600,
        });
    };

    watch(
        [hasColumns, dataModelId],
        async ([cols, id]) => {
            // Fetch source row count if: has columns, has model ID, and hasn't checked yet
            // This covers both edit mode (runs immediately on mount) and new column add
            if (cols && id && !sourceCheckTriggered.value) {
                await fetchSourceRowCount();
            }
        },
        { immediate: true }, // Check immediately on mount for edit mode
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
            
            // Build headers with organization and workspace context
            const headers: Record<string, string> = {
                Authorization: `Bearer ${token}`,
                'Authorization-Type': 'auth',
                'Content-Type': 'application/json',
            };
            
            const orgId = organizationId?.value;
            const wsId = workspaceId?.value;
            
            if (orgId) {
                headers['X-Organization-Id'] = String(orgId);
            }
            if (wsId) {
                headers['X-Workspace-Id'] = String(wsId);
            }
            
            await $fetch(`${config.public.apiBase}/data-model/${id}/model-type`, {
                method: 'PATCH',
                headers,
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
        showHealthWarningAlert,
    };
};
