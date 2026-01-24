<script setup>
import * as XLSX from 'xlsx';
const { $swal } = useNuxtApp();
const route = useRoute();
const router = useRouter();

let dropZone = null;
const state = reactive({
    data_source_name: '',
    files: [],
    show_table_dialog: false,
    sheets: [], // New: unified collection of all sheets from all Excel files
    activeSheetId: null,
    selected_file: null,
    loading: false,
});

// Sheet Management Functions
function createSheetFromWorksheet(file, worksheetData, sheetName, sheetIndex) {
    const displaySheetName = `${sheetName} - ${file.name}`;
    const sheetId = `${file.id}_sheet_${sheetIndex}`;
    
    const sheet = {
        id: sheetId,
        name: displaySheetName,
        fileName: file.name,
        fileId: file.id,
        sheetName: sheetName,
        sheetIndex: sheetIndex,
        columns: worksheetData.columns || [],
        rows: worksheetData.rows || [],
        metadata: {
            created: new Date(),
            modified: new Date(),
            rowCount: worksheetData.rows?.length || 0,
            columnCount: worksheetData.columns?.length || 0,
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
                
                if (fileSheets.length > 0) {
                    // Set the first sheet of this file as active if no active sheet or if active sheet is from different file
                    const currentActiveSheet = state.sheets.find(s => s.id === state.activeSheetId);
                    if (!currentActiveSheet || currentActiveSheet.fileId !== fileId) {
                        state.activeSheetId = fileSheets[0].id;
                        console.log(`Set active sheet to: ${fileSheets[0].name}`);
                    }
                } else {
                    console.log('No sheets found for file:', file.name);
                    console.log('This might indicate the file had no data or failed to process');
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
async function createDataSource() {
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
        
        file.status = 'processing';
        
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
// Type detection helper functions
function isBooleanType(values) {
  const booleanPatterns = /^(true|false|yes|no|y|n|1|0|on|off|active|inactive|enabled|disabled)$/i
  const nonEmptyValues = values.filter(v => v !== null && v !== undefined && v !== '')
  if (nonEmptyValues.length === 0) return false
  
  return nonEmptyValues.every(value => 
    booleanPatterns.test(String(value).trim())
  )
}
function isNumberType(values) {
  const numberPattern = /^-?\$?[\d,]+\.?\d*%?$/
  const nonEmptyValues = values.filter(v => v !== null && v !== undefined && v !== '')
  if (nonEmptyValues.length === 0) return false
  
  return nonEmptyValues.every(value => {
    const str = String(value).trim().replace(/[$,%]/g, '')
    return !isNaN(str) && !isNaN(parseFloat(str)) && str !== ''
  })
}
function isDateType(values) {
  const nonEmptyValues = values.filter(v => v !== null && v !== undefined && v !== '')
  if (nonEmptyValues.length === 0) return false
  
  return nonEmptyValues.every(value => {
    const str = String(value).trim()
    if (!str) return false
    
    // Try parsing as date
    const date = new Date(str)
    if (isNaN(date.getTime())) return false
    
    // Check for common date patterns
    const datePatterns = [
      /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
      /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY or DD/MM/YYYY
      /^\d{2}-\d{2}-\d{4}$/, // MM-DD-YYYY or DD-MM-YYYY
      /^\w{3}\s+\d{1,2},?\s+\d{4}$/, // Mon DD, YYYY
      /^\d{1,2}\/\d{1,2}\/\d{2,4}$/, // M/D/YY or MM/DD/YYYY
      /^[A-Z][a-z]{2} [A-Z][a-z]{2} \d{2} \d{4} \d{2}:\d{2}:\d{2} GMT[+-]\d{4}( \(.+\))?$/ // JS Date string
    ]
    
    return datePatterns.some(pattern => pattern.test(str))
  })
}
function isEmailType(values) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const nonEmptyValues = values.filter(v => v !== null && v !== undefined && v !== '')
  if (nonEmptyValues.length === 0) return false
  
  return nonEmptyValues.every(value => 
    emailPattern.test(String(value).trim())
  )
}
function isUrlType(values) {
  const urlPattern = /^https?:\/\/.+\..+/
  const nonEmptyValues = values.filter(v => v !== null && v !== undefined && v !== '')
  if (nonEmptyValues.length === 0) return false
  
  return nonEmptyValues.every(value => 
    urlPattern.test(String(value).trim())
  )
}
function inferColumnType(values) {
  // Priority order: boolean > number > date > email > url > text
  if (isBooleanType(values)) return 'boolean'
  if (isNumberType(values)) return 'number'
  if (isDateType(values)) return 'date'
  if (isEmailType(values)) return 'email'
  if (isUrlType(values)) return 'url'
  return 'text'
}
function calculateColumnWidth(columnName, values, type) {
  // Calculate header width (8px per character + padding)
  const headerWidth = columnName.length * 8 + 24
  
  // Calculate max content width (6px per character + padding)
  const nonEmptyValues = values.filter(v => v !== null && v !== undefined && v !== '')
  const maxContentLength = nonEmptyValues.length > 0 
    ? Math.max(...nonEmptyValues.map(v => String(v).length))
    : 0
  const contentWidth = maxContentLength * 6 + 24
  
  // Type-specific minimum widths
  const typeMinWidths = {
    boolean: 80,
    number: 100,
    date: 120,
    email: 200,
    url: 200,
    text: 100
  }
  
  const minWidth = typeMinWidths[type] || 100
  const calculatedWidth = Math.max(headerWidth, contentWidth, minWidth)
  
  // Cap maximum width at 300px for readability
  return Math.min(calculatedWidth, 300)
}
function analyzeColumns(rows) {
  if (!rows || rows.length === 0) return []
  
  const columnKeys = Object.keys(rows[0])
  
  return columnKeys.map(key => {
    // Extract all values for this column
    const columnValues = rows.map(row => row[key])
    
    // Infer type and calculate width
    const type = inferColumnType(columnValues)
    const width = calculateColumnWidth(key, columnValues, type)
    
    return {
      id: `col_${Date.now()}_${Math.floor(Math.random() * 100) + 1}`,
      key,
      title: key,
      type,
      width,
      sortable: true,
      editable: true,
      visible: true
    }
  })
}
async function parseFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        let rows = []
        let workbook = null
        
        if (file.name.toLowerCase().endsWith('.csv')) {
          // Parse CSV
          const text = e.target.result
          const lines = text.split('\n').filter(line => line.trim())
          const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
          
          rows = lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim().replace(/"/g, ''))
            const obj = {}
            headers.forEach((header, index) => {
                obj[header] = values[index] || ''
            })
            return obj
          })
        } else {
            // Parse Excel - extract all worksheets
            const data = new Uint8Array(e.target.result)
            workbook = XLSX.read(data, { type: 'array', cellDates: true })
        }
        
        // Handle different file types for worksheet extraction
        let worksheets = [];
        
        if (file.name.toLowerCase().endsWith('.csv')) {
            // For CSV, create a single worksheet entry
            const analyzedColumns = analyzeColumns(rows);
            const worksheetData = {
                sheetName: 'Sheet1',
                rows: rows.map((row, index) => ({
                    id: `row_${Date.now()}_${Math.floor(Math.random() * 100) + 1}`,
                    index: index,
                    selected: false,
                    data: row
                })),
                columns: analyzedColumns,
                num_rows: rows.length,
                num_columns: analyzedColumns.length
            };
            worksheets.push(worksheetData);
        } else {
            // For Excel files, extract all worksheets
            workbook.SheetNames.forEach((sheetName, index) => {
                const worksheet = workbook.Sheets[sheetName];
                const sheetRows = XLSX.utils.sheet_to_json(worksheet);
                
                if (sheetRows.length > 0) {
                    const analyzedColumns = analyzeColumns(sheetRows);
                    const worksheetData = {
                        sheetName: sheetName,
                        rows: sheetRows.map((row, rowIndex) => ({
                            id: `row_${Date.now()}_${Math.floor(Math.random() * 100) + 1}_${index}`,
                            index: rowIndex,
                            selected: false,
                            data: row
                        })),
                        columns: analyzedColumns,
                        num_rows: sheetRows.length,
                        num_columns: analyzedColumns.length
                    };
                    worksheets.push(worksheetData);
                }
            });
        }
        
        // Calculate total statistics
        const totalRows = worksheets.reduce((sum, ws) => sum + ws.num_rows, 0);
        const maxColumns = worksheets.reduce((max, ws) => Math.max(max, ws.num_columns), 0);
        
        const fileData = {
            id: `file_${Date.now()}_${Math.floor(Math.random() * 100) + 1}`,
            name: file.name,
            size: file.size,
            type: file.type || 'application/octet-stream',
            num_rows: totalRows,
            num_columns: maxColumns,
            status: 'pending',
            workbook,
            worksheets: worksheets,
            uploadedAt: new Date()
        };
        
        resolve(fileData)
      } catch (error) {
        reject(error)
      }
    }
    
    reader.onerror = () => reject(new Error('Failed to read file'))
    
    if (file.name.toLowerCase().endsWith('.csv')) {
      reader.readAsText(file)
    } else {
      reader.readAsArrayBuffer(file)
    }
  })
}
async function handleFiles(files) {
    const rejectedFiles = [];
    for (const file of files) {
        if (isValidFile(file)) {
            try {
                const parsedFile = await parseFile(file);
                state.files.push(parsedFile);
                
                // Immediately create sheets from worksheets
                if (parsedFile.worksheets && parsedFile.worksheets.length > 0) {
                    let sheetsCreated = 0;
                    parsedFile.worksheets.forEach((worksheetData, index) => {
                        if (worksheetData.rows && worksheetData.rows.length > 0) {
                            const sheet = createSheetFromWorksheet(parsedFile, worksheetData, worksheetData.sheetName, index);
                            addSheetToCollection(sheet);
                            sheetsCreated++;
                            console.log(`Created sheet: ${sheet.name} with ${worksheetData.rows.length} rows`);
                        } else {
                            console.log(`Skipping empty worksheet: ${worksheetData.sheetName}`);
                        }
                    });
                    
                    // Update file status to indicate sheets are ready
                    parsedFile.status = 'loaded';
                    console.log(`File ${parsedFile.name} processed with ${sheetsCreated} sheets created`);
                } else {
                    console.log('No worksheets found in file:', parsedFile.name);
                    parsedFile.status = 'empty';
                }
            } catch (error) {
                console.error('Error processing file:', file.name, error);
                rejectedFiles.push(`${file.name}`)
            }
        } else {
            rejectedFiles.push(`${file.name}`)
        }
    }
    if (rejectedFiles.length > 0) {
        $swal.fire({
            icon: 'error',
            title: `Error!`,
            text: `The following files could not be processed: ${rejectedFiles.join(', ')} as either there is an error in them or are not a valid excel file.`,
        });
    }
}
// Sheet Event Handlers
function handleCellUpdate(event) {
    const activeSheet = state.sheets.find(sheet => sheet.id === state.activeSheetId);
    if (activeSheet) {
        // Find row by event.rowId (correct property from custom-data-table)
        const row = activeSheet.rows.find(row => row.id === event.rowId);
        if (row) {
            if (row.data) {
                row.data[event.columnKey] = event.newValue;
            } else {
                row[event.columnKey] = event.newValue;
            }
            activeSheet.metadata.modified = new Date();
        }
    }
}

