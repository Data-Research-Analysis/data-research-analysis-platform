<script setup lang="ts">
/**
 * TrendSparkline — Mini D3.js sparkline for KPI cards.
 *
 * Renders a smooth area + line chart showing trend data over time.
 * Uses dynamic D3 import (same pattern as AdminChart.vue).
 */

import { ref, onMounted, onBeforeUnmount, watch } from 'vue';

interface Props {
    /** Array of numeric values to plot */
    data: number[];
    /** Stroke/fill color */
    color?: string;
    /** Chart height in px */
    height?: number;
}

const props = withDefaults(defineProps<Props>(), {
    color: '#3b82f6',
    height: 28,
});

const container = ref<HTMLDivElement | null>(null);
let cleanup: (() => void) | null = null;
let resizeObserver: ResizeObserver | null = null;
/** Monotonically increasing render ID to prevent concurrent renders from stacking */
let renderId = 0;

async function render() {
    if (!import.meta.client || !container.value || !props.data || props.data.length < 2) {
        return;
    }

    // Increment render ID and capture for this invocation.
    // If another render() starts before this async one finishes,
    // the stale invocation will bail out.
    const myRenderId = ++renderId;

    cleanup?.();
    cleanup = null;
    container.value.innerHTML = '';

    const d3 = await import('d3');

    // Bail if a newer render was triggered while we were loading d3
    if (myRenderId !== renderId || !container.value) return;

    // Use the container's actual width to stay within card bounds
    const w = container.value.clientWidth || 80;
    const h = props.height;
    const padding = 2;

    const svg = d3
        .select(container.value)
        .append('svg')
        .attr('width', w)
        .attr('height', h)
        .attr('viewBox', `0 0 ${w} ${h}`)
        .style('overflow', 'hidden');

    // Scales
    const xScale = d3
        .scaleLinear()
        .domain([0, props.data.length - 1])
        .range([padding, w - padding]);

    const yExtent = d3.extent(props.data) as [number, number];
    const yScale = d3
        .scaleLinear()
        .domain([yExtent[0] * 0.9, yExtent[1] * 1.1])
        .range([h - padding, padding]);

    // Area generator
    const area = d3.area<number>()
        .x((_d, i) => xScale(i))
        .y0(h)
        .y1((d) => yScale(d))
        .curve(d3.curveMonotoneX);

    // Line generator
    const line = d3.line<number>()
        .x((_d, i) => xScale(i))
        .y((d) => yScale(d))
        .curve(d3.curveMonotoneX);

    // Gradient definition
    const gradientId = `sparkline-grad-${Math.random().toString(36).substring(2, 9)}`;
    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
        .attr('id', gradientId)
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', '0%')
        .attr('y2', '100%');

    gradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', props.color)
        .attr('stop-opacity', 0.3);

    gradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', props.color)
        .attr('stop-opacity', 0.02);

    // Render area fill
    svg.append('path')
        .datum(props.data)
        .attr('fill', `url(#${gradientId})`)
        .attr('d', area);

    // Render line
    svg.append('path')
        .datum(props.data)
        .attr('fill', 'none')
        .attr('stroke', props.color)
        .attr('stroke-width', 1.5)
        .attr('stroke-linecap', 'round')
        .attr('stroke-linejoin', 'round')
        .attr('d', line);

    // End dot (latest value)
    const lastIdx = props.data.length - 1;
    svg.append('circle')
        .attr('cx', xScale(lastIdx))
        .attr('cy', yScale(props.data[lastIdx]))
        .attr('r', 2)
        .attr('fill', props.color);

    cleanup = () => {
        svg.remove();
    };
}

onMounted(() => {
    if (import.meta.client) {
        render();
        // Re-render on container resize to stay within card bounds
        if (container.value) {
            resizeObserver = new ResizeObserver(() => {
                render();
            });
            resizeObserver.observe(container.value);
        }
    }
});

watch(
    () => props.data,
    () => {
        if (import.meta.client) render();
    },
    { deep: true }
);

onBeforeUnmount(() => {
    resizeObserver?.disconnect();
    cleanup?.();
});
</script>

<template>
    <div
        ref="container"
        class="w-full"
        :style="{ height: `${height}px` }"
    />
</template>