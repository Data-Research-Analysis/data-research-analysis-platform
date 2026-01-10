<script setup>
import { useSubscriptionStore } from '@/stores/subscription';

const subscriptionStore = useSubscriptionStore();
const router = useRouter();

const subscriptionStats = computed(() => subscriptionStore.subscriptionStats);
const loading = computed(() => subscriptionStore.loading);

onMounted(async () => {
    await subscriptionStore.fetchSubscription();
});

function handleUpgrade() {
    if (import.meta.client) {
        router.push('/pricing'); // Adjust route as needed
    }
}

function formatNumber(value) {
    if (value === null || value === undefined) return 'N/A';
    if (value === -1) return 'Unlimited';
    return value.toLocaleString();
}

function calculatePercentage(current, max) {
    if (max === null || max === undefined || max === -1) return 0;
    return Math.min((current / max) * 100, 100);
}

function getProgressColor(percentage) {
    if (percentage >= 90) return 'bg-red-600';
    if (percentage >= 70) return 'bg-yellow-600';
    return 'bg-green-600';
}

const projectUsage = computed(() => {
    if (!subscriptionStats.value) return { percentage: 0, color: 'bg-gray-400' };
    const percentage = calculatePercentage(
        subscriptionStats.value.projectCount,
        subscriptionStats.value.maxProjects
    );
    return { percentage, color: getProgressColor(percentage) };
});

const dataSourceUsage = computed(() => {
    if (!subscriptionStats.value) return { percentage: 0, color: 'bg-gray-400' };
    const percentage = calculatePercentage(
        subscriptionStats.value.dataSourceCount,
        subscriptionStats.value.maxDataSources
    );
    return { percentage, color: getProgressColor(percentage) };
});

const dashboardUsage = computed(() => {
    if (!subscriptionStats.value) return { percentage: 0, color: 'bg-gray-400' };
    const percentage = calculatePercentage(
        subscriptionStats.value.dashboardCount,
        subscriptionStats.value.maxDashboards
    );
    return { percentage, color: getProgressColor(percentage) };
});
</script>

<template>
    <div class="bg-white shadow-md rounded-lg border border-gray-200 p-6">
        <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-semibold text-gray-900">
                Subscription Usage
            </h3>
            <span
                v-if="subscriptionStats"
                class="px-3 py-1 text-xs font-semibold rounded-full"
                :class="{
                    'bg-blue-100 text-blue-800': subscriptionStats.tier.tier_name === 'FREE',
                    'bg-purple-100 text-purple-800': subscriptionStats.tier.tier_name === 'PRO',
                    'bg-indigo-100 text-indigo-800': subscriptionStats.tier.tier_name === 'TEAM',
                    'bg-orange-100 text-orange-800': subscriptionStats.tier.tier_name === 'BUSINESS',
                    'bg-yellow-100 text-yellow-800': subscriptionStats.tier.tier_name === 'ENTERPRISE',
                }"
            >
                {{ subscriptionStats.tier.tier_name }}
            </span>
        </div>

        <div v-if="loading" class="flex justify-center py-8">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-blue-100"></div>
        </div>

        <div v-else-if="!subscriptionStats" class="text-center py-8 text-gray-500">
            Unable to load subscription data
        </div>

        <div v-else class="space-y-5">
            <!-- Row Limit -->
            <div>
                <div class="flex justify-between items-center mb-1">
                    <span class="text-sm font-medium text-gray-700">Rows Per Query</span>
                    <span class="text-sm text-gray-600">
                        {{ formatNumber(subscriptionStats.rowLimit) }}
                    </span>
                </div>
                <p class="text-xs text-gray-500 mb-2">
                    Maximum rows returned per data model query
                </p>
            </div>

            <!-- Projects -->
            <div v-if="subscriptionStats.maxProjects !== null">
                <div class="flex justify-between items-center mb-1">
                    <span class="text-sm font-medium text-gray-700">Projects</span>
                    <span class="text-sm text-gray-600">
                        {{ subscriptionStats.projectCount }} / {{ formatNumber(subscriptionStats.maxProjects) }}
                    </span>
                </div>
                <div v-if="subscriptionStats.maxProjects !== -1" class="w-full bg-gray-200 rounded-full h-2">
                    <div
                        :class="projectUsage.color"
                        class="h-2 rounded-full transition-all duration-300"
                        :style="{ width: `${projectUsage.percentage}%` }"
                    ></div>
                </div>
            </div>

            <!-- Data Sources -->
            <div v-if="subscriptionStats.maxDataSources !== null">
                <div class="flex justify-between items-center mb-1">
                    <span class="text-sm font-medium text-gray-700">Data Sources</span>
                    <span class="text-sm text-gray-600">
                        {{ subscriptionStats.dataSourceCount }} / {{ formatNumber(subscriptionStats.maxDataSources) }}
                    </span>
                </div>
                <div v-if="subscriptionStats.maxDataSources !== -1" class="w-full bg-gray-200 rounded-full h-2">
                    <div
                        :class="dataSourceUsage.color"
                        class="h-2 rounded-full transition-all duration-300"
                        :style="{ width: `${dataSourceUsage.percentage}%` }"
                    ></div>
                </div>
            </div>

            <!-- Dashboards -->
            <div v-if="subscriptionStats.maxDashboards !== null">
                <div class="flex justify-between items-center mb-1">
                    <span class="text-sm font-medium text-gray-700">Dashboards</span>
                    <span class="text-sm text-gray-600">
                        {{ subscriptionStats.dashboardCount }} / {{ formatNumber(subscriptionStats.maxDashboards) }}
                    </span>
                </div>
                <div v-if="subscriptionStats.maxDashboards !== -1" class="w-full bg-gray-200 rounded-full h-2">
                    <div
                        :class="dashboardUsage.color"
                        class="h-2 rounded-full transition-all duration-300"
                        :style="{ width: `${dashboardUsage.percentage}%` }"
                    ></div>
                </div>
            </div>

            <!-- AI Generations -->
            <div v-if="subscriptionStats.aiGenerationsPerMonth !== null">
                <div class="flex justify-between items-center mb-1">
                    <span class="text-sm font-medium text-gray-700">AI Generations/Month</span>
                    <span class="text-sm text-gray-600">
                        {{ formatNumber(subscriptionStats.aiGenerationsPerMonth) }}
                    </span>
                </div>
            </div>

            <!-- Upgrade Button -->
            <div class="pt-4 border-t border-gray-200">
                <button
                    @click="handleUpgrade"
                    class="w-full flex items-center justify-center px-4 py-2 bg-gradient-to-r from-primary-blue-100 to-primary-blue-300 hover:from-primary-blue-200 hover:to-primary-blue-400 text-white text-sm font-medium rounded-md transition-all shadow-sm"
                >
                    <svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    Upgrade Plan
                </button>
            </div>
        </div>
    </div>
</template>
