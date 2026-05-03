import { describe, it, expect, beforeEach } from '@jest/globals';
import { MetaAdsDriver } from '../../drivers/MetaAdsDriver.js';

/**
 * Unit tests for MetaAdsDriver
 *
 * DB-dependent methods (syncToDatabase, getSchema, etc.) are NOT exercised here
 * since they require a live PostgreSQL connection.
 * These tests cover:
 *   - Singleton pattern
 *   - getTableColumns dispatcher returns correct descriptor arrays
 *   - getAdColumns includes url_tags and tracking_specs
 *   - getCreativeColumns output (structure + key fields)
 *   - getCustomConversionColumns output (structure + key fields)
 *   - sumConversions helper behaviour
 *   - Default date helpers return valid ISO strings
 */
describe('MetaAdsDriver', () => {
    let driver: MetaAdsDriver;

    beforeEach(() => {
        driver = MetaAdsDriver.getInstance();
    });

    // -------------------------------------------------------------------------
    // Singleton
    // -------------------------------------------------------------------------
    describe('Singleton Pattern', () => {
        it('should return the same instance on repeated calls', () => {
            const a = MetaAdsDriver.getInstance();
            const b = MetaAdsDriver.getInstance();
            expect(a).toBe(b);
        });
    });

    // -------------------------------------------------------------------------
    // getTableColumns dispatcher
    // -------------------------------------------------------------------------
    describe('getTableColumns', () => {
        const knownTypes = ['campaigns', 'adsets', 'ads', 'insights', 'creatives', 'custom_conversions'];

        knownTypes.forEach(syncType => {
            it(`should return a non-empty columns array for "${syncType}"`, () => {
                const cols = (driver as any).getTableColumns(syncType);
                expect(Array.isArray(cols)).toBe(true);
                expect(cols.length).toBeGreaterThan(0);
            });
        });

        it('should return an empty array for an unknown sync type', () => {
            const cols = (driver as any).getTableColumns('unknown_sync_type');
            expect(cols).toEqual([]);
        });
    });

    // -------------------------------------------------------------------------
    // Column descriptor shape helper
    // -------------------------------------------------------------------------
    function assertColumnShape(cols: any[]): void {
        cols.forEach((col: any) => {
            expect(typeof col.name).toBe('string');
            expect(typeof col.type).toBe('string');
            expect(col.name.length).toBeGreaterThan(0);
            expect(col.type.length).toBeGreaterThan(0);
            expect(typeof col.nullable).toBe('boolean');
        });
    }

    // -------------------------------------------------------------------------
    // getAdColumns
    // -------------------------------------------------------------------------
    describe('getAdColumns', () => {
        it('should return a non-empty array', () => {
            const cols = (driver as any).getAdColumns();
            expect(Array.isArray(cols)).toBe(true);
            expect(cols.length).toBeGreaterThan(0);
        });

        it('every column should have name, type, and nullable properties', () => {
            assertColumnShape((driver as any).getAdColumns());
        });

        it('should include url_tags column of type TEXT', () => {
            const cols: any[] = (driver as any).getAdColumns();
            const col = cols.find((c: any) => c.name === 'url_tags');
            expect(col).toBeDefined();
            expect(col.type).toBe('TEXT');
            expect(col.nullable).toBe(true);
        });

        it('should include tracking_specs column of type JSONB', () => {
            const cols: any[] = (driver as any).getAdColumns();
            const col = cols.find((c: any) => c.name === 'tracking_specs');
            expect(col).toBeDefined();
            expect(col.type).toBe('JSONB');
            expect(col.nullable).toBe(true);
        });

        it('should include id column that is not nullable', () => {
            const cols: any[] = (driver as any).getAdColumns();
            const col = cols.find((c: any) => c.name === 'id');
            expect(col).toBeDefined();
            expect(col.nullable).toBe(false);
        });

        it('should include adset_id and campaign_id columns', () => {
            const names = (driver as any).getAdColumns().map((c: any) => c.name);
            expect(names).toContain('adset_id');
            expect(names).toContain('campaign_id');
        });
    });

    // -------------------------------------------------------------------------
    // getCreativeColumns
    // -------------------------------------------------------------------------
    describe('getCreativeColumns', () => {
        it('should return a non-empty array', () => {
            const cols = (driver as any).getCreativeColumns();
            expect(Array.isArray(cols)).toBe(true);
            expect(cols.length).toBeGreaterThan(0);
        });

        it('every column should have name, type, and nullable properties', () => {
            assertColumnShape((driver as any).getCreativeColumns());
        });

        it('should include id column of type VARCHAR(50) that is not nullable', () => {
            const cols: any[] = (driver as any).getCreativeColumns();
            const col = cols.find((c: any) => c.name === 'id');
            expect(col).toBeDefined();
            expect(col.type).toBe('VARCHAR(50)');
            expect(col.nullable).toBe(false);
        });

        it('should include url_tags column of type TEXT', () => {
            const cols: any[] = (driver as any).getCreativeColumns();
            const col = cols.find((c: any) => c.name === 'url_tags');
            expect(col).toBeDefined();
            expect(col.type).toBe('TEXT');
            expect(col.nullable).toBe(true);
        });

        it('should include tracking_specs column of type JSONB', () => {
            const cols: any[] = (driver as any).getCreativeColumns();
            const col = cols.find((c: any) => c.name === 'tracking_specs');
            expect(col).toBeDefined();
            expect(col.type).toBe('JSONB');
            expect(col.nullable).toBe(true);
        });

        it('should include asset_feed_spec and object_story_spec JSONB columns', () => {
            const cols: any[] = (driver as any).getCreativeColumns();
            const names = cols.map((c: any) => c.name);
            expect(names).toContain('asset_feed_spec');
            expect(names).toContain('object_story_spec');
            const assetCol = cols.find((c: any) => c.name === 'asset_feed_spec');
            const storyCol = cols.find((c: any) => c.name === 'object_story_spec');
            expect(assetCol.type).toBe('JSONB');
            expect(storyCol.type).toBe('JSONB');
        });

        it('should include synced_at and updated_at timestamp columns', () => {
            const names = (driver as any).getCreativeColumns().map((c: any) => c.name);
            expect(names).toContain('synced_at');
            expect(names).toContain('updated_at');
        });
    });

    // -------------------------------------------------------------------------
    // getCustomConversionColumns
    // -------------------------------------------------------------------------
    describe('getCustomConversionColumns', () => {
        it('should return a non-empty array', () => {
            const cols = (driver as any).getCustomConversionColumns();
            expect(Array.isArray(cols)).toBe(true);
            expect(cols.length).toBeGreaterThan(0);
        });

        it('every column should have name, type, and nullable properties', () => {
            assertColumnShape((driver as any).getCustomConversionColumns());
        });

        it('should include id column of type VARCHAR(50) that is not nullable', () => {
            const cols: any[] = (driver as any).getCustomConversionColumns();
            const col = cols.find((c: any) => c.name === 'id');
            expect(col).toBeDefined();
            expect(col.type).toBe('VARCHAR(50)');
            expect(col.nullable).toBe(false);
        });

        it('should include name column of type VARCHAR(255) that is not nullable', () => {
            const cols: any[] = (driver as any).getCustomConversionColumns();
            const col = cols.find((c: any) => c.name === 'name');
            expect(col).toBeDefined();
            expect(col.type).toBe('VARCHAR(255)');
            expect(col.nullable).toBe(false);
        });

        it('should include pixel_id and custom_event_type columns', () => {
            const names = (driver as any).getCustomConversionColumns().map((c: any) => c.name);
            expect(names).toContain('pixel_id');
            expect(names).toContain('custom_event_type');
        });

        it('should include default_conversion_value of type DECIMAL(15,2)', () => {
            const cols: any[] = (driver as any).getCustomConversionColumns();
            const col = cols.find((c: any) => c.name === 'default_conversion_value');
            expect(col).toBeDefined();
            expect(col.type).toBe('DECIMAL(15,2)');
        });

        it('should include is_archived BOOLEAN column', () => {
            const cols: any[] = (driver as any).getCustomConversionColumns();
            const col = cols.find((c: any) => c.name === 'is_archived');
            expect(col).toBeDefined();
            expect(col.type).toBe('BOOLEAN');
        });

        it('should include synced_at and updated_at timestamp columns', () => {
            const names = (driver as any).getCustomConversionColumns().map((c: any) => c.name);
            expect(names).toContain('synced_at');
            expect(names).toContain('updated_at');
        });
    });

    // -------------------------------------------------------------------------
    // sumConversions helper
    // -------------------------------------------------------------------------
    describe('sumConversions', () => {
        it('should return 0 for undefined input', () => {
            expect((driver as any).sumConversions(undefined)).toBe(0);
        });

        it('should return 0 for an empty array', () => {
            expect((driver as any).sumConversions([])).toBe(0);
        });

        it('should sum offsite_conversion actions', () => {
            const actions = [
                { action_type: 'offsite_conversion.fb_pixel_purchase', value: '3' },
                { action_type: 'offsite_conversion.fb_pixel_lead', value: '2' },
            ];
            expect((driver as any).sumConversions(actions)).toBe(5);
        });

        it('should sum lead and purchase actions', () => {
            const actions = [
                { action_type: 'lead', value: '4' },
                { action_type: 'purchase', value: '1' },
            ];
            expect((driver as any).sumConversions(actions)).toBe(5);
        });

        it('should exclude non-conversion action types like link_click', () => {
            const actions = [
                { action_type: 'link_click', value: '100' },
                { action_type: 'post_engagement', value: '200' },
                { action_type: 'video_view', value: '50' },
            ];
            expect((driver as any).sumConversions(actions)).toBe(0);
        });

        it('should handle mixed conversion and non-conversion actions', () => {
            const actions = [
                { action_type: 'link_click', value: '100' },
                { action_type: 'offsite_conversion.fb_pixel_purchase', value: '7' },
                { action_type: 'post_engagement', value: '200' },
            ];
            expect((driver as any).sumConversions(actions)).toBe(7);
        });
    });

    // -------------------------------------------------------------------------
    // Default date helpers
    // -------------------------------------------------------------------------
    describe('Default date helpers', () => {
        it('getDefaultEndDate should return today in YYYY-MM-DD format', () => {
            const result: string = (driver as any).getDefaultEndDate();
            expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            const today = new Date().toISOString().split('T')[0];
            expect(result).toBe(today);
        });

        it('getDefaultStartDate should return a date approximately 30 days before today', () => {
            const result: string = (driver as any).getDefaultStartDate();
            expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            const expected = new Date();
            expected.setDate(expected.getDate() - 30);
            expect(result).toBe(expected.toISOString().split('T')[0]);
        });

        it('getDefaultStartDate should be before getDefaultEndDate', () => {
            const start: string = (driver as any).getDefaultStartDate();
            const end: string = (driver as any).getDefaultEndDate();
            expect(new Date(start).getTime()).toBeLessThan(new Date(end).getTime());
        });
    });
});
