import {
    SyncConfigValidator,
    AdvancedSyncConfig,
    DATE_RANGE_PRESETS,
    REPORT_DIMENSIONS,
    REPORT_METRICS,
} from '../IAdvancedSyncConfig.js';

describe('SyncConfigValidator', () => {
    describe('validate()', () => {
        it('should validate a complete valid configuration', () => {
            const config: AdvancedSyncConfig = {
                dateRangePreset: 'last30days',
                reportTypes: ['revenue', 'inventory'],
                networkCode: '123456',
                incrementalSync: false,
                deduplication: true,
                dataValidation: true,
                notifyOnFailure: true,
                notificationEmails: ['admin@example.com'],
            };

            const result = SyncConfigValidator.validate(config);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should reject config without network code', () => {
            const config: any = {
                dateRangePreset: 'last30days',
                reportTypes: ['revenue'],
            };

            const result = SyncConfigValidator.validate(config);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Network code is required');
        });

        it('should reject config without report types', () => {
            const config: AdvancedSyncConfig = {
                dateRangePreset: 'last30days',
                reportTypes: [],
                networkCode: '123456',
            };

            const result = SyncConfigValidator.validate(config);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('At least one report type must be selected');
        });

        it('should reject config with invalid report type', () => {
            const config: any = {
                dateRangePreset: 'last30days',
                reportTypes: ['revenue', 'invalid_type'],
                networkCode: '123456',
            };

            const result = SyncConfigValidator.validate(config);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('Invalid report type'))).toBe(true);
        });

        it('should reject custom date range without dates', () => {
            const config: AdvancedSyncConfig = {
                dateRangePreset: 'custom',
                reportTypes: ['revenue'],
                networkCode: '123456',
            };

            const result = SyncConfigValidator.validate(config);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Start date and end date are required for custom date range');
        });

        it('should reject invalid date range (start > end)', () => {
            const config: AdvancedSyncConfig = {
                dateRangePreset: 'custom',
                startDate: '2025-12-31',
                endDate: '2025-01-01',
                reportTypes: ['revenue'],
                networkCode: '123456',
            };

            const result = SyncConfigValidator.validate(config);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Start date must be before end date');
        });

        it('should reject invalid dimension filter operator', () => {
            const config: any = {
                dateRangePreset: 'last30days',
                reportTypes: ['revenue'],
                networkCode: '123456',
                dimensionFilters: [
                    {
                        dimension: 'AD_UNIT_NAME',
                        operator: 'invalid_operator',
                        values: ['test'],
                    },
                ],
            };

            const result = SyncConfigValidator.validate(config);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('Invalid dimension filter operator'))).toBe(true);
        });

        it('should reject dimension filter without values', () => {
            const config: AdvancedSyncConfig = {
                dateRangePreset: 'last30days',
                reportTypes: ['revenue'],
                networkCode: '123456',
                dimensionFilters: [
                    {
                        dimension: 'AD_UNIT_NAME',
                        operator: 'equals',
                        values: [],
                    },
                ],
            };

            const result = SyncConfigValidator.validate(config);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Dimension filter for AD_UNIT_NAME must have at least one value');
        });

        it('should reject invalid metric filter operator', () => {
            const config: any = {
                dateRangePreset: 'last30days',
                reportTypes: ['revenue'],
                networkCode: '123456',
                metricFilters: [
                    {
                        metric: 'TOTAL_LINE_ITEM_LEVEL_IMPRESSIONS',
                        operator: 'invalid_operator',
                        value: 1000,
                    },
                ],
            };

            const result = SyncConfigValidator.validate(config);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('Invalid metric filter operator'))).toBe(true);
        });

        it('should reject between operator without maxValue', () => {
            const config: AdvancedSyncConfig = {
                dateRangePreset: 'last30days',
                reportTypes: ['revenue'],
                networkCode: '123456',
                metricFilters: [
                    {
                        metric: 'TOTAL_LINE_ITEM_LEVEL_IMPRESSIONS',
                        operator: 'between',
                        value: 1000,
                    },
                ],
            };

            const result = SyncConfigValidator.validate(config);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Metric filter with between operator must have maxValue');
        });

        it('should reject invalid email format', () => {
            const config: AdvancedSyncConfig = {
                dateRangePreset: 'last30days',
                reportTypes: ['revenue'],
                networkCode: '123456',
                notifyOnFailure: true,
                notificationEmails: ['invalid-email'],
            };

            const result = SyncConfigValidator.validate(config);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('Invalid email address'))).toBe(true);
        });

        it('should reject maxRecordsPerReport out of range (too low)', () => {
            const config: AdvancedSyncConfig = {
                dateRangePreset: 'last30days',
                reportTypes: ['revenue'],
                networkCode: '123456',
                maxRecordsPerReport: 50,
            };

            const result = SyncConfigValidator.validate(config);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('maxRecordsPerReport must be between 100 and 1,000,000');
        });

        it('should reject maxRecordsPerReport out of range (too high)', () => {
            const config: AdvancedSyncConfig = {
                dateRangePreset: 'last30days',
                reportTypes: ['revenue'],
                networkCode: '123456',
                maxRecordsPerReport: 2000000,
            };

            const result = SyncConfigValidator.validate(config);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('maxRecordsPerReport must be between 100 and 1,000,000');
        });

        it('should require notification emails when notifications enabled', () => {
            const config: AdvancedSyncConfig = {
                dateRangePreset: 'last30days',
                reportTypes: ['revenue'],
                networkCode: '123456',
                notifyOnComplete: true,
                notificationEmails: [],
            };

            const result = SyncConfigValidator.validate(config);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('At least one notification email is required when notifications are enabled');
        });

        it('should validate hourly frequency', () => {
            const config: AdvancedSyncConfig = {
                dateRangePreset: 'last30days',
                reportTypes: ['revenue'],
                networkCode: '123456',
                frequency: {
                    type: 'hourly',
                    interval: 4,
                },
            };

            const result = SyncConfigValidator.validate(config);
            expect(result.valid).toBe(true);
        });

        it('should reject hourly frequency with invalid interval', () => {
            const config: AdvancedSyncConfig = {
                dateRangePreset: 'last30days',
                reportTypes: ['revenue'],
                networkCode: '123456',
                frequency: {
                    type: 'hourly',
                    interval: 0,
                },
            };

            const result = SyncConfigValidator.validate(config);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Hourly frequency interval must be between 1 and 24');
        });

        it('should validate daily frequency', () => {
            const config: AdvancedSyncConfig = {
                dateRangePreset: 'last30days',
                reportTypes: ['revenue'],
                networkCode: '123456',
                frequency: {
                    type: 'daily',
                    hour: 2,
                    minute: 30,
                },
            };

            const result = SyncConfigValidator.validate(config);
            expect(result.valid).toBe(true);
        });

        it('should validate weekly frequency', () => {
            const config: AdvancedSyncConfig = {
                dateRangePreset: 'last30days',
                reportTypes: ['revenue'],
                networkCode: '123456',
                frequency: {
                    type: 'weekly',
                    dayOfWeek: 1,
                    hour: 9,
                    minute: 0,
                },
            };

            const result = SyncConfigValidator.validate(config);
            expect(result.valid).toBe(true);
        });

        it('should validate monthly frequency', () => {
            const config: AdvancedSyncConfig = {
                dateRangePreset: 'last30days',
                reportTypes: ['revenue'],
                networkCode: '123456',
                frequency: {
                    type: 'monthly',
                    dayOfMonth: 1,
                    hour: 0,
                    minute: 0,
                },
            };

            const result = SyncConfigValidator.validate(config);
            expect(result.valid).toBe(true);
        });
    });

    describe('getDateRange()', () => {
        it('should extract dates from preset', () => {
            const config: AdvancedSyncConfig = {
                dateRangePreset: 'last30days',
                reportTypes: ['revenue'],
                networkCode: '123456',
            };

            const dateRange = SyncConfigValidator.getDateRange(config);
            expect(dateRange).toBeDefined();
            expect(dateRange?.startDate).toBeDefined();
            expect(dateRange?.endDate).toBeDefined();
            
            // Verify dates are ISO format
            expect(dateRange?.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            expect(dateRange?.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });

        it('should extract custom dates', () => {
            const config: AdvancedSyncConfig = {
                dateRangePreset: 'custom',
                startDate: '2025-01-01',
                endDate: '2025-12-31',
                reportTypes: ['revenue'],
                networkCode: '123456',
            };

            const dateRange = SyncConfigValidator.getDateRange(config);
            expect(dateRange).toEqual({
                startDate: '2025-01-01',
                endDate: '2025-12-31',
            });
        });

        it('should return null for custom without dates', () => {
            const config: AdvancedSyncConfig = {
                dateRangePreset: 'custom',
                reportTypes: ['revenue'],
                networkCode: '123456',
            };

            const dateRange = SyncConfigValidator.getDateRange(config);
            expect(dateRange).toBeNull();
        });

        it('should handle all presets', () => {
            const presets = ['today', 'yesterday', 'last7days', 'last30days', 'last90days', 
                            'thisMonth', 'lastMonth', 'thisQuarter', 'thisYear'];
            
            for (const preset of presets) {
                const config: AdvancedSyncConfig = {
                    dateRangePreset: preset,
                    reportTypes: ['revenue'],
                    networkCode: '123456',
                };

                const dateRange = SyncConfigValidator.getDateRange(config);
                expect(dateRange).toBeDefined();
                expect(dateRange?.startDate).toBeDefined();
                expect(dateRange?.endDate).toBeDefined();
            }
        });
    });

    describe('getCronExpression()', () => {
        it('should generate cron for manual frequency', () => {
            const frequency = { type: 'manual' as const };
            const cron = SyncConfigValidator.getCronExpression(frequency);
            expect(cron).toBeNull();
        });

        it('should generate cron for hourly frequency', () => {
            const frequency = { type: 'hourly' as const, interval: 4 };
            const cron = SyncConfigValidator.getCronExpression(frequency);
            expect(cron).toBe('0 */4 * * *');
        });

        it('should generate cron for daily frequency', () => {
            const frequency = { type: 'daily' as const, hour: 2, minute: 30 };
            const cron = SyncConfigValidator.getCronExpression(frequency);
            expect(cron).toBe('30 2 * * *');
        });

        it('should generate cron for weekly frequency', () => {
            const frequency = { type: 'weekly' as const, dayOfWeek: 1, hour: 9, minute: 0 };
            const cron = SyncConfigValidator.getCronExpression(frequency);
            expect(cron).toBe('0 9 * * 1');
        });

        it('should generate cron for monthly frequency', () => {
            const frequency = { type: 'monthly' as const, dayOfMonth: 15, hour: 3, minute: 45 };
            const cron = SyncConfigValidator.getCronExpression(frequency);
            expect(cron).toBe('45 3 15 * *');
        });

        it('should handle default values', () => {
            const frequency = { type: 'daily' as const };
            const cron = SyncConfigValidator.getCronExpression(frequency);
            expect(cron).toBe('0 0 * * *');
        });
    });

    describe('DATE_RANGE_PRESETS', () => {
        it('should have 10 presets', () => {
            expect(DATE_RANGE_PRESETS).toHaveLength(10);
        });

        it('should have unique IDs', () => {
            const ids = DATE_RANGE_PRESETS.map(p => p.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(ids.length);
        });

        it('should all have getDates functions', () => {
            for (const preset of DATE_RANGE_PRESETS) {
                expect(typeof preset.getDates).toBe('function');
            }
        });

        it('should return valid date ranges', () => {
            for (const preset of DATE_RANGE_PRESETS) {
                // Skip custom preset as it returns empty strings (to be filled by user)
                if (preset.id === 'custom') {
                    continue;
                }
                
                const dates = preset.getDates();
                expect(dates).toBeDefined();
                expect(dates.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
                expect(dates.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
                
                const start = new Date(dates.startDate);
                const end = new Date(dates.endDate);
                expect(start.getTime()).toBeLessThanOrEqual(end.getTime());
            }
        });
    });

    describe('REPORT_DIMENSIONS', () => {
        it('should have dimensions for all report types', () => {
            const reportTypes = ['revenue', 'inventory', 'orders', 'geography', 'device'];
            for (const type of reportTypes) {
                expect(REPORT_DIMENSIONS[type]).toBeDefined();
                expect(Array.isArray(REPORT_DIMENSIONS[type])).toBe(true);
                expect(REPORT_DIMENSIONS[type].length).toBeGreaterThan(0);
            }
        });
    });

    describe('REPORT_METRICS', () => {
        it('should have metrics for all report types', () => {
            const reportTypes = ['revenue', 'inventory', 'orders', 'geography', 'device'];
            for (const type of reportTypes) {
                expect(REPORT_METRICS[type]).toBeDefined();
                expect(Array.isArray(REPORT_METRICS[type])).toBe(true);
                expect(REPORT_METRICS[type].length).toBeGreaterThan(0);
            }
        });
    });
});
