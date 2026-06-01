<template>
  <div class="space-y-4">
    <!-- Toolbar -->
    <div class="bg-white rounded-lg shadow p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <!-- Filter Button -->
          <button
            @click="showFilterPanel = !showFilterPanel"
            class="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors"
            :class="showFilterPanel || explorer.activeFiltersCount.value > 0
              ? 'border-blue-300 bg-blue-50 text-blue-700'
              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'"
          >
            <font-awesome icon="fas fa-filter" class="text-xs" />
            <span>Filter</span>
            <span
              v-if="explorer.activeFiltersCount.value > 0"
              class="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-blue-600 rounded-full"
            >
              {{ explorer.activeFiltersCount.value }}
            </span>
          </button>

          <!-- Group By Button -->
          <button
            @click="showGroupByPanel = !showGroupByPanel"
            class="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors"
            :class="showGroupByPanel || explorer.isGrouped.value
              ? 'border-purple-300 bg-purple-50 text-purple-700'
              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'"
          >
            <font-awesome icon="fas fa-layer-group" class="text-xs" />
            <span>Group By</span>
          </button>

          <!-- Export CSV -->
          <button
            @click="explorer.exportCSV()"
            :disabled="!explorer.hasData.value"
            class="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <font-awesome icon="fas fa-download" class="text-xs" />
            <span>Export CSV</span>
          </button>
        </div>

        <div class="flex items-center gap-3">
          <!-- Result info -->
          <span v-if="explorer.hasData.value" class="text-sm text-gray-500">
            {{ explorer.totalRows.value.toLocaleString() }} rows
            <span v-if="explorer.executionMs.value > 0" class="text-gray-400">
              ({{ explorer.executionMs.value }}ms)
            </span>
          </span>

          <!-- Page size selector -->
          <select
            :value="explorer.pageSize.value"
            @change="explorer.setPageSize(parseInt(($event.target as HTMLSelectElement).value))"
            class="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option :value="25">25 rows</option>
            <option :value="50">50 rows</option>
            <option :value="100">100 rows</option>
            <option :value="250">250 rows</option>
            <option :value="500">500 rows</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Filter Panel -->
    <div v-if="showFilterPanel" class="bg-white rounded-lg shadow p-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold text-gray-900">Filters</h3>
        <div class="flex items-center gap-2">
          <button
            v-if="explorer.filters.value.length > 0"
            @click="explorer.clearFilters()"
            class="text-xs text-red-600 hover:text-red-800 font-medium"
          >
            Clear All
          </button>
          <button
            @click="addNewFilter"
            class="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <font-awesome icon="fas fa-plus" class="text-xs" />
            Add Filter
          </button>
        </div>
      </div>

      <!-- Existing filters -->
      <div v-if="explorer.filters.value.length > 0" class="space-y-2 mb-3">
        <div
          v-for="(filter, index) in explorer.filters.value"
          :key="index"
          class="flex items-center gap-2 p-2 bg-gray-50 rounded-lg"
        >
          <!-- Column -->
          <select
            :value="filter.column"
            @change="updateFilterField(index, 'column', ($event.target as HTMLSelectElement).value)"
            class="text-sm border border-gray-300 rounded px-2 py-1 bg-white min-w-[140px]"
          >
            <option value="" disabled>Select column</option>
            <option v-for="col in explorer.columns.value" :key="col" :value="col">{{ col }}</option>
          </select>

          <!-- Operator -->
          <select
            :value="filter.operator"
            @change="updateFilterField(index, 'operator', ($event.target as HTMLSelectElement).value)"
            class="text-sm border border-gray-300 rounded px-2 py-1 bg-white min-w-[130px]"
          >
            <option v-for="op in filterOperators" :key="op.value" :value="op.value">{{ op.label }}</option>
          </select>

          <!-- Value (hidden for is_null/is_not_null) -->
          <template v-if="!['is_null', 'is_not_null'].includes(filter.operator)">
            <input
              v-if="!['in', 'not_in', 'between'].includes(filter.operator)"
              :value="filter.value"
              @input="updateFilterField(index, 'value', ($event.target as HTMLInputElement).value)"
              type="text"
              placeholder="Value"
              class="text-sm border border-gray-300 rounded px-2 py-1 flex-1 min-w-[100px]"
            />
            <!-- Between: two inputs -->
            <template v-else-if="filter.operator === 'between'">
              <input
                :value="filter.value"
                @input="updateFilterField(index, 'value', ($event.target as HTMLInputElement).value)"
                type="text"
                placeholder="From"
                class="text-sm border border-gray-300 rounded px-2 py-1 w-24"
              />
              <span class="text-gray-400 text-sm">–</span>
              <input
                :value="filter.value2"
                @input="updateFilterField(index, 'value2', ($event.target as HTMLInputElement).value)"
                type="text"
                placeholder="To"
                class="text-sm border border-gray-300 rounded px-2 py-1 w-24"
              />
            </template>
            <!-- In/Not In: comma-separated -->
            <input
              v-else
              :value="Array.isArray(filter.values) ? filter.values.join(', ') : ''"
              @input="updateFilterField(index, 'values', ($event.target as HTMLInputElement).value.split(',').map(v => v.trim()))"
              type="text"
              placeholder="val1, val2, val3"
              class="text-sm border border-gray-300 rounded px-2 py-1 flex-1 min-w-[100px]"
            />
          </template>

          <!-- Remove filter -->
          <button
            @click="explorer.removeFilter(index)"
            class="text-gray-400 hover:text-red-600 transition-colors p-1"
          >
            <font-awesome icon="fas fa-times" class="text-xs" />
          </button>
        </div>
      </div>

      <!-- Apply button -->
      <div v-if="pendingFilterChanges" class="flex justify-end">
        <button
          @click="applyFilters"
          class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Apply Filters
        </button>
      </div>

      <p v-if="explorer.filters.value.length === 0" class="text-sm text-gray-400 text-center py-2">
        No filters applied. Click "Add Filter" to start filtering.
      </p>
    </div>

    <!-- Group By Panel -->
    <div v-if="showGroupByPanel" class="bg-white rounded-lg shadow p-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold text-gray-900">Group By & Aggregation</h3>
        <button
          v-if="explorer.groupBy.value"
          @click="explorer.clearGroupBy(); resetGroupByForm()"
          class="text-xs text-red-600 hover:text-red-800 font-medium"
        >
          Clear
        </button>
      </div>

      <div class="space-y-3">
        <!-- Group columns -->
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Group Columns</label>
          <div class="flex flex-wrap gap-2">
            <label
              v-for="col in explorer.columns.value"
              :key="col"
              class="inline-flex items-center gap-1.5 text-sm cursor-pointer"
            >
              <input
                type="checkbox"
                :value="col"
                v-model="groupByForm.columns"
                class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span class="text-gray-700">{{ col }}</span>
            </label>
          </div>
        </div>

        <!-- Aggregations -->
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="block text-xs font-medium text-gray-600">Aggregations</label>
            <button
              @click="addGroupByAggregation"
              class="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              + Add Aggregation
            </button>
          </div>
          <div v-if="groupByForm.aggregations.length > 0" class="space-y-2">
            <div
              v-for="(agg, idx) in groupByForm.aggregations"
              :key="idx"
              class="flex items-center gap-2"
            >
              <select
                v-model="agg.function"
                class="text-sm border border-gray-300 rounded px-2 py-1 bg-white"
              >
                <option value="COUNT">COUNT</option>
                <option value="SUM">SUM</option>
                <option value="AVG">AVG</option>
                <option value="MIN">MIN</option>
                <option value="MAX">MAX</option>
              </select>
              <select
                v-model="agg.column"
                class="text-sm border border-gray-300 rounded px-2 py-1 bg-white min-w-[140px]"
              >
                <option value="*">*</option>
                <option v-for="col in explorer.columns.value" :key="col" :value="col">{{ col }}</option>
              </select>
              <input
                v-model="agg.alias"
                type="text"
                placeholder="Alias (optional)"
                class="text-sm border border-gray-300 rounded px-2 py-1 flex-1"
              />
              <button
                @click="groupByForm.aggregations.splice(idx, 1)"
                class="text-gray-400 hover:text-red-600 transition-colors p-1"
              >
                <font-awesome icon="fas fa-times" class="text-xs" />
              </button>
            </div>
          </div>
        </div>

        <!-- Apply -->
        <div class="flex justify-end">
          <button
            @click="applyGroupBy"
            :disabled="groupByForm.columns.length === 0"
            class="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Apply Group By
          </button>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-if="explorer.error.value" class="bg-red-50 border border-red-200 rounded-lg p-4">
      <div class="flex items-center gap-2">
        <font-awesome icon="fas fa-exclamation-circle" class="text-red-500" />
        <p class="text-sm text-red-700">{{ explorer.error.value }}</p>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="explorer.loading.value" class="flex items-center justify-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <span class="ml-3 text-sm text-gray-500">Loading data...</span>
    </div>

    <!-- Data Table -->
    <div v-else-if="explorer.hasData.value" class="bg-white rounded-lg shadow overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th
                v-for="col in explorer.resultColumns.value"
                :key="col"
                class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none group"
                @click="toggleSort(col)"
              >
                <div class="flex items-center gap-1">
                  <span>{{ col }}</span>
                  <span class="text-gray-400 group-hover:text-gray-600">
                    <font-awesome
                      v-if="getSortDirection(col) === 'ASC'"
                      icon="fas fa-sort-up"
                      class="text-blue-600 text-xs"
                    />
                    <font-awesome
                      v-else-if="getSortDirection(col) === 'DESC'"
                      icon="fas fa-sort-down"
                      class="text-blue-600 text-xs"
                    />
                    <font-awesome
                      v-else
                      icon="fas fa-sort"
                      class="text-xs"
                    />
                  </span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr
              v-for="(row, rowIdx) in explorer.resultData.value"
              :key="rowIdx"
              class="hover:bg-gray-50 transition-colors"
            >
              <td
                v-for="col in explorer.resultColumns.value"
                :key="col"
                class="px-4 py-3 text-sm text-gray-900 whitespace-nowrap max-w-[300px] truncate"
                :title="formatCell(row[col])"
              >
                <span v-if="row[col] === null || row[col] === undefined" class="text-gray-300 italic">
                  NULL
                </span>
                <span v-else>
                  {{ formatCell(row[col]) }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="bg-gray-50 px-4 py-3 flex items-center justify-between border-t border-gray-200">
        <div class="text-sm text-gray-500">
          Showing
          <span class="font-medium">{{ ((explorer.page.value - 1) * explorer.pageSize.value) + 1 }}</span>
          to
          <span class="font-medium">{{ Math.min(explorer.page.value * explorer.pageSize.value, explorer.totalRows.value) }}</span>
          of
          <span class="font-medium">{{ explorer.totalRows.value.toLocaleString() }}</span>
          results
          <span v-if="explorer.isGrouped.value" class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
            Grouped
          </span>
        </div>
        <div class="flex items-center gap-2">
          <button
            @click="explorer.goToPage(1)"
            :disabled="explorer.page.value <= 1"
            class="px-2 py-1 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <font-awesome icon="fas fa-angle-double-left" class="text-xs" />
          </button>
          <button
            @click="explorer.prevPage()"
            :disabled="explorer.page.value <= 1"
            class="px-2 py-1 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <font-awesome icon="fas fa-angle-left" class="text-xs" />
          </button>
          <span class="text-sm text-gray-700 px-2">
            Page {{ explorer.page.value }} of {{ explorer.totalPages.value }}
          </span>
          <button
            @click="explorer.nextPage()"
            :disabled="explorer.page.value >= explorer.totalPages.value"
            class="px-2 py-1 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <font-awesome icon="fas fa-angle-right" class="text-xs" />
          </button>
          <button
            @click="explorer.goToPage(explorer.totalPages.value)"
            :disabled="explorer.page.value >= explorer.totalPages.value"
            class="px-2 py-1 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <font-awesome icon="fas fa-angle-double-right" class="text-xs" />
          </button>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="!explorer.loading.value && explorer.result.value" class="bg-white rounded-lg shadow p-12 text-center">
      <font-awesome icon="fas fa-table" class="text-gray-300 text-5xl mb-4" />
      <p class="text-lg font-semibold text-gray-900">No Data Found</p>
      <p class="text-sm text-gray-500 mt-1">
        {{ explorer.activeFiltersCount.value > 0
          ? 'No rows match the current filters. Try adjusting your criteria.'
          : 'This data model returned no results.' }}
      </p>
      <button
        v-if="explorer.activeFiltersCount.value > 0"
        @click="explorer.clearFilters()"
        class="mt-3 inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100"
      >
        <font-awesome icon="fas fa-times" class="text-xs" />
        Clear Filters
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue';
import { useDataExplorer, type ExploreFilter, type FilterOperator } from '@/composables/useDataExplorer';

const props = defineProps<{
  dataModelId: number;
}>();

const explorer = useDataExplorer(computed(() => props.dataModelId));

// UI state
const showFilterPanel = ref(false);
const showGroupByPanel = ref(false);
const pendingFilterChanges = ref(false);

// Filter operators
const filterOperators = [
  { value: 'eq', label: 'Equals' },
  { value: 'neq', label: 'Not Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Not Contains' },
  { value: 'gt', label: 'Greater Than' },
  { value: 'gte', label: 'Greater or Equal' },
  { value: 'lt', label: 'Less Than' },
  { value: 'lte', label: 'Less or Equal' },
  { value: 'between', label: 'Between' },
  { value: 'is_null', label: 'Is Null' },
  { value: 'is_not_null', label: 'Is Not Null' },
  { value: 'in', label: 'In' },
  { value: 'not_in', label: 'Not In' },
];

// Group by form state
const groupByForm = reactive({
  columns: [] as string[],
  aggregations: [] as Array<{ column: string; function: string; alias: string }>,
});

// Initialize explorer on mount
onMounted(() => {
  explorer.initialize();
});

// Filter functions
function addNewFilter() {
  explorer.filters.value.push({
    column: '',
    operator: 'eq',
    value: '',
  });
  pendingFilterChanges.value = true;
}

function updateFilterField(index: number, field: string, value: any) {
  const filter = explorer.filters.value[index];
  if (filter) {
    (filter as any)[field] = value;
    pendingFilterChanges.value = true;
  }
}

function applyFilters() {
  // Remove filters with empty columns
  explorer.filters.value = explorer.filters.value.filter(f => f.column);
  pendingFilterChanges.value = false;
  explorer.page.value = 1;
  explorer.fetchExplore();
}

// Sort functions
function toggleSort(column: string) {
  const currentDir = getSortDirection(column);
  if (currentDir === 'ASC') {
    explorer.setSort(column, 'DESC');
  } else if (currentDir === 'DESC') {
    explorer.clearSort();
  } else {
    explorer.setSort(column, 'ASC');
  }
}

function getSortDirection(column: string): string | null {
  const s = explorer.sort.value.find(s => s.column === column);
  return s ? s.direction : null;
}

// Group by functions
function addGroupByAggregation() {
  groupByForm.aggregations.push({
    column: '*',
    function: 'COUNT',
    alias: '',
  });
}

function applyGroupBy() {
  if (groupByForm.columns.length === 0) return;
  explorer.setGroupBy({
    columns: [...groupByForm.columns],
    aggregations: groupByForm.aggregations.map(a => ({
      column: a.column,
      function: a.function as any,
      alias: a.alias || undefined,
    })),
  });
}

function resetGroupByForm() {
  groupByForm.columns = [];
  groupByForm.aggregations = [];
}

// Cell formatting
function formatCell(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    return value.toLocaleString();
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}
</script>