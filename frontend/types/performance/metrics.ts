export interface IAggregatedMetrics {
    operationName: string;
    count: number;
    totalDuration: number;
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
    p50Duration: number;
    p95Duration: number;
    p99Duration: number;
    successRate: number;
    errorRate: number;
}

export interface IPerformanceSnapshot {
    operationName: string;
    totalDuration: number;
    startTime: number;
    endTime: number;
    timers: Array<{
        name: string;
        startTime: number;
        endTime?: number;
        duration?: number;
        metadata?: Record<string, any>;
    }>;
    metadata: Record<string, any>;
    memoryUsage?: {
        rss: number;
        heapTotal: number;
        heapUsed: number;
        external: number;
        arrayBuffers: number;
    };
}

export interface IBottleneckAnalysis {
    timerName: string;
    totalDuration: number;
    avgDuration: number;
    count: number;
}
