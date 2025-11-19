<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted, reactive } from 'vue';

const emit = defineEmits(['segment-click', 'resize-needed']);

const state = reactive({
  hoveredRow: null,
  // Virtual scrolling state
  scrollTop: 0,
  containerHeight: 0,
  visibleStartIndex: 0,
  visibleEndIndex: 0,
  totalHeight: 0
});

const props = defineProps({
  chartId: {
    type: String,
    required: true,
  },
  data: {
    type: Object,
    required: true,
    // Expected format: { columns: ['col1', 'col2'], rows: [{col1: 'val1', col2: 'val2'}] }
  },
  width: {
    type: Number,
    default: 400,
  },
  height: {
    type: Number,
    default: 300,
  },
  enableScrollBars: {
    type: Boolean,
    default: true,
  },
  maxColumnWidth: {
    type: String,
    default: '200px',
  },
  minColumnWidth: {
    type: String,
    default: '100px',
  },
  showRowNumbers: {
    type: Boolean,
    default: false,
  },
  stickyHeader: {
    type: Boolean,
    default: true,
  },
  alternateRowColors: {
    type: Boolean,
    default: true,
  },
  virtualScrolling: {
    type: Boolean,
    default: false,
  },
  virtualScrollItemHeight: {
    type: Number,
    default: 35,
  },
  useContainerSizing: {
    type: Boolean,
    default: false,
  },
  filterState: {
    type: Object,
    default: () => ({ activeFilter: null, isFiltering: false }),
  },
});

// Computed properties
const tableColumns = computed(() => {
  if (!props.data?.columns) return [];
  return props.data.columns;
});

const tableRows = computed(() => {
  if (!props.data?.rows) return [];
  return props.data.rows;
});

const containerStyle = computed(() => {
  if (props.useContainerSizing) {
    return {
      width: '100%',
      height: '100%',
      maxWidth: props.width ? `${props.width}px` : 'none',
      maxHeight: props.height ? `${props.height}px` : 'none',
    };
  }
  return {
    width: `${props.width}px`,
    height: `${props.height}px`,
  };
});

const columnWidthClass = computed(() => {
  const colCount = tableColumns.value.length + (props.showRowNumbers ? 1 : 0);
  
  if (colCount <= 2) return 'w-1/2';
  if (colCount <= 3) return 'w-1/3';
  if (colCount <= 4) return 'w-1/4';
  if (colCount <= 5) return 'w-1/5';
  if (colCount <= 6) return 'w-1/6';
  if (colCount <= 8) return 'w-1/8';
  return 'w-1/12';
});

const dynamicColumnWidth = computed(() => {
  if (!props.useContainerSizing) return null;
  
  const availableWidth = props.width - (props.showRowNumbers ? 60 : 0) - 40; // margins
  const columnCount = tableColumns.value.length;
  const minWidth = parseInt(props.minColumnWidth.replace('px', ''));
  const maxWidth = parseInt(props.maxColumnWidth.replace('px', ''));
  
  if (columnCount === 0) return `${minWidth}px`;
  
  const calculatedWidth = Math.floor(availableWidth / columnCount);
  const finalWidth = Math.max(minWidth, Math.min(maxWidth, calculatedWidth));
  
  return `${finalWidth}px`;
});

const requiredContainerWidth = computed(() => {
  const columnCount = tableColumns.value.length;
  const minColumnWidth = parseInt(props.minColumnWidth.replace('px', ''));
  const rowNumberWidth = props.showRowNumbers ? 60 : 0;
  const padding = 40; // Container padding
  const scrollbarWidth = 20;
  
  return (columnCount * minColumnWidth) + rowNumberWidth + padding + scrollbarWidth;
});

// Virtual scrolling computed properties
const itemHeight = computed(() => props.virtualScrollItemHeight);

const visibleItemCount = computed(() => {
  if (!props.virtualScrolling) return tableRows.value.length;
  return Math.ceil(state.containerHeight / itemHeight.value) + 2; // +2 for buffer
});

const visibleRows = computed(() => {
  if (!props.virtualScrolling) return tableRows.value;
  
  const start = Math.max(0, state.visibleStartIndex);
  const end = Math.min(tableRows.value.length, state.visibleEndIndex);
  
  return tableRows.value.slice(start, end).map((row, index) => ({
    ...row,
    originalIndex: start + index
  }));
});

const paddingTop = computed(() => {
  if (!props.virtualScrolling) return 0;
  return state.visibleStartIndex * itemHeight.value;
});

