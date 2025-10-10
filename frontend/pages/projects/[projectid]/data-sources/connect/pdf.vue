<script setup>
import _ from 'lodash';
import { ISocketEvent } from '~/types/ISocketEvent';
const loggedInUserStore = useLoggedInUserStore();
const { $swal, $socketio } = useNuxtApp();
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
    upload_id: 0,
});
const user = computed(() => loggedInUserStore.getLoggedInUser());
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
        }, 500);
    });
}
function removeFile(fileId) {
    state.files = state.files.filter((file) => file.id !== fileId);
}
async function createDataSource() {
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
                file_name: (file.name || file.displayName).replace(/\.(pdf)$/, "").substring(0, 20).replace(/\s/g,'_').toLowerCase(),
              },
              file_name: (file.name || file.displayName).replace(/\.(pdf)$/, "").substring(0, 20).replace(/\s/g,'_').toLowerCase(),
              data_source_name: state.data_source_name,
              project_id: route.params.projectid,
              data_source_id: dataSourceId ? dataSourceId : null,
          })
      });
      if (response.status === 200) {
        const data = await response.json();
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
  const validExtensions = ['.pdf']
  const validTypes = [
    'application/pdf'
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
async function uploadPDFToServer(fileData) {
  const formData = new FormData();
  formData.append('file', fileData.processedFile);
  const token = getAuthToken();
  
  try {
    const response = await fetch(`${baseUrl()}/data-source/upload/pdf`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Authorization-Type': 'auth'
      },
      body: formData
    });
    if (!response.ok) {
      if (fileIndex !== -1) {
        state.files[fileIndex].status = 'error';
      }
      throw new Error(`Upload failed with status ${response.status}`);
    }    
  } catch (error) {
    if (fileIndex !== -1) {
      state.files[fileIndex].status = 'error';
    }
    throw new Error(error.message || 'Network error during upload');
  }
}

