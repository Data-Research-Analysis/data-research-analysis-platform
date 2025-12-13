import { Request } from 'express';
import { install as installFakeTimers, InstalledClock } from '@sinonjs/fake-timers';

/**
 * Test Utilities for Rate Limiting Tests
 * Provides helper functions for testing rate limit middleware
 */

/**
 * Creates a mock authenticated request with user_id
 */
export function createAuthenticatedRequest(userId: number, ip: string = '192.168.1.1'): Partial<Request> {
    return {
        body: {
            tokenDetails: {
                user_id: userId
            }
        },
        ip,
        path: '/test/path'
    };
}

/**
 * Creates a mock unauthenticated request with only IP
 */
export function createUnauthenticatedRequest(ip: string = '192.168.1.1'): Partial<Request> {
    return {
        body: {},
        ip,
        path: '/test/path'
    };
}

/**
 * Creates a mock request with rate limit information
 */
export function createRateLimitedRequest(
    userId?: number,
    ip: string = '192.168.1.1',
    rateLimitInfo?: {
        limit: number;
        current: number;
        remaining: number;
        resetTime: Date;
    }
): Partial<Request> {
    const req: any = {
        body: userId ? { tokenDetails: { user_id: userId } } : {},
        ip,
        path: '/test/path'
    };
    
    if (rateLimitInfo) {
        req.rateLimit = rateLimitInfo;
    }
    
    return req;
}

/**
 * Simulates time passing for rate limit window testing
 */
export class RateLimitTimeHelper {
    private clock: InstalledClock | null = null;
    
    /**
     * Install fake timers
     */
    install(): void {
        this.clock = installFakeTimers();
    }
    
    /**
     * Advance time by specified milliseconds
     */
    advanceTime(ms: number): void {
        if (!this.clock) {
            throw new Error('Timers not installed. Call install() first.');
        }
        this.clock.tick(ms);
    }
    
    /**
     * Advance time by specified minutes
     */
    advanceMinutes(minutes: number): void {
        this.advanceTime(minutes * 60 * 1000);
    }
    
    /**
     * Advance time by specified seconds
     */
    advanceSeconds(seconds: number): void {
        this.advanceTime(seconds * 1000);
    }
    
    /**
     * Reset and uninstall fake timers
     */
    uninstall(): void {
        if (this.clock) {
            this.clock.uninstall();
            this.clock = null;
        }
    }
}

/**
 * Helper to extract rate limit info from response headers
 */
export interface RateLimitHeaders {
    limit: number;
    remaining: number;
    reset: string;
}

export function extractRateLimitHeaders(headers: Record<string, string | string[]>): RateLimitHeaders {
    return {
        limit: parseInt(headers['ratelimit-limit'] as string),
        remaining: parseInt(headers['ratelimit-remaining'] as string),
        reset: headers['ratelimit-reset'] as string
    };
}

/**
 * Helper to check if rate limit was hit
 */
export function isRateLimited(statusCode: number): boolean {
    return statusCode === 429;
}

/**
 * Helper to calculate expected retry-after time
 */
export function calculateRetryAfter(resetTime: Date): number {
    const now = Date.now();
    const reset = resetTime.getTime();
    return Math.ceil((reset - now) / 1000);
}

/**
 * Mock response object for testing handlers
 */
export function createMockResponse() {
    const mockResponse: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        header: jest.fn().mockReturnThis()
    };
    
    return mockResponse;
}

/**
 * Helper to suppress console output during tests
 */
export class ConsoleHelper {
    private originalConsole: {
        log: typeof console.log;
        warn: typeof console.warn;
        error: typeof console.error;
    };
    
    constructor() {
        this.originalConsole = {
            log: console.log,
            warn: console.warn,
            error: console.error
        };
    }
    
    /**
     * Suppress all console output
     */
    suppress(): void {
        console.log = jest.fn();
        console.warn = jest.fn();
        console.error = jest.fn();
    }
    
    /**
     * Restore original console methods
     */
    restore(): void {
        console.log = this.originalConsole.log;
        console.warn = this.originalConsole.warn;
        console.error = this.originalConsole.error;
    }
    
