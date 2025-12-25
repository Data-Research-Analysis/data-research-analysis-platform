/**
 * Performance Metrics Interfaces
 */

export interface AggregatedMetrics {
    avgResponseTime: number;
    p50ResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    totalRequests: number;
    errorRate: number;
    cacheHitRate: number;
    avgPayloadSize: number;
}

export interface PerformanceSnapshot {
    timestamp: Date;
    endpoint: string;
    method: string;
    responseTime: number;
    statusCode: number;
    payloadSize: number;
    cacheHit: boolean;
    memoryUsage: number;
    cpuUsage: number;
}

export interface BottleneckAnalysis {
    endpoint: string;
    avgResponseTime: number;
    slowQueries: Array<{
        query: string;
        avgTime: number;
        count: number;
    }>;
    recommendations: string[];
}
