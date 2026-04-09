/**
 * usePaddle Composable
 * 
 * Provides methods for Paddle checkout integration and billing management.
 * 
 * Features:
 * - Open Paddle checkout overlay for subscriptions
 * - Manage billing (payment method updates)
 * - Handle checkout success/failure
 * - Poll backend for subscription activation
 * - Format prices and calculate savings
 * 
 * @see documentation/paddle-integration-plan.md Phase 3, Issue #8
 */
export const usePaddle = () => {
    const config = useRuntimeConfig();
    
    /**
     * Open Paddle checkout overlay for subscription purchase
     * 
     * @param tierId - Subscription tier ID from backend
     * @param billingCycle - 'monthly' or 'annual'
     * @param organizationId - Organization ID for the subscription
     */
    const openCheckout = async (
        tierId: number,
        billingCycle: 'monthly' | 'annual',
        organizationId: number
    ): Promise<void> => {
        try {
            const token = getAuthToken();
            if (!token) {
                throw new Error('Authentication required');
            }
            
            // Get checkout session from backend (creates Paddle checkout with price ID)
            const response = await $fetch<{
                success: boolean;
                priceId: string;
                sessionId: string;
                customerEmail: string;
            }>(`${config.public.apiBase}/subscription/checkout`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                    'Content-Type': 'application/json'
                },
                body: { tierId, billingCycle, organizationId }
            });
            
            if (!response.success) {
                throw new Error('Failed to create checkout session');
            }
            
            console.log('🛒 Opening Paddle checkout:', response);
            
            // Open Paddle Overlay (modal checkout)
            if (import.meta.client && window.Paddle) {
                // @ts-ignore - Paddle types from plugin
                window.Paddle.Checkout.open({
                    items: [{ priceId: response.priceId, quantity: 1 }],
                    customer: { email: response.customerEmail },
                    customData: { 
                        organizationId, 
                        tierId,
                        billingCycle 
                    },
                    successCallback: (data: any) => {
                        // Clear checkout-in-progress flag
                        const checkoutKey = `paddle_checkout_in_progress_org_${organizationId}`;
                        localStorage.removeItem(checkoutKey);
                        handleCheckoutSuccess(data.transaction_id, organizationId);
                    },
                    closeCallback: () => {
                        console.log('🔒 Checkout closed by user');
                        // Clear checkout-in-progress flag when user closes overlay
                        const checkoutKey = `paddle_checkout_in_progress_org_${organizationId}`;
                        localStorage.removeItem(checkoutKey);
                    }
                });
            } else {
                throw new Error('Paddle SDK not loaded. Please refresh the page.');
            }
        } catch (error: any) {
            console.error('❌ Checkout error:', error);
            throw error;
        }
    };
    
    /**
     * Handle successful checkout
     * 
     * Polls backend to check if webhook has activated subscription.
     * Shows success message and navigates to billing page.
     * 
     * @param transactionId - Paddle transaction ID
     * @param organizationId - Organization ID
     */
    const handleCheckoutSuccess = async (
        transactionId: string,
        organizationId: number
    ) => {
        console.log('✅ Payment successful:', transactionId);
        
        // Poll backend for subscription activation (webhook may take a few seconds)
        let attempts = 0;
        const maxAttempts = 10; // 20 seconds max wait time
        
        const pollInterval = setInterval(async () => {
            attempts++;
            
            try {
                const token = getAuthToken();
                const response = await $fetch<{ 
                    success: boolean; 
                    activated: boolean;
                    subscription?: any;
                }>(
                    `${config.public.apiBase}/subscription/check-activation`,
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Authorization-Type': 'auth',
                            'Content-Type': 'application/json'
                        },
                        body: { organizationId, transactionId }
                    }
                );
                
                if (response.activated) {
                    clearInterval(pollInterval);
                    
                    // Refresh organization/subscription data in stores
                    const orgStore = useOrganizationsStore();
                    await orgStore.retrieveOrganizations();
                    
                    console.log('🎉 Subscription activated:', response.subscription);
                    
                    // Show success message
                    if (import.meta.client) {
                        const { $swal } = useNuxtApp();
                        await ($swal as any).fire({
                            icon: 'success',
                            title: 'Subscription Activated!',
                            html: `<p>Your subscription has been successfully activated.</p>
                                   <p class="mt-2 text-sm text-gray-600">You now have access to all ${response.subscription?.tier_name || ''} features.</p>`,
                            confirmButtonText: 'Continue to Billing',
                            confirmButtonColor: '#1e3a5f'
                        });
                    }
                    
                    // Navigate to billing page
                    navigateTo('/billing');
                }
            } catch (error) {
                console.error('⚠️ Poll error:', error);
            }
            
            if (attempts >= maxAttempts) {
                clearInterval(pollInterval);
                console.warn('⏱️ Max polling attempts reached. Subscription may still be activating.');
                
                // Show timeout message
                if (import.meta.client) {
                    const { $swal } = useNuxtApp();
                    ($swal as any).fire({
                        icon: 'info',
                        title: 'Processing Payment',
                        html: '<p>Your payment is being processed.</p><p class="mt-2 text-sm">Please check your billing page in a few moments.</p>',
                        confirmButtonText: 'Go to Billing',
                        confirmButtonColor: '#1e3a5f'
                    }).then(() => {
                        navigateTo('/billing');
                    });
                }
            }
        }, 2000); // Poll every 2 seconds
    };
    
    /**
     * Open Paddle billing portal
     * 
     * Allows customers to update payment method, view invoices, etc.
     * 
     * @param organizationId - Organization ID
     */
    const manageBilling = async (organizationId: number): Promise<void> => {
        try {
            const token = getAuthToken();
            if (!token) {
                throw new Error('Authentication required');
            }
            
            const response = await $fetch<{ 
                success: boolean; 
                url: string 
            }>(
                `${config.public.apiBase}/subscription/portal-url`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Authorization-Type': 'auth',
                        'Content-Type': 'application/json'
                    },
                    body: { organizationId }
                }
            );
            
            if (response.success && response.url && import.meta.client) {
                window.open(response.url, '_blank');
            } else {
                throw new Error('Failed to generate billing portal URL');
            }
        } catch (error: any) {
            console.error('❌ Billing portal error:', error);
            throw error;
        }
    };
    
    /**
     * Format price for display
     * 
     * @param amount - Price amount
     * @param currency - Currency code (default: USD)
     * @returns Formatted price string (e.g., "$29.00")
     */
    const formatPrice = (amount: number, currency: string = 'USD'): string => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency
        }).format(amount);
    };
    
    /**
     * Calculate annual savings percentage
     * 
     * @param monthlyPrice - Monthly subscription price
     * @param annualPrice - Annual subscription price (for 12 months)
     * @returns Savings percentage string (e.g., "20%")
     */
    const calculateAnnualSavings = (monthlyPrice: number, annualPrice: number): string => {
        const monthlyCost = monthlyPrice * 12;
        const savings = monthlyCost - annualPrice;
        const percentage = Math.round((savings / monthlyCost) * 100);
        return `${percentage}%`;
    };
    
    /**
     * Calculate dollar savings for annual billing
     * 
     * @param monthlyPrice - Monthly subscription price
     * @param annualPrice - Annual subscription price
     * @returns Savings amount (e.g., "$58")
     */
    const calculateAnnualSavingsDollars = (monthlyPrice: number, annualPrice: number): string => {
        const monthlyCost = monthlyPrice * 12;
        const savings = monthlyCost - annualPrice;
        return formatPrice(savings);
    };
    
    return {
        openCheckout,
        manageBilling,
        formatPrice,
        calculateAnnualSavings,
        calculateAnnualSavingsDollars
    };
};
