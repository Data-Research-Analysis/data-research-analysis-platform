<script setup lang="ts">
/**
 * AlertSummaryBar — Compact summary bar showing alert counts by severity.
 * Used above the AIAlertsList to give a quick overview.
 *
 * TICKET MKT-007: Intelligence Hub Overview — Integration
 */
import type { IAlertSummary } from '@/composables/useAnomalyAlerts';

interface Props {
    summary: IAlertSummary;
}

const props = defineProps<Props>();
</script>

<template>
    <div class="flex items-center gap-2.5 flex-wrap">
        <!-- Critical -->
        <div v-if="summary.critical > 0"
             class="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-700">
            <span class="w-1.5 h-1.5 rounded-full bg-red-500" />
            {{ summary.critical }} Critical
        </div>

        <!-- Warning -->
        <div v-if="summary.warning > 0"
             class="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-700">
            <span class="w-1.5 h-1.5 rounded-full bg-amber-500" />
            {{ summary.warning }} Warning{{ summary.warning > 1 ? 's' : '' }}
        </div>

        <!-- Info -->
        <div v-if="summary.info > 0"
             class="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">
            <span class="w-1.5 h-1.5 rounded-full bg-blue-500" />
            {{ summary.info }} Info
        </div>

        <!-- Total divider -->
        <span class="text-[10px] text-gray-400">
            {{ summary.total }} total
        </span>

        <!-- Type breakdown -->
        <div class="flex items-center gap-1.5 ml-auto text-[10px] text-gray-400">
            <span v-if="summary.byType.anomaly > 0" class="inline-flex items-center gap-0.5">
                <span class="w-1 h-1 rounded-full bg-purple-400" />
                {{ summary.byType.anomaly }} anomalies
            </span>
            <span v-if="summary.byType.performance > 0" class="inline-flex items-center gap-0.5">
                <span class="w-1 h-1 rounded-full bg-orange-400" />
                {{ summary.byType.performance }} performance
            </span>
            <span v-if="summary.byType.budget > 0" class="inline-flex items-center gap-0.5">
                <span class="w-1 h-1 rounded-full bg-teal-400" />
                {{ summary.byType.budget }} budget
            </span>
        </div>
    </div>
</template>