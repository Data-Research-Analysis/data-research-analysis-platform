<script setup lang="ts">
/**
 * CampaignTrendChart — Dual Y-axis line chart showing daily spend,
 * conversions, and CPA over time for a single campaign.
 *
 * Uses D3.js (same pattern as TrendSparkline).
 */
import type { IDailyTrendPoint } from '~/composables/useCampaignDrillDown';

interface Props {
    data: IDailyTrendPoint[];
    isLoading?: boolean;
    formatCurrency: (v: number) => string;
    formatNumber: (v: number) => string;
}

const props = withDefaults(defineProps<Props>(), {
    isLoading: false,
});

const container = ref<HTMLDivElement | null>(null);
let cleanup: (() => void) | null = null;
let resizeObserver: ResizeObserver | null = null;

const activeMetrics = ref<Set<'spend' | 'conversions' | 'cpa'>>(new Set(['spend', 'conversions']));

const metricConfig = {
    spend: { label: 'Spend', color: '#3b82f6', axis: 'left' as const },
    conversions: { label: 'Conversions', color: '#10b981', axis: 'right' as const },
    cpa: { label: 'CPA', color: '#f59e0b', axis: 'left' as const },
};

function toggleMetric(metric: 'spend' | 'conversions' | 'cpa') {
    if (activeMetrics.value.has(metric)) {
        if (activeMetrics.value.size > 1) {
            activeMetrics.value.delete(metric);
        }
    } else {
        activeMetrics.value.add(metric);
    }
    activeMetrics.value = new Set(activeMetrics.value);
    if (import.meta.client) render();
}

async function render() {
    if (!import.meta.client || !container.value || !props.data || props.data.length < 2) {
        return;
    }

    cleanup?.();
    cleanup = null;
    container.value.innerHTML = '';

    const d3 = await import('d3');

    const margin = { top: 20, right: 60, bottom: 40, left: 60 };
    const w = container.value.clientWidth || 600;
    const h = 300;
    const innerW = w - margin.left - margin.right;
    const innerH = h - margin.top - margin.bottom;

    const svg = d3
        .select(container.value)
        .append('svg')
        .attr('width', w)
        .attr('height', h)
        .attr('viewBox', `0 0 ${w} ${h}`);

    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // X scale — dates
    const parseDate = d3.timeParse('%Y-%m-%d');
    const dates = props.data.map(d => parseDate(d.date)!).filter(Boolean);
    const xScale = d3.scaleTime()
        .domain(d3.extent(dates) as [Date, Date])
        .range([0, innerW]);

    // Determine which metrics are active
    const metricsToShow = Array.from(activeMetrics.value);
    const leftMetrics = metricsToShow.filter(m => metricConfig[m].axis === 'left');
    const rightMetrics = metricsToShow.filter(m => metricConfig[m].axis === 'right');

    // Left Y scale
    if (leftMetrics.length > 0) {
        const allLeftValues = leftMetrics.flatMap(m => props.data.map(d => d[m]));
        const leftExtent = d3.extent(allLeftValues) as [number, number];
        const yLeft = d3.scaleLinear()
            .domain([0, leftExtent[1] * 1.1 || 1])
            .range([innerH, 0]);

        // Left axis
        g.append('g')
            .call(d3.axisLeft(yLeft).ticks(5).tickFormat((d) => {
                const val = Number(d);
                if (leftMetrics.includes('spend')) {
                    return props.formatCurrency(val);
                }
                return val.toLocaleString();
            }))
            .selectAll('text')
            .style('font-size', '10px')
            .style('fill', '#6b7280');

        // Grid lines
        g.append('g')
            .attr('class', 'grid')
            .call(d3.axisLeft(yLeft).ticks(5).tickSize(-innerW).tickFormat(null as any))
            .selectAll('line')
            .style('stroke', '#f3f4f6')
            .style('stroke-dasharray', '3,3');

        g.selectAll('.grid .domain').remove();

        // Lines for left metrics
        for (const metric of leftMetrics) {
            const line = d3.line<IDailyTrendPoint>()
                .x(d => xScale(parseDate(d.date)!))
                .y(d => yLeft(d[metric]))
                .curve(d3.curveMonotoneX);

            g.append('path')
                .datum(props.data)
                .attr('fill', 'none')
                .attr('stroke', metricConfig[metric].color)
                .attr('stroke-width', 2)
                .attr('stroke-linecap', 'round')
                .attr('d', line);

            // Dots
            g.selectAll(`.dot-${metric}`)
                .data(props.data)
                .enter()
                .append('circle')
                .attr('cx', d => xScale(parseDate(d.date)!))
                .attr('cy', d => yLeft(d[metric]))
                .attr('r', 3)
                .attr('fill', metricConfig[metric].color)
                .attr('stroke', 'white')
                .attr('stroke-width', 1.5);
        }
    }

    // Right Y scale
    if (rightMetrics.length > 0) {
        const allRightValues = rightMetrics.flatMap(m => props.data.map(d => d[m]));
        const rightExtent = d3.extent(allRightValues) as [number, number];
        const yRight = d3.scaleLinear()
            .domain([0, rightExtent[1] * 1.1 || 1])
            .range([innerH, 0]);

        g.append('g')
            .attr('transform', `translate(${innerW},0)`)
            .call(d3.axisRight(yRight).ticks(5).tickFormat((d) => {
                return Number(d).toLocaleString();
            }))
            .selectAll('text')
            .style('font-size', '10px')
            .style('fill', '#6b7280');

        for (const metric of rightMetrics) {
            const line = d3.line<IDailyTrendPoint>()
                .x(d => xScale(parseDate(d.date)!))
                .y(d => yRight(d[metric]))
                .curve(d3.curveMonotoneX);

            g.append('path')
                .datum(props.data)
                .attr('fill', 'none')
                .attr('stroke', metricConfig[metric].color)
                .attr('stroke-width', 2)
                .attr('stroke-linecap', 'round')
                .attr('stroke-dasharray', '6,3')
                .attr('d', line);

            g.selectAll(`.dot-${metric}`)
                .data(props.data)
                .enter()
                .append('circle')
                .attr('cx', d => xScale(parseDate(d.date)!))
                .attr('cy', d => yRight(d[metric]))
                .attr('r', 3)
                .attr('fill', metricConfig[metric].color)
                .attr('stroke', 'white')
                .attr('stroke-width', 1.5);
        }
    }

    // X axis
    g.append('g')
        .attr('transform', `translate(0,${innerH})`)
        .call(d3.axisBottom(xScale).ticks(6).tickFormat(d3.timeFormat('%b %d') as any))
        .selectAll('text')
        .style('font-size', '10px')
        .style('fill', '#6b7280');

    // Remove domain lines for cleaner look
    g.selectAll('.domain').style('stroke', '#e5e7eb');

    cleanup = () => {
        svg.remove();
    };
}

