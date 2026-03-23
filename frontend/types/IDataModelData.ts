/**
 * Paginated data response from data model endpoint
 */
export interface IDataModelData {
    data: any[]; // The actual row data
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrevious: boolean;
    };
    fetchedAt?: Date; // Timestamp for cache invalidation
}

/**
 * Column metadata for table rendering
 */
export interface ITableColumn {
    name: string;
    type?: string;
    sortable?: boolean;
}
