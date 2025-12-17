import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { RetryHandler, RetryConfig } from '../RetryHandler.js';

describe('RetryHandler', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.useRealTimers();
    });

    describe('execute', () => {
        it('should succeed on first attempt', async () => {
            const fn = jest.fn().mockResolvedValue('success');

            const promise = RetryHandler.execute(fn);
            await jest.runAllTimersAsync();
            const result = await promise;

            expect(result.success).toBe(true);
            expect(result.data).toBe('success');
            expect(result.attempts).toBe(1);
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should retry on retryable error', async () => {
            const fn = jest
                .fn()
                .mockRejectedValueOnce(new Error('ETIMEDOUT'))
                .mockResolvedValueOnce('success');

            const promise = RetryHandler.execute(fn, { maxRetries: 2 });
            
            // Fast-forward through all timers
            await jest.runAllTimersAsync();
            
            const result = await promise;

            expect(result.success).toBe(true);
            expect(result.data).toBe('success');
            expect(result.attempts).toBe(2);
            expect(fn).toHaveBeenCalledTimes(2);
        });

        it('should fail after max retries', async () => {
            const error = new Error('RATE_LIMIT_EXCEEDED');
            const fn = jest.fn().mockRejectedValue(error);

            const promise = RetryHandler.execute(fn, { maxRetries: 2 });
            await jest.runAllTimersAsync();
            const result = await promise;

            expect(result.success).toBe(false);
            expect(result.error).toBe(error);
            expect(result.attempts).toBe(3); // initial + 2 retries
            expect(fn).toHaveBeenCalledTimes(3);
        });

        it('should not retry on non-retryable error', async () => {
            const error = new Error('VALIDATION_ERROR');
            const fn = jest.fn().mockRejectedValue(error);

            const promise = RetryHandler.execute(fn, { maxRetries: 3 });
            await jest.runAllTimersAsync();
            const result = await promise;

            expect(result.success).toBe(false);
            expect(result.error).toBe(error);
            expect(result.attempts).toBe(1);
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should apply exponential backoff', async () => {
            const fn = jest
                .fn()
                .mockRejectedValueOnce(new Error('timeout'))
                .mockRejectedValueOnce(new Error('timeout'))
                .mockResolvedValueOnce('success');

            const config: Partial<RetryConfig> = {
                maxRetries: 3,
                initialDelayMs: 1000,
                backoffMultiplier: 2,
            };

            const promise = RetryHandler.execute(fn, config);
            await jest.runAllTimersAsync();
            const result = await promise;

            expect(result.success).toBe(true);
            expect(result.attempts).toBe(3);
        });

        it('should respect max delay', async () => {
            const fn = jest
                .fn()
                .mockRejectedValueOnce(new Error('503'))
                .mockResolvedValueOnce('success');

            const config: Partial<RetryConfig> = {
                maxRetries: 2,
                initialDelayMs: 10000,
                maxDelayMs: 5000,
                backoffMultiplier: 2,
            };

            const promise = RetryHandler.execute(fn, config);
            await jest.runAllTimersAsync();
            const result = await promise;

            expect(result.success).toBe(true);
        });

        it('should call onRetry callback', async () => {
            const onRetry = jest.fn();
            const fn = jest
                .fn()
                .mockRejectedValueOnce(new Error('ECONNRESET'))
                .mockResolvedValueOnce('success');

            const promise = RetryHandler.execute(fn, { maxRetries: 2, onRetry });
            await jest.runAllTimersAsync();
            const result = await promise;

            expect(result.success).toBe(true);
            expect(onRetry).toHaveBeenCalledTimes(1);
            expect(onRetry).toHaveBeenCalledWith(
                1,
                expect.any(Error),
                expect.any(Number)
            );
        });

        it('should detect retryable error by code', async () => {
            const error: any = new Error('Something went wrong');
            error.code = 'ECONNRESET';
            const fn = jest.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('success');

            const promise = RetryHandler.execute(fn, { maxRetries: 2 });
            await jest.runAllTimersAsync();
            const result = await promise;

            expect(result.success).toBe(true);
            expect(result.attempts).toBe(2);
        });

        it('should detect retryable error by message pattern', async () => {
            const fn = jest
                .fn()
                .mockRejectedValueOnce(new Error('Request timed out after 30 seconds'))
                .mockResolvedValueOnce('success');

            const promise = RetryHandler.execute(fn, { maxRetries: 2 });
            await jest.runAllTimersAsync();
            const result = await promise;

            expect(result.success).toBe(true);
            expect(result.attempts).toBe(2);
        });

        it('should track total duration', async () => {
            const fn = jest.fn().mockResolvedValue('success');

            const promise = RetryHandler.execute(fn);
            await jest.runAllTimersAsync();
            const result = await promise;

            expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
        });
    });

    describe('getRecommendedConfig', () => {
        it('should return network config', () => {
            const config = RetryHandler.getRecommendedConfig('network');
            expect(config.maxRetries).toBe(3);
            expect(config.initialDelayMs).toBe(1000);
        });

        it('should return rate_limit config', () => {
            const config = RetryHandler.getRecommendedConfig('rate_limit');
            expect(config.maxRetries).toBe(5);
            expect(config.initialDelayMs).toBe(5000);
        });

        it('should return server config', () => {
            const config = RetryHandler.getRecommendedConfig('server');
            expect(config.maxRetries).toBe(4);
            expect(config.initialDelayMs).toBe(2000);
        });
    });

    describe('executeBatch', () => {
        it('should execute multiple operations', async () => {
            const fn1 = jest.fn().mockResolvedValue('result1');
            const fn2 = jest.fn().mockResolvedValue('result2');
            const fn3 = jest.fn().mockResolvedValue('result3');

            const promise = RetryHandler.executeBatch([fn1, fn2, fn3]);
            await jest.runAllTimersAsync();
            const results = await promise;

            expect(results).toHaveLength(3);
            expect(results[0].success).toBe(true);
            expect(results[0].data).toBe('result1');
            expect(results[1].success).toBe(true);
            expect(results[1].data).toBe('result2');
            expect(results[2].success).toBe(true);
            expect(results[2].data).toBe('result3');
        });

        it('should continue batch execution on individual failures', async () => {
            const fn1 = jest.fn().mockResolvedValue('result1');
            const fn2 = jest.fn().mockRejectedValue(new Error('VALIDATION_ERROR'));
            const fn3 = jest.fn().mockResolvedValue('result3');

            const promise = RetryHandler.executeBatch([fn1, fn2, fn3], { maxRetries: 1 });
            await jest.runAllTimersAsync();
            const results = await promise;

            expect(results).toHaveLength(3);
            expect(results[0].success).toBe(true);
            expect(results[1].success).toBe(false);
            expect(results[2].success).toBe(true);
        });
    });

    describe('retryable errors', () => {
        const retryableErrors = [
            { description: 'timeout', message: 'Request timeout' },
            { description: 'rate limit', message: 'Rate limit exceeded' },
            { description: '503', message: 'Service unavailable' },
            { description: '429', message: '429 Too Many Requests' },
            { description: 'socket hang up', message: 'socket hang up' },
        ];

        retryableErrors.forEach(({ description, message }) => {
            it(`should retry on ${description} error`, async () => {
                const fn = jest
                    .fn()
                    .mockRejectedValueOnce(new Error(message))
                    .mockResolvedValueOnce('success');

                const promise = RetryHandler.execute(fn, { maxRetries: 2 });
                await jest.runAllTimersAsync();
                const result = await promise;

                expect(result.success).toBe(true);
                expect(result.attempts).toBe(2);
            });
        });

        const nonRetryableErrors = [
            { description: 'validation', message: 'Validation failed' },
            { description: '404', message: '404 Not Found' },
            { description: 'auth', message: 'Unauthorized' },
        ];

        nonRetryableErrors.forEach(({ description, message }) => {
            it(`should not retry on ${description} error`, async () => {
                const fn = jest.fn().mockRejectedValue(new Error(message));

                const promise = RetryHandler.execute(fn, { maxRetries: 2 });
                await jest.runAllTimersAsync();
                const result = await promise;

                expect(result.success).toBe(false);
                expect(result.attempts).toBe(1);
            });
        });
    });
});
