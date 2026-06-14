<script setup lang="ts">
/**
 * AlertCard — Displays a single anomaly alert with severity indicator,
 * type badge, metric values, and suggested action.
 *
 * TICKET MKT-007: Intelligence Hub Overview — Integration
 */
import type { IAlert, AlertSeverity, AlertType } from '@/composables/useAnomalyAlerts';

interface Props {
    alert: IAlert;
    formatCurrency?: (v: number) => string;
    formatPercent?: (v: number) => string;
}

const props = withDefaults(defineProps<Props>(), {
    formatCurrency: (v: number) => `$${v.toFixed(2)}`,
    formatPercent: (v: number) => `${v.toFixed(1)}%`,
});

const severityConfig: Record<AlertSeverity, { bg: string; border: string; icon: string; iconColor: string; dot: string; label: string }> = {
    critical: {
        bg: 'bg-red-50',
        border: 'border-red-200',
        icon: 'triangle-exclamation',
        iconColor: 'text-red-500',
        dot: 'bg-red-500',
        label: 'Critical',
    },
    warning: {
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        icon: 'exclamation-circle',
        iconColor: 'text-amber-500',
        dot: 'bg-amber-500',
        label: 'Warning',
    },
    info: {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        icon: 'info-circle',
        iconColor: 'text-blue-500',
        dot: 'bg-blue-500',
        label: 'Info',
    },
};

const typeConfig: Record<AlertType, { label: string; color: string }> = {
    anomaly: { label: 'Anomaly', color: 'bg-purple-100 text-purple-700' },
    performance: { label: 'Performance', color: 'bg-orange-100 text-orange-700' },
    budget: { label: 'Budget', color: 'bg-teal-100 text-teal-700' },
};

const config = computed(() => severityConfig[props.alert.severity]);
const typeBadge = computed(() => typeConfig[props.alert.type]);

const formattedDate = computed(() => {
    if (!props.alert.date) return null;
    try {
        return new Date(props.alert.date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        });
    } catch {
        return props.alert.date;
    }
});

const expanded = ref(false);
</script>

<template>
    <div
        class="alert-card rounded-lg border p-3 transition-all cursor-pointer hover:shadow-sm"
        :class="[config.bg, config.border]"
        @click="expanded = !expanded"
    >
        <!-- Header row -->
        <div class="flex items-start gap-2.5">
            <!-- Severity icon -->
            <div class="flex-shrink-0 mt-0.5">
                <font-awesome-icon
                    :icon="['fas', config.icon]"
                    class="text-sm"
                    :class="config.iconColor"
                />
            </div>

            <!-- Content -->
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                    <!-- Type badge -->
                    <span class="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded-full"
                          :class="typeBadge.color">
                        {{ typeBadge.label }}
                    </span>
                    <!-- Severity dot + label -->
                    <span class="inline-flex items-center gap-1 text-[10px] font-medium text-gray-500">
                        <span class="w-1.5 h-1.5 rounded-full" :class="config.dot" />
                        {{ config.label }}
                    </span>
                    <!-- Date -->
                    <span v-if="formattedDate" class="text-[10px] text-gray-400 ml-auto">
                        {{ formattedDate }}
                    </span>
                </div>

                <!-- Metric & message -->
                <p class="text-sm font-medium text-gray-800 mt-1 leading-snug">
                    {{ alert.metric }}
                </p>
                <p class="text-xs text-gray-600 mt-0.5 leading-relaxed">
                    {{ alert.message }}
                </p>

                <!-- Context tags -->
                <div v-if="alert.campaignContext || alert.channelContext" class="flex items-center gap-2 mt-1.5">
                    <span v-if="alert.channelContext"
                          class="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-white/60 rounded text-gray-500 border border-gray-200/50">
                        <font-awesome-icon :icon="['fas', 'chart-bar']" class="w-2.5 h-2.5 mr-1 text-gray-400" />
                        {{ alert.channelContext }}
                    </span>
                    <span v-if="alert.campaignContext"
                          class="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-white/60 rounded text-gray-500 border border-gray-200/50">
                        <font-awesome-icon :icon="['fas', 'bullhorn']" class="w-2.5 h-2.5 mr-1 text-gray-400" />
                        {{ alert.campaignContext }}
                    </span>
                </div>
            </div>

            <!-- Deviation badge -->
            <div class="flex-shrink-0 text-right">
                <span class="text-xs font-semibold"
                      :class="config.iconColor">
                    {{ alert.deviationPercent > 0 ? '+' : '' }}{{ formatPercent(alert.deviationPercent) }}
                </span>
            </div>
        </div>

        <!-- Expanded details -->
        <div v-if="expanded" class="mt-2.5 pt-2.5 border-t border-gray-200/50">
            <!-- Current vs Expected -->
            <div class="grid grid-cols-2 gap-2 mb-2">
                <div>
                    <p class="text-[10px] text-gray-400 uppercase tracking-wider">Current</p>
                    <p class="text-sm font-semibold text-gray-700">{{ formatCurrency(alert.currentValue) }}</p>
                </div>
                <div>
                    <p class="text-[10px] text-gray-400 uppercase tracking-wider">Expected</p>
                    <p class="text-sm font-semibold text-gray-700">{{ formatCurrency(alert.expectedValue) }}</p>
                </div>
            </div>

            <!-- Suggested action -->
            <div v-if="alert.suggestedAction" class="flex items-start gap-1.5 mt-1">
                <font-awesome-icon :icon="['fas', 'lightbulb']" class="text-[10px] text-amber-500 mt-0.5 flex-shrink-0" />
                <p class="text-xs text-gray-600 leading-relaxed">{{ alert.suggestedAction }}</p>
            </div>
        </div>
    </div>
</template>