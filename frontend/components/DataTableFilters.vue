<template>
  <div class="data-table-filters bg-white border border-gray-300 rounded-lg p-4 space-y-4">
    <!-- Global Search -->
    <div class="global-search">
      <label class="block text-sm font-semibold text-gray-700 mb-2">
        <font-awesome-icon :icon="['fas', 'search']" class="mr-2 text-gray-500" />
        Search all columns
      </label>
      <input 
        v-model="searchQuery" 
        @input="debouncedSearch"
        placeholder="Type to search across all text columns..."
        class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        type="text"
      />
    </div>
    
    <!-- Column Filters -->
    <div v-if="filterableColumns.length > 0" class="column-filters">
      <div class="flex items-center justify-between mb-3">
        <label class="block text-sm font-semibold text-gray-700">
          <font-awesome-icon :icon="['fas', 'filter']" class="mr-2 text-gray-500" />
          Column Filters
        </label>
        <button 
          v-if="hasActiveFilters"
          @click="clearAllFilters" 
          class="text-sm text-red-600 hover:text-red-700 hover:underline"
        >
          Clear all filters
        </button>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div v-for="col in filterableColumns" :key="col.name" class="filter-item">
          <label class="block text-xs font-medium text-gray-600 mb-1">
            {{ col.name }}
          </label>
          
          <div class="flex gap-2">
            <!-- Operator selector -->
            <select 
              v-model="filters[col.name].operator"
              class="flex-shrink-0 px-2 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              @change="applyFilters"
            >
              <option value="">No filter</option>
              <option v-if="isTextColumn(col)" value="contains">Contains</option>
              <option value="equals">Equals</option>
              <option v-if="isTextColumn(col)" value="startsWith">Starts with</option>
              <option v-if="isTextColumn(col)" value="endsWith">Ends with</option>
              <option v-if="isNumericColumn(col)" value="gt">Greater than</option>
              <option v-if="isNumericColumn(col)" value="gte">Greater or equal</option>
              <option v-if="isNumericColumn(col)" value="lt">Less than</option>
              <option v-if="isNumericColumn(col)" value="lte">Less or equal</option>
              <option value="isNull">Is null</option>
              <option value="isNotNull">Is not null</option>
            </select>
            
            <!-- Value input (hidden for null checks) -->
            <input 
              v-if="!['isNull', 'isNotNull'].includes(filters[col.name].operator)"
              v-model="filters[col.name].value" 
              @change="applyFilters"
              :type="getInputType(col.type)"
              :placeholder="`Filter ${col.name}...`"
              class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
    </div>
    
    <!-- Active Filter Chips -->
    <div v-if="hasActiveFilters" class="active-filters flex flex-wrap gap-2">
      <div v-if="searchQuery.trim()" class="filter-chip bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center gap-2">
        <font-awesome-icon :icon="['fas', 'search']" class="text-xs" />
        <span>Search: "{{ searchQuery }}"</span>
        <button @click="clearSearch" class="hover:text-blue-900">
          <font-awesome-icon :icon="['fas', 'xmark']" class="text-xs" />
        </button>
      </div>
      
      <div 
        v-for="(filter, col) in activeColumnFilters" 
        :key="col" 
        class="filter-chip bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm flex items-center gap-2"
      >
        <font-awesome-icon :icon="['fas', 'filter']" class="text-xs" />
        <span>{{ col }}: {{ formatFilterValue(filter) }}</span>
        <button @click="removeFilter(col)" class="hover:text-purple-900">
          <font-awesome-icon :icon="['fas', 'xmark']" class="text-xs" />
        </button>
      </div>
    </div>
    
    <!-- Filter Summary -->
    <div v-if="hasActiveFilters" class="filter-summary text-sm text-gray-600 pt-2 border-t border-gray-200">
      <font-awesome-icon :icon="['fas', 'circle-info']" class="mr-2 text-blue-500" />
      {{ activeFilterCount }} filter{{ activeFilterCount !== 1 ? 's' : '' }} applied
    </div>
  </div>
</template>

<script setup lang="ts">
interface Column {
  name: string;
  type?: string;
}

