import { jest } from '@jest/globals';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

/**
 * Unit tests for SSOService
 * Tests domain extraction, relay state signing/verification, PEM normalisation,
 * and domain verification token generation without hitting external services.
 */
describe('SSOService Unit Tests', () => {
    let SSOService: any;
    let ssoService: any;

    const JWT_SECRET = 'test-sso-secret-key';

    beforeAll(async () => {
        process.env.JWT_SECRET = JWT_SECRET;
        process.env.BACKEND_URL = 'http://localhost:3002';
        process.env.FRONTEND_URL = 'http://localhost:3000';

        // Mock Redis so the service can initialise without a real connection
        jest.unstable_mockModule('../../config/redis.config.js', () => ({
            getRedisClient: jest.fn(() => ({
                set: jest.fn<any>().mockResolvedValue('OK'),
                get: jest.fn<any>().mockResolvedValue(null)
            }))
        }));

        // Mock UtilityService
        jest.unstable_mockModule('../../services/UtilityService.js', () => ({
            UtilityService: {
                getInstance: jest.fn(() => ({
                    getConstants: jest.fn((key: string) => {
                        if (key === 'JWT_SECRET') return JWT_SECRET;
                        return '';
                    })
                }))
            }
        }));

        const mod = await import('../../services/SSOService.js');
        SSOService = mod.SSOService;
        ssoService = SSOService.getInstance();
    });

    afterAll(() => {
        delete process.env.JWT_SECRET;
        delete process.env.BACKEND_URL;
        delete process.env.FRONTEND_URL;
        jest.resetAllMocks();
    });

    describe('extractDomain()', () => {
        it('extracts the domain portion of a valid email', () => {
            expect(ssoService.extractDomain('alice@example.com')).toBe('example.com');
        });

        it('lowercases the domain', () => {
            expect(ssoService.extractDomain('alice@EXAMPLE.COM')).toBe('example.com');
        });

        it('returns null for an email with no @', () => {
            expect(ssoService.extractDomain('notanemail')).toBeNull();
        });

        it('returns null for an email with empty local part', () => {
            expect(ssoService.extractDomain('@example.com')).toBeNull();
        });
    });

    describe('normalizeDomain()', () => {
        it('strips http:// prefix', () => {
            expect(ssoService.normalizeDomain('http://example.com/')).toBe('example.com');
        });

        it('strips https:// prefix and trailing slash', () => {
            expect(ssoService.normalizeDomain('https://example.com/')).toBe('example.com');
        });

        it('lowercases and trims', () => {
            expect(ssoService.normalizeDomain('  EXAMPLE.COM  ')).toBe('example.com');
        });
    });

    describe('generateDomainVerificationToken()', () => {
        it('returns a 48-character hex string', () => {
            const token = ssoService.generateDomainVerificationToken();
            expect(token).toMatch(/^[0-9a-f]{48}$/);
        });

        it('generates unique tokens each call', () => {
            const tokens = new Set(Array.from({ length: 10 }, () => ssoService.generateDomainVerificationToken()));
            expect(tokens.size).toBe(10);
        });
    });

    describe('generateRelayState() / decodeRelayState()', () => {
        it('round-trips an IRelayStatePayload', () => {
            const payload = { organizationId: 42, email: 'alice@example.com' };
            const token = ssoService.generateRelayState(payload);
            const decoded = ssoService.decodeRelayState(token);
            expect(decoded.organizationId).toBe(42);
            expect(decoded.email).toBe('alice@example.com');
        });

        it('throws when the relay state is tampered', () => {
            const token = ssoService.generateRelayState({ organizationId: 1, email: 'a@b.com' });
            const [header, payload, sig] = token.split('.');
            const tampered = `${header}.${payload}.invalidsignature`;
            expect(() => ssoService.decodeRelayState(tampered)).toThrow();
        });

        it('throws when relay state JWT is expired', () => {
            // Sign with 0s expiry
            const expired = jwt.sign(
                { organizationId: 1, email: 'a@b.com', iat: Math.floor(Date.now() / 1000) - 100 },
                JWT_SECRET,
                { expiresIn: '1ms' }
            );
            expect(() => ssoService.decodeRelayState(expired)).toThrow();
        });
    });

    describe('getFrontendUrl()', () => {
        it('returns the FRONTEND_URL environment variable', () => {
            expect(ssoService.getFrontendUrl()).toBe('http://localhost:3000');
        });
    });
});
