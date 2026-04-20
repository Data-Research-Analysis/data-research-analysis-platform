import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { GeolocationService, ConsentRegion } from '../../services/GeolocationService.js';

/**
 * Unit tests for GeolocationService
 * Covers:
 *  1. GDPR country classification
 *  2. US → CALIFORNIA mapping
 *  3. Lookup unavailable / error fallback behavior
 *  4. IP normalization edge cases (getClientIP)
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal MaxMind-style reader mock that always returns the given ISO code. */
function makeLookup(isoCode: string | null) {
    return {
        get: jest.fn((_ip: string) =>
            isoCode ? { country: { iso_code: isoCode } } : null
        )
    };
}

/** Build a fake Express request object with the given headers / socket. */
function makeReq(opts: {
    cfConnectingIp?: string | string[];
    xForwardedFor?: string | string[];
    xRealIp?: string | string[];
    remoteAddress?: string;
} = {}) {
    return {
        headers: {
            ...(opts.cfConnectingIp !== undefined ? { 'cf-connecting-ip': opts.cfConnectingIp } : {}),
            ...(opts.xForwardedFor !== undefined ? { 'x-forwarded-for': opts.xForwardedFor } : {}),
            ...(opts.xRealIp !== undefined ? { 'x-real-ip': opts.xRealIp } : {})
        },
        connection: { remoteAddress: opts.remoteAddress },
        socket: { remoteAddress: opts.remoteAddress }
    };
}

// ---------------------------------------------------------------------------
// Reset the singleton between tests so state doesn't leak
// ---------------------------------------------------------------------------

function resetSingleton() {
    const svc = GeolocationService.getInstance();
    (svc as any).lookup = null;
    (svc as any).initPromise = null;
}

// ---------------------------------------------------------------------------
// Suites
// ---------------------------------------------------------------------------

