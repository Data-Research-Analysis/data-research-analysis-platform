<template>
    <div class="flex flex-row">
        <sidebar-admin />
        <div class="flex-1 p-8 bg-gray-50 min-h-screen">
            <div class="max-w-7xl mx-auto">
                <!-- Header -->
                <div class="mb-8">
                    <h1 class="text-3xl font-bold text-gray-900 mb-2">Downgrade Requests</h1>
                    <p class="text-gray-600">View and manage customer plan downgrade requests</p>
                </div>

                <!-- Stats Cards -->
                <div class="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
                    <div class="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                        <div class="text-sm text-gray-600 mb-1">Total Requests</div>
                        <div class="text-3xl font-bold text-gray-900">{{ state.stats.total }}</div>
                    </div>
                    <div class="bg-white rounded-lg shadow-sm p-6 border border-yellow-200">
                        <div class="text-sm text-gray-600 mb-1">Pending</div>
                        <div class="text-3xl font-bold text-yellow-600">{{ state.stats.pending }}</div>
                    </div>
                    <div class="bg-white rounded-lg shadow-sm p-6 border border-blue-200">
                        <div class="text-sm text-gray-600 mb-1">Contacted</div>
                        <div class="text-3xl font-bold text-blue-600">{{ state.stats.contacted }}</div>
                    </div>
                    <div class="bg-white rounded-lg shadow-sm p-6 border border-green-200">
                        <div class="text-sm text-gray-600 mb-1">Completed</div>
                        <div class="text-3xl font-bold text-green-600">{{ state.stats.completed }}</div>
                    </div>
                    <div class="bg-white rounded-lg shadow-sm p-6 border border-red-200">
                        <div class="text-sm text-gray-600 mb-1">Declined</div>
                        <div class="text-3xl font-bold text-red-600">{{ state.stats.declined }}</div>
                    </div>
                </div>

                <!-- Filters -->
                <div class="bg-white rounded-lg shadow-sm p-6 mb-6 border border-gray-200">
                    <div class="flex items-center gap-4">
                        <label class="text-sm font-medium text-gray-700">Filter by Status:</label>
                        <select
                            v-model="state.filter.status"
                            @change="loadRequests"
                            class="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                        >
                            <option value="all">All Requests</option>
                            <option value="pending">Pending</option>
                            <option value="contacted">Contacted</option>
                            <option value="approved">Approved</option>
                            <option value="completed">Completed</option>
                            <option value="declined">Declined</option>
                        </select>
                        <button
                            @click="loadRequests"
                            class="ml-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
                        >
                            <font-awesome-icon :icon="['fas', 'sync']" class="mr-2" />
                            Refresh
                        </button>
                    </div>
                </div>

                <!-- Loading State -->
                <div v-if="state.loading" class="text-center py-12">
                    <font-awesome-icon :icon="['fas', 'spinner']" class="text-4xl text-blue-600 animate-spin" />
                    <p class="mt-4 text-gray-600">Loading requests...</p>
                </div>

                <!-- Requests Table -->
                <div v-else-if="state.requests.length > 0" class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div class="overflow-x-auto">
                        <table class="w-full">
                            <thead class="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current → Requested</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                                <tr v-for="request in state.requests" :key="request.id" class="hover:bg-gray-50">
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {{ formatDate(request.created_at) }}
                                    </td>
                                    <td class="px-6 py-4 text-sm text-gray-900">
                                        <div class="font-medium">{{ request.user?.first_name }} {{ request.user?.last_name }}</div>
                                        <div class="text-xs text-gray-500">{{ request.user?.email }}</div>
                                        <div v-if="request.organization" class="text-xs text-gray-500">Org: {{ request.organization.name }}</div>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                                        <div class="flex items-center gap-2">
                                            <span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded">
                                                {{ request.current_tier }}
                                            </span>
                                            <font-awesome-icon :icon="['fas', 'arrow-right']" class="text-gray-400" />
                                            <span class="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-semibold rounded">
                                                {{ request.requested_tier }}
                                            </span>
                                        </div>
                                    </td>
                                    <td class="px-6 py-4 text-sm text-gray-900">
                                        {{ request.reason }}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap">
                                        <span :class="getStatusBadgeClasses(request.status)">
                                            {{ request.status }}
                                        </span>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                                        <button
                                            @click="viewDetails(request)"
                                            class="text-blue-600 hover:text-blue-800 mr-3 cursor-pointer"
                                        >
                                            <font-awesome-icon :icon="['fas', 'eye']" />
                                        </button>
                                        <button
                                            @click="updateStatus(request)"
                                            class="text-green-600 hover:text-green-800 mr-3 cursor-pointer"
                                        >
                                            <font-awesome-icon :icon="['fas', 'edit']" />
                                        </button>
                                        <button
                                            @click="deleteRequest(request)"
                                            class="text-red-600 hover:text-red-800 cursor-pointer"
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
                <div v-else class="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                    <font-awesome-icon :icon="['fas', 'inbox']" class="text-6xl text-gray-300 mb-4" />
                    <h3 class="text-xl font-medium text-gray-900 mb-2">No Requests Found</h3>
                    <p class="text-gray-600">
                        {{ state.filter.status === 'all' ? 'No downgrade requests have been submitted yet.' : `No ${state.filter.status} requests found.` }}
                    </p>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { getAuthToken } from '~/composables/AuthToken';

