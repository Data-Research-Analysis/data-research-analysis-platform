/**
 * Performance Metrics Tracker
 * Collects detailed timing and performance metrics for operations
 */

export interface PerformanceTimer {
    name: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    metadata?: Record<string, any>;
}

export interface PerformanceSnapshot {
    operationName: string;
    totalDuration: number;
    startTime: number;
    endTime: number;
    timers: PerformanceTimer[];
    metadata: Record<string, any>;
    memoryUsage?: NodeJS.MemoryUsage;
}

export interface AggregatedMetrics {
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

export class PerformanceMetrics {
    private operationName: string;
    private startTime: number;
    private endTime?: number;
    private timers: Map<string, PerformanceTimer> = new Map();
    private activeTimers: Set<string> = new Set();
    private metadata: Record<string, any> = {};
    private memorySnapshots: NodeJS.MemoryUsage[] = [];

    constructor(operationName: string) {
        this.operationName = operationName;
        this.startTime = Date.now();
        this.captureMemorySnapshot();
    }

    /**
     * Start a named timer
     */
    public startTimer(name: string, metadata?: Record<string, any>): void {
        if (this.activeTimers.has(name)) {
            console.warn(`⚠️ Timer '${name}' is already running`);
            return;
        }

        const timer: PerformanceTimer = {
            name,
            startTime: Date.now(),
            metadata,
        };

        this.timers.set(name, timer);
        this.activeTimers.add(name);
    }

    /**
     * Stop a named timer
     */
    public stopTimer(name: string): number | null {
        if (!this.activeTimers.has(name)) {
            console.warn(`⚠️ Timer '${name}' is not running`);
            return null;
        }

        const timer = this.timers.get(name);
        if (!timer) {
            return null;
        }

        timer.endTime = Date.now();
        timer.duration = timer.endTime - timer.startTime;
        this.activeTimers.delete(name);

        return timer.duration;
    }

    /**
     * Get duration of a timer (whether active or stopped)
     */
    public getTimerDuration(name: string): number | null {
        const timer = this.timers.get(name);
        if (!timer) {
            return null;
        }

        if (timer.duration !== undefined) {
            return timer.duration;
        }

        // Timer is still active
        return Date.now() - timer.startTime;
    }

    /**
     * Add metadata to the operation
     */
    public addMetadata(key: string, value: any): void {
        this.metadata[key] = value;
    }

    /**
     * Add multiple metadata entries
     */
    public addMetadataObject(metadata: Record<string, any>): void {
        Object.assign(this.metadata, metadata);
    }

    /**
     * Capture memory usage snapshot
     */
    public captureMemorySnapshot(): void {
        this.memorySnapshots.push(process.memoryUsage());
    }

    /**
     * Complete the operation and get snapshot
     */
    public complete(): PerformanceSnapshot {
        this.endTime = Date.now();
        this.captureMemorySnapshot();

        // Stop any active timers
        for (const name of this.activeTimers) {
            this.stopTimer(name);
        }

        const snapshot: PerformanceSnapshot = {
            operationName: this.operationName,
            totalDuration: this.endTime - this.startTime,
            startTime: this.startTime,
            endTime: this.endTime,
            timers: Array.from(this.timers.values()),
            metadata: this.metadata,
            memoryUsage: this.getMemoryDelta(),
        };

        return snapshot;
    }

    /**
     * Get memory usage delta (start vs end)
     */
    private getMemoryDelta(): NodeJS.MemoryUsage | undefined {
        if (this.memorySnapshots.length < 2) {
            return undefined;
        }

        const start = this.memorySnapshots[0];
        const end = this.memorySnapshots[this.memorySnapshots.length - 1];

        return {
            rss: end.rss - start.rss,
            heapTotal: end.heapTotal - start.heapTotal,
            heapUsed: end.heapUsed - start.heapUsed,
            external: end.external - start.external,
            arrayBuffers: end.arrayBuffers - start.arrayBuffers,
        };
    }

    /**
     * Get current snapshot (without completing)
     */
    public getSnapshot(): PerformanceSnapshot {
        const now = Date.now();

        return {
            operationName: this.operationName,
            totalDuration: now - this.startTime,
            startTime: this.startTime,
            endTime: now,
            timers: Array.from(this.timers.values()).map(timer => ({
                ...timer,
                duration: timer.duration ?? (now - timer.startTime),
            })),
            metadata: this.metadata,
        };
    }

