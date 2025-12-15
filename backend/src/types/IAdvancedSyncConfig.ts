/**
 * Advanced Sync Configuration Types
 * Extended configuration options for GAM sync operations
 */

export interface DateRangePreset {
    id: string;
    label: string;
    description: string;
    getDates: () => { startDate: string; endDate: string };
}

export interface ReportFieldConfig {
    reportType: string;
    dimensions: string[];
    metrics: string[];
}

export interface SyncFrequency {
    type: 'manual' | 'hourly' | 'daily' | 'weekly' | 'monthly';
    interval?: number; // For hourly (1-24), weekly (1-4), etc.
    dayOfWeek?: number; // 0-6 for weekly (0 = Sunday)
    dayOfMonth?: number; // 1-31 for monthly
    hour?: number; // 0-23 for daily/weekly/monthly
    minute?: number; // 0-59
}

export interface DimensionFilter {
    dimension: string;
    operator: 'equals' | 'notEquals' | 'contains' | 'notContains' | 'in' | 'notIn';
    values: string[];
}

export interface MetricFilter {
    metric: string;
    operator: 'greaterThan' | 'lessThan' | 'equals' | 'between';
    value: number;
    maxValue?: number; // For 'between' operator
}

export interface AdvancedSyncConfig {
    // Date range configuration
    dateRangePreset?: string; // 'last7days', 'last30days', 'last90days', 'custom'
    startDate?: string;
    endDate?: string;
    
    // Report configuration
    reportTypes: string[];
    reportFieldConfigs?: ReportFieldConfig[]; // Custom field selection per report
    
    // Filtering
    dimensionFilters?: DimensionFilter[];
    metricFilters?: MetricFilter[];
    
    // Sync frequency
    frequency?: SyncFrequency;
    
    // Network configuration
    networkCode: string;
    
    // Advanced options
    incrementalSync?: boolean; // Only sync new/changed data
    deduplication?: boolean; // Remove duplicates
    dataValidation?: boolean; // Validate data before storing
    maxRecordsPerReport?: number; // Limit records per report
    
    // Notifications
    notifyOnComplete?: boolean;
    notifyOnFailure?: boolean;
    notificationEmails?: string[];
}

/**
 * Date range preset definitions
 */
export const DATE_RANGE_PRESETS: DateRangePreset[] = [
    {
        id: 'today',
        label: 'Today',
        description: 'Current day',
        getDates: () => {
            const today = new Date();
            const dateStr = today.toISOString().split('T')[0];
            return { startDate: dateStr, endDate: dateStr };
        }
    },
    {
        id: 'yesterday',
        label: 'Yesterday',
        description: 'Previous day',
        getDates: () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const dateStr = yesterday.toISOString().split('T')[0];
            return { startDate: dateStr, endDate: dateStr };
        }
    },
    {
        id: 'last7days',
        label: 'Last 7 Days',
        description: 'Previous 7 days including today',
        getDates: () => {
            const end = new Date();
            const start = new Date();
            start.setDate(start.getDate() - 6);
            return {
                startDate: start.toISOString().split('T')[0],
                endDate: end.toISOString().split('T')[0]
            };
        }
    },
    {
        id: 'last30days',
        label: 'Last 30 Days',
        description: 'Previous 30 days including today',
        getDates: () => {
            const end = new Date();
            const start = new Date();
            start.setDate(start.getDate() - 29);
            return {
                startDate: start.toISOString().split('T')[0],
                endDate: end.toISOString().split('T')[0]
            };
        }
    },
    {
        id: 'last90days',
        label: 'Last 90 Days',
        description: 'Previous 90 days including today',
        getDates: () => {
            const end = new Date();
            const start = new Date();
            start.setDate(start.getDate() - 89);
            return {
                startDate: start.toISOString().split('T')[0],
                endDate: end.toISOString().split('T')[0]
            };
        }
    },
    {
        id: 'thisMonth',
        label: 'This Month',
        description: 'Current calendar month',
        getDates: () => {
            const now = new Date();
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            const end = new Date();
            return {
                startDate: start.toISOString().split('T')[0],
                endDate: end.toISOString().split('T')[0]
            };
        }
    },
    {
        id: 'lastMonth',
        label: 'Last Month',
        description: 'Previous calendar month',
        getDates: () => {
            const now = new Date();
            const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const end = new Date(now.getFullYear(), now.getMonth(), 0);
            return {
                startDate: start.toISOString().split('T')[0],
                endDate: end.toISOString().split('T')[0]
            };
        }
    },
    {
        id: 'thisQuarter',
        label: 'This Quarter',
        description: 'Current calendar quarter',
        getDates: () => {
            const now = new Date();
            const quarter = Math.floor(now.getMonth() / 3);
            const start = new Date(now.getFullYear(), quarter * 3, 1);
            const end = new Date();
            return {
                startDate: start.toISOString().split('T')[0],
                endDate: end.toISOString().split('T')[0]
            };
        }
    },
    {
        id: 'thisYear',
        label: 'This Year',
        description: 'Current calendar year',
        getDates: () => {
            const now = new Date();
            const start = new Date(now.getFullYear(), 0, 1);
            const end = new Date();
            return {
                startDate: start.toISOString().split('T')[0],
                endDate: end.toISOString().split('T')[0]
            };
        }
    },
    {
        id: 'custom',
        label: 'Custom Range',
        description: 'Specify custom start and end dates',
        getDates: () => {
            // Will be overridden with actual dates
            return { startDate: '', endDate: '' };
        }
    }
];