definePageMeta({
    layout: 'default'
});

const { $swal } = useNuxtApp() as any;
const config = useRuntimeConfig();

interface DowngradeRequest {
    id: number;
    user_id: number;
    organization_id: number | null;
    current_tier: string;
    requested_tier: string;
    reason: string;
    message: string | null;
    status: string;
    created_at: string;
    contacted_at: string | null;
    completed_at: string | null;
    updated_at: string;
    user?: {
        id: number;
        email: string;
        first_name: string;
        last_name: string;
    };
    organization?: {
        id: number;
        name: string;
    };
}

const state = reactive({
    requests: [] as DowngradeRequest[],
    loading: false,
    filter: {
        status: 'all'
    },
    stats: {
        total: 0,
        pending: 0,
        contacted: 0,
        approved: 0,
        completed:0,
        declined: 0
    }
});

onMounted(() => {
    loadRequests();
});

async function loadRequests() {
    state.loading = true;
    try {
        const token = getAuthToken();
        const url = state.filter.status === 'all' 
            ? `${config.public.apiBase}/admin/downgrade-requests/list`
            : `${config.public.apiBase}/admin/downgrade-requests/list?status=${state.filter.status}`;
        
        const response = await $fetch<{ success: boolean; data: DowngradeRequest[] }>(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Authorization-Type': 'auth',
                'Content-Type': 'application/json',
            }
        });

        if (response.success) {
            state.requests = response.data;
            calculateStats();
        }
    } catch (error: any) {
        console.error('Error loading requests:', error);
        $swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Failed to load downgrade requests',
        });
    } finally {
        state.loading = false;
    }
}

function calculateStats() {
    state.stats.total = state.requests.length;
    state.stats.pending = state.requests.filter(r => r.status === 'pending').length;
    state.stats.contacted = state.requests.filter(r => r.status === 'contacted').length;
    state.stats.approved = state.requests.filter(r => r.status === 'approved').length;
    state.stats.completed = state.requests.filter(r => r.status === 'completed').length;
    state.stats.declined = state.requests.filter(r => r.status === 'declined').length;
}

function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getStatusBadgeClasses(status: string): string {
    const baseClasses = 'px-2 inline-flex text-xs leading-5 font-semibold rounded-full';
    const statusClasses = {
        pending: 'bg-yellow-100 text-yellow-800',
        contacted: 'bg-blue-100 text-blue-800',
        approved: 'bg-purple-100 text-purple-800',
        completed: 'bg-green-100 text-green-800',
        declined: 'bg-red-100 text-red-800'
    };
    return `${baseClasses} ${statusClasses[status as keyof typeof statusClasses] || 'bg-gray-100 text-gray-800'}`;
}

