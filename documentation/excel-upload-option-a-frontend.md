# Frontend Excel Upload - Option A Implementation

## Changes Made

### Overview
Converted the Excel upload page from **client-side parsing + JSON upload** to **raw file upload with server-side processing**.

---

## File: `frontend/pages/projects/[projectid]/data-sources/connect/excel.vue`

### What Changed

#### 1. **Removed Dependencies**
- ❌ Removed `import * as XLSX from 'xlsx'` - no longer parsing client-side

#### 2. **Simplified State**
```diff
const state = reactive({
    data_source_name: '',
-   files: [],  // Complex parsed data
+   files: [],  // Raw File objects
-   sheets: [],
-   activeSheetId: null,
-   show_table_dialog: false,
-   selected_file: null,
    loading: false,
+   upload_progress: 0,
+   current_upload_file: '',
});
```

#### 3. **Simplified File Handling**
**Before:** Parse entire Excel file, extract sheets/rows/columns
```javascript
async function parseFile(file) {
  // 150+ lines of parsing logic
  const workbook = XLSX.read(data);
  // Column type inference
  // Row data transformation
  // Sheet management
}
```

**After:** Just validate and store raw file
```javascript
async function handleFiles(files) {
  for (const file of files) {
    if (isValidFile(file)) {
      const fileEntry = {
        id: `file_${Date.now()}`,
        name: file.name,
        size: file.size,
        sizeFormatted: formatFileSize(file.size),
        status: 'pending',
        raw: file, // Store raw File object
      };
      state.files.push(fileEntry);
    }
  }
}
```

#### 4. **New Upload Method**
**Before:** Send parsed JSON data
```javascript
await $fetch(`${baseUrl()}/data-source/add-excel-data-source`, {
  method: 'POST',
  body: {
    data: { columns: [...], rows: [...] },  // Large JSON payload
    file_id: file.id,
    data_source_name,
    project_id
  }
});
```

**After:** Upload raw file with FormData
```javascript
const formData = new FormData();
formData.append('file', file.raw);
formData.append('data_source_name', state.data_source_name);
formData.append('project_id', route.params.projectid);

const response = await $fetch(`${config.public.apiBase}/data-source/upload-excel-file`, {
  method: 'POST',
  body: formData,
  headers: {
    'Authorization': `Bearer ${token}`,
    'Authorization-Type': 'auth',
  },
  credentials: 'include'
});
```

#### 5. **Removed Features**
- ❌ Client-side data table preview
- ❌ Sheet editing (cell update, row/column add/remove)
- ❌ Column type inference
- ❌ Column renaming
- ❌ Multi-sheet management UI

These features are no longer needed since the server:
- Parses files automatically
- Infers column types
- Creates tables for all sheets
- Handles all data processing

#### 6. **New Features**
- ✅ Upload progress indicator
- ✅ File-by-file upload status
- ✅ Better error handling
- ✅ Support for multiple files in single data source

---

## New UI Flow

### Step 1: Select Files
User drops or selects Excel/CSV files → Files stored without parsing

### Step 2: View File List
- File name
- File size (formatted: KB, MB, GB)
- Status: `pending` → `uploading` → `completed`/`failed`

### Step 3: Upload
Click "Upload and Create Data Source" button → Files uploaded one by one with progress bar

### Step 4: Success
Redirect to project page with success message showing:
- Number of files uploaded
- Total sheets processed

---

## API Contract

### Endpoint
```
POST /data-source/upload-excel-file
```

### Request (FormData)
```javascript
{
  file: File,                      // Raw Excel/CSV file
  data_source_name: string,        // Data source name
  project_id: number,              // Project ID
  data_source_id?: number          // Optional: append to existing data source
}
```

### Response
```javascript
{
  message: "Excel file uploaded and processed successfully.",
  result: {
    status: "success",
    file_id: string,
    data_source_id: number,
    sheets_processed: [
      {
        sheet_id: string,
        sheet_name: string,
        table_name: string,
        original_sheet_name: string,
        sheet_index: number
      }
    ]
  },
  sheets_count: number
}
```

---

## Benefits

### Performance
- ✅ No client-side memory bloat from parsing large files
- ✅ Faster initial file selection (no parsing delay)
- ✅ Single network request per file (vs. one per sheet)

### User Experience
- ✅ Simpler UI - less overwhelming
- ✅ Clear progress indication
- ✅ Can upload huge files (500MB+)
- ✅ No browser crashes from memory issues

### Maintainability
- ✅ Reduced frontend code (~300 lines removed)
- ✅ Single source of truth for parsing logic (backend)
- ✅ Easier to fix bugs (server-side only)

---

## Migration Notes

### For Users
**No changes needed!** The UI looks similar, just simpler.

### For Developers
If you need to revert or support both methods:

1. **Old route still works:** `/data-source/add-excel-data-source` (with body-parser fix)
2. **New route:** `/data-source/upload-excel-file` (recommended)

To keep both:
- Add a toggle in UI for "advanced mode" (client-side preview)
- Use new route by default, fall back to old route if needed

---

## Testing Checklist

- [ ] Upload small file (< 1MB) - should be instant
- [ ] Upload medium file (10-50MB) - should complete in < 30s
- [ ] Upload large file (100MB+) - should complete without timeout
- [ ] Upload multiple files - all should process sequentially
- [ ] Upload invalid file - should show error
- [ ] Upload with missing data source name - should show validation error
- [ ] Check progress bar updates correctly
- [ ] Verify all sheets created in database
- [ ] Check backend logs for batch processing messages

---

## Troubleshooting

### Issue: Upload fails with 413 error
**Solution:** Body parser limit issue - ensure backend restart applied the fix

### Issue: Timeout on large files
**Solution:** Increase timeout in `index.ts` (currently 10 min)

### Issue: Files not showing after upload
**Solution:** Check browser console for CORS errors, verify `apiBase` configuration

### Issue: Progress bar stuck at 0%
**Solution:** Check if `state.upload_progress` is being updated in loop

---

## Related Files

**Backend:**
- [index.ts](../../backend/src/index.ts) - Body parser config
- [data_source.ts](../../backend/src/routes/data_source.ts) - Upload route
- [ExcelFileService.ts](../../backend/src/services/ExcelFileService.ts) - Server-side parsing
- [DataSourceProcessor.ts](../../backend/src/processors/DataSourceProcessor.ts) - File processing

**Frontend:**
- [excel.vue](../pages/projects/[projectid]/data-sources/connect/excel.vue) - Upload page

**Documentation:**
- [large-excel-upload-implementation.md](../../documentation/large-excel-upload-implementation.md) - Full implementation guide

---

## Metrics to Track

Monitor these after deployment:

1. **Upload Success Rate:** Target > 95%
2. **Average Upload Time:** Target < 30s for 50MB files
3. **Error Types:** Track 413, timeout, validation errors
4. **File Sizes:** Distribution of uploaded file sizes
5. **Concurrent Uploads:** Monitor server load during uploads

---

## Future Enhancements

### Phase 2 (Optional)
1. **Chunked Upload:** For extreme files (1GB+)
2. **Resume Failed Uploads:** Store temporary state
3. **Background Upload:** Continue upload while user navigates away
4. **Drag-and-drop Preview:** Show file name before adding
5. **Duplicate Detection:** Warn if file already uploaded

See [IExcelChunkUpload.ts](../../backend/src/types/IExcelChunkUpload.ts) for chunked upload types.
