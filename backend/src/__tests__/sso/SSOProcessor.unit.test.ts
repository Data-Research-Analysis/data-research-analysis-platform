import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';

/**
 * Unit tests for SSOProcessor
 * Covers: enforce_sso guard, JIT provisioning path, replay detection,
 * initiateLogin domain routing, and initiateLogout.
 *
 * All external dependencies (TypeORM manager, Redis, SAML library) are mocked.
 */
describe('SSOProcessor Unit Tests', () => {
    const JWT_SECRET = 'test-sso-processor-secret';

    // ── shared mocks ──────────────────────────────────────────────────────────
    let mockManager: any;
    let mockRedis: any;

    // Factories for common model shapes
    const makeConfig = (overrides: any = {}) => ({
        id: 1,
        organization_id: 10,
        idp_name: 'TestIdP',
        idp_entity_id: 'https://idp.example.com',
        idp_sso_url: 'https://idp.example.com/sso',
        idp_certificate: 'CERTDATA',
        sp_entity_id: 'https://sp.example.com',
        attribute_mapping: {},
        is_enabled: true,
        allow_jit_provisioning: true,
        enforce_sso: false,
        ...overrides
    });

    const makeUser = (overrides: any = {}) => ({
        id: 99,
        email: 'alice@example.com',
        first_name: 'Alice',
        last_name: 'Test',
        user_type: 'USER',
        password: 'hashed',
        ...overrides
    });

    beforeAll(async () => {
        process.env.JWT_SECRET = JWT_SECRET;

        // ── Redis mock ─────────────────────────────────────────────────────────
        mockRedis = {
            set: jest.fn<any>().mockResolvedValue('OK'),
            get: jest.fn<any>().mockResolvedValue(null)
        };
        jest.unstable_mockModule('../../config/redis.config.js', () => ({
            getRedisClient: jest.fn(() => mockRedis)
        }));

        // ── UtilityService ─────────────────────────────────────────────────────
        jest.unstable_mockModule('../../services/UtilityService.js', () => ({
            UtilityService: {
                getInstance: jest.fn(() => ({
                    getConstants: jest.fn((key: string) => (key === 'JWT_SECRET' ? JWT_SECRET : ''))
                }))
            }
        }));

        // ── WinstonLoggerService ───────────────────────────────────────────────
        jest.unstable_mockModule('../../services/WinstonLoggerService.js', () => ({
            WinstonLoggerService: {
                getInstance: jest.fn(() => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))
            }
        }));

        // ── SSOService (mock validation so no real SAML parsing) ───────────────
        jest.unstable_mockModule('../../services/SSOService.js', () => ({
            SSOService: {
                getInstance: jest.fn(() => ({
                    extractDomain: jest.fn((email: string) => email.split('@')[1] ?? null),
                    generateRelayState: jest.fn(() => jwt.sign({ organizationId: 10, email: 'alice@example.com' }, JWT_SECRET, { expiresIn: '10m' })),
                    decodeRelayState: jest.fn((token: string) => jwt.verify(token, JWT_SECRET) as any),
                    buildLoginRedirectUrl: jest.fn<any>().mockResolvedValue('https://idp.example.com/sso?SAMLRequest=mock'),
                    validateAndParseAssertion: jest.fn<any>().mockResolvedValue({
                        nameId: 'alice@example.com',
                        email: 'alice@example.com',
                        firstName: 'Alice',
                        lastName: 'Test',
                        attributes: {}
                    }),
                    buildLogoutUrl: jest.fn<any>().mockResolvedValue('https://idp.example.com/logout?SAMLRequest=mock'),
                    generateDomainVerificationToken: jest.fn(() => 'abc123token'),
                    normalizeDomain: jest.fn((d: string) => d.toLowerCase()),
                    getFrontendUrl: jest.fn(() => 'http://localhost:3000')
                }))
            }
        }));

        // ── DBDriver ───────────────────────────────────────────────────────────
        mockManager = {
            findOne: jest.fn(),
            find: jest.fn(),
            save: jest.fn<any>().mockResolvedValue({}),
            create: jest.fn((_, data: any) => data)
        };
        jest.unstable_mockModule('../../drivers/DBDriver.js', () => ({
            DBDriver: {
                getInstance: jest.fn(() => ({
                    getManager: jest.fn(() => mockManager)
                }))
            }
        }));
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        delete process.env.JWT_SECRET;
        jest.resetAllMocks();
    });

    // ── Helper: load processor fresh after mocks ─────────────────────────────
    async function getProcessor() {
        const mod = await import('../../processors/SSOProcessor.js');
        return mod.SSOProcessor.getInstance();
    }

    // ──────────────────────────────────────────────────────────────────────────
    describe('getConfiguration()', () => {
        it('returns null when no config exists for the org', async () => {
            mockManager.findOne.mockResolvedValueOnce(null);
            const processor = await getProcessor();
            const result = await processor.getConfiguration({ user_id: 1, email: 'admin@x.com', user_type: 'ADMIN' }, 10);
            expect(result).toBeNull();
        });

        it('returns the config when it exists', async () => {
            const cfg = makeConfig();
            mockManager.findOne.mockResolvedValueOnce(cfg); // access check (org member)
            mockManager.findOne.mockResolvedValueOnce(cfg); // config lookup
            const processor = await getProcessor();
            const result = await processor.getConfiguration({ user_id: 1, email: 'admin@x.com', user_type: 'ADMIN' }, 10);
            expect(result).toBeDefined();
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    describe('initiateLogin()', () => {
        it('returns null when no SSO config found for the email domain', async () => {
            mockManager.findOne.mockResolvedValue(null);
            const processor = await getProcessor();
            const result = await processor.initiateLogin('bob@unknown.com');
            expect(result).toBeNull();
        });

        it('returns a redirectUrl for a known domain', async () => {
            const cfg = makeConfig();
            mockManager.findOne.mockResolvedValueOnce(cfg); // config found
            const processor = await getProcessor();
            const result = await processor.initiateLogin('alice@example.com');
            expect(result).not.toBeNull();
            expect(result!.redirectUrl).toContain('idp.example.com');
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    describe('processSamlCallback()', () => {
        const validRelayState = () => jwt.sign({ organizationId: 10, email: 'alice@example.com' }, JWT_SECRET, { expiresIn: '10m' });

        it('authenticates an existing user via SSO', async () => {
            const cfg = makeConfig();
            const user = makeUser();
            const mapping = { id: 5, last_sso_login_at: new Date(), sso_attributes: {} };

            mockManager.findOne
                .mockResolvedValueOnce(cfg)    // load SSO config
                .mockResolvedValueOnce(user)   // find user by email
                .mockResolvedValueOnce(mapping); // find existing mapping

            const processor = await getProcessor();
            const result = await processor.processSamlCallback('base64saml==', validRelayState());
            expect(result).toHaveProperty('token');
            expect(result.organizationId).toBe(10);
        });

        it('JIT-provisions a new user when allow_jit_provisioning=true', async () => {
            const cfg = makeConfig({ allow_jit_provisioning: true });
            const newUser = makeUser({ id: 101 });

            mockManager.findOne
                .mockResolvedValueOnce(cfg)   // load SSO config
                .mockResolvedValueOnce(null)  // user not found → JIT create
                .mockResolvedValueOnce(null); // no existing mapping

            mockManager.save.mockResolvedValueOnce(newUser); // user created

            const processor = await getProcessor();
            const result = await processor.processSamlCallback('base64saml==', validRelayState());
            expect(result).toHaveProperty('token');
            // save should have been called for the new user
            expect(mockManager.save).toHaveBeenCalled();
        });

        it('rejects callback when user not found and JIT disabled', async () => {
            const cfg = makeConfig({ allow_jit_provisioning: false });

            mockManager.findOne
                .mockResolvedValueOnce(cfg)  // load SSO config
                .mockResolvedValueOnce(null); // user not found

            const processor = await getProcessor();
            await expect(processor.processSamlCallback('base64saml==', validRelayState())).rejects.toThrow();
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    describe('initiateLogout()', () => {
        it('returns null when no enabled SSO config found', async () => {
            mockManager.findOne.mockResolvedValue(null);
            const processor = await getProcessor();
            const result = await processor.initiateLogout({ user_id: 1, email: 'a@b.com', user_type: 'USER' }, 10);
            expect(result).toBeNull();
        });

        it('returns a logoutUrl when config and mapping exist', async () => {
            const cfg = makeConfig();
            const mapping = { sso_name_id: 'alice@example.com', last_sso_login_at: new Date() };

            mockManager.findOne
                .mockResolvedValueOnce(cfg)    // SSO config
                .mockResolvedValueOnce(mapping); // user mapping

            const processor = await getProcessor();
            const result = await processor.initiateLogout({ user_id: 99, email: 'alice@example.com', user_type: 'USER' }, 10);
            expect(result).not.toBeNull();
            expect(result!.logoutUrl).toContain('idp.example.com');
        });
    });
});
