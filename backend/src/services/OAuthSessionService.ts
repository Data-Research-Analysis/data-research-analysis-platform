import { getRedisClient, RedisTTL } from '../config/redis.config.js';
import { EncryptionService } from './EncryptionService.js';
import { v4 as uuidv4 } from 'uuid';
import type { IOAuthTokens } from '../types/IOAuthTokens.js';

/**
 * Stored OAuth session data structure
 */
interface OAuthSessionData {
    sessionId: string;
    userId: number;
    projectId: number;
    tokens: IOAuthTokens;
    createdAt: string;
    expiresAt: string;
}

/**
 * OAuth Session Service
 * 
 * Securely stores OAuth tokens in Redis with encryption.
 * Addresses CWE-312, CWE-315, CWE-359 by preventing clear text token storage in browser sessionStorage.
 * 
 * Security Features:
 * - Tokens encrypted at rest in Redis using EncryptionService
 * - Short-lived session IDs (15 minutes TTL)
 * - Automatic cleanup of expired sessions
 * - No sensitive data in client-side storage
 */
export class OAuthSessionService {
    private static instance: OAuthSessionService;
    private redis = getRedisClient();
    private encryptionService = EncryptionService.getInstance();
    
    // Session TTL: 15 minutes (OAuth flow should complete quickly)
    private readonly SESSION_TTL = 15 * 60; // 15 minutes in seconds
    
    // Cleanup interval: every 30 minutes
    private readonly CLEANUP_INTERVAL_MS = 30 * 60 * 1000;
    private cleanupIntervalId?: NodeJS.Timeout;
    
    private constructor() {
        // Start automatic cleanup of orphaned sessions
        this.startCleanupScheduler();
    }
    
    public static getInstance(): OAuthSessionService {
        if (!OAuthSessionService.instance) {
            OAuthSessionService.instance = new OAuthSessionService();
        }
        return OAuthSessionService.instance;
    }
    
    /**
     * Start automatic cleanup scheduler
     */
    private startCleanupScheduler(): void {
        this.cleanupIntervalId = setInterval(async () => {
            try {
                const cleanedCount = await this.cleanupExpiredSessions();
                if (cleanedCount > 0) {
                    console.log(`🧹 OAuth Session Cleanup: Removed ${cleanedCount} orphaned sessions`);
                }
            } catch (error) {
                console.error('OAuth session cleanup error:', error);
            }
        }, this.CLEANUP_INTERVAL_MS);
        
        console.log(`✅ OAuth session cleanup scheduler started (every ${this.CLEANUP_INTERVAL_MS / 60000} minutes)`);
    }
    
    /**
     * Stop the cleanup scheduler (for testing/shutdown)
     */
    public stopCleanupScheduler(): void {
        if (this.cleanupIntervalId) {
            clearInterval(this.cleanupIntervalId);
            this.cleanupIntervalId = undefined;
            console.log('🛑 OAuth session cleanup scheduler stopped');
        }
    }
    
    /**
     * Generate Redis key for OAuth session
     */
    private getSessionKey(sessionId: string): string {
        return `oauth:session:${sessionId}`;
    }
    
    /**
     * Generate Redis key for user's active OAuth session lookup
     */
    private getUserSessionKey(userId: number, projectId: number): string {
        return `oauth:user:${userId}:project:${projectId}`;
    }
    
    /**
     * Store OAuth tokens securely in Redis
     * 
     * @param userId - User ID associated with the tokens
     * @param projectId - Project ID for the OAuth flow
     * @param tokens - OAuth tokens to store
     * @returns Session ID for client-side reference
     */
    async storeTokens(userId: number, projectId: number, tokens: IOAuthTokens): Promise<string> {
        const sessionId = uuidv4();
        const sessionKey = this.getSessionKey(sessionId);
        const userSessionKey = this.getUserSessionKey(userId, projectId);
        
        // Encrypt sensitive token data
        const encryptedAccessToken = this.encryptionService.encryptString(tokens.access_token);
        const encryptedRefreshToken = tokens.refresh_token 
            ? this.encryptionService.encryptString(tokens.refresh_token)
            : null;
        
        const sessionData: OAuthSessionData = {
            sessionId,
            userId,
            projectId,
            tokens: {
                ...tokens,
                access_token: encryptedAccessToken,
                refresh_token: encryptedRefreshToken || undefined,
            },
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + this.SESSION_TTL * 1000).toISOString(),
        };
        
        // Store session data with encryption
        await this.redis.set(sessionKey, JSON.stringify(sessionData));
        await this.redis.expire(sessionKey, this.SESSION_TTL);
        
        // Store user -> session mapping for easy lookup
        await this.redis.set(userSessionKey, sessionId);
        await this.redis.expire(userSessionKey, this.SESSION_TTL);
        
        console.log(`✅ OAuth session created: ${sessionId} (user: ${userId}, project: ${projectId})`);
        
