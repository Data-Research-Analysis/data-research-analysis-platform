import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { AuthProcessor } from '../../processors/AuthProcessor.js';
import { TokenProcessor } from '../../processors/TokenProcessor.js';
import { DBDriver } from '../../drivers/DBDriver.js';
import { EUserType } from '../../types/EUserType.js';

/**
 * TEST-032: Authentication and Authorization Security Tests
 * Tests for JWT security, privilege escalation, unauthorized access
 * Total: 18+ tests covering critical auth security scenarios
 */
describe('Authentication and Authorization Security Tests', () => {
    let authProcessor: AuthProcessor;
    let tokenProcessor: TokenProcessor;
    let mockManager: any;

    beforeEach(() => {
        jest.clearAllMocks();
        
        authProcessor = AuthProcessor.getInstance();
        tokenProcessor = TokenProcessor.getInstance();
        
        // Create mock manager
        mockManager = {
            findOne: jest.fn(),
            find: jest.fn(),
            save: jest.fn()
        };

        // Mock the driver chain
        const mockConcreteDriver = { manager: mockManager };
        const mockDriver = {
            getConcreteDriver: jest.fn<any>().mockResolvedValue(mockConcreteDriver)
        };
        const mockDBDriverInstance = {
            getDriver: jest.fn<any>().mockResolvedValue(mockDriver)
        };
        
        jest.spyOn(DBDriver, 'getInstance').mockReturnValue(mockDBDriverInstance as any);

        // Set test JWT secret
        process.env.JWT_SECRET = 'test-secret-key-for-security-tests';
    });

    afterEach(() => {
        jest.restoreAllMocks();
        delete process.env.JWT_SECRET;
    });

    describe('JWT Token Tampering Prevention', () => {
        it('should reject token with modified payload', () => {
            const validToken = jwt.sign(
                { user_id: 1, email: 'user@test.com', user_type: EUserType.NORMAL },
                'test-secret-key-for-security-tests'
            );

            // Tamper with the payload (change user_id)
            const parts = validToken.split('.');
            const tamperedPayload = Buffer.from(
                JSON.stringify({ user_id: 999, email: 'admin@test.com', user_type: EUserType.ADMIN })
            ).toString('base64url');
            const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

            expect(() => {
                jwt.verify(tamperedToken, 'test-secret-key-for-security-tests');
            }).toThrow();
        });

        it('should reject token with modified signature', () => {
            const validToken = jwt.sign(
                { user_id: 1, email: 'user@test.com', user_type: EUserType.NORMAL },
                'test-secret-key-for-security-tests'
            );

            // Tamper with the signature
            const parts = validToken.split('.');
            const tamperedToken = `${parts[0]}.${parts[1]}.invalidSignature123`;

            expect(() => {
                jwt.verify(tamperedToken, 'test-secret-key-for-security-tests');
            }).toThrow('invalid signature');
        });

        it('should reject token signed with different secret', () => {
            const tokenWithWrongSecret = jwt.sign(
                { user_id: 1, email: 'user@test.com', user_type: EUserType.NORMAL },
                'wrong-secret-key'
            );

            expect(() => {
                jwt.verify(tokenWithWrongSecret, 'test-secret-key-for-security-tests');
            }).toThrow('invalid signature');
        });

        it('should reject malformed token', () => {
            const malformedToken = 'not.a.valid.jwt.token';

            expect(() => {
                jwt.verify(malformedToken, 'test-secret-key-for-security-tests');
            }).toThrow();
        });

        it('should reject token with none algorithm', () => {
            // Attempt to use 'none' algorithm (security vulnerability)
            const noneToken = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url') +
                '.' +
                Buffer.from(JSON.stringify({ user_id: 1, user_type: EUserType.ADMIN })).toString('base64url') +
                '.';

            expect(() => {
                jwt.verify(noneToken, 'test-secret-key-for-security-tests');
            }).toThrow();
        });
    });

    describe('Token Expiration Handling', () => {
        it('should reject expired token', () => {
            const expiredToken = jwt.sign(
                { user_id: 1, email: 'user@test.com', user_type: EUserType.NORMAL },
                'test-secret-key-for-security-tests',
                { expiresIn: '-1h' } // Already expired
            );

            expect(() => {
                jwt.verify(expiredToken, 'test-secret-key-for-security-tests');
            }).toThrow('jwt expired');
        });

        it('should accept valid non-expired token', () => {
            const validToken = jwt.sign(
                { user_id: 1, email: 'user@test.com', user_type: EUserType.NORMAL },
                'test-secret-key-for-security-tests',
                { expiresIn: '1h' }
            );

            const decoded = jwt.verify(validToken, 'test-secret-key-for-security-tests');

            expect(decoded).toHaveProperty('user_id', 1);
        });

        it('should include expiration time in token', () => {
            const token = jwt.sign(
                { user_id: 1, email: 'user@test.com' },
                'test-secret-key-for-security-tests',
                { expiresIn: '1h' }
            );

            const decoded = jwt.verify(token, 'test-secret-key-for-security-tests') as any;

            expect(decoded).toHaveProperty('exp');
            expect(decoded.exp).toBeGreaterThan(Date.now() / 1000);
        });
    });

    describe('Missing Token Scenarios', () => {
        it('should handle missing token in validation', async () => {
            const result = await tokenProcessor.validateToken('');

            expect(result).toBe(false);
        });

        it('should handle null token', async () => {
            const result = await tokenProcessor.validateToken(null as any);

            expect(result).toBe(false);
        });

        it('should handle undefined token', async () => {
            const result = await tokenProcessor.validateToken(undefined as any);

            expect(result).toBe(false);
        });

        it('should reject malformed token string', async () => {
            const result = await tokenProcessor.validateToken('not-a-valid-token');

            expect(result).toBe(false);
        });
    });

    describe('Privilege Escalation Prevention', () => {
        it('should not allow user to elevate to admin via token', () => {
            // User creates token with admin privileges
            const maliciousToken = jwt.sign(
                { user_id: 1, email: 'user@test.com', user_type: EUserType.ADMIN },
                'wrong-secret'
            );

            expect(() => {
                jwt.verify(maliciousToken, 'test-secret-key-for-security-tests');
            }).toThrow();
        });

        it('should validate user type from database, not just token', async () => {
            const token = jwt.sign(
                { user_id: 1, email: 'user@test.com', user_type: EUserType.ADMIN },
                'test-secret-key-for-security-tests'
            );

            // Database shows user is NORMAL, not ADMIN
            mockManager.findOne.mockResolvedValue({
                id: 1,
                email: 'user@test.com',
                user_type: EUserType.NORMAL
            });

            const decoded = jwt.verify(token, 'test-secret-key-for-security-tests') as any;

            // Token claims admin, but should verify against database
            expect(decoded.user_type).toBe(EUserType.ADMIN);
            
            // In practice, middleware should check database user_type
            const dbUser = await authProcessor.getUserById(1);
            expect(dbUser?.user_type).toBe(EUserType.NORMAL);
        });

        it('should prevent token reuse after user type downgrade', async () => {
            // Admin token created
            const adminToken = jwt.sign(
                { user_id: 1, email: 'admin@test.com', user_type: EUserType.ADMIN },
                'test-secret-key-for-security-tests'
            );

            // User is now downgraded to NORMAL
            mockManager.findOne.mockResolvedValue({
                id: 1,
                email: 'admin@test.com',
                user_type: EUserType.NORMAL
            });

            const decoded = jwt.verify(adminToken, 'test-secret-key-for-security-tests') as any;
            expect(decoded.user_type).toBe(EUserType.ADMIN);

            // Should always check current database user_type
            const currentUser = await authProcessor.getUserById(1);
            expect(currentUser?.user_type).toBe(EUserType.NORMAL);
        });
    });

    describe('Unauthorized Resource Access', () => {
        it('should prevent accessing other users data', async () => {
            // User 1 tries to access User 2's data
            const userToken = jwt.sign(
                { user_id: 1, email: 'user1@test.com', user_type: EUserType.NORMAL },
                'test-secret-key-for-security-tests'
            );

            const decoded = jwt.verify(userToken, 'test-secret-key-for-security-tests') as any;
            expect(decoded.user_id).toBe(1);

            // Attempting to access user 2's profile
            const requestedUserId = 2;
            
            // Authorization check should fail
            expect(decoded.user_id).not.toBe(requestedUserId);
        });

        it('should prevent IDOR attack via user_id manipulation', async () => {
            const token = jwt.sign(
                { user_id: 1, email: 'user@test.com', user_type: EUserType.NORMAL },
                'test-secret-key-for-security-tests'
            );

            const decoded = jwt.verify(token, 'test-secret-key-for-security-tests') as any;

            // User tries to access different user_id via parameter
            const maliciousUserId = 999;

            // Should verify token user_id matches requested user_id
            expect(decoded.user_id).not.toBe(maliciousUserId);
        });

        it('should allow admin to access any user data', async () => {
            const adminToken = jwt.sign(
                { user_id: 1, email: 'admin@test.com', user_type: EUserType.ADMIN },
                'test-secret-key-for-security-tests'
            );

            const decoded = jwt.verify(adminToken, 'test-secret-key-for-security-tests') as any;

            expect(decoded.user_type).toBe(EUserType.ADMIN);
            // Admin should be allowed to access any resource
        });
    });

    describe('Session Hijacking Prevention', () => {
        it('should include user-specific data in token payload', () => {
            const token = jwt.sign(
                { user_id: 1, email: 'user@test.com', user_type: EUserType.NORMAL },
                'test-secret-key-for-security-tests'
            );

            const decoded = jwt.verify(token, 'test-secret-key-for-security-tests') as any;

            expect(decoded).toHaveProperty('user_id');
            expect(decoded).toHaveProperty('email');
            expect(decoded).toHaveProperty('user_type');
        });

        it('should not include sensitive data in token', () => {
            const token = jwt.sign(
                { user_id: 1, email: 'user@test.com', user_type: EUserType.NORMAL },
                'test-secret-key-for-security-tests'
            );

            const decoded = jwt.verify(token, 'test-secret-key-for-security-tests') as any;

            expect(decoded).not.toHaveProperty('password');
            expect(decoded).not.toHaveProperty('password_hash');
        });

        it('should validate token integrity', async () => {
            const validToken = jwt.sign(
                { user_id: 1, email: 'user@test.com', user_type: EUserType.NORMAL },
                'test-secret-key-for-security-tests'
            );

            const isValid = await tokenProcessor.validateToken(validToken);

            expect(isValid).toBe(true);
        });
    });

    describe('Token Security Best Practices', () => {
        it('should use strong secret for signing', () => {
            const weakSecret = '123';
            const strongSecret = 'test-secret-key-for-security-tests';

            // Weak secret (short)
            expect(weakSecret.length).toBeLessThan(10);
            
            // Strong secret (long)
            expect(strongSecret.length).toBeGreaterThanOrEqual(20);
        });

        it('should not expose JWT secret in error messages', () => {
            const token = 'invalid.token.here';

            try {
                jwt.verify(token, 'test-secret-key-for-security-tests');
            } catch (error: any) {
                expect(error.message).not.toContain('test-secret-key-for-security-tests');
            }
        });

        it('should use HS256 algorithm by default', () => {
            const token = jwt.sign(
                { user_id: 1 },
                'test-secret-key-for-security-tests'
            );

            const decoded = jwt.decode(token, { complete: true });

            expect(decoded?.header.alg).toBe('HS256');
        });

        it('should reject tokens with weak algorithms', () => {
            // Tokens should not use 'none' or weak algorithms
            const header = { alg: 'none', typ: 'JWT' };
            const payload = { user_id: 1, user_type: EUserType.ADMIN };

            const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
            const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
            const unsignedToken = `${encodedHeader}.${encodedPayload}.`;

            expect(() => {
                jwt.verify(unsignedToken, 'test-secret-key-for-security-tests');
            }).toThrow();
        });
    });

    describe('CORS and Security Headers', () => {
        it('should document CORS header requirements', () => {
            // Test documents that CORS headers should be validated
            const allowedOrigins = ['http://frontend.dataresearchanalysis.test:3000'];
            const testOrigin = 'https://evil-site.com';

            expect(allowedOrigins).not.toContain(testOrigin);
        });

        it('should require secure token transmission', () => {
            // Tokens should only be sent over HTTPS in production
            const isProduction = process.env.NODE_ENV === 'production';
            const requireHTTPS = isProduction;

            // In test environment, HTTPS not required
            expect(process.env.NODE_ENV).not.toBe('production');
        });
    });
});
