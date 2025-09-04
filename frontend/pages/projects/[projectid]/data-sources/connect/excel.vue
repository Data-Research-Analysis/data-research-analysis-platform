<script setup>
import { data } from 'happy-dom/lib/PropertySymbol.js';
import * as XLSX from 'xlsx';
const { $swal } = useNuxtApp();
const route = useRoute();
const router = useRouter();

let dropZone = null;
const state = reactive({
    data_source_name: '',
    files: [],
    show_table_dialog: false,
    columns: [],
    rows: [],
    selected_file: null,
    loading: false,
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
function showTable(fileId) {
    nextTick(() => {
        state.show_table_dialog = false;
        setTimeout(() => {
            state.rows = [];
            state.columns = [];
            const file = state.files.find((file) => file.id === fileId);
            state.selected_file = file;
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
async function createDataSource() {
  
  console.log('createDataSource state.files', state.files);
  // const results = await Promise.allSettled()
    const token = getAuthToken();
    if (!state.data_source_name || state.data_source_name.trim() === '') {
        $swal.fire({
            icon: 'error',
            title: `Error!`,
            text: `Please provide a name for the data source.`,
        });
        return;
    }
    state.loading = true;
    const url = `${baseUrl()}/data-source/add-excel-data-source`;
    let dataSourceId = null;
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    for (const file of state.files) {
      const columns = file.columns;
      const rows = file.rows;
      const fileId = file.id;
      file.status = 'processing';
      console.log('dataSourceId', dataSourceId);
      const response = await fetch(url, {
          method: "POST",
          headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`,
              "Authorization-Type": "auth",
          },
          body: JSON.stringify({
              file_id: fileId,
              data: {
                columns: columns.map((column) => {
                  return {
                    title: column.title,
                    key: column.key,
                    column_name: column.key.substring(0, 20).replace(/\s/g,'_').toLowerCase(),
                    type: column.type,
                  };
                }),
                rows,
                file_name: file.name.replace(/\.(xlsx|xls|csv)$/, "").substring(0, 20).replace(/\s/g,'_').toLowerCase(),
              },
              file_name: file.name.replace(/\.(xlsx|xls|csv)$/, "").substring(0, 20).replace(/\s/g,'_').toLowerCase(),
              data_source_name: state.data_source_name,
              project_id: route.params.projectid,
              data_source_id: dataSourceId ? dataSourceId : null,
          })
      });
      console.log('response', response);
      if (response.status === 200) {
        const data = await response.json();
        console.log('data', data);
        dataSourceId = data.result.data_source_id;
        file.status = 'uploaded';
      } else {
        file.status = 'failed';
      }
      await sleep(1000);

    }
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
  console.log('inferColumnType values', values);
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
    console.log('analyzeColumn type', type);
    const width = calculateColumnWidth(key, columnValues, type)
    
    return {
      id: `col_${Date.now()}_${Math.random()}`,
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
          rows: rows.map((row) => {
              return {
                id: `row_${Date.now()}_${Math.random()}`,
                ...row,
              };
          }),
          status: 'pending',//uploaded, processing, failed
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
    const row = state.selected_file.rows.find((row) => {
      if (row.id === event.row.id) {
        return row
      }
    });
    row[event.columnKey] = event.newValue;
}
function handleRowsRemoved(event) {
  if (event.allRemoved) {
    state.selected_file.rows = []
  } else {
    state.selected_file.rows = state.selected_file.rows.filter(row => event.removedRows.filter((removedRow) => removedRow.id  === row.id).length === 0);
    state.selected_file.num_rows = state.selected_file.rows.length;
  }
}
function handleColumnRemoved(event) {
  const columnNames = event.removedColumns.map(col => col.title).join(', ');
  state.selected_file.columns = state.selected_file.columns.filter(col => {
    return event.removedColumns.filter((removedCol) => removedCol.id === col.id).length === 0
  });
  state.selected_file.num_columns = state.selected_file.columns.length;
  state.selected_file.rows.forEach((row) => {
    event.removedColumns.forEach((col) => {
      delete row[col.key];
    });
  });
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
                <input type="text" class="w-3/4 border border-primary-blue-100 border-solid p-2 cursor-pointer margin-auto mt-10" placeholder="Data Source Name" v-model="state.data_source_name"/>
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
                                      @click="showTable(file.id)"
                                    />
                                    <font-awesome
                                      v-if="file.status === 'uploaded'"
                                      icon="fas fa-check"
                                      class="text-xl ml-2 text-green-300"
                                    />
                                    <font-awesome
                                      v-else-if="file.status === 'processing'"
                                      icon="fas fa-hourglass-half"
                                      class="text-xl ml-2 text-gray-500"
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
                    <div v-if="file.status === 'pending'" class="absolute top-px -right-2 z-10 bg-gray-200 hover:bg-gray-300 border border-gray-200 border-solid rounded-full w-10 h-10 flex items-center justify-center cursor-pointer" @click="removeFile(file.id)" v-tippy="{ content: 'Remove File', placement: 'top' }">
                        <font-awesome icon="fas fa-xmark" class="text-xl text-red-500 hover:text-red-400" />
                    </div>
                </div>
            </div>            
            <div v-if="state.files && state.files.length" class="flex flex-row w-full justify-center mt-10">
                <div v-if="state.columns && state.columns.length && state.show_table_dialog" class="flex flex-col w-3/4 justify-center overflow-hidden mb-10">
                    <h2 class="mb-4 text-xl font-bold text-gray-800">Data From The Selected Excel File</h2>
                    <custom-data-table
                        :initial-data="state.rows"
                        :columns="state.columns"
                        :editable="true"
                        @cell-updated="handleCellUpdate"
                        @rows-removed="handleRowsRemoved"
                        @column-removed="handleColumnRemoved"
                        ref="dataTable"
                    />
                </div>
            </div>
            <spinner v-if="state.loading"/>
            <div v-else-if="!state.loading && state.files && state.files.length" class="h-10 text-center items-center self-center mt-5 mb-5 p-2 font-bold shadow-md select-none bg-primary-blue-100 hover:bg-primary-blue-200 cursor-pointer text-white" @click="createDataSource">
                Create Excel Data Source &amp; Upload Excel Files
            </div>

        </div>
    </div>
</template>