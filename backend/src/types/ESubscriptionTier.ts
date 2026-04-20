/**
 * Subscription Tier Names Enum
 * 
 * These are the canonical tier_name values stored in dra_subscription_tiers table.
 * Tier comparison should use tier_rank field (0=Free, 10=Starter, 20=Professional, etc.)
 * but this enum provides type-safe tier name constants for queries and tests.
 */
export enum ESubscriptionTier {
    FREE = 'FREE',
    STARTER = 'STARTER',
    PROFESSIONAL = 'PROFESSIONAL',
    PROFESSIONAL_PLUS = 'PROFESSIONAL PLUS',
    ENTERPRISE = 'ENTERPRISE'
}