/**
 * Available dimensions by report type
 */
export const REPORT_DIMENSIONS: Record<string, string[]> = {
    revenue: [
        'Date',
        'Ad Unit',
        'Country',
        'Device Category',
        'Order',
        'Line Item',
        'Advertiser',
        'Creative Size'
    ],
    inventory: [
        'Date',
        'Ad Unit',
        'Device Category',
        'Country',
        'Browser',
        'Operating System'
    ],
    orders: [
        'Date',
        'Order',
        'Line Item',
        'Advertiser',
        'Order Status',
        'Line Item Type'
    ],
    geography: [
        'Date',
        'Country',
        'Region',
        'City',
        'Metro'
    ],
    device: [
        'Date',
        'Device Category',
        'Browser',
        'Operating System',
        'Mobile Device'
    ]
};

/**
 * Available metrics by report type
 */
export const REPORT_METRICS: Record<string, string[]> = {
    revenue: [
        'Impressions',
        'Clicks',
        'Revenue',
        'CPM',
        'CTR',
        'Fill Rate'
    ],
    inventory: [
        'Ad Requests',
        'Matched Requests',
        'Impressions',
        'Fill Rate',
        'Match Rate'
    ],
    orders: [
        'Impressions',
        'Clicks',
        'Revenue',
        'Delivery Progress',
        'Booked Revenue'
    ],
    geography: [
        'Impressions',
        'Clicks',
        'Revenue',
        'CPM',
        'CTR'
    ],
    device: [
        'Impressions',
        'Clicks',
        'Revenue',
        'CPM',
        'CTR'
    ]
};

/**
 * Validation for advanced sync configuration
 */
export class SyncConfigValidator {
    /**
     * Validate advanced sync configuration
     */
    static validate(config: AdvancedSyncConfig): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        
        const validReportTypes = ['revenue', 'inventory', 'orders', 'geography', 'device'];
        const validDimensionOperators = ['equals', 'notEquals', 'contains', 'notContains', 'in', 'notIn'];
        const validMetricOperators = ['greaterThan', 'lessThan', 'equals', 'between'];

        // Validate network code
        if (!config.networkCode) {
            errors.push('Network code is required');
        }

        // Validate report types
        if (!config.reportTypes || config.reportTypes.length === 0) {
            errors.push('At least one report type must be selected');
        } else {
            for (const reportType of config.reportTypes) {
                if (!validReportTypes.includes(reportType)) {
                    errors.push(`Invalid report type: ${reportType}`);
                }
            }
        }

        // Validate date range
        if (config.dateRangePreset === 'custom') {
            if (!config.startDate || !config.endDate) {
                errors.push('Start date and end date are required for custom date range');
            } else if (new Date(config.startDate) > new Date(config.endDate)) {
                errors.push('Start date must be before end date');
            }
        }

