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
    // Expected format: [{ label: 'Category', values: [{ key: 'Series1', value: 10 }, { key: 'Series2', value: 20 }] }]
  },
  stackKeys: {
    type: Array,
    required: true,
    // Series names for the stack layers
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
  colorScheme: {
    type: Array,
    default: () => [],
  },
  showLegend: {
    type: Boolean,
    default: true,
  },
});

function deleteSVGs() {
  $d3.select(`#stacked-bar-chart-${props.chartId}`).selectAll('svg').remove();
}

function processData(rawData) {
  // Transform data into D3 stack format
  const processedData = rawData.map(d => {
    const item = { label: d.label };
    d.values.forEach(v => {
      item[v.key] = v.value;
    });
    return item;
  });
  return processedData;
}

function renderSVG(chartData) {
  const margin = { top: 100, right: props.showLegend ? 150 : 30, bottom: 80, left: 60 };
  const svgWidth = props.width;
  const svgHeight = props.height;
  const width = svgWidth - margin.left - margin.right + 50;
  const height = svgHeight - margin.top - margin.bottom + 30;
  
  // Process data for stacking
  const processedData = processData(chartData);
  // Create color scale
  const color = props.colorScheme.length > 0 
    ? $d3.scaleOrdinal(props.stackKeys, props.colorScheme)
    : $d3.scaleOrdinal(props.stackKeys, $d3.schemeCategory10);

  // Create stack generator
  const stack = $d3.stack()
    .keys(props.stackKeys);
  
  const stackedData = stack(processedData);

  const svg = $d3.select(`#stacked-bar-chart-${props.chartId}`)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr("viewBox", [0, 0, width, height + 80])
    .attr("style", "max-width: 100%; height: auto;")
    .attr('transform', `translate(${margin.left - 40}, ${margin.top - 30})`);


  // X axis
  const x = $d3.scaleBand()
    .domain(processedData.map(d => d.label))
    .range([0, width])
    .padding(0.2);
  
  svg.append('g')
    .attr('transform', `translate(0,${height})`)
    .call($d3.axisBottom(x))
    .selectAll('text')
    .attr('transform', 'rotate(0)')
    .style('text-anchor', 'middle')
    .style('font-size', '12px')
    .style('fill', '#475569')
    .style('font-weight', 'bold');

  // Calculate max value for Y axis (sum of stacked values)
  const maxValue = $d3.max(processedData, d => 
    props.stackKeys.reduce((sum, key) => sum + (d[key] || 0), 0)
  );

  // Y axis
  const y = $d3.scaleLinear()
    .domain([0, maxValue + 80 || 1])
    .range([height, 0]);
  
  svg.append('g')
    .call($d3.axisLeft(y))
    .selectAll('text')
    .style('text-anchor', 'end')
    .style('font-size', '12px')
    .style('fill', 'black')
    .style('font-weight', 'bold');
    
  // Set y-axis tick lines to black
  svg.selectAll('.tick line')
    .style('stroke', 'black');
  // Set y-axis domain line to black
  svg.selectAll('.domain')
    .style('stroke', 'black');

  // Create stacked bars
  const stackGroups = svg.selectAll('.stack-group')
    .data(stackedData)
    .join('g')
    .attr('class', 'stack-group')
    .attr('fill', d => color(d.key));

  stackGroups.selectAll('rect')
    .data(d => d)
    .join('rect')
    .attr('x', d => x(d.data.label))
    .attr('y', d => y(d[1]))
    .attr('height', d => y(d[0]) - y(d[1]))
    .attr('width', x.bandwidth())
    .on('mouseover', function (event, d) {
      // Get the stack key from parent group
      const stackKey = $d3.select(this.parentNode).datum().key;
      const value = d.data[stackKey];
      const total = props.stackKeys.reduce((sum, key) => sum + (d.data[key] || 0), 0);
      
      // Create tooltip
      const tooltip = $d3.select('body').append('div')
        .attr('class', 'chart-tooltip')
        .style('position', 'absolute')
        .style('background', 'rgba(0,0,0,0.8)')
        .style('color', 'white')
        .style('padding', '8px')
        .style('border-radius', '4px')
        .style('font-size', '12px')
        .style('pointer-events', 'none')
        .html(`
          <div><strong>${d.data.label}</strong></div>
          <div>${stackKey}: ${value}</div>
          <div>Total: ${total}</div>
        `);

      tooltip
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 10) + 'px');

      $d3.select(this).style('opacity', 0.7);
    })
    .on('mouseout', function () {
      $d3.selectAll('.chart-tooltip').remove();
      $d3.select(this).style('opacity', 1);
    });

  // Legend
  if (props.showLegend) {
    const legend = svg.selectAll('.legend')
      .data(props.stackKeys)
      .join('g')
      .attr('class', 'legend')
      .attr('transform', (d, i) => `translate(${i * 100 + width / 4}, 0)`);

    legend.append('rect')
      .attr('x', 0)
      .attr('width', 15)
      .attr('height', 15)
      .attr('fill', color);

    legend.append('text')
      .attr('x', 20)
      .attr('y', 9)
      .attr('dy', '0.35em')
      .style('font-size', '12px')
      .style('fill', '#475569')
      .text(d => d);
  }

  // Y axis title as input
  svg.append('foreignObject')
    .attr('transform', 'rotate(-90)')
    .attr('y', 0 - margin.left - 10)
    .attr('x', 0 - (height / 2) - 80)
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
    .attr('y', height + margin.top - 80)
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

watch(() => [props.data, props.width, props.height, props.stackKeys, props.colorScheme, props.showLegend], () => {
  nextTick(() => renderChart(props.data));
});
</script>

<template>
  <div>
    <div :id="`stacked-bar-chart-${props.chartId}`"></div>
  </div>
</template>

<style scoped>
.chart-tooltip {
  z-index: 1000;
}
</style>
