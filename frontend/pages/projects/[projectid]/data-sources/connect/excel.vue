<script setup>

definePageMeta({ layout: 'marketing-project' });
import _ from 'lodash';
const { $swal } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const config = useRuntimeConfig();

let dropZone = null;
const state = reactive({
    data_source_name: '',
    files: [],
    show_table_dialog: false,
    sheets: [], // Unified collection of all sheets from all Excel files
    activeSheetId: null,
    selected_file: null,
    loading: false,
    upload_id: 0,
    showClassificationModal: false,
    selectedClassification: null,
});

// Computed properties for button state management
const allFilesCompleted = computed(() => {
    if (!state.files || state.files.length === 0) return false;
    return state.files.every(file => file.status === 'completed');
});

const hasProcessingFiles = computed(() => {
    return state.files.some(file => file.status === 'processing');
});

const hasErrorFiles = computed(() => {
    return state.files.some(file => file.status === 'error');
});

const buttonDisabled = computed(() => {
    return state.loading || !allFilesCompleted.value || state.files.length === 0;
});

const buttonStatusText = computed(() => {
    if (state.loading) return 'Creating Data Source...';
    if (state.files.length === 0) return 'Please upload Excel files first';
    if (hasErrorFiles.value) return 'Some files failed to process';
    if (hasProcessingFiles.value) return 'Processing files...';
    if (allFilesCompleted.value) return 'Ready to create data source';
    return 'Upload Excel files to continue';
});

// Sheet Management Functions
function createSheetFromWorksheet(file, sheetData, sheetName, sheetIndex) {
    const displaySheetName = `${sheetName} - ${file.name}`;
    const sheetId = `${file.id}_sheet_${sheetIndex}`;
    
    const sheet = {
        id: sheetId,
        name: displaySheetName,
        fileName: file.name,
        fileId: file.id,
        sheetName: sheetName,
        sheetIndex: sheetIndex,
        columns: sheetData.columns || [],
        rows: (sheetData.rows || []).map((rowData, index) => ({
            id: `row_${Date.now()}_${index}_${Math.random()}`,
            index: index,
            selected: false,
            data: rowData
        })),
        metadata: {
            created: new Date(),
            modified: new Date(),
            rowCount: sheetData.rows?.length || 0,
            columnCount: sheetData.columns?.length || 0,
            excelFileId: file.id,
            originalSheetName: sheetName
        }
    };
    
    return sheet;
}

function addSheetToCollection(sheet) {
    // Remove existing sheet with same ID if it exists
    const existingIndex = state.sheets.findIndex(s => s.id === sheet.id);
    if (existingIndex !== -1) {
        state.sheets[existingIndex] = sheet;
    } else {
        state.sheets.push(sheet);
    }
    
    // Set as active if it's the first sheet
    if (!state.activeSheetId) {
        state.activeSheetId = sheet.id;
    }
}

function removeSheetsByFileId(fileId) {
    state.sheets = state.sheets.filter(sheet => sheet.fileId !== fileId);
    
    // Update active sheet if current one was removed
    if (state.sheets.length > 0 && !state.sheets.find(s => s.id === state.activeSheetId)) {
        state.activeSheetId = state.sheets[0].id;
    } else if (state.sheets.length === 0) {
        state.activeSheetId = null;
    }
}

function getSheetsByFileId(fileId) {
    return state.sheets.filter(sheet => sheet.fileId === fileId);
}

