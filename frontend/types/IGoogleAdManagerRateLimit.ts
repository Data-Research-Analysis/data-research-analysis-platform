/**
 * Google Ad Manager Rate Limit Interfaces
 */

export interface RateLimitStatus {
    remaining: number;
    limit: number;
    resetAt: string;
}

export interface RateLimitStats {
    totalRequests: number;
    throttledRequests: number;
    avgWaitTime: number;
    peakUsage: number;
    currentUsage: number;
}

export interface RateLimitData {
    status: RateLimitStatus;
    stats: RateLimitStats;
    warnings: string[];
}
