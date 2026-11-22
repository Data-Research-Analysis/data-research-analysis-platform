import { describe, it, expect, beforeEach } from '@jest/globals';
import { LinkedInAdsDriver } from '../../drivers/LinkedInAdsDriver.js';

/**
 * Unit tests for LinkedInAdsDriver
 *
 * DB-dependent methods (syncToDatabase, getSchema, etc.) are NOT exercised here
 * since they require a live PostgreSQL connection.
 * These tests cover:
 *   - Singleton pattern
 *   - Schema name constant
 *   - Private date conversion helpers (isoToLinkedInDate / linkedInDateToIso)
 *   - defaultStartDateIso / defaultEndDateIso return valid ISO strings
 *   - getLogicalTableColumns returns correct column descriptors for every table
 */
describe('LinkedInAdsDriver', () => {
    let driver: LinkedInAdsDriver;

    beforeEach(() => {
        driver = LinkedInAdsDriver.getInstance();
    });

    // -------------------------------------------------------------------------
    // Singleton
    // -------------------------------------------------------------------------
    describe('Singleton Pattern', () => {
        it('should return the same instance on repeated calls', () => {
            const a = LinkedInAdsDriver.getInstance();
            const b = LinkedInAdsDriver.getInstance();
            expect(a).toBe(b);
        });
    });

    // -------------------------------------------------------------------------
    // Schema constants
    // -------------------------------------------------------------------------
    describe('Schema Name', () => {
        it('should use the dra_linkedin_ads schema', () => {
            const schemaName = (LinkedInAdsDriver as any).SCHEMA_NAME;
            expect(schemaName).toBe('dra_linkedin_ads');
        });

        it('should have a positive BATCH_SIZE constant', () => {
            const batchSize = (LinkedInAdsDriver as any).BATCH_SIZE;
            expect(batchSize).toBeGreaterThan(0);
        });
    });

    // -------------------------------------------------------------------------
    // Date conversion helpers
    // -------------------------------------------------------------------------
    describe('isoToLinkedInDate', () => {
        it('should parse a standard ISO date string correctly', () => {
            const d = (driver as any).isoToLinkedInDate('2025-06-15');
            expect(d).toEqual({ year: 2025, month: 6, day: 15 });
        });

        it('should parse a date with single-digit month and day', () => {
            const d = (driver as any).isoToLinkedInDate('2025-01-09');
            expect(d).toEqual({ year: 2025, month: 1, day: 9 });
        });

        it('should parse January 1st as month 1 day 1', () => {
            const d = (driver as any).isoToLinkedInDate('2025-01-01');
            expect(d).toEqual({ year: 2025, month: 1, day: 1 });
        });
    });

    describe('linkedInDateToIso', () => {
        it('should format a structured date back to ISO string with zero-padding', () => {
            const iso = (driver as any).linkedInDateToIso({ year: 2025, month: 6, day: 5 });
            expect(iso).toBe('2025-06-05');
        });

        it('should format December 31 correctly', () => {
            const iso = (driver as any).linkedInDateToIso({ year: 2024, month: 12, day: 31 });
            expect(iso).toBe('2024-12-31');
        });

        it('roundtrip: isoToLinkedInDate → linkedInDateToIso should yield the original string', () => {
            const original = '2025-03-22';
            const structured = (driver as any).isoToLinkedInDate(original);
            const back = (driver as any).linkedInDateToIso(structured);
            expect(back).toBe(original);
        });
    });

    // -------------------------------------------------------------------------
    // Default date helpers
    // -------------------------------------------------------------------------
    describe('Default date helpers', () => {
        it('defaultEndDateIso should return today in YYYY-MM-DD format', () => {
            const result: string = (driver as any).defaultEndDateIso();
            expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);

            const today = new Date().toISOString().split('T')[0];
            expect(result).toBe(today);
        });

        it('defaultStartDateIso should return a date approximately 30 days before today', () => {
            const result: string = (driver as any).defaultStartDateIso();
            expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);

            const expectedDate = new Date();
            expectedDate.setDate(expectedDate.getDate() - 30);
            const expected = expectedDate.toISOString().split('T')[0];
            expect(result).toBe(expected);
        });

        it('defaultStartDateIso should be before defaultEndDateIso', () => {
            const start: string = (driver as any).defaultStartDateIso();
            const end: string = (driver as any).defaultEndDateIso();
            expect(new Date(start).getTime()).toBeLessThan(new Date(end).getTime());
        });
    });

    // -------------------------------------------------------------------------
    // getLogicalTableColumns
    // -------------------------------------------------------------------------
    describe('getLogicalTableColumns', () => {
        const tables = [
            'ad_accounts',
            'campaign_groups',
            'campaigns',
            'creatives',
            'campaign_analytics',
            'account_analytics',
        ];

        tables.forEach(tableName => {
            it(`should return a non-empty columns array for "${tableName}"`, () => {
                const cols = (driver as any).getLogicalTableColumns(tableName);
                expect(Array.isArray(cols)).toBe(true);
                expect(cols.length).toBeGreaterThan(0);
            });

            it(`each column in "${tableName}" should have "name" and "type" properties`, () => {
                const cols = (driver as any).getLogicalTableColumns(tableName);
                cols.forEach((col: any) => {
                    expect(typeof col.name).toBe('string');
                    expect(typeof col.type).toBe('string');
                    expect(col.name.length).toBeGreaterThan(0);
                });
            });
        });

        it('should return an empty array for an unknown table name', () => {
            const cols = (driver as any).getLogicalTableColumns('unknown_table');
            expect(cols).toEqual([]);
        });

        it('ad_accounts table should include an "id" column of type BIGINT', () => {
            const cols = (driver as any).getLogicalTableColumns('ad_accounts');
            const idCol = cols.find((c: any) => c.name === 'id');
            expect(idCol).toBeDefined();
            expect(idCol.type).toBe('BIGINT');
            expect(idCol.nullable).toBe(false);
        });

        it('campaigns table should include cost and budget columns', () => {
            const cols = (driver as any).getLogicalTableColumns('campaigns');
            const names = cols.map((c: any) => c.name);
            expect(names).toContain('daily_budget_amount');
            expect(names).toContain('total_budget_amount');
            expect(names).toContain('cost_type');
        });

        it('campaign_analytics and account_analytics should expose the new tables', () => {
            const campaignCols = (driver as any).getLogicalTableColumns('campaign_analytics');
            const accountCols = (driver as any).getLogicalTableColumns('account_analytics');

            // campaign_analytics carries the campaign-level drill-down columns
            // (campaign_id, campaign_name, conversion_value) on top of the
            // shared analytics columns.
            const campaignNames = campaignCols.map((c: any) => c.name);
            expect(campaignNames).toContain('campaign_id');
            expect(campaignNames).toContain('campaign_name');
            expect(campaignNames).toContain('conversion_value');

            // Shared analytics columns exist in both
            const accountNames = accountCols.map((c: any) => c.name);
            for (const shared of ['date_start', 'date_end', 'entity_id', 'impressions', 'clicks', 'cost_usd']) {
                expect(campaignNames).toContain(shared);
                expect(accountNames).toContain(shared);
            }

            // campaign_analytics is a superset of account_analytics
            for (const c of accountCols) {
                if (c.name !== 'id' && !c.name.startsWith('campaign_')) {
                    expect(campaignNames).toContain(c.name);
                }
            }
        });

        it('breakdown tables should expose dimension value columns', () => {
            expect((driver as any).getLogicalTableColumns('creative_analytics').map((c: any) => c.name)).toEqual(
                expect.arrayContaining(['creative_id', 'creative_name', 'campaign_id']),
            );
            expect((driver as any).getLogicalTableColumns('device_insights').map((c: any) => c.name)).toEqual(
                expect.arrayContaining(['device', 'campaign_id']),
            );
            expect((driver as any).getLogicalTableColumns('placement_insights').map((c: any) => c.name)).toEqual(
                expect.arrayContaining(['placement', 'campaign_id']),
            );
            expect((driver as any).getLogicalTableColumns('industry_insights').map((c: any) => c.name)).toContain('industry');
            expect((driver as any).getLogicalTableColumns('seniority_insights').map((c: any) => c.name)).toContain('seniority');
            expect((driver as any).getLogicalTableColumns('job_function_insights').map((c: any) => c.name)).toContain('job_function');
            expect((driver as any).getLogicalTableColumns('country_insights').map((c: any) => c.name)).toContain('country');
        });

        it('campaign_analytics should contain impressions and clicks columns', () => {
            const cols = (driver as any).getLogicalTableColumns('campaign_analytics');
            const names = cols.map((c: any) => c.name);
            expect(names).toContain('impressions');
            expect(names).toContain('clicks');
            expect(names).toContain('cost_usd');
        });
    });

    // -------------------------------------------------------------------------
    // chunkDateRange
    // -------------------------------------------------------------------------
    describe('chunkDateRange', () => {
        it('should split a 90-day range into three 30-day windows', () => {
            const range = {
                start: { year: 2026, month: 1, day: 1 },
                end: { year: 2026, month: 3, day: 31 },
            };
            const windows = (driver as any).chunkDateRange(range, 30);
            expect(windows.length).toBe(3);
            expect(windows[0]).toEqual({
                start: { year: 2026, month: 1, day: 1 },
                end: { year: 2026, month: 1, day: 30 },
            });
            expect(windows[2]).toEqual({
                start: { year: 2026, month: 3, day: 2 },
                end: { year: 2026, month: 3, day: 31 },
            });
        });

        it('should return a single window when the range fits within maxDays', () => {
            const range = {
                start: { year: 2026, month: 6, day: 1 },
                end: { year: 2026, month: 6, day: 10 },
            };
            const windows = (driver as any).chunkDateRange(range, 30);
            expect(windows.length).toBe(1);
            expect(windows[0].start).toEqual({ year: 2026, month: 6, day: 1 });
            expect(windows[0].end).toEqual({ year: 2026, month: 6, day: 10 });
        });

        it('should return an empty array when the end precedes the start', () => {
            const range = {
                start: { year: 2026, month: 3, day: 10 },
                end: { year: 2026, month: 3, day: 1 },
            };
            expect((driver as any).chunkDateRange(range, 30)).toEqual([]);
        });
    });

    // -------------------------------------------------------------------------
    // Analytics transforms
    // -------------------------------------------------------------------------
    describe('transformAnalytics', () => {
        it('should include campaign_id, campaign_name and conversion_value for campaign rows', () => {
            const record = {
                pivotValues: ['urn:li:sponsoredCampaign:98765'],
                dateRange: { start: { year: 2026, month: 1, day: 1 }, end: { year: 2026, month: 1, day: 1 } },
                impressions: 100,
                clicks: 5,
                costInUsd: '12.34',
                costInLocalCurrency: '11.00',
                externalWebsiteConversions: 2,
                conversionValueInLocalCurrency: '99.50',
            };
            const names = new Map<string, string>([['98765', 'Summer Campaign']]);
            const row = (driver as any).transformAnalytics(record, 'campaign', names);

            expect(row.entity_id).toBe('98765');
            expect(row.campaign_id).toBe('98765');
            expect(row.campaign_name).toBe('Summer Campaign');
            expect(row.conversion_value).toBe(99.5);
            expect(row.external_conversions).toBe(2);
        });

        it('should leave campaign_id null for account-level rows', () => {
            const record = {
                pivotValues: ['urn:li:sponsoredAccount:555'],
                dateRange: { start: { year: 2026, month: 1, day: 1 }, end: { year: 2026, month: 1, day: 31 } },
                impressions: 1000,
            };
            const row = (driver as any).transformAnalytics(record, 'account');
            expect(row.entity_id).toBe('555');
            expect(row.campaign_id).toBeNull();
        });
    });

    describe('transformCreativeAnalytics', () => {
        it('should map the creative to its campaign and fall back to the id as name', () => {
            const record = {
                pivotValues: ['urn:li:sponsoredCreative:444'],
                dateRange: { start: { year: 2026, month: 1, day: 1 }, end: { year: 2026, month: 1, day: 1 } },
                clicks: 3,
            };
            const creativeToCampaign = new Map<string, string>([['444', '98765']]);
            const campaignNames = new Map<string, string>([['98765', 'Summer Campaign']]);
            const row = (driver as any).transformCreativeAnalytics(record, creativeToCampaign, campaignNames);

            expect(row.creative_id).toBe('444');
            expect(row.creative_name).toBe('444');
            expect(row.campaign_id).toBe('98765');
            expect(row.campaign_name).toBe('Summer Campaign');
        });
    });
});
