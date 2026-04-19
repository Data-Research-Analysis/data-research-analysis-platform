<script setup lang="ts">

definePageMeta({ layout: 'project' });
import _ from 'lodash';
import { useColumnTypeDetection } from '@/composables/file-uploads/useColumnTypeDetection';
import { useDataNormalization } from '@/composables/file-uploads/useDataNormalization';
import { useFileValidation } from '@/composables/file-uploads/useFileValidation';
import { useOrganizationContext } from '@/composables/useOrganizationContext';

const { $swal, $socketio } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const config = useRuntimeConfig();
const { requireWorkspace, getOrgHeaders } = useOrganizationContext();

// Initialize composables
const columnDetector = useColumnTypeDetection();
const dataNormalizer = useDataNormalization();
const fileValidator = useFileValidation();

interface State {
    data_source_name: string;
    files: any[];
    show_table_dialog: boolean;
    sheets: any[];
    activeSheetId: any;
    selected_file: any;
    loading: boolean;
    upload_id: number;
    showClassificationModal: boolean;
    selectedClassification: any;
    loadingTableForFileId: any;
    uploadJobs: Map<any, any>;
    completedDataSourceId: any;
    renamedColumns: any[];
    requiresReview: boolean;
    reviewAcknowledged: boolean;
}
let dropZone: any = null;
const state = reactive<State>({
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
    loadingTableForFileId: null, // Track which file's table is being loaded
    uploadJobs: new Map(), // Track jobId -> fileId mapping
    completedDataSourceId: null, // Track the created data source ID
    // NEW: Duplicate column handling
    renamedColumns: [], // Track renamed columns per sheet
    requiresReview: false,
    reviewAcknowledged: false,
});

// Computed properties for button state management
const allFilesCompleted = computed(() => {
    if (!state.files || state.files.length === 0) return false;
    return state.files.every(file => file.status === 'completed');
});

const allUploadsCompleted = computed(() => {
    if (!state.files || state.files.length === 0) return false;
    // Check if all files that were queued/uploading are now uploaded or error
    const uploadedOrError = state.files.every(file => 
        file.status === 'uploaded' || file.status === 'error' || file.status === 'completed'
    );
    return uploadedOrError;
});

const hasUploadedFiles = computed(() => {
    return state.files.some(file => file.status === 'uploaded');
});

const allSheetsUploaded = computed(() => {
    if (!state.files || state.files.length === 0) return false;
    return state.files.every(file => file.status === 'uploaded' || file.status === 'error');
});

const hasProcessingFiles = computed(() => {
    return state.files.some(file => 
        file.status === 'processing' || 
        file.status === 'uploading' || 
        file.status === 'queued'
    );
});

const hasErrorFiles = computed(() => {
    return state.files.some(file => file.status === 'error');
});

const buttonDisabled = computed(() => {
    // Disable if review is required but not acknowledged
    if (state.requiresReview && !state.reviewAcknowledged) {
        return true;
    }
    return state.loading || !allFilesCompleted.value || state.files.length === 0;
});

const buttonStatusText = computed(() => {
    if (state.requiresReview && !state.reviewAcknowledged) return 'Please review and approve proposed column name changes';
    if (state.loading) return 'Creating Data Source...';
    if (state.files.length === 0) return 'Please upload Excel files first';
    if (hasErrorFiles.value && !hasProcessingFiles.value) return 'Some files failed - fix errors or remove them';
    if (hasProcessingFiles.value) return 'Uploading in progress...';
    if (allUploadsCompleted.value && state.completedDataSourceId) return 'All uploads completed!';
    if (allFilesCompleted.value) return 'Ready to create data source';
    return 'Upload Excel files to continue';
});

// Socket.IO event handler for Excel upload progress
const handleExcelUploadProgress = (eventData: any): void => {
    try {
        const data = typeof eventData === 'string' ? JSON.parse(eventData) : eventData;
        const { jobId, fileId, phase, progress, message, error, dataSourceId, errorDetails } = data;
        
        // Find the file associated with this job
        const file = state.files.find(f => f.id === fileId);
        if (!file) return;
        
        console.log('[Excel Upload Progress]', { phase, progress, message, fileId });
        
        // Update file status based on phase
        if (phase === 'queued') {
            file.status = 'queued';
            file.progress = progress;
            file.statusMessage = message || 'Upload queued';
        } else if (phase === 'processing') {
            file.status = 'uploading';
            file.progress = progress;
            file.statusMessage = message || 'Processing...';
        } else if (phase === 'completed') {
            file.status = 'uploaded';
            file.progress = 100;
            file.statusMessage = 'Upload completed';
            
            // Store the data source ID if this is the first sheet of a new data source
            if (dataSourceId && !state.completedDataSourceId) {
                state.completedDataSourceId = dataSourceId;
            }
            
            // Check if all files are now uploaded
            const allDone = state.files.every(f => f.status === 'uploaded' || f.status === 'error');
            const successCount = state.files.filter(f => f.status === 'uploaded').length;
            
            if (allDone && successCount > 0) {
                $swal.fire({
                    icon: 'success',
                    title: 'All Uploads Complete!',
                    text: `Successfully uploaded ${successCount} file(s). Click "View Data Sources" to see your data.`,
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 6000,
                    timerProgressBar: true
                });
            }
        } else if (phase === 'failed') {
            file.status = 'error';
            file.progress = 0;
            file.statusMessage = error || 'Upload failed';
            file.error = error;
            file.errorDetails = errorDetails;  // BUGFIX: Store structured error details for detailed error display
            
            // Parse structured error if available
            let errorTitle = 'Upload Failed';
            let errorText = `Failed to upload ${file.name}`;
            
            if (error) {
                // Check if error message contains specific details
                if (error.includes('row') || error.includes('column')) {
                    errorTitle = 'Data Validation Error';
                    errorText = error;
                } else {
                    errorText = `${file.name}: ${error}`;
                }
            }
            
            // Show detailed error notification
            $swal.fire({
                icon: 'error',
                title: errorTitle,
                html: `
                    <div style="text-align: left;">
                        <p><strong>${file.name}</strong></p>
                        <p style="color: #d33;">${errorText}</p>
                        <hr style="margin: 10px 0;">
                        <p style="font-size: 0.9em; color: #666;">
                            <strong>Common solutions:</strong><br>
                            • Check that numeric values aren't too large (max: 2,147,483,647)<br>
                            • Verify date formats are consistent<br>
                            • Ensure required fields aren't empty<br>
                            • Remove any special characters that might cause issues
                        </p>
                    </div>
                `,
                confirmButtonText: 'OK',
                width: '500px'
            });
        }
    } catch (err) {
        console.error('[Excel Upload Progress] Error parsing event:', err);
    }
};

