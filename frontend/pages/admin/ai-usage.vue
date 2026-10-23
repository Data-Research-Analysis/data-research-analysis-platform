<script setup lang="ts">
useHead({
    title: 'AI Usage | Admin | Data Research Analysis',
    meta: [{ name: 'robots', content: 'noindex, nofollow' }],
});

interface FeatureRow {
    feature_key: string;
    call_count: number;
    actions_count: number;
    cost_usd: number;
    active_users: number;
}

interface ModelRow {
    model_id: string;
    call_count: number;
    cost_usd: number;
}

interface TopOrgRow {
    org_id: number;
    call_count: number;
    cost_usd: number;
}

interface OverviewData {
    month: string;
    total_cost_usd: number;
    total_calls: number;
    by_feature: FeatureRow[];
    by_model: ModelRow[];
    top_orgs: TopOrgRow[];
}

interface OrgData {
    org_id: number;
    month: string;
    total_cost_usd: number;
    by_feature: FeatureRow[];
}

interface ActionRow {
    action_id: string;
    call_count: number;
    cost_usd: number;
}

const config = useRuntimeConfig();
const apiBase = () => config.public.apiBase;

const loading = ref(true);
const error = ref<string | null>(null);
const month = ref<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
});

const overview = ref<OverviewData | null>(null);

const orgId = ref<string>('');
const orgLoading = ref(false);
const orgError = ref<string | null>(null);
const orgData = ref<OrgData | null>(null);
const selectedFeature = ref<string>('plan_build');
const actionRows = ref<ActionRow[]>([]);
const actionsLoading = ref(false);

function authHeaders() {
    const token = getAuthToken();
    if (!token) throw new Error('Authentication required');
    return { Authorization: `Bearer ${token}`, 'Authorization-Type': 'auth' };
}

const FEATURE_LABELS: Record<string, string> = {
    plan_build: 'Paid Media Plan Build',
    plan_chat: 'Plan Chat',
    data_modeler_chat: 'Data Modeler Chat',
    attribution: 'Attribution',
    ai_insights_generate: 'AI Insights Generate',
    ai_insights_chat: 'AI Insights Chat',
    ai_insights_report_chat: 'AI Insights Report Chat',
    report_widget: 'Report Widget',
    dashboard_auto_generate: 'Dashboard Auto-Generate',
    dashboard_widget_spec: 'Dashboard Widget Spec',
    data_model_chat: 'Data Model Chat',
    ai_analysis: 'AI Analysis',
    join_inference: 'Join Inference',
    data_model_analysis: 'Data Model Analysis',
    anomaly_detection: 'Anomaly Detection',
    budget_optimization: 'Budget Optimization',
    search_grounding: 'Search Grounding',
};

function featureLabel(key: string): string {
    return FEATURE_LABELS[key] ?? key.replace(/_/g, ' ');
}

async function fetchOverview() {
    loading.value = true;
    error.value = null;
    try {
        const response = await $fetch<{ success: boolean; data: OverviewData }>(
            `${apiBase()}/admin/ai-usage/overview?month=${month.value}`,
            { headers: authHeaders() }
        );
        if (response.success) overview.value = response.data;
    } catch (err: any) {
        error.value = err.data?.message || 'Failed to load AI usage data';
        console.error('[AdminAIUsage] fetch overview error:', err);
    } finally {
        loading.value = false;
    }
}

async function fetchOrg() {
    const id = parseInt(orgId.value, 10);
    if (!id) return;
    orgLoading.value = true;
    orgError.value = null;
    try {
        const response = await $fetch<{ success: boolean; data: OrgData }>(
            `${apiBase()}/admin/ai-usage/org/${id}?month=${month.value}`,
            { headers: authHeaders() }
        );
        if (response.success) {
            orgData.value = response.data;
            selectedFeature.value = response.data.by_feature[0]?.feature_key ?? 'plan_build';
            await fetchActions();
        }
    } catch (err: any) {
        orgError.value = err.data?.error || err.data?.message || 'Failed to load org AI usage';
        console.error('[AdminAIUsage] fetch org error:', err);
    } finally {
        orgLoading.value = false;
    }
}

