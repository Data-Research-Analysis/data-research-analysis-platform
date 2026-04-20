<script setup lang="ts">
import { useSubscriptionTiersStore } from '@/stores/admin/subscription-tiers';
const { $swal } = useNuxtApp();
const config = useRuntimeConfig();
const tiersStore = useSubscriptionTiersStore();

interface State {
    showCreateModal: boolean;
    editingTier: any;
    showEditModal: boolean;
    syncLoading: boolean;
    syncResults: any;
    showSyncResults: boolean;
    subscriptionSyncLoading: boolean;
    subscriptionSyncResults: any;
    showSubscriptionSyncResults: boolean;
}
const state = reactive<State>({
    showCreateModal: false,
    editingTier: null,
    showEditModal: false,
    syncLoading: false,
    syncResults: null,
    showSyncResults: false,
    subscriptionSyncLoading: false,
    subscriptionSyncResults: null,
    showSubscriptionSyncResults: false,
});

async function handlePaddleSync() {
    const { value: confirmed } = await $swal.fire({
        title: 'Sync from Paddle?',
        html: '<p>This will pull all active products, prices, and discounts from your Paddle dashboard.</p><ul style="text-align:left;margin-top:8px;"><li>New products → new tiers (with unlimited defaults)</li><li>Changed prices → new tier created, old retired, orgs migrated</li><li>New/changed discounts → promo codes created/updated</li></ul>',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#3C8DBC',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Yes, sync now',
    });
    if (!confirmed) return;

    state.syncLoading = true;
    state.syncResults = null;
    state.showSyncResults = false;

    try {
        const token = getAuthToken();
        const response = await $fetch<any>(`${config.public.apiBase}/admin/paddle/sync`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Authorization-Type': 'auth',
                'Content-Type': 'application/json',
            },
        });
        state.syncResults = response.data;
        state.showSyncResults = true;
        // Refresh tier list so newly created tiers appear
        await tiersStore.fetchTiers(true);
    } catch (err: any) {
        await $swal.fire({
            title: 'Sync Failed',
            text: err?.data?.error || err?.message || 'An unexpected error occurred.',
            icon: 'error',
            confirmButtonColor: '#3C8DBC',
        });
    } finally {
        state.syncLoading = false;
    }
}