async function parseFile(fileData) {
  return new Promise(async (resolve, reject) => {
    try {
      // For PDF files, upload to server and get processed data
      if (fileData.originalName.toLowerCase().endsWith('.pdf')) {
        // Create a new File object with the generated name
        const renamedFile = new File([fileData.originalFile], fileData.name, { 
          type: fileData.originalFile.type 
        });
        fileData.processedFile = renamedFile;
        await uploadPDFToServer(fileData);
        resolve();
      } else {
        // Fallback for other file types (though we should only accept PDFs)
        reject(new Error('Only PDF files are supported'));
      }
    } catch (error) {
      reject(error);
    }
  });
}
async function handleFiles(files) {
  for (const file of files) {
    // Check if file already exists
    if (state.files.some(f => f.name === file.name && f.size === file.size)) {
      continue;
    }
    console.log('handleFiles - processing file:', file.name);
    // Validate PDF file type
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      console.error('Only PDF files are supported');
      continue;
    }
    
    // Generate standardized file name
    const generatedFileName = `${user.value.id}_${Date.now()}_${state.upload_id}.pdf`;
    
    // Add file to state with initial status
    const tempFile = {
      id: `${user.value.id}_${Date.now()}_${state.upload_id}`,
      originalName: file.name,
      name: generatedFileName,
      displayName: file.name, // Show original name to user
      size: file.size,
      type: file.type,
      status: 'processing',
      originalFile: file,
      columns: [],
      rows: [],
      num_columns: 0,
      num_rows: 0,
      
    };
    state.files.push(tempFile);
    await parseFile(tempFile);
  }
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
  state.upload_id = _.uniqueId();
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
  $socketio.on(ISocketEvent.PDF_TO_IMAGES_COMPLETE, (data) => {
      console.log('Socket Event', ISocketEvent.PDF_TO_IMAGES_COMPLETE, data);
      const fileIndex = state.files.findIndex(f => f.id === data.fileName.replace('.pdf', ''));
      console.log('File Index', fileIndex);
      if (fileIndex !== -1) {
          state.files[fileIndex].status = 'processing';
          // state.files[fileIndex].columns = data.columns || [];
          // state.files[fileIndex].rows = data.rows || [];
          // state.files[fileIndex].num_columns = data.columns ? data.columns.length : 0;
          // state.files[fileIndex].num_rows = data.rows ? data.rows.length : 0;
      }
    });
    $socketio.on(ISocketEvent.EXTRACT_TEXT_FROM_IMAGE_COMPLETE, (data) => {
      console.log('Socket Event', ISocketEvent.EXTRACT_TEXT_FROM_IMAGE_COMPLETE, data);
      const fileIndex = state.files.findIndex(f => data.fileName.replace('.pdf', '').includes(f.id));
      console.log('File Index', fileIndex);
      if (fileIndex !== -1) {
          state.files[fileIndex].status = 'completed';
          // state.files[fileIndex].columns = data.columns || [];
          // state.files[fileIndex].rows = data.rows || [];
          // state.files[fileIndex].num_columns = data.columns ? data.columns.length : 0;
          // state.files[fileIndex].num_rows = data.rows ? data.rows.length : 0;
      }
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
                <p class="text-sm text-gray-600">Supported formats: .pdf</p>
                <input type="file" id="file-elem" multiple class="hidden">
            </div>
            <div class="grid grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 md:gap-10 lg:grid-cols-4 xl:grid-cols-5 mx-auto mt-5">
                <div v-for="file in state.files" class="w-full relative">
                    <notched-card  class="justify-self-center mt-5">
                        <template #body="{ onClick }">
                            <NuxtLink class="text-gray-500">
                                <div class="flex flex-row justify-end">
                                    <font-awesome
                                      v-if="file.status === 'completed' && file.rows && file.rows.length"
                                      icon="fas fa-table"
                                      class="text-xl ml-2 text-gray-500 hover:text-gray-400 cursor-pointer"
                                      :v-tippy-content="'View Data In Table'"
                                      @click="showTable(file.id)"
                                    />
                                    <font-awesome
                                      v-if="file.status === 'completed'"
                                      icon="fas fa-check"
                                      class="text-xl ml-2 text-green-300"
                                    />
                                    <font-awesome
                                      v-else-if="file.status === 'processing'"
                                      icon="fas fa-hourglass-half"
                                      class="text-xl ml-2 text-gray-500"
                                    />
                                    <font-awesome
                                      v-else-if="file.status === 'error'"
                                      icon="fas fa-exclamation"
                                      class="text-xl ml-2 text-red-500"
                                    />
                                </div>
                                <div class="flex flex-col justify-center">
                                    <div class="text-md">
                                      {{ file.displayName || file.name }}
                                    </div>
                                    <div v-if="file.status === 'error' && file.error" class="mt-2 text-xs text-red-600">
                                      {{ file.error }}
                                    </div>
                                </div>
                                <div class="flex flex-row justify-center items-center mt-5 mr-10">
                                    <font-awesome
                                        icon="fas fa-file-pdf"
                                        class="text-5xl ml-2 text-red-500"
                                    />
                                </div>
                            </NuxtLink>
                        </template>
                    </notched-card>
                    <div v-if="file.status !== 'processing'" class="absolute top-px -right-2 z-10 bg-gray-200 hover:bg-gray-300 border border-gray-200 border-solid rounded-full w-10 h-10 flex items-center justify-center cursor-pointer" @click="removeFile(file.id)" v-tippy="{ content: 'Remove File', placement: 'top' }">
                        <font-awesome icon="fas fa-xmark" class="text-xl text-red-500 hover:text-red-400" />
                    </div>
                </div>
            </div>            
            <div v-if="state.files && state.files.length" class="flex flex-row w-full justify-center mt-10">
                <div v-if="state.columns && state.columns.length && state.show_table_dialog" class="flex flex-col w-3/4 justify-center overflow-hidden mb-10">
                    <h2 class="mb-4 text-xl font-bold text-gray-800">Data From The Selected PDF File</h2>
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
                Create PDF Data Source &amp; Upload PDF Files
            </div>

        </div>
    </div>
</template>