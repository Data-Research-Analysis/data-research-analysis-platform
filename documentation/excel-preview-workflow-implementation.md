# Excel Preview Workflow Implementation

## Overview
The Excel data source has been fully reimplemented to match the PDF upload workflow, providing a preview-and-edit experience before creating the data source.

## Implementation Date
January 2025

## Workflow Comparison

### Previous Flow (Direct Upload)
1. User selects Excel files
2. Files immediately uploaded and data source created
3. No preview or editing capability

### New Flow (Preview & Edit - Matches PDF)
1. User selects Excel files
2. Files uploaded to `/upload-excel-preview` endpoint
3. Server parses Excel and returns sheet data
4. Frontend displays data in interactive table (`custom-data-table`)
5. User can preview, edit, add/remove rows/columns
6. User clicks "Create Data Source" to finalize
7. Data source created with edited data

## Backend Changes

### New Route: `/upload-excel-preview`
**File:** `backend/src/routes/data_source.ts`

```typescript
router.post('/upload-excel-preview', expensiveOperationsLimiter, 
  validateJWT, 
  excelUpload.single('file'), 
  async (req: IMulterRequest, res: Response) => {
    // Parse Excel file
    const parseResult = await ExcelFileService.getInstance().parseExcelFileFromPath(file.path);
    
    // Return formatted sheets without creating data source
    res.status(200).json({
      url: file.path,
      file_name: file.filename,
      sheets: formattedSheets,
      sheets_count: formattedSheets.length,
      success: true
    });
  }
);
```

**Response Format:**
```json
{
  "url": "/path/to/uploaded/file.xlsx",
  "file_name": "file_12345.xlsx",
  "file_size": 102400,
  "original_name": "my-data.xlsx",
  "sheets": [
    {
      "sheet_id": "sheet_0",
      "sheet_name": "Sheet1 - my-data.xlsx",
      "original_sheet_name": "Sheet1",
      "sheet_index": 0,
      "columns": [
        { "title": "Column A", "key": "column_a", "type": "text" }
      ],
      "rows": [
        { "column_a": "Value 1" }
      ],
      "metadata": {
        "rowCount": 100,
        "columnCount": 5
      }
    }
  ],
  "sheets_count": 1,
  "success": true
}
```

### Existing Route (Unchanged): `/add-excel-data-source`
Used for final data source creation after user edits/confirms data

## Frontend Changes

### File: `frontend/pages/projects/[projectid]/data-sources/connect/excel.vue`

#### 1. State Management
```typescript
const state = reactive({
    data_source_name: '',
    files: [],
    show_table_dialog: false,
    sheets: [],              // NEW: Unified collection of all sheets
    activeSheetId: null,     // NEW: Current active sheet
    selected_file: null,     // NEW: File being previewed
    loading: false,
    upload_id: 0,
});
```

#### 2. Sheet Management Functions
- `createSheetFromWorksheet()` - Creates sheet objects from parsed Excel data
- `addSheetToCollection()` - Adds sheets to state with deduplication
- `removeSheetsByFileId()` - Removes all sheets for a file
- `getSheetsByFileId()` - Gets sheets belonging to a file

#### 3. File Upload Flow
```typescript
async function handleFiles(files) {
  for (const file of files) {
    // 1. Add file to state with 'processing' status
    const fileEntry = { id, name, size, status: 'processing', ... };
    state.files.push(fileEntry);
    
    // 2. Upload to /upload-excel-preview
    const formData = new FormData();
    formData.append('file', file);
    const response = await $fetch(`${config.public.apiBase}/data-source/upload-excel-preview`, {
      method: 'POST',
      body: formData,
      headers: { Authorization, ... }
    });
    
    // 3. Create sheet objects from response
    for (const sheetData of response.sheets) {
      const sheet = createSheetFromWorksheet(fileEntry, sheetData, ...);
      sheet.columns = analyzeColumns(sheet.rows, sheet.columns);
      addSheetToCollection(sheet);
    }
    
    // 4. Update file status and show preview
    fileEntry.status = 'completed';
    showTable(fileEntry.id);
  }
}
```

#### 4. Type Detection & Column Analysis
Added comprehensive type inference from PDF implementation:

```typescript
// Type detection functions
- isBooleanType() - Detects boolean columns (true/false/yes/no/1/0)
- isNumberType() - Detects numeric columns
- isDateType() - Detects date columns
- isEmailType() - Detects email columns
- isUrlType() - Detects URL columns
- inferColumnType() - Determines column type with 80% confidence threshold

// Column analysis
- analyzeColumns() - Analyzes all columns to infer type and calculate width
- calculateColumnWidth() - Calculates optimal column width based on content
```

#### 5. Sheet Editing Handlers
Full CRUD operations on sheets:

```typescript
- handleCellUpdate(sheetId, rowIndex, columnKey, newValue)
- handleRowsRemoved(sheetId, rowIndices)
- handleColumnRemoved(sheetId, columnKey)
- handleRowAdded(sheetId, newRowData)
- handleColumnAdded(sheetId, columnDef)
- handleColumnRenamed(sheetId, oldKey, newKey, newTitle)
- handleSheetChanged(newSheetId) - Switch active sheet
- handleSheetDeleted(sheetId) - Remove sheet
- handleSheetRenamed(sheetId, newName) - Rename sheet
```

#### 6. UI Updates

**File Cards:**
- Show processing status icons (spinner/check/error)
- Display sheet count on completion
- Click completed files to view/edit data

**Table Preview Dialog:**
- Uses `custom-data-table` component (same as PDF)
- Full editing capabilities
- Multi-sheet support with tab navigation

**Create Button:**
- Disabled until all files processed
- Status text shows progress/errors
- Only activates when ready

### Template Structure
```vue
<template>
  <!-- File Upload Zone -->
  <div id="drop-zone">Drop files or click to upload</div>
  
  <!-- File Cards with status -->
  <div v-for="file in state.files">
    <notched-card @click="showTable(file.id)">
      <!-- Status icons, file info, sheet count -->
    </notched-card>
  </div>
  
  <!-- Create Data Source Button -->
  <div @click="createDataSource" :class="{ disabled: buttonDisabled }">
    Create Data Source
  </div>
  
  <!-- Preview Dialog -->
  <overlay-dialog :show="state.show_table_dialog">
    <custom-data-table
      :sheets="state.sheets"
      :active-sheet-id="state.activeSheetId"
      @cell-updated="handleCellUpdate"
      @rows-removed="handleRowsRemoved"
      @column-removed="handleColumnRemoved"
      <!-- ...all other editing events -->
    />
  </overlay-dialog>
</template>
```

## User Experience

### Step-by-Step Flow
1. **Upload**: User drops/selects one or more Excel files (.xlsx, .xls, .csv)
2. **Processing**: Files show spinner icon while parsing on server
3. **Completion**: Green check icon appears, sheet count displayed
4. **Preview**: Click file card to view/edit data in table dialog
5. **Edit**: 
   - Edit cell values directly
   - Add/remove rows and columns
   - Rename columns
   - Switch between sheets (multi-sheet support)
   - Delete sheets
6. **Create**: Click "Create Data Source" button to finalize
7. **Redirect**: Navigate to project page with new data source

### Status Messages
- "Processing files..." - Parsing in progress
- "Ready to create data source" - All files processed successfully
- "Some files failed to process" - Errors occurred
- "Please wait for all Excel files to finish processing" - Don't rush!

## Technical Details

### File Validation
```typescript
const validExtensions = ['.xlsx', '.xls', '.csv']
const validTypes = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv'
]
```

### Sheet Data Structure
```typescript
interface Sheet {
  id: string;                    // "fileId_sheet_index"
  name: string;                  // "Sheet1 - filename.xlsx"
  fileName: string;
  fileId: string;
  sheetName: string;             // Original sheet name
  sheetIndex: number;
  columns: Array<{
    title: string;
    key: string;
    type: string;                // text|number|date|boolean|email|url
    width: number;
    sortable: boolean;
    editable: boolean;
  }>;
  rows: Array<{
    id: string;
    index: number;
    selected: boolean;
    data: Record<string, any>;
  }>;
  metadata: {
    created: Date;
    modified: Date;
    rowCount: number;
    columnCount: number;
    excelFileId: string;
    originalSheetName: string;
  };
}
```