    /**
     * Format snapshot for logging
     */
    public static formatSnapshot(snapshot: PerformanceSnapshot): string {
        const lines: string[] = [
            `📊 Performance: ${snapshot.operationName}`,
            `   Total: ${snapshot.totalDuration}ms`,
        ];

        // Sort timers by duration descending
        const sortedTimers = [...snapshot.timers].sort((a, b) => {
            const durationA = a.duration ?? 0;
            const durationB = b.duration ?? 0;
            return durationB - durationA;
        });

        if (sortedTimers.length > 0) {
            lines.push('   Breakdown:');
            for (const timer of sortedTimers) {
                const duration = timer.duration ?? 0;
                const percentage = ((duration / snapshot.totalDuration) * 100).toFixed(1);
                lines.push(`     - ${timer.name}: ${duration}ms (${percentage}%)`);
            }
        }

        if (snapshot.memoryUsage) {
            const heapMB = (snapshot.memoryUsage.heapUsed / 1024 / 1024).toFixed(2);
            lines.push(`   Memory Δ: ${heapMB}MB heap`);
        }

        return lines.join('\n');
    }
}

/**
 * Performance Metrics Aggregator
 * Aggregates multiple performance snapshots for analysis
 */
export class PerformanceAggregator {
    private snapshots: Map<string, PerformanceSnapshot[]> = new Map();

    /**
     * Add a snapshot
     */
    public addSnapshot(snapshot: PerformanceSnapshot): void {
        const existing = this.snapshots.get(snapshot.operationName) || [];
        existing.push(snapshot);
        this.snapshots.set(snapshot.operationName, existing);
    }

    /**
     * Get aggregated metrics for an operation
     */
    public getMetrics(operationName: string): AggregatedMetrics | null {
        const snapshots = this.snapshots.get(operationName);
        if (!snapshots || snapshots.length === 0) {
            return null;
        }

        const durations = snapshots.map(s => s.totalDuration).sort((a, b) => a - b);
        const successCount = snapshots.filter(s => !s.metadata.error).length;
        const errorCount = snapshots.length - successCount;

        return {
            operationName,
            count: snapshots.length,
            totalDuration: durations.reduce((sum, d) => sum + d, 0),
            avgDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
            minDuration: durations[0],
            maxDuration: durations[durations.length - 1],
            p50Duration: this.percentile(durations, 50),
            p95Duration: this.percentile(durations, 95),
            p99Duration: this.percentile(durations, 99),
            successRate: (successCount / snapshots.length) * 100,
            errorRate: (errorCount / snapshots.length) * 100,
        };
    }

    /**
     * Get all aggregated metrics
     */
    public getAllMetrics(): AggregatedMetrics[] {
        const metrics: AggregatedMetrics[] = [];
        for (const operationName of this.snapshots.keys()) {
            const metric = this.getMetrics(operationName);
            if (metric) {
                metrics.push(metric);
            }
        }
        return metrics;
    }

    /**
     * Calculate percentile
     */
    private percentile(sortedValues: number[], p: number): number {
        if (sortedValues.length === 0) return 0;
        if (sortedValues.length === 1) return sortedValues[0];

        const index = (p / 100) * (sortedValues.length - 1);
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        const weight = index % 1;

        if (lower === upper) {
            return sortedValues[lower];
        }

        return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
    }

    /**
     * Get slowest operations
     */
    public getSlowestOperations(limit: number = 10): PerformanceSnapshot[] {
        const allSnapshots: PerformanceSnapshot[] = [];
        for (const snapshots of this.snapshots.values()) {
            allSnapshots.push(...snapshots);
        }

        return allSnapshots
            .sort((a, b) => b.totalDuration - a.totalDuration)
            .slice(0, limit);
    }

    /**
     * Get bottleneck analysis
     * Identifies which timer names take the most time across all operations
     */
    public getBottleneckAnalysis(): Array<{ timerName: string; totalDuration: number; avgDuration: number; count: number }> {
        const timerStats = new Map<string, { totalDuration: number; count: number }>();

        for (const snapshots of this.snapshots.values()) {
            for (const snapshot of snapshots) {
                for (const timer of snapshot.timers) {
                    if (timer.duration) {
                        const existing = timerStats.get(timer.name) || { totalDuration: 0, count: 0 };
                        existing.totalDuration += timer.duration;
                        existing.count += 1;
                        timerStats.set(timer.name, existing);
                    }
                }
            }
        }

        const bottlenecks = Array.from(timerStats.entries()).map(([timerName, stats]) => ({
            timerName,
            totalDuration: stats.totalDuration,
            avgDuration: stats.totalDuration / stats.count,
            count: stats.count,
        }));

        return bottlenecks.sort((a, b) => b.totalDuration - a.totalDuration);
    }

    /**
     * Clear all snapshots
     */
    public clear(): void {
        this.snapshots.clear();
    }

    /**
     * Clear snapshots for a specific operation
     */
    public clearOperation(operationName: string): void {
        this.snapshots.delete(operationName);
    }

    /**
     * Get snapshot count
     */
    public getSnapshotCount(operationName?: string): number {
        if (operationName) {
            return this.snapshots.get(operationName)?.length ?? 0;
        }
        return Array.from(this.snapshots.values()).reduce((sum, arr) => sum + arr.length, 0);
    }
}

/**
 * Global performance aggregator instance
 */
export const globalPerformanceAggregator = new PerformanceAggregator();
