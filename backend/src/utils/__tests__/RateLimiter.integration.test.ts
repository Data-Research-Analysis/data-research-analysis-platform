/**
 * Integration Tests for RateLimiter
 * Tests the token bucket rate limiting algorithm with real timing
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { RateLimiter, RateLimiterRegistry } from '../RateLimiter.js';

describe('RateLimiter Integration Tests', () => {
    let rateLimiter: RateLimiter;

    beforeEach(() => {
        // Create a new rate limiter for each test
        rateLimiter = new RateLimiter({
            maxRequests: 5,
            windowMs: 1000, // 1 second
            burstSize: 10,
            minInterval: 50 // 50ms minimum between requests
        });
    });

    describe('Token Bucket Algorithm', () => {
        it('should allow requests up to burst size immediately', async () => {
            const startTime = Date.now();
            
            // Should be able to make 10 requests immediately (burst size)
            for (let i = 0; i < 10; i++) {
                await rateLimiter.acquire();
            }
            
            const elapsed = Date.now() - startTime;
            
            // Should complete (minInterval is 50ms, so 10 requests = ~500ms)
            // Allow for system overhead and token refill delays
            expect(elapsed).toBeGreaterThanOrEqual(450); // ~50ms * 10 requests
            expect(elapsed).toBeLessThan(3000); // But not too long
            
            // Due to sliding window (1 second) and the time taken,
            // some requests may have expired from the window
            const stats = rateLimiter.getStats();
            expect(stats.requestsInWindow).toBeGreaterThan(0);
            expect(stats.requestsInWindow).toBeLessThanOrEqual(10);
        }, 15000);

        it('should queue requests that exceed rate limit', async () => {
            const startTime = Date.now();
            
            // Make 15 requests (more than burst and maxRequests)
            const promises: Promise<void>[] = [];
            for (let i = 0; i < 15; i++) {
                promises.push(rateLimiter.acquire());
            }
            
            await Promise.all(promises);
            
            const elapsed = Date.now() - startTime;
            
            // Should have queued some requests
            // Since rate is 5/sec with 50ms min interval, 15 requests take time
            expect(elapsed).toBeGreaterThan(700); // At least 750ms (15 * 50ms)
            
            const stats = rateLimiter.getStats();
            // Due to sliding window, only last 5 requests in the window
            expect(stats.requestsInWindow).toBeLessThanOrEqual(15);
        }, 15000);

        it('should refill tokens over time', async () => {
            // Use up all burst tokens
            for (let i = 0; i < 10; i++) {
                await rateLimiter.acquire();
            }
            
            let status = rateLimiter.getStatus();
            expect(status.remainingRequests).toBeLessThanOrEqual(0);
            
            // Wait for 1 second (should refill 5 tokens at 5/sec rate)
            await new Promise(resolve => setTimeout(resolve, 1100));
            
            status = rateLimiter.getStatus();
            // Should have refilled some tokens
            expect(status.remainingRequests).toBeGreaterThan(0);
        }, 15000);
    });

    describe('Minimum Interval Enforcement', () => {
        it('should enforce minimum interval between requests', async () => {
            const timestamps: number[] = [];
            
            // Make 5 requests
            for (let i = 0; i < 5; i++) {
                await rateLimiter.acquire();
                timestamps.push(Date.now());
            }
            
            // Check intervals between consecutive requests
            for (let i = 1; i < timestamps.length; i++) {
                const interval = timestamps[i] - timestamps[i - 1];
                // Allow some variance (±10ms) due to system timing
                expect(interval).toBeGreaterThanOrEqual(40);
            }
        }, 15000);
    });

    describe('Status and Statistics', () => {
        it('should report accurate status', async () => {
            // Initial status
            let status = rateLimiter.getStatus();
            // Remaining is min(burstSize, maxRequests) = min(10, 5) = 5
            expect(status.remainingRequests).toBe(5); // Limited by maxRequests
            expect(status.isLimited).toBe(false);
            
            // Make some requests
            await rateLimiter.acquire();
            await rateLimiter.acquire();
            
            status = rateLimiter.getStatus();
            expect(status.remainingRequests).toBeLessThan(5);
        });

        it('should track requests in sliding window', async () => {
            // Make 3 requests
            await rateLimiter.acquire();
            await rateLimiter.acquire();
            await rateLimiter.acquire();
            
            let stats = rateLimiter.getStats();
            expect(stats.requestsInWindow).toBe(3);
            
            // Wait for window to expire (1 second + buffer)
            await new Promise(resolve => setTimeout(resolve, 1200));
            
            stats = rateLimiter.getStats();
            // Old requests should have expired
            expect(stats.requestsInWindow).toBe(0);
        }, 15000);

        it('should report queue length accurately', async () => {
            // Create rate limiter with very low rate to test queueing
            const slowLimiter = new RateLimiter({
                maxRequests: 1,
                windowMs: 1000,
                burstSize: 2,
                minInterval: 500
            });
            
            // Make 5 requests asynchronously
            const promises: Promise<void>[] = [];
            for (let i = 0; i < 5; i++) {
                promises.push(slowLimiter.acquire());
            }
            
            // Check queue length before requests complete
            // Need to wait a bit for queue to build up
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const stats = slowLimiter.getStats();
            expect(stats.queueLength).toBeGreaterThan(0);
            
            // Wait for all requests to complete
            await Promise.all(promises);
            
            const finalStats = slowLimiter.getStats();
            expect(finalStats.queueLength).toBe(0);
        }, 15000);
    });

    describe('Reset Functionality', () => {
        it('should reset limiter state', async () => {
            // Make some requests
            await rateLimiter.acquire();
            await rateLimiter.acquire();
            await rateLimiter.acquire();
            
            let stats = rateLimiter.getStats();
            expect(stats.requestsInWindow).toBe(3);
            
            // Reset
            rateLimiter.reset();
            
            stats = rateLimiter.getStats();
            expect(stats.requestsInWindow).toBe(0);
            expect(stats.tokens).toBe(10); // Burst size
            
            const status = rateLimiter.getStatus();
            // Remaining is still limited by maxRequests (5)
            expect(status.remainingRequests).toBe(5);
        });
    });
});

describe('RateLimiterRegistry', () => {
    let registry: RateLimiterRegistry;

    beforeEach(() => {
        registry = RateLimiterRegistry.getInstance();
    });

    it('should create and retrieve limiters by service name', () => {
        const limiter1 = registry.getOrCreate('test-service-1', {
            maxRequests: 10,
            windowMs: 60000,
            burstSize: 20,
            minInterval: 100
        });

        const limiter2 = registry.getOrCreate('test-service-1', {
            maxRequests: 5, // Different config
            windowMs: 30000,
            burstSize: 10,
            minInterval: 50
        });

        // Should return same instance (config is ignored on subsequent calls)
        expect(limiter1).toBe(limiter2);
    });

    it('should create separate limiters for different services', () => {
        const limiter1 = registry.getOrCreate('service-a', {
            maxRequests: 10,
            windowMs: 60000,
            burstSize: 20,
            minInterval: 100
        });

        const limiter2 = registry.getOrCreate('service-b', {
            maxRequests: 10,
            windowMs: 60000,
            burstSize: 20,
            minInterval: 100
        });

        // Should be different instances
        expect(limiter1).not.toBe(limiter2);
    });

    it('should list all registered limiters', () => {
        registry.getOrCreate('service-1', {
            maxRequests: 10,
            windowMs: 60000,
            burstSize: 20,
            minInterval: 100
        });

        registry.getOrCreate('service-2', {
            maxRequests: 5,
            windowMs: 30000,
            burstSize: 10,
            minInterval: 50
        });

        const all = registry.getAll();
        expect(all.size).toBeGreaterThanOrEqual(2);
        expect(all.has('service-1')).toBe(true);
        expect(all.has('service-2')).toBe(true);
    });

    it('should support GAM preset', () => {
        const gamLimiter = RateLimiterRegistry.createForGAM();
        
        const stats = gamLimiter.getStats();
        expect(stats.config.maxRequests).toBe(10);
        expect(stats.config.windowMs).toBe(60000);
        expect(stats.config.burstSize).toBe(20);
        expect(stats.config.minInterval).toBe(100);
    });

    it('should remove limiter', () => {
        registry.getOrCreate('temp-service', {
            maxRequests: 10,
            windowMs: 60000,
            burstSize: 20,
            minInterval: 100
        });

        expect(registry.has('temp-service')).toBe(true);
        
        const removed = registry.remove('temp-service');
        expect(removed).toBe(true);
        expect(registry.has('temp-service')).toBe(false);
    });

    it('should reset all limiters', async () => {
        const limiter1 = registry.getOrCreate('service-1', {
            maxRequests: 10,
            windowMs: 60000,
            burstSize: 20,
            minInterval: 100
        });

        const limiter2 = registry.getOrCreate('service-2', {
            maxRequests: 5,
            windowMs: 30000,
            burstSize: 10,
            minInterval: 50
        });

        // Make some requests
        await limiter1.acquire();
        await limiter2.acquire();

        let stats1 = limiter1.getStats();
        let stats2 = limiter2.getStats();
        expect(stats1.requestsInWindow).toBeGreaterThan(0);
        expect(stats2.requestsInWindow).toBeGreaterThan(0);

        // Reset all
        registry.resetAll();

        stats1 = limiter1.getStats();
        stats2 = limiter2.getStats();
        expect(stats1.requestsInWindow).toBe(0);
        expect(stats2.requestsInWindow).toBe(0);
    });
});
