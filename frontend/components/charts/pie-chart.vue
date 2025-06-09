<script setup>
import { onMounted, watch } from "vue";
const { $d3 } = useNuxtApp();

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
watch(props, (prop, oldProp) => {
  renderChart();
});
function deleteSVGs() {
  $d3.select(`#pie-chart-${props.chartId}`).selectAll("svg").remove();
}
function renderSVG() {
 const margin = {
    top: 50,
    right: 50,
    bottom: 100,
    left: 50,
  };
  const width = props.width - margin.left - margin.right;
  const height = props.height - margin.top - margin.bottom;
  const svgHeight = height + margin.top + margin.bottom;
  const svgWidth = width + margin.left + margin.right;
  const color = $d3.scaleOrdinal(props.data.map((d) => d.label), $d3.schemeCategory10);
  
  console.log('props.width', props.width, 'props.height', props.height, 'width', width, 'height', height, 'svgWidth', svgWidth, 'svgHeight', svgHeight);

  const total = props.data.reduce((total, item) => total + item.value, 0)
  const data = props.data.map((d) => {
    return {
      ...d,
      percent_value: Math.round((d.value / total) * 100),
    };
  });
  console.log('data', data);

  const pie = $d3.pie()
        .sort(null)
        .value((d) => d.value);
  
  const arc = $d3.arc()
        .innerRadius(0)
        .outerRadius((Math.min(width, height) / 2) - 1);
  
  const labelRadius = arc.outerRadius()() * 0.8;
  const arcLabel = $d3.arc()
      .innerRadius(labelRadius)
      .outerRadius(labelRadius);
  const arcs = pie(data);
  const svg = $d3.select(`#pie-chart-${props.chartId}`)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [-width / 2, -height / 2, width, height])
      .attr("style", "max-width: 100%; height: auto; font: 15px sans-serif;");
  svg.append("g")
      .attr("stroke", "white")
    .selectAll()
    .data(arcs)
    .join("path")
      .attr("fill", d => color(d.data.label))
      .attr("d", arc)
    .append("title")
      .text(d => `${d.data.label}: ${d.data.percent_value.toLocaleString("en-US")}%`);
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


function renderChart() {
  //remove all existing svgs
  deleteSVGs();
  renderSVG();
}
onMounted(async () => {
  renderChart();
  console.log('pie chart props.data', props.data);
});
</script>
<template>
  <div>
    <div :id="`pie-chart-${props.chartId}`"></div>
  </div>
</template>
