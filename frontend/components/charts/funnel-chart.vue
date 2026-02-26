<script setup>
import { onMounted, watch, nextTick, onBeforeUnmount } from 'vue';
const { $d3 } = useNuxtApp();
const emit = defineEmits(['update:yAxisLabel', 'update:xAxisLabel']);

const state = reactive({
    xAxisLabelLocal: '',
    yAxisLabelLocal: '',
});

const props = defineProps({
    chartId: {
        type: String,
        required: true,
    },
    data: {
        type: Array,
        required: true,
    },
    width: {
        type: Number,
        default: 600,
    },
    height: {
        type: Number,
        default: 400,
    },
    xAxisLabel: {
        type: String,
        default: '',
    },
    yAxisLabel: {
        type: String,
        default: '',
    },
    columnName: {
        type: String,
        default: 'Value',
    },
    categoryColumn: {
        type: String,
        default: 'category',
    },
    enableTooltips: {
        type: Boolean,
        default: true,
    },
    editableAxisLabels: {
        type: Boolean,
        default: true,
    },
});

let tooltipElement = null;

watch(() => props.data, () => {
    nextTick(() => renderChart(props.data));
});

function deleteSVGs() {
    $d3.select(`#funnel-chart-${props.chartId}`).selectAll('svg').remove();
    if (tooltipElement) {
        tooltipElement.remove();
        tooltipElement = null;
    }
    $d3.selectAll(`.funnel-chart-tooltip-${props.chartId}`).remove();
}