const paddingBottom = computed(() => {
  if (!props.virtualScrolling) return 0;
  const remainingItems = tableRows.value.length - state.visibleEndIndex;
  return Math.max(0, remainingItems * itemHeight.value);
});

// Methods
function formatCellValue(value) {
  if (value == null) return '';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value.toString() : value.toFixed(2);
  }
  return String(value);
}

function truncateText(text, maxLength = 50) {
  if (String(text).length <= maxLength) return text;
  return String(text).substring(0, maxLength) + '...';
}

// Helper to get row matching value for filtering
function getRowMatchValue(row) {
  // Use first column value as the match criterion
  if (tableColumns.value.length > 0) {
    const firstCol = tableColumns.value[0];
    return String(row[firstCol] || '');
  }
  return '';
}

// Helper to determine if row matches filter
function rowMatchesFilter(row) {
  if (!props.filterState.isFiltering) return true;
  const rowValue = getRowMatchValue(row);
  return rowValue === String(props.filterState.activeFilter.value);
}

function onRowClick(row, index, event) {
  emit('segment-click', props.chartId, 'row', row.rowId || index);
}

// Virtual scrolling methods
function updateVisibleRange() {
  if (!props.virtualScrolling) return;
  
  const scrollTop = state.scrollTop;
  const containerHeight = state.containerHeight;
  const itemHeight = props.virtualScrollItemHeight;
  
  // If container height isn't measured yet, show initial rows
  if (containerHeight <= 0) {
    state.visibleStartIndex = 0;
    state.visibleEndIndex = Math.min(tableRows.value.length, 20); // Show first 20 rows initially
    return;
  }
  
  // Calculate visible range with buffer
  const buffer = 5;
  state.visibleStartIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - buffer);
  state.visibleEndIndex = Math.min(
    tableRows.value.length,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + buffer
  );
}

function handleScroll(event) {
  if (!props.virtualScrolling) return;
  
  state.scrollTop = event.target.scrollTop;
  updateVisibleRange();
}

function setupVirtualScrolling() {
  if (!props.virtualScrolling) return;
  
  nextTick(() => {
    // Only access DOM on client side for SSR compatibility
    if (!import.meta.client) return;
    
    const container = document.querySelector(`#table-chart-${props.chartId} .scroll-container`);
    if (container) {
      state.containerHeight = container.clientHeight;
      state.totalHeight = tableRows.value.length * props.virtualScrollItemHeight;
      updateVisibleRange();
    }
  });
}

// Watchers
watch(() => [props.width, props.height], () => {
  nextTick(() => {
    if (props.virtualScrolling) {
      setupVirtualScrolling();
    }
  });
});

watch(() => props.data, () => {
  if (props.virtualScrolling) {
    // Reset scroll position and recalculate visible range
    state.scrollTop = 0;
    updateVisibleRange(); // Initialize visible range immediately
    nextTick(() => {
      setupVirtualScrolling();
    });
  }
}, { deep: true });

watch(() => props.virtualScrolling, (newValue) => {
  if (newValue) {
    // Initialize visible range immediately when virtual scrolling is enabled
    updateVisibleRange();
    nextTick(() => {
      setupVirtualScrolling();
    });
  }
});

watch(() => tableColumns.value.length, (newCount, oldCount) => {
  if (newCount !== oldCount && props.useContainerSizing) {
    nextTick(() => {
      const currentWidth = props.width;
      const required = requiredContainerWidth.value;
      
      // Always emit resize event when column count changes to ensure container adapts
      emit('resize-needed', {
        requiredWidth: required,
        currentWidth: currentWidth,
        columnCount: newCount
      });
    });
  }
});

let resizeObserver = null;

onMounted(() => {
  // Only set up virtual scrolling on client side for SSR compatibility
  if (!import.meta.client) return;
  
  // Initialize visible range for virtual scrolling immediately
  if (props.virtualScrolling) {
    updateVisibleRange(); // This will show initial rows even before container is measured
    setupVirtualScrolling();
    
    // Watch for container size changes
    const container = document.querySelector(`#table-chart-${props.chartId} .scroll-container`);
    if (container) {
      resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
          state.containerHeight = entry.contentRect.height;
          updateVisibleRange();
        }
      });
      resizeObserver.observe(container);
    }
  }
});

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
});
</script>

