<script setup>
import { onMounted, watch, nextTick } from "vue";
const { $d3 } = useNuxtApp();

const emit = defineEmits(['element-click']);

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
});

watch(props, (prop) => {
  nextTick(() => {
    renderChart(prop.data);
  });
});

function deleteSVGs() {
  $d3.select(`#bubble-chart-${props.chartId}`).selectAll("svg").remove();
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
    .attr("opacity", 0.7)
    .attr("stroke", "#333")
    .style("cursor", "pointer")
    .on("click", function(event, d) {
      event.stopPropagation();
      emit('element-click', {
        chartId: props.chartId,
        chartType: 'bubble',
        clickedElement: {
          type: 'bubble',
          label: d.label,
          value: d.value,
          category: d.category || d.label,
          metadata: {
            radius: d.r,
            xValue: d.x,
            yValue: d.y,
            size: d.r,
            color: d.color || "#36A2EB"
          }
        },
        coordinates: { x: event.offsetX, y: event.offsetY },
        originalEvent: event
      });
    })
    .on("mouseover", function (event, d) {
      $d3.select(this)
        .attr("opacity", 1)
        .style("filter", "brightness(1.1)")
        .attr("stroke-width", "2px");
    })
    .on("mouseout", function (event, d) {
      $d3.select(this)
        .attr("opacity", 0.7)
        .style("filter", "brightness(1)")
        .attr("stroke-width", "1px");
    })
    .append("title")
    .text(d => `${d.label}: ${d.value}`);

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
</script>
<template>
  <div>
    <div :id="`bubble-chart-${props.chartId}`"></div>
  </div>
</template>
