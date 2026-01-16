/**
 * Tests for PerformanceMetrics utility
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PerformanceMetrics, PerformanceAggregator } from '../PerformanceMetrics.js';

describe('PerformanceMetrics', () => {
    let metrics: PerformanceMetrics;

    beforeEach(() => {
        metrics = new PerformanceMetrics('test-operation');
    });

    describe('Timer Management', () => {
        it('should start and stop timers correctly', () => {
            metrics.startTimer('timer1');
            
            // Simulate some work
            const start = Date.now();
            while (Date.now() - start < 50) {
                // Busy wait for ~50ms
            }
            
            const duration = metrics.stopTimer('timer1');
            
            expect(duration).toBeGreaterThanOrEqual(40);
            expect(duration).toBeLessThan(200);
        });

        it('should track multiple timers independently', () => {
            metrics.startTimer('timer1');
            metrics.startTimer('timer2');
            
            // Stop timer1 first
            const duration1 = metrics.stopTimer('timer1');
            
            // Wait a bit more
            const start = Date.now();
            while (Date.now() - start < 50) {}
            
            // Stop timer2
            const duration2 = metrics.stopTimer('timer2');
            
            expect(duration1).toBeLessThan(duration2!);
        });

        it('should warn if starting an already running timer', () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            
            metrics.startTimer('timer1');
            metrics.startTimer('timer1'); // Try to start again
            
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining("Timer 'timer1' is already running")
            );
            
            consoleSpy.mockRestore();
        });

        it('should warn if stopping a non-running timer', () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            
            metrics.stopTimer('nonexistent');
            
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining("Timer 'nonexistent' is not running")
            );
            
            consoleSpy.mockRestore();
        });

        it('should get duration of active timer', () => {
            metrics.startTimer('timer1');
            
            // Wait a bit
            const start = Date.now();
            while (Date.now() - start < 50) {}
            
            const duration = metrics.getTimerDuration('timer1');
            
            expect(duration).toBeGreaterThanOrEqual(40);
        });

        it('should get duration of stopped timer', () => {
            metrics.startTimer('timer1');
            const stoppedDuration = metrics.stopTimer('timer1');
            
            // Get duration after stopping
            const duration = metrics.getTimerDuration('timer1');
            
            expect(duration).toBe(stoppedDuration);
        });
    });

    describe('Metadata', () => {
        it('should add single metadata entry', () => {
            metrics.addMetadata('key1', 'value1');
            
            const snapshot = metrics.getSnapshot();
            expect(snapshot.metadata.key1).toBe('value1');
        });

        it('should add multiple metadata entries', () => {
            metrics.addMetadataObject({
                key1: 'value1',
                key2: 123,
                key3: true
            });
            
            const snapshot = metrics.getSnapshot();
            expect(snapshot.metadata.key1).toBe('value1');
            expect(snapshot.metadata.key2).toBe(123);
            expect(snapshot.metadata.key3).toBe(true);
        });

        it('should merge metadata entries', () => {
            metrics.addMetadata('key1', 'value1');
            metrics.addMetadataObject({ key2: 'value2' });
            
            const snapshot = metrics.getSnapshot();
            expect(snapshot.metadata.key1).toBe('value1');
            expect(snapshot.metadata.key2).toBe('value2');
        });
    });

    describe('Snapshot', () => {
        it('should create snapshot without completing', () => {
            metrics.startTimer('timer1');
            metrics.addMetadata('test', 'value');
            
            // Wait a tiny bit to ensure measurable duration
            const start = Date.now();
            while (Date.now() - start < 10) {}
            
            const snapshot = metrics.getSnapshot();
            
            expect(snapshot.operationName).toBe('test-operation');
            expect(snapshot.timers.length).toBe(1);
            expect(snapshot.metadata.test).toBe('value');
            expect(snapshot.totalDuration).toBeGreaterThanOrEqual(0);
        });

        it('should complete operation and create final snapshot', () => {
            metrics.startTimer('timer1');
            metrics.startTimer('timer2');
            
            // Wait a bit
            const start = Date.now();
            while (Date.now() - start < 50) {}
            
            const snapshot = metrics.complete();
            
            expect(snapshot.operationName).toBe('test-operation');
            expect(snapshot.totalDuration).toBeGreaterThanOrEqual(40);
            expect(snapshot.endTime).toBeGreaterThan(snapshot.startTime);
            expect(snapshot.timers.length).toBe(2);
            
            // All timers should be stopped
            for (const timer of snapshot.timers) {
                expect(timer.duration).toBeDefined();
            }
        });

        it('should stop active timers when completing', () => {
            metrics.startTimer('timer1');
            metrics.startTimer('timer2');
            // Don't stop them manually
            
            const snapshot = metrics.complete();
            
            // Both timers should have durations
            expect(snapshot.timers[0].duration).toBeDefined();
            expect(snapshot.timers[1].duration).toBeDefined();
        });

        it('should capture memory snapshots', () => {
            metrics.captureMemorySnapshot();
            
            // Do some work
            const arr = new Array(1000).fill(0);
            
            metrics.captureMemorySnapshot();
            
            const snapshot = metrics.complete();
            
            // Memory usage should be defined (delta between snapshots)
            expect(snapshot.memoryUsage).toBeDefined();
        });
    });

    describe('Formatting', () => {
        it('should format snapshot for logging', () => {
            metrics.startTimer('timer1', { test: 'metadata' });
            metrics.startTimer('timer2');
            metrics.stopTimer('timer1');
            metrics.stopTimer('timer2');
            
            const snapshot = metrics.complete();
            const formatted = PerformanceMetrics.formatSnapshot(snapshot);
            
            expect(formatted).toContain('test-operation');
            expect(formatted).toContain('Total:');
            expect(formatted).toContain('Breakdown:');
            expect(formatted).toContain('timer1');
            expect(formatted).toContain('timer2');
        });

        it('should show percentage breakdown', () => {
            metrics.startTimer('timer1');
            const start = Date.now();
            while (Date.now() - start < 50) {}
            metrics.stopTimer('timer1');
            
            const snapshot = metrics.complete();
            const formatted = PerformanceMetrics.formatSnapshot(snapshot);
            
            // Should show percentage
            expect(formatted).toMatch(/\d+\.\d+%/);
        });
    });
});

describe('PerformanceAggregator', () => {
    let aggregator: PerformanceAggregator;

    beforeEach(() => {
        aggregator = new PerformanceAggregator();
    });

    describe('Snapshot Management', () => {
        it('should add and retrieve snapshots', () => {
            const metrics = new PerformanceMetrics('op1');
            const snapshot = metrics.complete();
            
            aggregator.addSnapshot(snapshot);
            
            const retrieved = aggregator.getMetrics('op1');
            expect(retrieved).toBeDefined();
            expect(retrieved?.operationName).toBe('op1');
            expect(retrieved?.count).toBe(1);
        });

        it('should aggregate multiple snapshots for same operation', () => {
            for (let i = 0; i < 5; i++) {
                const metrics = new PerformanceMetrics('op1');
                // Wait different amounts
                const start = Date.now();
                while (Date.now() - start < (i + 1) * 10) {}
                const snapshot = metrics.complete();
                aggregator.addSnapshot(snapshot);
            }
            
            const metrics = aggregator.getMetrics('op1');
            expect(metrics?.count).toBe(5);
            expect(metrics?.avgDuration).toBeGreaterThan(0);
            expect(metrics?.minDuration).toBeLessThan(metrics?.maxDuration!);
        });

        it('should handle multiple different operations', () => {
            const metrics1 = new PerformanceMetrics('op1');
            const metrics2 = new PerformanceMetrics('op2');
            
            aggregator.addSnapshot(metrics1.complete());
            aggregator.addSnapshot(metrics2.complete());
            
            const allMetrics = aggregator.getAllMetrics();
            expect(allMetrics.length).toBe(2);
            expect(allMetrics.map(m => m.operationName)).toContain('op1');
            expect(allMetrics.map(m => m.operationName)).toContain('op2');
        });
    });

    describe('Statistics', () => {
        beforeEach(() => {
            // Add some test data
            for (let i = 0; i < 10; i++) {
                const metrics = new PerformanceMetrics('test-op');
                const start = Date.now();
                while (Date.now() - start < (i + 1) * 10) {}
                
                if (i < 9) {
                    // 90% success
                    metrics.addMetadata('success', true);
                } else {
                    metrics.addMetadata('error', 'Test error');
                }
                
                aggregator.addSnapshot(metrics.complete());
            }
        });

        it('should calculate average duration', () => {
            const metrics = aggregator.getMetrics('test-op');
            
            expect(metrics?.avgDuration).toBeGreaterThan(0);
            expect(metrics?.avgDuration).toBeLessThan(metrics?.maxDuration!);
            expect(metrics?.avgDuration).toBeGreaterThan(metrics?.minDuration!);
        });

        it('should calculate percentiles', () => {
            const metrics = aggregator.getMetrics('test-op');
            
            expect(metrics?.p50Duration).toBeGreaterThan(0);
            expect(metrics?.p95Duration).toBeGreaterThan(metrics?.p50Duration!);
            expect(metrics?.p99Duration).toBeGreaterThanOrEqual(metrics?.p95Duration!);
        });

        it('should calculate success and error rates', () => {
            const metrics = aggregator.getMetrics('test-op');
            
            expect(metrics?.successRate).toBe(90);
            expect(metrics?.errorRate).toBe(10);
            expect(metrics?.successRate! + metrics?.errorRate!).toBe(100);
        });
    });

    describe('Analysis', () => {
        beforeEach(() => {
            // Create operations with different timers
            for (let i = 0; i < 5; i++) {
                const metrics = new PerformanceMetrics(`op-${i}`);
                
                metrics.startTimer('fetch-data');
                const start1 = Date.now();
                while (Date.now() - start1 < 50) {}
                metrics.stopTimer('fetch-data');
                
                metrics.startTimer('process-data');
                const start2 = Date.now();
                while (Date.now() - start2 < 20) {}
                metrics.stopTimer('process-data');
                
                aggregator.addSnapshot(metrics.complete());
            }
        });

        it('should identify slowest operations', () => {
            const slowest = aggregator.getSlowestOperations(3);
            
            expect(slowest.length).toBeLessThanOrEqual(3);
            expect(slowest.length).toBeGreaterThan(0);
            
            // Should be sorted by duration descending
            for (let i = 1; i < slowest.length; i++) {
                expect(slowest[i - 1].totalDuration).toBeGreaterThanOrEqual(
                    slowest[i].totalDuration
                );
            }
        });

        it('should identify bottlenecks', () => {
            const bottlenecks = aggregator.getBottleneckAnalysis();
            
            expect(bottlenecks.length).toBeGreaterThan(0);
            
            // Should have fetch-data and process-data
            const timerNames = bottlenecks.map(b => b.timerName);
            expect(timerNames).toContain('fetch-data');
            expect(timerNames).toContain('process-data');
            
            // fetch-data should take more total time (50ms * 5 = 250ms)
            const fetchData = bottlenecks.find(b => b.timerName === 'fetch-data');
            const processData = bottlenecks.find(b => b.timerName === 'process-data');
            
            expect(fetchData?.totalDuration).toBeGreaterThan(processData?.totalDuration!);
        });
    });

    describe('Cleanup', () => {
        it('should clear all snapshots', () => {
            const metrics = new PerformanceMetrics('op1');
            aggregator.addSnapshot(metrics.complete());
            
            expect(aggregator.getSnapshotCount()).toBe(1);
            
            aggregator.clear();
            
            expect(aggregator.getSnapshotCount()).toBe(0);
        });

        it('should clear specific operation', () => {
            const metrics1 = new PerformanceMetrics('op1');
            const metrics2 = new PerformanceMetrics('op2');
            
            aggregator.addSnapshot(metrics1.complete());
            aggregator.addSnapshot(metrics2.complete());
            
            expect(aggregator.getSnapshotCount()).toBe(2);
            
            aggregator.clearOperation('op1');
            
            expect(aggregator.getSnapshotCount()).toBe(1);
            expect(aggregator.getSnapshotCount('op1')).toBe(0);
            expect(aggregator.getSnapshotCount('op2')).toBe(1);
        });

        it('should count snapshots by operation', () => {
            for (let i = 0; i < 3; i++) {
                const metrics = new PerformanceMetrics('op1');
                aggregator.addSnapshot(metrics.complete());
            }
            
            for (let i = 0; i < 2; i++) {
                const metrics = new PerformanceMetrics('op2');
                aggregator.addSnapshot(metrics.complete());
            }
            
            expect(aggregator.getSnapshotCount('op1')).toBe(3);
            expect(aggregator.getSnapshotCount('op2')).toBe(2);
            expect(aggregator.getSnapshotCount()).toBe(5);
        });
    });
});
