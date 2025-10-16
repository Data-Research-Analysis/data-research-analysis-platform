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
    sheets: [], // New: unified collection of all sheets from all PDFs
    activeSheetId: null,
    selected_file: null,
    loading: false,
    upload_id: 0,
});
const user = computed(() => loggedInUserStore.getLoggedInUser());

// Sheet Management Functions
function createSheetFromPage(file, pageData, pageNumber) {
  const sheetName = `${file.displayName || file.name} - Page ${pageNumber}`;
  const sheetId = `${file.id}_page_${pageNumber}`;
  
  const sheet = {
    id: sheetId,
    name: sheetName,
    fileName: file.displayName || file.name,
    fileId: file.id,
    pageNumber: pageNumber,
    columns: pageData.columns || [],
    rows: pageData.rows || [],
    metadata: {
      created: new Date(),
      modified: new Date(),
      rowCount: pageData.rows?.length || 0,
      columnCount: pageData.columns?.length || 0,
      pdfFileId: file.id
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
                // Create sheets from all pages of the selected file
                const fileSheets = getSheetsByFileId(fileId);

                // If sheets already exist, show the table
                if (fileSheets.length > 0) {
                    state.show_table_dialog = true;
                    return;
                }
                
                // Create sheets from file pages if they don't exist yet
                if (file.pages && file.pages.length > 0) {
                    file.pages.forEach((pageData, index) => {
                        if (pageData.rows && pageData.rows.length > 0) {
                            const sheet = createSheetFromPage(file, pageData, index + 1);
                            addSheetToCollection(sheet);
                        }
                    });
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
    const url = `${baseUrl()}/data-source/add-pdf-data-source`;
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
        
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
            body: JSON.stringify({
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
                    page_number: sheet.pageNumber
                }
            })
        });
        
        if (response.status === 200) {
            const data = await response.json();
            dataSourceId = data.result.data_source_id;
            file.status = 'uploaded';
            console.log(`Sheet ${sheet.name} uploaded successfully`);
        } else {
            file.status = 'failed';
            console.error(`Failed to upload sheet ${sheet.name}`);
        }
        
        await sleep(1000);
    }
    
    state.loading = false;
    
    $swal.fire({
        icon: 'success',
        title: 'Success!',
        text: `PDF data source created with ${state.sheets.length} sheets.`,
    });
    
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
      pages: [],
    };
    state.files.push(tempFile);
    await parseFile(tempFile);
  }
}