async function viewDetails(request: DowngradeRequest) {
    const contactedDate = request.contacted_at 
        ? new Date(request.contacted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'Not contacted yet';
    
    const completedDate = request.completed_at
        ? new Date(request.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'Not completed yet';

    await $swal.fire({
        title: 'Downgrade Request Details',
        html: `
            <div class="text-left space-y-3">
                <div>
                    <strong class="text-gray-700">User:</strong>
                    <p class="text-gray-900">${request.user?.first_name} ${request.user?.last_name}</p>
                    <p class="text-sm text-gray-600">${request.user?.email}</p>
                </div>
                ${request.organization ? `
                    <div>
                        <strong class="text-gray-700">Organization:</strong>
                        <p class="text-gray-900">${request.organization.name}</p>
                    </div>
                ` : ''}
                <div>
                    <strong class="text-gray-700">Current Tier:</strong>
                    <p class="text-gray-900">${request.current_tier}</p>
                </div>
                <div>
                    <strong class="text-gray-700">Requested Tier:</strong>
                    <p class="text-gray-900">${request.requested_tier}</p>
                </div>
                <div>
                    <strong class="text-gray-700">Reason:</strong>
                    <p class="text-gray-900">${request.reason}</p>
                </div>
                ${request.message ? `
                    <div>
                        <strong class="text-gray-700">Additional Details:</strong>
                        <p class="text-gray-900 whitespace-pre-wrap">${request.message}</p>
                    </div>
                ` : ''}
                <div>
                    <strong class="text-gray-700">Status:</strong>
                    <p class="text-gray-900 capitalize">${request.status}</p>
                </div>
                <div>
                    <strong class="text-gray-700">Submitted:</strong>
                    <p class="text-gray-900">${formatDate(request.created_at)}</p>
                </div>
                <div>
                    <strong class="text-gray-700">Contacted:</strong>
                    <p class="text-gray-900">${contactedDate}</p>
                </div>
                <div>
                    <strong class="text-gray-700">Completed:</strong>
                    <p class="text-gray-900">${completedDate}</p>
                </div>
            </div>
        `,
        width: '600px',
        confirmButtonText: 'Close',
        confirmButtonColor: '#3b82f6',
    });
}

async function updateStatus(request: DowngradeRequest) {
    const { value: newStatus } = await $swal.fire({
        title: 'Update Status',
        html: `
            <div class="text-left">
                <label class="block text-sm font-medium text-gray-700 mb-2">Select New Status:</label>
                <select id="status-select" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="pending" ${request.status === 'pending' ? 'selected' : ''}>Pending</option>
                    <option value="contacted" ${request.status === 'contacted' ? 'selected' : ''}>Contacted</option>
                    <option value="approved" ${request.status === 'approved' ? 'selected' : ''}>Approved</option>
                    <option value="completed" ${request.status === 'completed' ? 'selected' : ''}>Completed</option>
                    <option value="declined" ${request.status === 'declined' ? 'selected' : ''}>Declined</option>
                </select>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Update',
        confirmButtonColor: '#3b82f6',
        preConfirm: () => {
            return (document.getElementById('status-select') as HTMLSelectElement).value;
        }
    });

    if (newStatus && newStatus !== request.status) {
        try {
            const token = getAuthToken();
            const response = await $fetch(`${config.public.apiBase}/admin/downgrade-requests/${request.id}/status`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                    'Content-Type': 'application/json',
                },
                body: { status: newStatus }
            });

            if (response.success) {
                $swal.fire({
                    icon: 'success',
                    title: 'Updated!',
                    text: 'Status updated successfully',
                    timer: 2000,
                    showConfirmButton: false
                });
                await loadRequests();
            }
        } catch (error: any) {
            console.error('Error updating status:', error);
            $swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to update status',
            });
        }
    }
}

async function deleteRequest(request: DowngradeRequest) {
    const { isConfirmed } = await $swal.fire({
        title: 'Delete Request?',
        html: `
            <p>Are you sure you want to delete the downgrade request from <strong>${request.user?.first_name} ${request.user?.last_name}</strong>?</p>
            <p class="text-sm text-red-600 mt-2">This action cannot be undone.</p>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Yes, delete it',
        cancelButtonText: 'Cancel'
    });

    if (isConfirmed) {
        try {
            const token = getAuthToken();
            const response = await $fetch(`${config.public.apiBase}/admin/downgrade-requests/${request.id}`, {
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
                    text: 'Request has been deleted',
                    timer: 2000,
                    showConfirmButton: false
                });
                await loadRequests();
            }
        } catch (error: any) {
            console.error('Error deleting request:', error);
            $swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to delete request',
            });
        }
    }
}
</script>