interface Props {
  columns: Column[];
  initialSearch?: string;
  initialFilters?: Record<string, any>;
}

const props = withDefaults(defineProps<Props>(), {
  columns: () => [],
  initialSearch: '',
  initialFilters: () => ({})
});

const emit = defineEmits<{
  (e: 'filter-change', data: { search: string; filters: Record<string, any> }): void;
}>();

const searchQuery = ref(props.initialSearch);
const filters = reactive<Record<string, { operator: string; value: any }>>(
  props.columns.reduce((acc, col) => {
    acc[col.name] = { operator: '', value: '' };
    return acc;
  }, {} as Record<string, { operator: string; value: any }>)
);

// Initialize with any provided filters
if (props.initialFilters) {
  for (const [col, filter] of Object.entries(props.initialFilters)) {
    if (filters[col]) {
      if (typeof filter === 'object' && 'operator' in filter) {
        filters[col] = { ...filter };
      } else {
        filters[col] = { operator: 'equals', value: filter };
      }
    }
  }
}

const filterableColumns = computed(() => props.columns);

const activeColumnFilters = computed(() => {
  return Object.entries(filters)
    .filter(([_, f]) => f.operator && (f.operator === 'isNull' || f.operator === 'isNotNull' || f.value))
    .reduce((acc, [col, f]) => {
      acc[col] = f;
      return acc;
    }, {} as Record<string, any>);
});

const hasActiveFilters = computed(() => {
  return searchQuery.value.trim() !== '' || Object.keys(activeColumnFilters.value).length > 0;
});

const activeFilterCount = computed(() => {
  let count = searchQuery.value.trim() ? 1 : 0;
  count += Object.keys(activeColumnFilters.value).length;
  return count;
});

function isTextColumn(col: Column): boolean {
  return !col.type || col.type.includes('char') || col.type.includes('text') || col.type === 'string';
}

function isNumericColumn(col: Column): boolean {
  return col.type?.includes('int') || col.type?.includes('float') || col.type?.includes('decimal') || col.type?.includes('numeric') || col.type === 'number';
}

function getInputType(colType?: string): string {
  if (!colType) return 'text';
  if (colType.includes('int') || colType.includes('numeric') || colType === 'number') return 'number';
  if (colType.includes('date')) return 'date';
  if (colType.includes('time')) return 'time';
  return 'text';
}

function formatFilterValue(filter: { operator: string; value: any }): string {
  if (filter.operator === 'isNull') return 'is null';
  if (filter.operator === 'isNotNull') return 'is not null';
  
  const operatorLabels: Record<string, string> = {
    equals: '=',
    contains: 'contains',
    startsWith: 'starts with',
    endsWith: 'ends with',
    gt: '>',
    gte: '≥',
    lt: '<',
    lte: '≤',
  };
  
  return `${operatorLabels[filter.operator] || filter.operator} "${filter.value}"`;
}

const debouncedSearch = useDebounceFn(() => {
  applyFilters();
}, 300);

function applyFilters() {
  const filtersToSend = Object.entries(filters)
    .filter(([_, f]) => f.operator && (f.operator === 'isNull' || f.operator === 'isNotNull' || f.value))
    .reduce((acc, [col, f]) => {
      acc[col] = { operator: f.operator, value: f.value };
      return acc;
    }, {} as Record<string, any>);
  
  emit('filter-change', {
    search: searchQuery.value.trim(),
    filters: filtersToSend
  });
}

function removeFilter(columnName: string) {
  if (filters[columnName]) {
    filters[columnName].operator = '';
    filters[columnName].value = '';
    applyFilters();
  }
}

function clearSearch() {
  searchQuery.value = '';
  applyFilters();
}

function clearAllFilters() {
  searchQuery.value = '';
  for (const col of Object.keys(filters)) {
    filters[col].operator = '';
    filters[col].value = '';
  }
  applyFilters();
}

// Expose methods for parent components
defineExpose({
  clearAllFilters,
  applyFilters
});
</script>

<style scoped>
.filter-chip {
  animation: fadeIn 0.2s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
