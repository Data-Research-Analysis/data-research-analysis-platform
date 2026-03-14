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
  },
  // Performance props
  maxDisplayRows: {
    type: Number,
    default: 5000  // Show max 5000 rows for performance
  },
  paginate: {
    type: Boolean,
    default: true  // Enable pagination by default
  },
  rowsPerPage: {
    type: Number,
    default: 100   // Show 100 rows per page
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
  'column-type-forced',
  'column-type-reset',
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
  rowMenuPosition: { left: '0px', top: '0px' },
  showTypeSubmenu: false,
  // Pagination state
  currentPage: 1,
  rowsPerPage: 100,
  showLargeDatasetWarning: false
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

// Performance mode detection
const isLargeDataset = computed(() => tableState.rows.length > 1000);
const shouldPaginate = computed(() => props.paginate && tableState.rows.length > props.rowsPerPage);

// Optimized sorted rows - only sort if needed
const sortedRows = computed(() => {
  if (!tableState.sortColumn) return tableState.rows;
  
  // For large datasets, disable sorting to improve performance
  if (isLargeDataset.value && tableState.rows.length > 10000) {
    console.warn('[DataTable] Sorting disabled for datasets > 10k rows for performance');
    return tableState.rows;
  }
  
  return [...tableState.rows].sort((a, b) => {
    const aVal = a.data[tableState.sortColumn];
    const bVal = b.data[tableState.sortColumn];
    
    let comparison = 0;
    if (aVal < bVal) comparison = -1;
    if (aVal > bVal) comparison = 1;
    
    return tableState.sortDirection === 'desc' ? -comparison : comparison;
  });
});

// Paginated/limited rows for display
const displayRows = computed(() => {
  let rows = sortedRows.value;
  
  // Apply max display limit for performance
  if (rows.length > props.maxDisplayRows) {
    console.warn(`[DataTable] Limiting display to ${props.maxDisplayRows} of ${rows.length} rows for performance`);
    rows = rows.slice(0, props.maxDisplayRows);
    if (!tableState.showLargeDatasetWarning) {
      tableState.showLargeDatasetWarning = true;
    }
  }
  
  // Apply pagination if enabled
  if (shouldPaginate.value) {
    const start = (tableState.currentPage - 1) * tableState.rowsPerPage;
    const end = start + tableState.rowsPerPage;
    return rows.slice(start, end);
  }
  
  return rows;
});

// Pagination helpers
const totalPages = computed(() => {
  if (!shouldPaginate.value) return 1;
  return Math.ceil(Math.min(tableState.rows.length, props.maxDisplayRows) / tableState.rowsPerPage);
});

const paginationInfo = computed(() => {
  if (!shouldPaginate.value) return null;
  const start = (tableState.currentPage - 1) * tableState.rowsPerPage + 1;
  const end = Math.min(start + tableState.rowsPerPage - 1, Math.min(tableState.rows.length, props.maxDisplayRows));
  return { start, end, total: Math.min(tableState.rows.length, props.maxDisplayRows), actualTotal: tableState.rows.length };
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

// Helper function to check if a column is selected (fixes Vue reactivity with Sets)
function isColumnSelected(columnId) {
  // Access .size to ensure Vue tracks changes to the Set
  const size = tableState.selectedColumns.size;
  return tableState.selectedColumns.has(columnId);
}

// Helper function to check if a row is selected (fixes Vue reactivity with Sets)
function isRowSelected(rowId) {
  // Access .size to ensure Vue tracks changes to the Set
  const size = tableState.selectedRows.size;
  return tableState.selectedRows.has(rowId);
}

// Row selection methods
function toggleRowSelection(rowId) {
  if (tableState.selectedRows.has(rowId)) {
    tableState.selectedRows.delete(rowId);
  } else {
    tableState.selectedRows.add(rowId);
  }
  // Force Vue reactivity by creating new Set reference
  tableState.selectedRows = new Set(tableState.selectedRows);
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
  // Force Vue reactivity
  tableState.selectedRows = new Set(tableState.selectedRows);
  
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
  // Force Vue reactivity
  tableState.selectedColumns = new Set(tableState.selectedColumns);
}

function toggleColumnSelection(columnId, event) {
  // Prevent event from bubbling to header click handler
  event.stopPropagation();
  
  if (tableState.selectedColumns.has(columnId)) {
    tableState.selectedColumns.delete(columnId);
  } else {
    tableState.selectedColumns.add(columnId);
  }
  // Force Vue reactivity by creating new Set reference
  tableState.selectedColumns = new Set(tableState.selectedColumns);
}

function clearColumnSelection() {
  tableState.selectedColumns.clear();
  // Force Vue reactivity
  tableState.selectedColumns = new Set(tableState.selectedColumns);
  showSelectionFeedback('All columns deselected');
}

function removeSelectedRows() {
  const removedRows = tableState.rows.filter(row => tableState.selectedRows.has(row.id));
  tableState.rows = tableState.rows.filter(row => !tableState.selectedRows.has(row.id));
  tableState.selectedRows.clear();
  tableState.selectedRows = new Set(tableState.selectedRows);
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
  tableState.selectedRows = new Set(tableState.selectedRows);
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
  tableState.selectedRows = new Set(tableState.selectedRows);
  tableState.allRowsSelected = false;
  
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

function inferColumnType(columnKey) {
  // Sample first 10 non-empty rows to infer type
  const sample = tableState.rows
    .slice(0, 10)
    .map(row => row.data[columnKey])
    .filter(val => val !== null && val !== undefined && val !== '');
  
  if (sample.length === 0) return 'text';
  
  // Check if all values are booleans
  const isBool = sample.every(val => 
    typeof val === 'boolean' || 
    String(val).toLowerCase() === 'true' || 
    String(val).toLowerCase() === 'false'
  );
  if (isBool) return 'boolean';
  
  // Check if all values are time (before date check)
  const isTime = sample.every(val => isValidTimeValue(val));
  if (isTime) return 'time';
  
  // Check if all values are dates
  const isDate = sample.every(val => {
    const date = new Date(val);
    return !isNaN(date.getTime()) && String(val).match(/^\d{4}-\d{2}-\d{2}/);
  });
  if (isDate) return 'date';
  
  // Check if all values are numbers
  const isNumber = sample.every(val => !isNaN(parseFloat(val)) && isFinite(val));
  if (isNumber) return 'number';
  
  return 'text';
}

function isValidTimeValue(value) {
  if (value === null || value === undefined || value === '') return true;
  
  const strValue = String(value).trim();
  
  // 24-hour format: HH:MM or HH:MM:SS
  const time24Pattern = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])(:([0-5][0-9]))?$/;
  if (time24Pattern.test(strValue)) return true;
  
  // 12-hour format with AM/PM
  const time12Pattern = /^([0]?[1-9]|1[0-2]):([0-5][0-9])(:([0-5][0-9]))?\s*(AM|PM|am|pm)$/;
  if (time12Pattern.test(strValue)) return true;
  
  // Excel decimal (0-1)
  const numValue = Number(value);
  if (!isNaN(numValue) && numValue >= 0 && numValue < 1) return true;
  
  return false;
}

function convertToTime(value) {
  if (value === null || value === undefined || value === '') return null;
  
  const strValue = String(value).trim();
  
  // Pattern 1: Already HH:MM:SS (return as-is)
  const time24SSPattern = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])$/;
  if (time24SSPattern.test(strValue)) return strValue;
  
  // Pattern 2: HH:MM (add seconds)
  const time24Pattern = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
  if (time24Pattern.test(strValue)) return `${strValue}:00`;
  
  // Pattern 3: HH:MM:SS AM/PM (convert to 24-hour)
  const time12SSMatch = strValue.match(/^([0]?[1-9]|1[0-2]):([0-5][0-9]):([0-5][0-9])\s*(AM|PM|am|pm)$/);
  if (time12SSMatch) {
    let hours = parseInt(time12SSMatch[1]);
    const minutes = time12SSMatch[2];
    const seconds = time12SSMatch[3];
    const period = time12SSMatch[4].toUpperCase();
    
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    
    return `${String(hours).padStart(2, '0')}:${minutes}:${seconds}`;
  }
  
  // Pattern 4: HH:MM AM/PM (convert to 24-hour, add seconds)
  const time12Match = strValue.match(/^([0]?[1-9]|1[0-2]):([0-5][0-9])\s*(AM|PM|am|pm)$/);
  if (time12Match) {
    let hours = parseInt(time12Match[1]);
    const minutes = time12Match[2];
    const period = time12Match[3].toUpperCase();
    
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    
    return `${String(hours).padStart(2, '0')}:${minutes}:00`;
  }
  
  // Pattern 5: Excel decimal (0 to 1 = midnight to midnight)
  const numValue = Number(value);
  if (!isNaN(numValue) && numValue >= 0 && numValue < 1) {
    const totalSeconds = Math.round(numValue * 86400); // 24 hours = 86400 seconds
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  
  return null; // Invalid time
}

function validateTypeConversion(columnKey, targetType) {
  // Returns { isValid: boolean, invalidCount: number, invalidRows: number[] }
  const invalidRows = [];
  
  tableState.rows.forEach((row, index) => {
    const value = row.data[columnKey];
    if (value === null || value === undefined || value === '') return; // Empty is valid
    
    let isValid = true;
    switch (targetType) {
      case 'number':
        // Extract first number from string (handles '123-abc', 'Vehicle-4479', etc.)
        const numMatch = String(value).match(/-?\d+\.?\d*/);
        const parsed = numMatch ? parseFloat(numMatch[0]) : NaN;
        isValid = !isNaN(parsed) && isFinite(parsed);
        break;
      case 'boolean':
        const strVal = String(value).toLowerCase();
        isValid = strVal === 'true' || strVal === 'false' || 
                  typeof value === 'boolean';
        break;
      case 'date':
        const date = new Date(value);
        isValid = !isNaN(date.getTime());
        break;
      case 'time':
        isValid = isValidTimeValue(value);
        break;
      case 'text':
        isValid = true; // Text accepts everything
        break;
    }
    
    if (!isValid) {
      invalidRows.push(index + 1); // 1-indexed for display
    }
  });
  
  return {
    isValid: invalidRows.length === 0,
    invalidCount: invalidRows.length,
    invalidRows: invalidRows.slice(0, 5) // First 5 for display
  };
}

function forceColumnType(columnId, targetType) {
  const column = tableState.columns.find(col => col.id === columnId);
  if (!column) return;
  
  // Validate existing data
  const validation = validateTypeConversion(column.key, targetType);
  if (!validation.isValid) {
    // Show error toast
    const rowsList = validation.invalidRows.length > 0 
      ? ` (rows: ${validation.invalidRows.join(', ')}${validation.invalidCount > 5 ? '...' : ''})`
      : '';
    showSelectionFeedback(
      `Cannot force type: ${validation.invalidCount} cell${validation.invalidCount > 1 ? 's' : ''} contain invalid data${rowsList}`,
      'error'
    );
    return;
  }
  
  // Convert existing data to target type
  let convertedCount = 0;
  tableState.rows.forEach(row => {
    const currentValue = row.data[column.key];
    if (currentValue === null || currentValue === undefined || currentValue === '') return;
    
    let convertedValue = currentValue;
    switch (targetType) {
      case 'number':
        // Extract first number from string (handles '123-abc' → 123, 'Vehicle-4479' → 4479)
        const numMatch = String(currentValue).match(/-?\d+\.?\d*/);
        convertedValue = numMatch ? parseFloat(numMatch[0]) : currentValue;
        break;
      case 'boolean':
        const strVal = String(currentValue).toLowerCase();
        convertedValue = strVal === 'true' || currentValue === true;
        break;
      case 'date':
        const date = new Date(currentValue);
        convertedValue = date.toISOString().split('T')[0];
        break;
      case 'time':
        convertedValue = convertToTime(currentValue);
        break;
      case 'text':
        convertedValue = String(currentValue);
        break;
    }
    
    if (convertedValue !== currentValue) {
      row.data[column.key] = convertedValue;
      convertedCount++;
    }
  });
  
  // Apply forced type
  if (!column.inferredType) {
    column.inferredType = column.type; // Save original inferred type
  }
  column.forcedType = targetType;
  column.type = targetType;
  
  // Update sheet metadata
  if (isMultiSheetMode.value && activeSheet.value) {
    activeSheet.value.columns = [...tableState.columns];
    activeSheet.value.rows = tableState.rows.map(row => ({ ...row, data: { ...row.data } }));
    activeSheet.value.metadata.modified = new Date();
  }
  
  // Emit event
  emit('column-type-forced', {
    sheetId: props.activeSheetId,
    columnId: column.id,
    columnKey: column.key,
    forcedType: targetType,
    previousType: column.inferredType,
    convertedCount
  });
  
  const message = convertedCount > 0 
    ? `Column "${column.title}" type set to ${targetType} (${convertedCount} cell${convertedCount > 1 ? 's' : ''} converted)`
    : `Column "${column.title}" type set to ${targetType}`;
  showSelectionFeedback(message);
  tableState.showColumnMenu = null;
  tableState.showTypeSubmenu = false;
}

function resetColumnType(columnId) {
  const column = tableState.columns.find(col => col.id === columnId);
  if (!column || !column.forcedType) return;
  
  column.type = column.inferredType || 'text';
  column.forcedType = null;
  
  // Update sheet metadata
  if (isMultiSheetMode.value && activeSheet.value) {
    activeSheet.value.columns = [...tableState.columns];
    activeSheet.value.metadata.modified = new Date();
  }
  
  // Emit event
  emit('column-type-reset', {
    sheetId: props.activeSheetId,
    columnId: column.id,
    columnKey: column.key,
    resetToType: column.type
  });
  
  showSelectionFeedback(`Column "${column.title}" type reset to auto (${column.type})`);
  tableState.showColumnMenu = null;
  tableState.showTypeSubmenu = false;
}

function getCurrentColumnType(columnId) {
  const column = tableState.columns.find(col => col.id === columnId);
  return column?.type || 'text';
}

function isColumnTypeForced(columnId) {
  const column = tableState.columns.find(col => col.id === columnId);
  return Boolean(column?.forcedType);
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
  // Force Vue reactivity
  tableState.selectedColumns = new Set(tableState.selectedColumns);
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
  // Force Vue reactivity
  tableState.selectedColumns = new Set(tableState.selectedColumns);
  
  if (addedCount > 0) {
    showSelectionFeedback(`Added ${addedCount} columns to selection`);
  } else {
    showSelectionFeedback('No gaps to fill in selection');
  }
}

function selectAllColumns() {
  const initialCount = tableState.selectedColumns.size;
  visibleColumns.value.forEach(column => tableState.selectedColumns.add(column.id));
  // Force Vue reactivity
  tableState.selectedColumns = new Set(tableState.selectedColumns);
  const addedCount = tableState.selectedColumns.size - initialCount;
  
  if (addedCount > 0) {
    showSelectionFeedback(`Selected ${addedCount} additional columns`);
  } else {
    showSelectionFeedback('All columns already selected');
  }
}

  function showSelectionFeedback(message, type = 'info') {
    // Only manipulate DOM on client side for SSR compatibility
    if (!import.meta.client) return;
    
    // Create a toast-like notification
    const toast = document.createElement('div');
    const bgColor = type === 'error' ? 'bg-red-500' : 'bg-blue-500';
    toast.className = `fixed top-4 right-4 ${bgColor} text-white px-4 py-2 shadow-lg z-50 text-sm font-medium transform transition-all duration-300`;
    toast.textContent = message;
    toast.style.transform = 'translateX(100%)';
    
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
      toast.style.transform = 'translateX(0)';
    }, 10);
    
    // Animate out and remove (longer duration for errors)
    const duration = type === 'error' ? 4000 : 2000;
    setTimeout(() => {
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (document.body.contains(toast)) {
          document.body.removeChild(toast);
        }
      }, 300);
    }, duration);
    
    // Add visual feedback to selected elements (optional, skip for errors)
    if (type !== 'error') {
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
  // Force Vue reactivity
  tableState.selectedColumns = new Set(tableState.selectedColumns);
  
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
    inferredType: columnConfig.inferredType || columnConfig.type || 'text',
    forcedType: columnConfig.forcedType || null,
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
    title: `${sourceColumn.title} (Copy)`,
    inferredType: sourceColumn.inferredType || sourceColumn.type,
    forcedType: sourceColumn.forcedType || null
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
    case 'time':
      // Time input returns HH:MM or HH:MM:SS format
      // Ensure it's in HH:MM:SS format (add seconds if missing)
      if (typeof newValue === 'string' && newValue.match(/^\d{2}:\d{2}$/)) {
        processedValue = `${newValue}:00`;
      } else {
        processedValue = String(newValue).trim();
      }
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
    case 'time':
      // Time values should already be in HH:MM:SS format
      // If it's a decimal (Excel format), convert it
      if (typeof value === 'number' && value >= 0 && value < 1) {
        const totalSeconds = Math.round(value * 86400);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      }
      return String(value);
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
  if (tableState.showColumnMenu === columnId) {
    tableState.showColumnMenu = null;
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
}

// Row context menu
function toggleRowMenu(rowIndex, event) {
  if (tableState.showRowMenu === rowIndex) {
    tableState.showRowMenu = null;
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
}

// Expose methods for parent component
defineExpose({
  getTableData: () => tableState.rows.map(row => row.data),
  clearSelection: () => {
    tableState.selectedRows.clear();
    tableState.selectedColumns.clear();
    tableState.allRowsSelected = false;
    // Force Vue reactivity
    tableState.selectedRows = new Set(tableState.selectedRows);
    tableState.selectedColumns = new Set(tableState.selectedColumns);
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
    // Force Vue reactivity
    tableState.selectedColumns = new Set(tableState.selectedColumns);
    tableState.selectedRows = new Set(tableState.selectedRows);
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

// Pagination functions
function goToPage(page) {
  if (page < 1 || page > totalPages.value) return;
  tableState.currentPage = page;
}

function nextPage() {
  if (tableState.currentPage < totalPages.value) {
    tableState.currentPage++;
  }
}

function prevPage() {
  if (tableState.currentPage > 1) {
    tableState.currentPage--;
  }
}

function changeRowsPerPage(count) {
  tableState.rowsPerPage = count;
  tableState.currentPage = 1; // Reset to first page
}

function handleClickOutside(e) {
  if (!e.target.closest('.column-menu') && !e.target.closest('.column-menu-trigger')) {
    tableState.showColumnMenu = null;
    tableState.showTypeSubmenu = false;
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
        inferredType: col?.inferredType || col?.type || 'text',
        forcedType: col?.forcedType || null,
        width: col.width || 150,
        visible: col.visible !== false,
        sortable: col.sortable !== false,
        editable: col.editable !== false
      }))
    : (props.columns || []).map(col => ({
        ...col,
        id: col?.id ? col.id : `col_${Date.now()}_${Math.random()}`,
        inferredType: col?.inferredType || col?.type || 'text',
        forcedType: col?.forcedType || null,
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
  // Force Vue reactivity
  tableState.selectedRows = new Set(tableState.selectedRows);
  tableState.selectedColumns = new Set(tableState.selectedColumns);
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
            // Process columns to ensure they have IDs
            columns: sheet.columns.map(col => ({
                ...col,
                id: col?.id ? col.id : `col_${Date.now()}_${Math.random()}`,
                inferredType: col?.inferredType || col?.type || 'text',
                forcedType: col?.forcedType || null,
                width: col.width || 150,
                visible: col.visible !== false,
                sortable: col.sortable !== false,
                editable: col.editable !== false
            })),
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
            inferredType: col?.inferredType || col?.type || 'text',
            forcedType: col?.forcedType || null,
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
    
    // Only add event listeners on client side for SSR compatibility
    if (import.meta.client) {
        document.addEventListener('click', handleClickOutside);
        document.addEventListener('keydown', handleEscapeKey);
        document.addEventListener('keydown', handleKeyboardShortcuts);
    }
});

onUnmounted(() => {
    // Clean up event listeners only on client side
    if (import.meta.client) {
        document.removeEventListener('click', handleClickOutside);
        document.removeEventListener('keydown', handleEscapeKey);
        document.removeEventListener('keydown', handleKeyboardShortcuts);
    }
});  
</script>
<template>
  <div class="w-full">
    <!-- Large Dataset Warning -->
    <div v-if="tableState.showLargeDatasetWarning" class="mb-4 p-4 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800">
      <div class="flex items-start gap-3">
        <font-awesome-icon :icon="['fas', 'triangle-exclamation']" class="w-5 h-5 mt-0.5 flex-shrink-0" />
        <div>
          <h3 class="font-semibold mb-1">Large Dataset Detected</h3>
          <p class="text-sm">
            This file contains <strong>{{ tableState.rows.length.toLocaleString() }} rows</strong>. 
            For performance, only the first <strong>{{ maxDisplayRows.toLocaleString() }} rows</strong> are shown in the preview.
            All data will be included when you create the data source.
          </p>
        </div>
      </div>
    </div>
    
    <!-- Performance Mode Info -->
    <div v-if="isLargeDataset && tableState.rows.length <= maxDisplayRows" class="mb-4 p-3 bg-blue-50 border-l-4 border-blue-400 text-blue-800 text-sm">
      <div class="flex items-center gap-2">
        <font-awesome-icon :icon="['fas', 'circle-info']" class="w-4 h-4" />
        <span>Performance mode: Showing {{ tableState.rows.length.toLocaleString() }} rows with pagination for better performance.</span>
      </div>
    </div>
    
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
          <font-awesome-icon :icon="['fas', 'trash']" class="w-4 h-4" />
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
          @click="clearColumnSelection"
          class="border border-purple-500 text-purple-500 hover:bg-purple-50 px-4 py-2 text-sm font-medium transition-colors duration-200"
        >
          Clear Column Selection
        </button>
      </div>
    </div>

    <!-- Main Table Container -->
        <!-- Main Table Container -->
    <div class="overflow-auto ring-1 ring-gray-300 ring-inset rounded-lg shadow-sm max-h-screen data-table-container">
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
                @change.stop="toggleAllColumns"
                @click.stop
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
                :checked="isColumnSelected(column.id)"
                @change.stop="toggleColumnSelection(column.id, $event)"
                @click.stop
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
                isColumnSelected(column.id) ? 'bg-blue-100 border-blue-300' : 'bg-gray-50',
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
                  <div v-if="isColumnSelected(column.id)" class="w-2 h-2 bg-blue-500 rounded-full" title="Selected"></div>
                </div>
                
                <!-- Sort Indicator -->
                <div v-if="column.sortable" class="mr-2 flex-shrink-0">
                  <font-awesome-icon
                    v-if="sortColumn === column.key && sortDirection === 'asc'"
                    :icon="['fas', 'chevron-down']"
                    class="w-4 h-4 text-blue-500"
                  />
                  <font-awesome-icon
                    v-else-if="sortColumn === column.key && sortDirection === 'desc'"
                    :icon="['fas', 'chevron-up']"
                    class="w-4 h-4 text-blue-500"
                  />
                  <font-awesome-icon
                    v-else
                    :icon="['fas', 'sort']"
                    class="w-4 h-4 text-gray-400"
                  />
                </div>
              </div>
              
              <!-- Column Menu Trigger -->
              <div 
                class="absolute top-1 right-1 w-6 h-6 rounded hover:bg-gray-200 opacity-0 group-hover:opacity-100 cursor-pointer flex items-center justify-center transition-all duration-200 column-menu-trigger"
                @click.stop="toggleColumnMenu(column.id, $event)"
                :class="{ 'bg-blue-200 opacity-100': showColumnMenu === column.id }"
              >
                <font-awesome-icon :icon="['fas', 'ellipsis-vertical']" class="w-4 h-4 text-gray-600" />
              </div>
            </th>
            
            <!-- Add Column Button -->
            <th class="w-12 p-3 border-r border-gray-200 text-center bg-gray-50 hover:bg-gray-100">
              <button
                @click="addNewColumn()"
                class="w-8 h-8 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center transition-colors duration-200"
                title="Add New Column (Ctrl+Alt++)"
              >
                <font-awesome-icon :icon="['fas', 'plus']" class="w-4 h-4" />
              </button>
            </th>
          </tr>
        </thead>

        <!-- Table Body -->
        <tbody class="divide-y divide-gray-200">
          <tr 
            v-for="row in displayRows" 
            :key="row.id"
            class="hover:bg-gray-50 transition-colors duration-150"
            :class="isRowSelected(row.id) ? 'bg-blue-50' : 'bg-white'"
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
                  :checked="isRowSelected(row.id)"
                  @change.stop="toggleRowSelection(row.id)"
                  @click.stop
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
                
                <input 
                  v-else-if="column.type === 'time'"
                  type="time"
                  step="1"
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
                <font-awesome-icon :icon="['fas', 'file-lines']" class="w-12 h-12 text-gray-300" />
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
          <font-awesome-icon :icon="['fas', 'plus']" class="w-4 h-4" />
          Add Row
        </button>
      </div>
      
      <!-- Pagination Controls -->
      <div v-if="shouldPaginate" class="p-4 border-t border-gray-200 bg-gray-50">
        <div class="flex flex-col sm:flex-row justify-between items-center gap-4">
          <!-- Pagination Info -->
          <div class="text-sm text-gray-600">
            <span v-if="paginationInfo">
              Showing <span class="font-semibold">{{ paginationInfo.start }}</span> to 
              <span class="font-semibold">{{ paginationInfo.end }}</span> of 
              <span class="font-semibold">{{ paginationInfo.total.toLocaleString() }}</span> rows
              <span v-if="paginationInfo.actualTotal > paginationInfo.total" class="text-yellow-600">
                ({{ paginationInfo.actualTotal.toLocaleString() }} total)
              </span>
            </span>
          </div>
          
          <!-- Pagination Buttons -->
          <div class="flex items-center gap-2">
            <button
              @click="prevPage"
              :disabled="tableState.currentPage === 1"
              class="px-3 py-1.5 border rounded-lg transition-colors duration-200"
              :class="tableState.currentPage === 1 
                ? 'border-gray-200 text-gray-400 cursor-not-allowed' 
                : 'border-gray-300 text-gray-700 hover:bg-gray-100'"
            >
              <font-awesome-icon :icon="['fas', 'chevron-left']" class="w-3 h-3" />
            </button>
            
            <div class="flex items-center gap-1">
              <span class="text-sm text-gray-600">Page</span>
              <input
                type="number"
                v-model.number="tableState.currentPage"
                @change="goToPage(tableState.currentPage)"
                min="1"
                :max="totalPages"
                class="w-16 px-2 py-1 text-sm text-center border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <span class="text-sm text-gray-600">of {{ totalPages }}</span>
            </div>
            
            <button
              @click="nextPage"
              :disabled="tableState.currentPage === totalPages"
              class="px-3 py-1.5 border rounded-lg transition-colors duration-200"
              :class="tableState.currentPage === totalPages 
                ? 'border-gray-200 text-gray-400 cursor-not-allowed' 
                : 'border-gray-300 text-gray-700 hover:bg-gray-100'"
            >
              <font-awesome-icon :icon="['fas', 'chevron-right']" class="w-3 h-3" />
            </button>
          </div>
          
          <!-- Rows Per Page Selector -->
          <div class="flex items-center gap-2 text-sm">
            <label class="text-gray-600">Rows:</label>
            <select
              v-model.number="tableState.rowsPerPage"
              @change="changeRowsPerPage(tableState.rowsPerPage)"
              class="px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option :value="50">50</option>
              <option :value="100">100</option>
              <option :value="250">250</option>
              <option :value="500">500</option>
              <option :value="1000">1000</option>
            </select>
          </div>
        </div>
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
          @click="sortColumnByDirection(showColumnMenu, 'asc'); tableState.showTypeSubmenu = false;" 
          class="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center gap-2 transition-colors duration-150"
        >
          <font-awesome-icon :icon="['fas', 'chevron-down']" class="w-4 h-4" />
          Sort Ascending
        </button>
        <button 
          @click="sortColumnByDirection(showColumnMenu, 'desc'); tableState.showTypeSubmenu = false;" 
          class="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center gap-2 transition-colors duration-150"
        >
          <font-awesome-icon :icon="['fas', 'chevron-up']" class="w-4 h-4" />
          Sort Descending
        </button>
        <hr class="my-1 border-gray-200">
        <button 
          v-if="selectedColumns.size >= 2 && hasSelectionGaps"
          @click="fillSelectionGaps(); tableState.showColumnMenu = null; tableState.showTypeSubmenu = false;" 
          class="w-full text-left px-4 py-2 hover:bg-orange-50 text-orange-600 text-sm flex items-center gap-2 transition-colors duration-150"
        >
          <font-awesome-icon :icon="['fas', 'bars']" class="w-4 h-4" />
          Fill Selection Gaps
        </button>
        <hr class="my-1 border-gray-200">
        <button 
          @click="insertColumnAt(getColumnIndex(showColumnMenu)); tableState.showColumnMenu = null; tableState.showTypeSubmenu = false;" 
          class="w-full text-left px-4 py-2 hover:bg-green-50 text-green-600 text-sm flex items-center gap-2 transition-colors duration-150"
        >
          <font-awesome-icon :icon="['fas', 'plus']" class="w-4 h-4" />
          Insert Column Before
        </button>
        <button 
          @click="insertColumnAt(getColumnIndex(showColumnMenu) + 1); tableState.showColumnMenu = null; tableState.showTypeSubmenu = false;" 
          class="w-full text-left px-4 py-2 hover:bg-green-50 text-green-600 text-sm flex items-center gap-2 transition-colors duration-150"
        >
          <font-awesome-icon :icon="['fas', 'plus']" class="w-4 h-4" />
          Insert Column After
        </button>
        <button 
          @click="duplicateColumn(showColumnMenu); tableState.showColumnMenu = null; tableState.showTypeSubmenu = false;" 
          class="w-full text-left px-4 py-2 hover:bg-green-50 text-green-600 text-sm flex items-center gap-2 transition-colors duration-150"
        >
          <font-awesome-icon :icon="['fas', 'copy']" class="w-4 h-4" />
          Duplicate Column
        </button>
        <hr class="my-1 border-gray-200">
        <button 
          @click="startColumnEdit(showColumnMenu); tableState.showTypeSubmenu = false;" 
          class="w-full text-left px-4 py-2 hover:bg-blue-50 text-blue-600 text-sm flex items-center gap-2 transition-colors duration-150"
        >
          <font-awesome-icon :icon="['fas', 'pen']" class="w-4 h-4" />
          Rename Column
        </button>
        
        <hr class="my-1 border-gray-200">
        
        <!-- Force Type Submenu Trigger -->
        <div class="relative">
          <button 
            @click="tableState.showTypeSubmenu = !tableState.showTypeSubmenu"
            @mouseenter="tableState.showTypeSubmenu = true"
            class="w-full text-left px-4 py-2 hover:bg-purple-50 text-purple-600 text-sm flex items-center justify-between transition-colors duration-150"
          >
            <div class="flex items-center gap-2">
              <font-awesome-icon :icon="['fas', 'wand-magic-sparkles']" class="w-4 h-4" />
              Force Type
            </div>
            <font-awesome-icon :icon="['fas', 'chevron-right']" class="w-3 h-3" />
          </button>
          
          <!-- Type Submenu -->
          <Transition
            enter-active-class="transition ease-out duration-150"
            enter-from-class="opacity-0 scale-95"
            enter-to-class="opacity-100 scale-100"
            leave-active-class="transition ease-in duration-100"
            leave-from-class="opacity-100 scale-100"
            leave-to-class="opacity-0 scale-95"
          >
            <div 
              v-if="tableState.showTypeSubmenu"
              class="absolute left-full top-0 ml-1 bg-white border border-gray-300 shadow-lg py-1 min-w-[140px] z-[60]"
            >
              <button 
                @click="forceColumnType(showColumnMenu, 'text')"
                class="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center justify-between transition-colors duration-150"
              >
                <span>Text</span>
                <font-awesome-icon 
                  v-if="getCurrentColumnType(showColumnMenu) === 'text'"
                  :icon="['fas', 'check']" 
                  class="w-3 h-3 text-green-600" 
                />
              </button>
              <button 
                @click="forceColumnType(showColumnMenu, 'number')"
                class="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center justify-between transition-colors duration-150"
              >
                <span>Number</span>
                <font-awesome-icon 
                  v-if="getCurrentColumnType(showColumnMenu) === 'number'"
                  :icon="['fas', 'check']" 
                  class="w-3 h-3 text-green-600" 
                />
              </button>
              <button 
                @click="forceColumnType(showColumnMenu, 'date')"
                class="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center justify-between transition-colors duration-150"
              >
                <span>Date</span>
                <font-awesome-icon 
                  v-if="getCurrentColumnType(showColumnMenu) === 'date'"
                  :icon="['fas', 'check']" 
                  class="w-3 h-3 text-green-600" 
                />
              </button>
              <button 
                @click="forceColumnType(showColumnMenu, 'time')"
                class="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center justify-between transition-colors duration-150"
              >
                <span>Time</span>
                <font-awesome-icon 
                  v-if="getCurrentColumnType(showColumnMenu) === 'time'"
                  :icon="['fas', 'check']" 
                  class="w-3 h-3 text-green-600" 
                />
              </button>
              <button 
                @click="forceColumnType(showColumnMenu, 'boolean')"
                class="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center justify-between transition-colors duration-150"
              >
                <span>Boolean</span>
                <font-awesome-icon 
                  v-if="getCurrentColumnType(showColumnMenu) === 'boolean'"
                  :icon="['fas', 'check']" 
                  class="w-3 h-3 text-green-600" 
                />
              </button>
              
              <hr 
                v-if="isColumnTypeForced(showColumnMenu)"
                class="my-1 border-gray-200"
              >
              
              <button 
                v-if="isColumnTypeForced(showColumnMenu)"
                @click="resetColumnType(showColumnMenu)"
                class="w-full text-left px-4 py-2 hover:bg-amber-50 text-amber-600 text-sm flex items-center gap-2 transition-colors duration-150"
              >
                <font-awesome-icon :icon="['fas', 'rotate-left']" class="w-3 h-3" />
                Reset to Auto
              </button>
            </div>
          </Transition>
        </div>
        
        <hr class="my-1 border-gray-200">
        
        <button 
          @click="removeColumn(showColumnMenu); tableState.showTypeSubmenu = false;" 
          class="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 text-sm flex items-center gap-2 transition-colors duration-150"
        >
          <font-awesome-icon :icon="['fas', 'trash']" class="w-4 h-4" />
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
          <font-awesome-icon :icon="['fas', 'plus']" class="w-4 h-4" />
          Insert Row Above
        </button>
        <button 
          @click="insertRowAt(showRowMenu + 1); tableState.showRowMenu = null;" 
          class="w-full text-left px-4 py-2 hover:bg-green-50 text-green-600 text-sm flex items-center gap-2 transition-colors duration-150"
        >
          <font-awesome-icon :icon="['fas', 'plus']" class="w-4 h-4" />
          Insert Row Below
        </button>
        <button 
          @click="duplicateRow(tableState.rows[showRowMenu]?.id); tableState.showRowMenu = null;" 
          class="w-full text-left px-4 py-2 hover:bg-green-50 text-green-600 text-sm flex items-center gap-2 transition-colors duration-150"
        >
          <font-awesome-icon :icon="['fas', 'copy']" class="w-4 h-4" />
          Duplicate Row
        </button>
        <hr class="my-1 border-gray-200">
        <button 
          @click="removeRowByIndex(showRowMenu); tableState.showRowMenu = null;" 
          class="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 text-sm flex items-center gap-2 transition-colors duration-150"
        >
          <font-awesome-icon :icon="['fas', 'trash']" class="w-4 h-4" />
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
                  <font-awesome-icon :icon="['fas', 'xmark']" class="w-3 h-3" />
                </button>
                
                <!-- Menu Trigger -->
                <button
                  @click.stop="toggleSheetMenu(sheet.id, $event)"
                  class="ml-1 w-4 h-4 rounded hover:bg-gray-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 sheet-menu-trigger"
                  title="Sheet options"
                >
                  <font-awesome-icon :icon="['fas', 'ellipsis-vertical']" class="w-3 h-3" />
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
              <font-awesome-icon :icon="['fas', 'plus']" class="w-4 h-4 text-gray-600" />
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
          <font-awesome-icon :icon="['fas', 'pen']" class="w-4 h-4" />
          Rename Sheet
        </button>
        <button 
          @click="duplicateSheet(sheetsState.showSheetMenu); sheetsState.showSheetMenu = null;" 
          class="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center gap-2 transition-colors duration-150"
        >
          <font-awesome-icon :icon="['fas', 'clipboard-list']" class="w-4 h-4" />
          Duplicate Sheet
        </button>
        <hr class="my-1 border-gray-200">
        <button 
          v-if="sheetsState.sheets.length > 1"
          @click="deleteSheet(sheetsState.showSheetMenu); sheetsState.showSheetMenu = null;" 
          class="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 text-sm flex items-center gap-2 transition-colors duration-150"
        >
          <font-awesome-icon :icon="['fas', 'trash']" class="w-4 h-4" />
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
