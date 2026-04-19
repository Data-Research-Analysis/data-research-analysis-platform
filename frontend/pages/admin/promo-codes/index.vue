<template>
    <div class="flex flex-row">
        <sidebar-admin />
        <div class="flex-1 p-8 bg-gray-50 min-h-screen">
            <div class="max-w-7xl mx-auto">
                <!-- Header -->
                <div class="mb-8 flex justify-between items-center">
                    <div>
                        <h1 class="text-3xl font-bold text-gray-900 mb-2">Promotional Codes</h1>
                        <p class="text-gray-600">Manage discount codes and campaigns</p>
                    </div>
                    <button
                        @click="openCreateModal"
                        class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer font-medium"
                    >
                        <font-awesome-icon :icon="['fas', 'plus']" class="mr-2" />
                        Create Promo Code
                    </button>
                </div>

                <!-- Stats Cards -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div class="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                        <div class="text-sm text-gray-600 mb-1">Total Codes</div>
                        <div class="text-3xl font-bold text-gray-900">{{ state.stats.total }}</div>
                    </div>
                    <div class="bg-white rounded-lg shadow-sm p-6 border border-green-200">
                        <div class="text-sm text-gray-600 mb-1">Active Codes</div>
                        <div class="text-3xl font-bold text-green-600">{{ state.stats.active }}</div>
                    </div>
                    <div class="bg-white rounded-lg shadow-sm p-6 border border-blue-200">
                        <div class="text-sm text-gray-600 mb-1">Total Uses</div>
                        <div class="text-3xl font-bold text-blue-600">{{ state.stats.totalUses }}</div>
                    </div>
                    <div class="bg-white rounded-lg shadow-sm p-6 border border-purple-200">
                        <div class="text-sm text-gray-600 mb-1">Active Campaigns</div>
                        <div class="text-3xl font-bold text-purple-600">{{ state.stats.activeCampaigns }}</div>
                    </div>
                </div>

                <!-- Filters -->
                <div class="bg-white rounded-lg shadow-sm p-6 mb-6 border border-gray-200">
                    <div class="flex items-center gap-4 flex-wrap">
                        <label class="text-sm font-medium text-gray-700">Filter by Status:</label>
                        <select
                            v-model="state.filter.isActive"
                            @change="loadPromoCodes"
                            class="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                        >
                            <option :value="null">All Codes</option>
                            <option :value="true">Active Only</option>
                            <option :value="false">Inactive Only</option>
                        </select>
                        
                        <label class="text-sm font-medium text-gray-700 ml-4">Campaign:</label>
                        <select
                            v-model="state.filter.campaign"
                            @change="loadPromoCodes"
                            class="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                        >
                            <option value="">All Campaigns</option>
                            <option v-for="campaign in state.campaigns" :key="campaign" :value="campaign">
                                {{ campaign }}
                            </option>
                        </select>

                        <button
                            @click="loadPromoCodes"
                            class="ml-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
                        >
                            <font-awesome-icon :icon="['fas', 'sync']" class="mr-2" />
                            Refresh
                        </button>
                    </div>
                </div>

                <!-- Promo Codes Table -->
                <div v-if="promoCodes.length > 0" class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div class="overflow-x-auto">
                        <table class="w-full">
                            <thead class="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Campaign</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discount</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usage</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valid Until</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                                <tr v-for="code in promoCodes" :key="code.id" class="hover:bg-gray-50">
                                    <td class="px-6 py-4 whitespace-nowrap">
                                        <div class="font-mono font-bold text-gray-900">{{ code.code }}</div>
                                        <div class="text-xs text-gray-500">{{ code.description }}</div>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        <span v-if="code.campaign_name" class="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded">
                                            {{ code.campaign_name }}
                                        </span>
                                        <span v-else class="text-gray-400">—</span>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                                        <div class="font-medium text-gray-900">
                                            {{ formatDiscount(code) }}
                                        </div>
                                        <div class="text-xs text-gray-500">{{ code.discount_type }}</div>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        <div class="flex items-center gap-1">
                                            <span class="font-medium">{{ code.current_uses }}</span>
                                            <span class="text-gray-400">/</span>
                                            <span>{{ code.max_uses || 'unlimited' }}</span>
                                        </div>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        <span v-if="code.valid_until">
                                            {{ formatDate(code.valid_until) }}
                                        </span>
                                        <span v-else class="text-gray-400">No expiry</span>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap">
                                        <span :class="code.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'" class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full">
                                            {{ code.is_active ? 'Active' : 'Inactive' }}
                                        </span>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                                        <button
                                            @click="viewAnalytics(code)"
                                            class="text-blue-600 hover:text-blue-800 cursor-pointer"
                                            title="View Analytics"
                                        >
                                            <font-awesome-icon :icon="['fas', 'chart-line']" />
                                        </button>
                                        <button
                                            @click="viewRedemptions(code)"
                                            class="text-purple-600 hover:text-purple-800 cursor-pointer"
                                            title="View Redemptions"
                                        >
                                            <font-awesome-icon :icon="['fas', 'list']" />
                                        </button>
                                        <button
                                            @click="openEditModal(code)"
                                            class="text-green-600 hover:text-green-800 cursor-pointer"
                                            title="Edit"
                                        >
                                            <font-awesome-icon :icon="['fas', 'edit']" />
                                        </button>
                                        <button
                                            @click="toggleActive(code)"
                                            :class="code.is_active ? 'text-orange-600 hover:text-orange-800' : 'text-green-600 hover:text-green-800'"
                                            class="cursor-pointer"
                                            :title="code.is_active ? 'Deactivate' : 'Activate'"
                                        >
                                            <font-awesome-icon :icon="code.is_active ? ['fas', 'pause'] : ['fas', 'play']" />
                                        </button>
                                        <button
                                            @click="deletePromoCode(code)"
                                            class="text-red-600 hover:text-red-800 cursor-pointer"
                                            title="Delete"
                                        >
                                            <font-awesome-icon :icon="['fas', 'trash']" />
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Empty State -->
                <div v-else-if="dataLoaded" class="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                    <font-awesome-icon :icon="['fas', 'ticket']" class="text-6xl text-gray-300 mb-4" />
                    <h3 class="text-xl font-medium text-gray-900 mb-2">No Promo Codes Found</h3>
                    <p class="text-gray-600 mb-6">
                        Create your first promotional code to start offering discounts.
                    </p>
                    <button
                        @click="openCreateModal"
                        class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer font-medium inline-flex items-center"
                    >
                        <font-awesome-icon :icon="['fas', 'plus']" class="mr-2" />
                        Create Promo Code
                    </button>
                </div>
            </div>
        </div>

        <!-- Create/Edit Modal -->
        <teleport to="body">
            <div v-if="state.showModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div class="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                    <div class="sticky top-0 bg-white border-b border-gray-200 p-6">
                        <h2 class="text-2xl font-bold text-gray-900">
                            {{ state.editingCode ? 'Edit Promo Code' : 'Create Promo Code' }}
                        </h2>
                    </div>
                    
                    <div class="p-6 space-y-4">
                        <!-- Code -->
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">
                                Promo Code <span class="text-red-500">*</span>
                            </label>
                            <input
                                v-model="state.form.code"
                                type="text"
                                placeholder="e.g., LAUNCH50, WELCOME2024"
                                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono uppercase"
                                :disabled="!!state.editingCode"
                            />
                            <p class="text-xs text-gray-500 mt-1">Uppercase letters, numbers, and hyphens only</p>
                        </div>

                        <!-- Description -->
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Description</label>
                            <input
                                v-model="state.form.description"
                                type="text"
                                placeholder="Brief description of this promo code"
                                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <!-- Discount Type and Value -->
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">
                                    Discount Type <span class="text-red-500">*</span>
                                </label>
                                <select
                                    v-model="state.form.discountType"
                                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                >
                                    <option value="percentage">Percentage Off</option>
                                    <option value="fixed_amount">Fixed Amount Off</option>
                                    <option value="free_trial">Free Trial</option>
                                    <option value="upgraded_tier">Upgraded Tier</option>
                                </select>
                            </div>
                            <div v-if="state.form.discountType !== 'upgraded_tier'">
                                <label class="block text-sm font-medium text-gray-700 mb-2">
                                    {{ state.form.discountType === 'percentage' ? 'Percentage' : state.form.discountType === 'fixed_amount' ? 'Amount ($)' : 'Duration (months)' }} 
                                    <span class="text-red-500">*</span>
                                </label>
                                <input
                                    v-model="state.form.discountValue"
                                    type="number"
                                    step="0.01"
                                    :min="0"
                                    :max="state.form.discountType === 'percentage' ? 100 : undefined"
                                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        <!-- Discount Duration (Paddle-synced types only) -->
                        <div v-if="state.form.discountType === 'percentage' || state.form.discountType === 'fixed_amount'">
                            <label class="block text-sm font-medium text-gray-700 mb-2">Discount Duration</label>
                            <select
                                v-model="state.form.discountDurationMode"
                                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                            >
                                <option value="once">1 Billing Period (applies once)</option>
                                <option value="forever">Forever (applies to all renewals)</option>
                                <option value="custom">Custom (specify months)</option>
                            </select>
                            <div v-if="state.form.discountDurationMode === 'custom'" class="mt-2">
                                <input
                                    v-model.number="state.form.discountDurationMonths"
                                    type="number"
                                    min="1"
                                    placeholder="Number of months"
                                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <p class="text-xs text-gray-500 mt-1">How long Paddle will apply this discount on recurring billing</p>
                        </div>

                        <!-- Campaign Name -->
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Campaign Name</label>
                            <input
                                v-model="state.form.campaignName"
                                type="text"
                                placeholder="e.g., Launch Week, Black Friday"
                                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <!-- Paddle Discount ID -->
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Paddle Discount ID <span class="text-gray-400 font-normal">(optional)</span></label>
                            <input
                                v-model="state.form.paddleDiscountId"
                                type="text"
                                placeholder="e.g., dsc_01abc123..."
                                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                            />
                            <p class="text-xs text-gray-500 mt-1">Create a matching discount in your Paddle dashboard and paste the ID here. When set, Paddle will apply the real discount at checkout — not just cosmetically.</p>
                        </div>

                        <!-- Validity Dates -->
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">Valid From</label>
                                <input
                                    v-model="state.form.validFrom"
                                    type="datetime-local"
                                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">Valid Until</label>
                                <input
                                    v-model="state.form.validUntil"
                                    type="datetime-local"
                                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        <!-- Usage Limits -->
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">Max Total Uses</label>
                                <input
                                    v-model.number="state.form.maxUses"
                                    type="number"
                                    min="0"
                                    placeholder="Leave empty for unlimited"
                                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">Max Uses Per User</label>
                                <input
                                    v-model.number="state.form.maxUsesPerUser"
                                    type="number"
                                    min="1"
                                    placeholder="Leave empty for unlimited"
                                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        <!-- Restrictions -->
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Email Domain Restriction</label>
                            <input
                                v-model="state.form.emailDomainRestriction"
                                type="text"
                                placeholder="e.g., company.com (optional)"
                                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <p class="text-xs text-gray-500 mt-1">Only users with this email domain can use this code</p>
                        </div>

                        <!-- New Users Only -->
                        <div class="flex items-center">
                            <input
                                v-model="state.form.newUsersOnly"
                                type="checkbox"
                                class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                            />
                            <label class="ml-2 text-sm text-gray-700 cursor-pointer">
                                New users only (first subscription)
                            </label>
                        </div>
                    </div>

                    <div class="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6 flex justify-end gap-3">
                        <button
                            @click="closeModal"
                            class="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            @click="savePromoCode"
                            :disabled="state.saving"
                            class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <font-awesome-icon v-if="state.saving" :icon="['fas', 'spinner']" class="mr-2 animate-spin" />
                            {{ state.saving ? 'Saving...' : (state.editingCode ? 'Update' : 'Create') }}
                        </button>
                    </div>
                </div>
            </div>
        </teleport>
    </div>
