<template>
    <div class="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <div class="flex items-center justify-between mb-6">
            <div>
                <h3 class="text-lg font-semibold text-gray-900">Subscription & Usage</h3>
                <p class="text-sm text-gray-500 mt-1">Current plan and resource limits</p>
            </div>
            <div class="flex items-center gap-2">
                <span 
                    :class="[
                        'px-3 py-1.5 rounded-full text-sm font-medium',
                        tierColor
                    ]"
                >
                    {{ tierName }}
                </span>
                <button 
                    v-if="isFree || isProfessional"
                    @click="handleComingSoon"
                    class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
                >
                    {{ isFree ? 'Upgrade' : 'View Plans' }}
                </button>
            </div>
        </div>

        <!-- Usage Stats Grid -->
        <div class="space-y-4">
            <!-- Projects -->
            <UsageMeter
                label="Projects"
                :current="usageStats?.projectCount || 0"
                :limit="usageStats?.maxProjects"
                icon="fas fa-folder"
            />

            <!-- Data Sources -->
            <UsageMeter
                label="Data Sources"
                :current="usageStats?.dataSourceCount || 0"
                :limit="usageStats?.maxDataSources"
                icon="fas fa-database"
                helpText="per project"
            />

            <!-- Dashboards -->
            <UsageMeter
                label="Dashboards"
                :current="usageStats?.dashboardCount || 0"
                :limit="usageStats?.maxDashboards"
                icon="fas fa-chart-line"
            />

            <!-- AI Generations -->
            <UsageMeter
                label="AI Generations"
                :current="usageStats?.aiGenerationsUsed || 0"
                :limit="usageStats?.aiGenerationsPerMonth"
                icon="fas fa-robot"
                helpText="this month"
            />

            <!-- Row Limit -->
            <div class="pt-4 border-t border-gray-200">
                <div class="flex items-center gap-2 mb-2">
                    <font-awesome-icon :icon="['fas', 'table']" class="text-purple-600" />
                    <span class="text-sm font-medium text-gray-700">Rows per Data Model</span>
                </div>
                <div class="text-2xl font-bold text-gray-900">
                    {{ formatNumber(usageStats?.rowLimit) }}
                </div>
            </div>
        </div>

        <!-- Upgrade Banner for FREE users -->
        <div v-if="isFree" class="mt-6 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
            <div class="flex items-start gap-3">
                <font-awesome-icon :icon="['fas', 'star']" class="text-blue-600 text-xl mt-0.5" />
                <div class="flex-1">
                    <h4 class="font-semibold text-gray-900 mb-1">Upgrade to Professional</h4>
                    <p class="text-sm text-gray-600 mb-3">
                        Get unlimited projects, data sources, dashboards, AI generations, and 100M rows per model.
                    </p>
                    <button 
                        @click="handleComingSoon"
                        class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
                    >
                        View Pricing
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useSubscriptionStore } from '~/stores/subscription';
import { useTierLimits } from '~/composables/useTierLimits';

const subscriptionStore = useSubscriptionStore();
const { currentTier, isFree, isProfessional, isEnterprise, usageStats } = useTierLimits();

function handleComingSoon() {
    const { $swal } = useNuxtApp() as any;
    $swal.fire({
        title: 'Coming Soon!',
        text: 'Paid plans are coming soon. We will notify you when they are available.',
        icon: 'info',
        confirmButtonText: 'Got it',
        confirmButtonColor: '#3b82f6',
    });
}

const tierName = computed(() => {
    const name = currentTier.value;
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
});

const tierColor = computed(() => {
    if (isFree.value) return 'bg-gray-100 text-gray-800';
    if (isProfessional.value) return 'bg-blue-100 text-blue-800';
    if (isEnterprise.value) return 'bg-purple-100 text-purple-800';
    return 'bg-gray-100 text-gray-800';
});

function formatNumber(num: number | null | undefined): string {
    if (num === null || num === undefined) return 'Unlimited';
    if (num === -1) return 'Unlimited';
    if (num >= 1000000) return `${(num / 1000000).toFixed(0)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toString();
}
</script>
