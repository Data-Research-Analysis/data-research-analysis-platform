<script setup lang="ts">
definePageMeta({ layout: 'admin' });

interface MigrationCandidate {
    id: number;
    name: string;
    project_id: number;
    project_name: string;
    created_at: string;
    row_count: number | null;
    health_status: string;
    suggested_layer: string;
    reasoning: string;
}

interface LayerStats {
    total: number;
    raw_data: { count: number; percentage: number };
    clean_data: { count: number; percentage: number };
    business_ready: { count: number; percentage: number };
    unclassified: { count: number; percentage: number };
}

const state = reactive({
    loading: true,
    candidates: [] as MigrationCandidate[],
    selectedIds: [] as number[],
    stats: null as LayerStats | null,
    error: null as string | null,
    success: null as string | null,
    showConfirmDialog: false,
    bulkAction: null as 'smart' | 'raw' | 'manual' | null,
    manualLayer: 'raw_data' as 'raw_data' | 'clean_data' | 'business_ready',
    processing: false,
});

const allSelected = computed(() => {
    return state.candidates.length > 0 && state.selectedIds.length === state.candidates.length;
});

const someSelected = computed(() => {
    return state.selectedIds.length > 0 && state.selectedIds.length < state.candidates.length;
});

function toggleAll() {
    if (allSelected.value) {
        state.selectedIds = [];
    } else {
        state.selectedIds = state.candidates.map(c => c.id);
    }
}

function toggleSelection(id: number) {
    const index = state.selectedIds.indexOf(id);
    if (index >= 0) {
        state.selectedIds.splice(index, 1);
    } else {
        state.selectedIds.push(id);
    }
}

async function loadData() {
    state.loading = true;
    state.error = null;
    
    try {
        const token = getAuthToken();
        const config = useRuntimeConfig();
        
        const [candidatesResponse, statsResponse] = await Promise.all([
            $fetch<{ success: boolean; candidates: MigrationCandidate[]; total: number }>(
                `${config.public.apiBase}/admin/medallion-migration/candidates`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Authorization-Type': 'auth'
                    }
                }
            ),
            $fetch<{ success: boolean; stats: LayerStats }>(
                `${config.public.apiBase}/admin/medallion-migration/stats`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Authorization-Type': 'auth'
                    }
                }
            )
        ]);
        
        if (candidatesResponse.success) {
            state.candidates = candidatesResponse.candidates;
        }
        
        if (statsResponse.success) {
            state.stats = statsResponse.stats;
        }
    } catch (error: any) {
        state.error = error.data?.message || 'Failed to load migration data';
        console.error('[MedallionMigration] Load error:', error);
    } finally {
        state.loading = false;
    }
}

function initiateSmartClassification() {
    state.bulkAction = 'smart';
    state.showConfirmDialog = true;
}

function initiateSetAllRaw() {
    state.bulkAction = 'raw';
    state.showConfirmDialog = true;
}

function initiateManualClassification() {
    state.bulkAction = 'manual';
    state.showConfirmDialog = true;
}

function cancelAction() {
    state.showConfirmDialog = false;
    state.bulkAction = null;
}

async function executeAction() {
    if (!state.bulkAction) return;
    
    state.processing = true;
    state.error = null;
    state.success = null;
    
    try {
        const token = getAuthToken();
        const config = useRuntimeConfig();
        
        if (state.bulkAction === 'raw') {
            // Set all unclassified to raw
            const response = await $fetch<{ success: boolean; message: string; count: number }>(
                `${config.public.apiBase}/admin/medallion-migration/set-all-raw`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Authorization-Type': 'auth'
                    }
                }
            );
            
            if (response.success) {
                state.success = response.message;
                await loadData();
                state.selectedIds = [];
            }
        } else {
            // Smart or manual classification
            if (state.selectedIds.length === 0) {
                state.error = 'No models selected';
                return;
            }
            
            const response = await $fetch<{ success: boolean; message: string; results: any }>(
                `${config.public.apiBase}/admin/medallion-migration/bulk-classify`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Authorization-Type': 'auth',
                        'Content-Type': 'application/json'
                    },
                    body: {
                        model_ids: state.selectedIds,
                        strategy: state.bulkAction === 'smart' ? 'smart' : 'manual',
                        manual_layer: state.bulkAction === 'manual' ? state.manualLayer : undefined
                    }
                }
            );
            
            if (response.success) {
                state.success = response.message;
                if (response.results.failedCount > 0) {
                    state.error = `${response.results.failedCount} models failed to classify`;
                }
                await loadData();
                state.selectedIds = [];
            }
        }
    } catch (error: any) {
        state.error = error.data?.message || 'Action failed';
        console.error('[MedallionMigration] Action error:', error);
    } finally {
        state.processing = false;
        state.showConfirmDialog = false;
        state.bulkAction = null;
    }
}

