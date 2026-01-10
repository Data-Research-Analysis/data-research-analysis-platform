export interface IRateLimitStatus {
    remainingRequests: number;
    resetTime: string;
    isLimited: boolean;
    retryAfterMs?: number;
}

export interface IRateLimitStats {
    queueLength: number;
    tokens: number;
    requestsInWindow: number;
    config: {
        maxRequests: number;
        windowMs: number;
        burstSize: number;
        minInterval: number;
    };
}

export interface IRateLimitData {
    status: IRateLimitStatus;
    stats: IRateLimitStats;
}
