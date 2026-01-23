/**
 * Mock metadata for testing cross-source data models
 */

import { MockMetadataRecord, MockDataSourceRecord } from './mockManager.js';

// ============================================================================
// MySQL Mock Data
// ============================================================================

export const mockMySQLMetadata: MockMetadataRecord[] = [
    {
        physical_table_name: 'orders_abc123_22',
        schema_name: 'dra_mysql_22',
        data_source_id: 22,
        logical_table_name: 'Orders',
        table_type: 'mysql'
    },
    {
        physical_table_name: 'products_def456_22',
        schema_name: 'dra_mysql_22',
        data_source_id: 22,
        logical_table_name: 'Products',
        table_type: 'mysql'
    },
    {
        physical_table_name: 'order_items_ghi789_22',
        schema_name: 'dra_mysql_22',
        data_source_id: 22,
        logical_table_name: 'Order Items',
        table_type: 'mysql'
    }
];

export const mockMySQLDataSource: MockDataSourceRecord = {
    id: 22,
    data_type: 'mysql',
    connection_details: {
        data_source_type: 'mysql',
        host: 'localhost',
        port: 3306,
        database: 'mysql_dra_db',
        schema: 'mysql_dra_db',
        username: 'test',
        password: 'test'
    }
};

// ============================================================================
// MariaDB Mock Data
// ============================================================================

export const mockMariaDBMetadata: MockMetadataRecord[] = [
    {
        physical_table_name: 'customers_jkl012_23',
        schema_name: 'dra_mariadb_23',
        data_source_id: 23,
        logical_table_name: 'Customers',
        table_type: 'mariadb'
    },
    {
        physical_table_name: 'invoices_mno345_23',
        schema_name: 'dra_mariadb_23',
        data_source_id: 23,
        logical_table_name: 'Invoices',
        table_type: 'mariadb'
    }
];

export const mockMariaDBDataSource: MockDataSourceRecord = {
    id: 23,
    data_type: 'mariadb',
    connection_details: {
        data_source_type: 'mariadb',
        host: 'localhost',
        port: 3306,
        database: 'mariadb_db',
        schema: 'mariadb_schema',
        username: 'test',
        password: 'test'
    }
};

// ============================================================================
// PostgreSQL Mock Data
// ============================================================================

export const mockPostgreSQLMetadata: MockMetadataRecord[] = [
    {
        physical_table_name: 'users_pqr678_15',
        schema_name: 'dra_postgresql_15',
        data_source_id: 15,
        logical_table_name: 'Users',
        table_type: 'postgresql'
    },
    {
        physical_table_name: 'events_stu901_15',
        schema_name: 'dra_postgresql_15',
        data_source_id: 15,
        logical_table_name: 'Events',
        table_type: 'postgresql'
    }
];

export const mockPostgreSQLDataSource: MockDataSourceRecord = {
    id: 15,
    data_type: 'postgresql',
    connection_details: {
        data_source_type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'postgres',
        schema: 'public',
        username: 'test',
        password: 'test'
    }
};

// ============================================================================
// Excel Mock Data
// ============================================================================

export const mockExcelMetadata: MockMetadataRecord[] = [
    {
        physical_table_name: 'sales_data_source_10_1',
        schema_name: 'dra_excel',
        data_source_id: 10,
        logical_table_name: 'Sales Data',
        original_sheet_name: 'Sales',
        table_type: 'excel'
    },
    {
        physical_table_name: 'inventory_data_source_10_2',
        schema_name: 'dra_excel',
        data_source_id: 10,
        logical_table_name: 'Inventory',
        original_sheet_name: 'Inventory',
        table_type: 'excel'
    }
];

export const mockExcelDataSource: MockDataSourceRecord = {
    id: 10,
    data_type: 'excel',
    connection_details: {
        data_source_type: 'excel',
        schema: 'dra_excel',
        file_id: 'excel_file_123'
    }
};

// ============================================================================
// PDF Mock Data
// ============================================================================

