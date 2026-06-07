<script setup lang="ts">
/**
 * AIAlertsList — Container component for displaying anomaly alerts
 * with loading/error/empty states and an AI toggle.
 *
 * TICKET MKT-007: Intelligence Hub Overview — Integration
 */
import type { IAlert, IAlertSummary } from '@/composables/useAnomalyAlerts';

interface Props {
    alerts: IAlert[];
    summary: IAlertSummary;
    isLoading?: boolean;
    error?: string | null;
    formatCurrency?: (v: number) => string;
    formatPercent?: (v: number) => string;
}

const props = withDefaults(defineProps<Props>(), {
    isLoading: false,
    error: null,
    formatCurrency: (v: number) => `$${v.toFixed(2)}`,
    formatPercent: (v: number) => `${v.toFixed(1)}%`,
});

const emit = defineEmits<{
    (e: 'toggle-ai'): void;
}>();

const maxVisible = 5;
const showAll = ref(false);

const visibleAlerts = computed(() =>
    showAll.value ? props.alerts : props.alerts.slice(0, maxVisible),
);

const hasMore = computed(() => props.alerts.length > maxVisible);

// Severity order for sorting (used as fallback if not pre-sorted)
const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
const sortedAlerts = computed(() =>
    [...visibleAlerts.value].sort(
        (a, b) => (severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99),
    ),
);
</script>

<template>
    <div class="ai-alerts-list">
        <!-- Loading state -->
        <div v-if="isLoading" class="py-6 flex flex-col items-center justify-center text-center">
            <div class="w-8 h-8 border-2 border-gray-200 border-t-primary-blue-100 rounded-full animate-spin mb-3" />
            <p class="text-xs text-gray-400">Scanning for anomalies…</p>
        </div>

        <!-- Error state -->
        <div v-else-if="error" class="py-6 flex flex-col items-center justify-center text-center">
            <div class="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center mb-3">
                <font-awesome-icon :icon="['fas', 'exclamation-triangle']" class="text-red-400 text-sm" />
            </div>
            <p class="text-xs text-gray-500 mb-2">{{ error }}</p>
            <button
                class="text-xs text-primary-blue-100 font-medium hover:underline"
                @click="$emit('toggle-ai')"
            >
                Retry
            </button>
        </div>

        <!-- Empty state -->
        <div v-else-if="alerts.length === 0" class="py-6 flex flex-col items-center justify-center text-center">
            <div class="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center mb-3">
                <font-awesome-icon :icon="['fas', 'check-circle']" class="text-green-400 text-sm" />
            </div>
            <p class="text-xs text-gray-500 font-medium">No anomalies detected</p>
            <p class="text-[10px] text-gray-400 mt-0.5">All metrics are within expected ranges</p>
        </div>

        <!-- Alerts list -->
        <div v-else>
            <!-- Summary bar -->
            <AlertSummaryBar :summary="summary" class="mb-3" />

            <!-- Alert cards -->
            <div class="flex flex-col gap-2">
                <AlertCard
                    v-for="alert in sortedAlerts"
                    :key="alert.id"
                    :alert="alert"
                    :format-currency="formatCurrency"
                    :format-percent="formatPercent"
                />
            </div>

            <!-- Show more/less toggle -->
            <div v-if="hasMore" class="mt-2 text-center">
                <button
                    class="text-xs text-primary-blue-100 font-medium hover:underline"
                    @click="showAll = !showAll"
                >
                    {{ showAll ? 'Show fewer' : `Show all ${alerts.length} alerts` }}
                </button>
            </div>

            <!-- AI toggle hint -->
            <div class="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                <span class="text-[10px] text-gray-400 flex items-center gap-1">
                    <font-awesome-icon :icon="['fas', 'robot']" class="text-gray-300" />
                    Powered by anomaly detection
                </span>
            </div>
        </div>
    </div>
</template>