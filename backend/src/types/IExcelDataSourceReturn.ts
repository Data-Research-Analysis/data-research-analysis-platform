export interface IExcelDataSourceReturn {
    status: string;
    file_id: string;
    data_source_id?: number;
    sheets_processed?: Array<{
        sheet_id: string;
        sheet_name: string;
        table_name: string;
        original_sheet_name: string;
        sheet_index: number;
    }>;
    error?: string;  // BUGFIX: Include error message for failed uploads
    errorDetails?: any;  // BUGFIX: Include structured error details (row, column, SQL error)
}