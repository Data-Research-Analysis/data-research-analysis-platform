<template>
  <div class="resizable-table w-full">
    <!-- Table Controls -->
    <div class="table-controls bg-gray-50 border border-gray-300 rounded-t-lg px-4 py-3 flex items-center justify-between">
      <div class="text-sm text-gray-600 flex items-center gap-2">
        <font-awesome-icon :icon="['fas', 'table']" />
        <span>{{ rows.length }} rows</span>
      </div>
      <div class="flex items-center gap-3">
        <button 
          @click="resetLayout" 
          class="text-sm text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-2"
          title="Reset column widths and order"
        >
          <font-awesome-icon :icon="['fas', 'arrow-rotate-right']" />
          Reset Layout
        </button>
        <button 
          v-if="allowColumnVisibility"
          @click="showColumnSelector = !showColumnSelector" 
          class="text-sm text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-2"
          title="Show/hide columns"
        >
          <font-awesome-icon :icon="['fas', 'eye']" />
          Columns
        </button>
      </div>
    </div>
    
    <!-- Column Visibility Selector (dropdown) -->
    <div v-if="showColumnSelector && allowColumnVisibility" class="column-selector bg-white border-x border-gray-300 p-4">
      <div class="text-sm font-semibold text-gray-700 mb-2">Show/Hide Columns</div>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        <label 
          v-for="col in allColumns" 
          :key="col.name" 
          class="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-2 rounded"
        >
          <input 
            type="checkbox" 
            :checked="visibleColumnNames.includes(col.name)"
            @change="toggleColumnVisibility(col.name)"
            class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span>{{ col.name }}</span>
        </label>
      </div>
    </div>
    
    <!-- Table Container -->
    <div class="table-container overflow-x-auto border-x border-gray-300">
      <table class="w-full border-collapse">
        <!-- Table Header -->
        <thead class="bg-gray-100 border-b border-gray-300 sticky top-0 z-10">
          <tr>
            <th 
              v-for="(col, idx) in visibleColumns" 
              :key="col.name"
              :style="{ width: columnWidths[col.name] || 'auto', minWidth: minColumnWidth + 'px' }"
              class="header-cell relative"
              :draggable="allowReorder"
              @dragstart="onDragStart(idx, $event)"
              @dragover.prevent="onDragOver(idx)"
              @drop="onDrop(idx)"
              @dragend="onDragEnd"
            >
              <div class="flex items-center justify-between px-4 py-3">
                <div class="flex items-center gap-2">
                  <font-awesome-icon 
                    v-if="allowReorder"
                    :icon="['fas', 'grip-vertical']" 
                    class="text-gray-400 cursor-move text-xs"
                  />
                  <span 
                    class="font-semibold text-sm truncate"
                    :class="{ 'cursor-pointer hover:text-blue-600': sortable }"
                    @click="sortable ? sortBy(col.name) : null"
                  >
                    {{ col.name }}
                  </span>
                  <font-awesome-icon 
                    v-if="sortable && sortColumn === col.name"
                    :icon="['fas', sortOrder === 'ASC' ? 'arrow-up' : 'arrow-down']" 
                    class="text-xs text-blue-600"
                  />
                </div>
              </div>
              
              <!-- Resize Handle -->
              <div 
                v-if="allowResize"
                class="resize-handle absolute top-0 right-0 h-full w-1 bg-transparent hover:bg-blue-400 active:bg-blue-500 cursor-col-resize z-20 transition-colors"
                @mousedown="startResize(col.name, $event)"
              ></div>
            </th>
          </tr>
        </thead>
        
        <!-- Table Body -->
        <tbody>
          <tr 
            v-for="(row, rowIdx) in rows" 
            :key="rowIdx"
            class="border-b border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <td 
              v-for="col in visibleColumns" 
              :key="col.name"
              class="cell px-4 py-3 text-sm"
              :style="{ width: columnWidths[col.name] || 'auto' }"
            >
              <div class="truncate" :title="String(row[col.name])">
                {{ row[col.name] }}
              </div>
            </td>
          </tr>
          
          <!-- Empty State -->
          <tr v-if="rows.length === 0">
            <td :colspan="visibleColumns.length" class="px-4 py-12 text-center text-gray-500">
              <font-awesome-icon :icon="['fas', 'inbox']" class="text-4xl text-gray-400 mb-2" />
              <div>No data available</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <!-- Table Footer -->
    <div class="table-footer bg-gray-50 border border-gray-300 rounded-b-lg px-4 py-2 text-xs text-gray-500">
      <font-awesome-icon :icon="['fas', 'circle-info']" class="mr-2" />
      {{ allowReorder ? 'Drag column headers to reorder. ' : '' }}
      {{ allowResize ? 'Drag column edges to resize. ' : '' }}
      Preferences saved automatically.
    </div>
  </div>
