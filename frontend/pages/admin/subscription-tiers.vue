<script setup>
import { useSubscriptionTiersStore } from '@/stores/admin/subscription-tiers';
const { $swal } = useNuxtApp();
const tiersStore = useSubscriptionTiersStore();

const state = reactive({
    showCreateModal: false,
    editingTier: null,
    showEditModal: false,
});

const tiers = computed(() => tiersStore.tiers);
const loading = computed(() => tiersStore.loading);

onMounted(async () => {
    await tiersStore.fetchTiers(true); // Include inactive tiers
});

async function handleCreateTier() {
    state.showCreateModal = true;
}

async function handleEditTier(tier) {
    state.editingTier = { ...tier };
    state.showEditModal = true;
}

async function handleDeleteTier(tier) {
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
    } catch (error) {
        $swal.fire({
            title: "Error!",
            text: error.message || "There was an error deleting the tier.",
            icon: "error",
            confirmButtonColor: "#3C8DBC",
        });
    }
}

function formatNumber(value) {
    if (value === null || value === undefined) return 'N/A';
    const num = typeof value === 'string' ? parseInt(value, 10) : value;
    if (num === -1) return 'Unlimited';
    return num.toLocaleString();
}

function formatPrice(value) {
    if (value === null || value === undefined) return '$0.00';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return `$${num.toFixed(2)}`;
}

function formatDate(dateString) {
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
                    <button
                        @click="handleCreateTier"
                        class="text-sm px-4 py-2 bg-primary-blue-100 text-white hover:bg-primary-blue-300 cursor-pointer font-bold shadow-md rounded-lg"
                    >
                        Create New Tier
                    </button>
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
        <EditSubscriptionTierModal
            v-if="state.showCreateModal"
            :tier="null"
            :show="state.showCreateModal"
            @close="state.showCreateModal = false"
            @success="state.showCreateModal = false"
        />

        <!-- Edit Modal -->
        <EditSubscriptionTierModal
            v-if="state.showEditModal && state.editingTier"
            :tier="state.editingTier"
            :show="state.showEditModal"
            @close="state.showEditModal = false"
            @success="state.showEditModal = false"
        />
    </div>
</template>
