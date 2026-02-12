/**
 * Interface for chunked Excel data upload
 * Used when uploading large Excel files in multiple chunks to avoid payload size limits
 */
export interface IExcelChunkUpload {
    chunk_number: number;
    total_chunks: number;
    file_id: string;
    data_source_name: string;
    project_id: number;
    data_source_id?: number;
    sheet_info: {
        sheet_id: string;
        sheet_name: string;
        file_name: string;
        original_sheet_name: string;
        sheet_index: number;
    };
    columns?: Array<{
        title: string;
        key: string;
        type: string;
        column_name: string;
    }>;
    rows: any[];
}

/**
 * Response for chunked upload progress
 */
export interface IExcelChunkUploadResponse {
    status: 'pending' | 'completed' | 'error';
    chunk_number: number;
    total_chunks: number;
    chunks_received: number;
    message?: string;
    data_source_id?: number;
    error?: string;
}
