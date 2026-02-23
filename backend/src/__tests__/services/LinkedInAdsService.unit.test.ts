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
    });
});