async function handleSubscriptionSync() {
    const { value: confirmed } = await $swal.fire({
        title: 'Sync Subscriptions with Paddle?',
        html: '<p>This will query Paddle API for the actual state of all subscriptions and update local database to match.</p><ul style="text-align:left;margin-top:8px;"><li>Corrects subscriptions marked as cancelled locally but active in Paddle</li><li>Fixes missed webhook events</li><li>Ensures Paddle is the source of truth</li></ul><p class="text-sm text-gray-600 mt-2">Safe to run multiple times (idempotent).</p>',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#3C8DBC',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Yes, sync now',
    });
    if (!confirmed) return;

    state.subscriptionSyncLoading = true;
    state.subscriptionSyncResults = null;
    state.showSubscriptionSyncResults = false;

    try {
        const token = getAuthToken();
        const response = await $fetch<any>(`${config.public.apiBase}/admin/paddle/sync-subscriptions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Authorization-Type': 'auth',
                'Content-Type': 'application/json',
            },
        });
        state.subscriptionSyncResults = response.data;
        state.showSubscriptionSyncResults = true;
        
        await $swal.fire({
            title: 'Sync Complete',
            html: `<p>Synced <strong>${response.data.synced}/${response.data.total}</strong> subscriptions.</p><p class="text-green-600 font-semibold mt-2">${response.data.corrected} subscription${response.data.corrected !== 1 ? 's' : ''} corrected</p>`,
            icon: 'success',
            confirmButtonColor: '#3C8DBC',
        });
    } catch (err: any) {
        await $swal.fire({
            title: 'Sync Failed',
            text: err?.data?.error || err?.message || 'An unexpected error occurred.',
            icon: 'error',
            confirmButtonColor: '#3C8DBC',
        });
    } finally {
        state.subscriptionSyncLoading = false;
    }
}

const tiers = computed(() => tiersStore.tiers);
const loading = computed(() => tiersStore.loading);

onMounted(async () => {
    await tiersStore.fetchTiers(true); // Include inactive tiers
});

async function handleCreateTier() {
    state.showCreateModal = true;
}

async function handleEditTier(tier: any) {
    state.editingTier = { ...tier };
    state.showEditModal = true;
}

async function handleDeleteTier(tier: any) {
    const { value: confirmDelete } = await $swal.fire({
        title: "Are you sure?",
        text: `Do you want to delete the ${tier.tier_name} tier? This will soft-delete it (set inactive).`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3C8DBC",
        cancelButtonColor: "#DD4B39",
        confirmButtonText: "Yes, delete it!",
    });
    
    if (!confirmDelete) {
        return;
    }

    try {
        await tiersStore.deleteTier(tier.id);
        $swal.fire({
            title: "Deleted!",
            text: `The ${tier.tier_name} tier has been deleted successfully.`,
            icon: "success",
            confirmButtonColor: "#3C8DBC",
        });
    } catch (error: any) {
        $swal.fire({
            title: "Error!",
            text: error.message || "There was an error deleting the tier.",
            icon: "error",
            confirmButtonColor: "#3C8DBC",
        });
    }
}

function formatNumber(value: number | string | null | undefined) {
    if (value === null || value === undefined) return 'N/A';
    const num = typeof value === 'string' ? parseInt(value, 10) : value;
    if (num === -1) return 'Unlimited';
    return num.toLocaleString();
}

function formatPrice(value: number | string) {
    if (value === null || value === undefined) return '$0.00';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return `$${num.toFixed(2)}`;
}

function formatDate(dateString: string) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
}
</script>

<template>
    <div class="flex flex-row">
        <sidebar-admin class="w-1/6" />
        <div class="w-5/6">
            <div class="min-h-100 flex flex-col ml-4 mr-4 mb-10 md:ml-10 md:mr-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md rounded-lg">
                <div class="flex flex-row justify-between items-center mb-5">
                    <div class="font-bold text-2xl">
                        Subscription Tiers
                    </div>
                    <div class="flex gap-3">
                        <button
                            @click="handleSubscriptionSync"
                            :disabled="state.subscriptionSyncLoading"
                            class="text-sm px-4 py-2 bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer font-bold shadow-md rounded-lg flex items-center gap-2"
                        >
                            <font-awesome-icon v-if="state.subscriptionSyncLoading" :icon="['fas', 'spinner']" class="animate-spin" />
                            <font-awesome-icon v-else :icon="['fas', 'sync']" />
                            {{ state.subscriptionSyncLoading ? 'Syncing...' : 'Sync Subscriptions' }}
                        </button>
                        <button
                            @click="handlePaddleSync"
                            :disabled="state.syncLoading"
                            class="text-sm px-4 py-2 bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer font-bold shadow-md rounded-lg flex items-center gap-2"
                        >
                            <font-awesome-icon v-if="state.syncLoading" :icon="['fas', 'spinner']" class="animate-spin" />
                            <font-awesome-icon v-else :icon="['fas', 'rotate']" />
                            {{ state.syncLoading ? 'Syncing...' : 'Sync Products/Prices' }}
                        </button>
                        <button
                            @click="handleCreateTier"
                            class="text-sm px-4 py-2 bg-primary-blue-100 text-white hover:bg-primary-blue-300 cursor-pointer font-bold shadow-md rounded-lg"
                        >
                            Create New Tier
                        </button>
                    </div>
                </div>

                <!-- Subscription Sync Results -->
                <div v-if="state.showSubscriptionSyncResults && state.subscriptionSyncResults" class="mb-6 border border-purple-200 rounded-lg bg-purple-50 p-5">
                    <div class="flex justify-between items-center mb-3">
                        <h3 class="font-bold text-purple-800 text-lg flex items-center gap-2">
                            <font-awesome-icon :icon="['fas', 'check-circle']" />
                            Subscription Sync Complete
                        </h3>
                        <button @click="state.showSubscriptionSyncResults = false" class="text-gray-400 hover:text-gray-600 cursor-pointer">
                            <font-awesome-icon :icon="['fas', 'xmark']" />
                        </button>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div class="bg-white rounded-lg p-4 border border-purple-100">
                            <div class="text-2xl font-bold text-purple-700">{{ state.subscriptionSyncResults.total }}</div>
                            <div class="text-sm text-gray-600">Total Subscriptions</div>
                        </div>
                        <div class="bg-white rounded-lg p-4 border border-purple-100">
                            <div class="text-2xl font-bold text-green-600">{{ state.subscriptionSyncResults.synced }}</div>
                            <div class="text-sm text-gray-600">Successfully Synced</div>
                        </div>
                        <div class="bg-white rounded-lg p-4 border border-purple-100">
                            <div class="text-2xl font-bold text-blue-600">{{ state.subscriptionSyncResults.corrected }}</div>
                            <div class="text-sm text-gray-600">Corrected</div>
                        </div>
                    </div>

                    <!-- Errors -->
                    <div v-if="state.subscriptionSyncResults.errors && state.subscriptionSyncResults.errors.length > 0" class="bg-red-50 border border-red-200 rounded-lg p-3">
                        <h4 class="font-semibold text-red-700 mb-2">Errors ({{ state.subscriptionSyncResults.errors.length }})</h4>
                        <ul class="space-y-1">
                            <li v-for="(err, i) in state.subscriptionSyncResults.errors" :key="i" class="text-sm text-red-600">
                                Subscription {{ err.subscriptionId }}: {{ err.error }}
                            </li>
                        </ul>
                    </div>
                </div>

                <!-- Paddle Sync Results -->
                <div v-if="state.showSyncResults && state.syncResults" class="mb-6 border border-green-200 rounded-lg bg-green-50 p-5">
                    <div class="flex justify-between items-center mb-3">
                        <h3 class="font-bold text-green-800 text-lg flex items-center gap-2">
                            <font-awesome-icon :icon="['fas', 'check-circle']" />
                            Paddle Sync Complete
                        </h3>
                        <button @click="state.showSyncResults = false" class="text-gray-400 hover:text-gray-600 cursor-pointer">
                            <font-awesome-icon :icon="['fas', 'xmark']" />
                        </button>
                    </div>
                    <p class="text-xs text-gray-500 mb-4">Synced at {{ new Date(state.syncResults.synced_at).toLocaleString() }}</p>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <!-- Tiers -->
                        <div class="bg-white rounded-lg p-4 border border-green-100">
                            <h4 class="font-semibold text-gray-700 mb-2">Tiers ({{ state.syncResults.tiers.length }})</h4>
                            <div v-if="state.syncResults.tiers.length === 0" class="text-sm text-gray-500">No tiers synced.</div>
                            <ul v-else class="space-y-1">
                                <li v-for="t in state.syncResults.tiers" :key="t.paddle_product_id" class="text-sm flex items-start gap-2">
                                    <span
                                        :class="{
                                            'bg-blue-100 text-blue-700': t.action === 'created',
                                            'bg-yellow-100 text-yellow-700': t.action === 'updated',
                                            'bg-gray-100 text-gray-600': t.action === 'unchanged',
                                        }"
                                        class="px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap uppercase"
                                    >{{ t.action }}</span>
                                    <span class="text-gray-800">{{ t.tier_name }}
                                        <span v-if="t.action === 'updated'" class="text-gray-500 ml-1">({{ t.orgs_migrated }} org{{ t.orgs_migrated !== 1 ? 's' : '' }} migrated)</span>
                                    </span>
                                </li>
                            </ul>
                        </div>

                        <!-- Discounts -->
                        <div class="bg-white rounded-lg p-4 border border-green-100">
                            <h4 class="font-semibold text-gray-700 mb-2">Promo Codes ({{ state.syncResults.discounts.length }})</h4>
                            <div v-if="state.syncResults.discounts.length === 0" class="text-sm text-gray-500">No discounts synced.</div>
                            <ul v-else class="space-y-1">
                                <li v-for="d in state.syncResults.discounts" :key="d.paddle_discount_id" class="text-sm flex items-start gap-2">
                                    <span
                                        :class="{
                                            'bg-blue-100 text-blue-700': d.action === 'created',
                                            'bg-yellow-100 text-yellow-700': d.action === 'updated',
                                            'bg-gray-100 text-gray-600': d.action === 'unchanged',
                                            'bg-red-100 text-red-600': d.action === 'skipped',
                                        }"
                                        class="px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap uppercase"
                                    >{{ d.action }}</span>
                                    <span class="text-gray-800">{{ d.code }}
                                        <span v-if="d.reason" class="text-red-500 text-xs ml-1">— {{ d.reason }}</span>
                                    </span>
                                </li>
                            </ul>
                        </div>
                    </div>

                    <!-- Errors -->
                    <div v-if="state.syncResults.errors.length > 0" class="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
                        <h4 class="font-semibold text-red-700 mb-1">Errors</h4>
                        <ul class="space-y-1">
                            <li v-for="(err, i) in state.syncResults.errors" :key="i" class="text-sm text-red-600">{{ err }}</li>
                        </ul>
                    </div>
                </div>

                <div v-if="loading" class="text-center py-10">
                    <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-blue-100"></div>
                    <p class="mt-2 text-gray-600">Loading subscription tiers...</p>
                </div>

                <div v-else-if="!tiers || tiers.length === 0" class="text-center py-10">
                    <p class="text-gray-600">No subscription tiers found.</p>
                </div>

                <div v-else class="bg-white shadow-md overflow-hidden rounded-lg ring-1 ring-gray-200 ring-inset">
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tier Name</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Max Rows</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Max Projects</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Max Data Sources</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Max Data Models</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Max Dashboards</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">AI Generations</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price/Month</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price/Year</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                                <tr v-for="tier in tiers" :key="tier.id" class="hover:bg-gray-50">
                                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {{ tier.tier_name }}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {{ formatNumber(tier.max_rows_per_data_model) }}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {{ formatNumber(tier.max_projects) }}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {{ formatNumber(tier.max_data_sources_per_project) }}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {{ formatNumber(tier.max_data_models_per_data_source) }}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {{ formatNumber(tier.max_dashboards) }}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {{ formatNumber(tier.ai_generations_per_month) }}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {{ formatPrice(tier.price_per_month_usd) }}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {{ tier.price_per_year_usd !== null && tier.price_per_year_usd !== undefined ? formatPrice(tier.price_per_year_usd) : '—' }}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                                        <span 
                                            :class="{
                                                'bg-green-100 text-green-800': tier.is_active,
                                                'bg-red-100 text-red-800': !tier.is_active
                                            }"
                                            class="px-2 py-1 rounded-lg text-xs font-medium"
                                        >
                                            {{ tier.is_active ? 'ACTIVE' : 'INACTIVE' }}
                                        </span>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div class="flex justify-end gap-2">
                                            <button
                                                @click="handleEditTier(tier)"
                                                class="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-blue-100 hover:bg-blue-200 text-blue-700 hover:text-blue-900 cursor-pointer"
                                            >
                                                <font-awesome icon="fas fa-edit" class="text-base" />
                                                <span>Edit</span>
                                            </button>
                                            <button
                                                @click="handleDeleteTier(tier)"
                                                class="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-red-100 hover:bg-red-200 text-red-700 hover:text-red-900 cursor-pointer"
                                            >
                                                <font-awesome icon="fas fa-trash" class="text-base" />
                                                <span>Delete</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <!-- Create Modal -->
        <AdminEditSubscriptionTierModal
            v-if="state.showCreateModal"
            :tier="null"
            :show="state.showCreateModal"
            @close="state.showCreateModal = false"
            @success="state.showCreateModal = false"
        />

        <!-- Edit Modal -->
        <AdminEditSubscriptionTierModal
            v-if="state.showEditModal && state.editingTier"
            :tier="state.editingTier"
            :show="state.showEditModal"
            @close="state.showEditModal = false"
            @success="state.showEditModal = false"
        />
    </div>
</template>