onMounted(() => {
    if (import.meta.client) {
        render();
        if (container.value) {
            resizeObserver = new ResizeObserver(() => render());
            resizeObserver.observe(container.value);
        }
    }
});

watch(
    () => props.data,
    () => { if (import.meta.client) render(); },
    { deep: true },
);

onBeforeUnmount(() => {
    resizeObserver?.disconnect();
    cleanup?.();
});
</script>

<template>
    <div class="space-y-3">
        <!-- Metric toggle buttons -->
        <div class="flex items-center gap-2 flex-wrap">
            <button
                v-for="(config, metric) in metricConfig"
                :key="metric"
                type="button"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer"
                :class="
                    activeMetrics.has(metric as any)
                        ? 'border-transparent text-white'
                        : 'border-gray-200 text-gray-500 bg-white hover:bg-gray-50'
                "
                :style="activeMetrics.has(metric as any) ? { backgroundColor: config.color } : {}"
                @click="toggleMetric(metric as any)"
            >
                <span
                    class="w-2 h-2 rounded-full"
                    :style="{ backgroundColor: activeMetrics.has(metric as any) ? 'white' : config.color }"
                />
                {{ config.label }}
            </button>
        </div>

        <!-- Loading skeleton -->
        <div v-if="isLoading" class="h-[300px] rounded-lg bg-gray-50 animate-pulse" />

        <!-- Empty state -->
        <div
            v-else-if="!data || data.length < 2"
            class="h-[300px] flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50"
        >
            <font-awesome-icon :icon="['fas', 'chart-line']" class="text-3xl text-gray-300 mb-2" />
            <p class="text-sm text-gray-400">No trend data available</p>
        </div>

        <!-- Chart container -->
        <div
            v-else
            ref="container"
            class="w-full"
            style="height: 300px;"
        />
    </div>
</template>
