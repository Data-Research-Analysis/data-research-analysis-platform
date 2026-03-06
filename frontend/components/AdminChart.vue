<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import type { ITimeSeriesPoint } from '~/types/admin/stats';

const props = defineProps<{
    type: 'line' | 'bar' | 'donut';
    data: ITimeSeriesPoint[] | { label: string; value: number }[];
    height?: number;
    color?: string;
    context?: string;
}>();

const container = ref<HTMLDivElement | null>(null);
const tooltipVisible = ref(false);
const tooltipContent = ref('');
const tooltipX = ref(0);
const tooltipY = ref(0);
const legendItems = ref<{ label: string; color: string }[]>([]);
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

        const total = d3.sum(donutData, (d) => d.value);

        donutG
            .selectAll('path')
            .data(arcs)
            .join('path')
            .attr('d', arc as any)
            .attr('fill', (_d: any, i: number) => donutColors[i % donutColors.length])
            .attr('stroke', '#fff')
            .attr('stroke-width', 2)
            .style('cursor', 'pointer')
            .on('mouseenter', (event: MouseEvent, d: any) => {
                const percentage = ((d.data.value / total) * 100).toFixed(1);
                tooltipContent.value = `${d.data.label}: ${d.data.value} (${percentage}%)`;
                tooltipVisible.value = true;
                
                const rect = container.value!.getBoundingClientRect();
                tooltipX.value = event.clientX - rect.left;
                tooltipY.value = event.clientY - rect.top;
                
                d3.select(event.target as SVGPathElement)
                    .transition().duration(100)
                    .attr('opacity', 0.8);
            })
            .on('mousemove', (event: MouseEvent) => {
                const rect = container.value!.getBoundingClientRect();
                tooltipX.value = event.clientX - rect.left;
                tooltipY.value = event.clientY - rect.top;
            })
            .on('mouseleave', (event: MouseEvent) => {
                tooltipVisible.value = false;
                d3.select(event.target as SVGPathElement)
                    .transition().duration(100)
                    .attr('opacity', 1);
            });

        // Center label: total
        donutG.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', '0.35em')
            .attr('font-size', '16px')
            .attr('font-weight', '700')
            .attr('fill', '#111827')
            .text(String(total));

        // Generate legend data
        legendItems.value = donutData.map((d, i) => ({
            label: d.label,
            color: donutColors[i % donutColors.length]
        }));

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
            .attr('rx', 2)
            .style('cursor', 'pointer')
            .on('mouseenter', (event: MouseEvent, d: ITimeSeriesPoint) => {
                const dateObj = new Date(d.date);
                const formattedDate = dateObj.toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });
                
                const contextLabel = props.context || 'items';
                tooltipContent.value = `${formattedDate}: ${d.count} ${contextLabel}`;
                tooltipVisible.value = true;
                
                const rect = container.value!.getBoundingClientRect();
                tooltipX.value = event.clientX - rect.left;
                tooltipY.value = event.clientY - rect.top;
                
                d3.select(event.target as SVGRectElement)
                    .transition().duration(100)
                    .attr('opacity', 0.7);
            })
            .on('mousemove', (event: MouseEvent) => {
                const rect = container.value!.getBoundingClientRect();
                tooltipX.value = event.clientX - rect.left;
                tooltipY.value = event.clientY - rect.top;
            })
            .on('mouseleave', (event: MouseEvent) => {
                tooltipVisible.value = false;
                d3.select(event.target as SVGRectElement)
                    .transition().duration(100)
                    .attr('opacity', 1);
            });
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
        tooltipVisible.value = false;
        legendItems.value = [];
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
    <div class="relative w-full">
        <div ref="container" class="w-full overflow-hidden" :style="{ minHeight: `${height || 180}px` }" />
        
        <!-- Tooltip overlay -->
        <div
            v-if="tooltipVisible"
            ref="tooltip"
            class="absolute pointer-events-none bg-gray-900 text-white text-xs rounded shadow-lg px-3 py-2 z-50 whitespace-nowrap"
            :style="{ left: `${tooltipX}px`, top: `${tooltipY}px`, transform: 'translate(-50%, -120%)' }"
        >
            {{ tooltipContent }}
        </div>

        <!-- Legend for donut charts -->
        <div v-if="type === 'donut' && legendItems.length" class="flex flex-wrap gap-x-4 gap-y-2 mt-4 justify-center">
            <div v-for="item in legendItems" :key="item.label" class="flex items-center gap-2">
                <div class="w-3 h-3 rounded" :style="{ backgroundColor: item.color }" />
                <span class="text-xs text-gray-600">{{ item.label }}</span>
            </div>
        </div>
    </div>
</template>
