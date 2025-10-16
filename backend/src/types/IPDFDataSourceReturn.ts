export interface IPDFDataSourceReturn {
    status: string;
    file_id: string;
    data_source_id?: number;
    sheets_processed?: number;
    sheet_details?: Array<{
        sheet_id: string;
        sheet_name: string;
        table_name: string;
        page_number: number;
    }>;
}