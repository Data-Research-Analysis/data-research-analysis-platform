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
    if (tableState.selectedColumns.has(column.id)) {
      tableState.selectedColumns.delete(column.id);
    } else {
      tableState.selectedColumns.add(column.id);
    }
  } else if (event.shiftKey && tableState.selectedColumns.size > 0) {
    // Range selection with Shift
    expandColumnSelection(column.id);
  } else if (column.sortable) {
    // Single click for sorting
    handleColumnSort(column.key);
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
  }
  
  // Select all columns in range
  for (let i = startIndex; i <= endIndex; i++) {
    tableState.selectedColumns.add(columnIds[i]);
  }
}

function removeSelectedColumns() {
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

function hideColumn(columnId) {
  const column = tableState.columns.find(col => col.id === columnId);
  if (column) {
    column.visible = false;
  }
  tableState.showColumnMenu = null;
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

// Column resizing
function startColumnResize(column, event) {
  event.preventDefault();
  event.stopPropagation();
  
  const startX = event.clientX;
  const startWidth = column.width;
  
  const handleMouseMove = (e) => {
    const diff = e.clientX - startX;
    const newWidth = Math.max(50, startWidth + diff);
    column.width = newWidth;
  };
  
  const handleMouseUp = () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = '';
  };
  
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
  document.body.style.cursor = 'col-resize';
}

// Context menu
function toggleColumnMenu(columnId, event) {
  if (tableState.showColumnMenu === columnId) {
    tableState.showColumnMenu = null;
    return;
  }
  
  tableState.showColumnMenu = columnId;
  
  const rect = event.target.getBoundingClientRect();
  tableState.columnMenuPosition = {
    left: rect.left + 'px',
    top: (rect.bottom + 5) + 'px'
  };
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
  addRow: (rowData) => {
    const newRow = {
      id: `row_${Date.now()}_${Math.random()}`,
      selected: false,
      data: { ...rowData }
    };
    tableState.rows.push(newRow);
  },
  clearSelection: () => {
    tableState.selectedRows.clear();
    tableState.selectedColumns.clear();
    tableState.allRowsSelected = false;
  }
});

onMounted(() => {
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

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.column-menu') && !e.target.closest('.column-menu-trigger')) {
      tableState.showColumnMenu = null;
    }
  });
});
</script>
<template>
  <div class="w-full">
    <!-- Table Toolbar -->
    <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-4 gap-4">
      <!-- Selection Actions -->
      <div class="flex flex-wrap gap-2">
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
          class="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
        >
          Remove Columns ({{ selectedColumns.size }})
        </button>
        <button 
          @click="expandColumnSelection" 
          class="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
        >
          Expand Selection
        </button>
      </div>
    </div>

    <!-- Main Table Container -->
    <div class="overflow-auto border border-gray-300 rounded-lg shadow-sm max-h-screen">
      <table class="w-full border-collapse bg-white">
        <!-- Column Headers -->
        <thead class="sticky top-0 bg-gray-50 z-10">
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
                column.sortable ? 'cursor-pointer hover:bg-gray-100' : ''
              ]"
              :style="{ width: column.width + 'px', minWidth: column.width + 'px' }"
              @click="handleColumnHeaderClick(column, $event)"
            >
              <!-- Column Title and Sort Indicator -->
              <div class="flex items-center justify-between">
                <span class="truncate">{{ column.title }}</span>
                
                <!-- Sort Indicator -->
                <div v-if="column.sortable" class="ml-2 flex-shrink-0">
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
              
              <!-- Column Resize Handle -->
              <div 
                class="absolute right-0 top-0 w-2 h-full cursor-col-resize bg-transparent hover:bg-blue-300 transition-colors duration-200 opacity-0 group-hover:opacity-100"
                @mousedown="startColumnResize(column, $event)"
              ></div>
              
              <!-- Column Menu Trigger -->
              <div 
                class="absolute top-1 right-1 w-6 h-6 rounded hover:bg-gray-200 opacity-0 group-hover:opacity-100 cursor-pointer flex items-center justify-center transition-all duration-200"
                @click.stop="toggleColumnMenu(column.id, $event)"
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
        class="absolute bg-white border border-gray-300 rounded-lg shadow-lg z-20 py-1 min-w-[150px]"
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
        <button 
          @click="hideColumn(showColumnMenu)" 
          class="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center gap-2 transition-colors duration-150"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L12 12m3.878-3.878L21 21"/>
          </svg>
          Hide Column
        </button>
      </div>
    </Transition>
  </div>
</template>
