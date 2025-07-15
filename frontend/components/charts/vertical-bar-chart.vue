<script setup>
import { x } from 'happy-dom/lib/PropertySymbol.js';
import { onMounted, watch, nextTick } from 'vue';
const { $d3 } = useNuxtApp();
const emit = defineEmits(['update:yAxisLabel', 'update:xAxisLabel']);
const state = reactive({
  xAxisLabelLocal: '',
  yAxisLabelLocal: ''
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
    default: 800,
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
});

function deleteSVGs() {
  $d3.select(`#vertical-bar-chart-1-${props.chartId}`).selectAll('svg').remove();
}

function renderSVG(chartData) {
  const margin = { top: 40, right: 30, bottom: 60, left: 60 };
  const svgWidth = props.width;
  const svgHeight = props.height;
  const width = svgWidth - margin.left - margin.right + 50;
  const height = svgHeight - margin.top - margin.bottom;
  const color = $d3.scaleOrdinal(chartData.map((d) => d.label), $d3.schemeCategory10);

  const svg = $d3.select(`#vertical-bar-chart-1-${props.chartId}`)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    // .attr('max-width', '90%')
    // .append('g')
    .attr("viewBox", [0, 0, width, height + 50])
    .attr("style", "max-width: 100%; height: auto;")
    .attr('transform', `translate(${margin.left - 40}, ${margin.top})`);

  // X axis
  const x = $d3.scaleBand()
    .domain(chartData.map(d => d.label))
    .range([0, width])
    .padding(0.2);
  svg.append('g')
    .attr('transform', `translate(0,${height})`)
    .call($d3.axisBottom(x))
    .selectAll('text')
    .attr('transform', 'rotate(0)')
    .style('text-anchor', 'middle')
    .style('font-size', '12px')
    .style('fill', '#475569') // Darker gray for axis text
    .style('font-weight', 'bold');

  // Y axis
  const y = $d3.scaleLinear()
    .domain([0, $d3.max(chartData, d => d.value) || 1])
    .range([height, 0]);
  svg.append('g')
    .call($d3.axisLeft(y))
    .selectAll('text')
    .style('text-anchor', 'end')
    .style('font-size', '12px')
    .style('fill', 'black') // Black for axis text
    .style('font-weight', 'bold');
    
  // Set y-axis tick lines to black
  svg.selectAll('.tick line')
    .style('stroke', 'black');
  // Set y-axis domain line to black
  svg.selectAll('.domain')
    .style('stroke', 'black');

  // Bars
  svg.selectAll('rect')
    .data(chartData)
    .join('rect')
    .attr('x', d => x(d.label))
    .attr('y', d => y(d.value))
    .attr('width', x.bandwidth())
    .attr('height', d => !isNaN(height - y(d.value)) ?  height - y(d.value) : 0)
    .attr('fill', d => color(d.label));

  // Tooltips (optional)
    svg.selectAll('rect')
    .on('mouseover', function (event, d) {
      $d3.select(this).attr('fill', '#4682b4');
    })
    .on('mouseout', function (event, d) {
      $d3.select(this).attr('fill', color(d.label));
    });

  // Y axis title as input
    svg.append('foreignObject')
      .attr('transform', 'rotate(-90)')
      .attr('y', 0 - margin.left - 10)
      .attr('x', 0 - (height / 2) - 100)
      .attr('width', height - 100)
      .attr('height', 30)
      .append('xhtml:input')
        .attr('type', 'text')
        .style('width', '100%')
        .style('font-size', '20px')
        .style('font-weight', '600')
        .style('color', '#000000')
        .style('background-color', '#ffffff')
        .style('text-align', 'center')
        .property('value', state.yAxisLabelLocal)
        .on('input', function(event) {
          state.yAxisLabelLocal = event.target.value;
          emit('update:yAxisLabel', state.yAxisLabelLocal);
        });

    // X axis title as input
    svg.append('foreignObject')
      .attr('y', height + margin.top - 20)
      .attr('x', width / 2 - 110)
      .attr('width', 200)
      .attr('height', 30)
      .append('xhtml:input')
        .attr('type', 'text')
        .style('width', '100%')
        .style('font-size', '20px')
        .style('font-weight', '600')
        .style('color', '#000000')
        .style('background-color', '#ffffff')
        .style('text-align', 'center')
        .property('value', state.xAxisLabelLocal)
        .on('input', function(event) {
          state.xAxisLabelLocal = event.target.value;
          emit('update:xAxisLabel', state.xAxisLabelLocal);
        });

}

function renderChart(chartData) {
  deleteSVGs();
  renderSVG(chartData);
}

onMounted(() => {
  state.xAxisLabelLocal = props.xAxisLabel;
  state.yAxisLabelLocal = props.yAxisLabel;
  renderChart(props.data);
});

watch(() => [props.data, props.width, props.height], () => {
  nextTick(() => renderChart(props.data));
});
</script>
<template>
  <div>
    <div :id="`vertical-bar-chart-1-${props.chartId}`"></div>
  </div>
</template>
