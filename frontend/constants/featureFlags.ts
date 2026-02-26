/**
 * Feature Flags
 *
 * Controls which data source integrations are visible and enabled for
 * non-admin users.
 *
 * Admin users always bypass these flags and see the full functionality.
 *
 * To enable an integration after production API access is approved:
 *   1. Set the flag to `true`
 *   2. Commit and deploy — no other code changes needed.
 */
export const FEATURE_FLAGS = {
    /**
     * Meta Ads integration.
     * Set to true once Meta approves the Marketing API production access.
     */
    META_ADS_ENABLED: false,

    /**
     * LinkedIn Ads integration.
     * Set to true once LinkedIn approves the Advertising API production access.
     */
    LINKEDIN_ADS_ENABLED: false,

    /**
     * HubSpot CRM integration.
     * Set to true once HubSpot OAuth app is approved for production.
     */
    HUBSPOT_ENABLED: false,

    /**
     * Klaviyo Email Marketing integration.
     * Set to true once the Klaviyo API key connector is ready for production.
     */
    KLAVIYO_ENABLED: false,
} as const;