// Column Sanitization Modal Handler
async function showDuplicateColumnModal(sheetName: string, renamedColumns: any[], fileId: any): Promise<void> {
    const columnList = renamedColumns.map((col, idx) => 
        `${idx + 1}. "<strong>${col.originalTitle}</strong>" → "<strong class="text-blue-600">${col.finalName}</strong>"`
    ).join('<br>');
    
    const result = await $swal.fire({
        title: 'Column Names Require Sanitization',
        icon: 'info',
        html: `
            <div class="text-left">
                <p class="mb-3">The following columns in <strong>${sheetName}</strong> will be renamed when the data source is created:</p>
                <div class="bg-blue-50 border border-blue-200 rounded p-3 mb-3 text-sm" style="max-height: 300px; overflow-y: auto;">
                    ${columnList}
                </div>
                <p class="text-sm text-gray-600 mb-2">
                    <strong>Why?</strong> Column names with spaces, special characters, or duplicates will be converted to database-friendly names (lowercase letters, numbers, and underscores only).
                </p>
                <p class="text-sm text-gray-600">
                    <strong>Action Required:</strong> Review the proposed column names in the preview below. 
                    You can manually edit them or approve the suggested names.
                </p>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Review in Preview',
        cancelButtonText: 'Cancel Upload',
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        width: '600px'
    });
    
    if (!result.isConfirmed) {
        // User cancelled - remove file from upload list
        const fileIndex = state.files.findIndex(f => f.id === fileId);
        if (fileIndex >= 0) {
            state.files.splice(fileIndex, 1);
            // Also remove associated sheets
            removeSheetsByFileId(fileId);
            // Remove from renamed columns tracking
            state.renamedColumns = state.renamedColumns.filter(r => r.fileId !== fileId);
            // Check if we still need review
            state.requiresReview = state.renamedColumns.length > 0;
        }
    }
}

// Helper function to check if a column is renamed
function isRenamedColumn(sheetName: string, columnIndex: number): boolean {
    const sheet = state.renamedColumns.find(r => r.sheetName === sheetName);
    return sheet?.columns.some(c => c.originalIndex === columnIndex) || false;
}

// Helper function to get original column name
function getOriginalColumnName(sheetName: string, columnIndex: number): string {
    const sheet = state.renamedColumns.find(r => r.sheetName === sheetName);
    const column = sheet?.columns.find(c => c.originalIndex === columnIndex);
    return column?.originalTitle || '';
}

// Helper function to handle column rename in preview
function onColumnRenamed(sheetName: string, columnIndex: number, newName: string): void {
    const sheet = state.renamedColumns.find(r => r.sheetName === sheetName);
    if (sheet) {
        const column = sheet.columns.find(c => c.originalIndex === columnIndex);
        if (column) {
            column.finalName = newName.toLowerCase().replace(/[^a-z0-9]/g, '_');
        }
    }
}

// Show list of all renamed columns
function showRenamedColumnsList() {
    const allRenames = state.renamedColumns.flatMap(sheet => 
        sheet.columns.map(col => ({
            sheet: sheet.sheetName,
            original: col.originalTitle,
            renamed: col.finalName
        }))
    );
    
    const tableRows = allRenames.map((rename, idx) => `
        <tr class="${idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}">
            <td class="px-4 py-2 border text-sm">${rename.sheet}</td>
            <td class="px-4 py-2 border font-mono text-sm">${rename.original}</td>
            <td class="px-4 py-2 border text-center text-gray-400">→</td>
            <td class="px-4 py-2 border font-mono text-sm text-blue-600">${rename.renamed}</td>
        </tr>
    `).join('');
    
    $swal.fire({
        title: 'Proposed Column Name Changes',
        html: `
            <div class="overflow-x-auto">
                <p class="text-sm text-gray-600 mb-3 text-left">These column names will be applied when the data source is created:</p>
                <table class="w-full text-left text-sm border-collapse">
                    <thead class="bg-gray-100">
                        <tr>
                            <th class="px-4 py-2 border font-semibold">Sheet</th>
                            <th class="px-4 py-2 border font-semibold">Original Name</th>
                            <th class="px-4 py-2 border"></th>
                            <th class="px-4 py-2 border font-semibold">Proposed Name</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </div>
        `,
        width: '800px',
        confirmButtonText: 'Close'
    });
}

// Lifecycle: Set up Socket.IO listeners
onMounted(() => {
    if (import.meta.client && $socketio) {
        console.log('[Excel Upload] Setting up Socket.IO listener');
        $socketio.on('excel-upload-progress', handleExcelUploadProgress);
    }
});

// Lifecycle: Clean up Socket.IO listeners
onBeforeUnmount(() => {
    if (import.meta.client && $socketio) {
        console.log('[Excel Upload] Cleaning up Socket.IO listener');
        $socketio.off('excel-upload-progress', handleExcelUploadProgress);
    }
});

// Sheet Management Functions
function createSheetFromWorksheet(file: any, sheetData: any, sheetName: string, sheetIndex: number): any {
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

function addSheetToCollection(sheet: any): void {
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

function removeSheetsByFileId(fileId: any): void {
    state.sheets = state.sheets.filter(sheet => sheet.fileId !== fileId);
    
    // Update active sheet if current one was removed
    if (state.sheets.length > 0 && !state.sheets.find(s => s.id === state.activeSheetId)) {
        state.activeSheetId = state.sheets[0].id;
    } else if (state.sheets.length === 0) {
        state.activeSheetId = null;
    }
}

function getSheetsByFileId(fileId: any): any[] {
    return state.sheets.filter(sheet => sheet.fileId === fileId);
}

function handleDrop(e: DragEvent): void {
    preventDefaults(e);
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles(files);
}

function preventDefaults(e: Event): void {
    e.preventDefault();
    e.stopPropagation();
}

function showTable(fileId: any): void {
    // Set loading state for this file
    state.loadingTableForFileId = fileId;
    
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
            // Clear loading state
            state.loadingTableForFileId = null;
        }, 500);
    });
}

async function removeFile(fileId: any): Promise<void> {
    const file = state.files.find(f => f.id === fileId);
    if (!file) return;
    
    // Show confirmation dialog
    const result = await $swal.fire({
        title: 'Delete File?',
        text: `Are you sure you want to remove "${file.name}"? This action cannot be undone.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, delete it',
        cancelButtonText: 'Cancel'
    });
    
    // If user confirmed, proceed with deletion
    if (result.isConfirmed) {
        // Remove sheets associated with this file
        removeSheetsByFileId(fileId);
        
        // Remove the file itself
        state.files = state.files.filter((file) => file.id !== fileId);
        
        // Hide table dialog if no sheets remain
        if (state.sheets.length === 0) {
            state.show_table_dialog = false;
        }
        
        // Reset file input to allow re-uploading the same file
        if (import.meta.client) {
            const fileElem = document.getElementById('file-elem');
            if (fileElem) {
                fileElem.value = '';
            }
        }
        
        // Show success message
        $swal.fire({
            title: 'Deleted!',
            text: `${file.name} has been removed.`,
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
        });
    }
}
async function createDataSource(classification: any = null): Promise<void> {
    // Prevent execution if button should be disabled
    if (buttonDisabled.value) {
        state.showClassificationModal = false;
        return;
    }
    
    // PHASE 2 REQUIREMENT: Validate workspace selection before allowing data source creation
    const validation = requireWorkspace();
    if (!validation.valid) {
        state.showClassificationModal = false;
        await $swal.fire({
            title: 'Workspace Required',
            text: validation.error || 'Please select a workspace before creating a data source.',
            icon: 'warning',
            confirmButtonColor: '#3C8DBC',
        });
        return;
    }

    const token = getAuthToken();
    if (!state.data_source_name || state.data_source_name.trim() === '') {
        state.showClassificationModal = false;
        $swal.fire({
            icon: 'error',
            title: `Error!`,
            text: `Please provide a name for the data source.`,
        });
        return;
    }
    
    if (state.sheets.length === 0) {
        state.showClassificationModal = false;
        $swal.fire({
            icon: 'error',
            title: `Error!`,
            text: `No sheet data available to create data source.`,
        });
        return;
    }

    // Additional check to ensure all files are completed
    if (!allFilesCompleted.value) {
        state.showClassificationModal = false;
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
    let successCount = 0;
    let failCount = 0;
    let cacheInvalidated = false; // Track if cache has been invalidated
    
    // Generate unique upload session ID to group all sheets together
    const secureRandomSuffix = globalThis.crypto.getRandomValues(new Uint32Array(1))[0].toString(36).padStart(7, '0').slice(0, 7);
    const uploadSessionId = `upload_${Date.now()}_${secureRandomSuffix}`;
    console.log('[Excel Upload] Starting upload session:', uploadSessionId);

    // Show initial progress
    $swal.fire({
        icon: 'info',
        title: 'Uploading...',
        text: `Queuing ${state.sheets.length} sheet(s) for upload`,
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
    });

    // Process each sheet as a separate job (queued for background processing)
    for (const sheet of state.sheets) {
        if (!sheet.columns || sheet.columns.length === 0 || !sheet.rows || sheet.rows.length === 0) {
            continue;
        }
        
        const file = state.files.find(f => f.id === sheet.fileId);
        if (!file) continue;
        
        file.status = 'queued';
        file.progress = 0;
        file.statusMessage = 'Queueing upload...';
        
        try {
            // Convert sheet data to the expected format
            const sheetRows = sheet.rows.map(row => row.data || row);
            
            const response = await $fetch(url, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                    ...getOrgHeaders()
                },
                body: {
                    file_id: file.id,
                    data: {
                        columns: sheet.columns.map((column) => {
                            return {
                                title: column.title,  // User's renamed column name
                                key: column.key,
                                column_name: column.title.substring(0, 63).replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase(),  // Use title (user's rename), not key
                                type: column.type,
                                inferredType: column.inferredType,
                                forcedType: column.forcedType,
                            };
                        }),
                        rows: sheetRows,
                    },
                    data_source_name: `${state.data_source_name}`.replace(/\s/g,'_').toLowerCase(),
                    project_id: route.params.projectid,
                    data_source_id: dataSourceId ? dataSourceId : null,
                    upload_session_id: uploadSessionId,  // NEW: Group all sheets in this upload session
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
            
            // Handle new async response format
            if (response.success && response.jobId) {
                successCount++;
                // Store job ID for tracking
                state.uploadJobs.set(response.jobId, file.id);
                file.jobId = response.jobId;
                file.status = 'queued';
                file.statusMessage = 'Upload queued';
                
                // Invalidate cache once first job is queued (data source will be created)
                if (!cacheInvalidated) {
                    const cacheManager = useCacheManager();
                    cacheManager.invalidateRelated('dataSource');
                    cacheInvalidated = true;
                }
                
                console.log('[Excel Upload] Job queued:', response.jobId, 'for file:', file.id);
            } else {
                failCount++;
                file.status = 'error';
                file.statusMessage = 'Failed to queue upload';
            }
            
        } catch (error) {
            console.error('[Excel Upload] Error queuing upload:', error);
            failCount++;
            file.status = 'error';
            file.statusMessage = error.message || 'Upload failed';
            file.error = error.message;
        }
    }
    
    state.loading = false;
    
    // Close the classification modal
    state.showClassificationModal = false;
    
    // Stay on page to show progress - no redirect
    if (failCount === 0) {
        // Show success toast
        $swal.fire({
            icon: 'success',
            title: 'Uploads Queued!',
            text: `${successCount} sheet(s) are uploading. Watch the progress below.`,
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 4000,
            timerProgressBar: true
        });
    } else if (failCount < state.sheets.length) {
        // Some succeeded, some failed
        $swal.fire({
            icon: 'warning',
            title: 'Partial Success',
            text: `${successCount} sheet(s) queued, but ${failCount} failed.`,
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 4000,
            timerProgressBar: true
        });
    } else {
        // All failed - don't navigate, let user fix the issue
        $swal.fire({
            icon: 'error',
            title: 'Upload Failed',
            text: `All ${failCount} sheet(s) failed to queue. Please check your files and try again.`,
            confirmButtonText: 'OK'
        });
    }
}

function goToDataSources() {
    router.push(`/projects/${route.params.projectid}/data-sources`);
}

function handleCreateClick() {
    if (buttonDisabled.value) return;
    state.showClassificationModal = true;
}

function goBack() {
    router.push(`/projects/${route.params.projectid}/data-sources`);
}

function showErrorDetails(file: any): void {
    const errorMessage = file.error || file.statusMessage || 'Unknown error';
    const errorDetails = file.errorDetails;
    
    // Build error display with structured details if available
    let errorHtml = '';
    let suggestions = [];
    
    if (errorDetails) {
        // We have structured error details from the backend
        errorHtml = `<p style="color: #d33; font-weight: bold; margin-bottom: 10px;">${errorMessage}</p>`;
        
        if (errorDetails.rowNumber || errorDetails.columnName || errorDetails.detailedError || errorDetails.sqlError) {
            errorHtml += `<div style="background: #f8f9fa; padding: 12px; border-radius: 4px; margin: 10px 0;">`;
            
            if (errorDetails.rowNumber) {
                errorHtml += `<p style="margin: 5px 0;"><strong>Row:</strong> ${errorDetails.rowNumber}</p>`;
            }
            
            if (errorDetails.columnName) {
                errorHtml += `<p style="margin: 5px 0;"><strong>Column:</strong> ${errorDetails.columnName}</p>`;
            }
            
            if (errorDetails.detailedError) {
                errorHtml += `<p style="margin: 5px 0;"><strong>Error Type:</strong> ${errorDetails.detailedError}</p>`;
            }
            
            if (errorDetails.sqlError && errorDetails.sqlError !== errorDetails.detailedError) {
                errorHtml += `<p style="margin: 5px 0; font-size: 0.85em; color: #666;"><strong>Technical Details:</strong> ${errorDetails.sqlError}</p>`;
            }
            
            errorHtml += `</div>`;
        }
        
        // Generate specific suggestions based on the detailed error
        const detailedError = errorDetails.detailedError || '';
        const sqlError = errorDetails.sqlError || '';
        const combinedError = (detailedError + ' ' + sqlError).toLowerCase();
        
        if (combinedError.includes('integer') || combinedError.includes('out of range') || combinedError.includes('numeric')) {
            suggestions.push('The value in this column exceeds the maximum allowed size.');
            suggestions.push('Maximum integer value: 2,147,483,647');
            suggestions.push('Solution: Reduce the size of the number, or use text format for very large IDs.');
        } else if (combinedError.includes('organization_id') || combinedError.includes('workspace_id') || combinedError.includes('violates not null')) {
            suggestions.push('Required system fields are missing.');
            suggestions.push('This is likely a configuration issue. Please contact support.');
        } else if (combinedError.includes('format') || combinedError.includes('invalid')) {
            suggestions.push('The data in this cell has an invalid format.');
            suggestions.push('Check that dates are in a consistent format (e.g., YYYY-MM-DD).');
            suggestions.push('Ensure numeric values don\'t contain text or special characters.');
        } else if (combinedError.includes('empty') || combinedError.includes('required') || combinedError.includes('null')) {
            suggestions.push('A required field is empty.');
            suggestions.push(`Check row ${errorDetails.rowNumber || 'N/A'} and ensure all mandatory columns have values.`);
        } else if (combinedError.includes('duplicate') || combinedError.includes('unique')) {
            suggestions.push('Duplicate values found where unique values are required.');
            suggestions.push(`Check for duplicate values in column "${errorDetails.columnName || 'unknown'}".`);
        } else {
            suggestions.push('A data validation error occurred in this specific cell.');
            suggestions.push('Check the data type matches the column requirements.');
            suggestions.push('Remove any special characters or unusual formatting.');
        }
    } else {
        // Fall back to generic error parsing if no structured details
        errorHtml = `<p style="color: #d33; font-weight: bold; margin-bottom: 10px;">${errorMessage}</p>`;
        
        if (errorMessage.toLowerCase().includes('integer') || errorMessage.toLowerCase().includes('out of range')) {
            suggestions.push('The Excel file contains numeric values that are too large for the database.');
            suggestions.push('Maximum integer value: 2,147,483,647');
            suggestions.push('Solution: Reduce the size of large numbers, or use text format for very large IDs.');
        } else if (errorMessage.toLowerCase().includes('format') || errorMessage.toLowerCase().includes('invalid')) {
            suggestions.push('Some data in the Excel file has an invalid format.');
            suggestions.push('Check date formats, numeric values, and special characters.');
        } else if (errorMessage.toLowerCase().includes('empty') || errorMessage.toLowerCase().includes('required')) {
            suggestions.push('Required fields cannot be empty.');
            suggestions.push('Check that all mandatory columns have values.');
        } else if (errorMessage.toLowerCase().includes('duplicate')) {
            suggestions.push('Duplicate values found where unique values are required.');
            suggestions.push('Check for duplicate IDs or keys in your data.');
        } else {
            suggestions.push('Check your Excel file for data quality issues.');
            suggestions.push('Ensure all values match their column types (numbers, dates, text).');
            suggestions.push('Remove any special characters or formatting that might cause issues.');
        }
    }
    
    $swal.fire({
        icon: 'error',
        title: `Error in ${file.name}`,
        html: `
            <div style="text-align: left;">
                ${errorHtml}
                <hr style="margin: 15px 0;">
                <p style="font-weight: bold; margin-bottom: 8px;">Suggested Solutions:</p>
                <ul style="padding-left: 20px; color: #666; line-height: 1.6;">
                    ${suggestions.map(s => `<li>${s}</li>`).join('')}
                </ul>
                <hr style="margin: 15px 0;">
                <p style="font-size: 0.85em; color: #999;">
                    Tip: You can remove this file and upload a corrected version.
                </p>
            </div>
        `,
        confirmButtonText: 'OK',
        width: '600px'
    });
}

function isValidFile(file: any): boolean {
    // Auto-detect file type based on extension
    const extension = file.name.slice(((file.name.lastIndexOf('.') - 1) >>> 0) + 2).toLowerCase();
    
    // Excel page accepts both Excel and CSV files
    if (extension === 'csv') {
        return fileValidator.isValidFile(file, 'csv');
    } else {
        return fileValidator.isValidFile(file, 'excel');
    }
}

function formatFileSize(bytes: number): string {
    // Delegate to composable
    return fileValidator.formatFileSize(bytes);
}

async function handleFiles(files: File[]): Promise<void> {
    const token = getAuthToken();
    const rejectedFiles = [];
    
    // Convert FileList to array to access index for unique IDs
    const filesArray = Array.from(files);
    
    for (let i = 0; i < filesArray.length; i++) {
        const file = filesArray[i];
        if (isValidFile(file)) {
            try {
                // Store raw file object for upload
                // Use index to guarantee unique IDs when multiple files selected simultaneously
                const fileEntry = {
                    id: `file_${Date.now()}_${i}_${Math.floor(Math.random() * 10000)}`,
                    name: file.name,
                    size: file.size,
                    sizeFormatted: formatFileSize(file.size),
                    type: file.type || 'application/octet-stream',
                    status: 'processing',
                    progress: 0,
                    statusMessage: 'Parsing Excel file...',
                    jobId: null,
                    error: null,
                    raw: file, // Store the raw File object
                    uploadedAt: new Date()
                };
                
                state.files.push(fileEntry);
                
                console.log(`[Excel Upload] Added file to state: ${file.name} (ID: ${fileEntry.id})`);
                console.log(`[Excel Upload] Total files in state: ${state.files.length}`);
                
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
                        console.log('[Excel Upload] Sheet data:', {
                            name: sheetData.sheet_name || sheetData.name,
                            hasDuplicates: sheetData.hasDuplicates,
                            renamedColumnsLength: sheetData.renamedColumns?.length || 0,
                            renamedColumns: sheetData.renamedColumns
                        });
                        
                        // Check for renamed columns (spaces, special chars, duplicates, or length)
                        if (sheetData.hasDuplicates === true && sheetData.renamedColumns && sheetData.renamedColumns.length > 0) {
                            console.log('[Excel Upload] Processing renamed columns for file:', fileEntry.id);
                            // Store renamed columns metadata
                            const existingIndex = state.renamedColumns.findIndex(
                                r => r.sheetName === sheetData.name
                            );
                            
                            if (existingIndex >= 0) {
                                state.renamedColumns[existingIndex].columns = sheetData.renamedColumns;
                            } else {
                                state.renamedColumns.push({
                                    sheetName: sheetData.sheet_name || sheetData.name || fileEntry.name,
                                    fileId: fileEntry.id,
                                    columns: sheetData.renamedColumns
                                });
                            }
                            
                            state.requiresReview = true;
                        }
                        
                        // Map backend format to frontend format
                        const formattedSheet = {
                            name: sheetData.sheet_name || sheetData.name,
                            index: sheetData.sheet_index || sheetData.index,
                            columns: sheetData.columns,
                            rows: sheetData.rows,
                            hasDuplicates: sheetData.hasDuplicates,
                            renamedColumns: sheetData.renamedColumns
                        };
                        
                        const sheet = createSheetFromWorksheet(
                            fileEntry,
                            formattedSheet,
                            formattedSheet.name,
                            formattedSheet.index
                        );
                        
                        // Analyze columns for type detection and width
                        sheet.columns = analyzeColumns(sheet.rows, sheet.columns);
                        
                        // Add IDs to columns for custom-data-table component
                        sheet.columns = sheet.columns.map((col, index) => ({
                            ...col,
                            id: col.id || `col_${Date.now()}_${index}_${Math.random()}`
                        }));
                        
                        // Normalize time values (convert Excel decimals to HH:MM:SS)
                        sheet.rows = normalizeTimeValues(sheet.rows, sheet.columns);
                        
                        addSheetToCollection(sheet);
                    }
                    
                    // Update status on the reactive object in state.files, not the local variable
                    const stateFile = state.files.find(f => f.id === fileEntry.id);
                    if (stateFile) {
                        stateFile.status = 'completed';
                    }
                    
                    console.log('[Excel Upload] Checking for duplicates modal. state.renamedColumns:', state.renamedColumns);
                    console.log('[Excel Upload] Looking for fileId:', fileEntry.id);
                    
                    // Show duplicate column modal if needed - only for files that actually have duplicates
                    const fileRenames = state.renamedColumns.find(r => r.fileId === fileEntry.id);
                    console.log('[Excel Upload] Found fileRenames:', fileRenames);
                    
                    if (fileRenames && fileRenames.columns && fileRenames.columns.length > 0) {
                        console.log('[Excel Upload] Showing duplicate modal for:', fileRenames.sheetName, 'with', fileRenames.columns.length, 'columns');
                        showDuplicateColumnModal(fileRenames.sheetName, fileRenames.columns, fileEntry.id);
                    } else {
                        console.log('[Excel Upload] No duplicates to show modal for');
                    }
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
    
    // Debug: Check for duplicate IDs
    const fileIds = state.files.map(f => f.id);
    const duplicateIds = fileIds.filter((id, index) => fileIds.indexOf(id) !== index);
    if (duplicateIds.length > 0) {
        console.error('[Excel Upload] Duplicate file IDs detected:', duplicateIds);
    }
    console.log(`[Excel Upload] Processing complete. Total files: ${filesArray.length}, Successfully added: ${state.files.length}, Rejected: ${rejectedFiles.length}`);
    
    // Reset file input to allow re-uploading files
    if (import.meta.client) {
        const fileElem = document.getElementById('file-elem');
        if (fileElem) {
            fileElem.value = '';
        }
    }
}

// Type Detection and Normalization - Delegated to Composables
// NOTE: These functions now use shared composables imported at the top
// See: useColumnTypeDetection, useDataNormalization  

function analyzeColumns(rows: any[], existingColumns: any[] = []): any[] {
    // Delegate to composable
    return columnDetector.analyzeColumns(rows, existingColumns);
}

function normalizeTimeValues(rows: any[], columns: any[]): any[] {
    // Delegate to composable
    return dataNormalizer.normalizeTimeValues(rows, columns);
}

// Sheet Editing Handlers
function handleCellUpdate(sheetId: any, rowIndex: number, columnKey: string, newValue: any): void {
    const sheet = state.sheets.find(s => s.id === sheetId);
    if (!sheet || !sheet.rows[rowIndex]) return;
    
    sheet.rows[rowIndex].data[columnKey] = newValue;
    sheet.metadata.modified = new Date();
}

function handleRowsRemoved(sheetId: any, rowIndices: number[]): void {
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

function handleColumnRemoved(sheetId: any, columnKey: string): void {
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

function handleRowAdded(sheetId: any, newRowData: any): void {
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

function handleColumnAdded(sheetId: any, columnDef: any): void {
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

function handleColumnRenamed(event: any): void {
    // Get active sheet (custom-data-table works on active sheet only)
    const activeSheet = state.sheets.find(sheet => sheet.id === state.activeSheetId);
    if (!activeSheet) return;
    
    // Find column by ID first, fallback to key if ID not found (safety measure)
    let column = activeSheet.columns.find(col => col.id === event.columnId);
    if (!column) {
        column = activeSheet.columns.find(col => col.key === event.column?.key);
    }
    
    if (!column) return;
    
    // Update column title (this is what user sees and what should be sent to backend)
    column.title = event.newName;
    
    // Store original title if not already stored
    if (!column.originalTitle) {
        column.originalTitle = event.oldName;
    }
    
    // Update the key for data mapping (sanitize to match backend expectations)
    const newKey = event.newName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const oldKey = column.key;
    
    if (newKey !== oldKey) {
        column.key = newKey;
        
        // Update data in all rows with the new key
        activeSheet.rows.forEach(row => {
            if (oldKey in row.data) {
                row.data[newKey] = row.data[oldKey];
                delete row.data[oldKey];
            }
        });
    }
    
    activeSheet.metadata.modified = new Date();
}

function handleSheetChanged(event: any): void {
    state.activeSheetId = event.newSheetId;
}

function handleSheetDeleted(event: any): void {
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

function handleSheetRenamed(event: any): void {
    const sheetId = event.sheetId || event.id;
    const newName = event.newName || event.name;
    const sheet = state.sheets.find(s => s.id === sheetId);
    if (!sheet) return;
    
    sheet.name = newName;
    sheet.metadata.modified = new Date();
}

function handleColumnTypeForced(event: any): void {
    console.log('[Excel] handleColumnTypeForced called with event:', event);
    console.log('[Excel] Current sheets:', state.sheets.map(s => ({ id: s.id, name: s.name, columnCount: s.columns.length })));
    
    const { sheetId, columnId, columnKey, forcedType, convertedCount } = event;
    const sheet = state.sheets.find(s => s.id === sheetId);
    if (!sheet) {
        console.warn('[Excel] Sheet not found:', sheetId);
        console.warn('[Excel] Available sheet IDs:', state.sheets.map(s => s.id));
        return;
    }
    
    console.log('[Excel] Found sheet:', sheet.name, 'looking for column:', columnId, columnKey);
    console.log('[Excel] Sheet columns:', sheet.columns.map(c => ({ id: c.id, key: c.key, title: c.title })));
    
    // Find column by ID or key
    const column = sheet.columns.find(col => col.id === columnId || col.key === columnKey);
    if (!column) {
        console.warn('[Excel] Column not found. Looking for:', { columnId, columnKey });
        console.warn('[Excel] Available columns:', sheet.columns.map(c => ({ id: c.id, key: c.key, title: c.title })));
        return;
    }
    
    console.log('[Excel] Found column:', column.title, 'current type:', column.type, 'forcing to:', forcedType);
    
    // Set the forced type and update the current type
    column.forcedType = forcedType;
    column.type = forcedType;
    
    sheet.metadata.modified = new Date();
    console.log(`[Excel] ✅ Column type forced: ${column.title} → ${forcedType} (${convertedCount || 0} cells converted)`);
    console.log('[Excel] Updated column:', { type: column.type, inferredType: column.inferredType, forcedType: column.forcedType });
}

function handleColumnTypeReset(event: any): void {
    const { sheetId, columnId, columnKey } = event;
    const sheet = state.sheets.find(s => s.id === sheetId);
    if (!sheet) return;
    
    // Find column by ID or key
    const column = sheet.columns.find(col => col.id === columnId || col.key === columnKey);
    if (!column) return;
    
    // Clear the forced type and revert to inferred type
    column.forcedType = undefined;
    column.type = column.inferredType;
    
    sheet.metadata.modified = new Date();
    console.log(`[Excel] Column type reset: ${column.title} → ${column.inferredType}`);
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

        <div class="text-center mb-5">
            <h1 class="text-4xl font-bold text-gray-900 mb-2">Connect Excel / CSV Data Source</h1>
            <p class="text-base text-gray-600">Upload your Excel or CSV files to import and analyze data.</p>
        </div>

        <div class="flex flex-col justify-center">
            <div class="flex flex-row justify-center">
                <input type="text" class="w-3/4 border border-primary-blue-100 border-solid p-2 cursor-pointer margin-auto rounded-lg" placeholder="Data Source Name" v-model="state.data_source_name"/>
            </div>
            
            <!-- Duplicate columns warning banner -->
            <div 
                v-if="state.requiresReview && !state.reviewAcknowledged"
                class="w-3/4 mx-auto bg-yellow-50 border-l-4 border-yellow-400 p-4 mt-6 rounded"
            >
                <div class="flex">
                    <div class="flex-shrink-0">
                        <font-awesome-icon 
                            :icon="['fas', 'triangle-exclamation']"
                            class="text-yellow-400 w-5 h-5"
                        />
                    </div>
                    <div class="ml-3 flex-1">
                        <h3 class="text-sm font-medium text-yellow-800">
                            Column Name Changes Required for Database Compatibility
                        </h3>
                        <div class="mt-2 text-sm text-yellow-700">
                            <p>
                                Some columns will be renamed when creating the data source because they contain spaces, special characters, or are duplicates. 
                                Proposed changes are highlighted in yellow in the preview below.
                            </p>
                            <p class="mt-1">
                                <strong>Action Required:</strong> Review the proposed column names and either:
                            </p>
                            <ul class="list-disc list-inside mt-1">
                                <li>Approve the suggested names and create the data source</li>
                                <li>Manually edit column names by clicking on them in the preview</li>
                            </ul>
                        </div>
                        <div class="mt-4 flex gap-3">
                            <button
                                @click="state.reviewAcknowledged = true"
                                class="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded text-sm"
                            >
                                <font-awesome-icon :icon="['fas', 'check']" class="mr-2" />
                                Approve Changes & Continue
                            </button>
                            <button
                                @click="showRenamedColumnsList"
                                class="border border-yellow-600 text-yellow-700 hover:bg-yellow-50 px-4 py-2 rounded text-sm"
                            >
                                <font-awesome-icon :icon="['fas', 'list']" class="mr-2" />
                                View All Proposed Changes
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="flex flex-col justify-center w-3/4 min-h-100 bg-gray-200 m-auto mt-5 text-center cursor-pointer rounded-xl" id="drop-zone">
                <h3 class="text-lg font-semibold">Drop files here or click to upload</h3>
                <p class="text-sm text-gray-600">Supported formats: .xlsx, .xls, .csv</p>
                <input type="file" id="file-elem" multiple accept=".xlsx,.xls,.csv" class="hidden">
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mx-auto mt-5 px-4">
                <div v-for="file in state.files" :key="file.id"
                     class="relative border border-gray-200 rounded-lg p-6 bg-white shadow-sm hover:shadow-lg hover:border-primary-blue-100 transition-all duration-200 group flex flex-col">
                    
                    <!-- Header: Icon + Filename -->
                    <div class="flex items-start gap-4 mb-4">
                        <font-awesome
                            icon="fas fa-file-excel"
                            class="text-4xl shrink-0"
                            :class="{
                                'text-green-600': file.status === 'uploaded',
                                'text-green-500': file.status === 'completed',
                                'text-blue-500': file.status === 'processing' || file.status === 'uploading' || file.status === 'queued',
                                'text-red-500': file.status === 'error',
                                'text-yellow-500': file.status === 'requires_review',
                                'text-gray-400': !file.status || file.status === 'pending'
                            }"
                        />
                        <div class="flex-1 min-w-0">
                            <h3 class="text-lg font-semibold text-gray-900 break-words">{{ file.name }}</h3>
                            <p class="text-sm text-gray-500">Excel File</p>
                        </div>
                    </div>

                    <!-- Status Section -->
                    <div class="mb-4">
                        <div class="flex items-center gap-2 mb-2">
                            <font-awesome
                              v-if="file.status === 'uploaded'"
                              icon="fas fa-circle-check"
                              class="text-lg text-green-600"
                            />
                            <font-awesome
                              v-else-if="file.status === 'completed'"
                              icon="fas fa-check"
                              class="text-lg text-green-500"
                            />
                            <font-awesome
                              v-else-if="file.status === 'uploading' || file.status === 'queued'"
                              icon="fas fa-spinner"
                              class="text-lg text-blue-500 fa-spin"
                            />
                            <font-awesome
                              v-else-if="file.status === 'processing'"
                              icon="fas fa-spinner"
                              class="text-lg text-blue-500 fa-spin"
                            />
                            <font-awesome
                              v-else-if="file.status === 'requires_review'"
                              icon="fas fa-triangle-exclamation"
                              class="text-lg text-yellow-500"
                            />
                            <font-awesome
                              v-else-if="file.status === 'error'"
                              icon="fas fa-exclamation-circle"
                              class="text-lg text-red-500"
                            />
                            <font-awesome
                              v-else
                              icon="fas fa-clock"
                              class="text-lg text-gray-400"
                            />
                            <span class="text-sm font-medium text-gray-700">
                                <template v-if="file.status === 'uploaded'">Uploaded</template>
                                <template v-else-if="file.status === 'completed'">Ready</template>
                                <template v-else-if="file.status === 'uploading'">Uploading</template>
                                <template v-else-if="file.status === 'queued'">Queued</template>
                                <template v-else-if="file.status === 'processing'">Processing</template>
                                <template v-else-if="file.status === 'requires_review'">Review Required</template>
                                <template v-else-if="file.status === 'error'">Error</template>
                                <template v-else>Pending</template>
                            </span>
                        </div>
                        <div v-if="file.status === 'uploaded'" class="text-xs text-green-600">
                          ✓ Uploaded - {{ getSheetsByFileId(file.id).length }} sheet(s)
                        </div>
                        <div v-else-if="file.status === 'completed'" class="text-xs text-green-600">
                          Ready - {{ getSheetsByFileId(file.id).length }} sheet(s)
                        </div>
                        <div v-else-if="file.status === 'uploading'" class="text-xs text-blue-600">
                          <span v-if="file.progress">{{ file.progress }}% - </span>{{ file.statusMessage || 'Uploading...' }}
                        </div>
                        <div v-else-if="file.status === 'queued'" class="text-xs text-amber-600">
                          Queued - {{ file.statusMessage || 'Waiting to upload' }}
                        </div>
                        <div v-else-if="file.status === 'processing'" class="text-xs text-blue-600">
                          Processing...
                        </div>
                        <div v-else-if="file.status === 'requires_review'" class="text-xs text-yellow-600">
                          <strong>Review Required:</strong> {{ file.statusMessage || 'Column names sanitized' }}
                        </div>
                        <div v-else-if="file.status === 'error'" class="text-xs">
                          <div class="text-red-600 font-medium mb-1">
                            {{ file.statusMessage || 'Failed to process' }}
                          </div>
                          <div v-if="file.error && file.error !== file.statusMessage" class="text-red-500 text-xs">
                            {{ file.error }}
                          </div>
                          <button 
                            @click.prevent="showErrorDetails(file)"
                            class="mt-1 text-blue-600 hover:text-blue-800 underline text-xs cursor-pointer"
                          >
                            View suggestions →
                          </button>
                        </div>
                    </div>

                    <!-- Info Section -->
                    <div class="flex items-center gap-4 mb-4">
                        <span class="text-sm text-gray-600">{{ file.sizeFormatted }}</span>
                        <span v-if="getSheetsByFileId(file.id).length > 0" 
                              class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {{ getSheetsByFileId(file.id).length }} Sheet{{ getSheetsByFileId(file.id).length !== 1 ? 's' : '' }}
                        </span>
                    </div>

                    <!-- Action Button -->
                    <button 
                        v-if="file.status === 'completed' && getSheetsByFileId(file.id).length > 0"
                        @click="showTable(file.id)"
                        :disabled="state.loadingTableForFileId === file.id"
                        class="mt-auto w-full px-4 py-2 bg-primary-blue-100 text-white rounded-lg hover:bg-primary-blue-300 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                        <font-awesome 
                            :icon="state.loadingTableForFileId === file.id ? 'fas fa-spinner' : 'fas fa-table'" 
                            :class="{ 'fa-spin': state.loadingTableForFileId === file.id }" />
                        {{ state.loadingTableForFileId === file.id ? 'Loading...' : 'View Table' }}
                    </button>

                    <!-- Remove Button -->
                    <button 
                        @click="removeFile(file.id)"
                        class="absolute top-4 right-4 bg-white hover:bg-gray-100 w-5 h-5 flex items-center justify-center cursor-pointer transition-colors z-10 shadow-md"
                        v-tippy="{ content: 'Remove File', placement: 'top' }">
                        <font-awesome icon="fas fa-trash" class="text-lg text-red-500" />
                    </button>
                </div>
            </div>
            
            <!-- File processing status summary -->
            <div v-if="state.files && state.files.length" class="flex flex-col items-center mt-5">
                <div class="bg-white border border-gray-200 rounded-lg p-4 shadow-sm w-3/4 max-w-md">
                    <h4 class="text-sm font-semibold text-gray-700 mb-2">File Status</h4>
                    <div class="space-y-2">
                        <div class="flex justify-between text-sm">
                            <span class="text-gray-600">Total Files:</span>
                            <span class="font-medium">{{ state.files.length }}</span>
                        </div>
                        <div class="flex justify-between text-sm">
                            <span class="text-green-600">✓ Uploaded:</span>
                            <span class="font-medium">{{ state.files.filter(f => f.status === 'uploaded').length }}</span>
                        </div>
                        <div class="flex justify-between text-sm" v-if="state.files.filter(f => f.status === 'queued' || f.status === 'uploading').length > 0">
                            <span class="text-blue-600">↻ In Progress:</span>
                            <span class="font-medium">{{ state.files.filter(f => f.status === 'queued' || f.status === 'uploading').length }}</span>
                        </div>
                        <div class="flex justify-between text-sm">
                            <span class="text-green-600">Ready to Upload:</span>
                            <span class="font-medium">{{ state.files.filter(f => f.status === 'completed').length }}</span>
                        </div>
                        <div class="flex justify-between text-sm" v-if="hasProcessingFiles">
                            <span class="text-blue-600">Processing:</span>
                            <span class="font-medium">{{ state.files.filter(f => f.status === 'processing').length }}</span>
                        </div>
                        <div class="flex justify-between text-sm" v-if="hasErrorFiles">
                            <span class="text-red-600">✗ Failed:</span>
                            <span class="font-medium">{{ state.files.filter(f => f.status === 'error').length }}</span>
                        </div>
                    </div>
                    
                    <!-- Progress bar -->
                    <div class="mt-3">
                        <div class="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Upload Progress</span>
                            <span>{{ state.files.length > 0 ? Math.round((state.files.filter(f => f.status === 'uploaded').length / state.files.length) * 100) : 0 }}%</span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2">
                            <div 
                                class="bg-green-500 h-2 rounded-full transition-all duration-300 ease-out"
                                :style="{ width: state.files.length > 0 ? (state.files.filter(f => f.status === 'uploaded').length / state.files.length) * 100 + '%' : '0%' }"
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
                        @column-type-forced="handleColumnTypeForced"
                        @column-type-reset="handleColumnTypeReset"
                    />
                </div>
            </div>
            
            <spinner v-if="state.loading"/>
            <div v-else-if="!state.loading && state.files && state.files.length" class="flex flex-col gap-3 items-center mt-5 mb-5">
                <!-- Create Data Source Button -->
                <div class="h-10 text-center items-center self-center p-2 font-bold shadow-md select-none rounded-lg"
                     :class="{
                         'bg-primary-blue-100 hover:bg-primary-blue-200 cursor-pointer text-white': !buttonDisabled,
                         'bg-gray-300 cursor-not-allowed text-gray-500': buttonDisabled
                     }"
                     @click="handleCreateClick">
                    Create Data Source
                </div>
                
                <!-- View Data Sources Button - shown after uploads complete -->
                <div v-if="allSheetsUploaded && hasUploadedFiles" 
                     class="h-10 text-center items-center self-center p-2 px-6 font-bold shadow-md select-none rounded-lg bg-green-600 hover:bg-green-700 cursor-pointer text-white"
                     @click="goToDataSources">
                    <font-awesome icon="fas fa-check-circle" class="mr-2" />
                    View Data Sources
                </div>
                
                <!-- Upload Progress Indicator -->
                <div v-if="hasProcessingFiles" class="text-sm text-blue-600 flex items-center gap-2">
                    <font-awesome icon="fas fa-spinner" class="fa-spin" />
                    <span>Uploads in progress...</span>
                </div>
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