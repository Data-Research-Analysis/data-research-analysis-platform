<template>
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <!-- Header -->
        <div class="mb-8">
            <h1 class="text-3xl font-bold text-gray-900">Billing & Subscription</h1>
            <p class="mt-2 text-gray-600">Manage your subscription and billing details</p>
        </div>
        
        <!-- Payment Method Warning (shown when payment method is expired/invalid) -->
        <!-- Only show for expired cards, not canceled subscriptions -->
        <div v-if="!state.paymentMethodValid && state.paymentMethodValidated && !state.loading && state.paymentValidation?.reason?.includes('expired')" 
             class="mb-6 bg-red-50 border-2 border-red-400 rounded-lg p-6">
            <div class="flex items-start">
                <font-awesome-icon :icon="['fas', 'exclamation-triangle']" class="text-red-600 mr-4 mt-1 flex-shrink-0 text-xl" />
                <div class="flex-1">
                    <h3 class="text-lg font-semibold text-red-900 mb-2">Payment Method Update Required</h3>
                    <p class="text-sm text-red-800 mb-3">
                        {{ state.paymentValidation?.reason || 'Your payment method needs to be updated.' }}
                    </p>
                    <div class="bg-red-100 border border-red-300 rounded-lg p-3 mb-4">
                        <p class="text-sm text-red-800">
                            <strong>Important:</strong> You won't be able to upgrade your plan until your payment method is updated. Click the button below to update it through Paddle.
                        </p>
                    </div>
                    <button
                        @click="handleUpdatePaymentMethod"
                        :disabled="state.updating"
                        class="px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                        <font-awesome-icon v-if="state.updating" :icon="['fas', 'spinner']" class="animate-spin mr-2" />
                        {{ state.updating ? 'Opening Billing Portal...' : 'Update Payment Method Now' }}
                    </button>
                </div>
            </div>
        </div>
        
        <!-- Loading State -->
        <div v-if="state.loading" class="flex justify-center items-center py-16">
            <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin text-5xl text-primary-blue-100" />
        </div>
        
        <!-- Content -->
        <div v-else>
            <!-- Current Subscription Card -->
            <div class="bg-white shadow rounded-lg p-6 mb-6">
                <h2 class="text-xl font-semibold text-gray-900 mb-4">Current Subscription</h2>
                
                <div v-if="state.subscription" class="space-y-6">
                    <!-- Subscription Details Grid -->
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <p class="text-sm text-gray-500">Plan</p>
                            <p class="text-lg font-semibold text-gray-900">
                                {{ state.subscription.tier_name || 'FREE' }}
                            </p>
                        </div>
                        
                        <div>
                            <p class="text-sm text-gray-500">Billing Cycle</p>
                            <p class="text-lg font-semibold text-gray-900 capitalize">
                                {{ state.subscription.billing_cycle || 'N/A' }}
                            </p>
                        </div>
                        
                        <div>
                            <p class="text-sm text-gray-500">
                                {{ state.subscription.cancelled_at ? 'Access Until' : state.subscription.scheduled_cancellation ? 'Cancels On' : 'Next Payment' }}
                            </p>
                            <p class="text-lg font-semibold text-gray-900">
                                {{ state.subscription.scheduled_cancellation ? formatDate(state.subscription.scheduled_cancellation.effective_at) : formatDate(state.subscription.ends_at) }}
                            </p>
                        </div>
                    </div>
                    
                    <!-- Scheduled Cancellation Notice (from Paddle) -->
                    <div v-if="state.subscription.scheduled_cancellation && !state.subscription.cancelled_at" class="bg-orange-50 border border-orange-200 rounded-lg p-4">
                        <div class="flex items-start">
                            <font-awesome-icon :icon="['fas', 'calendar-xmark']" class="text-orange-500 mr-3 mt-1" />
                            <div>
                                <h3 class="text-sm font-semibold text-orange-900">Subscription Scheduled to Cancel</h3>
                                <p class="text-sm text-orange-700 mt-1">
                                    Your subscription will be cancelled on 
                                    <strong>{{ formatDate(state.subscription.scheduled_cancellation.effective_at) }}</strong>.
                                    You will retain access to {{ state.subscription.tier_name }} features until that date, 
                                    after which your account will be downgraded to the FREE tier.
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Cancellation Notice -->
                    <div v-if="state.subscription.cancelled_at && !isCancelledAndExpired" class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div class="flex items-start">
                            <font-awesome-icon :icon="['fas', 'circle-info']" class="text-yellow-500 mr-3 mt-1" />
                            <div>
                                <h3 class="text-sm font-semibold text-yellow-900">Subscription Cancelled</h3>
                                <p class="text-sm text-yellow-700 mt-1">
                                    Your subscription has been cancelled. You will retain access to 
                                    {{ state.subscription.tier_name }} features until 
                                    {{ formatDate(state.subscription.ends_at) }}, after which your account will be downgraded to the FREE tier.
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Expired Cancellation Notice -->
                    <div v-if="state.subscription.cancelled_at && isCancelledAndExpired" class="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div class="flex items-start">
                            <font-awesome-icon :icon="['fas', 'exclamation-circle']" class="text-red-500 mr-3 mt-1" />
                            <div>
                                <h3 class="text-sm font-semibold text-red-900">Subscription Expired</h3>
                                <p class="text-sm text-red-700 mt-1">
                                    Your subscription ended on {{ formatDate(state.subscription.ends_at) }}. 
                                    Your account should be downgraded to the FREE tier. If you're still seeing premium features, please contact support.
                                </p>
                                <button
                                    @click="handleUpgrade"
                                    class="mt-3 px-4 py-2 bg-primary-blue-100 text-white rounded-lg hover:bg-primary-blue-80 transition-colors cursor-pointer"
                                >
                                    Reactivate Subscription
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Grace Period Warning -->
                    <div v-if="state.subscription.grace_period_ends_at && !state.subscription.cancelled_at" class="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div class="flex items-start">
                            <font-awesome-icon :icon="['fas', 'triangle-exclamation']" class="text-red-500 mr-3 mt-1 flex-shrink-0" />
                            <div class="flex-1">
                                <h3 class="text-sm font-semibold text-red-900">Payment Failed</h3>
                                <p class="text-sm text-red-700 mt-1">
                                    Your last payment failed. Please update your payment method by 
                                    <strong>{{ formatDate(state.subscription.grace_period_ends_at) }}</strong> 
                                    ({{ daysRemainingInGracePeriod }} days remaining) to avoid service interruption.
                                </p>
                                <button
                                    @click="handleUpdatePaymentMethod"
                                    :disabled="state.updating"
                                    class="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                >
                                    <font-awesome-icon v-if="state.updating" :icon="['fas', 'spinner']" class="animate-spin mr-2" />
                                    {{ state.updating ? 'Opening...' : 'Update Payment Method' }}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- No Subscription (FREE tier) -->
                <div v-else class="text-center py-8">
                    <p class="text-gray-500 mb-4">You are currently on the FREE tier</p>
                    <button
                        @click="navigateTo('/pricing')"
                        class="px-6 py-2 bg-primary-blue-100 text-white rounded-lg hover:bg-primary-blue-80 transition-colors cursor-pointer"
                    >
                        View Paid Plans
                    </button>
                </div>
                
                <!-- Action Buttons -->
                <div v-if="state.subscription && state.subscription.tier_name !== 'FREE'" class="mt-6 flex flex-wrap gap-3">
                    <button
                        v-if="canUpgrade"
                        @click="handleUpgrade"
                        class="px-6 py-2 bg-primary-blue-100 text-white rounded-lg hover:bg-primary-blue-80 transition-colors cursor-pointer"
                    >
                        Upgrade Plan
                    </button>
                    
                    <button
                        v-if="canDowngrade && !state.subscription.cancelled_at"
                        @click="handleDowngrade"
                        class="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors cursor-pointer"
                    >
                        Downgrade Plan
                    </button>
                    
                    <button
                        v-if="state.subscription.paddle_subscription_id && !state.subscription.cancelled_at"
                        @click="handleUpdatePaymentMethod"
                        :disabled="state.updating"
                        class="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                        <font-awesome-icon v-if="state.updating" :icon="['fas', 'spinner']" class="animate-spin mr-2" />
                        {{ state.updating ? 'Opening...' : 'Update Payment Method' }}
                    </button>
                    
                    <button
                        v-if="state.subscription.paddle_subscription_id && !state.subscription.cancelled_at && !state.subscription.scheduled_cancellation"
                        @click="handleCancel"
                        class="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors cursor-pointer"
                    >
                        Cancel Subscription
                    </button>
                    
                    <button
                        v-if="state.subscription.cancelled_at"
                        @click="handleReactivate"
                        class="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors cursor-pointer"
                    >
                        Reactivate Subscription
                    </button>
                </div>
            </div>
            
            <!-- Usage Overview -->
            <SubscriptionUsageCard v-if="state.subscription" />
            
            <!-- Payment History -->
            <div class="bg-white shadow rounded-lg p-6 mt-6">
                <h2 class="text-xl font-semibold text-gray-900 mb-4">Payment History</h2>
                
                <div v-if="state.loadingHistory" class="text-center py-8">
                    <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin text-3xl text-primary-blue-100" />
                </div>
                
                <div v-else-if="state.paymentHistory.length === 0" class="text-center py-8 text-gray-500">
                    No payment history available
                </div>
                
                <div v-else class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead>
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            <tr v-for="payment in state.paymentHistory" :key="payment.id">
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {{ formatDate(payment.created_at) }}
                                </td>
                                <td class="px-6 py-4 text-sm text-gray-900 max-w-xs">
                                    <span v-if="payment.description">{{ payment.description }}</span>
                                    <span v-else-if="payment.tier_name" class="capitalize">
                                        {{ payment.tier_name }} — {{ payment.billing_cycle ?? 'N/A' }}
                                    </span>
                                    <span v-else class="text-gray-400">—</span>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm">
                                    <span :class="{
                                        'text-green-700 bg-green-100': payment.transaction_type === 'charge',
                                        'text-red-700 bg-red-100': payment.transaction_type === 'refund',
                                        'text-blue-700 bg-blue-100': payment.transaction_type === 'credit' || payment.transaction_type === 'adjustment',
                                    }" class="px-2 py-0.5 rounded-full text-xs font-medium capitalize">
                                        {{ payment.transaction_type ?? 'charge' }}
                                    </span>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm" :class="payment.transaction_type === 'refund' || payment.transaction_type === 'credit' ? 'text-red-600' : 'text-gray-900'">
                                    {{ payment.transaction_type === 'refund' || payment.transaction_type === 'credit' ? '-' : '' }}{{ formatCurrency(Math.abs(payment.amount)) }}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <span :class="getStatusClass(payment.status)" class="px-2 py-1 text-xs font-medium rounded-full">
                                        {{ payment.status }}
                                    </span>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm">
                                    <a 
                                        v-if="payment.invoice_url" 
                                        :href="payment.invoice_url" 
                                        target="_blank" 
                                        class="text-primary-blue-100 hover:underline"
                                    >
                                        Download
                                    </a>
                                    <span v-else class="text-gray-400">N/A</span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