function handleRowsRemoved(event) {
    const activeSheet = state.sheets.find(sheet => sheet.id === state.activeSheetId);
    if (activeSheet) {
        if (event.allRemoved) {
            activeSheet.rows = [];
        } else {
            activeSheet.rows = activeSheet.rows.filter(row => 
                !event.removedRows.some(removedRow => removedRow.id === row.id)
            );
        }
        activeSheet.metadata.rowCount = activeSheet.rows.length;
        activeSheet.metadata.modified = new Date();
    }
}

function handleColumnRemoved(event) {
    const activeSheet = state.sheets.find(sheet => sheet.id === state.activeSheetId);
    if (activeSheet) {
        activeSheet.columns = activeSheet.columns.filter(col => col.key !== event.columnKey);
        activeSheet.metadata.columnCount = activeSheet.columns.length;
        activeSheet.metadata.modified = new Date();
    }
}

function handleRowAdded(event) {
    const activeSheet = state.sheets.find(sheet => sheet.id === state.activeSheetId);
    if (activeSheet) {
        // Update sheet row collection with all rows from the table
        activeSheet.rows = [...event.allRows];
        // Update sheet metadata
        activeSheet.metadata.rowCount = event.rowCount;
        activeSheet.metadata.modified = new Date();
    }
}

