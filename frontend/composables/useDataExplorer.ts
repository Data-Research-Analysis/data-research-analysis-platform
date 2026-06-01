import { ref, reactive, computed } from 'vue';
import { getAuthToken } from '@/composables/AuthToken';

// ============================================================
// Types — mirrors backend DataModelExploreService.ts
// ============================================================

export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'contains'
  | 'not_contains'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'is_null'
  | 'is_not_null'
  | 'in'
  | 'not_in';

export type AggregationFunction = 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX';
export type SortDirection = 'ASC' | 'DESC';

export interface ExploreFilter {
  column: string;
  operator: FilterOperator;
  value?: any;
  values?: any[];
  value2?: any;
}

export interface ExploreSort {
  column: string;
  direction: SortDirection;
}

export interface ExploreGroupBy {
  columns: string[];
  aggregations: Array<{
    column: string;
    function: AggregationFunction;
    alias?: string;
  }>;
}

export interface ExploreRequest {
  columns?: string[];
  filters?: ExploreFilter[];
  sort?: ExploreSort[];
  groupBy?: ExploreGroupBy;
  page?: number;
  pageSize?: number;
}

export interface ExploreResponse {
  columns: string[];
  data: any[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  isGrouped: boolean;
  execution_ms: number;
}

// ============================================================
// Composable
// ============================================================

export function useDataExplorer(dataModelId: Ref<number> | ComputedRef<number>) {
  const baseUrl = () => useRuntimeConfig().public.apiBase;

  // Reactive state
  const loading = ref(false);
  const error = ref<string | null>(null);
  const result = ref<ExploreResponse | null>(null);
  const columns = ref<string[]>([]);

  // Current request parameters
  const filters = ref<ExploreFilter[]>([]);
  const sort = ref<ExploreSort[]>([]);
  const groupBy = ref<ExploreGroupBy | null>(null);
  const selectedColumns = ref<string[]>([]);
  const page = ref(1);
  const pageSize = ref(50);

  // Computed
  const hasData = computed(() => (result.value?.data?.length ?? 0) > 0);
  const totalRows = computed(() => result.value?.total ?? 0);
  const totalPages = computed(() => result.value?.totalPages ?? 0);
  const isGrouped = computed(() => result.value?.isGrouped ?? false);
  const executionMs = computed(() => result.value?.execution_ms ?? 0);
  const resultColumns = computed(() => result.value?.columns ?? columns.value);
  const resultData = computed(() => result.value?.data ?? []);

  // Active filters count
  const activeFiltersCount = computed(() => filters.value.length);

  /**
   * Execute the explore request against the backend
   */
  async function fetchExplore() {
    loading.value = true;
    error.value = null;

    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const body: ExploreRequest = {};

      if (selectedColumns.value.length > 0) {
        body.columns = selectedColumns.value;
      }
      if (filters.value.length > 0) {
        body.filters = filters.value;
      }
      if (sort.value.length > 0) {
        body.sort = sort.value;
      }
      if (groupBy.value && groupBy.value.columns.length > 0) {
        body.groupBy = groupBy.value;
      }
      body.page = page.value;
      body.pageSize = pageSize.value;

      const url = `${baseUrl()}/data-model/${dataModelId.value}/explore`;
      const response = await $fetch<{ success: boolean; data: ExploreResponse }>(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Authorization-Type': 'auth',
        },
        body,
      });

      const data = response.data || (response as any);
      result.value = data;
      // Update known columns from first fetch
      if (data.columns && data.columns.length > 0) {
        columns.value = data.columns;
      }
    } catch (err: any) {
      const message = err?.data?.error || err?.message || 'Failed to explore data model';
      error.value = message;
      console.error('[useDataExplorer] Error:', err);
    } finally {
      loading.value = false;
    }
  }

  /**
   * Initial load — fetches first page with no filters to get column names
   */
  async function initialize() {
    filters.value = [];
    sort.value = [];
    groupBy.value = null;
    selectedColumns.value = [];
    page.value = 1;
    await fetchExplore();
    // Store available columns from initial fetch
    if (result.value?.columns) {
      columns.value = result.value.columns;
    }
  }

  // ---- Filter helpers ----

  function addFilter(filter: ExploreFilter) {
    filters.value.push(filter);
    page.value = 1;
    fetchExplore();
  }

  function removeFilter(index: number) {
    filters.value.splice(index, 1);
    page.value = 1;
    fetchExplore();
  }

  function clearFilters() {
    filters.value = [];
    page.value = 1;
    fetchExplore();
  }

  function updateFilter(index: number, filter: ExploreFilter) {
    filters.value[index] = filter;
    page.value = 1;
    fetchExplore();
  }

  // ---- Sort helpers ----

  function setSort(column: string, direction: SortDirection) {
    // Toggle or replace sort for column
    const existingIndex = sort.value.findIndex(s => s.column === column);
    if (existingIndex >= 0) {
      if (direction === sort.value[existingIndex].direction) {
        // Remove sort if same direction clicked again
        sort.value.splice(existingIndex, 1);
      } else {
        sort.value[existingIndex].direction = direction;
      }
    } else {
      sort.value = [{ column, direction }];
    }
    page.value = 1;
    fetchExplore();
  }

  function clearSort() {
    sort.value = [];
    page.value = 1;
    fetchExplore();
  }

  // ---- GroupBy helpers ----

  function setGroupBy(config: ExploreGroupBy | null) {
    groupBy.value = config;
    page.value = 1;
    fetchExplore();
  }

  function clearGroupBy() {
    groupBy.value = null;
    page.value = 1;
    fetchExplore();
  }

  // ---- Pagination ----

  function goToPage(newPage: number) {
    page.value = Math.max(1, newPage);
    fetchExplore();
  }

  function nextPage() {
    if (page.value < totalPages.value) {
      page.value++;
      fetchExplore();
    }
  }

  function prevPage() {
    if (page.value > 1) {
      page.value--;
      fetchExplore();
    }
  }

  function setPageSize(newSize: number) {
    pageSize.value = Math.min(1000, Math.max(1, newSize));
    page.value = 1;
    fetchExplore();
  }

  // ---- Column selection ----

  function setSelectedColumns(cols: string[]) {
    selectedColumns.value = cols;
    page.value = 1;
    fetchExplore();
  }

  // ---- Export ----

  function exportCSV() {
    if (!result.value || result.value.data.length === 0) return;

    const cols = result.value.columns;
    const header = cols.join(',');
    const rows = result.value.data.map(row =>
      cols.map(col => {
        const val = row[col];
        if (val === null || val === undefined) return '';
        const str = String(val);
        // Escape commas and quotes
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(',')
    );

    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `data-model-${dataModelId.value}-export.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return {
    // State
    loading,
    error,
    result,
    columns,
    filters,
    sort,
    groupBy,
    selectedColumns,
    page,
    pageSize,

    // Computed
    hasData,
    totalRows,
    totalPages,
    isGrouped,
    executionMs,
    resultColumns,
    resultData,
    activeFiltersCount,

    // Actions
    initialize,
    fetchExplore,

    // Filter
    addFilter,
    removeFilter,
    clearFilters,
    updateFilter,

    // Sort
    setSort,
    clearSort,

    // GroupBy
    setGroupBy,
    clearGroupBy,

    // Pagination
    goToPage,
    nextPage,
    prevPage,
    setPageSize,

    // Columns
    setSelectedColumns,

    // Export
    exportCSV,
  };
}