function handleCellUpdate(event) {
    // Update the active sheet's data
    const activeSheet = state.sheets.find(sheet => sheet.id === state.activeSheetId);
    if (activeSheet) {
        const row = activeSheet.rows.find((row) => row.id === event.rowId);
        if (row) {
            row.data = row.data || {};
            row.data[event.columnKey] = event.newValue;
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
        // Remove columns
        activeSheet.columns = activeSheet.columns.filter(col => 
            !event.removedColumns.some(removedCol => removedCol.id === col.id)
        );
        
        // Remove data from rows
        activeSheet.rows.forEach((row) => {
            if (row.data) {
                event.removedColumns.forEach((col) => {
                    delete row.data[col.key];
                });
            } else {
                // Handle legacy row structure
                event.removedColumns.forEach((col) => {
                    delete row[col.key];
                });
            }
        });
        
        activeSheet.metadata.columnCount = activeSheet.columns.length;
        activeSheet.metadata.modified = new Date();
    }
}
function showPages(fileId) {
    // This function is no longer needed as pages are now sheets
    showTable(fileId);
}

// Sheet Event Handlers
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
    if (typeof data === 'string') {
      const parsedData = JSON.parse(data);
      const fileIndex = state.files.findIndex(f => f.id === parsedData.file_name);
      if (fileIndex !== -1) {
          state.files[fileIndex].status = 'processing';
          state.files[fileIndex].pages = [];
          const numPages = parsedData.num_pages || 0;
          for (let i = 0; i < numPages; i++) {
            const pageData = {
              rows: [],
              columns: [],
              num_rows: 0,
              num_columns: 0,
              page_number: i + 1,
            };
            state.files[fileIndex].pages.push(pageData);
            // Create placeholder sheet for this page
            const sheet = createSheetFromPage(state.files[fileIndex], pageData, i + 1);
            addSheetToCollection(sheet);
          }
      }
    }
    });
    $socketio.on(ISocketEvent.EXTRACT_TEXT_FROM_IMAGE_COMPLETE, (data) => {
      if (typeof data === 'string') {
        const parsedData = JSON.parse(data);
        const fileName = parsedData.file_name.split('-')[0];
        const pageNumber = parseInt(parsedData.file_name.split('-')[1]) || 1;
        const pageData = parsedData.data.data;
        const fileIndex = state.files.findIndex(f => fileName.includes(f.id));
        if (fileIndex !== -1) {
            const analyzedColumns = analyzeColumns(pageData);
            const pageIndex = pageNumber - 1;

            // Update file page data
            if (state.files[fileIndex].pages[pageIndex]) {
              state.files[fileIndex].pages[pageIndex].columns = analyzedColumns;
              state.files[fileIndex].pages[pageIndex].rows = pageData || [];
              state.files[fileIndex].pages[pageIndex].num_columns = pageData && pageData[0] ? Object.keys(pageData[0]).length : 0;
              state.files[fileIndex].pages[pageIndex].num_rows = pageData ? pageData.length : 0;
            }

            // Update or create corresponding sheet
            const sheetId = `${state.files[fileIndex].id}_page_${pageNumber}`;
            const existingSheet = state.sheets.find(s => s.id === sheetId);
            
            if (existingSheet) {
                // Update existing sheet
                existingSheet.columns = analyzedColumns;
                existingSheet.rows = (pageData || []).map((rowData, index) => ({
                    id: `row_${Date.now()}_${index}`,
                    data: { ...rowData }
                }));
                existingSheet.metadata.rowCount = pageData ? pageData.length : 0;
                existingSheet.metadata.columnCount = analyzedColumns.length;
                existingSheet.metadata.modified = new Date();
            } else {
                // Create new sheet
                const pageInfo = {
                    columns: analyzedColumns,
                    rows: (pageData || []).map((rowData, index) => ({
                        id: `row_${Date.now()}_${index}`,
                        data: { ...rowData }
                    }))
                };
                const newSheet = createSheetFromPage(state.files[fileIndex], pageInfo, pageNumber);
                addSheetToCollection(newSheet);
            }
            
            // Mark file as completed when all pages are processed
            if (state.files[fileIndex].pages.length === pageNumber) {
              state.files[fileIndex].status = 'completed';
            }
        }
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
                                      v-if="file.status === 'completed' && file.pages && file.pages.some(page => page.rows && page.rows.length)"
                                      icon="fas fa-table"
                                      class="text-xl ml-2 text-gray-500 hover:text-gray-400 cursor-pointer"
                                      :v-tippy-content="'View All Pages In Multi-Sheet Table'"
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
                                    <div v-if="file.status === 'completed' && file.pages" class="mt-1 text-xs text-green-600">
                                      {{ file.pages.length }} pages processed
                                    </div>
                                    <div v-if="file.status === 'processing'" class="mt-1 text-xs text-blue-600">
                                      Processing pages...
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
                <div v-if="state.sheets && state.sheets.length && state.show_table_dialog" class="flex flex-col w-full justify-center overflow-hidden mb-10 px-4">
                    <h2 class="mb-4 text-xl font-bold text-gray-800">PDF Data - Multi-Sheet View</h2>
                    <div class="text-sm text-gray-600 mb-4">
                        Showing {{ state.sheets.length }} sheet{{ state.sheets.length !== 1 ? 's' : '' }} from {{ state.files.length }} PDF file{{ state.files.length !== 1 ? 's' : '' }}
                    </div>
                    <custom-data-table
                        :sheets="state.sheets"
                        :activeSheetId="state.activeSheetId"
                        :allowMultipleSheets="true"
                        :maxSheets="50"
                        :editable="true"
                        @cell-updated="handleCellUpdate"
                        @rows-removed="handleRowsRemoved"
                        @column-removed="handleColumnRemoved"
                        @sheet-changed="handleSheetChanged"
                        @sheet-created="handleSheetCreated"
                        @sheet-deleted="handleSheetDeleted"
                        @sheet-renamed="handleSheetRenamed"
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