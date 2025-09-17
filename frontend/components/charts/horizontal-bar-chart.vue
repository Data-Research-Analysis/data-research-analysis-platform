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
  editableAxisLabels: {
    type: Boolean,
    default: true,
  },
  enableTickShortening: {
    type: Boolean,
    default: true,
  },
  tickDecimalPlaces: {
    type: Number,
    default: 1,
  },
  customTickSuffixes: {
    type: Object,
    default: () => ({ K: 'k', M: 'M', B: 'B', T: 'T' }),
  },
});

// Utility function to format large numbers with shortened suffixes
function formatTickValue(value) {
  if (!props.enableTickShortening || value === 0) {
    return value.toString();
  }
  
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  
  const suffixes = props.customTickSuffixes;
  const decimalPlaces = props.tickDecimalPlaces;
  
  if (absValue >= 1000000000000) {
    return sign + (absValue / 1000000000000).toFixed(decimalPlaces).replace(/\.0+$/, '') + suffixes.T;
  } else if (absValue >= 1000000000) {
    return sign + (absValue / 1000000000).toFixed(decimalPlaces).replace(/\.0+$/, '') + suffixes.B;
  } else if (absValue >= 1000000) {
    return sign + (absValue / 1000000).toFixed(decimalPlaces).replace(/\.0+$/, '') + suffixes.M;
  } else if (absValue >= 1000) {
    return sign + (absValue / 1000).toFixed(decimalPlaces).replace(/\.0+$/, '') + suffixes.K;
  } else {
    return value.toString();
  }
}

// Function to check if Y-axis values are numeric
function isNumericYAxis(chartData) {
  return chartData.every(d => !isNaN(parseFloat(d.label)) && isFinite(d.label));
}

// Function to format Y-axis labels if they are numeric
function formatYAxisLabel(label) {
  if (isNumericYAxis(props.data)) {
    return formatTickValue(parseFloat(label));
  }
  return label;
}

// Function to measure tick label dimensions
function measureTickDimensions(svg, chartData, maxX) {
  const measurements = {
    xAxisMaxHeight: 0,
    xAxisMaxWidth: 0,
    yAxisMaxWidth: 0
  };

  try {
    // Create temporary X-axis to measure tick dimensions
    const tempXScale = $d3.scaleLinear()
      .domain([0, maxX || 1])
      .range([0, 400]); // Use fixed range for measurement
    
    const tempXAxis = svg.append('g')
      .attr('class', 'temp-x-axis')
      .style('visibility', 'hidden')
      .call($d3.axisBottom(tempXScale).tickFormat(formatTickValue));
    
    // Measure X-axis tick dimensions
    tempXAxis.selectAll('text').each(function() {
      const bbox = this.getBBox();
      measurements.xAxisMaxHeight = Math.max(measurements.xAxisMaxHeight, bbox.height);
      measurements.xAxisMaxWidth = Math.max(measurements.xAxisMaxWidth, bbox.width);
    });
    
    // Create temporary Y-axis to measure tick widths
    const tempYScale = $d3.scaleBand()
      .domain(chartData.map(d => d.label))
      .range([0, 300]); // Use fixed range for measurement
    
    const tempYAxis = svg.append('g')
      .attr('class', 'temp-y-axis')
      .style('visibility', 'hidden')
      .call($d3.axisLeft(tempYScale).tickFormat(formatYAxisLabel));
    
    // Measure Y-axis tick widths
    tempYAxis.selectAll('text').each(function() {
      const bbox = this.getBBox();
      measurements.yAxisMaxWidth = Math.max(measurements.yAxisMaxWidth, bbox.width);
    });
    
    // Clean up temporary axes
    tempXAxis.remove();
    tempYAxis.remove();
    
  } catch (error) {
    console.warn('Could not measure tick dimensions, using defaults:', error);
    // Fallback measurements
    measurements.xAxisMaxHeight = 20;
    measurements.xAxisMaxWidth = 60;
    measurements.yAxisMaxWidth = 80;
  }
  
  return measurements;
}