</template>

<script setup lang="ts">
import { getAuthToken } from '~/composables/AuthToken';
import { usePromoCodesStore } from '~/stores/promo_codes';
import type { IPromoCode } from '~/types/IPromoCode';

definePageMeta({
    layout: 'default'
});

const { $swal } = useNuxtApp() as any;
const config = useRuntimeConfig();
const promoCodesStore = usePromoCodesStore();

// Use PromoCode as alias for the type already defined in the store
type PromoCode = IPromoCode;

const { showLoader, hideLoader } = useGlobalLoader();

interface State {
    campaigns: any[];
    saving: boolean;
    showModal: boolean;
    editingCode: any;
    filter: any;
    stats: any;
    form: any;
}
const state = reactive<State>({
    campaigns: [] as string[],
    saving: false,
    showModal: false,
    editingCode: null as PromoCode | null,
    filter: {
        isActive: null as boolean | null,
        campaign: ''
    },
    stats: {
        total: 0,
        active: 0,
        totalUses: 0,
        activeCampaigns: 0
    },
    form: {
        code: '',
        description: '',
        discountType: 'percentage' as 'percentage' | 'fixed_amount' | 'free_trial' | 'upgraded_tier',
        discountValue: 10,
        campaignName: '',
        validFrom: '',
        validUntil: '',
        maxUses: null as number | null,
        maxUsesPerUser: null as number | null,
        emailDomainRestriction: '',
        newUsersOnly: false,
        paddleDiscountId: '',
        discountDurationMode: 'once' as 'once' | 'forever' | 'custom',
        discountDurationMonths: null as number | null
    }
});

