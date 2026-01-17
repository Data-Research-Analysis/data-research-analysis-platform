import { jest } from '@jest/globals';
import type { IOAuthTokens } from '../../types/IOAuthTokens.js';

// Create mocks
const mockRedis: any = {
    set: jest.fn<any>().mockResolvedValue('OK'),
    get: jest.fn<any>().mockResolvedValue(null),
    del: jest.fn<any>().mockResolvedValue(1),
    expire: jest.fn<any>().mockResolvedValue(1),
    exists: jest.fn<any>().mockResolvedValue(0),
    ttl: jest.fn<any>().mockResolvedValue(-2),
    keys: jest.fn<any>().mockResolvedValue([]),
};

const mockEncryption: any = {
    encryptString: jest.fn<any>((str: string) => `encrypted_${str}`),
    decryptString: jest.fn<any>((str: string) => str.replace('encrypted_', '')),
};

// Mock modules before importing service
jest.unstable_mockModule('../../config/redis.config.js', () => ({
    getRedisClient: jest.fn(() => mockRedis),
    RedisTTL: {},
}));

jest.unstable_mockModule('../EncryptionService.js', () => ({
    EncryptionService: {
        getInstance: jest.fn(() => mockEncryption),
    },
}));

// Now import the service
const { OAuthSessionService } = await import('../OAuthSessionService.js');

