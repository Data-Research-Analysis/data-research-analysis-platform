<template>
    <OverlayDialog 
        v-if="isOpen"
        @close="close"
    >
        <template #overlay>
            <!-- Title -->
            <h2 class="text-2xl font-bold text-gray-900 mb-6">
                Upgrade to {{ formatTierName(newTierName) }}
            </h2>
            
            <div class="space-y-6 pb-24">
                    <!-- Loading state while fetching proration -->
                    <div v-if="state.loading" class="flex justify-center py-12">
                        <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin text-4xl text-primary-orange-300" />
                    </div>
                    
                    <!-- Error state -->
                    <div v-else-if="state.error" class="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div class="flex items-start">
                            <font-awesome-icon :icon="['fas', 'triangle-exclamation']" class="text-red-500 mt-0.5 mr-3" />
                            <div>
                                <h4 class="font-semibold text-red-900 mb-1">Unable to Preview Upgrade</h4>
                                <p class="text-sm text-red-700">{{ state.error }}</p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Proration details -->
                    <div v-else-if="state.preview" class="space-y-4">
                        <!-- Tier change summary -->
                        <div class="bg-gray-50 rounded-lg p-4">
                            <div class="flex items-center justify-between mb-3">
                                <div class="flex-1">
                                    <p class="text-sm text-gray-600">Current Plan</p>
                                    <p class="text-lg font-semibold text-gray-900">
                                        {{ formatTierName(state.preview.currentTier) }}
                                    </p>
                                </div>
                                <font-awesome-icon :icon="['fas', 'arrow-right']" class="text-gray-400 mx-4" />
                                <div class="flex-1">
                                    <p class="text-sm text-gray-600">New Plan</p>
                                    <p class="text-lg font-semibold text-primary-orange-300">
                                        {{ formatTierName(state.preview.newTier) }}
                                    </p>
                                </div>
                            </div>
                            <p class="text-sm text-gray-600">
                                Billing: {{ state.preview.newBillingCycle === 'monthly' ? 'Monthly' : 'Annual' }}
                            </p>
                        </div>
                        
                        <!-- Billing cycle change notice -->
                        <div v-if="state.preview.billingCycleChanging" class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div class="flex items-start">
                                <font-awesome-icon :icon="['fas', 'circle-info']" class="text-blue-500 mt-0.5 mr-3" />
                                <div>
                                    <h4 class="font-semibold text-blue-900 mb-1">Billing Cycle Changing</h4>
                                    <p class="text-sm text-blue-700">
                                        Your billing will change from 
                                        <span class="font-semibold">{{ state.preview.currentBillingCycle }}</span>
                                        to
                                        <span class="font-semibold">{{ state.preview.newBillingCycle }}</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Proration charge -->
                        <div class="border-t border-b border-gray-200 py-4">
                            <div class="flex justify-between items-center mb-2">
                                <span class="text-gray-700">Immediate Charge (Prorated)</span>
                                <span class="text-2xl font-bold text-gray-900">
                                    {{ formatCurrency(state.preview.immediateCharge, state.preview.currency) }}
                                </span>
                            </div>
                            <p class="text-sm text-gray-600">
                                You'll be charged today for the prorated upgrade amount.
                            </p>
                        </div>
                        
                        <!-- Next billing -->
                        <div class="bg-blue-50 rounded-lg p-4">
                            <div class="flex justify-between items-center mb-1">
                                <span class="text-sm text-gray-700">Next Billing Amount</span>
                                <span class="font-semibold text-gray-900">
                                    {{ formatCurrency(state.preview.nextBillingAmount, state.preview.currency) }}
                                </span>
                            </div>
                            <p class="text-xs text-gray-600">
                                Next billing date: {{ formatDate(state.preview.nextBillingDate) }}
                            </p>
                        </div>
                        
                        <!-- Payment method -->
                        <div class="flex items-center text-sm text-gray-600">
                            <font-awesome-icon :icon="['fas', 'credit-card']" class="mr-2" />
                            <span>Payment method on file will be charged</span>
                        </div>
                    </div>
            </div>
            
            <!-- Sticky Actions Footer -->
            <div class="sticky bottom-0 left-0 right-0 bg-white pt-6 mt-6 border-t border-gray-200">
                <div class="flex justify-end gap-3">
                    <button
                        @click="close"
                        class="px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                        :disabled="state.upgrading"
                    >
                        Cancel
                    </button>
                    <button
                        @click="confirmUpgrade"
                        :disabled="state.loading || state.upgrading || !!state.error"
                        class="px-6 py-3 bg-primary-blue-100 hover:bg-primary-blue-300 text-white rounded-lg font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center cursor-pointer"
                    >
                        <font-awesome-icon 
                            v-if="state.upgrading" 
                            :icon="['fas', 'spinner']" 
                            class="animate-spin mr-2" 
                        />
                        {{ state.upgrading ? 'Processing...' : 'Confirm Upgrade' }}
                    </button>
                </div>
            </div>
        </template>
    </OverlayDialog>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useOrganizationSubscription } from '~/composables/useOrganizationSubscription';

interface Props {
    isOpen: boolean;
    organizationId: number;
    newTierId: number;
    newTierName: string;
    billingCycle: 'monthly' | 'annual';
    paddleDiscountId?: string;
}

