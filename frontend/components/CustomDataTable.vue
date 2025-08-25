<script setup>
const props = defineProps({
  initialData: {
    type: Array,
    default: () => []
  },
  columns: {
    type: Array,
    required: true
  },
  editable: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits([
  'cell-updated',
  'row-selected',
  'rows-removed',
  'column-removed',
  'data-changed'
]);

const tableState = reactive({
  columns: [],
  rows: [],
  selectedRows: new Set(),
  selectedColumns: new Set(),
  allRowsSelected: false,
  sortColumn: null,
  sortDirection: null,
  editingCell: null,
  showColumnMenu: null,
  columnMenuPosition: { left: '0px', top: '0px' }
});

// Computed properties
const visibleColumns = computed(() => 
  tableState.columns.filter(col => col.visible)
);

const sortedRows = computed(() => {
  if (!tableState.sortColumn) return tableState.rows;
  
  return [...tableState.rows].sort((a, b) => {
    const aVal = a.data[tableState.sortColumn];
    const bVal = b.data[tableState.sortColumn];
    
    let comparison = 0;
    if (aVal < bVal) comparison = -1;
    if (aVal > bVal) comparison = 1;
    
    return tableState.sortDirection === 'desc' ? -comparison : comparison;
  });
});

const someRowsSelected = computed(() => 
  tableState.selectedRows.size > 0 && tableState.selectedRows.size < tableState.rows.length
);

const someColumnsSelected = computed(() => 
  tableState.selectedColumns.size > 0 && tableState.selectedColumns.size < visibleColumns.value.length
);

const allColumnsSelected = computed(() => 
  tableState.selectedColumns.size === visibleColumns.value.length && visibleColumns.value.length > 0
);

const selectedRows = computed(() => tableState.selectedRows);
const selectedColumns = computed(() => tableState.selectedColumns);
const allRowsSelected = computed(() => tableState.allRowsSelected);
const sortColumn = computed(() => tableState.sortColumn);
const sortDirection = computed(() => tableState.sortDirection);
const showColumnMenu = computed(() => tableState.showColumnMenu);
const columnMenuPosition = computed(() => tableState.columnMenuPosition);

// Row selection methods
function toggleRowSelection(rowId) {
  if (tableState.selectedRows.has(rowId)) {
    tableState.selectedRows.delete(rowId);
  } else {
    tableState.selectedRows.add(rowId);
  }
  updateAllRowsSelectedState();
  
  emit('row-selected', {
    rowId,
    selected: tableState.selectedRows.has(rowId),
    selectedCount: tableState.selectedRows.size
  });
}

function toggleAllRows() {
  if (tableState.allRowsSelected) {
    tableState.selectedRows.clear();
    tableState.allRowsSelected = false;
  } else {
    tableState.rows.forEach(row => tableState.selectedRows.add(row.id));
    tableState.allRowsSelected = true;
  }
  
  emit('row-selected', {
    allSelected: tableState.allRowsSelected,
    selectedCount: tableState.selectedRows.size
  });
}

function updateAllRowsSelectedState() {
  tableState.allRowsSelected = tableState.selectedRows.size === tableState.rows.length;
}

function toggleAllColumns() {
  if (allColumnsSelected.value) {
    tableState.selectedColumns.clear();
  } else {
    visibleColumns.value.forEach(column => tableState.selectedColumns.add(column.id));
  }
}

function toggleColumnSelection(columnId, event) {
  // Prevent event from bubbling to header click handler
  event.stopPropagation();
  
  if (tableState.selectedColumns.has(columnId)) {
    tableState.selectedColumns.delete(columnId);
  } else {
    tableState.selectedColumns.add(columnId);
  }
}

function removeSelectedRows() {
  const removedRows = tableState.rows.filter(row => tableState.selectedRows.has(row.id));
  tableState.rows = tableState.rows.filter(row => !tableState.selectedRows.has(row.id));
  tableState.selectedRows.clear();
  tableState.allRowsSelected = false;
  
  emit('rows-removed', {
    removedRows,
    remainingCount: tableState.rows.length
  });
};

function removeAllRows() {
  const removedRows = [...tableState.rows];
  tableState.rows = [];
  tableState.selectedRows.clear();
  tableState.allRowsSelected = false;
  
  emit('rows-removed', {
    removedRows,
    remainingCount: 0,
    allRemoved: true
  });
};

// Column selection and management
function handleColumnHeaderClick(column, event) {
  if (event.ctrlKey || event.metaKey) {
    // Multi-select with Ctrl/Cmd
    toggleColumnSelection(column.id, event);
    showSelectionFeedback(`Column "${column.title}" ${selectedColumns.value.has(column.id) ? 'selected' : 'deselected'}`);
  } else if (event.shiftKey && selectedColumns.value.size > 0) {
    // Range selection with Shift
    expandColumnSelection(column.id);
    showSelectionFeedback(`Range selection extended to "${column.title}"`);
  } else if (event.altKey) {
    // Alt+click for single column selection
    selectedColumns.value.clear();
    selectedColumns.value.add(column.id);
    showSelectionFeedback(`Single column "${column.title}" selected`);
  } else if (column.sortable) {
    // Single click for sorting
    handleColumnSort(column.key);
  } else {
    // If not sortable, allow simple column selection
    toggleColumnSelection(column.id, event);
    showSelectionFeedback(`Column "${column.title}" ${selectedColumns.value.has(column.id) ? 'selected' : 'deselected'}`);
  }
}

function handleColumnSort(columnKey) {
  if (tableState.sortColumn === columnKey) {
    // Toggle sort direction
    if (tableState.sortDirection === 'asc') {
      tableState.sortDirection = 'desc';
    } else if (tableState.sortDirection === 'desc') {
      tableState.sortColumn = null;
      tableState.sortDirection = null;
    }
  } else {
    // New column sort
    tableState.sortColumn = columnKey;
    tableState.sortDirection = 'asc';
  }
};

function expandColumnSelection(targetColumnId = null) {
  if (tableState.selectedColumns.size === 0) return;
  
  const columnIds = tableState.columns.map(col => col.id);
  const selectedIds = Array.from(tableState.selectedColumns);
  
  let startIndex = Math.min(...selectedIds.map(id => columnIds.indexOf(id)));
  let endIndex = Math.max(...selectedIds.map(id => columnIds.indexOf(id)));
  
  if (targetColumnId) {
    const targetIndex = columnIds.indexOf(targetColumnId);
    endIndex = Math.max(endIndex, targetIndex);
    startIndex = Math.min(startIndex, targetIndex);
  }
  
  // Select all columns in range
  for (let i = startIndex; i <= endIndex; i++) {
    if (columnIds[i] && tableState.columns.find(col => col.id === columnIds[i])?.visible) {
      tableState.selectedColumns.add(columnIds[i]);
    }
  }
}

function fillSelectionGaps() {
  if (tableState.selectedColumns.size < 2) return;
  
  const columnIds = visibleColumns.value.map(col => col.id);
  const selectedIds = Array.from(tableState.selectedColumns);
  
  const startIndex = Math.min(...selectedIds.map(id => columnIds.indexOf(id)));
  const endIndex = Math.max(...selectedIds.map(id => columnIds.indexOf(id)));
  
  let addedCount = 0;
  for (let i = startIndex; i <= endIndex; i++) {
    if (!tableState.selectedColumns.has(columnIds[i])) {
      tableState.selectedColumns.add(columnIds[i]);
      addedCount++;
    }
  }
  
  if (addedCount > 0) {
    showSelectionFeedback(`Added ${addedCount} columns to selection`);
  } else {
    showSelectionFeedback('No gaps to fill in selection');
  }
}

function selectAllColumns() {
  const initialCount = tableState.selectedColumns.size;
  visibleColumns.value.forEach(column => tableState.selectedColumns.add(column.id));
  const addedCount = tableState.selectedColumns.size - initialCount;
  
  if (addedCount > 0) {
    showSelectionFeedback(`Selected ${addedCount} additional columns`);
  } else {
    showSelectionFeedback('All columns already selected');
  }
}

  function showSelectionFeedback(message) {
    // Simple feedback - you could enhance this with a toast notification
    console.log(message);
    
    // Add visual feedback to selected elements (optional)
    setTimeout(() => {
      const selectedHeaders = document.querySelectorAll('.column-selected');
      selectedHeaders.forEach(header => {
        header.style.backgroundColor = '#dbeafe';
        setTimeout(() => {
          header.style.backgroundColor = '';
        }, 200);
      });
    }, 10);
  }

function removeSelectedColumns() {
  if (tableState.selectedColumns.size === 0) {
    return;
  }
  const removedColumns = tableState.columns.filter(col => tableState.selectedColumns.has(col.id));
  tableState.columns = tableState.columns.filter(col => !tableState.selectedColumns.has(col.id));
  
  // Clean up row data
  tableState.rows.forEach(row => {
    removedColumns.forEach(col => {
      delete row.data[col.key];
    });
  });
  
  tableState.selectedColumns.clear();
  
  emit('column-removed', {
    removedColumns,
    remainingColumns: tableState.columns
  });
}

function removeColumn(columnId) {
  const column = tableState.columns.find(col => col.id === columnId);
  if (!column) return;
  
  tableState.columns = tableState.columns.filter(col => col.id !== columnId);
  
  // Remove data from all rows
  tableState.rows.forEach(row => {
    delete row.data[column.key];
  });
  
  tableState.showColumnMenu = null;
  
  emit('column-removed', {
    removedColumns: [column],
    remainingColumns: tableState.columns
  });
}

function sortColumnByDirection(columnId, direction) {
  const column = tableState.columns.find(col => col.id === columnId);
  if (column) {
    tableState.sortColumn = column.key;
    tableState.sortDirection = direction;
  }
  tableState.showColumnMenu = null;
}

// Cell editing functionality
function isEditing(rowId, columnKey) {
  return tableState.editingCell?.rowId === rowId && 
         tableState.editingCell?.columnKey === columnKey;
}

function startEditing(rowId, columnKey) {
  const column = tableState.columns.find(col => col.key === columnKey);
  if (!column?.editable) return;
  
  // Store original value for potential cancellation
  const row = tableState.rows.find(r => r.id === rowId);
  const originalValue = row?.data[columnKey];
  
  tableState.editingCell = { 
    rowId, 
    columnKey, 
    originalValue 
  };
  
  // Focus input in next tick
  nextTick(() => {
    const input = document.querySelector('.cell-input');
    if (input) {
      input.focus();
      input.select();
    }
  });
}

function stopEditing() {
  tableState.editingCell = null;
}

function cancelEditing(){
  if (tableState.editingCell) {
    // Restore original value
    const { rowId, columnKey, originalValue } = tableState.editingCell;
    const row = tableState.rows.find(r => r.id === rowId);
    if (row) {
      row.data[columnKey] = originalValue;
    }
  }
  tableState.editingCell = null;
}

function updateCellValue(rowId, columnKey, newValue) {
  const row = tableState.rows.find(r => r.id === rowId);
  if (!row) return;
  
  const column = tableState.columns.find(col => col.key === columnKey);
  if (!column) return;
  
  const oldValue = row.data[columnKey];
  
  // Type conversion based on column type
  let processedValue = newValue;
  switch (column.type) {
    case 'number':
      processedValue = parseFloat(newValue) || 0;
      break;
    case 'boolean':
      processedValue = newValue === 'true' || newValue === true;
      break;
    case 'date':
      processedValue = new Date(newValue);
      break;
    default:
      processedValue = String(newValue);
  }
  
  // Update the data immediately
  row.data[columnKey] = processedValue;
  
  // Emit change event
  emit('cell-updated', {
    rowId,
    columnKey,
    oldValue,
    newValue: processedValue,
    row: row.data
  });
  
  emit('data-changed', {
    type: 'cell-update',
    data: tableState.rows
  });
}

function getCellValue(row, columnKey) {
  return row.data[columnKey] ?? '';
}

function formatCellValue(value, columnType) {
  if (value === null || value === undefined || value === '') return '';
  
  switch (columnType) {
    case 'date':
      return value instanceof Date ? value.toLocaleDateString() : value;
    case 'boolean':
      return value ? 'Yes' : 'No';
    case 'number':
      return typeof value === 'number' ? value.toLocaleString() : value;
    default:
      return String(value);
  }
}

// Context menu
function toggleColumnMenu(columnId, event) {
  console.log('Toggle column menu called for column:', columnId);
  
  if (tableState.showColumnMenu === columnId) {
    tableState.showColumnMenu = null;
    console.log('Menu closed');
    return;
  }
  
  tableState.showColumnMenu = columnId;
  
  // Get the position relative to the viewport
  const rect = event.currentTarget.getBoundingClientRect();
  const menuWidth = 150; // min-w-[150px]
  const menuHeight = 120; // approximate height
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  // Calculate optimal position
  let left = rect.left;
  let top = rect.bottom + 5;
  
  // Adjust if menu would go off-screen horizontally
  if (left + menuWidth > viewportWidth) {
    left = rect.right - menuWidth;
  }
  
  // Adjust if menu would go off-screen vertically
  if (top + menuHeight > viewportHeight) {
    top = rect.top - menuHeight - 5;
  }
  
  const menuPosition = {
    left: Math.max(5, left) + 'px',
    top: Math.max(5, top) + 'px'
  };
  
  tableState.columnMenuPosition = menuPosition;
  console.log('Menu opened at position:', menuPosition);
}

// Watch for prop changes
watch(() => props.initialData, (newData) => {
  tableState.rows = newData.map((rowData, index) => ({
    id: `row_${Date.now()}_${index}`,
    selected: false,
    data: { ...rowData }
  }));
}, { deep: true });

// Expose methods for parent component
defineExpose({
  getTableData: () => tableState.rows.map(row => row.data),
  clearSelection: () => {
    tableState.selectedRows.clear();
    tableState.selectedColumns.clear();
    tableState.allRowsSelected = false;
  }
});

function handleEscapeKey(e) {
    if (e.key === 'Escape') {
        tableState.showColumnMenu = null;
    }
}

function handleClickOutside(e) {
  if (!e.target.closest('.column-menu') && !e.target.closest('.column-menu-trigger')) {
    tableState.showColumnMenu = null;
  }
}

onMounted(() => {
    console.log('CustomDataTable tableState', tableState);
    tableState.columns = props.columns.map(col => ({
        id: `col_${Date.now()}_${Math.random()}`,
        ...col,
        width: col.width || 150,
        visible: col.visible !== false,
        sortable: col.sortable !== false,
        editable: col.editable !== false
    }));

    tableState.rows = props.initialData.map((rowData, index) => ({
        id: `row_${Date.now()}_${index}`,
        selected: false,
        data: { ...rowData }
    }));
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleEscapeKey);
});

onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
    document.removeEventListener('keydown', handleEscapeKey);
});  
</script>
<template>
  <div class="w-full">
    <!-- Table Toolbar -->
    <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-4 gap-4">
      <!-- Selection Info & Actions -->
      <div class="flex flex-wrap gap-2 items-center">
        <!-- Selection Info -->
        <div class="flex items-center gap-4 text-sm text-gray-600">
          <span v-if="selectedRows.size > 0" class="px-2 py-1 bg-blue-100 text-blue-700 rounded">
            {{ selectedRows.size }} row{{ selectedRows.size !== 1 ? 's' : '' }} selected
          </span>
          <span v-if="selectedColumns.size > 0" class="px-2 py-1 bg-purple-100 text-purple-700 rounded">
            {{ selectedColumns.size }} column{{ selectedColumns.size !== 1 ? 's' : '' }} selected
          </span>
        </div>
        
        <!-- Row Actions -->
        <button 
          v-if="selectedRows.size > 0"
          @click="removeSelectedRows"
          class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center gap-2"
        >
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clip-rule="evenodd"/>
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v4a1 1 0 102 0V5z" clip-rule="evenodd"/>
          </svg>
          Remove Selected ({{ selectedRows.size }})
        </button>
        <button 
          @click="removeAllRows"
          class="border border-red-500 text-red-500 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
        >
          Clear All Rows
        </button>
      </div>
      
      <!-- Column Actions -->
      <div class="flex flex-wrap gap-2">
        <button 
          v-if="selectedColumns.size > 0"
          @click="removeSelectedColumns"
          class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
        >
          Remove Columns ({{ selectedColumns.size }})
        </button>
        <button 
          @click="selectAllColumns" 
          class="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
          :disabled="allColumnsSelected"
          :class="{ 'opacity-50 cursor-not-allowed': allColumnsSelected }"
        >
          Select All Columns
        </button>
        <button 
          v-if="selectedColumns.size > 0"
          @click="selectedColumns.clear()"
          class="border border-purple-500 text-purple-500 hover:bg-purple-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
        >
          Clear Column Selection
        </button>
      </div>
    </div>

    <!-- Main Table Container -->
    <div class="overflow-auto border border-gray-300 rounded-lg shadow-sm max-h-screen">
      <table class="w-full border-collapse bg-white">
        <!-- Column Headers -->
        <thead class="sticky top-0 bg-gray-50 z-10">
          <!-- Column Selection Row -->
          <tr class="border-b border-gray-200 bg-gray-100">
            <th class="w-12 p-2 border-r border-gray-200 text-center">
              <span class="text-xs text-gray-500">Select</span>
            </th>
            <th 
              v-for="column in visibleColumns" 
              :key="`select-${column.id}`"
              class="border-r border-gray-200 p-2 text-center"
            >
              <input 
                type="checkbox"
                :checked="selectedColumns.has(column.id)"
                @change="toggleColumnSelection(column.id, $event)"
                class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                :title="`Select column: ${column.title}`"
              />
            </th>
          </tr>
          
          <!-- Main Header Row -->
          <tr class="border-b border-gray-200">
            <!-- Row Selection Header -->
            <th class="w-12 p-3 border-r border-gray-200 text-center">
              <input 
                type="checkbox"
                :checked="allRowsSelected"
                :indeterminate="someRowsSelected"
                @change="toggleAllRows"
                class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
              />
            </th>
            
            <!-- Dynamic Column Headers -->
            <th 
              v-for="column in visibleColumns" 
              :key="column.id"
              class="relative border-r border-gray-200 p-3 text-left font-semibold text-gray-900 select-none group"
              :class="[
                selectedColumns.has(column.id) ? 'bg-blue-100 border-blue-300' : 'bg-gray-50',
                column.sortable ? 'cursor-pointer hover:bg-gray-100' : 'cursor-pointer hover:bg-gray-100'
              ]"
              :style="{ width: column.width + 'px', minWidth: column.width + 'px' }"
              :title="`Click to ${column.sortable ? 'sort' : 'select'}, Ctrl+Click for multi-select, Shift+Click for range select, Alt+Click for single select`"
              @click="handleColumnHeaderClick(column, $event)"
            >
              <!-- Column Title and Sort Indicator -->
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-2">
                  <span class="truncate">{{ column.title }}</span>
                  <!-- Selection indicator -->
                  <div v-if="selectedColumns.has(column.id)" class="w-2 h-2 bg-blue-500 rounded-full" title="Selected"></div>
                </div>
                
                <!-- Sort Indicator -->
                <div v-if="column.sortable" class="mr-2 flex-shrink-0">
                  <svg 
                    v-if="sortColumn === column.key && sortDirection === 'asc'"
                    class="w-4 h-4 text-blue-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
                  </svg>
                  <svg 
                    v-else-if="sortColumn === column.key && sortDirection === 'desc'"
                    class="w-4 h-4 text-blue-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path fill-rule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clip-rule="evenodd"/>
                  </svg>
                  <svg 
                    v-else
                    class="w-4 h-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/>
                  </svg>
                </div>
              </div>
              
              <!-- Column Menu Trigger -->
              <div 
                class="absolute top-1 right-1 w-6 h-6 rounded hover:bg-gray-200 opacity-0 group-hover:opacity-100 cursor-pointer flex items-center justify-center transition-all duration-200 column-menu-trigger"
                @click.stop="toggleColumnMenu(column.id, $event)"
                :class="{ 'bg-blue-200 opacity-100': showColumnMenu === column.id }"
              >
                <svg class="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/>
                </svg>
              </div>
            </th>
          </tr>
        </thead>

        <!-- Table Body -->
        <tbody class="divide-y divide-gray-200">
          <tr 
            v-for="row in sortedRows" 
            :key="row.id"
            class="hover:bg-gray-50 transition-colors duration-150"
            :class="selectedRows.has(row.id) ? 'bg-blue-50' : 'bg-white'"
          >
            <!-- Row Selection Cell -->
            <td class="w-12 p-3 border-r border-gray-200 text-center">
              <input 
                type="checkbox"
                :checked="selectedRows.has(row.id)"
                @change="toggleRowSelection(row.id)"
                class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
              />
            </td>
            
            <!-- Data Cells -->
            <td 
              v-for="column in visibleColumns"
              :key="`${row.id}-${column.id}`"
              class="border-r border-gray-200 p-1 relative align-top"
              :class="isEditing(row.id, column.key) ? 'p-0' : ''"
              @click="startEditing(row.id, column.key)"
            >
              <!-- Edit Mode -->
              <div v-if="isEditing(row.id, column.key)" class="w-full">
                <input 
                  v-if="column.type === 'text' || column.type === 'number'"
                  :type="column.type === 'number' ? 'number' : 'text'"
                  :value="getCellValue(row, column.key)"
                  @input="updateCellValue(row.id, column.key, $event.target.value)"
                  @blur="stopEditing"
                  @keydown.enter="stopEditing"
                  @keydown.escape="cancelEditing"
                  class="w-full h-full p-2 border-0 outline-none bg-white focus:ring-2 focus:ring-blue-500 focus:ring-inset"
                  ref="cellInput"
                />
                
                <select 
                  v-else-if="column.type === 'boolean'"
                  :value="getCellValue(row, column.key)"
                  @change="updateCellValue(row.id, column.key, $event.target.value === 'true')"
                  @blur="stopEditing"
                  class="w-full h-full p-2 border-0 outline-none bg-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="true">True</option>
                  <option value="false">False</option>
                </select>
                
                <input 
                  v-else-if="column.type === 'date'"
                  type="date"
                  :value="getCellValue(row, column.key)"
                  @input="updateCellValue(row.id, column.key, $event.target.value)"
                  @blur="stopEditing"
                  class="w-full h-full p-2 border-0 outline-none bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <!-- Display Mode -->
              <div v-else class="p-3 min-h-[48px] cursor-text flex items-center">
                <span class="truncate max-w-[200px]">
                  {{ formatCellValue(getCellValue(row, column.key), column.type) }}
                </span>
              </div>
            </td>
          </tr>
          
          <!-- Empty State -->
          <tr v-if="tableState.rows.length === 0">
            <td :colspan="visibleColumns.length + 1" class="text-center p-8 text-gray-500">
              <div class="flex flex-col items-center gap-2">
                <svg class="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                <p class="text-lg font-medium">No data available</p>
                <p class="text-sm">Upload a file or add data to get started</p>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Column Context Menu -->
    <Transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0 scale-95 transform translate-y-1"
      enter-to-class="opacity-100 scale-100 transform translate-y-0"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100 scale-100 transform translate-y-0"
      leave-to-class="opacity-0 scale-95 transform translate-y-1"
    >
      <div 
        v-if="showColumnMenu"
        class="fixed bg-white border border-gray-300 rounded-lg shadow-lg z-50 py-1 min-w-[150px] column-menu"
        :style="columnMenuPosition"
      >
        <button 
          @click="sortColumnByDirection(showColumnMenu, 'asc')" 
          class="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center gap-2 transition-colors duration-150"
        >
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
          </svg>
          Sort Ascending
        </button>
        <button 
          @click="sortColumnByDirection(showColumnMenu, 'desc')" 
          class="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center gap-2 transition-colors duration-150"
        >
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clip-rule="evenodd"/>
          </svg>
          Sort Descending
        </button>
        <hr class="my-1 border-gray-200">
        <button 
          @click="removeColumn(showColumnMenu)" 
          class="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 text-sm flex items-center gap-2 transition-colors duration-150"
        >
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clip-rule="evenodd"/>
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v4a1 1 0 102 0V5z" clip-rule="evenodd"/>
          </svg>
          Remove Column
        </button>        
      </div>
    </Transition>

    <!-- Help Section -->
    <div class="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
      <div class="text-xs text-gray-600">
        <strong>Column Selection:</strong> 
        Click column headers to select • 
        <kbd class="px-1 py-0.5 bg-white border border-gray-300 rounded text-xs">Ctrl</kbd> + Click for multi-select • 
        <kbd class="px-1 py-0.5 bg-white border border-gray-300 rounded text-xs">Shift</kbd> + Click for range select • 
        <kbd class="px-1 py-0.5 bg-white border border-gray-300 rounded text-xs">Alt</kbd> + Click for single select
      </div>
    </div>
  </div>
</template>
