/**
 * Retry Handler Utility
 * Provides configurable retry logic with exponential backoff for handling transient failures
 */

export interface RetryConfig {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
    retryableErrors?: string[];
    onRetry?: (attempt: number, error: Error, nextDelayMs: number) => void;
}

export interface RetryResult<T> {
    success: boolean;
    data?: T;
    error?: Error;
    attempts: number;
    totalDurationMs: number;
}

export class RetryHandler {
    private static readonly DEFAULT_CONFIG: RetryConfig = {
        maxRetries: 3,
        initialDelayMs: 1000,
        maxDelayMs: 30000,
        backoffMultiplier: 2,
        retryableErrors: [
            'ECONNRESET',
            'ETIMEDOUT',
            'ENOTFOUND',
            'ECONNREFUSED',
            'RATE_LIMIT_EXCEEDED',
            'QUOTA_EXCEEDED',
            'SERVICE_UNAVAILABLE',
            'INTERNAL_SERVER_ERROR',
        ],
    };

    /**
     * Execute a function with retry logic
     */
    public static async execute<T>(
        fn: () => Promise<T>,
        config: Partial<RetryConfig> = {}
    ): Promise<RetryResult<T>> {
        const finalConfig: RetryConfig = { ...this.DEFAULT_CONFIG, ...config };
        const startTime = Date.now();
        let lastError: Error | undefined;
        let attempt = 0;

        while (attempt <= finalConfig.maxRetries) {
            try {
                const data = await fn();
                return {
                    success: true,
                    data,
                    attempts: attempt + 1,
                    totalDurationMs: Date.now() - startTime,
                };
            } catch (error: any) {
                lastError = error;
                attempt++;

                // Check if this is the last attempt
                if (attempt > finalConfig.maxRetries) {
                    console.error(`❌ All retry attempts exhausted (${attempt} attempts)`);
                    break;
                }

                // Check if error is retryable
                if (!this.isRetryableError(error, finalConfig.retryableErrors || [])) {
                    console.error(`❌ Non-retryable error encountered: ${error.code || error.message}`);
                    break;
                }

                // Calculate delay with exponential backoff
                const delay = this.calculateDelay(attempt, finalConfig);

                console.warn(
                    `⚠️  Attempt ${attempt}/${finalConfig.maxRetries} failed: ${error.message}. Retrying in ${delay}ms...`
                );

                // Call retry callback if provided
                if (finalConfig.onRetry) {
                    finalConfig.onRetry(attempt, error, delay);
                }

                // Wait before retrying
                await this.sleep(delay);
            }
        }

        return {
            success: false,
            error: lastError,
            attempts: attempt,
            totalDurationMs: Date.now() - startTime,
        };
    }

    /**
     * Check if an error is retryable
     */
    private static isRetryableError(error: any, retryableErrors: string[]): boolean {
        // Check error code
        if (error.code && retryableErrors.includes(error.code)) {
            return true;
        }

        // Check error message for specific patterns
        const errorMessage = error.message?.toLowerCase() || '';
        const retryablePatterns = [
            'timeout',
            'timed out',
            'rate limit',
            'quota exceeded',
            'service unavailable',
            'temporarily unavailable',
            'connection reset',
            'econnreset',
            'etimedout',
            'socket hang up',
            '503',
            '429',
            '500',
        ];

        return retryablePatterns.some((pattern) => errorMessage.includes(pattern));
    }

    /**
     * Calculate delay with exponential backoff
     */
    private static calculateDelay(attempt: number, config: RetryConfig): number {
        const exponentialDelay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
        
        // Add jitter (±20% randomization) to prevent thundering herd
        const jitter = exponentialDelay * 0.2 * (Math.random() * 2 - 1);
        const delayWithJitter = exponentialDelay + jitter;
        
        // Cap at maximum delay
        return Math.min(delayWithJitter, config.maxDelayMs);
    }

    /**
     * Sleep for specified milliseconds
     */
    private static sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Execute with circuit breaker pattern
     * Opens circuit after consecutive failures, closes after timeout
     */
    public static async executeWithCircuitBreaker<T>(
        fn: () => Promise<T>,
        config: Partial<RetryConfig> & {
            circuitBreakerThreshold?: number;
            circuitBreakerTimeout?: number;
        } = {}
    ): Promise<RetryResult<T>> {
        // This is a simplified implementation
        // In production, you'd want a more sophisticated circuit breaker with state management
        
        const threshold = config.circuitBreakerThreshold || 5;
        const timeout = config.circuitBreakerTimeout || 60000;

        // For now, just execute with retry
        return this.execute(fn, config);
    }

    /**
     * Batch retry - execute multiple operations with retry logic
     */
    public static async executeBatch<T>(
        operations: Array<() => Promise<T>>,
        config: Partial<RetryConfig> = {}
    ): Promise<Array<RetryResult<T>>> {
        const results: Array<RetryResult<T>> = [];

        for (const operation of operations) {
            const result = await this.execute(operation, config);
            results.push(result);

            // If an operation fails critically, you might want to stop the batch
            // This behavior can be configured
        }

        return results;
    }

    /**
     * Get recommended retry config for specific error types
     */
    public static getRecommendedConfig(errorType: 'network' | 'rate_limit' | 'server'): Partial<RetryConfig> {
        switch (errorType) {
            case 'network':
                return {
                    maxRetries: 3,
                    initialDelayMs: 1000,
                    maxDelayMs: 10000,
                    backoffMultiplier: 2,
                };
            case 'rate_limit':
                return {
                    maxRetries: 5,
                    initialDelayMs: 5000,
                    maxDelayMs: 60000,
                    backoffMultiplier: 2,
                };
            case 'server':
                return {
                    maxRetries: 4,
                    initialDelayMs: 2000,
                    maxDelayMs: 30000,
                    backoffMultiplier: 2,
                };
            default:
                return this.DEFAULT_CONFIG;
        }
    }
}
