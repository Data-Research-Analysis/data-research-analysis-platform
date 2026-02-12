# Excel Preview Workflow - Quick Testing Guide

## Quick Start
1. Navigate to project data sources
2. Click "Connect Excel Data Source"
3. Drop/upload .xlsx, .xls, or .csv files
4. Wait for processing (green check icon)
5. Click file card to preview/edit data
6. Click "Create Data Source" when ready

## Test Scenarios

### ✅ Basic Upload
```
1. Upload single-sheet Excel file
2. Verify file shows spinner → check icon
3. Verify sheet count displays
4. Click card to open preview
5. Verify data displays in table
6. Click "Create Data Source"
7. Verify redirect to project page
```

### ✅ Multi-Sheet Excel
```
1. Upload Excel file with 3+ sheets
2. Open preview dialog
3. Verify all sheets in tab navigation
4. Switch between sheets
5. Verify data displays correctly for each
6. Create data source
7. Verify all sheets saved
```

### ✅ Multiple Files
```
1. Upload 3 files simultaneously
2. Verify all show processing status
3. Wait for all completions
4. Verify "Create Data Source" button disabled until all complete
5. Preview each file individually
6. Create data source
7. Verify all files combined into one data source
```

### ✅ Data Editing
```
1. Upload file and open preview
2. Edit cell value → verify change
3. Add new row → verify appears
4. Remove row → verify disappears
5. Add column → verify in all rows
6. Remove column → verify removed from all rows
7. Rename column → verify title and data key updated
8. Create data source → verify edited data saved
```

### ✅ CSV Files
```
1. Upload .csv file
2. Verify parses as single sheet
3. Verify column types detected correctly
4. Edit and create data source
```

### ✅ Error Handling
```
1. Upload invalid file type (.pdf) → verify error message
2. Upload corrupted Excel file → verify error status on card
3. Remove failed file → verify removal
4. Network timeout → verify error status
```

### ✅ Sheet Operations
```
1. Upload multi-sheet file
2. Open preview
3. Rename sheet → verify name updates
4. Delete sheet → verify removal
5. Verify remaining sheets still accessible
6. Create data source with remaining sheets
```

### ✅ Column Type Detection
**Number Column:**
- Upload Excel with numeric data (1, 2.5, 100)
- Verify column type = 'number'
- Verify proper alignment in table

**Date Column:**
- Upload Excel with dates (2025-01-15, 01/15/2025)
- Verify column type = 'date'
- Verify date formatting

**Boolean Column:**
- Upload Excel with true/false, yes/no, 1/0
- Verify column type = 'boolean'
- Verify proper rendering

**Email Column:**
- Upload Excel with emails (test@example.com)
- Verify column type = 'email'
- Verify proper width (200px+)

