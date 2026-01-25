<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';

interface Cancellation {
    id: number;
    userId: number;
    userEmail: string;
    status: string;
    requestedAt: string;
    effectiveAt: string;
    deletionScheduledAt: string;
    dataDeleted: boolean;
    dataDeletedAt: string | null;
    reasonCategory: string | null;
    reason: string | null;
}

interface Statistics {
    totalCancellations: number;
    pendingCancellations: number;
    activeCancellations: number;
    deletedAccounts: number;
    reactivatedAccounts: number;
    byReasonCategory: Record<string, number>;
    averageRetentionDays: number;
}

interface ApiResponse<T = any> {
    success: boolean;
    data: T;
    message?: string;
}

interface CancellationsResponse {
    cancellations: Cancellation[];
    pagination: {
        totalPages: number;
        total: number;
    };
}

interface DataEstimate {
    projectCount: number;
    dataSourceCount: number;
    dataModelCount: number;
    dashboardCount: number;
    notificationCount: number;
    uploadedFileCount: number;
    exportFileCount: number;
    estimatedSizeMB: number;
}

const cancellations = ref<Cancellation[]>([]);
const statistics = ref<Statistics | null>(null);
const loading = ref(true);
const loadingStats = ref(true);
const error = ref<string | null>(null);
const successMessage = ref<string | null>(null);

// Pagination
const currentPage = ref(1);
const itemsPerPage = ref(20);
const totalPages = ref(1);
const totalItems = ref(0);

// Filters
const statusFilter = ref<string>('all');
const searchQuery = ref('');

// Status badge colors
const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    active: 'bg-orange-100 text-orange-800 border-orange-300',
    data_deleted: 'bg-red-100 text-red-800 border-red-300',
    reactivated: 'bg-green-100 text-green-800 border-green-300'
};

const filteredCancellations = computed(() => {
    return cancellations.value.filter(c => {
        const matchesSearch = c.userEmail.toLowerCase().includes(searchQuery.value.toLowerCase());
        return matchesSearch;
    });
});

