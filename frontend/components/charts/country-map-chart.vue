<script setup lang="ts">
import { onMounted, onBeforeUnmount, watch } from 'vue';
import * as d3 from 'd3';
import { feature } from 'topojson-client';
import worldTopo from 'world-atlas/countries-50m.json';

const emit = defineEmits<{ 'segment-click': [chartId: any, column: any, value: any] }>();

interface Props {
    chartId: string
    data: Array<{ category: string; value: number }>
    width?: number
    height?: number
    valueColumn?: string
    categoryColumn?: string
    selectedValue?: string | null
    filterState?: any
}
const props = withDefaults(defineProps<Props>(), {
    width: 1200,
    height: 500,
    valueColumn: 'value',
    categoryColumn: 'category',
    selectedValue: null,
    filterState: () => ({ activeFilter: null, isFiltering: false }),
});

let tooltipElement: any = null;
let dataMapRef: Map<string, number> = new Map();

// Normalize country names between GA4 and Natural Earth (world-atlas).
const NAME_ALIASES: Record<string, string> = {
    'united states': 'united states of america',
    'usa': 'united states of america',
    'us': 'united states of america',
    'republic of korea': 'south korea',
    'north korea': 'democratic people\'s republic of korea',
    'russia': 'russia',
    'czech republic': 'czechia',
    'czechia': 'czechia',
    'macedonia': 'north macedonia',
    'cabo verde': 'cape verde',
    'cape verde': 'cape verde',
    'ivory coast': "côte d'ivoire",
    "cote d'ivoire": "côte d'ivoire",
    'democratic republic of the congo': 'democratic republic of the congo',
    'dr congo': 'democratic republic of the congo',
    'congo': 'republic of the congo',
    'republic of the congo': 'republic of the congo',
    'republic of congo': 'republic of the congo',
    'tanzania': 'tanzania',
    'united republic of tanzania': 'tanzania',
    'vietnam': 'vietnam',
    'bolivia': 'bolivia',
    'brunei': 'brunei',
    'brunei darussalam': 'brunei',
    'myanmar': 'myanmar',
    'burma': 'myanmar',
    'syria': 'syria',
    'iran': 'iran',
    'laos': 'laos',
    'lao people\'s democratic republic': 'laos',
    'moldova': 'moldova',
    'turkey': 'turkey',
    'türkiye': 'turkey',
    'eswatini': 'eswatini',
    'swaziland': 'eswatini',
    'gambia': 'gambia',
    'the gambia': 'gambia',
    'bahamas': 'bahamas',
    'the bahamas': 'bahamas',
    'netherlands': 'netherlands',
    'holland': 'netherlands',
    'palestinian territories': 'palestine',
    'palestine': 'palestine',
    'west bank and gaza': 'palestine',
    'timor-leste': 'timor-leste',
    'east timor': 'timor-leste',
    'guinea-bissau': 'guinea-bissau',
    'falkland islands': 'falkland islands',
    'falkland islands (islas malvinas)': 'falkland islands',
    'bosnia and herzegovina': 'bosnia and herzegovina',
    'congo (kinshasa)': 'democratic republic of the congo',
    'congo (brazzaville)': 'republic of the congo',
    'central african republic': 'central african republic',
    'dominican republic': 'dominican republic',
    'sao tome and principe': 'sao tome and principe',
    'antigua and barbuda': 'antigua and barbuda',
    'st. vincent & grenadines': 'saint vincent and the grenadines',
    'st. lucia': 'saint lucia',
    'st. kitts & nevis': 'saint kitts and nevis',
    'trinidad & tobago': 'trinidad and tobago',
};

function normalizeName(raw: string): string {
    const key = String(raw || '').trim().toLowerCase();
    if (!key) return '';
    const alias = NAME_ALIASES[key];
    if (alias) return alias;
    return key;
}

function deleteSVGs() {
    d3.select(`#country-map-chart-${props.chartId}`).selectAll('svg').remove();
    if (tooltipElement) {
        tooltipElement.remove();
        tooltipElement = null;
    }
    d3.selectAll(`.country-map-tooltip-${props.chartId}`).remove();
}

function showTooltip(event: any, name: string) {
    if (!tooltipElement) return;
    const node = (tooltipElement.node() as HTMLElement | null)?.parentElement;
    const value = dataMapRef.get(normalizeName(name));
    const rect = node ? node.getBoundingClientRect() : { left: 0, top: 0, width: 0 };
    tooltipElement.transition().duration(120).style('opacity', 1);
    tooltipElement.html(`<div class="font-bold mb-1">${name}</div><div>${value === undefined ? 'No data' : `${value.toLocaleString('en-US')} sessions`}</div>`)
        .style('left', `${Math.min(event.clientX - rect.left + 15, Math.max(0, rect.width - 180))}px`)
        .style('top', `${event.clientY - rect.top - 20}px`);
}

function moveTooltip(event: any) {
    if (!tooltipElement) return;
    const node = (tooltipElement.node() as HTMLElement | null)?.parentElement;
    const rect = node ? node.getBoundingClientRect() : { left: 0, top: 0, width: 0 };
    tooltipElement.style('left', `${Math.min(event.clientX - rect.left + 15, Math.max(0, rect.width - 180))}px`)
        .style('top', `${event.clientY - rect.top - 20}px`);
}