// Function to calculate dynamic margins based on tick measurements
function calculateDynamicMargins(measurements, svgWidth, svgHeight) {
  const minMargins = { top: 40, right: 30, bottom: 60, left: 50 };
  const labelSpace = 50; // Space for axis labels
  const padding = 15; // Padding between ticks and labels
  
  // Handle edge cases for small charts
  const isSmallChart = svgWidth < 400 || svgHeight < 300;
  const responsiveLabelSpace = isSmallChart ? 35 : labelSpace;
  const responsivePadding = isSmallChart ? 10 : padding;
  
  const calculatedMargins = {
    top: minMargins.top,
    right: Math.max(minMargins.right, measurements.xAxisMaxWidth / 2 + 10),
    bottom: Math.max(minMargins.bottom, measurements.xAxisMaxHeight + responsiveLabelSpace + responsivePadding),
    left: Math.max(minMargins.left, measurements.yAxisMaxWidth + responsiveLabelSpace + responsivePadding)
  };
  
  // Ensure margins don't exceed reasonable proportions of chart size
  const maxLeftMargin = Math.min(svgWidth * 0.3, 200);
  const maxBottomMargin = Math.min(svgHeight * 0.35, 150);
  
  calculatedMargins.left = Math.min(calculatedMargins.left, maxLeftMargin);
  calculatedMargins.bottom = Math.min(calculatedMargins.bottom, maxBottomMargin);
  
  // Emergency fallbacks for extreme cases
  if (calculatedMargins.left + calculatedMargins.right >= svgWidth * 0.8) {
    calculatedMargins.left = svgWidth * 0.25;
    calculatedMargins.right = minMargins.right;
  }
  
  if (calculatedMargins.top + calculatedMargins.bottom >= svgHeight * 0.8) {
    calculatedMargins.bottom = svgHeight * 0.25;
    calculatedMargins.top = minMargins.top;
  }
  
  return calculatedMargins;
}

// Function to calculate optimal label positions
function calculateLabelPositions(margin, height, width) {
  const labelPadding = 15;
  
  return {
    yAxis: {
      x: -margin.left / 1.5, // Increased offset to accommodate rotated input box
      y: height / 2
    },
    xAxis: {
      x: width / 2,
      y: height + margin.bottom - labelPadding
    }
  };
}

function deleteSVGs() {
  $d3.select(`#vertical-bar-chart-1-${props.chartId}`).selectAll('svg').remove();
}