definePageMeta({ 
    layout: 'project'
});

import { usePaddle } from '~/composables/usePaddle';
import { useOrganizationsStore } from '~/stores/organizations';
import { useOrganizationSubscription } from '~/composables/useOrganizationSubscription';

const paddle = usePaddle();
const orgStore = useOrganizationsStore();
const orgSubscription = useOrganizationSubscription();
const { $swal } = useNuxtApp();
const config = useRuntimeConfig();

const state = reactive({
    loading: true,
    loadingHistory: false,
    updating: false,
    subscription: null as any,
    paymentHistory: [] as any[],
    paymentMethodValid: true,
    paymentMethodValidated: false,
    paymentValidation: null as any,
});

// Computed properties
const canUpgrade = computed(() => {
    const tier = state.subscription?.tier_name;
    return tier && tier !== 'ENTERPRISE' && tier !== 'PROFESSIONAL PLUS';
});

const canDowngrade = computed(() => {
    const tier = state.subscription?.tier_name;
    return tier && tier !== 'FREE';
});

const daysRemainingInGracePeriod = computed(() => {
    if (!state.subscription?.grace_period_ends_at) return 0;
    
    const now = new Date();
    const gracePeriodEnd = new Date(state.subscription.grace_period_ends_at);
    const diffTime = gracePeriodEnd.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays);
});

