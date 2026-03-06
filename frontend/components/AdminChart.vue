<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import type { ITimeSeriesPoint } from '~/types/admin/stats';

const props = defineProps<{
    type: 'line' | 'bar' | 'donut';
    data: ITimeSeriesPoint[] | { label: string; value: number }[];
    height?: number;
    color?: string;
}>();

const container = ref<HTMLDivElement | null>(null);
let cleanup: (() => void) | null = null;

async function renderChart() {
    if (!import.meta.client || !container.value || !props.data?.length) return;

    cleanup?.();
    cleanup = null;
    container.value.innerHTML = '';

    const d3 = await import('d3');
    const w = container.value.clientWidth || 400;
    const h = props.height || 180;
    const margin = { top: 12, right: 12, bottom: 32, left: 40 };
    const innerW = w - margin.left - margin.right;
    const innerH = h - margin.top - margin.bottom;
    const color = props.color || '#3b82f6';

    const svg = d3
        .select(container.value)
        .append('svg')
        .attr('width', w)
        .attr('height', h);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    if (props.type === 'donut') {
        const donutData = props.data as { label: string; value: number }[];
        const donutColors = d3.schemeTableau10;
        const radius = Math.min(innerW, innerH) / 2;
        const arc = d3.arc<d3.PieArcDatum<{ label: string; value: number }>>()
            .innerRadius(radius * 0.55)
            .outerRadius(radius);
        const pie = d3.pie<{ label: string; value: number }>().value((d) => d.value);
        const arcs = pie(donutData);

        const donutG = svg
            .append('g')
            .attr('transform', `translate(${w / 2},${h / 2})`);

        donutG
            .selectAll('path')
            .data(arcs)
            .join('path')
            .attr('d', arc as any)
            .attr('fill', (_d: any, i: number) => donutColors[i % donutColors.length])
            .attr('stroke', '#fff')
            .attr('stroke-width', 2);

        // Center label: total
        const total = d3.sum(donutData, (d) => d.value);
        donutG.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', '0.35em')
            .attr('font-size', '16px')
            .attr('font-weight', '700')
            .attr('fill', '#111827')
            .text(String(total));

        return;
    }

    // Time-series bar / line
    const tsData = props.data as ITimeSeriesPoint[];
    const x = d3
        .scaleBand()
        .domain(tsData.map((d) => d.date))
        .range([0, innerW])
        .padding(0.2);

    const yMax = d3.max(tsData, (d) => d.count) || 1;
    const y = d3.scaleLinear().domain([0, yMax * 1.1]).range([innerH, 0]).nice();

    // X axis — show ~5 ticks
    const step = Math.max(1, Math.floor(tsData.length / 5));
    g.append('g')
        .attr('transform', `translate(0,${innerH})`)
        .call(
            d3.axisBottom(x)
                .tickValues(tsData.filter((_d, i) => i % step === 0).map((d) => d.date))
                .tickFormat((v) => {
                    const parts = String(v).split('-');
                    return parts.length >= 3 ? `${parts[1]}/${parts[2]}` : String(v);
                })
        )
        .call((ax) => ax.select('.domain').attr('stroke', '#e5e7eb'))
        .call((ax) => ax.selectAll('text').attr('font-size', '10px').attr('fill', '#6b7280'));

    // Y axis
    g.append('g')
        .call(d3.axisLeft(y).ticks(4).tickFormat(d3.format('~s')))
        .call((ax) => ax.select('.domain').remove())
        .call((ax) => ax.selectAll('.tick line').attr('stroke', '#f3f4f6').attr('x2', innerW))
        .call((ax) => ax.selectAll('text').attr('font-size', '10px').attr('fill', '#6b7280'));

    if (props.type === 'bar') {
        g.selectAll('rect')
            .data(tsData)
            .join('rect')
            .attr('x', (d) => x(d.date) ?? 0)
            .attr('y', (d) => y(d.count))
            .attr('width', x.bandwidth())
            .attr('height', (d) => innerH - y(d.count))
            .attr('fill', color)
            .attr('rx', 2);
    } else {
        // Line
        const line = d3
            .line<ITimeSeriesPoint>()
            .x((d) => (x(d.date) ?? 0) + x.bandwidth() / 2)
            .y((d) => y(d.count))
            .curve(d3.curveMonotoneX);

        g.append('path')
            .datum(tsData)
            .attr('fill', 'none')
            .attr('stroke', color)
            .attr('stroke-width', 2)
            .attr('d', line);

        // Dots
        g.selectAll('circle')
            .data(tsData)
            .join('circle')
            .attr('cx', (d) => (x(d.date) ?? 0) + x.bandwidth() / 2)
            .attr('cy', (d) => y(d.count))
            .attr('r', 3)
            .attr('fill', color);
    }

    cleanup = () => {
        svg.remove();
    };
}

onMounted(() => {
    if (import.meta.client) renderChart();
});

watch(() => props.data, () => {
    if (import.meta.client) renderChart();
}, { deep: true });

onBeforeUnmount(() => {
    cleanup?.();
});
</script>

<template>
    <div ref="container" class="w-full overflow-hidden" :style="{ minHeight: `${height || 180}px` }" />
</template>
