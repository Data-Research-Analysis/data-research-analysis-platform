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

        it('campaign_analytics and account_analytics should share the same column schema', () => {
            const campaignCols = (driver as any).getLogicalTableColumns('campaign_analytics');
            const accountCols = (driver as any).getLogicalTableColumns('account_analytics');

            // Both use the same case branch, so they must be identical
            expect(campaignCols.length).toBe(accountCols.length);

            campaignCols.forEach((col: any, idx: number) => {
                expect(col.name).toBe(accountCols[idx].name);
                expect(col.type).toBe(accountCols[idx].type);
            });
        });

        it('campaign_analytics should contain impressions and clicks columns', () => {
            const cols = (driver as any).getLogicalTableColumns('campaign_analytics');
            const names = cols.map((c: any) => c.name);
            expect(names).toContain('impressions');
            expect(names).toContain('clicks');
            expect(names).toContain('cost_usd');
        });
    });
});
