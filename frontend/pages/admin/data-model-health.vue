<script setup lang="ts">
useHead({
    title: 'Data Model Health | Admin | Data Research Analysis',
    meta: [{ name: 'robots', content: 'noindex, nofollow' }],
});

interface HealthSummary {
    healthy: number;
    warning: number;
    blocked: number;
    unknown: number;
}

interface ProblemModel {
    id: number;
    name: string;
    health_status: 'blocked' | 'warning';
    model_type: string | null;
    row_count: number | null;
    source_row_count: number | null;
    health_issues: { title: string; description: string; recommendation: string }[];
    created_at: string;
    project_id: number | null;
    project_name: string | null;
    owner_email: string | null;
}

const summary = ref<HealthSummary | null>(null);
const problemModels = ref<ProblemModel[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const statusFilter = ref<'all' | 'blocked' | 'warning'>('all');
const expandedModel = ref<number | null>(null);

const filteredModels = computed(() => {
    if (statusFilter.value === 'all') return problemModels.value;
    return problemModels.value.filter((m) => m.health_status === statusFilter.value);
});

const totalProblems = computed(() => (summary.value ? summary.value.blocked + summary.value.warning : 0));

async function fetchSummary() {
    loading.value = true;
    error.value = null;
    try {
        const token = getAuthToken();
        const response = await $fetch<{ success: boolean; summary: HealthSummary; problemModels: ProblemModel[] }>(
            `${baseUrl()}/admin/data-model-health/summary`,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                },
            }
        );
        if (response.success) {
            summary.value = response.summary;
            problemModels.value = response.problemModels;
        }
    } catch (err: any) {
        error.value = err.data?.message || 'Failed to load health data';
        console.error('[AdminDataModelHealth] fetch error:', err);
    } finally {
        loading.value = false;
    }
}

function formatNumber(n: number | null | undefined): string {
    if (n == null) return '—';
    return n.toLocaleString();
}

function formatDate(d: string): string {
    try {
        return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
        return d;
    }
}

function toggleExpand(id: number) {
    expandedModel.value = expandedModel.value === id ? null : id;
}

const reanalyzing = ref(false);
const reanalyzedMessage = ref<string | null>(null);

async function triggerReanalysis() {
    reanalyzing.value = true;
    reanalyzedMessage.value = null;
    try {
        const token = getAuthToken();
        await $fetch(`${baseUrl()}/admin/data-model-health/reanalyze`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Authorization-Type': 'auth',
            },
        });
        reanalyzedMessage.value = 'Re-analysis started in the background. Refresh in a few minutes to see updated results.';
    } catch (err: any) {
        reanalyzedMessage.value = err.data?.message || 'Failed to start re-analysis';
        console.error('[AdminDataModelHealth] reanalyze error:', err);
    } finally {
        reanalyzing.value = false;
    }
}

onMounted(() => {
    if (!import.meta.client) return;
    fetchSummary();
});
</script>

