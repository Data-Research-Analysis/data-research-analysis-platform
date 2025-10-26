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
  },
  // Sheet-related props
  sheets: {
    type: Array,
    default: () => []
  },
  activeSheetId: {
    type: String,
    default: null
  },
  allowMultipleSheets: {
    type: Boolean,
    default: true
  },
  maxSheets: {
    type: Number,
    default: 10
  }
});

const emit = defineEmits([
  'cell-updated',
  'row-selected',
  'rows-removed',
  'row-added',
  'row-duplicated',
  'column-removed',
  'column-renamed',
  'column-added',
  'column-duplicated',
  // Sheet-related events
  'sheet-changed',
  'sheet-created',
  'sheet-deleted',
  'sheet-renamed',
  'sheet-reordered',
  'sheet-duplicated'
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
  editingColumnId: null,
  originalColumnName: null,
  showColumnMenu: null,
  columnMenuPosition: { left: '0px', top: '0px' },
  showRowMenu: null,
  rowMenuPosition: { left: '0px', top: '0px' }
});

// Sheet management state
const sheetsState = reactive({
  sheets: [],
  activeSheetId: null,
  selectedSheets: new Set(),
  draggedSheet: null,
  showSheetMenu: null,
  sheetMenuPosition: { left: '0px', top: '0px' },
  editingSheetId: null,
  newSheetCounter: 1
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

const hasSelectionGaps = computed(() => {
  if (tableState.selectedColumns.size < 2) return false;
  
  const columnIds = visibleColumns.value.map(col => col.id);
  const selectedIds = Array.from(tableState.selectedColumns);
  
  const startIndex = Math.min(...selectedIds.map(id => columnIds.indexOf(id)));
  const endIndex = Math.max(...selectedIds.map(id => columnIds.indexOf(id)));
  
  // Check if there are any unselected columns between start and end
  for (let i = startIndex; i <= endIndex; i++) {
    if (!tableState.selectedColumns.has(columnIds[i])) {
      return true;
    }
  }
  return false;
});

const selectedRows = computed(() => tableState.selectedRows);
const selectedColumns = computed(() => tableState.selectedColumns);
const allRowsSelected = computed(() => tableState.allRowsSelected);
const sortColumn = computed(() => tableState.sortColumn);
const sortDirection = computed(() => tableState.sortDirection);
const showColumnMenu = computed(() => tableState.showColumnMenu);
const columnMenuPosition = computed(() => tableState.columnMenuPosition);
const showRowMenu = computed(() => tableState.showRowMenu);
const rowMenuPosition = computed(() => tableState.rowMenuPosition);

// Sheet computed properties
const activeSheet = computed(() => 
  sheetsState.sheets.find(sheet => sheet.id === sheetsState.activeSheetId)
);

const hasMultipleSheets = computed(() => 
  props.allowMultipleSheets && sheetsState.sheets.length > 1
);

const canCreateNewSheet = computed(() => 
  props.allowMultipleSheets && sheetsState.sheets.length < props.maxSheets
);

const isMultiSheetMode = computed(() => 
  props.allowMultipleSheets && (sheetsState.sheets.length > 0 || props.sheets.length > 0)
);

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
    showSelectionFeedback('All columns deselected');
  } else {
    visibleColumns.value.forEach(column => tableState.selectedColumns.add(column.id));
    showSelectionFeedback(`Selected all ${visibleColumns.value.length} columns`);
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

function removeRowByIndex(rowIndex) {
  if (rowIndex < 0 || rowIndex >= tableState.rows.length) return;
  
  const rowToRemove = tableState.rows[rowIndex];
  const removedRows = [rowToRemove];
  
  // Remove the row
  tableState.rows.splice(rowIndex, 1);
  
  // Update row indices for remaining rows
  updateRowIndices();
  
  // Clear selections that might reference the removed row
  tableState.selectedRows.delete(rowToRemove.id);
  tableState.allRowsSelected = false;
  
  console.log('Row removed by index:', rowIndex, 'Row data:', rowToRemove);
  emit('rows-removed', {
    removedRows,
    remainingCount: tableState.rows.length
  });
}

// Row addition functionality
function getDefaultValueForType(columnType) {
  switch (columnType) {
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'date':
      return new Date().toISOString().split('T')[0];
    case 'text':
    case 'email':
    case 'url':
    default:
      return '';
  }
}

function updateRowIndices() {
  tableState.rows.forEach((row, index) => {
    row.index = index;
  });
}

function addNewRow(position = 'end', defaultData = {}) {
  const newRowId = `row_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const newRow = {
    id: newRowId,
    index: 0, // Will be updated by updateRowIndices
    selected: false,
    data: { ...defaultData }
  };
  
  // Initialize empty data for all columns
  tableState.columns.forEach(column => {
    if (newRow.data[column.key] === undefined) {
      newRow.data[column.key] = getDefaultValueForType(column.type);
    }
  });
  
  // Insert at position
  if (position === 'end' || position >= tableState.rows.length) {
    tableState.rows.push(newRow);
  } else if (typeof position === 'number' && position >= 0) {
    tableState.rows.splice(position, 0, newRow);
  } else {
    tableState.rows.push(newRow);
  }
  
  // Update all row indices
  updateRowIndices();
  
  // Update sheet if in multi-sheet mode
  if (isMultiSheetMode.value && activeSheet.value) {
    activeSheet.value.rows = [...tableState.rows];
    activeSheet.value.metadata.rowCount = tableState.rows.length;
    activeSheet.value.metadata.modified = new Date();
  }
  
  emit('row-added', { 
    rowId: newRowId, 
    rowData: newRow, 
    position, 
    allRows: tableState.rows,
    rowCount: tableState.rows.length
  });
  
  showSelectionFeedback(`New row added`);
  return newRow;
}

function insertRowAt(index, defaultData = {}) {
  return addNewRow(index, defaultData);
}

function duplicateRow(rowId) {
  const sourceRow = tableState.rows.find(row => row.id === rowId);
  if (!sourceRow) return null;
  
  const newRowId = `row_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const duplicatedRow = {
    id: newRowId,
    index: 0, // Will be updated by updateRowIndices
    selected: false,
    data: { ...sourceRow.data }
  };
  
  // Insert after the source row
  const sourceIndex = tableState.rows.findIndex(row => row.id === rowId);
  tableState.rows.splice(sourceIndex + 1, 0, duplicatedRow);
  
  // Update all row indices
  updateRowIndices();
  
  // Update sheet if in multi-sheet mode
  if (isMultiSheetMode.value && activeSheet.value) {
    activeSheet.value.rows = [...tableState.rows];
    activeSheet.value.metadata.rowCount = tableState.rows.length;
    activeSheet.value.metadata.modified = new Date();
  }
  
  emit('row-duplicated', { 
    originalRowId: rowId, 
    newRowId, 
    rowData: duplicatedRow,
    position: sourceIndex + 1,
    allRows: tableState.rows
  });
  
  showSelectionFeedback(`Row duplicated`);
  return duplicatedRow;
}

function addMultipleRows(count = 1, position = 'end') {
  const addedRows = [];
  for (let i = 0; i < count; i++) {
    const newRow = addNewRow(position === 'end' ? 'end' : position + i);
    addedRows.push(newRow);
  }
  showSelectionFeedback(`Added ${count} rows`);
  return addedRows;
}

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
    // Console log for debugging
    console.log(message);
    
    // Create a toast-like notification
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 shadow-lg z-50 text-sm font-medium transform transition-all duration-300';
    toast.textContent = message;
    toast.style.transform = 'translateX(100%)';
    
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
      toast.style.transform = 'translateX(0)';
    }, 10);
    
    // Animate out and remove
    setTimeout(() => {
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (document.body.contains(toast)) {
          document.body.removeChild(toast);
        }
      }, 300);
    }, 2000);
    
    // Add visual feedback to selected elements (optional)
    setTimeout(() => {
      const selectedHeaders = document.querySelectorAll('.bg-blue-100');
      selectedHeaders.forEach(header => {
        const originalBg = header.style.backgroundColor;
        header.style.backgroundColor = '#dbeafe';
        setTimeout(() => {
          header.style.backgroundColor = originalBg;
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

// Column addition functionality
function addNewColumn(position = 'end', columnConfig = {}) {
  const newColumnId = `col_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const columnNumber = tableState.columns.length + 1;
  const newColumn = {
    id: newColumnId,
    key: columnConfig.key || `column_${columnNumber}`,
    title: columnConfig.title || `Column ${columnNumber}`,
    type: columnConfig.type || 'text',
    width: columnConfig.width || 150,
    visible: columnConfig.visible !== false,
    sortable: columnConfig.sortable !== false,
    editable: columnConfig.editable !== false
  };
  
  // Add default values to existing rows
  const defaultValue = getDefaultValueForType(newColumn.type);
  tableState.rows.forEach(row => {
    row.data[newColumn.key] = defaultValue;
  });
  
  // Insert at position
  if (position === 'end' || position >= tableState.columns.length) {
    tableState.columns.push(newColumn);
  } else if (typeof position === 'number' && position >= 0) {
    tableState.columns.splice(position, 0, newColumn);
  } else {
    tableState.columns.push(newColumn);
  }
  
  // Update sheet if in multi-sheet mode
  if (isMultiSheetMode.value && activeSheet.value) {
    activeSheet.value.columns = [...tableState.columns];
    activeSheet.value.metadata.columnCount = tableState.columns.length;
    activeSheet.value.metadata.modified = new Date();
  }
  
  emit('column-added', {
    columnId: newColumnId,
    columnData: newColumn,
    position,
    allColumns: tableState.columns,
    columnCount: tableState.columns.length
  });
  
  showSelectionFeedback(`New column "${newColumn.title}" added`);
  return newColumn;
}

function insertColumnAt(index, columnConfig = {}) {
  return addNewColumn(index, columnConfig);
}

function duplicateColumn(columnId) {
  const sourceColumn = tableState.columns.find(col => col.id === columnId);
  if (!sourceColumn) return null;

  const newColumnId = `col_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const duplicatedColumn = {
    ...sourceColumn,
    id: newColumnId,
    key: `${sourceColumn.key}_copy`,
    title: `${sourceColumn.title} (Copy)`
  };
  
  // Copy data from source column to new column for all rows
  tableState.rows.forEach(row => {
    row.data[duplicatedColumn.key] = row.data[sourceColumn.key];
  });
  
  // Insert after the source column
  const sourceIndex = tableState.columns.findIndex(col => col.id === columnId);
  tableState.columns.splice(sourceIndex + 1, 0, duplicatedColumn);
  
  // Update sheet if in multi-sheet mode
  if (isMultiSheetMode.value && activeSheet.value) {
    activeSheet.value.columns = [...tableState.columns];
    activeSheet.value.metadata.columnCount = tableState.columns.length;
    activeSheet.value.metadata.modified = new Date();
  }
  
  emit('column-duplicated', { 
    originalColumnId: columnId, 
    newColumnId, 
    columnData: duplicatedColumn,
    position: sourceIndex + 1,
    allColumns: tableState.columns
  });
  
  showSelectionFeedback(`Column "${sourceColumn.title}" duplicated`);
  return duplicatedColumn;
}

function addMultipleColumns(count = 1, position = 'end', baseConfig = {}) {
  const addedColumns = [];
  for (let i = 0; i < count; i++) {
    const columnConfig = {
      ...baseConfig,
      title: baseConfig.title ? `${baseConfig.title} ${i + 1}` : undefined
    };
    const newColumn = addNewColumn(position === 'end' ? 'end' : position + i, columnConfig);
    addedColumns.push(newColumn);
  }
  showSelectionFeedback(`Added ${count} columns`);
  return addedColumns;
}

function getColumnIndex(columnId) {
  return tableState.columns.findIndex(col => col.id === columnId);
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
    case 'email':
    case 'url':
    case 'text':
      processedValue = String(newValue).trim();
      break;
    default:
      processedValue = String(newValue);
  }
  
  // Update the data immediately for UI responsiveness
  row.data[columnKey] = processedValue;
  
  // Emit change event
  emit('cell-updated', {
    rowId,
    columnKey,
    oldValue,
    newValue: processedValue,
    row: row.data
  });
}

function handleInputUpdate(rowId, columnKey, event) {
  updateCellValue(rowId, columnKey, event.target.value);
}

function handleInputKeydown(rowId, columnKey, event) {
  if (event.key === 'Enter') {
    stopEditing();
  } else if (event.key === 'Escape') {
    cancelEditing();
  }
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
    case 'email':
    case 'url':
      // For email and URL, just return the string value as-is
      return String(value);
    case 'text':
    default:
      return String(value);
  }
}

function getInputType(columnType) {
  switch (columnType) {
    case 'number':
      return 'number';
    case 'email':
      return 'email';
    case 'url':
      return 'url';
    case 'date':
      return 'date';
    case 'text':
    default:
      return 'text';
  }
}

// Column editing functionality
function isEditingColumn(columnId) {
  return tableState.editingColumnId === columnId;
}

function startColumnEdit(columnId) {
  const column = tableState.columns.find(col => col.id === columnId);
  if (!column) return;
  
  tableState.editingColumnId = columnId;
  tableState.originalColumnName = column.title;
  tableState.showColumnMenu = null;
  
  // Focus input in next tick
  nextTick(() => {
    const input = document.querySelector('.column-name-input');
    if (input) {
      input.focus();
      input.select();
    }
  });
}

function stopColumnEdit() {
  tableState.editingColumnId = null;
  tableState.originalColumnName = null;
}

function cancelColumnEdit() {
  if (tableState.editingColumnId && tableState.originalColumnName) {
    const column = tableState.columns.find(col => col.id === tableState.editingColumnId);
    if (column) {
      column.title = tableState.originalColumnName;
    }
  }
  stopColumnEdit();
}

function updateColumnName(columnId, newName) {
  const column = tableState.columns.find(col => col.id === columnId);
  if (!column) return;
  
  const trimmedName = newName.trim();
  
  // Validation
  if (!trimmedName) {
    cancelColumnEdit();
    return;
  }
  
  // Check for duplicate names (case-insensitive)
  const isDuplicate = tableState.columns.some(col => 
    col.id !== columnId && 
    col.title.toLowerCase() === trimmedName.toLowerCase()
  );
  
  if (isDuplicate) {
    // Show error feedback and revert
    showSelectionFeedback(`Column name "${trimmedName}" already exists`);
    cancelColumnEdit();
    return;
  }
  
  const oldName = column.title;
  column.title = trimmedName;
  
  // Update key if needed (for new columns)
  if (!column.key || column.key === oldName) {
    column.key = sanitizeColumnKey(trimmedName);
  }
  
  stopColumnEdit();
  
  // Emit column renamed event
  emit('column-renamed', {
    columnId,
    oldName,
    newName: trimmedName,
    column: { ...column }
  });
  
  showSelectionFeedback(`Column renamed to "${trimmedName}"`);
}

function sanitizeColumnKey(name) {
  // Convert to safe key format (lowercase, no spaces, underscores)
  return name.toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function handleColumnNameKeydown(columnId, event) {
  if (event.key === 'Enter') {
    updateColumnName(columnId, event.target.value);
  } else if (event.key === 'Escape') {
    cancelColumnEdit();
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

// Row context menu
function toggleRowMenu(rowIndex, event) {
  console.log('Toggle row menu called for row:', rowIndex);
  
  if (tableState.showRowMenu === rowIndex) {
    tableState.showRowMenu = null;
    console.log('Row menu closed');
    return;
  }
  
  tableState.showRowMenu = rowIndex;
  
  // Get the position relative to the viewport
  const rect = event.currentTarget.getBoundingClientRect();
  const menuWidth = 180; // wider for row operations
  const menuHeight = 160; // approximate height
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  // Calculate optimal position
  let left = rect.right + 5;
  let top = rect.top;
  
  // Adjust if menu would go off-screen horizontally
  if (left + menuWidth > viewportWidth) {
    left = rect.left - menuWidth - 5;
  }
  
  // Adjust if menu would go off-screen vertically
  if (top + menuHeight > viewportHeight) {
    top = viewportHeight - menuHeight - 5;
  }
  
  const menuPosition = {
    left: Math.max(5, left) + 'px',
    top: Math.max(5, top) + 'px'
  };
  
  tableState.rowMenuPosition = menuPosition;
  console.log('Row menu opened at position:', menuPosition);
}

// Expose methods for parent component
defineExpose({
  getTableData: () => tableState.rows.map(row => row.data),
  clearSelection: () => {
    tableState.selectedRows.clear();
    tableState.selectedColumns.clear();
    tableState.allRowsSelected = false;
  },
  // Sheet management methods
  getAllSheetsData: () => sheetsState.sheets.map(sheet => ({
    ...sheet,
    data: sheet.rows.map(row => row.data)
  })),
  getActiveSheetData: () => activeSheet.value ? {
    ...activeSheet.value,
    data: tableState.rows.map(row => row.data)
  } : null,
  createSheet: (name, columns, rows) => createSheet(name, columns, rows),
  switchToSheet: (sheetId) => switchToSheet(sheetId),
  deleteSheet: (sheetId) => deleteSheet(sheetId),
  renameSheet: (sheetId, newName) => renameSheet(sheetId, newName),
  duplicateSheet: (sheetId) => duplicateSheet(sheetId)
});

function handleEscapeKey(e) {
    if (e.key === 'Escape') {
        tableState.showColumnMenu = null;
        if (tableState.editingColumnId) {
            cancelColumnEdit();
        }
    }
}

function handleKeyboardShortcuts(e) {
  // Only handle shortcuts when not editing a cell, sheet name, or column name
  if (tableState.editingCell || sheetsState.editingSheetId || tableState.editingColumnId) return;
  
  // Sheet navigation shortcuts
  if (isMultiSheetMode.value) {
    // Ctrl+PageUp: Previous sheet
    if (e.ctrlKey && e.key === 'PageUp') {
      e.preventDefault();
      navigateSheet(-1);
      return;
    }
    
    // Ctrl+PageDown: Next sheet
    if (e.ctrlKey && e.key === 'PageDown') {
      e.preventDefault();
      navigateSheet(1);
      return;
    }
    
    // Ctrl+T: New sheet
    if ((e.ctrlKey || e.metaKey) && e.key === 't' && canCreateNewSheet.value) {
      e.preventDefault();
      const newSheet = createSheet();
      switchToSheet(newSheet.id);
      return;
    }
    
    // Ctrl+W: Close current sheet
    if ((e.ctrlKey || e.metaKey) && e.key === 'w' && sheetsState.sheets.length > 1) {
      e.preventDefault();
      deleteSheet(sheetsState.activeSheetId);
      return;
    }
    
    // F2: Rename current sheet
    if (e.key === 'F2' && sheetsState.activeSheetId) {
      e.preventDefault();
      startSheetRename(sheetsState.activeSheetId);
      return;
    }
  }
  
  // F2: Rename selected column (when not in multi-sheet mode or when only one column selected)
  if (e.key === 'F2' && tableState.selectedColumns.size === 1) {
    e.preventDefault();
    const columnId = Array.from(tableState.selectedColumns)[0];
    startColumnEdit(columnId);
    return;
  }
  
  // Ctrl+A or Cmd+A: Select all columns
  if ((e.ctrlKey || e.metaKey) && e.key === 'a' && e.shiftKey) {
    e.preventDefault();
    selectAllColumns();
    return;
  }
  
  // Ctrl+F or Cmd+F: Fill selection gaps
  if ((e.ctrlKey || e.metaKey) && e.key === 'f' && tableState.selectedColumns.size >= 2) {
    e.preventDefault();
    fillSelectionGaps();
    return;
  }
  
  // Ctrl+Shift+A or Cmd+Shift+A: Toggle all columns
  if ((e.ctrlKey || e.metaKey) && e.key === 'A' && e.shiftKey) {
    e.preventDefault();
    toggleAllColumns();
    return;
  }
  
  // Row and Column Addition Shortcuts
  // Ctrl+Shift+Plus: Add new row
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === '+' || e.key === '=' || e.keyCode === 187)) {
    e.preventDefault();
    addNewRow();
    return;
  }
  
  // Ctrl+Alt+Plus: Add new column
  if ((e.ctrlKey || e.metaKey) && e.altKey && (e.key === '+' || e.key === '=' || e.keyCode === 187)) {
    e.preventDefault();
    addNewColumn();
    return;
  }
  
  // Insert: Add new row (context-sensitive)
  if (e.key === 'Insert' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
    e.preventDefault();
    addNewRow();
    return;
  }
  
  // Shift+Insert: Add new column (context-sensitive)
  if (e.key === 'Insert' && e.shiftKey && !e.ctrlKey && !e.altKey) {
    e.preventDefault();
    addNewColumn();
    return;
  }
  
  // Ctrl+D: Duplicate selected row/column
  if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
    e.preventDefault();
    if (tableState.selectedRows.size === 1) {
      const rowId = Array.from(tableState.selectedRows)[0];
      duplicateRow(rowId);
    } else if (tableState.selectedColumns.size === 1) {
      const columnId = Array.from(tableState.selectedColumns)[0];
      duplicateColumn(columnId);
    }
    return;
  }
  
  // Escape: Clear all selections
  if (e.key === 'Escape') {
    tableState.selectedColumns.clear();
    tableState.selectedRows.clear();
    tableState.allRowsSelected = false;
    tableState.showColumnMenu = null;
    sheetsState.showSheetMenu = null;
    sheetsState.editingSheetId = null;
  }
}

function navigateSheet(direction) {
  const currentIndex = sheetsState.sheets.findIndex(s => s.id === sheetsState.activeSheetId);
  if (currentIndex === -1) return;
  
  const newIndex = currentIndex + direction;
  if (newIndex >= 0 && newIndex < sheetsState.sheets.length) {
    switchToSheet(sheetsState.sheets[newIndex].id);
  }
}

function handleClickOutside(e) {
  if (!e.target.closest('.column-menu') && !e.target.closest('.column-menu-trigger')) {
    tableState.showColumnMenu = null;
  }
  if (!e.target.closest('.row-menu') && !e.target.closest('.row-menu-trigger')) {
    tableState.showRowMenu = null;
  }
  if (!e.target.closest('.sheet-menu') && !e.target.closest('.sheet-menu-trigger')) {
    sheetsState.showSheetMenu = null;
  }
}

// Sheet Management Functions
function createSheet(name = null, columns = [], rows = []) {
  const sheetName = name || `Sheet ${sheetsState.newSheetCounter}`;
  
  // Process columns with proper structure
  const processedColumns = columns.length > 0 
    ? columns.map(col => ({
        ...col,
        id: col?.id ? col.id : `col_${Date.now()}_${Math.random()}`,
        width: col.width || 150,
        visible: col.visible !== false,
        sortable: col.sortable !== false,
        editable: col.editable !== false
      }))
    : (props.columns || []).map(col => ({
        ...col,
        id: col?.id ? col.id : `col_${Date.now()}_${Math.random()}`,
        width: col.width || 150,
        visible: col.visible !== false,
        sortable: col.sortable !== false,
        editable: col.editable !== false
      }));
  
  // Process rows with proper structure
  const processedRows = rows.length > 0 
    ? rows.map((rowData, index) => ({
        id: rowData?.id ? rowData.id : `row_${Date.now()}_${index}`,
        index: index,
        selected: false,
        data: { ...rowData }
      }))
    : (props.initialData || []).map((rowData, index) => ({
        id: rowData?.id ? rowData.id : `row_${Date.now()}_${index}`,
        index: index,
        selected: false,
        data: { ...rowData }
      }));
  
  const newSheet = {
    id: `sheet_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    name: sheetName,
    columns: processedColumns,
    rows: processedRows,
    metadata: {
      created: new Date(),
      modified: new Date(),
      rowCount: processedRows.length,
      columnCount: processedColumns.length
    }
  };
  
  sheetsState.sheets.push(newSheet);
  sheetsState.newSheetCounter++;
  
  if (!sheetsState.activeSheetId) {
    switchToSheet(newSheet.id);
  }
  
  emit('sheet-created', newSheet);
  return newSheet;
}

function switchToSheet(sheetId) {
  const oldSheetId = sheetsState.activeSheetId;
  const targetSheet = sheetsState.sheets.find(sheet => sheet.id === sheetId);
  
  if (!targetSheet) return;
  
  // Save current sheet state if switching from existing sheet
  if (oldSheetId && oldSheetId !== sheetId) {
    saveCurrentSheetState();
  }
  
  sheetsState.activeSheetId = sheetId;
  
  // Load target sheet data
  loadSheetData(targetSheet);
  
  emit('sheet-changed', { oldSheetId, newSheetId: sheetId, sheet: targetSheet });
}

function saveCurrentSheetState() {
  const currentSheet = sheetsState.sheets.find(sheet => sheet.id === sheetsState.activeSheetId);
  if (currentSheet) {
    currentSheet.columns = [...tableState.columns];
    currentSheet.rows = tableState.rows.map(row => ({ ...row, data: { ...row.data } }));
    currentSheet.metadata.modified = new Date();
    currentSheet.metadata.rowCount = tableState.rows.length;
    currentSheet.metadata.columnCount = tableState.columns.length;
  }
}

function loadSheetData(sheet) {
  // Clear current selections
  tableState.selectedRows.clear();
  tableState.selectedColumns.clear();
  tableState.allRowsSelected = false;
  tableState.editingCell = null;
  tableState.sortColumn = null;
  tableState.sortDirection = null;
  
  // Load sheet data
  tableState.columns = [...sheet.columns];
  tableState.rows = sheet.rows.map(row => ({ ...row, data: { ...row.data } }));
  
  // Ensure all rows have proper indices
  updateRowIndices();
}

function renameSheet(sheetId, newName) {
  const sheet = sheetsState.sheets.find(s => s.id === sheetId);
  if (!sheet || !newName.trim()) return;
  
  const oldName = sheet.name;
  sheet.name = newName.trim();
  sheet.metadata.modified = new Date();
  
  emit('sheet-renamed', { sheetId, oldName, newName: sheet.name });
}

function duplicateSheet(sheetId) {
  const sourceSheet = sheetsState.sheets.find(s => s.id === sheetId);
  if (!sourceSheet) return;
  
  const duplicatedSheet = createSheet(
    `${sourceSheet.name} (Copy)`,
    [...sourceSheet.columns],
    sourceSheet.rows.map(row => ({ ...row, data: { ...row.data } }))
  );
  
  emit('sheet-duplicated', { originalSheet: sourceSheet, duplicatedSheet });
  return duplicatedSheet;
}

function deleteSheet(sheetId) {
  const sheetIndex = sheetsState.sheets.findIndex(s => s.id === sheetId);
  if (sheetIndex === -1 || sheetsState.sheets.length <= 1) return;
  
  const deletedSheet = sheetsState.sheets[sheetIndex];
  sheetsState.sheets.splice(sheetIndex, 1);
  
  // Switch to adjacent sheet if current sheet is deleted
  if (sheetsState.activeSheetId === sheetId) {
    const newActiveIndex = Math.min(sheetIndex, sheetsState.sheets.length - 1);
    switchToSheet(sheetsState.sheets[newActiveIndex].id);
  }
  
  emit('sheet-deleted', deletedSheet);
}

function moveSheet(fromIndex, toIndex) {
  if (fromIndex === toIndex) return;
  
  const sheet = sheetsState.sheets.splice(fromIndex, 1)[0];
  sheetsState.sheets.splice(toIndex, 0, sheet);
  
  emit('sheet-reordered', sheetsState.sheets);
}

function startSheetRename(sheetId) {
  sheetsState.editingSheetId = sheetId;
  
  nextTick(() => {
    const input = document.querySelector('.sheet-name-input');
    if (input) {
      input.focus();
      input.select();
    }
  });
}

function stopSheetRename() {
  sheetsState.editingSheetId = null;
}

function toggleSheetMenu(sheetId, event) {
  if (sheetsState.showSheetMenu === sheetId) {
    sheetsState.showSheetMenu = null;
    return;
  }
  
  sheetsState.showSheetMenu = sheetId;
  
  const rect = event.currentTarget.getBoundingClientRect();
  const menuWidth = 150;
  const menuHeight = 200;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  let left = rect.left;
  let top = rect.top - menuHeight - 5;
  
  if (left + menuWidth > viewportWidth) {
    left = rect.right - menuWidth;
  }
  
  if (top < 5) {
    top = rect.bottom + 5;
  }
  
  sheetsState.sheetMenuPosition = {
    left: Math.max(5, left) + 'px',
    top: Math.max(5, top) + 'px'
  };
}

onMounted(() => {
    // Initialize sheets if provided, otherwise create default sheet
    if (props.sheets && props.sheets.length > 0) {
        sheetsState.sheets = props.sheets.map(sheet => ({
            ...sheet,
            id: sheet.id || `sheet_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            metadata: {
                created: sheet.metadata?.created || new Date(),
                modified: sheet.metadata?.modified || new Date(),
                rowCount: sheet.rows?.length || 0,
                columnCount: sheet.columns?.length || 0,
                ...sheet.metadata
            }
        }));
        
        const targetSheetId = props.activeSheetId || sheetsState.sheets[0].id;
        switchToSheet(targetSheetId);
    } else if (props.allowMultipleSheets) {
        // Create default sheet with provided data
        const defaultSheet = createSheet('Sheet 1', props.columns, props.initialData);
        switchToSheet(defaultSheet.id);
    } else {
        // Single sheet mode - use existing initialization
        tableState.columns = props.columns.map(col => ({
            ...col,
            id: col?.id ? col.id : `col_${Date.now()}_${Math.random()}`,
            width: col.width || 150,
            visible: col.visible !== false,
            sortable: col.sortable !== false,
            editable: col.editable !== false
        }));

        tableState.rows = props.initialData.map((rowData, index) => ({
            id: rowData?.id ? rowData.id : `row_${Date.now()}_${index}`,
            index: index,
            selected: false,
            data: { ...rowData }
        }));
    }
    
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleEscapeKey);
    document.addEventListener('keydown', handleKeyboardShortcuts);
});

