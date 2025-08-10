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
  maxLegendWidth: {
    type: Number,
    default: 400,
  },
  legendItemSpacing: {
    type: Number,
    default: 25,
  },
  legendLineHeight: {
    type: Number,
    default: 25,
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
  const margin = { top: 60, right: 30, bottom: 100, left: 80 };
  
  // Calculate legend lines first to adjust margin
  let legendLines = 1;
  if (props.showLegend) {
    let currentX = 0;
    legendLines = 1;
    
    props.stackKeys.forEach((key) => {
      const estimatedTextWidth = key.length * 8 + 50; // Rough estimation
      if (currentX + estimatedTextWidth > props.maxLegendWidth && currentX > 0) {
        legendLines++;
        currentX = estimatedTextWidth;
      } else {
        currentX += estimatedTextWidth;
      }
    });
    
    // Adjust top margin based on legend lines
    margin.top = 60 + (legendLines - 1) * props.legendLineHeight;
  }

  // Ensure minimum margins for axis inputs
  margin.bottom = Math.max(margin.bottom, 100);
  margin.left = Math.max(margin.left, 80);

  const svgWidth = props.width;
  const svgHeight = props.height;
  const width = svgWidth - margin.left - margin.right;
  const height = svgHeight - margin.top - margin.bottom;
  
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
    .attr('width', svgWidth)
    .attr('height', svgHeight)
    .attr("viewBox", [0, 0, svgWidth, svgHeight])
    .attr("style", "max-width: 100%; height: auto;")
    .append('g')
    .attr('transform', `translate(${margin.left}, ${margin.top})`);


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
      console.log('mouseover');
      // Get the stack key from parent group
      const stackKey = $d3.select(this.parentNode).datum().key;
      const value = d.data[stackKey];
      const total = props.stackKeys.reduce((sum, key) => sum + (d.data[key] || 0), 0);
      console.log('total', total);
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

  // Legend with dynamic positioning and line wrapping
  if (props.showLegend) {
    let currentX = 0;
    let currentLine = 0;
    
    const legendContainer = svg.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${width / 4}, ${-margin.top + 20})`);

    props.stackKeys.forEach((key, i) => {
      // Create temporary text to measure width
      const tempText = svg.append('text')
        .text(key)
        .style('font-size', '12px')
        .style('opacity', 0);
      
      const textWidth = tempText.node().getComputedTextLength();
      tempText.remove();
      
      const itemWidth = textWidth + 20 + props.legendItemSpacing; // 20 for rectangle + spacing
      
      // Check if we need to wrap to next line
      if (currentX + itemWidth > props.maxLegendWidth && currentX > 0) {
        currentLine++;
        currentX = 0;
      }
      
      const legendItem = legendContainer.append('g')
        .attr('class', 'legend-item')
        .attr('transform', `translate(${currentX}, ${currentLine * props.legendLineHeight})`);

      legendItem.append('rect')
        .attr('width', 15)
        .attr('height', 15)
        .attr('fill', color(key));

      legendItem.append('text')
        .attr('x', 20)
        .attr('y', 12)
        .text(key)
        .style('font-size', '12px')
        .style('fill', 'black');
      
      currentX += itemWidth;
    });
  }

  // Y axis title as input with improved positioning
  const yInputWidth = Math.min(150, height * 0.4);
  const yInputHeight = 35;
  
  svg.append('foreignObject')
    .attr('x', -margin.left + 10)
    .attr('y', height / 2 - yInputHeight / 2)
    .attr('width', yInputHeight) // rotated, so height becomes width
    .attr('height', yInputWidth) // rotated, so width becomes height
    .append('xhtml:div')
      .style('width', '100%')
      .style('height', '100%')
      .style('display', 'flex')
      .style('align-items', 'center')
      .style('justify-content', 'center')
      .style('transform', 'rotate(-90deg)')
      .style('transform-origin', 'center')
      .append('xhtml:input')
        .attr('type', 'text')
        .style('width', `${yInputWidth - 20}px`)
        .style('height', `${yInputHeight - 10}px`)
        .style('font-size', '16px')
        .style('font-weight', '600')
        .style('color', '#000000')
        .style('background-color', 'rgba(255,255,255,0.9)')
        .style('border', '1px solid #ccc')
        .style('border-radius', '4px')
        .style('padding', '5px')
        .style('text-align', 'center')
        .property('value', state.yAxisLabelLocal)
        .on('input', function(event) {
          state.yAxisLabelLocal = event.target.value;
          emit('update:yAxisLabel', state.yAxisLabelLocal);
        });

  // X axis title as input with improved positioning
  const xInputWidth = Math.min(250, width * 0.5);
  const xInputHeight = 35;
  
  svg.append('foreignObject')
    .attr('x', width / 2 - xInputWidth / 2)
    .attr('y', height + margin.bottom / 2 - xInputHeight / 2)
    .attr('width', xInputWidth)
    .attr('height', xInputHeight)
    .append('xhtml:input')
      .attr('type', 'text')
      .style('width', '100%')
      .style('height', '100%')
      .style('font-size', '16px')
      .style('font-weight', '600')
      .style('color', '#000000')
      .style('background-color', 'rgba(255,255,255,0.9)')
      .style('border', '1px solid #ccc')
      .style('border-radius', '4px')
      .style('padding', '5px')
      .style('text-align', 'center')
      .style('box-sizing', 'border-box')
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

watch(() => [props.data, props.width, props.height, props.stackKeys, props.colorScheme, props.showLegend, props.maxLegendWidth, props.legendItemSpacing, props.legendLineHeight], () => {
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
  z-index: 10000;
}
</style>
