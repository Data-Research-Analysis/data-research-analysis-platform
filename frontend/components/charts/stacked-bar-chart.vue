<script setup>
import { onMounted, watch, nextTick, onBeforeUnmount } from 'vue';
const { $d3 } = useNuxtApp();
const emit = defineEmits(['segment-click', 'update:yAxisLabel', 'update:xAxisLabel']);
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
  editableAxisLabels: {
    type: Boolean,
    default: true,
  },
  xAxisRotation: {
    type: Number,
    default: null,
  },
  columnName: {
    type: String,
    default: 'Value',
  },
  categoryName: {
    type: String,
    default: 'Category',
  },
  stackName: {
    type: String,
    default: 'Series',
  },
  filterState: {
    type: Object,
    default: () => ({ activeFilter: null, isFiltering: false }),
  },
});
let tooltipElement = null;

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

// Function to get text positioning attributes based on rotation angle
function getTextPositioning(rotationAngle) {
  if (rotationAngle === null || rotationAngle === 0) {
    return {
      textAnchor: 'middle',
      dy: '12px',
      dx: '0px'
    };
  } else if (rotationAngle < 0) {
    // Negative rotation (clockwise)
    return {
      textAnchor: 'end',
      dy: '8px',
      dx: '-5px'
    };
  } else {
    // Positive rotation (counter-clockwise)
    return {
      textAnchor: 'start',
      dy: '8px',
      dx: '5px'
    };
  }
}

// Function to calculate the vertical extent of rotated tick text
function calculateRotatedTextExtent(textWidth, textHeight, rotationAngle) {
  if (rotationAngle === null || rotationAngle === 0) {
    return textHeight;
  }
  
  // Convert angle to radians
  const radians = Math.abs(rotationAngle) * Math.PI / 180;
  
  // Calculate the vertical projection of rotated text
  const verticalExtent = textWidth * Math.sin(radians) + textHeight * Math.cos(radians);
  
  return Math.abs(verticalExtent);
}

// Function to measure tick text dimensions and calculate max vertical extent
function measureTickTextExtent(chartData, rotationAngle) {
  if (rotationAngle === null || rotationAngle === 0) {
    return 16; // Default height for horizontal text (12px font + padding)
  }
  
  // Estimate text dimensions based on common label lengths
  const maxLabelLength = Math.max(...chartData.map(d => d.label.length));
  const estimatedTextWidth = maxLabelLength * 7; // Approximate 7px per character
  const estimatedTextHeight = 12; // 12px font size
  
  return calculateRotatedTextExtent(estimatedTextWidth, estimatedTextHeight, rotationAngle);
}

// Function to calculate optimal X-axis label position based on tick rotation
function calculateXAxisLabelPosition(chartData, rotationAngle, baseMarginBottom) {
  const tickExtent = measureTickTextExtent(chartData, rotationAngle);
  const bufferSpace = 20; // Safety buffer between tick text and axis label
  
  // Calculate position from bottom of chart area
  const labelYOffset = Math.max(50, tickExtent + bufferSpace);
  
  return labelYOffset;
}

// Function to measure tick label dimensions for stacked chart
function measureTickDimensions(svg, processedData, stackKeys, maxY) {
  const measurements = {
    yAxisMaxWidth: 0,
    xAxisMaxHeight: 0,
    xAxisMaxWidth: 0
  };

  try {
    // Create temporary Y-axis to measure tick widths
    const tempYScale = $d3.scaleLinear()
      .domain([0, maxY || 1])
      .range([200, 0]); // Use fixed range for measurement
    
    const tempYAxis = svg.append('g')
      .attr('class', 'temp-y-axis')
      .style('visibility', 'hidden')
      .call($d3.axisLeft(tempYScale).tickFormat(formatTickValue));
    
    // Measure Y-axis tick widths
    tempYAxis.selectAll('text').each(function() {
      const bbox = this.getBBox();
      measurements.yAxisMaxWidth = Math.max(measurements.yAxisMaxWidth, bbox.width);
    });
    
    // Create temporary X-axis to measure tick dimensions
    const tempXScale = $d3.scaleBand()
      .domain(processedData.map(d => d.label))
      .range([0, 400]); // Use fixed range for measurement
    
    const tempXAxis = svg.append('g')
      .attr('class', 'temp-x-axis')
      .style('visibility', 'hidden')
      .call($d3.axisBottom(tempXScale));
    
    // Measure X-axis tick dimensions
    tempXAxis.selectAll('text').each(function() {
      const bbox = this.getBBox();
      measurements.xAxisMaxHeight = Math.max(measurements.xAxisMaxHeight, bbox.height);
      measurements.xAxisMaxWidth = Math.max(measurements.xAxisMaxWidth, bbox.width);
    });
    
    // Clean up temporary axes
    tempYAxis.remove();
    tempXAxis.remove();
    
  } catch (error) {
    console.warn('Could not measure tick dimensions, using defaults:', error);
    // Fallback measurements
    measurements.yAxisMaxWidth = 40;
    measurements.xAxisMaxHeight = 20;
    measurements.xAxisMaxWidth = 60;
  }
  
  return measurements;
}