function handleColumnAdded(event) {
    const activeSheet = state.sheets.find(sheet => sheet.id === state.activeSheetId);
    if (activeSheet) {        
        // Update sheet column collection with all columns from the table
        activeSheet.columns = [...event.allColumns];        
        // Update sheet metadata
        activeSheet.metadata.columnCount = event.columnCount;
        activeSheet.metadata.modified = new Date();
    }
}

function handleColumnRenamed(event) {
    const activeSheet = state.sheets.find(sheet => sheet.id === state.activeSheetId);
    if (activeSheet) {
        const column = activeSheet.columns.find(col => col.id === event.columnId);
        if (column) {
            // Update column title and metadata
            column.title = event.newName;
            column.originalTitle = column.originalTitle || event.oldName;
            
            // Update key if needed (for backend consistency)
            if (!column.originalKey) {
                column.originalKey = column.key;
            }    
            // Keep same key or update based on new name
            // The key is used for database column mapping, so we preserve it
            // unless this is a brand new column
            activeSheet.metadata.modified = new Date();
        }
    }
}

function handleSheetChanged(event) {
    state.activeSheetId = event.newSheetId;
}

function handleSheetCreated(event) {
    // Optionally handle custom sheet creation logic
}

function handleSheetDeleted(event) {
    // Remove from our sheets collection if it exists
    const sheetIndex = state.sheets.findIndex(s => s.id === event.id);
    if (sheetIndex !== -1) {
        state.sheets.splice(sheetIndex, 1);
    }
}