function getLayerBadgeClass(layer: string): string {
    const classes: Record<string, string> = {
        raw_data: 'bg-gray-100 text-gray-800',
        clean_data: 'bg-blue-100 text-blue-800',
        business_ready: 'bg-green-100 text-green-800'
    };
    return classes[layer] || 'bg-gray-100 text-gray-800';
}

function getLayerLabel(layer: string): string {
    const labels: Record<string, string> = {
        raw_data: 'Raw Data',
        clean_data: 'Clean Data',
        business_ready: 'Business Ready'
    };
    return labels[layer] || layer;
}

function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString();
}

onMounted(() => {
    loadData();
});
</script>

<template>
    <div class="min-h-screen bg-gray-50 py-8">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <!-- Header -->
            <div class="mb-8">
                <h1 class="text-3xl font-bold text-gray-900">Medallion Architecture Migration</h1>
                <p class="mt-2 text-sm text-gray-600">
                    Bulk classify data models into Bronze/Silver/Gold layers across all organizations
                </p>
            </div>

            <!-- Error Message -->
            <div v-if="state.error" class="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                <div class="flex">
                    <font-awesome-icon :icon="['fas', 'circle-exclamation']" class="text-red-400 mt-0.5 mr-3" />
                    <div class="flex-1">
                        <h3 class="text-sm font-medium text-red-800">Error</h3>
                        <p class="mt-1 text-sm text-red-700">{{ state.error }}</p>
                    </div>
                </div>
            </div>

            <!-- Success Message -->
            <div v-if="state.success" class="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
                <div class="flex">
                    <font-awesome-icon :icon="['fas', 'circle-check']" class="text-green-400 mt-0.5 mr-3" />
                    <div class="flex-1">
                        <h3 class="text-sm font-medium text-green-800">Success</h3>
                        <p class="mt-1 text-sm text-green-700">{{ state.success }}</p>
                    </div>
                </div>
            </div>

            <!-- Stats Cards -->
            <div v-if="state.stats" class="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="text-sm font-medium text-gray-500 mb-1">Total Models</div>
                    <div class="text-2xl font-bold text-gray-900">{{ state.stats.total }}</div>
                </div>
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="text-sm font-medium text-gray-500 mb-1">Raw Data</div>
                    <div class="text-2xl font-bold text-gray-700">{{ state.stats.raw_data.count }}</div>
                    <div class="text-xs text-gray-500">{{ state.stats.raw_data.percentage }}%</div>
                </div>
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="text-sm font-medium text-blue-500 mb-1">Clean Data</div>
                    <div class="text-2xl font-bold text-blue-700">{{ state.stats.clean_data.count }}</div>
                    <div class="text-xs text-blue-500">{{ state.stats.clean_data.percentage }}%</div>
                </div>
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="text-sm font-medium text-green-500 mb-1">Business Ready</div>
                    <div class="text-2xl font-bold text-green-700">{{ state.stats.business_ready.count }}</div>
                    <div class="text-xs text-green-500">{{ state.stats.business_ready.percentage }}%</div>
                </div>
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="text-sm font-medium text-red-500 mb-1">Unclassified</div>
                    <div class="text-2xl font-bold text-red-700">{{ state.stats.unclassified.count }}</div>
                    <div class="text-xs text-red-500">{{ state.stats.unclassified.percentage }}%</div>
                </div>
            </div>

            <!-- Loading State -->
            <div v-if="state.loading" class="bg-white rounded-lg shadow p-12 text-center">
                <font-awesome-icon :icon="['fas', 'spinner']" class="text-4xl text-blue-500 animate-spin mb-4" />
                <p class="text-gray-600">Loading migration data...</p>
            </div>

            <!-- Empty State -->
            <div v-else-if="state.candidates.length === 0" class="bg-white rounded-lg shadow p-12 text-center">
                <font-awesome-icon :icon="['fas', 'check-circle']" class="text-5xl text-green-500 mb-4" />
                <h3 class="text-lg font-semibold text-gray-900 mb-2">All models are classified!</h3>
                <p class="text-sm text-gray-600">All data models have been assigned a data layer.</p>
            </div>

            <!-- Migration Table -->
            <div v-else class="bg-white rounded-lg shadow overflow-hidden">
                <!-- Bulk Actions Bar -->
                <div class="bg-gray-50 px-6 py-4 border-b border-gray-200">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-4">
                            <span class="text-sm text-gray-700">
                                {{ state.selectedIds.length }} of {{ state.candidates.length }} selected
                            </span>
                            <button
                                v-if="state.selectedIds.length > 0"
                                @click="state.selectedIds = []"
                                class="text-sm text-blue-600 hover:text-blue-700"
                            >
                                Clear selection
                            </button>
                        </div>
                        <div class="flex items-center gap-2">
                            <button
                                @click="initiateSmartClassification"
                                :disabled="state.selectedIds.length === 0 || state.processing"
                                class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                            >
                                <font-awesome-icon :icon="['fas', 'wand-magic-sparkles']" class="mr-2" />
                                Smart Classify Selected
                            </button>
                            <button
                                @click="initiateManualClassification"
                                :disabled="state.selectedIds.length === 0 || state.processing"
                                class="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                            >
                                <font-awesome-icon :icon="['fas', 'hand-pointer']" class="mr-2" />
                                Manual Classify
                            </button>
                            <button
                                @click="initiateSetAllRaw"
                                :disabled="state.processing"
                                class="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                            >
                                <font-awesome-icon :icon="['fas', 'database']" class="mr-2" />
                                Set All as Raw Data
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Table -->
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th scope="col" class="w-12 px-6 py-3 text-left">
                                    <input
                                        type="checkbox"
                                        :checked="allSelected"
                                        :indeterminate="someSelected"
                                        @change="toggleAll"
                                        class="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                    />
                                </th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Model Name
                                </th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Project
                                </th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Suggested Layer
                                </th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Reasoning
                                </th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Created
                                </th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            <tr
                                v-for="candidate in state.candidates"
                                :key="candidate.id"
                                class="hover:bg-gray-50 transition-colors"
                            >
                                <td class="px-6 py-4">
                                    <input
                                        type="checkbox"
                                        :checked="state.selectedIds.includes(candidate.id)"
                                        @change="toggleSelection(candidate.id)"
                                        class="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                    />
                                </td>
                                <td class="px-6 py-4">
                                    <div class="text-sm font-medium text-gray-900">{{ candidate.name }}</div>
                                    <div v-if="candidate.row_count" class="text-xs text-gray-500">
                                        {{ candidate.row_count.toLocaleString() }} rows
                                    </div>
                                </td>
                                <td class="px-6 py-4">
                                    <div class="text-sm text-gray-900">{{ candidate.project_name }}</div>
                                    <div class="text-xs text-gray-500">ID: {{ candidate.project_id }}</div>
                                </td>
                                <td class="px-6 py-4">
                                    <span
                                        :class="getLayerBadgeClass(candidate.suggested_layer)"
                                        class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                                    >
                                        {{ getLayerLabel(candidate.suggested_layer) }}
                                    </span>
                                </td>
                                <td class="px-6 py-4">
                                    <div class="text-sm text-gray-700">{{ candidate.reasoning }}</div>
                                </td>
                                <td class="px-6 py-4 text-sm text-gray-500">
                                    {{ formatDate(candidate.created_at) }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Confirmation Dialog -->
        <overlay-dialog v-if="state.showConfirmDialog" @close="cancelAction">
            <template #overlay>
                <div class="bg-white rounded-lg p-6 max-w-md">
                    <h3 class="text-lg font-semibold text-gray-900 mb-4">
                        Confirm {{ state.bulkAction === 'raw' ? 'Bulk Assignment' : 'Classification' }}
                    </h3>
                    
                    <div v-if="state.bulkAction === 'raw'" class="mb-6">
                        <p class="text-sm text-gray-700 mb-2">
                            This will set <strong>all {{ state.candidates.length }} unclassified models</strong> to Raw Data layer.
                        </p>
                        <p class="text-sm text-gray-600">
                            This action cannot be undone. You can reclassify models individually later if needed.
                        </p>
                    </div>
                    
                    <div v-else-if="state.bulkAction === 'smart'" class="mb-6">
                        <p class="text-sm text-gray-700 mb-2">
                            This will automatically classify <strong>{{ state.selectedIds.length }} selected models</strong> based on their query structure:
                        </p>
                        <ul class="text-sm text-gray-600 list-disc list-inside space-y-1">
                            <li>Models with aggregations → Business Ready</li>
                            <li>Models with transformations/filters → Clean Data</li>
                            <li>All others → Raw Data</li>
                        </ul>
                    </div>
                    
                    <div v-else-if="state.bulkAction === 'manual'" class="mb-6">
                        <p class="text-sm text-gray-700 mb-4">
                            Assign <strong>{{ state.selectedIds.length }} selected models</strong> to:
                        </p>
                        <select
                            v-model="state.manualLayer"
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="raw_data">Raw Data (Bronze)</option>
                            <option value="clean_data">Clean Data (Silver)</option>
                            <option value="business_ready">Business Ready (Gold)</option>
                        </select>
                    </div>
                    
                    <div class="flex justify-end gap-3">
                        <button
                            @click="cancelAction"
                            :disabled="state.processing"
                            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Cancel
                        </button>
                        <button
                            @click="executeAction"
                            :disabled="state.processing"
                            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            <font-awesome-icon v-if="state.processing" :icon="['fas', 'spinner']" class="animate-spin" />
                            {{ state.processing ? 'Processing...' : 'Confirm' }}
                        </button>
                    </div>
                </div>
            </template>
        </overlay-dialog>
    </div>
</template>