### Data Source Creation
When user clicks "Create Data Source":

1. Loop through all sheets in `state.sheets`
2. For each sheet, send to `/add-excel-data-source`:
   ```typescript
   {
     file_id: file.id,
     data: {
       columns: [...],
       rows: [...]
     },
     data_source_name: '...',
     project_id: '...',
     data_source_id: existingId || null,  // Append to same data source
     sheet_info: {
       sheet_id, sheet_name, file_name, original_sheet_name, sheet_index
     }
   }
   ```
3. First sheet creates data source, subsequent sheets append
4. Success message shows total sheets created
5. Navigate to project page

## Benefits

### For Users
- **Preview Before Commit**: See data before creating data source
- **Edit Capability**: Fix issues, remove bad rows, rename columns
- **Multi-File Support**: Upload multiple Excel files at once
- **Multi-Sheet Support**: All sheets in Excel file are preserved
- **Consistent UX**: Matches familiar PDF upload workflow
- **Error Recovery**: Failed files can be removed without affecting others

### For Developers
- **Separation of Concerns**: Parse endpoint separate from create endpoint
- **Reusable Components**: Uses existing `custom-data-table` component
- **Type Safety**: Comprehensive type detection with 80% confidence
- **Maintainability**: Matches established PDF pattern
- **Testability**: Preview endpoint can be tested independently

## Testing Recommendations

### Manual Testing
1. Upload single-sheet Excel file (.xlsx)
2. Upload multi-sheet Excel file
3. Upload CSV file
4. Upload multiple files simultaneously
5. Edit cells, add/remove rows/columns
6. Switch between sheets
7. Remove files before creating data source
8. Create data source and verify data

### Edge Cases
- Empty sheets
- Very large files (approaching 500MB limit)
- Invalid file types
- Network errors during upload
- Column type edge cases (mixed types in column)

## Performance Notes

- **Rate Limiting**: `/upload-excel-preview` uses `expensiveOperationsLimiter` (30 req/15min)
- **File Size**: Maximum 500MB per file (multer config)
- **Body Parser**: 1000MB limit for JSON payloads
- **Parsing**: Synchronous on server (unlike PDF's async Socket.IO)
- **Type Inference**: Processes all rows to determine column types (may be slow for very large sheets)

## Migration Notes

### Backward Compatibility
- Original `/add-excel-data-source` route **unchanged**
- Direct upload route `/upload-excel-file` **still exists** (not used by UI)
- No database migrations required
- Existing data sources unaffected

### Future Improvements
1. **Async Processing**: Add Socket.IO for large file processing (like PDF)
2. **Progress Bars**: Show row-by-row parsing progress
3. **Sampling**: Only analyze first 1000 rows for type inference
4. **Chunked Upload**: Implement chunked upload for files >500MB
5. **Client-Side Parsing**: Parse Excel in browser to reduce server load
6. **Column Mapping**: Auto-map columns to existing data models
7. **Data Validation**: Add validation rules before creating data source

## Related Files

### Backend
- `backend/src/routes/data_source.ts` - Routes
- `backend/src/services/ExcelFileService.ts` - Excel parsing
- `backend/src/processors/DataSourceProcessor.ts` - Data source creation
- `backend/src/middleware/rateLimit.ts` - Rate limiting

### Frontend
- `frontend/pages/projects/[projectid]/data-sources/connect/excel.vue` - Main component
- `frontend/components/custom-data-table.vue` - Table component
- `frontend/pages/projects/[projectid]/data-sources/connect/pdf.vue` - Reference implementation

### Documentation
- `documentation/excel-upload-implementation.md` - Original implementation
- `documentation/excel-file-upload-api.md` - API documentation
- `documentation/PayloadTooLargeError-fix.md` - Body parser fix

## Conclusion

The Excel upload flow now provides a professional preview-and-edit experience matching the PDF workflow. Users can review and modify their data before committing to a data source, improving data quality and user confidence.

**Status:** ✅ Complete - Ready for testing
**Errors:** None
**Next Steps:** Manual testing and user feedback