function renderSVG(chartData) {
    if (!chartData || chartData.length === 0) return null;

    // Filter out rows with no valid numeric value
    const validData = chartData.filter(d => d.label != null && !isNaN(parseFloat(d.value)));
    if (validData.length === 0) return null;

    const margin = { top: 30, right: 40, bottom: 50, left: 40 };
    const svgWidth  = props.width  - margin.left - margin.right;
    const svgHeight = props.height - margin.top  - margin.bottom;

    const maxValue     = validData[0].value; // first stage is always the widest
    const stageCount   = validData.length;
    const gapH         = 6;  // vertical gap between stages (for drop-off label)
    const stageH       = Math.max(30, (svgHeight - gapH * (stageCount - 1)) / stageCount);
    const totalH       = stageH * stageCount + gapH * (stageCount - 1);

    // Colour scale – blues palette matching app primary palette
    const color = $d3.scaleSequential($d3.interpolateBlues)
        .domain([stageCount - 1, -0.5]); // reversed so first stage is darkest

    const svg = $d3.select(`#funnel-chart-${props.chartId}`)
        .append('svg')
        .attr('width',  svgWidth  + margin.left + margin.right)
        .attr('height', totalH    + margin.top  + margin.bottom)
        .attr('style', 'max-width: 100%; height: auto;')
        .append('g')
        .attr('transform', `translate(${margin.left + svgWidth / 2},${margin.top})`);

    // Tooltip
    const tooltip = $d3.select('.dashboard-tooltip-container')
        .append('div')
        .attr('class', `funnel-chart-tooltip funnel-chart-tooltip-${props.chartId}`)
        .style('position',       'absolute')
        .style('background',     'rgba(0,0,0,0.9)')
        .style('color',          'white')
        .style('padding',        '12px 16px')
        .style('border-radius',  '6px')
        .style('font-size',      '14px')
        .style('pointer-events', 'none')
        .style('z-index',        '10000')
        .style('opacity',        0)
        .style('box-shadow',     '0 4px 6px rgba(0,0,0,0.3)')
        .style('line-height',    '1.5');

    tooltipElement = tooltip;

    // Helper: trapezoid path centred at x=0
    // topW and botW are half-widths
    function trapezoidPath(topW, botW, h) {
        return [
            `M ${-topW} 0`,
            `L ${topW} 0`,
            `L ${botW} ${h}`,
            `L ${-botW} ${h}`,
            'Z',
        ].join(' ');
    }

    validData.forEach((d, i) => {
        const topHalfW = (d.value / maxValue) * (svgWidth / 2);
        const nextValue = validData[i + 1]?.value ?? 0;
        const botHalfW = (nextValue / maxValue) * (svgWidth / 2);
        const yTop = i * (stageH + gapH);

        // Stage trapezoid
        const stagePct = maxValue > 0 ? (d.value / maxValue * 100).toFixed(1) : '0.0';

        const path = svg.append('path')
            .attr('d', trapezoidPath(topHalfW, botHalfW, stageH))
            .attr('transform', `translate(0, ${yTop})`)
            .attr('fill', color(i))
            .attr('stroke', 'white')
            .attr('stroke-width', 1.5)
            .style('cursor', 'pointer')
            .style('transition', 'filter 0.15s ease');

        if (props.enableTooltips) {
            path
                .on('mouseover', function (event) {
                    $d3.select(this).style('filter', 'brightness(1.12)');
                    tooltip
                        .html(`
                            <div style="font-weight:bold;margin-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.3);padding-bottom:6px;">${d.label}</div>
                            <div style="margin-bottom:4px;"><span style="color:#94a3b8;">${props.columnName}:</span> <span style="font-weight:600;">${Number(d.value).toLocaleString('en-US')}</span></div>
                            <div><span style="color:#94a3b8;">% of top:</span> <span style="font-weight:600;">${stagePct}%</span></div>
                        `)
                        .style('left', (event.clientX + 15) + 'px')
                        .style('top',  (event.clientY - 10) + 'px')
                        .style('opacity', 1);
                })
                .on('mousemove', function (event) {
                    tooltip
                        .style('left', (event.clientX + 15) + 'px')
                        .style('top',  (event.clientY - 10) + 'px');
                })
                .on('mouseout', function () {
                    $d3.select(this).style('filter', 'none');
                    tooltip.style('opacity', 0);
                });
        }

        // Stage label (centred) — show when wide enough
        const labelFontSize = Math.min(14, Math.max(9, stageH * 0.32));
        const midHalfW = (topHalfW + botHalfW) / 2;

        if (midHalfW > 35) {
            svg.append('text')
                .attr('x', 0)
                .attr('y', yTop + stageH / 2 - labelFontSize * 0.5)
                .attr('text-anchor', 'middle')
                .attr('dominant-baseline', 'middle')
                .attr('font-size', labelFontSize)
                .attr('font-weight', '600')
                .attr('fill', 'white')
                .attr('pointer-events', 'none')
                .text(d.label);

            svg.append('text')
                .attr('x', 0)
                .attr('y', yTop + stageH / 2 + labelFontSize)
                .attr('text-anchor', 'middle')
                .attr('dominant-baseline', 'middle')
                .attr('font-size', labelFontSize * 0.85)
                .attr('fill', 'rgba(255,255,255,0.88)')
                .attr('pointer-events', 'none')
                .text(Number(d.value).toLocaleString('en-US'));
        } else {
            // Side label when trapezoid is too narrow
            svg.append('text')
                .attr('x', topHalfW + 6)
                .attr('y', yTop + stageH / 2)
                .attr('text-anchor', 'start')
                .attr('dominant-baseline', 'middle')
                .attr('font-size', labelFontSize)
                .attr('fill', '#374151')
                .attr('pointer-events', 'none')
                .text(`${d.label}: ${Number(d.value).toLocaleString('en-US')}`);
        }

        // Drop-off annotation between stages
        if (i < stageCount - 1 && maxValue > 0) {
            const dropPct = (((d.value - nextValue) / d.value) * 100).toFixed(1);
            const gapY = yTop + stageH + gapH / 2;

            svg.append('text')
                .attr('x', 0)
                .attr('y', gapY)
                .attr('text-anchor', 'middle')
                .attr('dominant-baseline', 'middle')
                .attr('font-size', 10)
                .attr('fill', '#6b7280')
                .attr('pointer-events', 'none')
                .text(`▼ −${dropPct}% drop-off`);
        }
    });

    // X-axis label (stage axis)
    if (props.xAxisLabel) {
        svg.append('text')
            .attr('x', 0)
            .attr('y', totalH + 36)
            .attr('text-anchor', 'middle')
            .attr('font-size', 13)
            .attr('fill', '#6b7280')
            .text(props.xAxisLabel);
    }

    return svg;
}

function renderChart(chartData) {
    deleteSVGs();
    renderSVG(chartData);
}

onMounted(() => {
    renderChart(props.data);
});

onBeforeUnmount(() => {
    deleteSVGs();
});
</script>

<template>
    <div>
        <div :id="`funnel-chart-${props.chartId}`"></div>
    </div>
</template>
