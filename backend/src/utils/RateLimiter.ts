/**
 * Rate Limiter
 * Implements token bucket algorithm for API rate limiting and request throttling
 */

export interface RateLimiterConfig {
    maxRequests: number; // Maximum requests per window
    windowMs: number; // Time window in milliseconds
    burstSize?: number; // Maximum burst requests (defaults to maxRequests)
    minInterval?: number; // Minimum interval between requests in ms
}

export interface RateLimitStatus {
    remainingRequests: number;
    resetTime: Date;
    isLimited: boolean;
    retryAfterMs?: number;
}

export class RateLimiter {
    private tokens: number;
    private lastRefill: number;
    private requestTimestamps: number[] = [];
    private config: Required<RateLimiterConfig>;
    private queue: Array<{
        resolve: (value: void) => void;
        timestamp: number;
    }> = [];
    private processing = false;

    constructor(config: RateLimiterConfig) {
        this.config = {
            maxRequests: config.maxRequests,
            windowMs: config.windowMs,
            burstSize: config.burstSize || config.maxRequests,
            minInterval: config.minInterval || 0,
        };
        this.tokens = this.config.burstSize;
        this.lastRefill = Date.now();
    }

    /**
     * Acquire permission to make a request
     * Returns a promise that resolves when request can proceed
     */
    public async acquire(): Promise<void> {
        return new Promise((resolve) => {
            this.queue.push({
                resolve,
                timestamp: Date.now(),
            });

            this.processQueue();
        });
    }

    /**
     * Process the queue of pending requests
     */
    private async processQueue(): Promise<void> {
        if (this.processing || this.queue.length === 0) {
            return;
        }

        this.processing = true;

        while (this.queue.length > 0) {
            // Refill tokens based on time elapsed
            this.refillTokens();

            // Clean old timestamps
            this.cleanOldTimestamps();

            // Check if we can proceed
            if (this.canProceed()) {
                const request = this.queue.shift();
                if (request) {
                    this.consumeToken();
                    this.requestTimestamps.push(Date.now());
                    request.resolve();

                    // Enforce minimum interval if configured
                    if (this.config.minInterval > 0) {
                        await this.sleep(this.config.minInterval);
                    }
                }
            } else {
                // Calculate wait time
                const waitTime = this.calculateWaitTime();
                if (waitTime > 0) {
                    await this.sleep(waitTime);
                }
            }
        }

        this.processing = false;
    }

    /**
     * Check if a request can proceed
     */
    private canProceed(): boolean {
        // Check token bucket
        if (this.tokens <= 0) {
            return false;
        }

        // Check sliding window
        if (this.requestTimestamps.length >= this.config.maxRequests) {
            return false;
        }

        return true;
    }

    /**
     * Refill tokens based on elapsed time
     */
    private refillTokens(): void {
        const now = Date.now();
        const elapsed = now - this.lastRefill;
        const refillRate = this.config.burstSize / this.config.windowMs;
        const tokensToAdd = Math.floor(elapsed * refillRate);

        if (tokensToAdd > 0) {
            this.tokens = Math.min(this.tokens + tokensToAdd, this.config.burstSize);
            this.lastRefill = now;
        }
    }

    /**
     * Consume a token
     */
    private consumeToken(): void {
        this.tokens = Math.max(0, this.tokens - 1);
    }

    /**
     * Clean timestamps outside the window
     */
    private cleanOldTimestamps(): void {
        const now = Date.now();
        const cutoff = now - this.config.windowMs;
        this.requestTimestamps = this.requestTimestamps.filter((ts) => ts > cutoff);
    }

    /**
     * Calculate wait time before next request
     */
    private calculateWaitTime(): number {
        const now = Date.now();

        // If no tokens, wait for refill
        if (this.tokens <= 0) {
            const timeToNextToken = this.config.windowMs / this.config.burstSize;
            const timeSinceLastRefill = now - this.lastRefill;
            return Math.max(0, timeToNextToken - timeSinceLastRefill);
        }

        // If window is full, wait for oldest request to expire
        if (this.requestTimestamps.length >= this.config.maxRequests) {
            const oldestTimestamp = this.requestTimestamps[0];
            const timeUntilExpiry = this.config.windowMs - (now - oldestTimestamp);
            return Math.max(0, timeUntilExpiry);
        }

        return 0;
    }