</template>

<script setup lang="ts">
interface Column {
  name: string;
  type?: string;
  sortable?: boolean;
}

interface Props {
  columns: Column[];
  rows: any[];
  allowResize?: boolean;
  allowReorder?: boolean;
  allowColumnVisibility?: boolean;
  sortable?: boolean;
  minColumnWidth?: number;
  storageKey?: string; // LocalStoragekey for saving preferences
}

const props = withDefaults(defineProps<Props>(), {
  allowResize: true,
  allowReorder: true,
  allowColumnVisibility: true,
  sortable: true,
  minColumnWidth: 100,
  storageKey: 'resizable-table-prefs'
});

const emit = defineEmits<{
  (e: 'sort', data: { column: string; order: 'ASC' | 'DESC' }): void;
}>();

const allColumns = ref<Column[]>([...props.columns]);
const visibleColumnNames = ref<string[]>([...props.columns.map(c => c.name)]);
const columnOrder = ref<string[]>([...props.columns.map(c => c.name)]);
const columnWidths = ref<Record<string, string>>({});
const sortColumn = ref<string | null>(null);
const sortOrder = ref<'ASC' | 'DESC'>('ASC');
const showColumnSelector = ref(false);

// Drag and drop state
const draggedColumnIndex = ref<number | null>(null);
const dropTargetIndex = ref<number | null>(null);

// Resize state
const resizingColumn = ref<string | null>(null);
const resizeStartX = ref(0);
const resizeStartWidth = ref(0);

// Computed visible columns based on order and visibility
const visibleColumns = computed(() => {
  return columnOrder.value
    .filter(name => visibleColumnNames.value.includes(name))
    .map(name => allColumns.value.find(c => c.name === name)!)
    .filter(Boolean);
});

// Load preferences from localStorage
function loadPreferences() {
  if (!import.meta.client) return;
  
  try {
    const saved = localStorage.getItem(props.storageKey);
    if (saved) {
      const prefs = JSON.parse(saved);
      if (prefs.columnOrder) columnOrder.value = prefs.columnOrder;
      if (prefs.columnWidths) columnWidths.value = prefs.columnWidths;
      if (prefs.visibleColumns) visibleColumnNames.value = prefs.visibleColumns;
    }
  } catch (err) {
    console.error('[ResizableTable] Failed to load preferences:', err);
  }
}

// Save preferences to localStorage
function savePreferences() {
  if (!import.meta.client) return;
  
  try {
    const prefs = {
      columnOrder: columnOrder.value,
      columnWidths: columnWidths.value,
      visibleColumns: visibleColumnNames.value
    };
    localStorage.setItem(props.storageKey, JSON.stringify(prefs));
  } catch (err) {
    console.error('[ResizableTable] Failed to save preferences:', err);
  }
}

// Drag and drop handlers
function onDragStart(index: number, event: DragEvent) {
  if (!props.allowReorder) return;
  draggedColumnIndex.value = index;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
  }
}

function onDragOver(index: number) {
  if (!props.allowReorder) return;
  dropTargetIndex.value = index;
}