describe('OAuthSessionService', () => {
    let service: any;

    const mockTokens: IOAuthTokens = {
        access_token: 'mock_access_token_12345',
        refresh_token: 'mock_refresh_token_67890',
        token_type: 'Bearer',
        expires_in: 3600,
        expiry_date: Date.now() + 3600000,
    };

    const mockUserId = 999;
    const mockProjectId = 456;

    afterAll(() => {
        // Stop the cleanup scheduler to prevent open handles
        if (service && service.stopCleanupScheduler) {
            service.stopCleanupScheduler();
        }
    });

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();
        
        // Reset mock implementations
        mockRedis.set.mockResolvedValue('OK');
        mockRedis.get.mockResolvedValue(null);
        mockRedis.del.mockResolvedValue(1);
        mockRedis.expire.mockResolvedValue(1);
        mockRedis.exists.mockResolvedValue(0);
        mockRedis.ttl.mockResolvedValue(-2);
        mockRedis.keys.mockResolvedValue([]);
        
        mockEncryption.encryptString.mockImplementation((str: string) => `encrypted_${str}`);
        mockEncryption.decryptString.mockImplementation((str: string) => str.replace('encrypted_', ''));
        
        // Get service instance
        service = OAuthSessionService.getInstance();
    });

    describe('storeTokens', () => {
        it('should store OAuth tokens with encryption in Redis', async () => {
            const sessionId = await service.storeTokens(mockUserId, mockProjectId, mockTokens);

            // Verify sessionId is a valid UUID
            expect(sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

            // Verify encryption was called for sensitive data
            expect(mockEncryption.encryptString).toHaveBeenCalledWith(mockTokens.access_token);
            expect(mockEncryption.encryptString).toHaveBeenCalledWith(mockTokens.refresh_token);

            // Verify Redis operations
            expect(mockRedis.set).toHaveBeenCalledTimes(2); // session data + user mapping
            expect(mockRedis.expire).toHaveBeenCalledTimes(2); // TTL for both keys
        });

        it('should handle tokens without refresh_token', async () => {
            const tokensWithoutRefresh = { ...mockTokens, refresh_token: undefined };

            const sessionId = await service.storeTokens(mockUserId, mockProjectId, tokensWithoutRefresh);

            expect(sessionId).toBeDefined();
            expect(mockEncryption.encryptString).toHaveBeenCalledTimes(1); // Only access_token
        });

        it('should set proper TTL (15 minutes)', async () => {
            await service.storeTokens(mockUserId, mockProjectId, mockTokens);

            expect(mockRedis.expire).toHaveBeenCalledWith(expect.any(String), 900); // 15 * 60 = 900 seconds
        });

        it('should create user-to-session mapping', async () => {
            const sessionId = await service.storeTokens(mockUserId, mockProjectId, mockTokens);

            const userSessionKey = `oauth:user:${mockUserId}:project:${mockProjectId}`;
            expect(mockRedis.set).toHaveBeenCalledWith(userSessionKey, sessionId);
        });
    });

    describe('getTokens', () => {
        it('should retrieve and decrypt OAuth tokens', async () => {
            const sessionId = 'test-session-id';
            const mockSessionData = {
                sessionId,
                userId: mockUserId,
                projectId: mockProjectId,
                tokens: {
                    access_token: 'encrypted_mock_access_token_12345',
                    refresh_token: 'encrypted_mock_refresh_token_67890',
                    token_type: 'Bearer',
                    expires_in: 3600,
                    expiry_date: mockTokens.expiry_date,
                },
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 900000).toISOString(),
            };

            mockRedis.get.mockResolvedValue(JSON.stringify(mockSessionData));

            const tokens = await service.getTokens(sessionId);

            expect(tokens).toEqual(mockTokens);
            expect(mockEncryption.decryptString).toHaveBeenCalledWith('encrypted_mock_access_token_12345');
            expect(mockEncryption.decryptString).toHaveBeenCalledWith('encrypted_mock_refresh_token_67890');
        });

        it('should return null for non-existent session', async () => {
            mockRedis.get.mockResolvedValue(null);

            const tokens = await service.getTokens('invalid-session-id');

            expect(tokens).toBeNull();
        });

        it('should handle decryption errors and delete corrupted session', async () => {
            const sessionId = 'corrupt-session-id';
            mockRedis.get.mockResolvedValue(JSON.stringify({ invalid: 'data' }));
            mockEncryption.decryptString.mockImplementation(() => {
                throw new Error('Decryption failed');
            });

            const tokens = await service.getTokens(sessionId);

            expect(tokens).toBeNull();
            expect(mockRedis.del).toHaveBeenCalled();
        });

        it('should handle tokens without refresh_token', async () => {
            const sessionId = 'test-session-id';
            const mockSessionData = {
                sessionId,
                userId: mockUserId,
                projectId: mockProjectId,
                tokens: {
                    access_token: 'encrypted_mock_access_token_12345',
                    token_type: 'Bearer',
                    expires_in: 3600,
                    expiry_date: mockTokens.expiry_date,
                },
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 900000).toISOString(),
            };

            mockRedis.get.mockResolvedValue(JSON.stringify(mockSessionData));

            const tokens = await service.getTokens(sessionId);

            expect(tokens?.access_token).toBe('mock_access_token_12345');
            expect(tokens?.refresh_token).toBeUndefined();
        });
    });

    describe('getTokensByUser', () => {
        it('should retrieve tokens using user ID and project ID', async () => {
            const sessionId = 'user-session-id';
            mockRedis.get.mockImplementation((key: string) => {
                if (key.includes('oauth:user:')) {
                    return Promise.resolve(sessionId);
                }
                return Promise.resolve(JSON.stringify({
                    sessionId,
                    userId: mockUserId,
                    projectId: mockProjectId,
                    tokens: {
                        access_token: 'encrypted_mock_access_token_12345',
                        refresh_token: 'encrypted_mock_refresh_token_67890',
                        token_type: 'Bearer',
                        expires_in: 3600,
                        expiry_date: mockTokens.expiry_date,
                    },
                    createdAt: new Date().toISOString(),
                    expiresAt: new Date(Date.now() + 900000).toISOString(),
                }));
            });

            const tokens = await service.getTokensByUser(mockUserId, mockProjectId);

            expect(tokens).toEqual(mockTokens);
        });

        it('should return null if user has no active session', async () => {
            mockRedis.get.mockResolvedValue(null);

            const tokens = await service.getTokensByUser(mockUserId, mockProjectId);

            expect(tokens).toBeNull();
        });
    });

    describe('deleteSession', () => {
        it('should delete session and user mapping', async () => {
            const sessionId = 'test-session-id';
            const sessionData = {
                sessionId,
                userId: mockUserId,
                projectId: mockProjectId,
                tokens: {},
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 900000).toISOString(),
            };

            mockRedis.get.mockResolvedValue(JSON.stringify(sessionData));

            await service.deleteSession(sessionId);

            expect(mockRedis.del).toHaveBeenCalledTimes(2); // session + user mapping
        });

        it('should handle deletion of non-existent session', async () => {
            mockRedis.get.mockResolvedValue(null);

            await service.deleteSession('non-existent-session');

            expect(mockRedis.del).toHaveBeenCalledTimes(1); // Only session key
        });
    });

    describe('deleteUserSession', () => {
        it('should delete user session by user ID and project ID', async () => {
            const sessionId = 'user-session-id';
            mockRedis.get.mockImplementation((key: string) => {
                if (key.includes('oauth:user:')) {
                    return Promise.resolve(sessionId);
                }
                return Promise.resolve(JSON.stringify({
                    sessionId,
                    userId: mockUserId,
                    projectId: mockProjectId,
                }));
            });

            await service.deleteUserSession(mockUserId, mockProjectId);

            expect(mockRedis.del).toHaveBeenCalledTimes(2); // session + user mapping
        });

        it('should clean up orphaned user mapping if session not found', async () => {
            mockRedis.get.mockResolvedValue(null);

            await service.deleteUserSession(mockUserId, mockProjectId);

            expect(mockRedis.del).toHaveBeenCalledTimes(1); // Only user mapping
        });
    });

    describe('extendSession', () => {
        it('should extend session TTL if session exists', async () => {
            const sessionId = 'test-session-id';
            mockRedis.exists.mockResolvedValue(1);

            await service.extendSession(sessionId);

            expect(mockRedis.expire).toHaveBeenCalledWith(expect.stringContaining(sessionId), 900);
        });

        it('should not extend TTL if session does not exist', async () => {
            mockRedis.exists.mockResolvedValue(0);

            await service.extendSession('non-existent-session');

            expect(mockRedis.expire).not.toHaveBeenCalled();
        });
    });

    describe('sessionExists', () => {
        it('should return true if session exists', async () => {
            mockRedis.exists.mockResolvedValue(1);

            const exists = await service.sessionExists('test-session-id');

            expect(exists).toBe(true);
        });

        it('should return false if session does not exist', async () => {
            mockRedis.exists.mockResolvedValue(0);

            const exists = await service.sessionExists('non-existent-session');

            expect(exists).toBe(false);
        });
    });

    describe('cleanupExpiredSessions', () => {
        it('should clean up sessions with no expiration set', async () => {
            const orphanedKeys = [
                'oauth:session:orphan-1',
                'oauth:session:orphan-2',
            ];
            mockRedis.keys.mockResolvedValue(orphanedKeys);
            mockRedis.ttl.mockResolvedValue(-1); // No expiration

            const cleanedCount = await service.cleanupExpiredSessions();

            expect(cleanedCount).toBe(2);
            expect(mockRedis.del).toHaveBeenCalledTimes(2);
        });

        it('should not clean up sessions with valid TTL', async () => {
            const validKeys = ['oauth:session:valid-1'];
            mockRedis.keys.mockResolvedValue(validKeys);
            mockRedis.ttl.mockResolvedValue(300); // 5 minutes remaining

            const cleanedCount = await service.cleanupExpiredSessions();

            expect(cleanedCount).toBe(0);
            expect(mockRedis.del).not.toHaveBeenCalled();
        });

        it('should handle cleanup errors gracefully', async () => {
            mockRedis.keys.mockRejectedValue(new Error('Redis error'));

            const cleanedCount = await service.cleanupExpiredSessions();

            expect(cleanedCount).toBe(0);
        });
    });

    describe('Security Features', () => {
        it('should never store plain text tokens in Redis', async () => {
            await service.storeTokens(mockUserId, mockProjectId, mockTokens);

            const setCall = mockRedis.set.mock.calls.find((call: any) => 
                call[0].includes('oauth:session:')
            );
            const storedData = JSON.parse(setCall[1]);

            expect(storedData.tokens.access_token).toContain('encrypted_');
            expect(storedData.tokens.access_token).not.toBe(mockTokens.access_token);
        });

        it('should use unique session IDs (UUIDs)', async () => {
            const sessionId1 = await service.storeTokens(mockUserId, mockProjectId, mockTokens);
            const sessionId2 = await service.storeTokens(mockUserId, mockProjectId + 1, mockTokens);

            expect(sessionId1).not.toBe(sessionId2);
            expect(sessionId1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        });

        it('should enforce 15-minute TTL for all sessions', async () => {
            await service.storeTokens(mockUserId, mockProjectId, mockTokens);

            const expireCalls = mockRedis.expire.mock.calls;
            expireCalls.forEach((call: any) => {
                expect(call[1]).toBe(900); // 15 * 60 seconds
            });
        });
    });

    describe('Edge Cases', () => {
        it('should handle concurrent session creation for same user/project', async () => {
            const [sessionId1, sessionId2] = await Promise.all([
                service.storeTokens(mockUserId, mockProjectId, mockTokens),
                service.storeTokens(mockUserId, mockProjectId, mockTokens),
            ]);

            // Both should succeed with unique IDs
            expect(sessionId1).not.toBe(sessionId2);
            expect(mockRedis.set).toHaveBeenCalled();
        });

        it('should handle empty or malformed token data', async () => {
            const emptyTokens = {
                access_token: '',
                token_type: 'Bearer',
                expires_in: 3600,
            };

            const sessionId = await service.storeTokens(mockUserId, mockProjectId, emptyTokens as any);

            expect(sessionId).toBeDefined();
            expect(mockEncryption.encryptString).toHaveBeenCalledWith('');
        });
    });
});