// Function to calculate dynamic margins for stacked chart (accounting for legend and rotation)
function calculateDynamicMargins(measurements, svgWidth, svgHeight, legendLines, processedData) {
  const minMargins = { top: 60, right: 30, bottom: 60, left: 50 };
  const labelSpace = 50; // Space for axis labels
  const padding = 15; // Padding between ticks and labels
  
  // Handle edge cases for small charts
  const isSmallChart = svgWidth < 400 || svgHeight < 300;
  const responsiveLabelSpace = isSmallChart ? 35 : labelSpace;
  const responsivePadding = isSmallChart ? 10 : padding;
  
  // Calculate dynamic bottom margin based on X-axis rotation
  const baseBottomMargin = Math.max(minMargins.bottom, measurements.xAxisMaxHeight + responsiveLabelSpace + responsivePadding);
  const xAxisLabelOffset = calculateXAxisLabelPosition(processedData, props.xAxisRotation, baseBottomMargin);
  const dynamicBottomMargin = Math.max(baseBottomMargin, xAxisLabelOffset + 40); // Extra space for axis label
  
  const calculatedMargins = {
    top: Math.max(minMargins.top, 60 + (legendLines - 1) * props.legendLineHeight),
    right: Math.max(minMargins.right, measurements.xAxisMaxWidth / 2 + 10),
    bottom: dynamicBottomMargin,
    left: Math.max(minMargins.left, measurements.yAxisMaxWidth + responsiveLabelSpace + responsivePadding)
  };
  
  // Ensure margins don't exceed reasonable proportions of chart size
  const maxLeftMargin = Math.min(svgWidth * 0.3, 200);
  const maxBottomMargin = Math.min(svgHeight * 0.35, 150);
  const maxTopMargin = Math.min(svgHeight * 0.4, 200);
  
  calculatedMargins.left = Math.min(calculatedMargins.left, maxLeftMargin);
  calculatedMargins.bottom = Math.min(calculatedMargins.bottom, maxBottomMargin);
  calculatedMargins.top = Math.min(calculatedMargins.top, maxTopMargin);
  
  // Emergency fallbacks for extreme cases
  if (calculatedMargins.left + calculatedMargins.right >= svgWidth * 0.8) {
    calculatedMargins.left = svgWidth * 0.25;
    calculatedMargins.right = minMargins.right;
  }
  
  if (calculatedMargins.top + calculatedMargins.bottom >= svgHeight * 0.8) {
    calculatedMargins.bottom = svgHeight * 0.25;
    calculatedMargins.top = Math.max(minMargins.top, 60 + (legendLines - 1) * props.legendLineHeight);
  }
  
  return calculatedMargins;
}

// Function to calculate optimal label positions for stacked chart
function calculateLabelPositions(margin, height, width, processedData) {
  const labelPadding = 15;
  
  // Calculate dynamic Y position for X-axis label based on rotation
  const xAxisLabelOffset = calculateXAxisLabelPosition(processedData, props.xAxisRotation, margin.bottom);
  
  return {
    yLabel: {
      x: -margin.left / 2,
      y: height / 2
    },
    xLabel: {
      x: width / 2,
      y: height + xAxisLabelOffset
    }
  };
}

function deleteSVGs() {
  $d3.select(`#stacked-bar-chart-${props.chartId}`).selectAll('svg').remove();
  
  // Remove tooltip explicitly
  if (tooltipElement) {
    tooltipElement.remove();
    tooltipElement = null;
  }
  // Also remove by class as fallback
  $d3.selectAll(`.stacked-bar-tooltip-${props.chartId}`).remove();
}