export const mockPDFMetadata: MockMetadataRecord[] = [
    {
        physical_table_name: 'document_data_source_20',
        schema_name: 'dra_pdf',
        data_source_id: 20,
        logical_table_name: 'PDF Document',
        table_type: 'pdf'
    }
];

export const mockPDFDataSource: MockDataSourceRecord = {
    id: 20,
    data_type: 'pdf',
    connection_details: {
        data_source_type: 'pdf',
        schema: 'dra_pdf',
        file_id: 'pdf_file_456'
    }
};

// ============================================================================
// Google Analytics Mock Data
// ============================================================================

export const mockGAMetadata: MockMetadataRecord[] = [
    {
        physical_table_name: 'device_15',
        schema_name: 'dra_google_analytics',
        data_source_id: 15,
        logical_table_name: 'Device Report',
        table_type: 'google_analytics'
    },
    {
        physical_table_name: 'traffic_overview_15',
        schema_name: 'dra_google_analytics',
        data_source_id: 15,
        logical_table_name: 'Traffic Overview',
        table_type: 'google_analytics'
    },
    {
        physical_table_name: 'user_acquisition_15',
        schema_name: 'dra_google_analytics',
        data_source_id: 15,
        logical_table_name: 'User Acquisition',
        table_type: 'google_analytics'
    }
];

export const mockGADataSource: MockDataSourceRecord = {
    id: 15,
    data_type: 'google_analytics',
    connection_details: {
        data_source_type: 'google_analytics',
        schema: 'dra_google_analytics',
        property_id: 'GA_PROPERTY_123',
        oauth_access_token: 'mock_token'
    }
};

// ============================================================================
// Google Ad Manager Mock Data
// ============================================================================

export const mockGAMMetadata: MockMetadataRecord[] = [
    {
        physical_table_name: 'network_12345_7',
        schema_name: 'dra_google_ad_manager',
        data_source_id: 7,
        logical_table_name: 'Ad Manager Network',
        table_type: 'google_ad_manager'
    },
    {
        physical_table_name: 'revenue_12345_7',
        schema_name: 'dra_google_ad_manager',
        data_source_id: 7,
        logical_table_name: 'Revenue Report',
        table_type: 'google_ad_manager'
    }
];

export const mockGAMDataSource: MockDataSourceRecord = {
    id: 7,
    data_type: 'google_ad_manager',
    connection_details: {
        data_source_type: 'google_ad_manager',
        schema: 'dra_google_ad_manager',
        network_code: '12345',
        oauth_access_token: 'mock_token'
    }
};

// ============================================================================
// Google Ads Mock Data
// ============================================================================

export const mockGoogleAdsMetadata: MockMetadataRecord[] = [
    {
        physical_table_name: 'campaigns_8',
        schema_name: 'dra_google_ads',
        data_source_id: 8,
        logical_table_name: 'Campaigns',
        table_type: 'google_ads'
    },
    {
        physical_table_name: 'ad_groups_8',
        schema_name: 'dra_google_ads',
        data_source_id: 8,
        logical_table_name: 'Ad Groups',
        table_type: 'google_ads'
    }
];

export const mockGoogleAdsDataSource: MockDataSourceRecord = {
    id: 8,
    data_type: 'google_ads',
    connection_details: {
        data_source_type: 'google_ads',
        schema: 'dra_google_ads',
        customer_id: '1234567890',
        oauth_access_token: 'mock_token'
    }
};

// ============================================================================
// Combined Mock Data Sets
// ============================================================================

export const allMockMetadata: MockMetadataRecord[] = [
    ...mockMySQLMetadata,
    ...mockMariaDBMetadata,
    ...mockPostgreSQLMetadata,
    ...mockExcelMetadata,
    ...mockPDFMetadata,
    ...mockGAMetadata,
    ...mockGAMMetadata,
    ...mockGoogleAdsMetadata
];

export const allMockDataSources: MockDataSourceRecord[] = [
    mockMySQLDataSource,
    mockMariaDBDataSource,
    mockPostgreSQLDataSource,
    mockExcelDataSource,
    mockPDFDataSource,
    mockGADataSource,
    mockGAMDataSource,
    mockGoogleAdsDataSource
];