async function fetchStatistics() {
    loadingStats.value = true;
    try {
        const token = getAuthToken();
        const response = await $fetch<ApiResponse<Statistics>>(`${baseUrl()}/admin/account-cancellations/statistics`, {
            method: 'GET',
            headers: {
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
        });
        
        if (response.success) {
            statistics.value = response.data;
        }
    } catch (err: any) {
        console.error('Error fetching statistics:', err);
    } finally {
        loadingStats.value = false;
    }
}

async function fetchCancellations() {
    loading.value = true;
    error.value = null;
    
    try {
        const token = getAuthToken();
        const params = new URLSearchParams({
            page: currentPage.value.toString(),
            limit: itemsPerPage.value.toString()
        });
        
        if (statusFilter.value !== 'all') {
            params.append('status', statusFilter.value);
        }
        
        const response = await $fetch<ApiResponse<CancellationsResponse>>(`${baseUrl()}/admin/account-cancellations?${params.toString()}`, {
            method: 'GET',
            headers: {
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
        });
        
        if (response.success) {
            cancellations.value = response.data.cancellations;
            totalPages.value = response.data.pagination.totalPages;
            totalItems.value = response.data.pagination.total;
        }
    } catch (err: any) {
        error.value = err.data?.message || 'Failed to load cancellations';
        console.error('Error fetching cancellations:', err);
    } finally {
        loading.value = false;
    }
}

async function deleteAccountNow(cancellationId: number, userEmail: string) {
    if (!confirm(`Are you sure you want to immediately delete all data for ${userEmail}? This action cannot be undone.`)) {
        return;
    }
    
    try {
        const token = getAuthToken();
        const response = await $fetch<ApiResponse>(`${baseUrl()}/admin/account-cancellations/${cancellationId}/delete-now`, {
            method: 'POST',
            headers: {
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
        });
        
        if (response.success) {
            successMessage.value = `Account data for ${userEmail} has been deleted successfully`;
            await fetchCancellations();
            await fetchStatistics();
            
            setTimeout(() => {
                successMessage.value = null;
            }, 5000);
        }
    } catch (err: any) {
        error.value = err.data?.message || 'Failed to delete account';
        console.error('Error deleting account:', err);
    }
}

async function viewDataEstimate(cancellationId: number) {
    try {
        const token = getAuthToken();
        const response = await $fetch<ApiResponse<{ estimate: DataEstimate; userEmail: string }>>(`${baseUrl()}/admin/account-cancellations/${cancellationId}/estimate`, {
            method: 'GET',
            headers: {
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
        });
        
        if (response.success) {
            const estimate = response.data.estimate;
            alert(`Data Size Estimate for ${response.data.userEmail}:

Projects: ${estimate.projectCount}
Data Sources: ${estimate.dataSourceCount}
Data Models: ${estimate.dataModelCount}
Dashboards: ${estimate.dashboardCount}
Notifications: ${estimate.notificationCount}
Uploaded Files: ${estimate.uploadedFileCount}
Export Files: ${estimate.exportFileCount}
Estimated Size: ${estimate.estimatedSizeMB} MB`);
        }
    } catch (err: any) {
        error.value = err.data?.message || 'Failed to get data estimate';
        console.error('Error getting estimate:', err);
    }
}

function formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
}

function formatStatus(status: string): string {
    return status.replace('_', ' ').toUpperCase();
}

function getDaysUntilDeletion(deletionDate: string): number {
    const now = new Date();
    const deletion = new Date(deletionDate);
    const diffTime = deletion.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

function changePage(page: number) {
    currentPage.value = page;
    fetchCancellations();
}

onMounted(() => {
    fetchStatistics();
    fetchCancellations();
});
</script>

<template>
    <div class="flex flex-row w-full min-h-screen bg-gray-50">
        <sidebar-admin class="w-1/6" />
        
        <div class="flex flex-col w-5/6 p-8">
            <!-- Header -->
            <div class="mb-8">
                <h1 class="text-3xl font-bold text-gray-800 mb-2">Account Cancellations</h1>
                <p class="text-gray-600">Monitor and manage cancelled accounts</p>
            </div>

            <!-- Success Message -->
            <div v-if="successMessage" class="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg flex items-center">
                <font-awesome icon="fas fa-check-circle" class="mr-2" />
                {{ successMessage }}
            </div>

            <!-- Error Message -->
            <div v-if="error" class="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg flex items-center">
                <font-awesome icon="fas fa-exclamation-circle" class="mr-2" />
                {{ error }}
            </div>

            <!-- Statistics Cards -->
            <div v-if="!loadingStats && statistics" class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
                <div class="bg-white rounded-lg shadow p-4">
                    <div class="text-sm text-gray-600 mb-1">Total Cancellations</div>
                    <div class="text-2xl font-bold text-gray-800">{{ statistics.totalCancellations }}</div>
                </div>
                <div class="bg-white rounded-lg shadow p-4">
                    <div class="text-sm text-gray-600 mb-1">Pending</div>
                    <div class="text-2xl font-bold text-yellow-600">{{ statistics.pendingCancellations }}</div>
                </div>
                <div class="bg-white rounded-lg shadow p-4">
                    <div class="text-sm text-gray-600 mb-1">Active</div>
                    <div class="text-2xl font-bold text-orange-600">{{ statistics.activeCancellations }}</div>
                </div>
                <div class="bg-white rounded-lg shadow p-4">
                    <div class="text-sm text-gray-600 mb-1">Deleted</div>
                    <div class="text-2xl font-bold text-red-600">{{ statistics.deletedAccounts }}</div>
                </div>
                <div class="bg-white rounded-lg shadow p-4">
                    <div class="text-sm text-gray-600 mb-1">Reactivated</div>
                    <div class="text-2xl font-bold text-green-600">{{ statistics.reactivatedAccounts }}</div>
                </div>
            </div>

            <!-- Filters -->
            <div class="bg-white rounded-lg shadow p-4 mb-6">
                <div class="flex flex-wrap gap-4">
                    <div class="flex-1 min-w-[200px]">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Search by Email</label>
                        <input
                            v-model="searchQuery"
                            type="text"
                            placeholder="Search email..."
                            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div class="w-48">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Status Filter</label>
                        <select
                            v-model="statusFilter"
                            @change="fetchCancellations"
                            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="active">Active</option>
                            <option value="data_deleted">Deleted</option>
                            <option value="reactivated">Reactivated</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- Loading State -->
            <div v-if="loading" class="flex justify-center items-center py-20">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>

            <!-- Cancellations Table -->
            <div v-else class="bg-white rounded-lg shadow overflow-hidden">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User Email</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requested</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deletion Date</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days Left</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        <tr v-for="cancellation in filteredCancellations" :key="cancellation.id" class="hover:bg-gray-50">
                            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {{ cancellation.userEmail }}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <span :class="['px-2 py-1 text-xs font-semibold rounded border', statusColors[cancellation.status] || 'bg-gray-100 text-gray-800']">
                                    {{ formatStatus(cancellation.status) }}
                                </span>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {{ formatDate(cancellation.requestedAt) }}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {{ formatDate(cancellation.deletionScheduledAt) }}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm">
                                <span v-if="cancellation.status === 'active'" :class="[
                                    'font-semibold',
                                    getDaysUntilDeletion(cancellation.deletionScheduledAt) <= 1 ? 'text-red-600' :
                                    getDaysUntilDeletion(cancellation.deletionScheduledAt) <= 7 ? 'text-orange-600' :
                                    'text-gray-600'
                                ]">
                                    {{ getDaysUntilDeletion(cancellation.deletionScheduledAt) }} days
                                </span>
                                <span v-else class="text-gray-400">-</span>
                            </td>
                            <td class="px-6 py-4 text-sm text-gray-600 max-w-xs truncate" :title="cancellation.reason || ''">
                                {{ cancellation.reasonCategory || 'N/A' }}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm">
                                <button
                                    @click="viewDataEstimate(cancellation.id)"
                                    class="text-blue-600 hover:text-blue-800 mr-3"
                                    title="View data estimate"
                                >
                                    <font-awesome icon="fas fa-chart-bar" />
                                </button>
                                <button
                                    v-if="cancellation.status === 'active' && !cancellation.dataDeleted"
                                    @click="deleteAccountNow(cancellation.id, cancellation.userEmail)"
                                    class="text-red-600 hover:text-red-800"
                                    title="Delete now (admin)"
                                >
                                    <font-awesome icon="fas fa-trash" />
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>

                <!-- No Results -->
                <div v-if="filteredCancellations.length === 0" class="text-center py-12 text-gray-500">
                    No cancellations found
                </div>

                <!-- Pagination -->
                <div v-if="totalPages > 1" class="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                    <div class="text-sm text-gray-600">
                        Showing {{ ((currentPage - 1) * itemsPerPage) + 1 }} to {{ Math.min(currentPage * itemsPerPage, totalItems) }} of {{ totalItems }} results
                    </div>
                    <div class="flex space-x-2">
                        <button
                            @click="changePage(currentPage - 1)"
                            :disabled="currentPage === 1"
                            class="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                        >
                            Previous
                        </button>
                        <button
                            v-for="page in totalPages"
                            :key="page"
                            @click="changePage(page)"
                            :class="[
                                'px-3 py-1 border rounded-md',
                                page === currentPage
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'border-gray-300 hover:bg-gray-50'
                            ]"
                        >
                            {{ page }}
                        </button>
                        <button
                            @click="changePage(currentPage + 1)"
                            :disabled="currentPage === totalPages"
                            class="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* Additional custom styles if needed */
</style>