interface Emits {
    (e: 'close'): void;
    (e: 'success'): void;
    (e: 'redirect-to-checkout', payload: { tierId: number; billingCycle: 'monthly' | 'annual' }): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const orgSubscription = useOrganizationSubscription();

const state = reactive({
    loading: false,
    upgrading: false,
    error: null as string | null,
    preview: null as any
});

// Fetch proration preview when modal opens
watch(() => props.isOpen, async (isOpen) => {
    if (isOpen) {
        await fetchPreview();
    }
});

async function fetchPreview() {
    state.loading = true;
    state.error = null;
    
    console.log('[UpgradeModal] Fetching preview for:', {
        organizationId: props.organizationId,
        tierId: props.newTierId,
        tierName: props.newTierName,
        billingCycle: props.billingCycle
    });
    
    try {
        const result = await orgSubscription.previewUpgrade(
            props.organizationId,
            props.newTierId,
            props.billingCycle,
            props.paddleDiscountId || undefined
        );
        state.preview = result;
        console.log('[UpgradeModal] Preview data received:', result);
        console.log('[UpgradeModal] state.preview is now:', state.preview);
    } catch (error: any) {
        console.error('[UpgradeModal] Preview fetch failed:', error);
        
        // Check if subscription was canceled/not found - redirect to checkout
        if (error.message && error.message.includes('SUBSCRIPTION_CANCELED_USE_CHECKOUT')) {
            console.log('[UpgradeModal] Canceled subscription detected in preview, showing checkout dialog');
            close(); // Close modal first
            
            const { $swal } = useNuxtApp() as any;
            const result = await $swal.fire({
                title: 'Subscription Not Active',
                html: `
                    <div class="text-left space-y-3">
                        <p class="text-sm text-gray-600">
                            Your organization doesn't have an active subscription. To subscribe to this plan, we'll need to set up a new subscription.
                        </p>
                        <p class="text-sm text-gray-600">
                            Click "Continue to Checkout" to enter your payment details.
                        </p>
                    </div>
                `,
                icon: 'info',
                showCancelButton: true,
                confirmButtonText: 'Continue to Checkout',
                cancelButtonText: 'Cancel',
                confirmButtonColor: '#3b82f6',
                cancelButtonColor: '#6b7280',
            });
            
            if (result.isConfirmed) {
                console.log('[UpgradeModal] User confirmed, emitting redirect-to-checkout');
                emit('redirect-to-checkout', { tierId: props.newTierId, billingCycle: props.billingCycle });
            }
        } else {
            state.error = error.message || 'Failed to fetch upgrade preview';
        }
    } finally {
        state.loading = false;
    }
}

async function confirmUpgrade() {
    state.upgrading = true;
    console.log('[UpgradeModal] Starting upgrade:', {
        organizationId: props.organizationId,
        tierId: props.newTierId,
        tierName: props.newTierName,
        billingCycle: props.billingCycle
    });
    
    try {
        const result = await orgSubscription.executeUpgrade(
            props.organizationId,
            props.newTierId,
            props.billingCycle,
            props.paddleDiscountId || undefined
        );
        
        console.log('[UpgradeModal] Upgrade successful:', result);
        
        emit('success');
        close();
    } catch (error: any) {
        console.error('[UpgradeModal] Upgrade failed:', error);
        
        // Check if subscription was canceled - redirect to checkout
        if (error.useCheckout || (error.message && error.message.includes('SUBSCRIPTION_CANCELED_USE_CHECKOUT'))) {
            console.log('[UpgradeModal] Canceled subscription detected, showing checkout dialog');
            const { $swal } = useNuxtApp() as any;
            const result = await $swal.fire({
                title: 'Subscription Not Active',
                html: `
                    <div class="text-left space-y-3">
                        <p class="text-sm text-gray-600">
                            Your previous subscription was canceled. To subscribe to this plan, we'll need to set up a new subscription.
                        </p>
                        <p class="text-sm text-gray-600">
                            Click "Continue to Checkout" to enter your payment details.
                        </p>
                    </div>
                `,
                icon: 'info',
                showCancelButton: true,
                confirmButtonText: 'Continue to Checkout',
                cancelButtonText: 'Cancel',
                confirmButtonColor: '#3b82f6',
                cancelButtonColor: '#6b7280',
            });
            
            if (result.isConfirmed) {
                console.log('[UpgradeModal] User confirmed, redirecting to checkout');
                // Close modal and trigger checkout
                close();
                emit('redirect-to-checkout', { tierId: props.newTierId, billingCycle: props.billingCycle });
            } else {
                console.log('[UpgradeModal] User canceled');
                close();
            }
        } else {
            state.error = error.message || 'Upgrade failed';
        }
    } finally {
        state.upgrading = false;
    }
}

function close() {
    emit('close');
    // Reset state after animation
    setTimeout(() => {
        state.loading = false;
        state.upgrading = false;
        state.error = null;
        state.preview = null;
    }, 300);
}

function formatTierName(tier: string): string {
    return tier.replace(/_/g, ' ').toUpperCase();
}

function formatCurrency(amount: string | null, currency: string): string {
    if (!amount || amount === '0') return '$0.00';
    const numAmount = parseFloat(amount) / 100; // Paddle returns cents
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency || 'USD'
    }).format(numAmount);
}

function formatDate(date: string): string {
    if (!date || date === '') {
        return 'Not available';
    }
    try {
        const parsedDate = new Date(date);
        if (isNaN(parsedDate.getTime())) {
            return 'Not available';
        }
        return parsedDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } catch (error) {
        return 'Not available';
    }
}
</script>
