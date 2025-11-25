<script setup>
import { onMounted, watch } from "vue";
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
  innerRadius: {
    type: Number,
    required: false,
    default: 300, // default donut hole size
  },
  columnName: {
    type: String,
    default: 'Value',
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
watch(() => props.data, (newData) => {
  nextTick(() => {
    renderChart(newData);
  });
});

watch(() => props.selectedValue, () => {
  nextTick(() => {
    renderChart(props.data);
  });
});
let tooltipElement = null;

function deleteSVGs() {
  $d3.select(`#donut-chart-${props.chartId}`).selectAll('svg').remove();
  
  // Remove tooltip explicitly
  if (tooltipElement) {
    tooltipElement.remove();
    tooltipElement = null;
  }
  // Also remove by class as fallback
  $d3.selectAll(`.donut-chart-tooltip-${props.chartId}`).remove();
}
function renderSVG(chartData) {
 const margin = {
    top: 50,
    right: 50,
    bottom: 100,
    left: 50,
  };
  const width = props.width - margin.left - margin.right;
  const height = props.height - margin.top - margin.bottom;
  const color = $d3.scaleOrdinal(chartData.map((d) => d.label), $d3.schemeCategory10);
  const total = chartData.reduce((total, item) => total + item.value, 0)
  const data = chartData.map((d) => {
    return {
      ...d,
      percent_value: Math.round((d.value / total) * 100),
    };
  });
  if (data?.length > 0) {
    const pie = $d3.pie()
          .sort(null)
          .value((d) => d.value);
    const arc = $d3.arc()
          .innerRadius(props.innerRadius)
          .outerRadius((Math.min(width, height) / 2) - 1);
    const labelRadius = arc.outerRadius()() * 0.8;
    const arcLabel = $d3.arc()
        .innerRadius(labelRadius)
        .outerRadius(labelRadius);
    const arcs = pie(data);
    const svg = $d3.select(`#donut-chart-${props.chartId}`)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [-width / 2, -height / 2, width, height])
        .attr("style", "max-width: 100%; height: auto; font: 15px sans-serif;");
    
    // Create custom tooltip for instant display in dashboard container
  const tooltip = $d3.select('.dashboard-tooltip-container')
    .append('div')
    .attr('class', `donut-chart-tooltip donut-chart-tooltip-${props.chartId}`)
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
    
    svg.append("g")
        .attr("stroke", "white")
      .selectAll()
      .data(arcs)
      .join("path")
        .attr("fill", d => color(d.data.label))
        .attr("d", arc)
        .style("cursor", "pointer")
        .style("opacity", d => {
          // Apply filtering logic with enhanced dimming
          if (!props.selectedValue) return 1.0;
          const matches = String(d.data.label) === String(props.selectedValue);
          return matches ? 1.0 : 0.3;
        })
        .style("transition", "all 0.3s ease")
        .attr("stroke", d => {
          if (!props.selectedValue) return "white";
          const matches = String(d.data.label) === String(props.selectedValue);
          return matches ? "#2196F3" : "white";
        })
        .attr("stroke-width", d => {
          if (!props.selectedValue) return "1";
          const matches = String(d.data.label) === String(props.selectedValue);
          return matches ? "4" : "1";
        })
        .style("filter", d => {
          if (!props.selectedValue) return "none";
          const matches = String(d.data.label) === String(props.selectedValue);
          return matches ? "drop-shadow(0 0 8px rgba(33, 150, 243, 0.6))" : "none";
        })
        .on("click", function(event, d) {
          event.stopPropagation();
          
          emit('segment-click', props.chartId, 'label', d.data.label);
        })
        .on("mouseover", function(event, d) {
          $d3.select(this)
            .style("filter", "brightness(1.1)")
            .style("stroke-width", "3px")
            .style("transform", "scale(1.02)")
            .style("transform-origin", "center");
          
          // Show custom tooltip immediately
          tooltip
            .html(`
              <div style="font-weight: bold; margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.3); padding-bottom: 6px;">
                ${d.data.label}
              </div>
              <div style="margin-bottom: 4px;">
                <span style="color: #94a3b8;">Column:</span> 
                <span style="font-weight: 600;">${props.columnName}</span>
              </div>
              <div style="margin-bottom: 4px;">
                <span style="color: #94a3b8;">Value:</span> 
                <span style="font-weight: 600;">${d.data.value.toLocaleString("en-US")}</span>
              </div>
              <div>
                <span style="color: #94a3b8;">Percentage:</span> 
                <span style="font-weight: 600;">${d.data.percent_value}%</span>
              </div>
            `)
            .style('left', (event.clientX + 15) + 'px')
            .style('top', (event.clientY - 10) + 'px')
            .style('opacity', 1);
        })
        .on("mouseout", function(event, d) {
          $d3.select(this)
            .style("filter", "brightness(1)")
            .style("stroke-width", "1px")
            .style("transform", "scale(1)");
          
          // Hide tooltip
          tooltip.style('opacity', 0);
        })
        .on("mousemove", function(event) {
          // Update tooltip position as mouse moves
          tooltip
            .style('left', (event.clientX + 15) + 'px')
            .style('top', (event.clientY - 10) + 'px');
        });
    svg.append("g")
        .attr("text-anchor", "middle")
      .selectAll()
      .data(arcs)
      .join("text")
        .attr("transform", d => `translate(${arcLabel.centroid(d)})`)
        .call(text => text.append("tspan")
            .attr("y", "-0.4em")
            .attr("font-weight", "bold")
            .attr("font-size", "50px")
            .text(d => d.data.label))
        .call(text => text.filter(d => (d.endAngle - d.startAngle) > 0.25).append("tspan")
            .attr("x", 0)
            .attr("y", "0.7em")
            .attr("fill-opacity", 0.7)
            .attr("font-weight", "bold")
            .attr("font-size", "50px")
            .text(d => `${d.data.percent_value.toLocaleString("en-US")}%`));
    return svg;
  }
  return null;
}

function renderChart(chartData) {
  deleteSVGs();
  renderSVG(chartData);
}
onMounted(async () => {
  renderChart(props.data);
});

onBeforeUnmount(() => {
  deleteSVGs();
});
</script>
<template>
  <div>
    <div :id="`donut-chart-${props.chartId}`"></div>
  </div>
</template>

<style scoped>
@keyframes pulse-selected {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}
</style>
