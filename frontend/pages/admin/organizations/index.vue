<script setup lang="ts">
import { NuxtLink } from '#components';
const { $swal } = useNuxtApp();
const config = useRuntimeConfig();

interface IAdminOrganization {
    id: number;
    name: string;
    domain: string | null;
    logoUrl: string | null;
    createdAt: string;
    memberCount: number;
    workspaceCount: number;
    members: Array<{
        user: {
            id: number;
            first_name: string;
            last_name: string;
            email: string;
        };
        role: string;
    }>;
    subscription: {
        id: number;
        tier: string;
        maxMembers: number | null;
        maxProjects: number | null;
        maxDataSourcesPerProject: number | null;
        maxDashboards: number | null;
    } | null;
    settings: Record<string, any> | null;
}

const state = reactive({
    organizations: [] as IAdminOrganization[],
    loading: true,
    error: null as string | null,
});

onMounted(async () => {
    await loadOrganizations();
});

async function loadOrganizations() {
    state.loading = true;
    state.error = null;
    
    try {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Authentication required');
        }

        const response = await $fetch<{ success: boolean; data: IAdminOrganization[] }>(
            `${config.public.apiBase}/admin/organizations`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                    'Content-Type': 'application/json',
                },
            }
        );

        if (response.success) {
            state.organizations = response.data;
        } else {
            throw new Error('Failed to load organizations');
        }
    } catch (error: any) {
        console.error('[Admin Organizations] Load error:', error);
        state.error = error.message || 'Failed to load organizations';
        $swal.fire({
            title: 'Error',
            text: state.error,
            icon: 'error',
            confirmButtonColor: '#3C8DBC',
        });
    } finally {
        state.loading = false;
    }
}

function formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function getOwnerName(org: IAdminOrganization): string {
    const owner = org.members?.find(m => m.role === 'owner');
    if (owner?.user) {
        return `${owner.user.first_name} ${owner.user.last_name}`;
    }
    return 'N/A';
}

function getOwnerEmail(org: IAdminOrganization): string {
    const owner = org.members?.find(m => m.role === 'owner');
    return owner?.user?.email || 'N/A';
}

function getTierBadgeColor(tier: string): string {
    const colors: Record<string, string> = {
        'free': 'bg-gray-200 text-gray-800',
        'starter': 'bg-blue-100 text-blue-800',
        'professional': 'bg-purple-100 text-purple-800',
        'professional_plus': 'bg-indigo-100 text-indigo-800',
        'enterprise': 'bg-yellow-100 text-yellow-800',
    };
    return colors[tier?.toLowerCase()] || 'bg-gray-200 text-gray-800';
}

function formatTierName(tier: string): string {
    if (!tier) return 'FREE';
    return tier.toUpperCase().replace('_', ' ');
}
</script>

<template>
    <div class="flex flex-row">
        <sidebar-admin class="w-1/6" />
        <div class="w-5/6">
            <!-- Loading State -->
            <div v-if="state.loading" class="min-h-100 flex flex-col ml-4 mr-4 mb-10 md:ml-10 md:mr-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md rounded-lg">
                <div class="flex items-center justify-center py-20">
                    <div class="text-center">
                        <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-blue-500 mb-4"></div>
                        <p class="text-gray-600">Loading organizations...</p>
                    </div>
                </div>
            </div>

            <!-- Error State -->
            <div v-else-if="state.error" class="min-h-100 flex flex-col ml-4 mr-4 mb-10 md:ml-10 md:mr-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md rounded-lg">
                <div class="flex items-center justify-center py-20">
                    <div class="text-center text-red-600">
                        {{ state.error }}
                    </div>
                </div>
            </div>

            <!-- Content -->
            <div v-else class="min-h-100 flex flex-col ml-4 mr-4 mb-10 md:ml-10 md:mr-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md rounded-lg">
                <div class="flex flex-row justify-between items-center mb-5">
                    <div class="font-bold text-2xl">
                        Organization Management
                    </div>
                    <div class="text-sm text-gray-600">
                        Total: {{ state.organizations.length }} organizations
                    </div>
                </div>

                <div v-if="state.organizations.length === 0" class="flex justify-center items-center py-20">
                    <div class="text-gray-500">
                        No organizations found
                    </div>
                </div>

                <div v-else class="bg-white shadow-md overflow-hidden rounded-lg ring-1 ring-gray-200 ring-inset">
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        ID
                                    </th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Organization
                                    </th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Owner
                                    </th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Subscription
                                    </th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Members
                                    </th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Workspaces
                                    </th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Created
                                    </th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                                <tr v-for="org in state.organizations" :key="org.id" class="hover:bg-gray-50">
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {{ org.id }}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap">
                                        <div class="flex flex-col">
                                            <div class="text-sm font-medium text-gray-900">
                                                {{ org.name }}
                                            </div>
                                            <div v-if="org.domain" class="text-xs text-gray-400">
                                                {{ org.domain }}
                                            </div>
                                        </div>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap">
                                        <div class="flex flex-col">
                                            <div class="text-sm text-gray-900">
                                                {{ getOwnerName(org) }}
                                            </div>
                                            <div class="text-xs text-gray-500">
                                                {{ getOwnerEmail(org) }}
                                            </div>
                                        </div>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap">
                                        <div class="flex flex-col gap-1">
                                            <span 
                                                :class="getTierBadgeColor(org.subscription?.tier || 'free')"
                                                class="px-2 py-1 text-xs font-semibold rounded-full"
                                            >
                                                {{ formatTierName(org.subscription?.tier || 'free') }}
                                            </span>
                                            <div v-if="org.subscription" class="text-xs text-gray-500">
                                                <div v-if="org.subscription.maxMembers !== null">
                                                    Max Members: {{ org.subscription.maxMembers }}
                                                </div>
                                                <div v-else class="text-green-600 font-semibold">
                                                    Unlimited
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-center">
                                        <span class="px-2 py-1 text-sm font-semibold text-gray-700 bg-blue-50 rounded-full">
                                            {{ org.memberCount }}
                                        </span>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-center">
                                        <span class="px-2 py-1 text-sm font-semibold text-gray-700 bg-purple-50 rounded-full">
                                            {{ org.workspaceCount }}
                                        </span>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {{ formatDate(org.createdAt) }}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                                        <NuxtLink 
                                            :to="`/admin/organizations/${org.id}/settings`" 
                                            class="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-blue-100 hover:bg-blue-200 text-blue-700 hover:text-blue-900"
                                        >
                                            <font-awesome-icon :icon="['fas', 'eye']" class="text-base" />
                                            <span>View</span>
                                        </NuxtLink>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