// Check if a cancelled subscription has expired
const isCancelledAndExpired = computed(() => {
    if (!state.subscription?.cancelled_at || !state.subscription?.ends_at) return false;
    
    const now = new Date();
    const endsAt = new Date(state.subscription.ends_at);
    
    return now > endsAt;
});

// Methods
const handleUpdatePaymentMethod = async () => {
    if (!orgStore.currentOrganization) return;
    
    state.updating = true;
    try {
        await paddle.manageBilling(orgStore.currentOrganization.id);
    } catch (error: any) {
        ($swal as any).fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'Failed to open billing portal',
            confirmButtonColor: '#1e3a5f'
        });
    } finally {
        state.updating = false;
    }
};

const handleUpgrade = () => {
    // Navigate to pricing page with upgrade intent
    navigateTo('/pricing');
    ($swal as any).fire({
        icon: 'info',
        title: 'Upgrade Your Plan',
        text: 'Select a higher tier plan to upgrade your subscription.',
        confirmButtonColor: '#1e3a5f'
    });
};

const handleDowngrade = async () => {
    const result = await ($swal as any).fire({
        icon: 'warning',
        title: 'Downgrade Subscription',
        html: '<p>Are you sure you want to downgrade your subscription?</p><p class="text-sm text-gray-600 mt-2">Changes will take effect at the end of your current billing period.</p>',
        showCancelButton: true,
        confirmButtonText: 'Yes, Downgrade',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#6b7280'
    });
    
    if (result.isConfirmed) {
        // TODO: Implement downgrade flow
        ($swal as any).fire({
            icon: 'info',
            title: 'Coming Soon',
            text: 'Downgrade functionality will be available soon. Please contact support for assistance.',
            confirmButtonColor: '#1e3a5f'
        });
    }
};