<template>
  <div 
    :id="`table-chart-${props.chartId}`"
    class="border border-gray-300 overflow-hidden bg-white shadow-sm flex flex-col"
    :style="containerStyle"
  >
    <!-- Table Container with Scroll -->
    <div 
      class="flex-1 scroll-container"
      :class="[
        enableScrollBars ? 'overflow-auto' : 'overflow-hidden'
      ]"
      @scroll="handleScroll"
    >
      <table class="border-collapse text-sm" :class="useContainerSizing ? 'w-full min-w-full' : 'w-full'">
        <!-- Table Header -->
        <thead 
          :class="[
            'bg-gray-100 border-b border-gray-200',
            stickyHeader ? 'sticky top-0 z-10' : ''
          ]"
        >
          <tr>
            <!-- Row Number Column -->
            <th 
              v-if="showRowNumbers"
              class="w-16 px-3 py-2 text-left font-medium text-gray-700 border-r border-gray-200"
            >
              #
            </th>
            
            <!-- Data Columns -->
            <th
              v-for="column in tableColumns"
              :key="column"
              class="px-3 py-2 text-left font-medium text-gray-700 border-r border-gray-200 last:border-r-0"
              :class="useContainerSizing ? '' : columnWidthClass"
              :style="useContainerSizing ? { 
                width: dynamicColumnWidth,
                minWidth: minColumnWidth, 
                maxWidth: maxColumnWidth 
              } : { 
                minWidth: minColumnWidth, 
                maxWidth: maxColumnWidth 
              }"
            >
              <span class="truncate" :title="column">
                {{ column }}
              </span>
            </th>
          </tr>
        </thead>
        
        <!-- Table Body -->
        <tbody class="divide-y divide-gray-200">
          <!-- No Data Row -->
          <tr v-if="!tableRows.length" class="bg-gray-50">
            <td 
              :colspan="tableColumns.length + (showRowNumbers ? 1 : 0)"
              class="px-3 py-8 text-center text-gray-500"
            >
              No data available
            </td>
          </tr>
          
          <!-- Virtual scrolling spacer top -->
          <tr v-if="virtualScrolling && paddingTop > 0" :style="{ height: paddingTop + 'px' }">
            <td :colspan="tableColumns.length + (showRowNumbers ? 1 : 0)" class="p-0"></td>
          </tr>
          
          <!-- Visible rows -->
          <tr
            v-for="(row, index) in visibleRows"
            :key="virtualScrolling ? row.originalIndex : index"
            :style="virtualScrolling ? { height: itemHeight + 'px' } : {}"
            class="transition-all duration-300 cursor-pointer"
            :class="[
              alternateRowColors && (virtualScrolling ? row.originalIndex : index) % 2 === 1 ? 'bg-gray-50' : 'bg-white',
              'hover:bg-blue-50',
              rowMatchesFilter(row) && props.filterState.isFiltering ? 'border-l-4 border-blue-500 bg-blue-50 font-semibold' : '',
              !rowMatchesFilter(row) && props.filterState.isFiltering ? 'opacity-20' : 'opacity-100'
            ]"
            @click="onRowClick(row, virtualScrolling ? row.originalIndex : index, $event)"
            @mouseover="state.hoveredRow = virtualScrolling ? row.originalIndex : index"
            @mouseleave="state.hoveredRow = null"
          >
            <!-- Row Number Cell -->
            <td 
              v-if="showRowNumbers"
              class="w-16 px-3 py-2 text-gray-600 font-mono text-xs border-r border-gray-200"
            >
              {{ (virtualScrolling ? row.originalIndex : index) + 1 }}
            </td>
            
            <!-- Data Cells -->
            <td
              v-for="column in tableColumns"
              :key="column"
              class="px-3 py-2 border-r text-gray-700 border-gray-200 last:border-r-0"
              :class="useContainerSizing ? '' : columnWidthClass"
              :style="useContainerSizing ? { 
                width: dynamicColumnWidth,
                minWidth: minColumnWidth, 
                maxWidth: maxColumnWidth 
              } : { 
                minWidth: minColumnWidth, 
                maxWidth: maxColumnWidth 
              }"
            >
              <div 
                class="truncate"
                :title="formatCellValue(row[column])"
              >
                {{ truncateText(formatCellValue(row[column])) }}
              </div>
            </td>
          </tr>
          
          <!-- Virtual scrolling spacer bottom -->
          <tr v-if="virtualScrolling && paddingBottom > 0" :style="{ height: paddingBottom + 'px' }">
            <td :colspan="tableColumns.length + (showRowNumbers ? 1 : 0)" class="p-0"></td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <!-- Loading Overlay -->
    <div 
      v-if="!data?.columns?.length"
      class="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-20"
    >
      <div class="flex flex-col items-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
        <span class="text-gray-500 text-sm">Loading data...</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes pulse-selected {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.01); }
}
</style>
