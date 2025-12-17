/**
 * Throttle Utility
 * Provides function throttling and debouncing utilities
 */

/**
 * Throttle a function to execute at most once per interval
 */
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    waitMs: number
): (...args: Parameters<T>) => ReturnType<T> | undefined {
    let lastExecuted = 0;
    let timeout: NodeJS.Timeout | null = null;

    return function (this: any, ...args: Parameters<T>) {
        const now = Date.now();
        const timeSinceLastExecution = now - lastExecuted;

        if (timeSinceLastExecution >= waitMs) {
            lastExecuted = now;
            return func.apply(this, args);
        }

        return undefined;
    };
}

/**
 * Debounce a function to delay execution until after waitMs
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    waitMs: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;

    return function (this: any, ...args: Parameters<T>) {
        if (timeout) {
            clearTimeout(timeout);
        }

        timeout = setTimeout(() => {
            func.apply(this, args);
            timeout = null;
        }, waitMs);
    };
}

/**
 * Throttle with leading and trailing execution
 */
export function throttleLeadingTrailing<T extends (...args: any[]) => any>(
    func: T,
    waitMs: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;
    let lastExecuted = 0;
    let lastArgs: Parameters<T> | null = null;

    const execute = function (this: any) {
        lastExecuted = Date.now();
        if (lastArgs) {
            func.apply(this, lastArgs);
            lastArgs = null;
        }
    };

    return function (this: any, ...args: Parameters<T>) {
        const now = Date.now();
        const timeSinceLastExecution = now - lastExecuted;

        lastArgs = args;

        if (timeSinceLastExecution >= waitMs) {
            // Leading edge
            execute.call(this);
        } else {
            // Schedule trailing edge
            if (timeout) {
                clearTimeout(timeout);
            }
            timeout = setTimeout(() => {
                execute.call(this);
                timeout = null;
            }, waitMs - timeSinceLastExecution);
        }
    };
}

/**
 * Create a batch processor with throttling
 */
export class BatchThrottle<T> {
    private batch: T[] = [];
    private timeout: NodeJS.Timeout | null = null;
    private processing = false;

    constructor(
        private processBatch: (items: T[]) => Promise<void> | void,
        private maxBatchSize: number = 100,
        private maxWaitMs: number = 1000
    ) {}

    /**
     * Add item to batch
     */
    public add(item: T): void {
        this.batch.push(item);

        // Process if batch is full
        if (this.batch.length >= this.maxBatchSize) {
            this.flush();
        } else if (!this.timeout) {
            // Schedule batch processing
            this.timeout = setTimeout(() => {
                this.flush();
            }, this.maxWaitMs);
        }
    }

    /**
     * Flush batch immediately
     */
    public async flush(): Promise<void> {
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }

        if (this.batch.length === 0 || this.processing) {
            return;
        }

        this.processing = true;
        const currentBatch = [...this.batch];
        this.batch = [];

        try {
            await this.processBatch(currentBatch);
        } catch (error) {
            console.error('Batch processing error:', error);
            // Re-add failed items to batch for retry
            this.batch.unshift(...currentBatch);
        } finally {
            this.processing = false;
        }
    }

    /**
     * Get current batch size
     */
    public size(): number {
        return this.batch.length;
    }
}

/**
 * Adaptive throttle that adjusts wait time based on load
 */
export class AdaptiveThrottle<T extends (...args: any[]) => Promise<any>> {
    private queue: Array<{
        func: T;
        args: Parameters<T>;
        resolve: (value: any) => void;
        reject: (error: any) => void;
    }> = [];
    private processing = false;
    private currentWaitMs: number;
    private successCount = 0;
    private errorCount = 0;

    constructor(
        private minWaitMs: number = 100,
        private maxWaitMs: number = 5000,
        private adjustmentFactor: number = 1.5
    ) {
        this.currentWaitMs = minWaitMs;
    }

    /**
     * Execute function with adaptive throttling
     */
    public async execute(func: T, ...args: Parameters<T>): Promise<ReturnType<T>> {
        return new Promise((resolve, reject) => {
            this.queue.push({ func, args, resolve, reject });
            this.processQueue();
        });
    }

    /**
     * Process the queue
     */
    private async processQueue(): Promise<void> {
        if (this.processing || this.queue.length === 0) {
            return;
        }

        this.processing = true;

        while (this.queue.length > 0) {
            const item = this.queue.shift();
            if (!item) break;

            try {
                const result = await item.func(...item.args);
                item.resolve(result);
                this.onSuccess();
            } catch (error) {
                item.reject(error);
                this.onError();
            }

            // Wait before processing next item
            if (this.queue.length > 0) {
                await this.sleep(this.currentWaitMs);
            }
        }

        this.processing = false;
    }

    /**
     * Handle successful execution
     */
    private onSuccess(): void {
        this.successCount++;
        
        // Decrease wait time on sustained success
        if (this.successCount >= 5 && this.errorCount === 0) {
            this.currentWaitMs = Math.max(
                this.minWaitMs,
                this.currentWaitMs / this.adjustmentFactor
            );
            this.successCount = 0;
            console.log(`🚦 Adaptive throttle: decreased wait to ${this.currentWaitMs}ms`);
        }
    }

    /**
     * Handle failed execution
     */
    private onError(): void {
        this.errorCount++;
        this.successCount = 0;

        // Increase wait time on error
        this.currentWaitMs = Math.min(
            this.maxWaitMs,
            this.currentWaitMs * this.adjustmentFactor
        );
        console.log(`🚦 Adaptive throttle: increased wait to ${this.currentWaitMs}ms`);

        // Reset error count after adjustment
        if (this.errorCount >= 3) {
            this.errorCount = 0;
        }
    }

    /**
     * Get current wait time
     */
    public getCurrentWaitMs(): number {
        return this.currentWaitMs;
    }

    /**
     * Reset to minimum wait time
     */
    public reset(): void {
        this.currentWaitMs = this.minWaitMs;
        this.successCount = 0;
        this.errorCount = 0;
    }

    /**
     * Sleep utility
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