function handleSheetRenamed(event) {
    const sheet = state.sheets.find(s => s.id === event.sheetId);
    if (sheet) {
        sheet.name = event.newName;
        sheet.metadata.modified = new Date();
    }
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
    <div>
        <div class="flex flex-col justify-center">
            <div class="flex flex-row justify-center">
                <input type="text" class="w-3/4 border border-primary-blue-100 border-solid p-2 cursor-pointer margin-auto mt-10 rounded-lg" placeholder="Data Source Name" v-model="state.data_source_name"/>
            </div>
            <div class="flex flex-col justify-center w-3/4 min-h-100 bg-gray-200 m-auto mt-5 text-center cursor-pointer rounded-xl" id="drop-zone">
                <h3 class="text-lg font-semibold">Drop files here or click to upload</h3>
                <p class="text-sm text-gray-600">Supported formats: .xlsx, .xls, .csv</p>
                <input type="file" id="file-elem" multiple class="hidden">
            </div>
            <div class="grid grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 md:gap-10 lg:grid-cols-4 xl:grid-cols-5 mx-auto mt-5">
                <div v-for="file in state.files" class="w-full relative">
                    <notched-card  class="justify-self-center mt-5">
                        <template #body="{ onClick }">
                            <NuxtLink class="text-gray-500">
                                <div class="flex flex-row justify-end">
                                    <font-awesome
                                      v-if="file.status === 'loaded' && getSheetsByFileId(file.id).length > 0"
                                      icon="fas fa-table"
                                      class="text-xl ml-2 text-gray-500 hover:text-gray-400 cursor-pointer"
                                      :v-tippy-content="'View Data In Table'"
                                      @click="showTable(file.id)"
                                    />
                                    <font-awesome
                                      v-if="file.status === 'uploaded'"
                                      icon="fas fa-check"
                                      class="text-xl ml-2 text-green-300"
                                    />
                                    <font-awesome
                                      v-else-if="file.status === 'loaded'"
                                      icon="fas fa-check-circle"
                                      class="text-xl ml-2 text-blue-500"
                                    />
                                    <font-awesome
                                      v-else-if="file.status === 'processing'"
                                      icon="fas fa-hourglass-half"
                                      class="text-xl ml-2 text-gray-500"
                                    />
                                    <font-awesome
                                      v-else-if="file.status === 'empty'"
                                      icon="fas fa-exclamation-triangle"
                                      class="text-xl ml-2 text-yellow-500"
                                    />
                                    <font-awesome
                                      v-else-if="file.status === 'failed'"
                                      icon="fas fa-exclamation"
                                      class="text-xl ml-2 text-red-500"
                                    />
                                </div>
                                <div class="flex flex-col justify-center">
                                    <div class="text-md">
                                      {{ file.name }}
                                    </div>
                                    <div v-if="file.status === 'loaded'" class="mt-1 text-xs text-blue-600">
                                      {{ getSheetsByFileId(file.id).length }} sheet{{ getSheetsByFileId(file.id).length !== 1 ? 's' : '' }} ready
                                    </div>
                                    <div v-else-if="file.status === 'empty'" class="mt-1 text-xs text-yellow-600">
                                      No data found
                                    </div>
                                </div>
                                <div class="flex flex-row justify-center items-center mt-5 mr-10">
                                    <font-awesome
                                        icon="fas fa-file-excel"
                                        class="text-5xl ml-2 text-green-300"
                                    />
                                </div>
                            </NuxtLink>
                        </template>
                    </notched-card>
                    <div v-if="file.status === 'pending' || file.status === 'loaded' || file.status === 'empty' || file.status === 'failed'" class="absolute top-px -right-2 z-10 bg-gray-200 hover:bg-gray-300 border border-gray-200 border-solid rounded-full w-10 h-10 flex items-center justify-center cursor-pointer" @click="removeFile(file.id)" v-tippy="{ content: 'Remove File', placement: 'top' }">
                        <font-awesome icon="fas fa-xmark" class="text-xl text-red-500 hover:text-red-400" />
                    </div>
                </div>
            </div>            
            <div v-if="state.files && state.files.length" class="flex flex-row w-full justify-center mt-10">
                <div v-if="state.sheets && state.sheets.length && state.show_table_dialog" class="flex flex-col w-3/4 justify-center overflow-hidden mb-10">
                    <h2 class="mb-4 text-xl font-bold text-gray-800">Data From The Excel File(s)/Sheets</h2>
                    <custom-data-table
                        :sheets="state.sheets"
                        :active-sheet-id="state.activeSheetId"
                        :editable="true"
                        :multi-sheet="true"
                        @cell-updated="handleCellUpdate"
                        @rows-removed="handleRowsRemoved"
                        @column-removed="handleColumnRemoved"
                        @column-renamed="handleColumnRenamed"
                        @row-added="handleRowAdded"
                        @column-added="handleColumnAdded"
                        @sheet-changed="handleSheetChanged"
                        @sheet-created="handleSheetCreated"
                        @sheet-deleted="handleSheetDeleted"
                        @sheet-renamed="handleSheetRenamed"
                        ref="dataTable"
                    />
                </div>
            </div>
            <spinner v-if="state.loading"/>
            <div v-else-if="!state.loading && state.files && state.files.length" class="h-10 text-center items-center self-center mt-5 mb-5 p-2 font-bold shadow-md select-none bg-primary-blue-100 hover:bg-primary-blue-200 cursor-pointer text-white rounded-lg" @click="createDataSource">
                Create Excel Data Source &amp; Upload Excel Files
            </div>

        </div>
    </div>
</template>