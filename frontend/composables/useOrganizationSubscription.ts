/**
 * Organization Subscription Composable
 * 
 * Handles billing operations:
 * - Tier changes (upgrades/downgrades with Paddle proration)
 * - Payment method retrieval
 * - Downgrade request history lookup
 * 
 * @see backend/src/processors/SubscriptionProcessor.ts
 * @see backend/src/routes/subscription.ts
 * @see documentation/organization-billing-implementation-plan.md
 */
export const useOrganizationSubscription = () => {
    const config = useRuntimeConfig();

    const authHeaders = (): Record<string, string> => {
        const token = getAuthToken();
        if (!token) throw new Error('Authentication required');
        return {
            'Authorization': `Bearer ${token}`,
            'Authorization-Type': 'auth',
            'Content-Type': 'application/json'
        };
    };

    /**
     * Change subscription tier immediately
     * 
     * Applies changes immediately with Paddle proration:
     * - Upgrades: Prorated charge applied
     * - Downgrades: Credit applied to next billing cycle
     * 
     * Requires owner or admin role (enforced by backend).
     * 
     * @param organizationId - Organization ID
     * @param newTierId - Target subscription tier ID
     * @param billingCycle - 'monthly' or 'annual' (optional, defaults to current cycle)
     * @returns Success status and updated subscription data
     */
    const changeTier = async (
        organizationId: number,
        newTierId: number,
        billingCycle?: 'monthly' | 'annual'
    ): Promise<{ success: boolean; data?: any; error?: string }> => {
        try {
            const headers = authHeaders();
            headers['X-Organization-Id'] = organizationId.toString();
            
            const response = await $fetch<{ success: boolean; data: any; message?: string }>(
                `${config.public.apiBase}/subscription/change-tier`,
                {
                    method: 'POST',
                    headers: headers,
                    body: { organizationId, newTierId, billingCycle }
                }
            );
            
            console.log('✅ Tier change successful:', response);
            return { success: response.success, data: response.data };
        } catch (error: any) {
            console.error('[useOrganizationSubscription] changeTier error:', error);
            
            // Handle permission errors specifically
            if (error?.statusCode === 403) {
                return {
                    success: false,
                    error: 'Only organization owners and admins can change subscription tier'
                };
            }
            
            return {
                success: false,
                error: error?.data?.error || error?.message || 'Failed to change subscription tier'
            };
        }
    };

    /**
     * Get payment method details
     * 
     * Retrieves card details (last 4 digits, expiry, brand) for display.
     * Returns null if no payment method on file (FREE tier or no subscription).
     * 
     * PCI compliant - only returns last 4 digits and metadata.
     * 
     * @param organizationId - Organization ID
     * @returns Payment method details or null
     */
    const getPaymentMethod = async (
        organizationId: number
    ): Promise<{
        success: boolean;
        data?: {
            type: string;
            last4: string;
            expiryMonth: number;
            expiryYear: number;
            brand: string;
        } | null;
        error?: string;
    }> => {
        try {
            const headers = authHeaders();
            headers['X-Organization-Id'] = organizationId.toString();
            
            const response = await $fetch<{
                success: boolean;
                data: {
                    type: string;
                    last4: string;
                    expiryMonth: number;
                    expiryYear: number;
                    brand: string;
                } | null;
            }>(
                `${config.public.apiBase}/subscription/payment-method/${organizationId}`,
                {
                    method: 'GET',
                    headers: headers
                }
            );
            
            return { success: true, data: response.data };
        } catch (error: any) {
            console.error('[useOrganizationSubscription] getPaymentMethod error:', error);
            return {
                success: false,
                error: error?.data?.error || error?.message || 'Failed to retrieve payment method',
                data: null
            };
        }
    };

    /**
     * Get active downgrade requests for organization
     * 
     * Returns pending/contacted downgrade requests.
     * Used to show history in billing section.
     * 
     * @param organizationId - Organization ID
     * @returns Array of downgrade requests
     */
    const getDowngradeRequests = async (
        organizationId: number
    ): Promise<{
        success: boolean;
        data?: any[];
        error?: string;
    }> => {
        try {
            const headers = authHeaders();
            headers['X-Organization-Id'] = organizationId.toString();
            
            const response = await $fetch<{ success: boolean; data: any[] }>(
                `${config.public.apiBase}/subscription/downgrade-requests/${organizationId}`,
                {
                    method: 'GET',
                    headers: headers
                }
            );
            
            return { success: true, data: response.data };
        } catch (error: any) {
            console.error('[useOrganizationSubscription] getDowngradeRequests error:', error);
            return {
                success: false,
                error: error?.data?.error || error?.message || 'Failed to retrieve downgrade requests',
                data: []
            };
        }
    };

    /**
     * Get all available subscription tiers
     * 
     * Returns all active tiers with pricing and features.
     * Used for tier selection modal.
     * 
     * @returns Array of subscription tiers
     */
    const getTiers = async (): Promise<{
        success: boolean;
        data?: any[];
        error?: string;
    }> => {
        try {
            const response = await $fetch<{ success: boolean; data: any[] }>(
                `${config.public.apiBase}/subscription/tiers`,
                {
                    method: 'GET'
                }
            );
            
            return { success: true, data: response.data };
        } catch (error: any) {
            console.error('[useOrganizationSubscription] getTiers error:', error);
            return {
                success: false,
                error: error?.data?.error || error?.message || 'Failed to retrieve subscription tiers',
                data: []
            };
        }
    };

    /**
     * Format timestamp to relative time string
     * 
     * Utility for displaying last sync times, payment dates, etc.
     * 
     * @param timestamp - ISO date string or Date object
     * @returns Relative time string (e.g., "2 days ago", "Just now")
     */
    const formatRelativeTime = (timestamp: string | Date | null): string => {
        if (!timestamp) return 'Never';
        
        const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        
        if (diffMs < 0) return 'In the future'; // Clock skew or scheduled future date
        
        const diffSeconds = Math.floor(diffMs / 1000);
        const diffMinutes = Math.floor(diffSeconds / 60);
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffSeconds < 60) return 'Just now';
        if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
        if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
        
        // For dates older than 30 days, show formatted date
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    return {
        changeTier,
        getPaymentMethod,
        getDowngradeRequests,
        getTiers,
        formatRelativeTime
    };
};
