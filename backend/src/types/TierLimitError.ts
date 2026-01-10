import { ESubscriptionTier } from '../models/DRASubscriptionTier.js';

/**
 * Custom error class for subscription tier limit violations
 * Used to return 402 Payment Required responses with detailed upgrade information
 */
export class TierLimitError extends Error {
    public readonly tierName: ESubscriptionTier;
    public readonly resource: 'project' | 'data_source' | 'dashboard' | 'ai_generation';
    public readonly currentUsage: number;
    public readonly limit: number;
    public readonly upgradeTiers: Array<{
        tierName: ESubscriptionTier;
        limit: number | null;
        pricePerMonth: number;
    }>;

    constructor(
        tierName: ESubscriptionTier,
        resource: 'project' | 'data_source' | 'dashboard' | 'ai_generation',
        currentUsage: number,
        limit: number,
        upgradeTiers: Array<{
            tierName: ESubscriptionTier;
            limit: number | null;
            pricePerMonth: number;
        }>
    ) {
        const resourceDisplay = resource.replace('_', ' ');
        super(
            `${tierName} tier limit reached: ${currentUsage}/${limit} ${resourceDisplay}s used. Upgrade to access more.`
        );
        
        this.name = 'TierLimitError';
        this.tierName = tierName;
        this.resource = resource;
        this.currentUsage = currentUsage;
        this.limit = limit;
        this.upgradeTiers = upgradeTiers;

        // Maintains proper stack trace for where error was thrown (V8 only)
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
            upgradeTiers: this.upgradeTiers,
            upgradeUrl: '/pricing'
        };
    }
}
