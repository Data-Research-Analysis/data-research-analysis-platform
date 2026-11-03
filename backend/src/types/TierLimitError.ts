/**
 * Custom error class for subscription limit violations.
 * Used to return 402 Payment Required responses.
 */
export class TierLimitError extends Error {
    public readonly tierName: string;
    public readonly resource: 'ai_generation';
    public readonly currentUsage: number;
    public readonly limit: number;

    constructor(
        tierName: string,
        resource: 'ai_generation',
        currentUsage: number,
        limit: number
    ) {
        super(
            `${tierName} tier limit reached: ${currentUsage}/${limit} ${resource.replace('_', ' ')}s used.`
        );

        this.name = 'TierLimitError';
        this.tierName = tierName;
        this.resource = resource;
        this.currentUsage = currentUsage;
        this.limit = limit;

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, TierLimitError);
        }
    }

    /**
     * Converts error to JSON for 402 API responses
     */
    toJSON() {
        return {
            error: 'TIER_LIMIT_EXCEEDED',
            message: this.message,
            tierName: this.tierName,
            resource: this.resource,
            currentUsage: this.currentUsage,
            limit: this.limit,
            upgradeUrl: '/pricing'
        };
    }
}
