<script setup lang="ts">
interface Props {
    label: string;
    value: number;
    format?: 'currency' | 'number' | 'percent' | 'multiplier';
    delta?: number | null;
    deltaLabel?: string;
    icon?: string[];
    iconColor?: string;
    isLoading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    format: 'number',
    delta: null,
    deltaLabel: 'vs last period',
    icon: () => ['fas', 'chart-bar'],
    iconColor: 'text-primary-blue-100',
    isLoading: false,
});

function formatValue(val: number, fmt: string): string {
    if (fmt === 'currency') {
        if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
        if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}k`;
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
    }
    if (fmt === 'percent') return `${(val * 100).toFixed(1)}%`;
    if (fmt === 'multiplier') return `${val.toFixed(2)}×`;
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `${(val / 1_000).toFixed(1)}k`;
    return new Intl.NumberFormat('en-US').format(Math.round(val));
}

const formattedValue = computed(() => formatValue(props.value, props.format));

const deltaPositive = computed(() => props.delta !== null && props.delta >= 0);
const deltaIcon = computed(() => (props.delta !== null && props.delta >= 0 ? 'arrow-up' : 'arrow-down'));
const deltaClass = computed(() =>
    props.delta === null
        ? 'text-gray-400'
        : props.delta >= 0
          ? 'text-green-600'
          : 'text-red-500',
);
const deltaPct = computed(() => {
    if (props.delta === null) return null;
    return `${props.delta >= 0 ? '+' : ''}${(props.delta * 100).toFixed(1)}%`;
});
</script>

<template>
    <div class="rounded-xl border border-gray-200 bg-white p-5 flex flex-col gap-2 min-w-0">
        <!-- Label row -->
        <div class="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
            <font-awesome-icon :icon="(icon as any)" :class="iconColor" />
            <span class="truncate">{{ label }}</span>
        </div>

        <!-- Value skeleton -->
        <template v-if="isLoading">
            <div class="h-8 w-24 rounded bg-gray-200 animate-pulse"></div>
            <div class="h-4 w-16 rounded bg-gray-100 animate-pulse"></div>
        </template>

        <template v-else>
            <!-- Primary value -->
            <div class="text-2xl font-bold text-gray-900 truncate">{{ formattedValue }}</div>

            <!-- Delta indicator -->
            <div v-if="delta !== null" class="flex items-center gap-1 text-xs font-medium" :class="deltaClass">
                <font-awesome-icon :icon="['fas', deltaIcon]" />
                <span>{{ deltaPct }} {{ deltaLabel }}</span>
            </div>
            <div v-else class="text-xs text-gray-400">No prior period data</div>
        </template>
    </div>
</template>
