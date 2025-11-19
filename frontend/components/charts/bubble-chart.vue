<script setup>
import { onMounted, watch, nextTick, onBeforeUnmount } from "vue";
const { $d3 } = useNuxtApp();

const emit = defineEmits(['segment-click']);

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
    required: false,
    default: 1200,
  },
  height: {
    type: Number,
    required: false,
    default: 500,
  },
  xColumnName: {
    type: String,
    default: 'X Axis',
  },
  yColumnName: {
    type: String,
    default: 'Y Axis',
  },
  sizeColumnName: {
    type: String,
    default: 'Size',
  },
  labelColumnName: {
    type: String,
    default: 'Label',
  },
  filterState: {
    type: Object,
    default: () => ({ activeFilter: null, isFiltering: false }),
  },
});

watch(() => props.data, (newData) => {
  nextTick(() => {
    renderChart(newData);
  });
});

watch(() => props.filterState, () => {
  nextTick(() => {
    renderChart(props.data);
  });
}, { deep: true });
let tooltipElement = null;

function deleteSVGs() {
  $d3.select(`#bubble-chart-${props.chartId}`).selectAll("svg").remove();
  
  // Remove tooltip explicitly
  if (tooltipElement) {
    tooltipElement.remove();
    tooltipElement = null;
  }
  // Also remove by class as fallback
  $d3.selectAll('.bubble-tooltip').remove();
}