const handleCancel = async () => {
    const result = await ($swal as any).fire({
        icon: 'warning',
        title: 'Cancel Subscription',
        html: `<p>Are you sure you want to cancel your subscription?</p>
               <p class="text-sm text-gray-600 mt-2">You will retain access to ${state.subscription?.tier_name} features until the end of your current billing period.</p>
               <p class="text-sm text-gray-600 mt-2">After that, your account will be downgraded to the FREE tier.</p>`,
        input: 'select',
        inputOptions: {
            'too_expensive': 'Too expensive',
            'missing_features': 'Missing features I need',
            'found_alternative': 'Found an alternative',
            'no_longer_needed': 'No longer needed',
            'other': 'Other reason'
        },
        inputPlaceholder: 'Select a reason (optional)',
        showCancelButton: true,
        confirmButtonText: 'Yes, Cancel Subscription',
        cancelButtonText: 'Keep Subscription',
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#6b7280'
    });
    
    if (result.isConfirmed) {
        try {
            const token = getAuthToken();
            const response = await $fetch(`${config.public.apiBase}/subscription/cancel`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                    'Content-Type': 'application/json'
                },
                body: {
                    organizationId: orgStore.currentOrganization?.id,
                    reason: result.value || 'not_specified'
                }
            });
            
            if (response.success) {
                await loadSubscriptionData();
                ($swal as any).fire({
                    icon: 'success',
                    title: 'Subscription Cancelled',
                    text: 'Your subscription has been cancelled. You will retain access until the end of your billing period.',
                    confirmButtonColor: '#1e3a5f'
                });
            }
        } catch (error: any) {
            ($swal as any).fire({
                icon: 'error',
                title: 'Error',
                text: error.message || 'Failed to cancel subscription',
                confirmButtonColor: '#1e3a5f'
            });
        }
    }
};