function handleDrop(e) {
    preventDefaults(e);
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles(files);
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function showTable(fileId) {
    nextTick(() => {
        state.show_table_dialog = false;
        setTimeout(() => {
            const file = state.files.find((file) => file.id === fileId);
            state.selected_file = file;
            
            if (file && file.id) {
                // Get existing sheets for the selected file
                const fileSheets = getSheetsByFileId(fileId);
                
                // If sheets already exist, set active sheet and show table
                if (fileSheets.length > 0) {
                    const currentActiveSheet = state.sheets.find(s => s.id === state.activeSheetId);
                    if (!currentActiveSheet || currentActiveSheet.fileId !== fileId) {
                        state.activeSheetId = fileSheets[0].id;
                    }
                }
            }
            
            state.show_table_dialog = true;
        }, 500);
    });
}

function removeFile(fileId) {
    // Remove sheets associated with this file
    removeSheetsByFileId(fileId);
    
    // Remove the file itself
    state.files = state.files.filter((file) => file.id !== fileId);
    
    // Hide table dialog if no sheets remain
    if (state.sheets.length === 0) {
        state.show_table_dialog = false;
    }
}
async function createDataSource(classification = null) {
    // Prevent execution if button should be disabled
    if (buttonDisabled.value) {
        return;
    }

    const token = getAuthToken();
    if (!state.data_source_name || state.data_source_name.trim() === '') {
        $swal.fire({
            icon: 'error',
            title: `Error!`,
            text: `Please provide a name for the data source.`,
        });
        return;
    }
    
    if (state.sheets.length === 0) {
        $swal.fire({
            icon: 'error',
            title: `Error!`,
            text: `No sheet data available to create data source.`,
        });
        return;
    }

    // Additional check to ensure all files are completed
    if (!allFilesCompleted.value) {
        $swal.fire({
            icon: 'error',
            title: `Error!`,
            text: `Please wait for all Excel files to finish processing before creating the data source.`,
        });
        return;
    }
    
    state.loading = true;
    const url = `${baseUrl()}/data-source/add-excel-data-source`;
    let dataSourceId = null;
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Process each sheet as a separate data source entry
    for (const sheet of state.sheets) {
        if (!sheet.columns || sheet.columns.length === 0 || !sheet.rows || sheet.rows.length === 0) {
            console.log('Skipping empty sheet:', sheet.name);
            continue;
        }
        
        const file = state.files.find(f => f.id === sheet.fileId);
        if (!file) continue;
        
        file.status = 'uploading';
        
        // Convert sheet data to the expected format
        const sheetRows = sheet.rows.map(row => row.data || row);        
        const response = await $fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
            body: {
                file_id: file.id,
                data: {
                    columns: sheet.columns.map((column) => {
                        return {
                            title: column.title,
                            key: column.key,
                            column_name: column.key.substring(0, 20).replace(/\s/g,'_').toLowerCase(),
                            type: column.type,
                        };
                    }),
                    rows: sheetRows,
                },
                data_source_name: `${state.data_source_name}`.replace(/\s/g,'_').toLowerCase(),
                project_id: route.params.projectid,
                data_source_id: dataSourceId ? dataSourceId : null,
                classification: dataSourceId ? null : (classification || state.selectedClassification),
                sheet_info: {
                    sheet_id: sheet.id,
                    sheet_name: sheet.name,
                    file_name: sheet.fileName,
                    original_sheet_name: sheet.metadata.originalSheetName,
                    sheet_index: sheet.sheetIndex
                }
            }
        });
        
        dataSourceId = response.result.data_source_id;
        file.status = 'uploaded';
        console.log(`Sheet ${sheet.name} uploaded successfully`);
        
        await sleep(1000);
    }
    
    state.loading = false;
    
    $swal.fire({
        icon: 'success',
        title: 'Success!',
        text: `Excel data source created with ${state.sheets.length} sheets.`,
    });
    
    router.push(`/projects/${route.params.projectid}`);
}

function handleCreateClick() {
    if (buttonDisabled.value) return;
    state.showClassificationModal = true;
}

function goBack() {
    router.push(`/projects/${route.params.projectid}/data-sources`);
}
function isValidFile(file) {
  const validExtensions = ['.xlsx', '.xls', '.csv']
  const validTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv'
  ]
  
  const hasValidExtension = validExtensions.some(ext => 
    file.name.toLowerCase().endsWith(ext)
  )
  const hasValidType = validTypes.includes(file.type)
  
  return hasValidExtension || hasValidType
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