function renderSVG(chartData) {
  const margin = { top: 50, right: 50, bottom: 100, left: 50 };
  const width = props.width - margin.left - margin.right;
  const height = props.height - margin.top - margin.bottom;
  const svgHeight = height + margin.top + margin.bottom;
  const svgWidth = width + margin.left + margin.right;

  const svg = $d3.select(`#bubble-chart-${props.chartId}`)
    .append("svg")
    .attr("width", svgWidth)
    .attr("height", svgHeight)
    .attr("viewBox", [0, 0, svgWidth, svgHeight])
    .attr("style", "max-width: 100%; height: auto; font: 15px sans-serif;");

  // Scales
  const x = $d3.scaleLinear()
    .domain([$d3.min(chartData, d => d.x), $d3.max(chartData, d => d.x)])
    .range([margin.left, width + margin.left]);
  const y = $d3.scaleLinear()
    .domain([$d3.min(chartData, d => d.y), $d3.max(chartData, d => d.y)])
    .range([height + margin.top, margin.top]);
  const r = $d3.scaleSqrt()
    .domain([$d3.min(chartData, d => d.r), $d3.max(chartData, d => d.r)])
    .range([10, 50]);

  // Bubbles
  svg.append("g")
    .selectAll("circle")
    .data(chartData)
    .join("circle")
    .attr("cx", d => x(d.x))
    .attr("cy", d => y(d.y))
    .attr("r", d => r(d.r))
    .attr("fill", d => d.color || "#36A2EB")
    .style("opacity", d => {
      // Apply filtering logic with enhanced dimming
      const baseOpacity = 0.7;
      if (!props.filterState.isFiltering) return baseOpacity;
      const matches = String(d.label) === String(props.filterState.activeFilter.value);
      return matches ? baseOpacity : 0.15;
    })
    .attr("stroke", d => {
      if (!props.filterState.isFiltering) return "#333";
      const matches = String(d.label) === String(props.filterState.activeFilter.value);
      return matches ? "#2196F3" : "#333";
    })
    .attr("stroke-width", d => {
      if (!props.filterState.isFiltering) return "1";
      const matches = String(d.label) === String(props.filterState.activeFilter.value);
      return matches ? "3" : "1";
    })
    .style("cursor", "pointer")
    .style("transition", "all 0.3s ease")
    .style("filter", d => {
      if (!props.filterState.isFiltering) return "none";
      const matches = String(d.label) === String(props.filterState.activeFilter.value);
      return matches ? "drop-shadow(0 0 8px rgba(33, 150, 243, 0.6))" : "none";
    })
    .on("click", function(event, d) {
      event.stopPropagation();
      emit('segment-click', props.chartId, 'label', d.label);
    });  // Create custom tooltip for instant display in dashboard container
  const tooltip = $d3.select('.dashboard-tooltip-container')
    .append('div')
    .attr('class', 'bubble-tooltip')
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

  // Attach tooltip handlers to bubbles
  svg.selectAll('circle')
    .on("mouseover", function (event, d) {
      $d3.select(this)
        .style("opacity", 1)
        .style("filter", "brightness(1.1)")
        .attr("stroke-width", "2px")
        .style("transform", "scale(1.1)")
        .style("transform-origin", "center");
      
      // Show custom tooltip immediately
      tooltip
        .html(`
          <div style="font-weight: bold; margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.3); padding-bottom: 6px;">
            ${d.label}
          </div>
          <div style="margin-bottom: 4px;">
            <span style="color: #94a3b8;">${props.labelColumnName}:</span> 
            <span style="font-weight: 600;">${d.label}</span>
          </div>
          <div style="margin-bottom: 4px;">
            <span style="color: #94a3b8;">${props.xColumnName}:</span> 
            <span style="font-weight: 600;">${d.x.toLocaleString('en-US')}</span>
          </div>
          <div style="margin-bottom: 4px;">
            <span style="color: #94a3b8;">${props.yColumnName}:</span> 
            <span style="font-weight: 600;">${d.y.toLocaleString('en-US')}</span>
          </div>
          <div style="margin-bottom: 4px;">
            <span style="color: #94a3b8;">${props.sizeColumnName}:</span> 
            <span style="font-weight: 600;">${d.r.toLocaleString('en-US')}</span>
          </div>
          <div>
            <span style="color: #94a3b8;">Value:</span> 
            <span style="font-weight: 600;">${(d.value || d.y).toLocaleString('en-US')}</span>
          </div>
        `)
        .style('left', (event.pageX + 15) + 'px')
        .style('top', (event.pageY - 10) + 'px')
        .style('opacity', 1);
    })
    .on("mouseout", function (event, d) {
      const baseOpacity = (!props.filterState.isFiltering || String(d.label) === String(props.filterState.activeFilter.value)) ? 0.7 : 0.2;
      $d3.select(this)
        .style("opacity", baseOpacity)
        .style("filter", "brightness(1)")
        .attr("stroke-width", "1px")
        .style("transform", "scale(1)");
      
      // Hide tooltip
      tooltip.style('opacity', 0);
    })
    .on("mousemove", function (event) {
      // Update tooltip position as mouse moves
      tooltip
        .style('left', (event.pageX + 15) + 'px')
        .style('top', (event.pageY - 10) + 'px');
    });

  // Labels (label centered, value below)
  const labelGroup = svg.append("g").attr("class", "labels");
  labelGroup.selectAll("text")
    .data(chartData)
    .join("text")
    .attr("x", d => x(d.x))
    .attr("y", d => y(d.y) - 8)
    .attr("text-anchor", "middle")
    .attr("font-size", "16px")
    .attr("font-weight", "bold")
    .attr("fill", "#222")
    .text(d => d.label);

  const valueGroup = svg.append("g").attr("class", "values");
  valueGroup.selectAll("text")
    .data(chartData)
    .join("text")
    .attr("x", d => x(d.x))
    .attr("y", d => y(d.y) + 16) // 16px below label
    .attr("text-anchor", "middle")
    .attr("font-size", "14px")
    .attr("fill", "#555")
    .text(d => d.value || d.y); // Use value or fallback to y

  return svg;
}

function autoTransformData(rawData) {
  // Use D3 color scale
  const colorScale = $d3.scaleOrdinal($d3.schemeCategory10);
  const values = rawData.map(d => d.value);
  const minValue = $d3.min(values);
  const maxValue = $d3.max(values);
  const n = rawData.length;
  // Spread x evenly, y is value, r is scaled value
  return rawData.map((d, i) => ({
    x: i * (n > 1 ? 100 / (n - 1) : 50), // Evenly spread x from 0 to 100
    y: d.value,
    r: Math.max(10, Math.sqrt(d.value)), // Bubble size, min 10
    label: d.label,
    color: colorScale(i),
    value: d.value  // Preserve original value for text display
  }));
}

function renderChart(chartData) {
  deleteSVGs();
  // If data is not in bubble format, transform it
  let processedData = chartData;
  if (processedData.length && (processedData[0].x === undefined || processedData[0].y === undefined || processedData[0].r === undefined)) {
    processedData = autoTransformData(processedData);
  }
  renderSVG(processedData);
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
    <div :id="`bubble-chart-${props.chartId}`"></div>
  </div>
</template>

<style scoped>
@keyframes pulse-selected {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}
</style>