    /**
     * Get current rate limit status
     */
    public getStatus(): RateLimitStatus {
        this.refillTokens();
        this.cleanOldTimestamps();

        const remainingRequests = Math.min(
            Math.floor(this.tokens),
            this.config.maxRequests - this.requestTimestamps.length
        );

        const isLimited = remainingRequests <= 0;
        const retryAfterMs = isLimited ? this.calculateWaitTime() : undefined;

        return {
            remainingRequests,
            resetTime: new Date(this.lastRefill + this.config.windowMs),
            isLimited,
            retryAfterMs,
        };
    }

    /**
     * Reset the rate limiter
     */
    public reset(): void {
        this.tokens = this.config.burstSize;
        this.lastRefill = Date.now();
        this.requestTimestamps = [];
        this.queue = [];
    }

    /**
     * Get statistics
     */
    public getStats(): {
        queueLength: number;
        tokens: number;
        requestsInWindow: number;
        config: Required<RateLimiterConfig>;
    } {
        this.cleanOldTimestamps();
        return {
            queueLength: this.queue.length,
            tokens: Math.floor(this.tokens),
            requestsInWindow: this.requestTimestamps.length,
            config: this.config,
        };
    }

    /**
     * Sleep utility
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Create a rate limiter with Google Ad Manager API limits
     * Google Ad Manager API has specific rate limits based on quota
     */
    public static createForGAM(): RateLimiter {
        // Google Ad Manager API typical limits:
        // - 10,000 requests per day (≈ 6.94 requests per minute)
        // - Burst tolerance for short-term spikes
        // Conservative: 10 requests per minute with burst of 20
        return new RateLimiter({
            maxRequests: 10,
            windowMs: 60 * 1000, // 1 minute
            burstSize: 20,
            minInterval: 100, // 100ms minimum between requests
        });
    }

    /**
     * Create a rate limiter for testing (permissive limits)
     */
    public static createForTesting(): RateLimiter {
        return new RateLimiter({
            maxRequests: 100,
            windowMs: 1000, // 1 second
            burstSize: 100,
            minInterval: 10,
        });
    }
}

/**
 * Global rate limiter instances for different services
 */
export class RateLimiterRegistry {
    private static instance: RateLimiterRegistry;
    private limiters: Map<string, RateLimiter> = new Map();

    private constructor() {}

    public static getInstance(): RateLimiterRegistry {
        if (!RateLimiterRegistry.instance) {
            RateLimiterRegistry.instance = new RateLimiterRegistry();
        }
        return RateLimiterRegistry.instance;
    }

    /**
     * Get or create a rate limiter for a service
     */
    public getOrCreate(serviceId: string, config: RateLimiterConfig): RateLimiter {
        let limiter = this.limiters.get(serviceId);
        if (!limiter) {
            limiter = new RateLimiter(config);
            this.limiters.set(serviceId, limiter);
        }
        return limiter;
    }

    /**
     * Get rate limiter for a service
     */
    public get(serviceId: string): RateLimiter | undefined {
        return this.limiters.get(serviceId);
    }

    /**
     * Remove rate limiter
     */
    public remove(serviceId: string): boolean {
        return this.limiters.delete(serviceId);
    }

    /**
     * Check if limiter exists
     */
    public has(serviceId: string): boolean {
        return this.limiters.has(serviceId);
    }

    /**
     * Get all rate limiters
     */
    public getAll(): Map<string, RateLimiter> {
        return new Map(this.limiters);
    }

    /**
     * Get all service IDs
     */
    public getServiceIds(): string[] {
        return Array.from(this.limiters.keys());
    }

    /**
     * Get status for all limiters
     */
    public getAllStatuses(): Record<string, RateLimitStatus> {
        const statuses: Record<string, RateLimitStatus> = {};
        this.limiters.forEach((limiter, serviceId) => {
            statuses[serviceId] = limiter.getStatus();
        });
        return statuses;
    }

    /**
     * Reset all rate limiters
     */
    public resetAll(): void {
        this.limiters.forEach(limiter => limiter.reset());
    }

    /**
     * Create a rate limiter for Google Ad Manager API (preset)
     */
    public static createForGAM(): RateLimiter {
        return new RateLimiter({
            maxRequests: 10,
            windowMs: 60000, // 1 minute
            burstSize: 20,
            minInterval: 100, // 100ms minimum between requests
        });
    }
}
