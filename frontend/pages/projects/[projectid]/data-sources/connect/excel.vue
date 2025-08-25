<script setup>
import * as XLSX from 'xlsx';
const { $swal } = useNuxtApp();

let dropZone = null;
const state = reactive({
    files: [],
    show_table_dialog: false,
    columns: [],
    rows: [],
});

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
function openTableDialog(fileId) {
    nextTick(() => {
        state.show_table_dialog = false;
        setTimeout(() => {
            state.rows = [];
            state.columns = [];
            const file = state.files.find((file) => file.id === fileId);
            if (file && file.id) {
                if (file.rows) {
                    state.columns = file.columns;
                    state.rows = file.rows;
                }
            }
            state.show_table_dialog = true;
            console.log('file', file);
        }, 500);
        console.log('state.columns', state.columns);
        console.log('state.rows', state.rows);
    });
}
function removeFile(fileId) {
    state.files = state.files.filter((file) => file.id !== fileId);
}
function createDataSource() {
    console.log('createDataSource state.files', state.files);
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
      /^\d{1,2}\/\d{1,2}\/\d{2,4}$/ // M/D/YY or MM/DD/YYYY
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
            // Parse Excel
            const data = new Uint8Array(e.target.result)
            workbook = XLSX.read(data, { type: 'array', cellDates: true })
            const firstSheetName = workbook.SheetNames[0]
            const worksheet = workbook.Sheets[firstSheetName]
            rows = XLSX.utils.sheet_to_json(worksheet)
        }
        
        // Analyze columns for type and width after parsing data
        const analyzedColumns = analyzeColumns(rows)
        
        const fileData = {
          id: `file_${Date.now()}_${Math.random()}`,
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          num_rows: rows.length,
          num_columns: rows.length > 0 ? Object.keys(rows[0]).length : 0,
          columns: analyzedColumns,
          rows,
          workbook,
          uploadedAt: new Date()
        }
        
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
                console.log('parsed parsedFile', parsedFile);
                state.files.push(parsedFile);
            } catch (error) {
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
    console.log('state.files', state.files);
}
function handleCellUpdate(event) {
    console.log('Cell Updated event', event);
    console.log('Cell Updated', `${event.columnKey}: "${event.oldValue}" → "${event.newValue}" for row ${event.rowId}`);
}
function handleRowSelection(event) {
    if (event.allSelected !== undefined) {
        console.log('Row Selection', event.allSelected ? 'All rows selected' : 'All rows deselected');
    } else {
        console.log('Row Selection', `Row ${event.rowId} ${event.selected ? 'selected' : 'deselected'}. Total: ${event.selectedCount}`);
    }
}
function handleRowsRemoved(event) {
    if (event.allRemoved) {
        console.log('Rows Removed', `All ${event.removedRows.length} rows removed`);
    } else {
        console.log('Rows Removed', `${event.removedRows.length} rows removed. ${event.remainingCount} remaining`);
    }
}
function handleColumnRemoved(event) {
    const columnNames = event.removedColumns.map(col => col.title).join(', ');
    console.log('Column Removed', `Removed columns: ${columnNames}. ${event.remainingColumns.length} remaining`);
}
function handleDataChanged(event) {
    console.log('Data Changed', `Type: ${event.type}. Total rows: ${event.data.length}`);
    console.log('handleDataChanged event', event);
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
    })
});
</script>
<template>
    <div>
        <div class="flex flex-col justify-center">
            <div class="flex flex-row justify-center">
                <input type="text" class="w-3/4 border border-primary-blue-100 border-solid p-2 cursor-pointer margin-auto mt-10" placeholder="Data Source Name"/>
            </div>
            <div class="flex flex-col justify-center w-3/4 min-h-100 bg-gray-200 m-auto mt-5 text-center cursor-pointer" id="drop-zone">
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
                                        icon="fas fa-table"
                                        class="text-xl ml-2 text-gray-500 hover:text-gray-400 cursor-pointer"
                                        :v-tippy-content="'View Data In Table'"
                                        @click="openTableDialog(file.id)"
                                    />
                                </div>
                                <div class="flex flex-col justify-center">
                                    <div class="text-md">
                                        {{ file.name }}
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
                    <div class="absolute top-px -right-2 z-10 bg-gray-200 hover:bg-gray-300 border border-gray-200 border-solid rounded-full w-10 h-10 flex items-center justify-center cursor-pointer" @click="removeFile(file.id)" v-tippy="{ content: 'Remove File', placement: 'top' }">
                        <font-awesome icon="fas fa-xmark" class="text-xl text-red-500 hover:text-red-400" />
                    </div>
                </div>
            </div>            
            <div v-if="state.files && state.files.length" class="flex flex-row w-full justify-center mt-10">
                <div v-if="state.columns && state.columns.length && state.show_table_dialog" class="flex flex-col w-3/4 justify-center overflow-hidden mb-10">
                    <h2 class="mb-4 text-xl font-bold text-gray-800">Data From The Selected Excel File</h2>
                    <CustomDataTable
                        :initial-data="state.rows"
                        :columns="state.columns"
                        :editable="true"
                        @cell-updated="handleCellUpdate"
                        @row-selected="handleRowSelection"
                        @rows-removed="handleRowsRemoved"
                        @column-removed="handleColumnRemoved"
                        @data-changed="handleDataChanged"
                        ref="dataTable"
                    />
                </div>
            </div>
            <div v-if="state.files && state.files.length" class="h-10 text-center items-center self-center mt-5 mb-5 p-2 font-bold shadow-md select-none bg-primary-blue-100 hover:bg-primary-blue-200 cursor-pointer text-white" @click="createDataSource">
                Create Excel Data Source &amp; Upload Excel Files
            </div>
        </div>
    </div>
</template>