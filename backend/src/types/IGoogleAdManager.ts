/**
 * Google Ad Manager Type Definitions
 */

/**
 * GAM Network represents a publisher's Ad Manager account
 */
export interface IGAMNetwork {
    networkCode: string;
    networkId: string;
    displayName: string;
    timeZone?: string;
    currencyCode?: string;
}

/**
 * GAM Report Query Configuration
 */
export interface IGAMReportQuery {
    dimensions: string[];
    metrics: string[];
    startDate: string;
    endDate: string;
    networkCode: string;
    filters?: IGAMReportFilter[];
}

/**
 * GAM Report Filter
 */
export interface IGAMReportFilter {
    dimension: string;
    operator: 'EQUALS' | 'NOT_EQUALS' | 'CONTAINS' | 'IN';
    values: string[];
}

/**
 * GAM Report Response
 */
export interface IGAMReportResponse {
    reportId: string;
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
    downloadUrl?: string;
    rows?: IGAMReportRow[];
}

/**
 * GAM Report Row
 */
export interface IGAMReportRow {
    dimensions: { [key: string]: string | number };
    metrics: { [key: string]: number };
}

/**
 * GAM Revenue Data (synced to PostgreSQL)
 */
export interface IGAMRevenueData {
    date: Date;
    ad_unit_id: string;
    ad_unit_name: string;
    country_code: string;
    country_name: string;
    impressions: number;
    clicks: number;
    revenue: number;
    cpm: number;
    ctr: number;
    fill_rate: number;
    network_code: string;
}

/**
 * GAM Inventory Data
 */
export interface IGAMInventoryData {
    date: Date;
    ad_unit_id: string;
    ad_unit_name: string;
    device_category: string;
    ad_requests: number;
    matched_requests: number;
    impressions: number;
    fill_rate: number;
    network_code: string;
}

/**
 * GAM Order Data
 */
export interface IGAMOrderData {
    date: Date;
    order_id: string;
    order_name: string;
    line_item_id: string;
    line_item_name: string;
    advertiser_id: string;
    advertiser_name: string;
    impressions: number;
    clicks: number;
    revenue: number;
    delivery_status: string;
    network_code: string;
}

/**
 * GAM Geography Data
 */
export interface IGAMGeographyData {
    date: Date;
    country_code: string;
    country_name: string;
    region?: string;
    city?: string;
    impressions: number;
    clicks: number;
    revenue: number;
    network_code: string;
}

/**
 * GAM Device Data
 */
export interface IGAMDeviceData {
    date: Date;
    device_category: string;
    browser_name: string;
    operating_system: string;
    impressions: number;
    clicks: number;
    revenue: number;
    network_code: string;
}

/**
 * Report Type Enum
 */
export enum GAMReportType {
    REVENUE = 'revenue',
    INVENTORY = 'inventory',
    ORDERS = 'orders',
    GEOGRAPHY = 'geography',
    DEVICE = 'device',
}