// Reactive reference to store data
const promoCodes = computed(() => promoCodesStore.promoCodes);
const dataLoaded = ref(false);

function deriveStats(codes: PromoCode[]) {
    state.campaigns = [...new Set(codes.filter(c => c.campaign_name).map(c => c.campaign_name as string))];
    state.stats.total = codes.length;
    state.stats.active = codes.filter(c => c.is_active).length;
    state.stats.totalUses = codes.reduce((sum, c) => sum + c.current_uses, 0);
    state.stats.activeCampaigns = new Set(codes.filter(c => c.campaign_name).map(c => c.campaign_name)).size;
}

// If data is already in store (SPA navigation with cached data), show it immediately
if (promoCodes.value.length > 0) {
    deriveStats(promoCodes.value);
    dataLoaded.value = true;
}

// If no cached data, show the global dialog loader until middleware populates the store
const showingInitialLoader = ref(false);
if (!dataLoaded.value && import.meta.client) {
    showLoader('Loading promotional codes...');
    showingInitialLoader.value = true;
}

// Watch for middleware updates — fires only when the store actually changes (not immediately)
watch(promoCodes, (codes) => {
    deriveStats(codes);
    if (showingInitialLoader.value) {
        hideLoader();
        showingInitialLoader.value = false;
    }
    dataLoaded.value = true;
});

