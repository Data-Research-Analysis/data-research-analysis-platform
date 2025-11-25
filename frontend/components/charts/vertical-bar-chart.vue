<script setup>
import { x } from 'happy-dom/lib/PropertySymbol.js';
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
  showLineChart: {
    type: Boolean,
    default: false,
  },
  lineData: {
    type: Array,
    default: () => [],
  },
  lineColor: {
    type: String,
    default: '#ff6b6b',
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
  categoryColumn: {
    type: String,
    default: 'category',
  },
  selectedValue: {
    type: String,
    default: null,
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

// Function to check if X-axis values are numeric
function isNumericXAxis(chartData) {
  return chartData.every(d => !isNaN(parseFloat(d.label)) && isFinite(d.label));
}

// Function to format X-axis labels if they are numeric
function formatXAxisLabel(label) {
  if (isNumericXAxis(props.data)) {
    return formatTickValue(parseFloat(label));
  }
  return label;
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
  const maxLabelLength = Math.max(...chartData.map(d => formatXAxisLabel(d.label).length));
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

function deleteSVGs() {
  $d3.select(`#vertical-bar-chart-1-${props.chartId}`).selectAll('svg').remove();
  
  // Remove tooltip explicitly
  if (tooltipElement) {
    tooltipElement.remove();
    tooltipElement = null;
  }
  // Also remove by class as fallback
  $d3.selectAll('.vertical-bar-tooltip').remove();
}

function renderSVG(chartData, lineData) {
  // Calculate dynamic bottom margin based on rotation
  const baseBottomMargin = 80;
  const xAxisLabelOffset = calculateXAxisLabelPosition(chartData, props.xAxisRotation, baseBottomMargin);
  const dynamicBottomMargin = Math.max(baseBottomMargin, xAxisLabelOffset + 40); // Extra space for axis label
  
  const margin = { top: 40, right: 30, bottom: dynamicBottomMargin, left: 80 };
  const svgWidth = props.width;
  const svgHeight = props.height;
  const width = svgWidth - margin.left - margin.right;
  const height = svgHeight - margin.top - margin.bottom;
  const color = $d3.scaleOrdinal(chartData.map((d) => d.label), $d3.schemeCategory10);

  const svg = $d3.select(`#vertical-bar-chart-1-${props.chartId}`)
    .append('svg')
    .attr('width', svgWidth)
    .attr('height', svgHeight)
    .attr("viewBox", [0, 0, svgWidth, svgHeight])
    .attr("style", "max-width: 100%; height: auto;")
    .append('g')
    .attr('transform', `translate(${margin.left}, ${margin.top})`);

  // X axis
  const x = $d3.scaleBand()
    .domain(chartData.map(d => d.label))
    .range([0, width])
    .padding(0.2);
  
  const xAxis = svg.append('g')
    .attr('transform', `translate(0,${height})`)
    .call($d3.axisBottom(x).tickFormat(formatXAxisLabel));
  
  // Apply rotation if xAxisRotation prop is provided
  if (props.xAxisRotation !== null) {
    const positioning = getTextPositioning(props.xAxisRotation);
    
    xAxis.selectAll('text')
      .style('text-anchor', positioning.textAnchor)
      .attr('dx', positioning.dx)
      .attr('dy', positioning.dy)
      .style('font-size', '12px')
      .style('fill', '#475569') // Darker gray for axis text
      .style('font-weight', 'bold')
      .attr('transform', `rotate(${props.xAxisRotation})`); // Rotate around element's own origin
  } else {
    // Default styling when no rotation
    xAxis.selectAll('text')
      .attr('transform', 'rotate(0)')
      .style('text-anchor', 'middle')
      .attr('dy', '12px')
      .style('font-size', '12px')
      .style('fill', '#475569') // Darker gray for axis text
      .style('font-weight', 'bold');
  }

  let maxY = 0;
  if (props.showLineChart && lineData?.length) {
    if ($d3.max(lineData, d => d.value) > $d3.max(chartData, d => d.value)) {
      maxY = $d3.max(lineData, d => d.value);
    } else {
      maxY = $d3.max(chartData, d => d.value);
    }
  } else {
    maxY = $d3.max(chartData, d => d.value);
  }

  // Y axis
  const y = $d3.scaleLinear()
    .domain([0, maxY || 1])
    .range([height, 0]);
  svg.append('g')
    .call($d3.axisLeft(y).tickFormat(formatTickValue))
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
    .attr('fill', d => color(d.label))
    .style('cursor', 'pointer')
    .style('opacity', d => {
      // Apply filtering logic with enhanced dimming
      if (!props.selectedValue) return 1.0;
      
      const barLabel = String(d.label).trim();
      const filterValue = String(props.selectedValue).trim();
      
      // Try multiple matching strategies
      const exactMatch = barLabel === filterValue;
      const caseInsensitiveMatch = barLabel.toLowerCase() === filterValue.toLowerCase();
      const typeCoercedMatch = d.label == props.selectedValue;
      const matches = exactMatch || caseInsensitiveMatch || typeCoercedMatch;
      
      return matches ? 1.0 : 0.3;
    })
    .style('transition', 'all 0.3s ease')
    .attr('stroke', d => {
      if (!props.selectedValue) return 'none';
      
      const barLabel = String(d.label).trim();
      const filterValue = String(props.selectedValue).trim();
      const matches = barLabel === filterValue || barLabel.toLowerCase() === filterValue.toLowerCase() || d.label == props.selectedValue;
      
      return matches ? '#2196F3' : 'none';
    })
    .attr('stroke-width', d => {
      if (!props.selectedValue) return '0';
      
      const barLabel = String(d.label).trim();
      const filterValue = String(props.selectedValue).trim();
      const matches = barLabel === filterValue || barLabel.toLowerCase() === filterValue.toLowerCase() || d.label == props.selectedValue;
      
      return matches ? '3' : '0';
    })
    .style('filter', d => {
      if (!props.selectedValue) return 'none';
      
      const barLabel = String(d.label).trim();
      const filterValue = String(props.selectedValue).trim();
      const matches = barLabel === filterValue || barLabel.toLowerCase() === filterValue.toLowerCase() || d.label == props.selectedValue;
      
      return matches ? 'drop-shadow(0 0 6px rgba(33, 150, 243, 0.6))' : 'none';
    })
    .on('click', function(event, d) {
      event.stopPropagation();
      
      emit('segment-click', props.chartId, 'label', d.label);
    });

  // Create custom tooltip for instant display in dashboard container
  const tooltip = $d3.select('.dashboard-tooltip-container')
    .append('div')
    .attr('class', 'vertical-bar-tooltip')
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

  // Tooltips with full values and instant display
  svg.selectAll('rect')
    .on('mouseover', function (event, d) {
      $d3.select(this).attr('fill', '#4682b4');
      
      // Show custom tooltip immediately
      tooltip
        .html(`
          <div style="font-weight: bold; margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.3); padding-bottom: 6px;">
            ${d.label}
          </div>
          <div style="margin-bottom: 4px;">
            <span style="color: #94a3b8;">Category:</span> 
            <span style="font-weight: 600;">${props.categoryName}</span>
          </div>
          <div style="margin-bottom: 4px;">
            <span style="color: #94a3b8;">Column:</span> 
            <span style="font-weight: 600;">${props.columnName}</span>
          </div>
          <div>
            <span style="color: #94a3b8;">Value:</span> 
            <span style="font-weight: 600;">${d.value.toLocaleString('en-US')}</span>
          </div>
        `)
        .style('left', (event.pageX + 15) + 'px')
        .style('top', (event.pageY - 10) + 'px')
        .style('opacity', 1);
    })
    .on('mouseout', function (event, d) {
      $d3.select(this).attr('fill', color(d.label));
      
      // Hide tooltip
      tooltip.style('opacity', 0);
    })
    .on('mousemove', function (event, d) {
      // Update tooltip position as mouse moves
      tooltip
        .style('left', (event.pageX + 15) + 'px')
        .style('top', (event.pageY - 10) + 'px');
    });

  // Line chart overlay (conditional)
  if (props.showLineChart && lineData?.length) {
    // Create line generator
    const line = $d3.line()
      .x(d => x(d.label) + x.bandwidth() / 2) // Center line on bars
      .y(d => y(d.value))
      .curve($d3.curveMonotoneX);

    // Add line path
    svg.append('path')
      .datum(lineData)
      .attr('fill', 'none')
      .attr('stroke', props.lineColor)
      .attr('stroke-width', 3)
      .attr('d', line);

    // Add data points with enhanced tooltips
    svg.selectAll('.line-point')
      .data(lineData)
      .join('circle')
      .attr('class', 'line-point')
      .attr('cx', d => x(d.label) + x.bandwidth() / 2)
      .attr('cy', d => y(d.value))
      .attr('r', 4)
      .attr('fill', props.lineColor)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .on('mouseover', function (event, d) {
        $d3.select(this).attr('r', 6);
        
        // Create tooltip for line points
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
          <div>Line Value: ${d.value.toLocaleString()}</div>
        `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px')
          .transition()
          .duration(200)
          .style('opacity', 1);
      })
      .on('mouseout', function (event, d) {
        $d3.select(this).attr('r', 4);
        $d3.selectAll('.chart-tooltip').remove();
      })
      .on('mousemove', function (event, d) {
        $d3.selectAll('.chart-tooltip')
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      });
  }

  const yInputHeight = 35;
  const yInputWidth = Math.min(150, height * 0.4);
  // Y axis title - conditional rendering
  if (props.editableAxisLabels) {
    // Editable input
    const inputX = -margin.left / 1.5 - yInputHeight / 2;
    const inputY = height / 2 - yInputWidth / 2;
    
    svg.append('foreignObject')
      .attr('x', inputX)
      .attr('y', inputY)
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
    const textX = -margin.left / 1.5;
    const textY = height / 2;
    svg.append('text')
    .attr('x', textX)
    .attr('y', textY)
    .attr('transform', `rotate(-90, ${textX}, ${textY})`)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .style('font-size', '16px')
    .style('font-weight', '600')
    .style('fill', '#000000')
    .text(props.yAxisLabel);
  }

  const xInputWidth = Math.min(250, width * 0.5);
  const xInputHeight = 35;
  
  // Calculate dynamic Y position for X-axis label based on rotation
  const xAxisLabelY = height + xAxisLabelOffset;
  
  // X axis title - conditional rendering
  if (props.editableAxisLabels) {
    // Editable input
    
    svg.append('foreignObject')
      .attr('x', width / 2 - xInputWidth / 2)
      .attr('y', xAxisLabelY - xInputHeight / 2)
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
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', xAxisLabelY)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .style('font-size', '16px')
      .style('font-weight', '600')
      .style('fill', '#000000')
      .text(props.xAxisLabel);
  }

}

function renderChart(chartData, lineData) {
  deleteSVGs();
  renderSVG(chartData, lineData);
}

onMounted(() => {
  state.xAxisLabelLocal = props.xAxisLabel;
  state.yAxisLabelLocal = props.yAxisLabel;
  renderChart(props.data, props.lineData);
});

watch(() => [props.data, props.width, props.height, props.showLineChart, props.lineData, props.selectedValue], () => {
  nextTick(() => renderChart(props.data));
}, { deep: true });

onBeforeUnmount(() => {
  deleteSVGs();
});
</script>
<template>
  <div>
    <div :id="`vertical-bar-chart-1-${props.chartId}`"></div>
  </div>
</template>

<style scoped>
@keyframes pulse-selected {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
}
</style>