const handleReactivate = async () => {
    const result = await ($swal as any).fire({
        icon: 'question',
        title: 'Reactivate Subscription',
        text: 'Would you like to reactivate your subscription?',
        showCancelButton: true,
        confirmButtonText: 'Yes, Reactivate',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#6b7280'
    });
    
    if (result.isConfirmed) {
        // TODO: Implement reactivation flow
        ($swal as any).fire({
            icon: 'info',
            title: 'Coming Soon',
            text: 'Reactivation functionality will be available soon. Please contact support for assistance.',
            confirmButtonColor: '#1e3a5f'
        });
    }
};

const formatDate = (date: string | Date | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
};

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount / 100); // Paddle amounts are in cents
};

const getStatusClass = (status: string) => {
    const classes: Record<string, string> = {
        'completed': 'bg-green-100 text-green-800',
        'succeeded': 'bg-green-100 text-green-800',
        'failed': 'bg-red-100 text-red-800',
        'pending': 'bg-yellow-100 text-yellow-800',
        'canceled': 'bg-gray-100 text-gray-800'
    };
    return classes[status.toLowerCase()] || 'bg-gray-100 text-gray-800';
};

const loadSubscriptionData = async () => {
    if (!orgStore.currentOrganization) return;
    
    try {
        const token = getAuthToken();
        const response = await $fetch(`${config.public.apiBase}/subscription/${orgStore.currentOrganization.id}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Authorization-Type': 'auth'
            }
        });
        
        if (response.success) {
            state.subscription = response.data;
        }
    } catch (error) {
        console.error('Failed to load subscription:', error);
    }
};

const loadPaymentHistory = async () => {
    if (!orgStore.currentOrganization) return;
    
    state.loadingHistory = true;
    try {
        const token = getAuthToken();
        const response = await $fetch(
            `${config.public.apiBase}/subscription/payment-history/${orgStore.currentOrganization.id}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth'
                }
            }
        );
        
        if (response.success) {
            state.paymentHistory = response.data || [];
        }
    } catch (error) {
        console.error('Failed to load payment history:', error);
        state.paymentHistory = [];
    } finally {
        state.loadingHistory = false;
    }
};

// Validate payment method on file
const validatePaymentMethod = async () => {
    if (!orgStore.currentOrganization) return;
    
    try {
        const validation = await orgSubscription.validatePaymentMethod(orgStore.currentOrganization.id);
        state.paymentMethodValid = validation.isValid;
        state.paymentValidation = validation;
        state.paymentMethodValidated = true;
    } catch (error: any) {
        console.error('[validatePaymentMethod] Error:', error);
        // Don't show payment warning if subscription doesn't exist or is canceled
        // Just mark as validated so the page loads normally
        state.paymentMethodValid = true; // Don't block the UI
        state.paymentMethodValidated = true;
    }
};

// Load data on mount
onMounted(async () => {
    if (!orgStore.currentOrganization) {
        navigateTo('/');
        return;
    }
    
    state.loading = true;
    try {
        await Promise.all([
            loadSubscriptionData(),
            loadPaymentHistory(),
            validatePaymentMethod()
        ]);
    } finally {
        state.loading = false;
    }
});
</script>