<template>
    <div class="min-h-screen bg-gray-50 p-6">
        <!-- Header -->
        <div class="mb-6 flex flex-row items-center justify-between gap-4 flex-wrap">
            <div>
                <h1 class="text-2xl font-bold text-gray-900">Data Model Health</h1>
                <p class="text-sm text-gray-500 mt-1">Platform-wide overview of data model health status</p>
            </div>
            <button
                class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
                :disabled="loading"
                @click="fetchSummary"
            >
                <font-awesome-icon :icon="['fas', 'arrows-rotate']" :class="{ 'animate-spin': loading }" />
                Refresh
            </button>
            <button
                class="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
                :disabled="reanalyzing"
                @click="triggerReanalysis"
            >
                <font-awesome-icon :icon="['fas', 'wand-magic-sparkles']" :class="{ 'animate-pulse': reanalyzing }" />
                {{ reanalyzing ? 'Starting…' : 'Re-analyze All' }}
            </button>
        </div>

        <!-- Error -->
        <div v-if="error" class="mb-6 flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <font-awesome-icon :icon="['fas', 'triangle-exclamation']" />
            {{ error }}
        </div>

        <!-- Re-analysis feedback -->
        <div v-if="reanalyzedMessage" class="mb-6 flex items-center gap-3 p-4 bg-purple-50 border border-purple-200 rounded-lg text-purple-700 text-sm">
            <font-awesome-icon :icon="['fas', 'circle-info']" />
            {{ reanalyzedMessage }}
        </div>

        <!-- Loading skeleton -->
        <div v-if="loading && !summary" class="flex items-center justify-center py-24">
            <font-awesome-icon :icon="['fas', 'spinner']" class="text-blue-500 text-3xl animate-spin" />
        </div>

        <template v-if="summary">
            <!-- Summary cards -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div class="flex flex-col gap-1 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <span class="text-xs font-medium text-gray-500 uppercase tracking-wide">Healthy</span>
                    <span class="text-3xl font-bold text-green-600">{{ formatNumber(summary.healthy) }}</span>
                </div>
                <div class="flex flex-col gap-1 p-4 bg-white border border-amber-200 rounded-lg shadow-sm">
                    <span class="text-xs font-medium text-amber-600 uppercase tracking-wide">Warning</span>
                    <span class="text-3xl font-bold text-amber-600">{{ formatNumber(summary.warning) }}</span>
                </div>
                <div class="flex flex-col gap-1 p-4 bg-white border border-red-200 rounded-lg shadow-sm">
                    <span class="text-xs font-medium text-red-600 uppercase tracking-wide">Blocked</span>
                    <span class="text-3xl font-bold text-red-600">{{ formatNumber(summary.blocked) }}</span>
                </div>
                <div class="flex flex-col gap-1 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <span class="text-xs font-medium text-gray-500 uppercase tracking-wide">Unknown</span>
                    <span class="text-3xl font-bold text-gray-500">{{ formatNumber(summary.unknown) }}</span>
                </div>
            </div>

            <!-- Problem models section -->
            <div class="bg-white border border-gray-200 rounded-lg shadow-sm">
                <div class="flex flex-row items-center justify-between gap-3 px-6 py-4 border-b border-gray-200 flex-wrap">
                    <h2 class="text-base font-semibold text-gray-900">
                        Problem Models
                        <span class="ml-2 text-sm font-normal text-gray-500">({{ totalProblems }} total)</span>
                    </h2>
                    <!-- Filter tabs -->
                    <div class="inline-flex rounded-lg overflow-hidden border border-gray-200">
                        <button
                            v-for="opt in [{ value: 'all', label: 'All' }, { value: 'blocked', label: 'Blocked' }, { value: 'warning', label: 'Warning' }]"
                            :key="opt.value"
                            :class="[
                                'px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer',
                                statusFilter === opt.value
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white text-gray-600 hover:bg-gray-50'
                            ]"
                            @click="statusFilter = opt.value as any"
                        >
                            {{ opt.label }}
                        </button>
                    </div>
                </div>

                <!-- Empty state -->
                <div v-if="filteredModels.length === 0" class="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
                    <font-awesome-icon :icon="['fas', 'check-circle']" class="text-4xl text-green-400" />
                    <span class="text-sm">No problem models to display</span>
                </div>

                <!-- Model rows -->
                <div v-for="model in filteredModels" :key="model.id" class="border-b border-gray-100 last:border-b-0">
                    <!-- Row header -->
                    <button
                        class="w-full flex flex-row items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors text-left cursor-pointer"
                        @click="toggleExpand(model.id)"
                    >
                        <!-- Status badge -->
                        <span
                            :class="[
                                'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0',
                                model.health_status === 'blocked'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-amber-100 text-amber-700'
                            ]"
                        >
                            <font-awesome-icon
                                :icon="model.health_status === 'blocked' ? ['fas', 'circle-xmark'] : ['fas', 'triangle-exclamation']"
                                class="mr-1 text-xs"
                            />
                            {{ model.health_status }}
                        </span>

                        <!-- Model info -->
                        <div class="flex-1 min-w-0">
                            <div class="flex flex-row items-center gap-2 flex-wrap">
                                <span class="text-sm font-semibold text-gray-900 truncate">{{ model.name.replace(/_dra_[a-zA-Z0-9_]+/g, '') }}</span>
                                <span v-if="model.model_type" class="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{{ model.model_type }}</span>
                            </div>
                            <div class="flex flex-row items-center gap-3 mt-0.5 flex-wrap">
                                <span class="text-xs text-gray-500">
                                    Project: <span class="font-medium text-gray-700">{{ model.project_name || '(cross-source)' }}</span>
                                </span>
                                <span class="text-xs text-gray-400">|</span>
                                <span class="text-xs text-gray-500">
                                    Owner: <span class="font-medium text-gray-700">{{ model.owner_email || '—' }}</span>
                                </span>
                                <span class="text-xs text-gray-400">|</span>
                                <span class="text-xs text-gray-500">Created {{ formatDate(model.created_at) }}</span>
                            </div>
                        </div>

                        <!-- Row counts -->
                        <div class="hidden md:flex flex-row gap-4 flex-shrink-0 text-right">
                            <div>
                                <div class="text-xs text-gray-400">Rows</div>
                                <div class="text-sm font-medium text-gray-700">{{ formatNumber(model.row_count) }}</div>
                            </div>
                            <div>
                                <div class="text-xs text-gray-400">Source Rows</div>
                                <div class="text-sm font-medium text-gray-700">{{ formatNumber(model.source_row_count) }}</div>
                            </div>
                        </div>

                        <!-- Expand chevron -->
                        <font-awesome-icon
                            :icon="['fas', expandedModel === model.id ? 'chevron-up' : 'chevron-down']"
                            class="text-gray-400 flex-shrink-0"
                        />
                    </button>

                    <!-- Expanded details: health issues -->
                    <div v-if="expandedModel === model.id" class="px-6 pb-4 pt-2 bg-gray-50 border-t border-gray-100">
                        <div v-if="model.health_issues && model.health_issues.length > 0" class="flex flex-col gap-2">
                            <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Health Issues</h3>
                            <div
                                v-for="(issue, idx) in model.health_issues"
                                :key="idx"
                                class="flex flex-row items-start gap-3 p-3 bg-white border border-gray-200 rounded-lg"
                            >
                                <font-awesome-icon
                                    :icon="['fas', model.health_status === 'blocked' ? 'circle-xmark' : 'triangle-exclamation']"
                                    :class="model.health_status === 'blocked' ? 'text-red-500' : 'text-amber-500'"
                                    class="flex-shrink-0 mt-0.5"
                                />
                                <div class="flex flex-col gap-0.5 min-w-0">
                                    <span class="text-sm font-medium text-gray-800">{{ issue.title }}</span>
                                    <span v-if="issue.description" class="text-xs text-gray-600">{{ issue.description }}</span>
                                    <span v-if="issue.recommendation" class="text-xs text-gray-400 italic">{{ issue.recommendation }}</span>
                                </div>
                            </div>
                        </div>
                        <p v-else class="text-sm text-gray-500 italic">No detailed health issues recorded.</p>

                        <!-- Link to edit page -->
                        <div class="mt-4" v-if="model.project_id">
                            <NuxtLink
                                :to="`/projects/${model.project_id}/data-models`"
                                class="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
                            >
                                <font-awesome-icon :icon="['fas', 'arrow-up-right-from-square']" class="text-xs" />
                                View project data models
                            </NuxtLink>
                        </div>
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>
