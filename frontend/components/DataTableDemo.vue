<template>
  <div class="p-6 bg-gray-50 min-h-screen">
    <div class="max-w-7xl mx-auto">
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900 mb-2">Custom Data Table Demo</h1>
        <p class="text-gray-600">Interactive data table with sorting, editing, and selection features.</p>
      </div>

      <!-- Demo Controls -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Demo Controls</h2>
        <div class="flex flex-wrap gap-4">
          <button 
            @click="addSampleRow"
            class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
          >
            Add Sample Row
          </button>
          <button 
            @click="loadSampleData"
            class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
          >
            Load Sample Data
          </button>
          <button 
            @click="clearAllData"
            class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
          >
            Clear All Data
          </button>
          <button 
            @click="exportData"
            class="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
          >
            Export Data
          </button>
        </div>
      </div>

      <!-- Custom Data Table -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Data Table</h2>
        
        <CustomDataTable
          :initial-data="tableData"
          :columns="columnDefinitions"
          :editable="true"
          @cell-updated="handleCellUpdate"
          @row-selected="handleRowSelection"
          @rows-removed="handleRowsRemoved"
          @column-removed="handleColumnRemoved"
          @data-changed="handleDataChanged"
          ref="dataTable"
        />
      </div>

      <!-- Event Log -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Event Log</h2>
        <div class="bg-gray-50 rounded-lg p-4 max-h-48 overflow-y-auto">
          <div v-if="eventLog.length === 0" class="text-gray-500 text-sm">
            No events yet. Interact with the table to see events here.
          </div>
          <div 
            v-for="(event, index) in eventLog.slice().reverse()" 
            :key="index"
            class="text-sm mb-2 p-2 bg-white rounded border"
          >
            <span class="font-medium text-blue-600">{{ event.type }}:</span>
            <span class="text-gray-700 ml-2">{{ event.message }}</span>
            <span class="text-gray-400 text-xs ml-2">{{ event.timestamp }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import CustomDataTable from '~/components/CustomDataTable.vue'

const dataTable = ref(null);
const eventLog = ref([]);

// Column definitions
const columnDefinitions = [
  { 
    key: 'name', 
    title: 'Full Name', 
    type: 'text', 
    sortable: true, 
    editable: true, 
    width: 200 
  },
  { 
    key: 'age', 
    title: 'Age', 
    type: 'number', 
    sortable: true, 
    editable: true, 
    width: 100 
  },
  { 
    key: 'email', 
    title: 'Email Address', 
    type: 'text', 
    sortable: true, 
    editable: true, 
    width: 250 
  },
  { 
    key: 'department', 
    title: 'Department', 
    type: 'text', 
    sortable: true, 
    editable: true, 
    width: 150 
  },
  { 
    key: 'active', 
    title: 'Active', 
    type: 'boolean', 
    sortable: true, 
    editable: true, 
    width: 100 
  },
  { 
    key: 'startDate', 
    title: 'Start Date', 
    type: 'date', 
    sortable: true, 
    editable: true, 
    width: 150 
  },
  { 
    key: 'salary', 
    title: 'Salary', 
    type: 'number', 
    sortable: true, 
    editable: true, 
    width: 120 
  }
];

// Sample data
const tableData = ref([
  { 
    name: 'John Doe', 
    age: 30, 
    email: 'john.doe@example.com', 
    department: 'Engineering', 
    active: true, 
    startDate: '2023-01-15',
    salary: 75000
  },
  { 
    name: 'Jane Smith', 
    age: 28, 
    email: 'jane.smith@example.com', 
    department: 'Marketing', 
    active: true, 
    startDate: '2023-03-22',
    salary: 65000
  },
  { 
    name: 'Bob Johnson', 
    age: 35, 
    email: 'bob.johnson@example.com', 
    department: 'Sales', 
    active: false, 
    startDate: '2022-11-08',
    salary: 58000
  },
  { 
    name: 'Alice Brown', 
    age: 32, 
    email: 'alice.brown@example.com', 
    department: 'HR', 
    active: true, 
    startDate: '2023-05-10',
    salary: 62000
  },
  { 
    name: 'Charlie Wilson', 
    age: 29, 
    email: 'charlie.wilson@example.com', 
    department: 'Engineering', 
    active: true, 
    startDate: '2023-02-14',
    salary: 78000
  }
]);

// Event handlers
const handleCellUpdate = (event) => {
  logEvent('Cell Updated', `${event.columnKey}: "${event.oldValue}" → "${event.newValue}" for row ${event.rowId}`);
};

const handleRowSelection = (event) => {
  if (event.allSelected !== undefined) {
    logEvent('Row Selection', event.allSelected ? 'All rows selected' : 'All rows deselected');
  } else {
    logEvent('Row Selection', `Row ${event.rowId} ${event.selected ? 'selected' : 'deselected'}. Total: ${event.selectedCount}`);
  }
};

const handleRowsRemoved = (event) => {
  if (event.allRemoved) {
    logEvent('Rows Removed', `All ${event.removedRows.length} rows removed`);
  } else {
    logEvent('Rows Removed', `${event.removedRows.length} rows removed. ${event.remainingCount} remaining`);
  }
};

const handleColumnRemoved = (event) => {
  const columnNames = event.removedColumns.map(col => col.title).join(', ');
  logEvent('Column Removed', `Removed columns: ${columnNames}. ${event.remainingColumns.length} remaining`);
};

const handleDataChanged = (event) => {
  logEvent('Data Changed', `Type: ${event.type}. Total rows: ${event.data.length}`);
};

// Demo functions
const addSampleRow = () => {
  const sampleNames = ['David Lee', 'Emma Davis', 'Frank Miller', 'Grace Taylor', 'Henry Anderson'];
  const sampleDepartments = ['Engineering', 'Marketing', 'Sales', 'HR', 'Finance'];
  
  const randomName = sampleNames[Math.floor(Math.random() * sampleNames.length)];
  const randomDept = sampleDepartments[Math.floor(Math.random() * sampleDepartments.length)];
  const randomAge = Math.floor(Math.random() * 20) + 25; // 25-44
  const randomSalary = Math.floor(Math.random() * 40000) + 50000; // 50k-90k
  
  const newRow = {
    name: randomName,
    age: randomAge,
    email: `${randomName.toLowerCase().replace(' ', '.')}@example.com`,
    department: randomDept,
    active: Math.random() > 0.2, // 80% chance of being active
    startDate: '2023-06-01',
    salary: randomSalary
  };
  
  if (dataTable.value) {
    dataTable.value.addRow(newRow);
    logEvent('Demo Action', `Added new row: ${randomName}`);
  }
};

const loadSampleData = () => {
  tableData.value = [
    { name: 'John Doe', age: 30, email: 'john.doe@example.com', department: 'Engineering', active: true, startDate: '2023-01-15', salary: 75000 },
    { name: 'Jane Smith', age: 28, email: 'jane.smith@example.com', department: 'Marketing', active: true, startDate: '2023-03-22', salary: 65000 },
    { name: 'Bob Johnson', age: 35, email: 'bob.johnson@example.com', department: 'Sales', active: false, startDate: '2022-11-08', salary: 58000 },
    { name: 'Alice Brown', age: 32, email: 'alice.brown@example.com', department: 'HR', active: true, startDate: '2023-05-10', salary: 62000 },
    { name: 'Charlie Wilson', age: 29, email: 'charlie.wilson@example.com', department: 'Engineering', active: true, startDate: '2023-02-14', salary: 78000 },
    { name: 'Diana Martinez', age: 31, email: 'diana.martinez@example.com', department: 'Finance', active: true, startDate: '2023-04-03', salary: 70000 },
    { name: 'Edward Thompson', age: 27, email: 'edward.thompson@example.com', department: 'Marketing', active: true, startDate: '2023-07-18', salary: 59000 },
    { name: 'Fiona Garcia', age: 33, email: 'fiona.garcia@example.com', department: 'Engineering', active: true, startDate: '2022-12-12', salary: 82000 }
  ];
  logEvent('Demo Action', 'Loaded sample data with 8 rows');
};

const clearAllData = () => {
  tableData.value = [];
  if (dataTable.value) {
    dataTable.value.clearSelection();
  }
  logEvent('Demo Action', 'Cleared all data');
};

const exportData = () => {
  if (dataTable.value) {
    const data = dataTable.value.getTableData();
    const json = JSON.stringify(data, null, 2);
    
    // Create and download file
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'table-data.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    logEvent('Demo Action', `Exported ${data.length} rows to JSON file`);
  }
};

// Utility functions
const logEvent = (type, message) => {
  eventLog.value.push({
    type,
    message,
    timestamp: new Date().toLocaleTimeString()
  });
  
  // Keep only last 50 events
  if (eventLog.value.length > 50) {
    eventLog.value = eventLog.value.slice(-50);
  }
};
</script>