function hideTooltip() {
    if (!tooltipElement) return;
    tooltipElement.transition().duration(200).style('opacity', 0);
}

function renderChart() {
    deleteSVGs();
    const container = d3.select(`#country-map-chart-${props.chartId}`);
    if (container.empty()) return;

    const countries = feature(worldTopo as any, (worldTopo as any).objects.countries).features as any[];
    const dataMap = new Map<string, number>();
    dataMapRef = dataMap;
    const catCol = props.categoryColumn as keyof typeof props.data[number];
    const valCol = props.valueColumn as keyof typeof props.data[number];
    for (const row of props.data) {
        const norm = normalizeName(String(row[catCol] || ''));
        if (!norm) continue;
        dataMap.set(norm, Number(row[valCol]) || 0);
    }

    const maxValue = Math.max(1, ...dataMap.values());
    const color = d3.scaleSequential(d3.interpolateBlues).domain([0, maxValue]);

    const width = props.width;
    const height = props.height;
    const projection = d3.geoNaturalEarth1().fitSize([width, height], { type: 'FeatureCollection', features: countries });
    const path = d3.geoPath(projection);

    const svg = container.append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('style', 'max-width: 100%; height: auto; touch-action: none;')
        .style('cursor', 'grab');

    // Zoom/pan layer — re-render paths under the current transform.
    const g = svg.append('g');

    const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([1, 24])
        .translateExtent([[0, 0], [width, height]])
        .on('zoom', (event: any) => {
            g.attr('transform', event.transform.toString());
        });

    svg.call(zoom as any)
        .on('dblclick.zoom', null)
        .on('touchstart.zoom', null)
        .on('touchmove.zoom', null)
        .on('touchend.zoom', null);

    const tooltip = container.append('div')
        .attr('class', `country-map-tooltip country-map-tooltip-${props.chartId}`)
        .style('position', 'absolute')
        .style('background', 'rgba(0, 0, 0, 0.9)')
        .style('color', 'white')
        .style('padding', '12px 16px')
        .style('border-radius', '6px')
        .style('font-size', '14px')
        .style('pointer-events', 'none')
        .style('z-index', '10000')
        .style('opacity', 0)
        .style('box-shadow', '0 4px 6px rgba(0, 0, 0, 0.3)')
        .style('line-height', '1.5');
    tooltipElement = tooltip;

    g.selectAll('path')
        .data(countries)
        .join('path')
        .attr('fill', (d: any) => {
            const value = dataMap.get(normalizeName(d.properties?.name));
            if (value === undefined) return '#e5e7eb';
            return color(value);
        })
        .attr('d', path)
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 0.5)
        .style('cursor', 'pointer')
        .style('opacity', (d: any) => {
            if (!props.selectedValue) return 1.0;
            const matches = String(d.properties?.name).toLowerCase() === String(props.selectedValue).toLowerCase();
            const alias = normalizeName(props.selectedValue as string);
            const matchesAlias = normalizeName(d.properties?.name) === alias;
            return matches || matchesAlias ? 1.0 : 0.25;
        })
        .on('mouseover', (event: any, d: any) => showTooltip(event, d.properties?.name))
        .on('mousemove', moveTooltip)
        .on('mouseout', hideTooltip)
        .on('click', (event: any, d: any) => {
            if (event.defaultPrevented) return;
            emit('segment-click', props.chartId, props.categoryColumn, d.properties?.name);
        });

    // Tiny countries (e.g. Singapore, Malta) render below one pixel at this
    // scale, so draw a dot at their centroid sized by sessions — like GA4.
    const dotThreshold = 4;
    const dotRadius = d3.scaleSqrt()
        .domain([0, maxValue])
        .range([2, 8]);

    g.selectAll('circle.country-dot')
        .data(countries)
        .join('circle')
        .attr('class', 'country-dot')
        .attr('transform', (d: any) => `translate(${path.centroid(d)})`)
        .attr('r', (d: any) => {
            const value = dataMap.get(normalizeName(d.properties?.name));
            if (value === undefined || path.area(d) >= dotThreshold) return 0;
            return dotRadius(value);
        })
        .attr('fill', (d: any) => {
            const value = dataMap.get(normalizeName(d.properties?.name));
            return value === undefined ? '#9ca3af' : color(value);
        })
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 1)
        .style('cursor', 'pointer')
        .style('opacity', (d: any) => {
            if (!props.selectedValue) return 1.0;
            const alias = normalizeName(props.selectedValue as string);
            return normalizeName(d.properties?.name) === alias ? 1.0 : 0.25;
        })
        .on('mouseover', (event: any, d: any) => showTooltip(event, d.properties?.name))
        .on('mousemove', moveTooltip)
        .on('mouseout', hideTooltip)
        .on('click', (event: any, d: any) => {
            if (event.defaultPrevented) return;
            emit('segment-click', props.chartId, props.categoryColumn, d.properties?.name);
        });
}

watch(() => props.data, () => { renderChart(); });
watch(() => props.selectedValue, () => { renderChart(); });

onMounted(() => { renderChart(); });
onBeforeUnmount(() => { deleteSVGs(); });
</script>

<template>
    <div :id="`country-map-chart-${chartId}`" class="w-full relative"></div>
</template>
