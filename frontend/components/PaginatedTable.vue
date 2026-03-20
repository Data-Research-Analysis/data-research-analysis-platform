<template>
  <div class="paginated-table w-full">
    <!-- Error State -->
    <div v-if="error" class="error-state bg-red-50 border border-red-200 rounded-lg p-6 text-center">
      <font-awesome-icon :icon="['fas', 'triangle-exclamation']" class="text-red-500 text-4xl mb-3" />
      <h3 class="text-lg font-semibold text-red-800 mb-2">Failed to Load Data</h3>
      <p class="text-red-600 mb-4">{{ error }}</p>
      <button 
        @click="fetchData" 
        class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
      >
        <font-awesome-icon :icon="['fas', 'arrow-rotate-right']" class="mr-2" />
        Retry
      </button>
    </div>

    <!-- Empty State -->
    <div v-else-if="!loading && totalRows === 0" class="empty-state bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
      <font-awesome-icon :icon="['fas', 'table']" class="text-gray-400 text-5xl mb-4" />
      <h3 class="text-lg font-semibold text-gray-700 mb-2">No Data Available</h3>
      <p class="text-gray-500">This data model doesn't contain any rows yet.</p>
    </div>

    <!-- Data Table -->
    <div v-else class="data-table-container">
      <!-- Table Header -->
      <div class="table-header bg-gray-100 border-b border-gray-300 sticky top-0 z-10">
        <div class="flex">
          <div 
            v-for="col in columns" 
            :key="col.name" 
            class="header-cell flex-1 px-4 py-3 font-semibold text-left cursor-pointer hover:bg-gray-200 transition-colors flex items-center gap-2"
            @click="sortBy(col.name)"
          >
            <span class="truncate">{{ col.name }}</span>
            <font-awesome-icon 
              v-if="sortColumn === col.name"
              :icon="['fas', sortOrder === 'ASC' ? 'arrow-up' : 'arrow-down']" 
              class="text-xs text-gray-600"
            />
          </div>
        </div>
      </div>
      
      <!-- Loading State -->
      <SkeletonTable v-if="loading" :rows="pageSize" :columns="columns.length" />
      
      <!-- Data Rows -->
      <div v-else class="table-body">
        <div 
          v-for="(row, idx) in data" 
          :key="idx" 
          class="table-row flex border-b border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <div 
            v-for="col in columns" 
            :key="col.name" 
            class="cell flex-1 px-4 py-3 text-sm truncate"
            :title="String(row[col.name])"
          >
            {{ row[col.name] }}
          </div>
        </div>
      </div>
      
      <!-- Pagination Controls -->
      <div class="pagination-controls bg-white border-t border-gray-300 px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <button 
            @click="prevPage" 
            :disabled="currentPage === 1 || loading"
            class="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <font-awesome-icon :icon="['fas', 'arrow-left']" />
            Previous
          </button>
          
          <button 
            @click="nextPage" 
            :disabled="!hasNextPage || loading"
            class="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            Next
            <font-awesome-icon :icon="['fas', 'arrow-right']" />
          </button>
        </div>
        
        <div class="page-info text-sm text-gray-600">
          Page <strong>{{ currentPage }}</strong> of <strong>{{ totalPages }}</strong> 
          (<strong>{{ totalRows.toLocaleString() }}</strong> total rows)
        </div>
        
        <select 
          v-model="pageSize" 
          @change="changePageSize" 
          class="page-size-selector px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          :disabled="loading"
        >
          <option :value="25">25 per page</option>
          <option :value="50">50 per page</option>
          <option :value="100">100 per page</option>
          <option :value="500">500 per page</option>
        </select>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ITableColumn } from '~/types/IDataModelData';
import SkeletonTable from './SkeletonTable.vue';

interface Props {
  dataModelId: number;
  initialPageSize?: number;
}

const props = withDefaults(defineProps<Props>(), {
  initialPageSize: 100
});

const dataModelsStore = useDataModelsStore();

const loading = ref(false);
const error = ref<string | null>(null);
const data = ref<any[]>([]);
const columns = ref<ITableColumn[]>([]);
const currentPage = ref(1);
const pageSize = ref(props.initialPageSize);
const totalRows = ref(0);
const sortColumn = ref<string | null>(null);
const sortOrder = ref<'ASC' | 'DESC'>('ASC');

const totalPages = computed(() => Math.ceil(totalRows.value / pageSize.value));
const hasNextPage = computed(() => currentPage.value < totalPages.value);

async function fetchData() {
  loading.value = true;
  error.value = null;
  
  try {
    const response = await dataModelsStore.fetchDataModelData(
      props.dataModelId,
      currentPage.value,
      pageSize.value,
      sortColumn.value || undefined,
      sortOrder.value
    );
    
    data.value = response.data;
    totalRows.value = response.pagination.total;
    
    // Extract columns from first row if we don't have them yet
    if (data.value.length > 0 && columns.value.length === 0) {
      columns.value = Object.keys(data.value[0]).map(name => ({ 
        name, 
        sortable: true 
      }));
    }
  } catch (err: any) {
    console.error('[PaginatedTable] Failed to fetch data:', err);
    error.value = err.message || 'An error occurred while fetching data';
  } finally {
    loading.value = false;
  }
}

function nextPage() {
  if (hasNextPage.value && !loading.value) {
    currentPage.value++;
    fetchData();
  }
}

function prevPage() {
  if (currentPage.value > 1 && !loading.value) {
    currentPage.value--;
    fetchData();
  }
}

function changePageSize() {
  currentPage.value = 1; // Reset to first page when changing page size
  fetchData();
}

function sortBy(column: string) {
  if (loading.value) return;
  
  if (sortColumn.value === column) {
    // Toggle sort order if same column
    sortOrder.value = sortOrder.value === 'ASC' ? 'DESC' : 'ASC';
  } else {
    // New column, default to ASC
    sortColumn.value = column;
    sortOrder.value = 'ASC';
  }
  
  currentPage.value = 1; // Reset to first page when sorting
  fetchData();
}

// Load data on mount
onMounted(() => {
  fetchData();
});
</script>

<style scoped>
.table-header {
  overflow-x: auto;
}

.table-body {
  overflow-x: auto;
  max-height: 600px;
  overflow-y: auto;
}

.header-cell,
.cell {
  min-width: 150px;
}

.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
