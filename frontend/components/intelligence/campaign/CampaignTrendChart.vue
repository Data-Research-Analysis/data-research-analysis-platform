<script setup lang="ts">
import type { IDailyTrendRow } from '@/composables/useCampaignAnalysis';
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';

interface Props {
    dailyTrend: IDailyTrendRow[];
    isLoading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    isLoading: false,
});

const container = ref<HTMLDivElement | null>(null);
let cleanup: (() => void) | null = null;
let resizeObserver: ResizeObserver | null = null;
let renderId = 0;

const METRICS = ['spend', 'impressions', 'clicks', 'conversions', 'revenue'] as const;

const METRIC_COLORS: Record<string, string> = {
    spend: '#6366f1',
    impressions: '#8b5cf6',
    clicks: '#3b82f6',
    conversions: '#10b981',
    revenue: '#f59e0b',
};

const METRIC_LABELS: Record<string, string> = {
    spend: 'Spend',
    impressions: 'Impressions',
    clicks: 'Clicks',
    conversions: 'Conversions',
    revenue: 'Revenue',
};

function fmt(val: number, metric: string): string {
    if (metric === 'spend' || metric === 'revenue') {
        return `$${val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    }
    return val.toLocaleString('en-US');
}

function fmtDate(s: string): string {
    const d = new Date(s);
    return `${d.getMonth() + 1}/${d.getDate()}`;
}

const visibleMetrics = ref<Set<string>>(new Set(METRICS));

function toggleMetric(metric: string) {
    const next = new Set(visibleMetrics.value);
    if (next.has(metric)) {
        if (next.size > 1) next.delete(metric);
    } else {
        next.add(metric);
    }
    visibleMetrics.value = next;
}

async function render() {
    if (!import.meta.client || !container.value || !props.dailyTrend || props.dailyTrend.length < 2) return;

    const myRenderId = ++renderId;
    cleanup?.();
    cleanup = null;
    container.value.innerHTML = '';

    const d3 = await import('d3');
    if (myRenderId !== renderId || !container.value) return;

    const data = props.dailyTrend;
    const w = container.value.clientWidth || 600;
    const h = 280;
    const margin = { top: 16, right: 16, bottom: 28, left: 64 };
    const innerW = w - margin.left - margin.right;
    const innerH = h - margin.top - margin.bottom;

    const allVals = data.flatMap(row =>
        METRICS.filter(m => visibleMetrics.value.has(m)).map(m => Number((row as any)[m]) || 0)
    );
    const yMax = Math.max(...allVals, 1);

    const xScale = d3.scaleLinear().domain([0, data.length - 1]).range([0, innerW]);
    const yScale = d3.scaleLinear().domain([0, yMax * 1.1]).range([innerH, 0]);

    const svg = d3.select(container.value)
        .append('svg')
        .attr('width', w).attr('height', h)
        .attr('viewBox', `0 0 ${w} ${h}`)
        .style('overflow', 'visible');

    const chart = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Horizontal grid
    chart.selectAll('line.grid').data(yScale.ticks(5)).join('line')
        .attr('x1', 0).attr('x2', innerW)
        .attr('y1', d => yScale(d)).attr('y2', d => yScale(d))
        .attr('stroke', '#e5e7eb').attr('stroke-width', 1);

    // Y-axis labels
    chart.selectAll('text.yl').data(yScale.ticks(5)).join('text')
        .attr('x', -8).attr('y', d => yScale(d))
        .attr('text-anchor', 'end').attr('dominant-baseline', 'middle')
        .attr('fill', '#9ca3af').attr('font-size', '10px')
        .text(d => {
            if (d >= 1_000_000) return `${(d / 1_000_000).toFixed(1)}M`;
            if (d >= 1_000) return `${(d / 1_000).toFixed(0)}K`;
            return d % 1 === 0 ? d.toLocaleString() : d.toFixed(2);
        });

    // X-axis labels
    const step = Math.max(1, Math.floor(data.length / 7));
    chart.selectAll('text.xl').data(data.filter((_, i) => i % step === 0)).join('text')
        .attr('x', (_d: IDailyTrendRow, i: number) => xScale(i * step))
        .attr('y', innerH + 18)
        .attr('text-anchor', 'middle')
        .attr('fill', '#9ca3af').attr('font-size', '10px')
        .text((d: IDailyTrendRow) => fmtDate(d.date));

    // Lines — one per visible metric
    for (const metric of METRICS) {
        if (!visibleMetrics.value.has(metric)) continue;
        const line = d3.line<IDailyTrendRow>()
            .x((_d, i) => xScale(i))
            .y(d => yScale(Number((d as any)[metric]) || 0))
            .curve(d3.curveMonotoneX);

        chart.append('path').datum(data)
            .attr('fill', 'none')
            .attr('stroke', METRIC_COLORS[metric])
            .attr('stroke-width', 2)
            .attr('stroke-linecap', 'round')
            .attr('stroke-linejoin', 'round')
            .attr('d', line);
    }

    // Tooltip
    const tooltip = chart.append('g').style('display', 'none');
    const tLine = tooltip.append('line')
        .attr('y1', 0).attr('y2', innerH)
        .attr('stroke', '#9ca3af').attr('stroke-width', 1).attr('stroke-dasharray', '3,3');

    const tBox = tooltip.append('g');
    const tBg = tBox.append('rect').attr('fill', '#1f2937').attr('rx', 6).attr('ry', 6);
    const tTexts: Record<string, any> = {};

    for (const metric of METRICS) {
        if (!visibleMetrics.value.has(metric)) continue;
        const g = tBox.append('g');
        g.append('circle').attr('r', 3).attr('fill', METRIC_COLORS[metric]);
        g.append('text').attr('fill', '#e5e7eb').attr('font-size', '10px').attr('x', 10);
        tTexts[metric] = g;
    }

    chart.append('rect')
        .attr('width', innerW).attr('height', innerH).attr('fill', 'none').attr('pointer-events', 'all')
        .on('mouseenter', () => tooltip.style('display', null))
        .on('mouseleave', () => tooltip.style('display', 'none'))
        .on('mousemove', (event: any) => {
            const [mx] = d3.pointer(event, chart.node());
            const idx = Math.max(0, Math.min(data.length - 1, Math.round(xScale.invert(mx))));
            tLine.attr('transform', `translate(${xScale(idx)},0)`);

            const tw = 140, rh = 18, hh = 16, vc = visibleMetrics.value.size, bh = hh + vc * rh + 8;
            let tx = xScale(idx) + 12, ty = -8;
            if (tx + tw > innerW) tx = xScale(idx) - tw - 12;

            tBox.attr('transform', `translate(${tx},${ty})`);
            tBg.attr('width', tw).attr('height', bh);

            tBox.selectAll('.th').remove();
            tBox.append('text').attr('class', 'th')
                .attr('x', 8).attr('y', 14)
                .attr('fill', '#d1d5db').attr('font-size', '10px').attr('font-weight', 'bold')
                .text(fmtDate(data[idx].date));

            let ri = 0;
            for (const metric of METRICS) {
                if (!visibleMetrics.value.has(metric)) continue;
                const v = Number((data[idx] as any)[metric]) || 0;
                tTexts[metric].attr('transform', `translate(8,${hh + 4 + ri * rh})`);
                tTexts[metric].select('text').text(`${METRIC_LABELS[metric]}: ${fmt(v, metric)}`);
                ri++;
            }
        });

    cleanup = () => svg.remove();
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
    () => [props.dailyTrend, [...visibleMetrics.value]],
    () => { if (import.meta.client) render(); },
    { deep: true },
);

onBeforeUnmount(() => {
    resizeObserver?.disconnect();
    cleanup?.();
});
</script>

<template>
    <div class="bg-white rounded-xl border border-gray-200 p-5">
        <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-semibold text-gray-800">Daily Trend</h3>
            <div class="flex flex-wrap gap-3">
                <button
                    v-for="metric in METRICS"
                    :key="metric"
                    class="flex items-center gap-1.5 text-[11px] font-medium transition-opacity cursor-pointer"
                    :class="visibleMetrics.has(metric) ? 'opacity-100' : 'opacity-40'"
                    @click="toggleMetric(metric)"
                >
                    <span class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: METRIC_COLORS[metric] }" />
                    {{ METRIC_LABELS[metric] }}
                </button>
            </div>
        </div>

        <div v-if="isLoading" class="h-[280px] flex items-center justify-center">
            <div class="h-8 w-8 border-2 border-gray-200 border-t-indigo-500 rounded-full animate-spin" />
        </div>
        <div v-else-if="!dailyTrend.length" class="h-[280px] flex items-center justify-center">
            <p class="text-sm text-gray-400">No trend data available</p>
        </div>
        <div v-else ref="container" class="w-full overflow-hidden cursor-crosshair" />
    </div>
</template>