// Fallback: if middleware skipped fetch due to fresh cache but store is empty (hard reload),
// fetch directly on mount and close the loader ourselves.
onMounted(async () => {
    if (!dataLoaded.value) {
        try {
            await promoCodesStore.retrievePromoCodes();
        } catch (error: any) {
            console.error('Error loading promo codes:', error);
        } finally {
            if (showingInitialLoader.value) {
                hideLoader();
                showingInitialLoader.value = false;
            }
            dataLoaded.value = true;
        }
    }
});

// Re-fetch with filters (filter changes only - not initial load)
async function loadPromoCodes() {
    showLoader('Loading promotional codes...');
    try {
        await promoCodesStore.retrievePromoCodes({
            isActive: state.filter.isActive ?? undefined,
            campaignName: state.filter.campaign || undefined,
        });
    } catch (error: any) {
        console.error('Error loading promo codes:', error);
        $swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load promo codes' });
    } finally {
        hideLoader();
    }
}

function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function formatDiscount(code: PromoCode): string {
    switch (code.discount_type) {
        case 'percentage':
            return `${code.discount_value}% off`;
        case 'fixed_amount':
            return `$${code.discount_value} off`;
        case 'free_trial':
            return `${code.discount_duration_months || code.discount_value} months free`;
        case 'upgraded_tier':
            return 'Tier upgrade';
        default:
            return '';
    }
}

