export interface IEnhancedUsageStats {
    tier: string;
    tierDetails: {
        id: number;
        tierName: string;
        pricePerMonth: number;
    };
    rowLimit: number;
    /** Credit-pricing mode (CREDITS_ENABLED): consumption is metered by credits. */
    creditsEnabled?: boolean;
    /** Org credit balance in credits mode (null when disabled). */
    creditBalance?: number | null;
}