function onDrop(index: number) {
  if (!props.allowReorder || draggedColumnIndex.value === null) return;
  
  const draggedName = columnOrder.value[draggedColumnIndex.value];
  const newOrder = [...columnOrder.value];
  
  // Remove dragged item
  newOrder.splice(draggedColumnIndex.value, 1);
  // Insert at new position
  newOrder.splice(index, 0, draggedName);
  
  columnOrder.value = newOrder;
  savePreferences();
  
  draggedColumnIndex.value = null;
  dropTargetIndex.value = null;
}

function onDragEnd() {
  draggedColumnIndex.value = null;
  dropTargetIndex.value = null;
}

// Resize handlers
function startResize(columnName: string, event: MouseEvent) {
  if (!props.allowResize) return;
  
  event.preventDefault();
  resizingColumn.value = columnName;
  resizeStartX.value = event.clientX;
  
  // Get current width
  const th = (event.target as HTMLElement).closest('th');
  if (th) {
    resizeStartWidth.value = th.offsetWidth;
  }
  
  document.addEventListener('mousemove', handleResize);
  document.addEventListener('mouseup', stopResize);
}

function handleResize(event: MouseEvent) {
  if (!resizingColumn.value) return;
  
  const deltaX = event.clientX - resizeStartX.value;
  const newWidth = Math.max(props.minColumnWidth, resizeStartWidth.value + deltaX);
  
  columnWidths.value[resizingColumn.value] = `${newWidth}px`;
}

function stopResize() {
  if (resizingColumn.value) {
    savePreferences();
  }
  
  resizingColumn.value = null;
  document.removeEventListener('mousemove', handleResize);
  document.removeEventListener('mouseup', stopResize);
}

// Column visibility
function toggleColumnVisibility(columnName: string) {
  const index = visibleColumnNames.value.indexOf(columnName);
  if (index > -1) {
    // Don't allow hiding all columns
    if (visibleColumnNames.value.length > 1) {
      visibleColumnNames.value.splice(index, 1);
      savePreferences();
    }
  } else {
    visibleColumnNames.value.push(columnName);
    savePreferences();
  }
}

// Sorting
function sortBy(columnName: string) {
  if (!props.sortable) return;
  
  if (sortColumn.value === columnName) {
    sortOrder.value = sortOrder.value === 'ASC' ? 'DESC' : 'ASC';
  } else {
    sortColumn.value = columnName;
    sortOrder.value = 'ASC';
  }
  
  emit('sort', { column: columnName, order: sortOrder.value });
}

// Reset layout
function resetLayout() {
  columnOrder.value = [...props.columns.map(c => c.name)];
  columnWidths.value = {};
  visibleColumnNames.value = [...props.columns.map(c => c.name)];
  sortColumn.value = null;
  sortOrder.value = 'ASC';
  savePreferences();
}

// Watch for column changes
watch(() => props.columns, (newColumns) => {
  allColumns.value = [...newColumns];
  
  // Add any new columns to order and visible list
  const newColumnNames = newColumns.map(c => c.name);
  const addedColumns = newColumnNames.filter(name => !columnOrder.value.includes(name));
  
  if (addedColumns.length > 0) {
    columnOrder.value.push(...addedColumns);
    visibleColumnNames.value.push(...addedColumns);
  }
}, { deep: true });

// Load preferences on mount
onMounted(() => {
  loadPreferences();
});

// Cleanup resize listeners on unmount
onUnmounted(() => {
  document.removeEventListener('mousemove', handleResize);
  document.removeEventListener('mouseup', stopResize);
});

// Expose methods
defineExpose({
  resetLayout,
  loadPreferences,
  savePreferences
});
</script>

<style scoped>
.header-cell {
  user-select: none;
}

.header-cell[draggable="true"] {
  cursor: move;
}

.header-cell.dragging {
  opacity: 0.5;
}

/* Prevent text selection during resize */
.resizing {
  user-select: none;
}
</style>