        return sessionId;
    }
    
    /**
     * Retrieve OAuth tokens from Redis by session ID
     * 
     * @param sessionId - Session ID returned from storeTokens
     * @returns Decrypted OAuth tokens or null if not found/expired
     */
    async getTokens(sessionId: string): Promise<IOAuthTokens | null> {
        const sessionKey = this.getSessionKey(sessionId);
        
        const sessionDataJson = await this.redis.get(sessionKey);
        if (!sessionDataJson) {
            console.warn(`⚠️  OAuth session not found or expired: ${sessionId}`);
            return null;
        }
        
        try {
            const sessionData: OAuthSessionData = JSON.parse(sessionDataJson);
            
            // Decrypt tokens
            const decryptedAccessToken = this.encryptionService.decryptString(sessionData.tokens.access_token);
            const decryptedRefreshToken = sessionData.tokens.refresh_token
                ? this.encryptionService.decryptString(sessionData.tokens.refresh_token)
                : undefined;
            
            const tokens: IOAuthTokens = {
                ...sessionData.tokens,
                access_token: decryptedAccessToken,
                refresh_token: decryptedRefreshToken,
            };
            
            console.log(`✅ OAuth tokens retrieved for session: ${sessionId}`);
            
            return tokens;
        } catch (error) {
            console.error(`❌ Failed to decrypt OAuth tokens for session ${sessionId}:`, error);
            // Delete corrupted session
            await this.deleteSession(sessionId);
            return null;
        }
    }
    
    /**
     * Get tokens by user ID and project ID
     * 
     * @param userId - User ID
     * @param projectId - Project ID
     * @returns Decrypted OAuth tokens or null if not found/expired
     */
    async getTokensByUser(userId: number, projectId: number): Promise<IOAuthTokens | null> {
        const userSessionKey = this.getUserSessionKey(userId, projectId);
        const sessionId = await this.redis.get(userSessionKey);
        
        if (!sessionId) {
            return null;
        }
        
        return this.getTokens(sessionId);
    }
    
    /**
     * Delete OAuth session from Redis
     * 
     * @param sessionId - Session ID to delete
     */
    async deleteSession(sessionId: string): Promise<void> {
        const sessionKey = this.getSessionKey(sessionId);
        
        // Get session data to find user mapping
        const sessionDataJson = await this.redis.get(sessionKey);
        if (sessionDataJson) {
            try {
                const sessionData: OAuthSessionData = JSON.parse(sessionDataJson);
                const userSessionKey = this.getUserSessionKey(sessionData.userId, sessionData.projectId);
                await this.redis.del(userSessionKey);
            } catch (error) {
                console.error(`Failed to parse session data for deletion: ${sessionId}`, error);
            }
        }
        
        // Delete session
        await this.redis.del(sessionKey);
        console.log(`🗑️  OAuth session deleted: ${sessionId}`);
    }
    
    /**
     * Delete user's OAuth session by user ID and project ID
     * 
     * @param userId - User ID
     * @param projectId - Project ID
     */
    async deleteUserSession(userId: number, projectId: number): Promise<void> {
        const userSessionKey = this.getUserSessionKey(userId, projectId);
        const sessionId = await this.redis.get(userSessionKey);
        
        if (sessionId) {
            await this.deleteSession(sessionId);
        } else {
            // Clean up orphaned user mapping
            await this.redis.del(userSessionKey);
        }
    }
    
    /**
     * Extend session TTL (e.g., when tokens are used successfully)
     * 
     * @param sessionId - Session ID to extend
     */
    async extendSession(sessionId: string): Promise<void> {
        const sessionKey = this.getSessionKey(sessionId);
        
        // Check if session exists
        const exists = await this.redis.exists(sessionKey);
        if (exists) {
            await this.redis.expire(sessionKey, this.SESSION_TTL);
            console.log(`⏱️  OAuth session extended: ${sessionId}`);
        }
    }
    
    /**
     * Check if session exists and is valid
     * 
     * @param sessionId - Session ID to check
     * @returns True if session exists, false otherwise
     */
    async sessionExists(sessionId: string): Promise<boolean> {
        const sessionKey = this.getSessionKey(sessionId);
        const exists = await this.redis.exists(sessionKey);
        return exists === 1;
    }
    
    /**
     * Cleanup expired sessions (called by scheduled job)
     * Note: Redis automatically handles expiration, this is for additional cleanup
     */
    async cleanupExpiredSessions(): Promise<number> {
        try {
            const pattern = 'oauth:session:*';
            const keys = await this.redis.keys(pattern);
            
            let cleanedCount = 0;
            
            for (const key of keys) {
                const ttl = await this.redis.ttl(key);
                
                // If TTL is -1 (no expiration set) or -2 (key doesn't exist), clean it up
                if (ttl === -1 || ttl === -2) {
                    await this.redis.del(key);
                    cleanedCount++;
                }
            }
            
            if (cleanedCount > 0) {
                console.log(`🧹 Cleaned up ${cleanedCount} orphaned OAuth sessions`);
            }
            
            return cleanedCount;
        } catch (error) {
            console.error('Failed to cleanup expired OAuth sessions:', error);
            return 0;
        }
    }
}
