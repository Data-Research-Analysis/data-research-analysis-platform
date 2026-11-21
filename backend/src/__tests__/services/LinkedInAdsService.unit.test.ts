import { describe, it, expect, beforeEach } from '@jest/globals';
import { LinkedInAdsService } from '../../services/LinkedInAdsService.js';

/**
 * Unit tests for LinkedInAdsService
 *
 * Network-dependent methods (listAdAccounts, getCampaigns, getAnalytics, etc.) are
 * NOT called — they require a live LinkedIn API token. These tests cover:
 *   - Singleton pattern
 *   - Static constants (API version, base URL)
 *   - Internal helper methods (accessed via casting to any where private)
 *   - validateAccessToken error-handling branch (via a mocked fetch)
 */
describe('LinkedInAdsService', () => {
    let service: LinkedInAdsService;

    beforeEach(() => {
        service = LinkedInAdsService.getInstance();
    });

    // -------------------------------------------------------------------------
    // Singleton
    // -------------------------------------------------------------------------
    describe('Singleton Pattern', () => {
        it('should return the same instance on repeated calls', () => {
            const a = LinkedInAdsService.getInstance();
            const b = LinkedInAdsService.getInstance();
            expect(a).toBe(b);
        });
    });

    // -------------------------------------------------------------------------
    // API Version / Base URL constants
    // -------------------------------------------------------------------------
    describe('API Version', () => {
        it('should use LinkedIn API version 202601 (not the sunset 202501)', () => {
            // Access via any cast since the constant is private
            const version = (LinkedInAdsService as any).API_VERSION;
            expect(version).toBe('202601');
        });

        it('should target the correct LinkedIn base URL', () => {
            const baseUrl = (LinkedInAdsService as any).BASE_URL;
            expect(baseUrl).toBe('https://api.linkedin.com');
        });

        it('should have a sane DEFAULT_PAGE_SIZE (at most 1000)', () => {
            const pageSize = (LinkedInAdsService as any).DEFAULT_PAGE_SIZE;
            expect(pageSize).toBeGreaterThan(0);
            expect(pageSize).toBeLessThanOrEqual(1000);
        });
    });

    // -------------------------------------------------------------------------
    // Internal date serialization helpers
    // -------------------------------------------------------------------------
    describe('Date Serialization Helpers', () => {
        it('serializeDate should produce restli-encoded date string', () => {
            const svc = service as any;
            const result = svc.serializeDate({ year: 2025, month: 6, day: 15 });
            expect(result).toBe('(year:2025,month:6,day:15)');
        });

        it('serializeDateRange should produce restli-encoded range string', () => {
            const svc = service as any;
            const range = {
                start: { year: 2025, month: 1, day: 1 },
                end: { year: 2025, month: 1, day: 31 },
            };
            const result = svc.serializeDateRange(range);
            expect(result).toBe('(start:(year:2025,month:1,day:1),end:(year:2025,month:1,day:31))');
        });

        it('serializeDateRange should omit end segment when end is undefined', () => {
            const svc = service as any;
            const range = {
                start: { year: 2025, month: 3, day: 10 },
            };
            const result = svc.serializeDateRange(range);
            expect(result).toBe('(start:(year:2025,month:3,day:10))');
        });
    });

    // -------------------------------------------------------------------------
    // accountUrn helper
    // -------------------------------------------------------------------------
    describe('accountUrn helper', () => {
        it('should return a valid sponsoredAccount URN', () => {
            const svc = service as any;
            expect(svc.accountUrn(987654321)).toBe('urn:li:sponsoredAccount:987654321');
        });

        it('should prefix adAccountId with the correct URN namespace', () => {
            const svc = service as any;
            const urn = svc.accountUrn(12345);
            expect(urn).toMatch(/^urn:li:sponsoredAccount:\d+$/);
        });
    });

    // -------------------------------------------------------------------------
    // validateAccessToken — error handling
    // -------------------------------------------------------------------------
    describe('validateAccessToken', () => {
        it('should return false when the API throws an authentication error', async () => {
            // Temporarily patch listAdAccounts to simulate a 401
            const original = service.listAdAccounts.bind(service);
            (service as any).listAdAccounts = async () => {
                throw new Error('LinkedIn authentication failed: 401 Unauthorized');
            };

            const result = await service.validateAccessToken('invalid-token');

            expect(result).toBe(false);

            // Restore original
            (service as any).listAdAccounts = original;
        });

        it('should return true when the API throws a 5xx server error (token may be valid)', async () => {
            const original = service.listAdAccounts.bind(service);
            (service as any).listAdAccounts = async () => {
                throw new Error('LinkedIn server error (503): Service Unavailable');
            };

            const result = await service.validateAccessToken('some-token');

            expect(result).toBe(true);

            (service as any).listAdAccounts = original;
        });

        it('should return false for a 403 Access Denied error', async () => {
            const original = service.listAdAccounts.bind(service);
            (service as any).listAdAccounts = async () => {
                throw new Error('LinkedIn access denied: 403 Forbidden');
            };

            const result = await service.validateAccessToken('forbidden-token');

            expect(result).toBe(false);

            (service as any).listAdAccounts = original;
        });
    });

    // -------------------------------------------------------------------------
    // Performance fields constant
    // -------------------------------------------------------------------------
    describe('LINKEDIN_PERFORMANCE_FIELDS constant', () => {
        it('should export a non-empty performance fields string', async () => {
            const { LINKEDIN_PERFORMANCE_FIELDS } = await import('../../types/ILinkedInAds.js');
            expect(typeof LINKEDIN_PERFORMANCE_FIELDS).toBe('string');
            expect(LINKEDIN_PERFORMANCE_FIELDS.length).toBeGreaterThan(0);
            expect(LINKEDIN_PERFORMANCE_FIELDS).toContain('impressions');
            expect(LINKEDIN_PERFORMANCE_FIELDS).toContain('clicks');
        });

        it('should export a non-empty demographic fields string', async () => {
            const { LINKEDIN_DEMOGRAPHIC_FIELDS } = await import('../../types/ILinkedInAds.js');
            expect(typeof LINKEDIN_DEMOGRAPHIC_FIELDS).toBe('string');
            expect(LINKEDIN_DEMOGRAPHIC_FIELDS.length).toBeGreaterThan(0);
        });

        it('should include conversion value in the performance fields', async () => {
            const { LINKEDIN_PERFORMANCE_FIELDS } = await import('../../types/ILinkedInAds.js');
            expect(LINKEDIN_PERFORMANCE_FIELDS).toContain('conversionValueInLocalCurrency');
        });
    });

    // -------------------------------------------------------------------------
    // fetchAnalytics — single-pivot Analytics Finder requests
    // -------------------------------------------------------------------------
    describe('fetchAnalytics', () => {
        const dateRange = {
            start: { year: 2026, month: 1, day: 1 },
            end: { year: 2026, month: 1, day: 31 },
        };

        it('should use a single pivot and the campaigns facet when campaignIds are provided', async () => {
            const svc = service as any;
            let capturedParams: Record<string, string> | null = null;
            svc.makeRequest = async (_path: string, _token: string, params: Record<string, string>) => {
                capturedParams = params;
                return { elements: [] };
            };

            await svc.fetchAnalytics('token', 'MEMBER_INDUSTRY', dateRange, 'dateRange,pivotValues', {
                adAccountId: 111,
                campaignIds: [222],
                timeGranularity: 'DAILY',
            });

            expect(capturedParams!.q).toBe('analytics');
            expect(capturedParams!.pivot).toBe('MEMBER_INDUSTRY');
            expect(capturedParams!.pivots).toBeUndefined();
            expect(capturedParams!.campaigns).toBe('List(urn:li:sponsoredCampaign:222)');
            expect(capturedParams!.accounts).toBeUndefined();
        });

        it('should use the accounts facet when no campaignIds are provided', async () => {
            const svc = service as any;
            let capturedParams: Record<string, string> | null = null;
            svc.makeRequest = async (_path: string, _token: string, params: Record<string, string>) => {
                capturedParams = params;
                return { elements: [] };
            };

            await svc.fetchAnalytics('token', 'CAMPAIGN', dateRange, 'dateRange,pivotValues', {
                adAccountId: 111,
            });

            expect(capturedParams!.accounts).toBe('List(urn:li:sponsoredAccount:111)');
            expect(capturedParams!.campaigns).toBeUndefined();
        });

        it('should throw when neither adAccountId nor campaignIds is provided', async () => {
            const svc = service as any;
            svc.makeRequest = async () => ({ elements: [] });

            await expect(
                svc.fetchAnalytics('token', 'CAMPAIGN', dateRange, 'fields', {}),
            ).rejects.toThrow(/adAccountId or campaignIds/);
        });
    });

    // -------------------------------------------------------------------------
    // resolveTargetingEntityNames — name extraction
    // -------------------------------------------------------------------------
    describe('resolveTargetingEntityNames', () => {
        it('should resolve URNs to localized names from the targeting entities response', async () => {
            const svc = service as any;
            svc.makeRequest = async () => ({
                elements: [
                    { urn: 'urn:li:industry:4', localizedName: { localized: { en_US: { value: 'Computer Software' } } } },
                    { urn: 'urn:li:geo:92000000', localizedName: { localized: { en_US: 'United States' } } },
                ],
            });

            const names = await svc.resolveTargetingEntityNames('token', [
                'urn:li:industry:4',
                'urn:li:geo:92000000',
            ]);

            expect(names.get('urn:li:industry:4')).toBe('Computer Software');
            expect(names.get('urn:li:geo:92000000')).toBe('United States');
        });

        it('should gracefully skip un-resolvable URNs', async () => {
            const svc = service as any;
            svc.makeRequest = async () => { throw new Error('400 Bad Request'); };

            const names = await svc.resolveTargetingEntityNames('token', ['urn:li:industry:4']);
            expect(names.size).toBe(0);
        });
    });

    // -------------------------------------------------------------------------
    // extractLocalizedName — defensive extraction
    // -------------------------------------------------------------------------
    describe('extractLocalizedName', () => {
        it('should extract a nested value object', () => {
            const svc = service as any;
            expect(svc.extractLocalizedName({ localized: { en_US: { value: 'Health Care' } } })).toBe('Health Care');
        });

        it('should extract a plain localized string', () => {
            const svc = service as any;
            expect(svc.extractLocalizedName({ localized: { en_US: 'Technology' } })).toBe('Technology');
        });

        it('should return null for empty input', () => {
            const svc = service as any;
            expect(svc.extractLocalizedName(null)).toBeNull();
            expect(svc.extractLocalizedName({})).toBeNull();
        });
    });
});
