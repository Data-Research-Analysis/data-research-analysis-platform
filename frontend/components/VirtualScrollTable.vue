<template>
  <div class="virtual-scroll-table w-full">
    <!-- Error State -->
    <div v-if="error" class="error-state bg-red-50 border border-red-200 rounded-lg p-6 text-center">
      <font-awesome-icon :icon="['fas', 'triangle-exclamation']" class="text-red-500 text-4xl mb-3" />
      <h3 class="text-lg font-semibold text-red-800 mb-2">Failed to Load Data</h3>
      <p class="text-red-600 mb-4">{{ error }}</p>
      <button 
        @click="loadInitialData" 
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

    <!-- Virtual Scroll Container -->
    <div v-else class="relative">
      <!-- Table Header (Fixed) -->
      <div class="bg-gray-100 border-b border-gray-300 sticky top-0 z-20">
        <div class="flex">
          <div 
            v-for="col in columns" 
            :key="col.name" 
            class="flex-1 px-4 py-3 font-semibold text-left cursor-pointer hover:bg-gray-200 transition-colors flex items-center gap-2 min-w-[150px]"
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
      
      <!-- Virtual Scroll Content -->
      <div 
        ref="scrollContainer"
        class="relative overflow-y-auto border border-gray-300 rounded-b-lg"
        :style="{ height: viewportHeight + 'px', willChange: 'scroll-position' }"
        @scroll="handleScroll"
      >
        <!-- Loading overlay -->
        <div v-if="loading" class="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
          <div class="text-center">
            <font-awesome-icon :icon="['fas', 'spinner']" spin class="text-3xl text-blue-600 mb-2" />
            <p class="text-sm text-gray-600">Loading data...</p>
          </div>
        </div>
        
        <!-- Spacer for total height -->
        <div :style="{ height: totalHeight + 'px', position: 'relative' }">
          <!-- Visible rows -->
          <div 
            :style="{ 
              transform: `translateY(${offsetY}px)`,
              position: 'absolute',
              width: '100%'
            }"
          >
            <div 
              v-for="(row, idx) in visibleRows" 
              :key="visibleStartIndex + idx" 
              class="table-row flex border-b border-gray-200 hover:bg-gray-50 transition-colors"
              :style="{ height: rowHeight + 'px' }"
            >
              <div 
                v-for="col in columns" 
                :key="col.name" 
                class="flex-1 px-4 py-3 text-sm truncate flex items-center min-w-[150px]"
                :title="String(row[col.name])"
              >
                {{ row[col.name] }}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Status Bar -->
      <div class="status-bar bg-white border-t border-gray-300 px-4 py-3 flex items-center justify-between text-sm text-gray-600">
        <div>
          Showing rows <strong>{{ visibleStartIndex + 1 }}</strong> to 
          <strong>{{ Math.min(visibleEndIndex, totalRows) }}</strong> of 
          <strong>{{ totalRows.toLocaleString() }}</strong>
        </div>
        <div class="text-xs text-gray-500">
          Scroll to load more • Auto-prefetching enabled
        </div>
      </div>
    </div>
  </div>
</template>
import type { ITableColumn } from '~/types/IDataModelData';

interface Props {
  dataModelId: number;
  rowHeight?: number;
  viewportHeight?: number;
  bufferSize?: number;
}

const props = withDefaults(defineProps<Props>(), {
  rowHeight: 40,
  viewportHeight: 600,
  bufferSize: 10
});

const dataModelsStore = useDataModelsStore();

const loading = ref(false);
const error = ref<string | null>(null);
const allData = ref<any[]>([]); // All loaded data in memory
const columns = ref<ITableColumn[]>([]);
const totalRows = ref(0);
const sortColumn = ref<string | null>(null);
const sortOrder = ref<'ASC' | 'DESC'>('ASC');

// Virtual scrolling state
const scrollContainer = ref<HTMLElement | null>(null);
const visibleStartIndex = ref(0);
const visibleEndIndex = ref(50);
const currentPage = ref(1);
const pageSize = 100;

// Computed values
const totalHeight = computed(() => totalRows.value * props.rowHeight);
const offsetY = computed(() => Math.max(0, visibleStartIndex.value - props.bufferSize) * props.rowHeight);
const visibleRows = computed(() => {
  const start = Math.max(0, visibleStartIndex.value - props.bufferSize);
  const end = Math.min(allData.value.length, visibleEndIndex.value + props.bufferSize);
  return allData.value.slice(start, end);
});

// Debounced scroll handler
const scrollHandler = debounce(() => {
  if (!scrollContainer.value) return;
  
  const scrollTop = scrollContainer.value.scrollTop;
  const newVisibleStartIndex = Math.floor(scrollTop / props.rowHeight);
  const visibleRowCount = Math.ceil(props.viewportHeight / props.rowHeight);
  
  visibleStartIndex.value = newVisibleStartIndex;
  visibleEndIndex.value = newVisibleStartIndex + visibleRowCount;
  
  // Prefetch next page if near end of loaded data
  const loadedRows = allData.value.length;
  if (visibleEndIndex.value > loadedRows - 20 && loadedRows < totalRows.value && !loading.value) {
    loadNextPage();
  }
}, 50);

function handleScroll() {
  scrollHandler();
}

async function loadInitialData() {
  loading.value = true;
  error.value = null;
  
  try {
    const response = await dataModelsStore.fetchDataModelData(
      props.dataModelId,
      1,
      pageSize,
      sortColumn.value || undefined,
      sortOrder.value
    );
    
    allData.value = response.data;
    totalRows.value = response.pagination.total;
    currentPage.value = 1;
    
    // Extract columns from first row
    if (allData.value.length > 0) {
      columns.value = Object.keys(allData.value[0]).map(name => ({ 
        name, 
        sortable: true 
      }));
    }
  } catch (err: any) {
    console.error('[VirtualScrollTable] Failed to load initial data:', err);
    error.value = err.message || 'An error occurred while fetching data';
  } finally {
    loading.value = false;
  }
}

async function loadNextPage() {
  if (loading.value) return;
  
  const nextPage = currentPage.value + 1;
  const maxPages = Math.ceil(totalRows.value / pageSize);
  
  if (nextPage > maxPages) return;
  
  loading.value = true;
  
  try {
    const response = await dataModelsStore.fetchDataModelData(
      props.dataModelId,
      nextPage,
      pageSize,
      sortColumn.value || undefined,
      sortOrder.value
    );
    
    // Append new data
    allData.value = [...allData.value, ...response.data];
    currentPage.value = nextPage;
    
    console.log(`[VirtualScrollTable] Loaded page ${nextPage}, total rows: ${allData.value.length}/${totalRows.value}`);
  } catch (err: any) {
    console.error('[VirtualScrollTable] Failed to load next page:', err);
    // Don't show error for prefetch failures, just log them
  } finally {
    loading.value = false;
  }
}

async function sortBy(column: string) {
  if (loading.value) return;
  
  if (sortColumn.value === column) {
    sortOrder.value = sortOrder.value === 'ASC' ? 'DESC' : 'ASC';
  } else {
    sortColumn.value = column;
    sortOrder.value = 'ASC';
  }
  
  // Reset data and reload
  allData.value = [];
  visibleStartIndex.value = 0;
  visibleEndIndex.value = 50;
  if (scrollContainer.value) {
    scrollContainer.value.scrollTop = 0;
  }
  
  await loadInitialData();
}

// Debounce utility
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return function(...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Load initial data on mount
onMounted(() => {
  loadInitialData();
});
</script>