function openCreateModal() {
    state.editingCode = null;
    state.form = {
        code: '',
        description: '',
        discountType: 'percentage',
        discountValue: 10,
        campaignName: '',
        validFrom: '',
        validUntil: '',
        maxUses: null,
        maxUsesPerUser: null,
        emailDomainRestriction: '',
        newUsersOnly: false,
        paddleDiscountId: '',
        discountDurationMode: 'once',
        discountDurationMonths: null
    };
    state.showModal = true;
}

function openEditModal(code: PromoCode) {
    state.editingCode = code;
    state.form = {
        code: code.code,
        description: code.description || '',
        discountType: code.discount_type,
        discountValue: code.discount_value || 0,
        campaignName: code.campaign_name || '',
        validFrom: code.valid_from ? new Date(code.valid_from).toISOString().slice(0, 16) : '',
        validUntil: code.valid_until ? new Date(code.valid_until).toISOString().slice(0, 16) : '',
        maxUses: code.max_uses,
        maxUsesPerUser: code.max_uses_per_user,
        emailDomainRestriction: code.email_domain_restriction || '',
        newUsersOnly: code.new_users_only,
        paddleDiscountId: code.paddle_discount_id || '',
        discountDurationMode: code.discount_duration_months === null || code.discount_duration_months === undefined ? 'once' : code.discount_duration_months === -1 ? 'forever' : 'custom',
        discountDurationMonths: code.discount_duration_months !== null && code.discount_duration_months !== undefined && code.discount_duration_months !== -1 ? code.discount_duration_months : null
    };
    state.showModal = true;
}

function closeModal() {
    state.showModal = false;
    state.editingCode = null;
}

async function savePromoCode() {
    // Validation
    if (!state.form.code.trim()) {
        $swal.fire('Error', 'Promo code is required', 'error');
        return;
    }
    if (!state.form.discountType) {
        $swal.fire('Error', 'Discount type is required', 'error');
        return;
    }
    if (state.form.discountType !== 'upgraded_tier' && !state.form.discountValue) {
        $swal.fire('Error', 'Discount value is required', 'error');
        return;
    }
    if ((state.form.discountType === 'percentage' || state.form.discountType === 'fixed_amount') &&
        state.form.discountDurationMode === 'custom' &&
        (!state.form.discountDurationMonths || state.form.discountDurationMonths < 1)) {
        $swal.fire('Error', 'Please enter a valid number of months for the custom duration', 'error');
        return;
    }

    state.saving = true;
    try {
        const token = getAuthToken();
        const body: any = {
            code: state.form.code.toUpperCase(),
            description: state.form.description || null,
            discountType: state.form.discountType,
            discountValue: parseFloat(state.form.discountValue) || 0,
            campaignName: state.form.campaignName || null,
            validFrom: state.form.validFrom ? new Date(state.form.validFrom).toISOString() : null,
            validUntil: state.form.validUntil ? new Date(state.form.validUntil).toISOString() : null,
            maxUses: state.form.maxUses || null,
            maxUsesPerUser: state.form.maxUsesPerUser || null,
            emailDomainRestriction: state.form.emailDomainRestriction || null,
            newUsersOnly: state.form.newUsersOnly,
            paddleDiscountId: state.form.paddleDiscountId || null,
            discountDurationMonths: (state.form.discountType === 'percentage' || state.form.discountType === 'fixed_amount')
                ? (state.form.discountDurationMode === 'forever' ? -1 : state.form.discountDurationMode === 'custom' ? state.form.discountDurationMonths : null)
                : undefined
        };

        const url = state.editingCode
            ? `${config.public.apiBase}/admin/promo-codes/${state.editingCode.id}`
            : `${config.public.apiBase}/admin/promo-codes/create`;

        const response = await $fetch<{ success: boolean }>(url, {
            method: state.editingCode ? 'PATCH' : 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Authorization-Type': 'auth',
                'Content-Type': 'application/json',
            },
            body
        });

        if (response.success) {
            $swal.fire({
                icon: 'success',
                title: 'Success!',
                text: state.editingCode ? 'Promo code updated successfully' : 'Promo code created successfully',
                timer: 2000,
                showConfirmButton: false
            });
            closeModal();
            await promoCodesStore.retrievePromoCodes();
        }
    } catch (error: any) {
        console.error('Error saving promo code:', error);
        $swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.data?.error || 'Failed to save promo code',
        });
    } finally {
        state.saving = false;
    }
}