async function fetchActions() {
    const id = parseInt(orgId.value, 10);
    if (!id || !selectedFeature.value) return;
    actionsLoading.value = true;
    try {
        const response = await $fetch<{ success: boolean; data: { actions: ActionRow[] } }>(
            `${apiBase()}/admin/ai-usage/actions/${id}?month=${month.value}&feature=${selectedFeature.value}&limit=25`,
            { headers: authHeaders() }
        );
        if (response.success) actionRows.value = response.data.actions;
    } catch (err: any) {
        console.error('[AdminAIUsage] fetch actions error:', err);
        actionRows.value = [];
    } finally {
        actionsLoading.value = false;
    }
}

function formatUsd(n: number | null | undefined): string {
    if (n == null || isNaN(n)) return '$0.00';
    if (n >= 1000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
    return `$${n.toFixed(2)}`;
}

function formatNumber(n: number | null | undefined): string {
    if (n == null) return '—';
    return n.toLocaleString();
}

function featureMaxCost(): number {
    if (!overview.value) return 1;
    return Math.max(...overview.value.by_feature.map((f) => f.cost_usd), 1);
}

function modelTotal(): number {
    if (!overview.value) return 0;
    return overview.value.by_model.reduce((s, m) => s + m.cost_usd, 0);
}

function modelWidth(m: ModelRow): number {
    const total = modelTotal();
    if (!total) return 0;
    return (m.cost_usd / total) * 100;
}

function changeMonth() {
    fetchOverview();
    if (orgId.value) fetchOrg();
}

onMounted(() => {
    if (!import.meta.client) return;
    fetchOverview();
});
</script>

<template>
    <div class="flex flex-row">
        <sidebar-admin class="w-1/6" />
        <div class="w-5/6 bg-gray-50 min-h-screen p-6">
        <!-- Header -->
        <div class="mb-6 flex flex-row items-center justify-between gap-4 flex-wrap">
            <div>
                <h1 class="text-2xl font-bold text-gray-900">AI Usage &amp; Cost Tracking</h1>
                <p class="text-sm text-gray-500 mt-1">
                    Per-call Gemini instrumentation — cost normalized across features via usageMetadata.
                </p>
            </div>
            <div class="flex items-center gap-3">
                <input
                    type="month"
                    v-model="month"
                    @change="changeMonth"
                    class="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <button
                    @click="fetchOverview"
                    :disabled="loading"
                    class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 cursor-pointer"
                >
                    <font-awesome-icon :icon="['fas', 'rotate']" :class="loading ? 'animate-spin' : ''" class="mr-2" />
                    Refresh
                </button>
            </div>
        </div>

        <div v-if="error" class="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
            {{ error }}
        </div>

        <!-- Overview stat cards -->
        <div v-if="overview" class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <AdminStatCard label="Total AI Cost" :value="formatUsd(overview.total_cost_usd)" :icon="['fas', 'coins']" icon-bg="bg-purple-600" />
            <AdminStatCard label="Total AI Calls" :value="formatNumber(overview.total_calls)" :icon="['fas', 'robot']" icon-bg="bg-blue-600" />
            <AdminStatCard label="Active Features" :value="overview.by_feature.length" :icon="['fas', 'wrench']" icon-bg="bg-teal-600" />
            <AdminStatCard label="Models In Use" :value="overview.by_model.length" :icon="['fas', 'microchip']" icon-bg="bg-indigo-600" />
        </div>

        <div v-if="loading" class="flex items-center justify-center py-24">
            <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin text-3xl text-blue-600" />
        </div>

        <template v-else-if="overview">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <!-- Cost by feature -->
                <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
                    <h2 class="text-base font-semibold text-gray-800 mb-1">Cost by Feature</h2>
                    <p class="text-xs text-gray-500 mb-4">USD this month — cost per user-facing action (plan doc §4)</p>
                    <div v-if="overview.by_feature.length" class="space-y-3">
                        <div v-for="f in overview.by_feature" :key="f.feature_key">
                            <div class="flex items-center justify-between text-sm mb-1">
                                <span class="text-gray-700 font-medium">{{ featureLabel(f.feature_key) }}</span>
                                <span class="text-gray-500">
                                    {{ formatUsd(f.cost_usd) }}
                                    <span class="text-xs text-gray-400">· {{ formatNumber(f.call_count) }} calls</span>
                                </span>
                            </div>
                            <div class="w-full bg-gray-100 rounded-full h-2">
                                <div
                                    class="h-2 rounded-full bg-purple-500 transition-all duration-300"
                                    :style="{ width: `${(f.cost_usd / featureMaxCost()) * 100}%` }"
                                ></div>
                            </div>
                        </div>
                    </div>
                    <div v-else class="text-sm text-gray-400 py-6 text-center">No AI calls recorded this month.</div>
                </div>

                <!-- Cost by model -->
                <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
                    <h2 class="text-base font-semibold text-gray-800 mb-1">Cost by Model</h2>
                    <p class="text-xs text-gray-500 mb-4">USD share per model id (model routing visibility, plan doc §6.3)</p>
                    <div v-if="overview.by_model.length" class="space-y-3">
                        <div v-for="m in overview.by_model" :key="m.model_id">
                            <div class="flex items-center justify-between text-sm mb-1">
                                <span class="text-gray-700 font-medium">{{ m.model_id }}</span>
                                <span class="text-gray-500">
                                    {{ formatUsd(m.cost_usd) }}
                                    <span class="text-xs text-gray-400">· {{ formatNumber(m.call_count) }} calls</span>
                                </span>
                            </div>
                            <div class="w-full bg-gray-100 rounded-full h-2">
                                <div
                                    class="h-2 rounded-full bg-blue-500 transition-all duration-300"
                                    :style="{ width: `${modelWidth(m)}%` }"
                                ></div>
                            </div>
                        </div>
                    </div>
                    <div v-else class="text-sm text-gray-400 py-6 text-center">No AI calls recorded this month.</div>
                </div>
            </div>

            <!-- Top orgs -->
            <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-5 mb-6">
                <h2 class="text-base font-semibold text-gray-800 mb-4">Top Organizations by AI Cost</h2>
                <div v-if="overview.top_orgs.length" class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="text-left text-xs uppercase text-gray-500 border-b border-gray-200">
                                <th class="py-2 pr-4">Org</th>
                                <th class="py-2 pr-4">Calls</th>
                                <th class="py-2 pr-4">Cost</th>
                                <th class="py-2"></th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="org in overview.top_orgs" :key="org.org_id" class="border-b border-gray-100">
                                <td class="py-2 pr-4 font-medium text-gray-800">#{{ org.org_id }}</td>
                                <td class="py-2 pr-4 text-gray-600">{{ formatNumber(org.call_count) }}</td>
                                <td class="py-2 pr-4 text-gray-600">{{ formatUsd(org.cost_usd) }}</td>
                                <td class="py-2 text-right">
                                    <button
                                        @click="orgId = String(org.org_id); fetchOrg()"
                                        class="text-blue-600 hover:text-blue-800 text-xs font-medium cursor-pointer"
                                    >
                                        Drill down &rarr;
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div v-else class="text-sm text-gray-400 py-6 text-center">No AI calls recorded this month.</div>
            </div>
        </template>

        <!-- Org drill-down -->
        <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-5 mb-6">
            <div class="flex items-center justify-between mb-4">
                <h2 class="text-base font-semibold text-gray-800">Organization Drill-down</h2>
                <div class="flex items-center gap-2">
                    <input
                        type="number"
                        v-model="orgId"
                        placeholder="Org ID"
                        class="px-3 py-2 border border-gray-300 rounded-lg text-sm w-32"
                    />
                    <button
                        @click="fetchOrg"
                        :disabled="orgLoading"
                        class="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium rounded-lg disabled:opacity-50 cursor-pointer"
                    >
                        <font-awesome-icon :icon="['fas', 'magnifying-glass']" :class="orgLoading ? 'animate-spin' : ''" class="mr-2" />
                        Load
                    </button>
                </div>
            </div>

            <div v-if="orgError" class="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
                {{ orgError }}
            </div>

            <template v-if="orgData">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <AdminStatCard label="Org AI Cost" :value="formatUsd(orgData.total_cost_usd)" :icon="['fas', 'coins']" icon-bg="bg-purple-600" />
                    <AdminStatCard label="Active Features" :value="orgData.by_feature.length" :icon="['fas', 'wrench']" icon-bg="bg-teal-600" />
                    <AdminStatCard label="Total Calls" :value="formatNumber(orgData.by_feature.reduce((s, f) => s + f.call_count, 0))" :icon="['fas', 'robot']" icon-bg="bg-blue-600" />
                </div>

                <div class="overflow-x-auto mb-4">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="text-left text-xs uppercase text-gray-500 border-b border-gray-200">
                                <th class="py-2 pr-4">Feature</th>
                                <th class="py-2 pr-4">Calls</th>
                                <th class="py-2 pr-4">Actions</th>
                                <th class="py-2 pr-4">Active Users</th>
                                <th class="py-2 pr-4">Cost</th>
                                <th class="py-2"></th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="f in orgData.by_feature" :key="f.feature_key" class="border-b border-gray-100">
                                <td class="py-2 pr-4 font-medium text-gray-800">{{ featureLabel(f.feature_key) }}</td>
                                <td class="py-2 pr-4 text-gray-600">{{ formatNumber(f.call_count) }}</td>
                                <td class="py-2 pr-4 text-gray-600">{{ formatNumber(f.actions_count) }}</td>
                                <td class="py-2 pr-4 text-gray-600">{{ formatNumber(f.active_users) }}</td>
                                <td class="py-2 pr-4 text-gray-600">{{ formatUsd(f.cost_usd) }}</td>
                                <td class="py-2 text-right">
                                    <button
                                        @click="selectedFeature = f.feature_key; fetchActions()"
                                        :class="selectedFeature === f.feature_key ? 'text-gray-800 font-semibold' : 'text-blue-600 hover:text-blue-800'"
                                        class="text-xs cursor-pointer"
                                    >
                                        {{ selectedFeature === f.feature_key ? 'Viewing &bull;' : 'View actions' }}
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Actions for selected feature -->
                <div v-if="selectedFeature">
                    <h3 class="text-sm font-semibold text-gray-700 mb-3">
                        Top actions — {{ featureLabel(selectedFeature) }}
                        <span class="text-xs font-normal text-gray-400 ml-2">(action_id = plan/conversation id)</span>
                    </h3>
                    <div v-if="actionsLoading" class="text-sm text-gray-400 py-4">Loading&hellip;</div>
                    <div v-else-if="actionRows.length" class="overflow-x-auto">
                        <table class="w-full text-sm">
                            <thead>
                                <tr class="text-left text-xs uppercase text-gray-500 border-b border-gray-200">
                                    <th class="py-2 pr-4">Action ID</th>
                                    <th class="py-2 pr-4">Calls</th>
                                    <th class="py-2">Cost</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="a in actionRows" :key="a.action_id" class="border-b border-gray-100">
                                    <td class="py-2 pr-4 font-mono text-xs text-gray-800">{{ a.action_id }}</td>
                                    <td class="py-2 pr-4 text-gray-600">{{ formatNumber(a.call_count) }}</td>
                                    <td class="py-2 text-gray-600">{{ formatUsd(a.cost_usd) }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div v-else class="text-sm text-gray-400 py-4">No actions for this feature.</div>
                </div>
            </template>

            <div v-else-if="!orgError" class="text-sm text-gray-400 py-4">
                Enter an org ID to see its per-feature cost breakdown and the most expensive actions (plans, conversations).
            </div>
        </div>
        </div>
    </div>
</template>