describe('GeolocationService', () => {
    let service: GeolocationService;

    beforeEach(() => {
        resetSingleton();
        service = GeolocationService.getInstance();
    });

    // -----------------------------------------------------------------------
    // 1. Singleton
    // -----------------------------------------------------------------------
    describe('Singleton pattern', () => {
        it('should return the same instance on repeated calls', () => {
            const a = GeolocationService.getInstance();
            const b = GeolocationService.getInstance();
            expect(a).toBe(b);
        });
    });

    // -----------------------------------------------------------------------
    // 2. GDPR country classification
    // -----------------------------------------------------------------------
    describe('GDPR_COUNTRIES classification (EU_EEA_UK)', () => {
        const gdprCountries = [
            'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
            'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
            'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'GB', 'IS', 'LI', 'NO', 'CH'
        ];

        it.each(gdprCountries)(
            'should return EU_EEA_UK for country code %s',
            (code) => {
                (service as any).lookup = makeLookup(code);
                expect(service.getConsentRegion('1.2.3.4')).toBe(ConsentRegion.EU_EEA_UK);
            }
        );

        it('should return EU_EEA_UK for all 32 GDPR countries', () => {
            let count = 0;
            for (const code of gdprCountries) {
                (service as any).lookup = makeLookup(code);
                if (service.getConsentRegion('1.2.3.4') === ConsentRegion.EU_EEA_UK) {
                    count++;
                }
            }
            expect(count).toBe(gdprCountries.length);
        });
    });

    // -----------------------------------------------------------------------
    // 3. US → CALIFORNIA mapping
    // -----------------------------------------------------------------------
    describe('US → CALIFORNIA mapping', () => {
        it('should return CALIFORNIA for US country code', () => {
            (service as any).lookup = makeLookup('US');
            expect(service.getConsentRegion('8.8.8.8')).toBe(ConsentRegion.CALIFORNIA);
        });

        it('should not classify US as EU_EEA_UK', () => {
            (service as any).lookup = makeLookup('US');
            expect(service.getConsentRegion('8.8.8.8')).not.toBe(ConsentRegion.EU_EEA_UK);
        });

        it('should not classify US as REST_OF_WORLD', () => {
            (service as any).lookup = makeLookup('US');
            expect(service.getConsentRegion('8.8.8.8')).not.toBe(ConsentRegion.REST_OF_WORLD);
        });
    });

    // -----------------------------------------------------------------------
    // 4. REST_OF_WORLD for non-GDPR, non-US countries
    // -----------------------------------------------------------------------
    describe('REST_OF_WORLD classification', () => {
        it.each(['AU', 'JP', 'CA', 'BR', 'IN', 'CN', 'MX', 'ZA'])(
            'should return REST_OF_WORLD for country code %s',
            (code) => {
                (service as any).lookup = makeLookup(code);
                expect(service.getConsentRegion('1.2.3.4')).toBe(ConsentRegion.REST_OF_WORLD);
            }
        );
    });

    // -----------------------------------------------------------------------
    // 5. Lookup unavailable / error fallback
    // -----------------------------------------------------------------------
    describe('Fallback behavior when lookup is unavailable', () => {
        it('should return REST_OF_WORLD when lookup is null (db not loaded)', () => {
            (service as any).lookup = null;
            expect(service.getConsentRegion('1.2.3.4')).toBe(ConsentRegion.REST_OF_WORLD);
        });

        it('should return REST_OF_WORLD when lookup.get returns null', () => {
            (service as any).lookup = makeLookup(null);
            expect(service.getConsentRegion('1.2.3.4')).toBe(ConsentRegion.REST_OF_WORLD);
        });

        it('should return REST_OF_WORLD when country result has no iso_code', () => {
            (service as any).lookup = { get: jest.fn(() => ({ country: {} })) };
            expect(service.getConsentRegion('1.2.3.4')).toBe(ConsentRegion.REST_OF_WORLD);
        });

        it('should return REST_OF_WORLD when lookup.get throws', () => {
            (service as any).lookup = {
                get: jest.fn(() => { throw new Error('Lookup error'); })
            };
            expect(service.getConsentRegion('1.2.3.4')).toBe(ConsentRegion.REST_OF_WORLD);
        });
    });

    // -----------------------------------------------------------------------
    // 6. initialize() behaviour
    // -----------------------------------------------------------------------
    describe('initialize()', () => {
        it('should return the same promise on repeated calls (idempotent)', async () => {
            const p1 = service.initialize();
            const p2 = service.initialize();
            expect(p1).toBe(p2);
            await p1; // errors are swallowed internally; let the promise settle
        });

        it('should leave lookup as null and not throw when DB file is missing', async () => {
            await expect(service.initialize()).resolves.toBeUndefined();
            expect((service as any).lookup).toBeNull();
        });
    });

    // -----------------------------------------------------------------------
    // 7. IP normalization / getClientIP edge cases
    // -----------------------------------------------------------------------
    describe('getClientIP()', () => {
        it('should prefer cf-connecting-ip over other headers', () => {
            const req = makeReq({
                cfConnectingIp: '203.0.113.1',
                xForwardedFor: '10.0.0.1',
                xRealIp: '10.0.0.2'
            });
            expect(service.getClientIP(req)).toBe('203.0.113.1');
        });

        it('should extract first IP from x-forwarded-for when cf header absent', () => {
            const req = makeReq({ xForwardedFor: '203.0.113.2, 10.0.0.1, 172.16.0.1' });
            expect(service.getClientIP(req)).toBe('203.0.113.2');
        });

        it('should use x-real-ip when x-forwarded-for is absent', () => {
            const req = makeReq({ xRealIp: '203.0.113.3' });
            expect(service.getClientIP(req)).toBe('203.0.113.3');
        });

        it('should fall back to socket remoteAddress when no headers present', () => {
            const req = makeReq({ remoteAddress: '203.0.113.4' });
            expect(service.getClientIP(req)).toBe('203.0.113.4');
        });

        it('should return 127.0.0.1 as ultimate fallback when no address available', () => {
            const req = { headers: {}, connection: {}, socket: {} };
            expect(service.getClientIP(req)).toBe('127.0.0.1');
        });

        it('should handle IPv4-mapped IPv6 address in cf-connecting-ip', () => {
            // The raw header value is what the service returns; normalization
            // of ::ffff: prefix is handled by the MaxMind lookup layer.
            const req = makeReq({ cfConnectingIp: '::ffff:203.0.113.5' });
            const ip = service.getClientIP(req);
            // Should at least return the IP (not empty / undefined)
            expect(ip).toBeTruthy();
            expect(ip).toContain('203.0.113.5');
        });

        it('should trim whitespace from x-forwarded-for entries', () => {
            const req = makeReq({ xForwardedFor: '  203.0.113.6  , 10.0.0.1' });
            expect(service.getClientIP(req)).toBe('203.0.113.6');
        });

        it('should handle a single IP in x-forwarded-for without comma', () => {
            const req = makeReq({ xForwardedFor: '203.0.113.7' });
            expect(service.getClientIP(req)).toBe('203.0.113.7');
        });
    });
});