**URL Column:**
- Upload Excel with URLs (https://example.com)
- Verify column type = 'url'
- Verify proper width (250px+)

**Text Column (default):**
- Mixed/text data defaults to 'text' type
- Verify renders as text

### ✅ Large File
```
1. Upload large Excel file (50-100 MB)
2. Verify processing completes (may be slow)
3. Verify all rows parsed
4. Preview first/last rows
5. Create data source
```

### ✅ UI States

**File Status Icons:**
- ⏱️ Gray clock = Pending
- 🔄 Blue spinner = Processing
- ✅ Green check = Completed
- ❌ Red X = Error

**Button States:**
- Disabled (gray) = Files processing or errors
- Enabled (blue) = Ready to create
- Hover = Color change

**Status Messages:**
- "Processing files..." = In progress
- "Ready to create data source" = All good
- "Some files failed to process" = Errors exist
- "Please wait..." = Not ready yet

## Expected Behavior

### File Upload
- Drag/drop or click to select
- Multiple files supported
- Immediate feedback (status icons)
- No page reload

### Preview Dialog
- Opens automatically for first file
- Click file card to open for others
- Full-screen overlay
- Scrollable table
- Close button (X) in header

### Data Table
- Editable cells (double-click)
- Column sorting
- Row selection
- Add/remove rows (if component supports)
- Add/remove columns (if component supports)
- Sheet tabs for multi-sheet files

### Data Source Creation
- Loops through all sheets
- Shows loading spinner
- Success message with sheet count
- Redirects to project page
- New data source appears in list

## Common Issues

### "No file uploaded" Error
- Ensure file input has `name="file"`
- Verify FormData append: `formData.append('file', file)`

### "Failed to parse Excel file"
- Check file is valid Excel format
- Check file not corrupted
- Check file size under 500MB

### Type Detection Incorrect
- Algorithm uses 80% confidence threshold
- Mixed-type columns default to 'text'
- Manual type override in table (if supported)

### Button Disabled
- Check all files status = 'completed'
- Check for error files
- Check state.loading = false
- Check state.sheets.length > 0

### Preview Not Showing
- Verify state.show_table_dialog = true
- Verify state.sheets populated
- Verify state.activeSheetId set
- Check browser console for errors

## API Endpoints

### Preview Endpoint
```
POST /data-source/upload-excel-preview
Authorization: Bearer <token>
Content-Type: multipart/form-data

Body:
- file: (binary)

Response:
{
  "url": "/path/to/file.xlsx",
  "file_name": "file_12345.xlsx",
  "sheets": [...],
  "sheets_count": 2,
  "success": true
}
```

### Create Endpoint
```
POST /data-source/add-excel-data-source
Authorization: Bearer <token>
Content-Type: application/json

Body:
{
  "file_id": "file_12345",
  "data": {
    "columns": [...],
    "rows": [...]
  },
  "data_source_name": "my_data_source",
  "project_id": 1,
  "data_source_id": null,
  "sheet_info": {
    "sheet_id": "file_12345_sheet_0",
    "sheet_name": "Sheet1 - file.xlsx",
    "file_name": "file.xlsx",
    "original_sheet_name": "Sheet1",
    "sheet_index": 0
  }
}

Response:
{
  "message": "Excel data source created successfully.",
  "result": {
    "status": "success",
    "data_source_id": 123
  }
}
```

## Browser Console Logs

### Successful Flow
```
Added file: mydata.xlsx (1.2 MB)
Parsed 2 sheets from mydata.xlsx
Set active sheet to: Sheet1 - mydata.xlsx
Sheet Sheet1 - mydata.xlsx uploaded successfully
Sheet Sheet2 - mydata.xlsx uploaded successfully
```

### Error Flow
```
Error processing file: corrupt.xlsx Error: Failed to parse
Failed to parse Excel file: Invalid file format
```

## Performance Expectations

### Small Files (<5 MB)
- Upload: 1-2 seconds
- Parsing: < 1 second
- Preview: Instant

### Medium Files (5-50 MB)
- Upload: 2-10 seconds
- Parsing: 1-5 seconds
- Preview: < 1 second

### Large Files (50-500 MB)
- Upload: 10-60 seconds
- Parsing: 5-30 seconds
- Preview: 1-3 seconds (initial render)

## Success Criteria
✅ All files process without errors  
✅ All sheets display in preview  
✅ Column types detected accurately  
✅ Edits persist through workflow  
✅ Data source created successfully  
✅ Multi-file upload works  
✅ Error states handled gracefully  
✅ UI responsive and intuitive  

## Next Steps After Testing
1. Fix any discovered bugs
2. Optimize type detection algorithm
3. Add progress indicators for large files
4. Consider async processing (Socket.IO)
5. Add data validation rules
6. Implement column mapping feature
7. Add unit tests for type detection
8. Add E2E tests for full workflow

## Support
- Check browser console for errors
- Check backend logs for parsing errors
- Verify file formats supported
- Test with different Excel versions
- Try different browsers (Chrome, Firefox, Safari)