    /**
     * Spy on console methods without suppressing
     */
    spy(): {
        log: jest.SpyInstance;
        warn: jest.SpyInstance;
        error: jest.SpyInstance;
    } {
        return {
            log: jest.spyOn(console, 'log').mockImplementation(),
            warn: jest.spyOn(console, 'warn').mockImplementation(),
            error: jest.spyOn(console, 'error').mockImplementation()
        };
    }
}

/**
 * Helper to wait for async operations
 */
export function wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Helper to make multiple requests with delay
 */
export async function makeRequestsWithDelay(
    requestFn: () => Promise<any>,
    count: number,
    delayMs: number = 100
): Promise<any[]> {
    const results: any[] = [];
    
    for (let i = 0; i < count; i++) {
        results.push(await requestFn());
        if (i < count - 1) {
            await wait(delayMs);
        }
    }
    
    return results;
}

/**
 * Helper to make requests in parallel
 */
export async function makeParallelRequests(
    requestFn: () => Promise<any>,
    count: number
): Promise<any[]> {
    const requests = Array(count).fill(null).map(() => requestFn());
    return Promise.all(requests);
}

/**
 * Rate limit configuration constants for testing
 */
export const RATE_LIMITS = {
    AUTH: {
        MAX: 5,
        WINDOW_MS: 15 * 60 * 1000 // 15 minutes
    },
    EXPENSIVE_OPS: {
        MAX: 10,
        WINDOW_MS: 60 * 1000 // 1 minute
    },
    GENERAL_API: {
        MAX: 100,
        WINDOW_MS: 60 * 1000 // 1 minute
    },
    AI_OPERATIONS: {
        MAX: 5,
        WINDOW_MS: 60 * 1000 // 1 minute
    },
    OAUTH_CALLBACK: {
        MAX: 10,
        WINDOW_MS: 5 * 60 * 1000 // 5 minutes
    }
};

/**
 * Helper to validate rate limit error response structure
 */
export interface RateLimitErrorResponse {
    error: string;
    message: string;
    retryAfter: number;
}

export function isValidRateLimitError(response: any): response is RateLimitErrorResponse {
    return (
        response &&
        typeof response.error === 'string' &&
        typeof response.message === 'string' &&
        typeof response.retryAfter === 'number' &&
        response.retryAfter > 0
    );
}

/**
 * Helper to test rate limit exhaustion
 */
export async function exhaustRateLimit(
    requestFn: () => Promise<any>,
    maxRequests: number
): Promise<{ successCount: number; rateLimitedResponse: any }> {
    let successCount = 0;
    let rateLimitedResponse: any = null;
    
    // Make max requests
    for (let i = 0; i < maxRequests; i++) {
        const response = await requestFn();
        if (response.status === 200) {
            successCount++;
        }
    }
    
    // One more to trigger rate limit
    rateLimitedResponse = await requestFn();
    
    return { successCount, rateLimitedResponse };
}

/**
 * Environment variable helper for testing
 */
export class EnvHelper {
    private originalEnv: Record<string, string | undefined> = {};
    
    /**
     * Set environment variable and save original value
     */
    set(key: string, value: string): void {
        if (!(key in this.originalEnv)) {
            this.originalEnv[key] = process.env[key];
        }
        process.env[key] = value;
    }
    
    /**
     * Delete environment variable and save original value
     */
    delete(key: string): void {
        if (!(key in this.originalEnv)) {
            this.originalEnv[key] = process.env[key];
        }
        delete process.env[key];
    }
    
    /**
     * Restore all modified environment variables
     */
    restore(): void {
        for (const [key, value] of Object.entries(this.originalEnv)) {
            if (value === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = value;
            }
        }
        this.originalEnv = {};
    }
}

/**
 * Helper to generate test user IDs
 */
export function generateUserId(): number {
    return Math.floor(Math.random() * 10000) + 1;
}

/**
 * Helper to generate test IP addresses
 */
export function generateIpAddress(): string {
    return `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}