        // Validate report field configs
        if (config.reportFieldConfigs) {
            for (const fieldConfig of config.reportFieldConfigs) {
                if (!fieldConfig.dimensions || fieldConfig.dimensions.length === 0) {
                    errors.push(`At least one dimension required for ${fieldConfig.reportType}`);
                }
                if (!fieldConfig.metrics || fieldConfig.metrics.length === 0) {
                    errors.push(`At least one metric required for ${fieldConfig.reportType}`);
                }
            }
        }

        // Validate dimension filters
        if (config.dimensionFilters) {
            for (const filter of config.dimensionFilters) {
                if (!filter.dimension || !filter.operator) {
                    errors.push('Dimension filter must have dimension and operator');
                } else {
                    if (!validDimensionOperators.includes(filter.operator)) {
                        errors.push(`Invalid dimension filter operator: ${filter.operator}`);
                    }
                    if (!filter.values || filter.values.length === 0) {
                        errors.push(`Dimension filter for ${filter.dimension} must have at least one value`);
                    }
                }
            }
        }

        // Validate metric filters
        if (config.metricFilters) {
            for (const filter of config.metricFilters) {
                if (!filter.metric || !filter.operator || filter.value === undefined) {
                    errors.push('Metric filter must have metric, operator, and value');
                } else {
                    if (!validMetricOperators.includes(filter.operator)) {
                        errors.push(`Invalid metric filter operator: ${filter.operator}`);
                    }
                    if (filter.operator === 'between' && filter.maxValue === undefined) {
                        errors.push('Metric filter with between operator must have maxValue');
                    }
                }
            }
        }

        // Validate frequency
        if (config.frequency) {
            if (config.frequency.type === 'hourly') {
                const interval = config.frequency.interval ?? 1;
                if (interval < 1 || interval > 24) {
                    errors.push('Hourly frequency interval must be between 1 and 24');
                }
            } else if (config.frequency.type === 'weekly' && config.frequency.dayOfWeek === undefined) {
                errors.push('Day of week required for weekly frequency');
            } else if (config.frequency.type === 'monthly' && config.frequency.dayOfMonth === undefined) {
                errors.push('Day of month required for monthly frequency');
            }
        }

        // Validate max records
        if (config.maxRecordsPerReport !== undefined) {
            if (config.maxRecordsPerReport < 100 || config.maxRecordsPerReport > 1000000) {
                errors.push('maxRecordsPerReport must be between 100 and 1,000,000');
            }
        }

        // Validate notification emails
        if ((config.notifyOnComplete || config.notifyOnFailure)) {
            if (!config.notificationEmails || config.notificationEmails.length === 0) {
                errors.push('At least one notification email is required when notifications are enabled');
            } else {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                for (const email of config.notificationEmails) {
                    if (email && !emailRegex.test(email)) {
                        errors.push(`Invalid email address: ${email}`);
                    }
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Get date range from preset or custom dates
     */
    static getDateRange(config: AdvancedSyncConfig): { startDate: string; endDate: string } | null {
        if (config.dateRangePreset && config.dateRangePreset !== 'custom') {
            const preset = DATE_RANGE_PRESETS.find(p => p.id === config.dateRangePreset);
            if (preset) {
                return preset.getDates();
            }
        } else if (config.startDate && config.endDate) {
            return {
                startDate: config.startDate,
                endDate: config.endDate
            };
        }
        return null;
    }

    /**
     * Get cron expression from sync frequency
     */
    static getCronExpression(frequency: SyncFrequency): string | null {
        const minute = frequency.minute ?? 0;
        const hour = frequency.hour ?? 0;

        switch (frequency.type) {
            case 'hourly':
                return `${minute} */${frequency.interval ?? 1} * * *`;
            case 'daily':
                return `${minute} ${hour} * * *`;
            case 'weekly':
                return `${minute} ${hour} * * ${frequency.dayOfWeek ?? 0}`;
            case 'monthly':
                return `${minute} ${hour} ${frequency.dayOfMonth ?? 1} * *`;
            case 'manual':
                return null;
            default:
                return null;
        }
    }
}