async function toggleActive(code: PromoCode) {
    try {
        const token = getAuthToken();
        const action = code.is_active ? 'deactivate' : 'activate';
        const response = await $fetch(`${config.public.apiBase}/admin/promo-codes/${code.id}/${action}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Authorization-Type': 'auth',
                'Content-Type': 'application/json',
            }
        });

        if (response.success) {
            $swal.fire({
                icon: 'success',
                title: 'Success!',
                text: `Promo code ${action}d successfully`,
                timer: 2000,
                showConfirmButton: false
            });
            await promoCodesStore.retrievePromoCodes();
        }
    } catch (error: any) {
        console.error('Error toggling promo code:', error);
        $swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Failed to update promo code status',
        });
    }
}

async function deletePromoCode(code: PromoCode) {
    const { isConfirmed } = await $swal.fire({
        title: 'Delete Promo Code?',
        html: `
            <p>Are you sure you want to delete the promo code <strong>${code.code}</strong>?</p>
            <p class="text-sm text-red-600 mt-2">This action cannot be undone.</p>
            ${code.current_uses > 0 ? `<p class="text-sm text-orange-600 mt-2">Warning: This code has ${code.current_uses} redemption(s).</p>` : ''}
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        confirmButtonText: 'Delete',
        cancelButtonText: 'Cancel'
    });

    if (isConfirmed) {
        try {
            const token = getAuthToken();
            const response = await $fetch(`${config.public.apiBase}/admin/promo-codes/${code.id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                    'Content-Type': 'application/json',
                }
            });

            if (response.success) {
                $swal.fire({
                    icon: 'success',
                    title: 'Deleted!',
                    text: 'Promo code deleted successfully',
                    timer: 2000,
                    showConfirmButton: false
                });
                await promoCodesStore.retrievePromoCodes();
            }
        } catch (error: any) {
            console.error('Error deleting promo code:', error);
            $swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.data?.error || 'Failed to delete promo code',
            });
        }
    }
}

async function viewAnalytics(code: PromoCode) {
    try {
        const token = getAuthToken();
        const response = await $fetch<{ 
            success: boolean; 
            analytics: {
                totalRedemptions: number;
                activeRedemptions: number;
                totalRevenue: number;
                totalDiscount: number;
                conversionRate: number;
            }
        }>(`${config.public.apiBase}/admin/promo-codes/${code.id}/analytics`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Authorization-Type': 'auth',
                'Content-Type': 'application/json',
            }
        });

        if (response.success) {
            const a = response.analytics;
            await $swal.fire({
                title: `Analytics: ${code.code}`,
                html: `
                    <div class="text-left space-y-3">
                        <div class="grid grid-cols-2 gap-4">
                            <div class="bg-blue-50 p-3 rounded">
                                <div class="text-xs text-gray-600">Total Redemptions</div>
                                <div class="text-2xl font-bold text-blue-600">${a.totalRedemptions}</div>
                            </div>
                            <div class="bg-green-50 p-3 rounded">
                                <div class="text-xs text-gray-600">Active</div>
                                <div class="text-2xl font-bold text-green-600">${a.activeRedemptions}</div>
                            </div>
                        </div>
                        <div class="bg-purple-50 p-3 rounded">
                            <div class="text-xs text-gray-600">Total Revenue Generated</div>
                            <div class="text-2xl font-bold text-purple-600">$${a.totalRevenue.toFixed(2)}</div>
                        </div>
                        <div class="bg-orange-50 p-3 rounded">
                            <div class="text-xs text-gray-600">Total Discount Given</div>
                            <div class="text-2xl font-bold text-orange-600">$${a.totalDiscount.toFixed(2)}</div>
                        </div>
                        <div class="bg-gray-50 p-3 rounded">
                            <div class="text-xs text-gray-600">Conversion Rate</div>
                            <div class="text-2xl font-bold text-gray-900">${a.conversionRate.toFixed(1)}%</div>
                        </div>
                    </div>
                `,
                width: '500px',
                confirmButtonText: 'Close',
                confirmButtonColor: '#3b82f6',
            });
        }
    } catch (error: any) {
        console.error('Error loading analytics:', error);
        $swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Failed to load analytics',
        });
    }
}

async function viewRedemptions(code: PromoCode) {
    try {
        const token = getAuthToken();
        const response = await $fetch<{ 
            success: boolean; 
            redemptions: Array<{
                id: number;
                user_email: string;
                organization_name: string | null;
                discount_applied: number;
                original_price: number;
                final_price: number;
                status: string;
                redeemed_at: string;
            }>
        }>(`${config.public.apiBase}/admin/promo-codes/${code.id}/redemptions`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Authorization-Type': 'auth',
                'Content-Type': 'application/json',
            }
        });

        if (response.success) {
            const redemptions = response.redemptions || [];
            const html = redemptions.length > 0 ? `
                <div class="max-h-96 overflow-y-auto text-left">
                    <table class="w-full text-sm">
                        <thead class="bg-gray-50 sticky top-0">
                            <tr>
                                <th class="px-3 py-2 text-left">User</th>
                                <th class="px-3 py-2 text-left">Discount</th>
                                <th class="px-3 py-2 text-left">Status</th>
                                <th class="px-3 py-2 text-left">Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${redemptions.map(r => `
                                <tr class="border-b">
                                    <td class="px-3 py-2">
                                        <div class="font-medium">${r.user_email}</div>
                                        ${r.organization_name ? `<div class="text-xs text-gray-500">${r.organization_name}</div>` : ''}
                                    </td>
                                    <td class="px-3 py-2">
                                        <div class="text-green-600 font-medium">-$${r.discount_applied}</div>
                                        <div class="text-xs text-gray-500">$${r.original_price} → $${r.final_price}</div>
                                    </td>
                                    <td class="px-3 py-2">
                                        <span class="px-2 py-1 text-xs rounded ${r.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
                                            ${r.status}
                                        </span>
                                    </td>
                                    <td class="px-3 py-2 text-xs text-gray-600">
                                        ${formatDate(r.redeemed_at)}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            ` : '<p class="text-gray-600 text-center py-8">No redemptions yet</p>';

            await $swal.fire({
                title: `Redemptions: ${code.code}`,
                html,
                width: '700px',
                confirmButtonText: 'Close',
                confirmButtonColor: '#3b82f6',
            });
        }
    } catch (error: any) {
        console.error('Error loading redemptions:', error);
        $swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Failed to load redemptions',
        });
    }
}
</script>