function renderSVG(chartData) {
  const svgWidth = props.width;
  const svgHeight = props.height;
  
  // Create initial SVG for measurements
  const svg = $d3.select(`#vertical-bar-chart-1-${props.chartId}`)
    .append('svg')
    .attr('width', svgWidth)
    .attr('height', svgHeight)
    .attr("viewBox", [0, 0, svgWidth, svgHeight])
    .attr("style", "max-width: 100%; height: auto;");

  // Calculate maxX for measurements
  const maxX = $d3.max(chartData, d => d.value) || 1;

  // Measure tick dimensions and calculate dynamic margins
  const measurements = measureTickDimensions(svg, chartData, maxX);
  const margin = calculateDynamicMargins(measurements, svgWidth, svgHeight);
  
  const width = svgWidth - margin.left - margin.right;
  const height = svgHeight - margin.top - margin.bottom;
  const color = $d3.scaleOrdinal(chartData.map((d) => d.label), $d3.schemeCategory10);

  // Clear and recreate SVG with proper structure
  svg.selectAll('*').remove();
  const chartGroup = svg.append('g')
    .attr('transform', `translate(${margin.left}, ${margin.top})`);

  // X axis (value scale)
  const x = $d3.scaleLinear()
    .domain([0, maxX])
    .range([0, width]);
  chartGroup.append('g')
    .attr('transform', `translate(0,${height})`)
    .call($d3.axisBottom(x).tickFormat(formatTickValue))
    .selectAll('text')
    .style('text-anchor', 'middle')
    .style('font-size', '12px')
    .style('fill', '#475569')
    .style('font-weight', 'bold');

  // Y axis (category scale)
  const y = $d3.scaleBand()
    .domain(chartData.map(d => d.label))
    .range([0, height])
    .padding(0.2);
  chartGroup.append('g')
    .call($d3.axisLeft(y).tickFormat(formatYAxisLabel))
    .selectAll('text')
    .style('text-anchor', 'end')
    .style('font-size', '12px')
    .style('fill', 'black')
    .style('font-weight', 'bold');
    
  // Set y-axis tick lines to black
  chartGroup.selectAll('.tick line')
    .style('stroke', 'black');
  // Set y-axis domain line to black
  chartGroup.selectAll('.domain')
    .style('stroke', 'black');

  // Bars (horizontal orientation)
  chartGroup.selectAll('rect')
    .data(chartData)
    .join('rect')
    .attr('y', d => y(d.label))
    .attr('x', 0)
    .attr('height', y.bandwidth())
    .attr('width', d => x(d.value))
    .attr('fill', d => color(d.label));

  // Enhanced tooltips with full values
  chartGroup.selectAll('rect')
    .on('mouseover', function (event, d) {
      $d3.select(this).attr('fill', '#4682b4');
      
      // Create tooltip
      const tooltip = $d3.select('body').append('div')
        .attr('class', 'chart-tooltip')
        .style('position', 'absolute')
        .style('background', 'rgba(0, 0, 0, 0.8)')
        .style('color', 'white')
        .style('padding', '8px 12px')
        .style('border-radius', '4px')
        .style('font-size', '12px')
        .style('pointer-events', 'none')
        .style('z-index', '1000')
        .style('opacity', 0);
      
      tooltip.html(`
        <div><strong>${d.label}</strong></div>
        <div>Value: ${d.value.toLocaleString()}</div>
      `)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 10) + 'px')
        .transition()
        .duration(200)
        .style('opacity', 1);
    })
    .on('mouseout', function (event, d) {
      $d3.select(this).attr('fill', color(d.label));
      
      // Remove tooltip
      $d3.selectAll('.chart-tooltip').remove();
    })
    .on('mousemove', function (event, d) {
      // Update tooltip position
      $d3.selectAll('.chart-tooltip')
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 10) + 'px');
    });

  // Calculate optimal label positions
  const labelPositions = calculateLabelPositions(margin, height, width);

  // Y axis title - conditional rendering with dynamic positioning
  if (props.editableAxisLabels) {
    // Editable input
    const yInputWidth = Math.min(150, height * 0.4);
    const yInputHeight = 35;
    const inputX = margin.left / 4 - yInputHeight / 1.5; // Match vertical chart positioning
    const inputY = height / 2 - yInputWidth / 4;
    
    svg.append('foreignObject')
      .attr('x', inputX)
      .attr('y', inputY)
      .attr('width', yInputHeight)
      .attr('height', yInputWidth)
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
  } else {
    // Static text
    const textX = margin.left / 5; // Match consistent positioning
    const textY = height / 1.5;
    svg.append('text')
      .attr('x', textX)
      .attr('y', textY)
      .attr('transform', `rotate(-90, ${textX}, ${textY})`)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .style('font-size', '14px')
      .style('font-weight', '600')
      .style('fill', '#000000')
      .text(props.yAxisLabel);
  }

  // X axis title - conditional rendering with dynamic positioning
  if (props.editableAxisLabels) {
    // Editable input
    const xInputWidth = Math.min(200, width * 0.4);
    const xInputHeight = 30;
    
    svg.append('foreignObject')
      .attr('x', labelPositions.xAxis.x - xInputWidth / 5)
      .attr('y', labelPositions.xAxis.y + 20  )
      .attr('width', xInputWidth)
      .attr('height', xInputHeight)
      .append('xhtml:input')
        .attr('type', 'text')
        .style('width', '100%')
        .style('height', '100%')
        .style('font-size', '14px')
        .style('font-weight', '600')
        .style('color', '#000000')
        .style('background-color', 'rgba(255,255,255,0.9)')
        .style('border', '1px solid #ccc')
        .style('border-radius', '4px')
        .style('padding', '4px')
        .style('text-align', 'center')
        .style('box-sizing', 'border-box')
        .property('value', state.xAxisLabelLocal)
        .on('input', function(event) {
          state.xAxisLabelLocal = event.target.value;
          emit('update:xAxisLabel', state.xAxisLabelLocal);
        });
  } else {
    // Static text
    svg.append('text')
      .attr('x', labelPositions.xAxis.x + width / 4.5)
      .attr('y', labelPositions.xAxis.y + 30)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .style('font-size', '14px')
      .style('font-weight', '600')
      .style('fill', '#000000')
      .text(props.xAxisLabel);
  }

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
