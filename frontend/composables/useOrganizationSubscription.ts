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
            
            const response = await $fetch<{ success: boolean; data?: any; useCheckout?: boolean; error?: string; message?: string }>(
                `${config.public.apiBase}/subscription/change-tier`,
                {
                    method: 'POST',
                    headers: headers,
                    body: { organizationId, newTierId, billingCycle }
                }
            );
            
            console.log('✅ Tier change response:', response);
            
            // Check if backend says to use checkout instead (canceled subscription)
            if (response.useCheckout) {
                const error = new Error(response.error || 'SUBSCRIPTION_CANCELED_USE_CHECKOUT');
                (error as any).useCheckout = true;
                throw error;
            }
            
            // Check if the operation failed for other reasons
            if (!response.success) {
                throw new Error(response.error || 'Failed to change tier');
            }
            
            return { success: response.success, data: response.data };
        } catch (error: any) {
            console.error('[useOrganizationSubscription] changeTier error:', error);
            
            // Re-throw if it's a useCheckout error (needs special handling)
            if (error.useCheckout) {
                throw error;
            }
            
            // Handle permission errors specifically
            if (error?.statusCode === 403) {
                return {
                    success: false,
                    error: 'Only organization owners and admins can change subscription tier'
                };
            }
            
            // Preserve structured error data (e.g., DOWNGRADE_BLOCKED with violations)
            return {
                success: false,
                error: error?.data?.error || error?.message || 'Failed to change subscription tier',
                code: error?.data?.code,
                violations: error?.data?.violations
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

    /**
     * Preview upgrade cost (proration) from Paddle
     * 
     * Fetches proration details from Paddle API before charging.
     * Shows exact amount that will be charged for tier + billing cycle change.
     * 
     * @param organizationId - Organization ID
     * @param tierId - Target tier ID
     * @param billingCycle - Selected billing cycle from UI toggle
     * @returns Proration preview with immediate charge amount
     */
    const previewUpgrade = async (
        organizationId: number,
        tierId: number,
        billingCycle: 'monthly' | 'annual',
        discountId?: string
    ) => {
        const headers = authHeaders();
        headers['X-Organization-Id'] = organizationId.toString();

        const discountParam = discountId ? `?discountId=${encodeURIComponent(discountId)}` : '';
        const response = await $fetch<{ success: boolean; preview?: any; error?: string }>(
            `${config.public.apiBase}/subscription/preview-upgrade/${organizationId}/${tierId}/${billingCycle}${discountParam}`,
            {
                headers
            }
        );
        
        if (!response.success) {
            throw new Error(response.error || 'Failed to preview upgrade');
        }
        
        return response.preview;
    };

    /**
     * Execute upgrade after user confirms proration
     * 
     * Charges the payment method on file via Paddle.
     * Organization owner only (enforced by backend).
     * 
     * @param organizationId - Organization ID
     * @param tierId - Target tier ID
     * @param billingCycle - Selected billing cycle from UI toggle
     * @returns Success status
     */
    const executeUpgrade = async (
        organizationId: number,
        tierId: number,
        billingCycle: 'monthly' | 'annual',
        discountId?: string
    ) => {
        console.log('[useOrganizationSubscription] executeUpgrade called:', {
            organizationId,
            tierId,
            billingCycle,
            discountId: discountId || null,
            apiBase: config.public.apiBase
        });
        
        const headers = authHeaders();
        headers['X-Organization-Id'] = organizationId.toString();

        const response = await $fetch<{ success: boolean; subscription?: any; useCheckout?: boolean; message?: string; error?: string }>(
            `${config.public.apiBase}/subscription/execute-upgrade`,
            {
                method: 'POST',
                headers,
                body: { organizationId, tierId, billingCycle, discountId: discountId || undefined }
            }
        );
        
        console.log('[useOrganizationSubscription] executeUpgrade response:', response);
        
        // Check if backend says to use checkout instead
        if (response.useCheckout) {
            const error = new Error(response.error || 'SUBSCRIPTION_CANCELED_USE_CHECKOUT');
            (error as any).useCheckout = true;
            throw error;
        }
        
        if (!response.success) {
            throw new Error(response.error || 'Upgrade failed');
        }
        
        return response;
    };

    /**
     * Validate payment method on file
     * 
     * Checks if payment method exists and is not expired.
     * Used before showing upgrade modal to ensure payment can succeed.
     * 
     * @param organizationId - Organization ID
     * @returns Validation result with expiry details
     */
    const validatePaymentMethod = async (organizationId: number) => {
        const response = await $fetch<{ success: boolean; validation: any }>(
            `${config.public.apiBase}/subscription/validate-payment-method/${organizationId}`,
            {
                headers: authHeaders()
            }
        );
        
        if (!response.success) {
            throw new Error('Failed to validate payment method');
        }
        
        return response.validation;
    };

    /**
     * Sync subscription from Paddle
     * 
     * Manually fetches the current subscription state from Paddle and updates
     * the database to match. Useful when database and Paddle are out of sync.
     * 
     * @param organizationId - Organization ID
     * @returns Sync result with changes applied
     */
    const syncFromPaddle = async (organizationId: number) => {
        try {
            const response = await $fetch<{ 
                success: boolean; 
                data: {
                    subscription: any;
                    wasDifferent: boolean;
                    changes: string[];
                } 
            }>(
                `${config.public.apiBase}/subscription/sync-from-paddle/${organizationId}`,
                {
                    method: 'POST',
                    headers: authHeaders()
                }
            );
            
            if (!response.success) {
                throw new Error('Failed to sync from Paddle');
            }
            
            return response.data;
        } catch (error: any) {
            console.error('[useOrganizationSubscription] syncFromPaddle error:', error);
            throw error;
        }
    };

    const resumeSubscription = async (organizationId: number) => {
        try {
            const token = getAuthToken();
            const response = await $fetch<{ success: boolean; message: string }>(
                `${config.public.apiBase}/subscription/resume`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Authorization-Type': 'auth',
                        'Content-Type': 'application/json',
                    },
                    body: { organizationId }
                }
            );

            if (!response.success) {
                throw new Error(response.message || 'Failed to resume subscription');
            }

            return response;
        } catch (error: any) {
            console.error('[useOrganizationSubscription] resumeSubscription error:', error);
            throw error;
        }
    };

    return {
        changeTier,
        getPaymentMethod,
        getDowngradeRequests,
        getTiers,
        formatRelativeTime,
        previewUpgrade,
        executeUpgrade,
        validatePaymentMethod,
        syncFromPaddle,
        resumeSubscription
    };
};