function processData(rawData) {
  // Transform data into D3 stack format
  console.log('stacked bar chart processData rawData:', rawData);
  const processedData = rawData.map(d => {
    const item = { label: d.label };
    d.values.forEach(v => {
      item[v.key] = v.value;
    });
    return item;
  });
  console.log('stacked bar chart processData processedData:', processedData);
  return processedData;
}

function renderSVG(chartData) {
  const svgWidth = props.width;
  const svgHeight = props.height;
  
  // Process data first
  const processedData = processData(chartData);
  
  // Calculate legend lines first
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
  }

  // Create initial SVG for measurements
  const svg = $d3.select(`#stacked-bar-chart-${props.chartId}`)
    .append('svg')
    .attr('width', svgWidth)
    .attr('height', svgHeight)
    .attr("viewBox", [0, 0, svgWidth, svgHeight])
    .attr("style", "max-width: 100%; height: auto;");

  // Calculate maxY for measurements
  const stack = $d3.stack().keys(props.stackKeys);
  const stackedData = stack(processedData);
  const maxY = $d3.max(stackedData, d => $d3.max(d, d => d[1])) || 1;

  // Measure tick dimensions and calculate dynamic margins
  const measurements = measureTickDimensions(svg, processedData, props.stackKeys, maxY);
  const margin = calculateDynamicMargins(measurements, svgWidth, svgHeight, legendLines, processedData);
  
  const width = svgWidth - margin.left - margin.right;
  const height = svgHeight - margin.top - margin.bottom;

  // Calculate label positions for axis labels
  const labelPositions = calculateLabelPositions(margin, height, width, processedData);

  // Clear and recreate SVG with proper structure
  svg.selectAll('*').remove();
  const chartGroup = svg.append('g')
    .attr('transform', `translate(${margin.left}, ${margin.top})`);
  
  // Create color scale
  const color = props.colorScheme.length > 0 
    ? $d3.scaleOrdinal(props.stackKeys, props.colorScheme)
    : $d3.scaleOrdinal(props.stackKeys, $d3.schemeCategory10);

  // X axis
  const x = $d3.scaleBand()
    .domain(processedData.map(d => d.label))
    .range([0, width])
    .padding(0.2);
  
  const xAxis = chartGroup.append('g')
    .attr('transform', `translate(0,${height})`)
    .call($d3.axisBottom(x));
  
  // Apply rotation if xAxisRotation prop is provided
  if (props.xAxisRotation !== null) {
    const positioning = getTextPositioning(props.xAxisRotation);
    
    xAxis.selectAll('text')
      .style('text-anchor', positioning.textAnchor)
      .attr('dx', positioning.dx)
      .attr('dy', positioning.dy)
      .style('font-size', '12px')
      .style('fill', '#475569')
      .style('font-weight', 'bold')
      .attr('transform', `rotate(${props.xAxisRotation})`); // Rotate around element's own origin
  } else {
    // Default styling when no rotation
    xAxis.selectAll('text')
      .attr('transform', 'rotate(0)')
      .style('text-anchor', 'middle')
      .attr('dy', '12px')
      .style('font-size', '12px')
      .style('fill', '#475569')
      .style('font-weight', 'bold');
  }

  // Y axis
  const y = $d3.scaleLinear()
    .domain([0, maxY])
    .range([height, 0]);
  
  chartGroup.append('g')
    .call($d3.axisLeft(y).tickFormat(formatTickValue))
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

  // Create stacked bars
  const stackGroups = chartGroup.selectAll('.stack-group')
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
    .style('cursor', 'pointer')
    .style('opacity', d => {
      // Apply filtering logic with enhanced dimming
      if (!props.filterState.isFiltering) return 1.0;
      const matches = String(d.data.label) === String(props.filterState.activeFilter.value);
      return matches ? 1.0 : 0.2;
    })
    .style('transition', 'all 0.3s ease')
    .attr('stroke', d => {
      if (!props.filterState.isFiltering) return 'none';
      const matches = String(d.data.label) === String(props.filterState.activeFilter.value);
      return matches ? '#2196F3' : 'none';
    })
    .attr('stroke-width', d => {
      if (!props.filterState.isFiltering) return '0';
      const matches = String(d.data.label) === String(props.filterState.activeFilter.value);
      return matches ? '3' : '0';
    })
    .style('filter', d => {
      if (!props.filterState.isFiltering) return 'none';
      const matches = String(d.data.label) === String(props.filterState.activeFilter.value);
      return matches ? 'drop-shadow(0 0 6px rgba(33, 150, 243, 0.6))' : 'none';
    })
    .on('click', function(event, d) {
      event.stopPropagation();
      const stackKey = $d3.select(this.parentNode).datum().key;
      const value = d.data[stackKey];
      emit('segment-click', props.chartId, 'label', d.data.label);
    });

  // Create custom tooltip for instant display in dashboard container
  const tooltip = $d3.select('.dashboard-tooltip-container')
    .append('div')
    .attr('class', `stacked-bar-tooltip stacked-bar-tooltip-${props.chartId}`)
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

  // Attach tooltip handlers to stacked bar segments
  stackGroups.selectAll('rect')
    .on('mouseover', function (event, d) {
      // Get the stack key from parent group
      const stackKey = $d3.select(this.parentNode).datum().key;
      const value = d.data[stackKey];
      const total = props.stackKeys.reduce((sum, key) => sum + (d.data[key] || 0), 0);
      
      // Show custom tooltip immediately
      tooltip
        .html(`
          <div style="font-weight: bold; margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.3); padding-bottom: 6px;">
            ${d.data.label}
          </div>
          <div style="margin-bottom: 4px;">
            <span style="color: #94a3b8;">Category:</span> 
            <span style="font-weight: 600;">${props.categoryName}</span>
          </div>
          <div style="margin-bottom: 4px;">
            <span style="color: #94a3b8;">${props.stackName}:</span> 
            <span style="font-weight: 600;">${stackKey}</span>
          </div>
          <div style="margin-bottom: 4px;">
            <span style="color: #94a3b8;">Column:</span> 
            <span style="font-weight: 600;">${props.columnName}</span>
          </div>
          <div style="margin-bottom: 4px;">
            <span style="color: #94a3b8;">Value:</span> 
            <span style="font-weight: 600;">${value.toLocaleString('en-US')}</span>
          </div>
          <div style="border-top: 1px solid rgba(255,255,255,0.2); margin-top: 6px; padding-top: 6px;">
            <span style="color: #94a3b8;">Total:</span> 
            <span style="font-weight: 600;">${total.toLocaleString('en-US')}</span>
          </div>
        `)
        .style('left', (event.clientX + 15) + 'px')
        .style('top', (event.clientY - 10) + 'px')
        .style('opacity', 1);

      $d3.select(this).style('opacity', 0.7);
    })
    .on('mouseout', function () {
      // Hide tooltip
      tooltip.style('opacity', 0);
      $d3.select(this).style('opacity', 1);
    })
    .on('mousemove', function (event, d) {
      // Update tooltip position as mouse moves
      tooltip
        .style('left', (event.clientX + 15) + 'px')
        .style('top', (event.clientY - 10) + 'px');
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

  // Y axis title - conditional rendering with dynamic positioning
  if (props.editableAxisLabels) {
    // Editable input
    const yInputWidth = Math.min(150, height * 0.4);
    const yInputHeight = 35;
    
    svg.append('foreignObject')
      .attr('x', labelPositions.yLabel.x + 50)
      .attr('y', labelPositions.yLabel.y)
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
  } else {
    // Static text
    const textX = labelPositions.yLabel.x;
    const textY = labelPositions.yLabel.y;
    svg.append('text')
      .attr('x', textX - 40)
      .attr('y', textY + 60)
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
    const xInputWidth = Math.min(250, width * 0.5);
    const xInputHeight = 35;
    
    svg.append('foreignObject')
      .attr('x', labelPositions.xLabel.x - xInputWidth / 6)
    .attr('y', labelPositions.xLabel.y + 40)
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
  } else {
    // Static text
    const textX = labelPositions.xLabel.x;
    const textY = labelPositions.xLabel.y;
    svg.append('text')
      .attr('x', textX + 50)
      .attr('y', textY + 50)
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

watch(() => [props.data, props.width, props.height, props.stackKeys, props.colorScheme, props.showLegend, props.maxLegendWidth, props.legendItemSpacing, props.legendLineHeight, props.filterState], () => {
  nextTick(() => renderChart(props.data));
});

onBeforeUnmount(() => {
  deleteSVGs();
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

@keyframes pulse-selected {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
}
</style>