async function handleFiles(files) {
    const token = getAuthToken();
    const rejectedFiles = [];
    
    for (const file of files) {
        if (isValidFile(file)) {
            try {
                // Store raw file object for upload
                const fileEntry = {
                    id: `file_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
                    name: file.name,
                    size: file.size,
                    sizeFormatted: formatFileSize(file.size),
                    type: file.type || 'application/octet-stream',
                    status: 'processing',
                    raw: file, // Store the raw File object
                    uploadedAt: new Date()
                };
                
                state.files.push(fileEntry);
                console.log(`Added file: ${file.name} (${fileEntry.sizeFormatted})`);
                
                // Upload to server for parsing
                const formData = new FormData();
                formData.append('file', file);
                
                const response = await $fetch(`${config.public.apiBase}/data-source/upload-excel-preview`, {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Authorization-Type': 'auth',
                    },
                    credentials: 'include'
                });
                
                // Response format: { sheets: [...], success: true, ... }
                if (response.success && response.sheets) {
                    // Create sheet objects from parsed data
                    for (const sheetData of response.sheets) {
                        // Map backend format to frontend format
                        const formattedSheet = {
                            name: sheetData.sheet_name || sheetData.name,
                            index: sheetData.sheet_index,
                            columns: sheetData.columns,
                            rows: sheetData.rows
                        };
                        
                        const sheet = createSheetFromWorksheet(
                            fileEntry,
                            formattedSheet,
                            formattedSheet.name,
                            formattedSheet.index
                        );
                        
                        // Analyze columns for type detection and width
                        sheet.columns = analyzeColumns(sheet.rows, sheet.columns);
                        
                        addSheetToCollection(sheet);
                    }
                    
                    // Update status on the reactive object in state.files, not the local variable
                    const stateFile = state.files.find(f => f.id === fileEntry.id);
                    if (stateFile) {
                        stateFile.status = 'completed';
                    }
                    console.log(`Parsed ${response.sheets.length} sheets from ${file.name}`);
                } else {
                    const stateFile = state.files.find(f => f.id === fileEntry.id);
                    if (stateFile) {
                        stateFile.status = 'error';
                    }
                    console.error('Failed to parse Excel file:', response.error || 'Unknown error');
                }
            } catch (error) {
                console.error('Error processing file:', file.name, error);
                const stateFile = state.files.find(f => f.name === file.name);
                if (stateFile) {
                    stateFile.status = 'error';
                }
                rejectedFiles.push(file.name);
            }
        } else {
            rejectedFiles.push(file.name);
        }
    }
    
    if (rejectedFiles.length > 0) {
        $swal.fire({
            icon: 'error',
            title: `Error!`,
            text: `The following files could not be processed: ${rejectedFiles.join(', ')}`,
        });
    }
}

// Type Detection Functions
function isBooleanType(values) {
    const boolPattern = /^(true|false|yes|no|y|n|1|0)$/i;
    const validCount = values.filter(v => 
        v === null || v === '' || boolPattern.test(String(v).trim())
    ).length;
    return validCount / values.length >= 0.8;
}

function isNumberType(values) {
    const validCount = values.filter(v => {
        if (v === null || v === '') return true;
        const num = Number(v);
        return !isNaN(num) && isFinite(num);
    }).length;
    return validCount / values.length >= 0.8;
}

function isDateType(values) {
    const validCount = values.filter(v => {
        if (v === null || v === '') return true;
        const date = new Date(v);
        return !isNaN(date.getTime());
    }).length;
    return validCount / values.length >= 0.8;
}

function isEmailType(values) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validCount = values.filter(v => 
        v === null || v === '' || emailPattern.test(String(v).trim())
    ).length;
    return validCount / values.length >= 0.8;
}

function isUrlType(values) {
    const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
    const validCount = values.filter(v => 
        v === null || v === '' || urlPattern.test(String(v).trim())
    ).length;
    return validCount / values.length >= 0.8;
}

function inferColumnType(columnValues) {
    const nonEmptyValues = columnValues.filter(v => v !== null && v !== '');
    
    if (nonEmptyValues.length === 0) return 'text';
    
    if (isBooleanType(nonEmptyValues)) return 'boolean';
    if (isNumberType(nonEmptyValues)) return 'number';
    if (isDateType(nonEmptyValues)) return 'date';
    if (isEmailType(nonEmptyValues)) return 'email';
    if (isUrlType(nonEmptyValues)) return 'url';
    
    return 'text';
}

function calculateColumnWidth(title, values, type) {
    const maxValueLength = Math.max(
        title.length,
        ...values.map(v => String(v || '').length)
    );
    
    // Base width on content
    let width = Math.min(Math.max(maxValueLength * 10, 100), 400);
    
    // Adjust by type
    if (type === 'date') width = Math.max(width, 150);
    if (type === 'email') width = Math.max(width, 200);
    if (type === 'url') width = Math.max(width, 250);
    
    return width;
}

function analyzeColumns(rows, existingColumns = []) {
    if (!rows || rows.length === 0) return existingColumns;
    
    const analyzedColumns = existingColumns.map(column => {
        // Extract values for this column
        const columnValues = rows.map(row => {
            const rowData = row.data || row;
            return rowData[column.key];
        });
        
        // Infer type if not already set
        const type = column.type || inferColumnType(columnValues);
        
        // Calculate width
        const width = calculateColumnWidth(column.title, columnValues, type);
        
        return {
            ...column,
            type,
            width,
            visible: true,
            sortable: true,
            editable: true
        };
    });
    
    return analyzedColumns;
}

// Sheet Editing Handlers
function handleCellUpdate(sheetId, rowIndex, columnKey, newValue) {
    const sheet = state.sheets.find(s => s.id === sheetId);
    if (!sheet || !sheet.rows[rowIndex]) return;
    
    sheet.rows[rowIndex].data[columnKey] = newValue;
    sheet.metadata.modified = new Date();
}

function handleRowsRemoved(sheetId, rowIndices) {
    const sheet = state.sheets.find(s => s.id === sheetId);
    if (!sheet) return;
    
    // Sort indices in descending order to remove from end first
    const sortedIndices = [...rowIndices].sort((a, b) => b - a);
    sortedIndices.forEach(index => {
        sheet.rows.splice(index, 1);
    });
    
    // Update row indices
    sheet.rows.forEach((row, index) => {
        row.index = index;
    });
    
    sheet.metadata.modified = new Date();
    sheet.metadata.rowCount = sheet.rows.length;
}

function handleColumnRemoved(sheetId, columnKey) {
    const sheet = state.sheets.find(s => s.id === sheetId);
    if (!sheet) return;
    
    // Remove column definition
    sheet.columns = sheet.columns.filter(col => col.key !== columnKey);
    
    // Remove data from all rows
    sheet.rows.forEach(row => {
        delete row.data[columnKey];
    });
    
    sheet.metadata.modified = new Date();
    sheet.metadata.columnCount = sheet.columns.length;
}

function handleRowAdded(sheetId, newRowData) {
    const sheet = state.sheets.find(s => s.id === sheetId);
    if (!sheet) return;
    
    const newRow = {
        id: `row_${Date.now()}_${Math.random()}`,
        index: sheet.rows.length,
        selected: false,
        data: newRowData || {}
    };
    
    sheet.rows.push(newRow);
    sheet.metadata.modified = new Date();
    sheet.metadata.rowCount = sheet.rows.length;
}

function handleColumnAdded(sheetId, columnDef) {
    const sheet = state.sheets.find(s => s.id === sheetId);
    if (!sheet) return;
    
    sheet.columns.push(columnDef);
    
    // Initialize column in all rows
    sheet.rows.forEach(row => {
        if (!row.data[columnDef.key]) {
            row.data[columnDef.key] = null;
        }
    });
    
    sheet.metadata.modified = new Date();
    sheet.metadata.columnCount = sheet.columns.length;
}

function handleColumnRenamed(sheetId, oldKey, newKey, newTitle) {
    const sheet = state.sheets.find(s => s.id === sheetId);
    if (!sheet) return;
    
    // Update column definition
    const column = sheet.columns.find(col => col.key === oldKey);
    if (column) {
        column.key = newKey;
        column.title = newTitle;
    }
    
    // Update data in all rows
    sheet.rows.forEach(row => {
        if (oldKey in row.data) {
            row.data[newKey] = row.data[oldKey];
            delete row.data[oldKey];
        }
    });
    
    sheet.metadata.modified = new Date();
}

function handleSheetChanged(event) {
    state.activeSheetId = event.newSheetId;
}

function handleSheetDeleted(event) {
    const sheetId = event.sheetId || event.id;
    const sheetIndex = state.sheets.findIndex(s => s.id === sheetId);
    if (sheetIndex === -1) return;
    
    state.sheets.splice(sheetIndex, 1);
    
    // Update active sheet if deleted
    if (state.activeSheetId === sheetId) {
        if (state.sheets.length > 0) {
            state.activeSheetId = state.sheets[0].id;
        } else {
            state.activeSheetId = null;
            state.show_table_dialog = false;
        }
    }
}

function handleSheetRenamed(event) {
    const sheetId = event.sheetId || event.id;
    const newName = event.newName || event.name;
    const sheet = state.sheets.find(s => s.id === sheetId);
    if (!sheet) return;
    
    sheet.name = newName;
    sheet.metadata.modified = new Date();
}

onMounted(async () => {
  const token = getAuthToken();
  const url = `${baseUrl()}/data-source/upload/file`;
  dropZone = document.getElementById('drop-zone');
  const fileElem = document.getElementById('file-elem');
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, preventDefaults, false);
  });
  dropZone.addEventListener('drop', handleDrop, false);
  fileElem.addEventListener('change', (e) => {
      handleFiles(e.target.files);
  });
  dropZone.addEventListener('click', () => {
      fileElem.click();
  });
});
</script>
<template>
    <div class="max-w-[900px] mx-auto py-10 px-5 sm:py-6 sm:px-4">
        <button @click="goBack" class="text-indigo-600 hover:text-indigo-800 mb-4 flex items-center cursor-pointer">
            <font-awesome-icon :icon="['fas', 'chevron-left']" class="w-5 h-5 mr-2" />
            Back
        </button>

        <div class="text-center mb-10">
            <h1 class="text-4xl font-bold text-gray-900 mb-2">Connect Excel / CSV Data Source</h1>
            <p class="text-base text-gray-600">Upload your Excel or CSV files to import and analyze data.</p>
        </div>

        <div class="flex flex-col justify-center">
            <div class="flex flex-row justify-center">
                <input type="text" class="w-3/4 border border-primary-blue-100 border-solid p-2 cursor-pointer margin-auto mt-10 rounded-lg" placeholder="Data Source Name" v-model="state.data_source_name"/>
            </div>
            <div class="flex flex-col justify-center w-3/4 min-h-100 bg-gray-200 m-auto mt-5 text-center cursor-pointer rounded-xl" id="drop-zone">
                <h3 class="text-lg font-semibold">Drop files here or click to upload</h3>
                <p class="text-sm text-gray-600">Supported formats: .xlsx, .xls, .csv</p>
                <input type="file" id="file-elem" multiple accept=".xlsx,.xls,.csv" class="hidden">
            </div>
            <div class="grid grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 md:gap-10 lg:grid-cols-4 xl:grid-cols-5 mx-auto mt-5">
                <div v-for="file in state.files" :key="file.id" class="w-full relative">
                    <notched-card class="justify-self-center mt-5">
                        <template #body="{ onClick }">
                            <NuxtLink class="text-gray-500">
                                <div class="flex flex-row justify-end">
                                    <font-awesome
                                      v-if="file.status === 'completed' && getSheetsByFileId(file.id).length > 0"
                                      icon="fas fa-table"
                                      class="text-xl ml-2 text-gray-500 hover:text-gray-400 cursor-pointer"
                                      @click="showTable(file.id)"
                                    />
                                    <font-awesome
                                      v-if="file.status === 'completed'"
                                      icon="fas fa-check"
                                      class="text-xl ml-2 text-green-500"
                                    />
                                    <font-awesome
                                      v-else-if="file.status === 'processing'"
                                      icon="fas fa-spinner"
                                      class="text-xl ml-2 text-blue-500 fa-spin"
                                    />
                                    <font-awesome
                                      v-else-if="file.status === 'error'"
                                      icon="fas fa-exclamation-circle"
                                      class="text-xl ml-2 text-red-500"
                                    />
                                    <font-awesome
                                      v-else
                                      icon="fas fa-clock"
                                      class="text-xl ml-2 text-gray-400"
                                    />
                                </div>
                                <div class="flex flex-col justify-center">
                                    <div class="text-md font-semibold">
                                      {{ file.name }}
                                    </div>
                                    <div class="mt-1 text-xs text-gray-600">
                                      {{ file.sizeFormatted }}
                                    </div>
                                    <div v-if="file.status === 'completed'" class="mt-1 text-xs text-green-600">
                                      Ready - {{ getSheetsByFileId(file.id).length }} sheet(s)
                                    </div>
                                    <div v-else-if="file.status === 'processing'" class="mt-1 text-xs text-blue-600">
                                      Processing...
                                    </div>
                                    <div v-else-if="file.status === 'error'" class="mt-1 text-xs text-red-600">
                                      Failed to process
                                    </div>
                                    <div v-else class="mt-1 text-xs text-gray-500">
                                      Pending
                                    </div>
                                </div>
                                <div class="flex flex-row justify-center items-center mt-5 mr-10">
                                    <font-awesome
                                        icon="fas fa-file-excel"
                                        class="text-5xl ml-2"
                                        :class="{
                                            'text-green-500': file.status === 'completed',
                                            'text-blue-500': file.status === 'processing',
                                            'text-red-500': file.status === 'error',
                                            'text-green-300': file.status === 'pending'
                                        }"
                                    />
                                </div>
                            </NuxtLink>
                        </template>
                    </notched-card>
                    <div v-if="file.status === 'pending' || file.status === 'error'" class="absolute top-px -right-2 z-10 bg-gray-200 hover:bg-gray-300 border border-gray-200 border-solid rounded-full w-10 h-10 flex items-center justify-center cursor-pointer" @click="removeFile(file.id)" v-tippy="{ content: 'Remove File', placement: 'top' }">
                        <font-awesome icon="fas fa-xmark" class="text-xl text-red-500 hover:text-red-400" />
                    </div>
                </div>
            </div>
            
            <!-- File processing status summary -->
            <div v-if="state.files && state.files.length" class="flex flex-col items-center mt-5">
                <div class="bg-white border border-gray-200 rounded-lg p-4 shadow-sm w-3/4 max-w-md">
                    <h4 class="text-sm font-semibold text-gray-700 mb-2">Processing Status</h4>
                    <div class="space-y-2">
                        <div class="flex justify-between text-sm">
                            <span class="text-gray-600">Total Files:</span>
                            <span class="font-medium">{{ state.files.length }}</span>
                        </div>
                        <div class="flex justify-between text-sm">
                            <span class="text-green-600">Completed:</span>
                            <span class="font-medium">{{ state.files.filter(f => f.status === 'completed').length }}</span>
                        </div>
                        <div class="flex justify-between text-sm" v-if="hasProcessingFiles">
                            <span class="text-blue-600">Processing:</span>
                            <span class="font-medium">{{ state.files.filter(f => f.status === 'processing').length }}</span>
                        </div>
                        <div class="flex justify-between text-sm" v-if="hasErrorFiles">
                            <span class="text-red-600">Failed:</span>
                            <span class="font-medium">{{ state.files.filter(f => f.status === 'error').length }}</span>
                        </div>
                    </div>
                    
                    <!-- Progress bar -->
                    <div class="mt-3">
                        <div class="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Progress</span>
                            <span>{{ state.files.length > 0 ? Math.round((state.files.filter(f => f.status === 'completed').length / state.files.length) * 100) : 0 }}%</span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2">
                            <div 
                                class="bg-green-500 h-2 rounded-full transition-all duration-300 ease-out"
                                :style="{ width: state.files.length > 0 ? (state.files.filter(f => f.status === 'completed').length / state.files.length) * 100 + '%' : '0%' }"
                            ></div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Show table section inline (not in dialog) -->
            <div v-if="state.files && state.files.length" class="flex flex-row w-full justify-center mt-10">
                <div v-if="state.sheets && state.sheets.length && state.show_table_dialog" class="flex flex-col w-full justify-center overflow-hidden mb-10 px-4">
                    <h2 class="mb-4 text-xl font-bold text-gray-800">Data From The Excel File(s)/Sheets</h2>
                    <div class="text-sm text-gray-600 mb-4">
                        Showing {{ state.sheets.length }} sheet{{ state.sheets.length !== 1 ? 's' : '' }} from {{ state.files.filter(f => f.status === 'completed').length }} Excel file{{ state.files.filter(f => f.status === 'completed').length !== 1 ? 's' : '' }}
                    </div>
                    <custom-data-table
                        :columns="[]"
                        :sheets="state.sheets"
                        :activeSheetId="state.activeSheetId"
                        :allowMultipleSheets="true"
                        :maxSheets="50"
                        :editable="true"
                        @cell-updated="handleCellUpdate"
                        @rows-removed="handleRowsRemoved"
                        @column-removed="handleColumnRemoved"
                        @column-renamed="handleColumnRenamed"
                        @row-added="handleRowAdded"
                        @column-added="handleColumnAdded"
                        @sheet-changed="handleSheetChanged"
                        @sheet-deleted="handleSheetDeleted"
                        @sheet-renamed="handleSheetRenamed"
                    />
                </div>
            </div>
            
            <spinner v-if="state.loading"/>
            <div v-else-if="!state.loading && state.files && state.files.length" 
                 class="h-10 text-center items-center self-center mt-5 mb-5 p-2 font-bold shadow-md select-none rounded-lg"
                 :class="{
                     'bg-primary-blue-100 hover:bg-primary-blue-200 cursor-pointer text-white': !buttonDisabled,
                     'bg-gray-300 cursor-not-allowed text-gray-500': buttonDisabled
                 }"
                 @click="handleCreateClick">
                Create Data Source
            </div>
        </div>
    </div>

    <data-source-classification-modal
        v-if="state.showClassificationModal"
        v-model="state.showClassificationModal"
        :loading="state.loading"
        confirm-label="Create Data Source"
        @confirm="(c) => { state.selectedClassification = c; createDataSource(c); }"
        @cancel="state.showClassificationModal = false"
    />
</template>