onUnmounted(() => {
    // Clean up event listeners
    document.removeEventListener('click', handleClickOutside);
    document.removeEventListener('keydown', handleEscapeKey);
    document.removeEventListener('keydown', handleKeyboardShortcuts);
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
          <span v-if="selectedRows.size > 0" class="px-2 py-1 bg-blue-100 text-blue-700">
            {{ selectedRows.size }} row{{ selectedRows.size !== 1 ? 's' : '' }} selected
          </span>
          <span v-if="selectedColumns.size > 0" class="px-2 py-1 bg-purple-100 text-purple-700">
            {{ selectedColumns.size }} column{{ selectedColumns.size !== 1 ? 's' : '' }} selected
          </span>
        </div>
        
        <!-- Row Actions -->
        <button 
          v-if="selectedRows.size > 0"
          @click="removeSelectedRows"
          class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 text-sm font-medium transition-colors duration-200 flex items-center gap-2"
        >
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clip-rule="evenodd"/>
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v4a1 1 0 102 0V5z" clip-rule="evenodd"/>
          </svg>
          Remove Selected ({{ selectedRows.size }})
        </button>
        <button 
          @click="removeAllRows"
          class="border border-red-500 text-red-500 hover:bg-red-50 px-4 py-2 text-sm font-medium transition-colors duration-200"
        >
          Clear All Rows
        </button>
      </div>
      
      <!-- Column Actions -->
      <div class="flex flex-wrap gap-2">
        <button 
          v-if="selectedColumns.size > 0"
          @click="removeSelectedColumns"
          class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 text-sm font-medium transition-colors duration-200"
        >
          Remove Columns ({{ selectedColumns.size }})
        </button>
        <button 
          v-if="selectedColumns.size >= 2 && hasSelectionGaps"
          @click="fillSelectionGaps"
          class="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 text-sm font-medium transition-colors duration-200"
          title="Fill gaps between selected columns"
        >
          Fill Selection Gaps
        </button>
        <button 
          @click="selectAllColumns" 
          class="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 text-sm font-medium transition-colors duration-200"
          :disabled="allColumnsSelected"
          :class="{ 'opacity-50 cursor-not-allowed': allColumnsSelected }"
        >
          Select All Columns
        </button>
        <button 
          v-if="selectedColumns.size > 0"
          @click="selectedColumns.clear()"
          class="border border-purple-500 text-purple-500 hover:bg-purple-50 px-4 py-2 text-sm font-medium transition-colors duration-200"
        >
          Clear Column Selection
        </button>
      </div>
    </div>

    <!-- Main Table Container -->
        <!-- Main Table Container -->
    <div class="overflow-auto border border-gray-300 rounded-lg shadow-sm max-h-screen data-table-container">
      <table class="w-full border-collapse bg-white">
        <!-- Column Headers -->
        <thead class="sticky top-0 bg-gray-50 z-10">
          <!-- Column Selection Row -->
          <tr class="border-b border-gray-200 bg-gray-100">
            <th class="w-12 p-2 border-r border-gray-200 text-center">
              <input 
                type="checkbox"
                :checked="allColumnsSelected"
                :indeterminate="someColumnsSelected"
                @change="toggleAllColumns"
                class="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
                title="Select/Deselect all columns"
              />
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
                  <!-- Editable Column Name -->
                  <input
                    v-if="isEditingColumn(column.id)"
                    v-model="column.title"
                    @blur="updateColumnName(column.id, column.title)"
                    @keydown="handleColumnNameKeydown(column.id, $event)"
                    @click.stop
                    class="column-name-input bg-transparent border-b border-blue-500 outline-none focus:ring-0 min-w-[60px] max-w-[120px] text-sm font-semibold px-1"
                  />
                  <span 
                    v-else 
                    class="truncate cursor-pointer" 
                    @dblclick.stop="startColumnEdit(column.id)"
                    :title="column.title"
                  >
                    {{ column.title }}
                  </span>
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
            
            <!-- Add Column Button -->
            <th class="w-12 p-3 border-r border-gray-200 text-center bg-gray-50 hover:bg-gray-100">
              <button
                @click="addNewColumn()"
                class="w-8 h-8 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center transition-colors duration-200"
                title="Add New Column (Ctrl+Alt++)"
              >
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/>
                </svg>
              </button>
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
            <td 
              class="w-12 p-3 border-r border-gray-200 text-center bg-gray-50 hover:bg-gray-100 cursor-pointer relative row-menu-trigger"
              @contextmenu.prevent="toggleRowMenu(row.index, $event)"
              @click="toggleRowSelection(row.id)"
            >
              <div class="flex flex-col items-center gap-1">
                <span class="text-xs text-gray-500 font-medium">{{ row.index + 1 }}</span>
                <input 
                  type="checkbox"
                  :checked="selectedRows.has(row.id)"
                  @change.stop="toggleRowSelection(row.id)"
                  class="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-1"
                />
              </div>
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
                  v-if="['text', 'number', 'email', 'url'].includes(column.type)"
                  :type="getInputType(column.type)"
                  :value="getCellValue(row, column.key)"
                  @input="handleInputUpdate(row.id, column.key, $event)"
                  @keydown="handleInputKeydown(row.id, column.key, $event)"
                  @blur="stopEditing"
                  class="w-full h-full p-2 border-0 outline-none bg-white focus:ring-2 focus:ring-blue-500 focus:ring-inset cell-input"
                  ref="cellInput"
                />
                
                <select 
                  v-else-if="column.type === 'boolean'"
                  :value="getCellValue(row, column.key)"
                  @change="updateCellValue(row.id, column.key, $event.target.value === 'true'); stopEditing()"
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
                  @input="updateCellValue(row.id, column.key, $event.target.value); stopEditing()"
                  @blur="stopEditing"
                  class="w-full h-full p-2 border-0 outline-none bg-white focus:ring-2 focus:ring-blue-500"
                />
                
                <!-- Fallback input for any unhandled column types -->
                <input 
                  v-else
                  type="text"
                  :value="getCellValue(row, column.key)"
                  @input="handleInputUpdate(row.id, column.key, $event)"
                  @keydown="handleInputKeydown(row.id, column.key, $event)"
                  @blur="stopEditing"
                  class="w-full h-full p-2 border-0 outline-none bg-white focus:ring-2 focus:ring-blue-500 focus:ring-inset cell-input"
                  ref="cellInput"
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
      
      <!-- Add Row Button -->
      <div class="p-3 border-t border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors duration-200">
        <button
          @click="addNewRow()"
          class="w-full h-10 rounded-lg bg-green-500 hover:bg-green-600 text-white flex items-center justify-center gap-2 transition-colors duration-200"
          title="Add New Row (Ctrl+Alt+R)"
        >
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/>
          </svg>
          Add Row
        </button>
      </div>
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
        class="fixed bg-white border border-gray-300 shadow-lg z-50 py-1 min-w-[150px] column-menu"
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
          v-if="selectedColumns.size >= 2 && hasSelectionGaps"
          @click="fillSelectionGaps(); tableState.showColumnMenu = null;" 
          class="w-full text-left px-4 py-2 hover:bg-orange-50 text-orange-600 text-sm flex items-center gap-2 transition-colors duration-150"
        >
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"/>
          </svg>
          Fill Selection Gaps
        </button>
        <hr class="my-1 border-gray-200">
        <button 
          @click="insertColumnAt(getColumnIndex(showColumnMenu)); tableState.showColumnMenu = null;" 
          class="w-full text-left px-4 py-2 hover:bg-green-50 text-green-600 text-sm flex items-center gap-2 transition-colors duration-150"
        >
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/>
          </svg>
          Insert Column Before
        </button>
        <button 
          @click="insertColumnAt(getColumnIndex(showColumnMenu) + 1); tableState.showColumnMenu = null;" 
          class="w-full text-left px-4 py-2 hover:bg-green-50 text-green-600 text-sm flex items-center gap-2 transition-colors duration-150"
        >
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/>
          </svg>
          Insert Column After
        </button>
        <button 
          @click="duplicateColumn(showColumnMenu); tableState.showColumnMenu = null;" 
          class="w-full text-left px-4 py-2 hover:bg-green-50 text-green-600 text-sm flex items-center gap-2 transition-colors duration-150"
        >
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M4 2a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H4zm0 2h8v8H4V4z" clip-rule="evenodd"/>
            <path fill-rule="evenodd" d="M8 6a2 2 0 012-2h4a2 2 0 012 2v8a2 2 0 01-2 2h-4a2 2 0 01-2-2V6z" clip-rule="evenodd"/>
          </svg>
          Duplicate Column
        </button>
        <hr class="my-1 border-gray-200">
        <button 
          @click="startColumnEdit(showColumnMenu)" 
          class="w-full text-left px-4 py-2 hover:bg-blue-50 text-blue-600 text-sm flex items-center gap-2 transition-colors duration-150"
        >
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
          </svg>
          Rename Column
        </button>
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

    <!-- Row Context Menu -->
    <Transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0 scale-95 transform translate-y-1"
      enter-to-class="opacity-100 scale-100 transform translate-y-0"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100 scale-100 transform translate-y-0"
      leave-to-class="opacity-0 scale-95 transform translate-y-1"
    >
      <div 
        v-if="showRowMenu !== null"
        class="fixed bg-white border border-gray-300 shadow-lg z-50 py-1 min-w-[180px] row-menu"
        :style="rowMenuPosition"
      >
        <button 
          @click="insertRowAt(showRowMenu); tableState.showRowMenu = null;" 
          class="w-full text-left px-4 py-2 hover:bg-green-50 text-green-600 text-sm flex items-center gap-2 transition-colors duration-150"
        >
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/>
          </svg>
          Insert Row Above
        </button>
        <button 
          @click="insertRowAt(showRowMenu + 1); tableState.showRowMenu = null;" 
          class="w-full text-left px-4 py-2 hover:bg-green-50 text-green-600 text-sm flex items-center gap-2 transition-colors duration-150"
        >
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/>
          </svg>
          Insert Row Below
        </button>
        <button 
          @click="duplicateRow(tableState.rows[showRowMenu]?.id); tableState.showRowMenu = null;" 
          class="w-full text-left px-4 py-2 hover:bg-green-50 text-green-600 text-sm flex items-center gap-2 transition-colors duration-150"
        >
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M4 2a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H4zm0 2h8v8H4V4z" clip-rule="evenodd"/>
            <path fill-rule="evenodd" d="M8 6a2 2 0 012-2h4a2 2 0 012 2v8a2 2 0 01-2 2h-4a2 2 0 01-2-2V6z" clip-rule="evenodd"/>
          </svg>
          Duplicate Row
        </button>
        <hr class="my-1 border-gray-200">
        <button 
          @click="removeRowByIndex(showRowMenu); tableState.showRowMenu = null;" 
          class="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 text-sm flex items-center gap-2 transition-colors duration-150"
        >
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clip-rule="evenodd"/>
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v4a1 1 0 102 0V5z" clip-rule="evenodd"/>
          </svg>
          Delete Row
        </button>        
      </div>
    </Transition>

    <!-- Sheet Tabs (Multi-sheet Mode) -->
    <div v-if="isMultiSheetMode" class="mt-2 border-t border-gray-200 bg-gray-50">
      <div class="flex items-center justify-between p-2">
        <!-- Sheet Tabs Container -->
        <div class="flex-1 overflow-x-auto">
          <div class="flex items-center gap-1 min-w-max">
            <!-- Individual Sheet Tabs -->
            <div
              v-for="sheet in sheetsState.sheets"
              :key="sheet.id"
              class="relative flex items-center group"
            >
              <!-- Sheet Tab -->
              <div
                class="flex items-center px-3 py-2 border border-gray-300 bg-white cursor-pointer transition-all duration-200 hover:bg-gray-50"
                :class="{
                  'bg-blue-50 border-blue-300 text-blue-700': sheet.id === sheetsState.activeSheetId,
                  'bg-white border-gray-300 text-gray-700': sheet.id !== sheetsState.activeSheetId
                }"
                @click="switchToSheet(sheet.id)"
                @dblclick="startSheetRename(sheet.id)"
                @contextmenu.prevent="toggleSheetMenu(sheet.id, $event)"
              >
                <!-- Sheet Name (Editable) -->
                <input
                  v-if="sheetsState.editingSheetId === sheet.id"
                  v-model="sheet.name"
                  @blur="stopSheetRename(); renameSheet(sheet.id, sheet.name)"
                  @keydown.enter="stopSheetRename(); renameSheet(sheet.id, sheet.name)"
                  @keydown.escape="stopSheetRename()"
                  class="sheet-name-input bg-transparent border-none outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 min-w-[60px] max-w-[120px]"
                />
                <span v-else class="text-sm font-medium select-none truncate max-w-[120px]">
                  {{ sheet.name }}
                </span>
                
                <!-- Sheet Stats -->
                <div class="ml-2 text-xs text-gray-500">
                  ({{ sheet.metadata.rowCount || 0 }})
                </div>
                
                <!-- Close Button -->
                <button
                  v-if="sheetsState.sheets.length > 1"
                  @click.stop="deleteSheet(sheet.id)"
                  class="ml-2 w-4 h-4 rounded hover:bg-red-100 hover:text-red-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  title="Close sheet"
                >
                  <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                  </svg>
                </button>
                
                <!-- Menu Trigger -->
                <button
                  @click.stop="toggleSheetMenu(sheet.id, $event)"
                  class="ml-1 w-4 h-4 rounded hover:bg-gray-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 sheet-menu-trigger"
                  title="Sheet options"
                >
                  <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/>
                  </svg>
                </button>
              </div>
            </div>
            
            <!-- New Sheet Button -->
            <button
              v-if="canCreateNewSheet"
              @click="createSheet(); switchToSheet(sheetsState.sheets[sheetsState.sheets.length - 1].id)"
              class="flex items-center justify-center w-8 h-8 border border-gray-300 bg-white hover:bg-gray-50 transition-colors duration-200 rounded"
              title="Add new sheet (Ctrl+T)"
            >
              <svg class="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/>
              </svg>
            </button>
          </div>
        </div>
        
        <!-- Sheet Actions -->
        <div class="flex items-center gap-2 ml-4">
          <span class="text-xs text-gray-500">
            {{ sheetsState.sheets.length }}/{{ props.maxSheets }} sheets
          </span>
        </div>
      </div>
    </div>

    <!-- Sheet Context Menu -->
    <Transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0 scale-95 transform translate-y-1"
      enter-to-class="opacity-100 scale-100 transform translate-y-0"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100 scale-100 transform translate-y-0"
      leave-to-class="opacity-0 scale-95 transform translate-y-1"
    >
      <div 
        v-if="sheetsState.showSheetMenu"
        class="fixed bg-white border border-gray-300 shadow-lg z-50 py-1 min-w-[150px] sheet-menu"
        :style="sheetsState.sheetMenuPosition"
      >
        <button 
          @click="startSheetRename(sheetsState.showSheetMenu); sheetsState.showSheetMenu = null;" 
          class="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center gap-2 transition-colors duration-150"
        >
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
          </svg>
          Rename Sheet
        </button>
        <button 
          @click="duplicateSheet(sheetsState.showSheetMenu); sheetsState.showSheetMenu = null;" 
          class="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center gap-2 transition-colors duration-150"
        >
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
            <path fill-rule="evenodd" d="M4 5a2 2 0 012-2v1a1 1 0 001 1h1a1 1 0 001-1V3a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/>
          </svg>
          Duplicate Sheet
        </button>
        <hr class="my-1 border-gray-200">
        <button 
          v-if="sheetsState.sheets.length > 1"
          @click="deleteSheet(sheetsState.showSheetMenu); sheetsState.showSheetMenu = null;" 
          class="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 text-sm flex items-center gap-2 transition-colors duration-150"
        >
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clip-rule="evenodd"/>
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v4a1 1 0 102 0V5z" clip-rule="evenodd"/>
          </svg>
          Delete Sheet
        </button>
      </div>
    </Transition>

    <!-- Help Section -->
    <div class="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
      <div class="text-xs text-gray-600 space-y-1">
        <div>
          <strong>Column Selection:</strong> 
          Click column headers to select • 
          <kbd class="px-1 py-0.5 bg-white border border-gray-300 rounded text-xs">Ctrl</kbd> + Click for multi-select • 
          <kbd class="px-1 py-0.5 bg-white border border-gray-300 rounded text-xs">Shift</kbd> + Click for range select • 
          <kbd class="px-1 py-0.5 bg-white border border-gray-300 rounded text-xs">Alt</kbd> + Click for single select
        </div>
        <div>
          <strong>Cell Editing:</strong> 
          Single click to position cursor • 
          Double-click to select all text • 
          <kbd class="px-1 py-0.5 bg-white border border-gray-300 rounded text-xs">Enter</kbd> to save (keeps focus) • 
          <kbd class="px-1 py-0.5 bg-white border border-gray-300 rounded text-xs">Tab</kbd> to save and move to next cell • 
          <kbd class="px-1 py-0.5 bg-white border border-gray-300 rounded text-xs">Shift+Tab</kbd> to save and move to previous cell • 
          <kbd class="px-1 py-0.5 bg-white border border-gray-300 rounded text-xs">Esc</kbd> to cancel • 
          <kbd class="px-1 py-0.5 bg-white border border-gray-300 rounded text-xs">Ctrl+A</kbd> to select all text
        </div>
        <div>
          <strong>Keyboard Shortcuts:</strong> 
          <kbd class="px-1 py-0.5 bg-white border border-gray-300 rounded text-xs">Ctrl+Shift+A</kbd> Select all columns • 
          <kbd class="px-1 py-0.5 bg-white border border-gray-300 rounded text-xs">Ctrl+F</kbd> Fill selection gaps • 
          <kbd class="px-1 py-0.5 bg-white border border-gray-300 rounded text-xs">Esc</kbd> Clear selections
          <span v-if="isMultiSheetMode"> • 
            <kbd class="px-1 py-0.5 bg-white border border-gray-300 rounded text-xs">Ctrl+PageUp/PageDown</kbd> Navigate sheets • 
            <kbd class="px-1 py-0.5 bg-white border border-gray-300 rounded text-xs">Ctrl+T</kbd> New sheet • 
            <kbd class="px-1 py-0.5 bg-white border border-gray-300 rounded text-xs">F2</kbd> Rename sheet
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
