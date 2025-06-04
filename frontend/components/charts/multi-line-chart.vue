<script setup>
import { onMounted, reactive, watch } from "vue";
const { $d3, $dayjs } = useNuxtApp();

const props = defineProps({
  chartId: {
    type: String,
    required: true,
  },
  keysLabels: {
    type: Object,
    required: true,
  },
  chartData: {
    type: Object,
    required: true,
  },
  xAxisTitle: {
    type: String,
    required: true,
  },
  yAxisTitle: {
    type: String,
    required: true,
  },
  width: {
    type: Number,
    required: true,
    default: 1200,
  },
  height: {
    type: Number,
    required: true,
    default: 500,
  },
  legendsPlacement: {
    type: String,
    required: false,
    default: "right",
  },
});
watch(props, (prop, oldProp) => {
  renderChart();
});
function deleteSVGs() {
  $d3.select(`#multi-line-chart-${props.chartId}`).selectAll("svg").remove();
}
function renderSVG() {
  const margin = {
    top: 50,
    right: 30,
    bottom: 80,
    left: 150,
  };
  const width = props.width - margin.left - margin.right;
  const height = props.height - margin.top - margin.bottom;
  const svgHeight = height + margin.top + margin.bottom;
  const svgWidth = width + margin.left + margin.right;
  const svg = $d3
    .select(`#multi-line-chart-${props.chartId}`)
    .style("height", `${svgHeight}px`)
    .append("svg")
    .attr("width", width * 2)
    .attr("height", height * 2)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top - 10})`);
  return { svg, width, height };
}
function renderTooltip(svg) {
  svg
    .append("g")
    .attr("class", `tooltip-${props.chartId}`)
    .style("opacity", 0)
    .append("rect")
    .attr("class", `tooltip-rect-${props.chartId}`)
    .style("fill", "#32ADE6")
    .attr("width", 150)
    .attr("height", 80)
    .attr("rx", 15);
  svg
    .select(`.tooltip-${props.chartId}`)
    .append("text")
    .attr("class", `tooltip-year-text-${props.chartId}`)
    .attr("x", 10)
    .attr("y", 40)
    .style("font-size", "12px")
    .style("fill", "white");
  svg
    .select(`.tooltip-${props.chartId}`)
    .append("text")
    .attr("class", `tooltip-value-text-${props.chartId}`)
    .attr("x", 10)
    .attr("y", 80)
    .style("font-size", "12px")
    .style("fill", "white");
}
function renderLegend(svg, keys, width, height) {
  const colors = $d3.scaleOrdinal().domain(keys).range($d3.schemeSet1);
  let legend = svg
    .append("g")
    .attr("transform", `translate(${width - 10},10)`)
    .selectAll("g")
    .data(keys)
    .enter()
    .append("g")
    .attr("transform", (d, i) => `translate(0,${i * 20})`);

  let verticalCount = 0;
  if (props.legendsPlacement === "bottom") {
    legend = svg
      .append("g")
      .attr("transform", `translate(${0},${height})`)
      .selectAll("g")
      .data(keys)
      .enter()
      .append("g")
      .attr("transform", (d, i) => {
        console.log("d", d);
        if (i % 2 === 0) {
          verticalCount++;
        }
        console.log("verticalCount", verticalCount);
        return `translate(${(i % 2) * 240}, ${verticalCount * 22})`;
      });
  }

  legend
    .append("rect")
    .attr("x", 0)
    .attr("width", 19)
    .attr("height", 19)
    .attr("fill", (d) => colors(d));
  legend
    .append("text")
    .attr("x", 30)
    .attr("y", 9.5)
    .attr("dy", "0.32em")
    .text((d) => {
      return props.keysLabels.find((key) => d === key.key).label;
    });
}
function renderGraph(svg, width, height) {
  const keys = Object.keys(props.chartData);
  if (keys.length) {
    const colors = $d3.scaleOrdinal().domain(keys).range($d3.schemeSet1);
    const years = $d3.extent(props.chartData[keys[0]], function (d) {
      return d.year;
    });
    let maxVal = -10000;
    keys.forEach((k) => {
      const data = props.chartData[k];
      data.forEach((d) => {
        if (d.value > maxVal) {
          maxVal = d.value;
        }
      });
    });

    const x = $d3.scaleTime().domain(years).range([0, width]);
    const y = $d3
      .scaleLinear()
      .domain([0, maxVal + (1 / 7) * maxVal])
      .range([height, 0]);

    //draw x axis
    svg
      .append("g")
      .attr("transform", `translate(0,${height})`)
      .call(
        $d3
          .axisBottom(x)
          .ticks($d3.timeMonth.every(6))
          .tickFormat($d3.timeFormat("%B %Y")),
      )
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em")
      .attr("transform", function (d) {
        return "rotate(-25)";
      });

    svg
      .append("text")
      .attr("y", 0)
      .attr("x", 0)
      .attr("dy", "1em")
      .attr("transform", `translate(${width / 2},${height + 40})`)
      .style("text-anchor", "middle")
      .style("font-size", "12px")
      .text(props.xAxisTitle)
      .style("font-weight", "bold")
      .style("font-size", "16px");

    //draw y axis
    svg
      .append("text")
      .attr("y", -115)
      .attr("x", -(width / 6))
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .style("font-size", "12px")
      .attr("transform", "rotate(-90)")
      .text(props.yAxisTitle)
      .style("font-weight", "bold")
      .style("font-size", "16px");

    svg
      .append("g")
      .call($d3.axisLeft(y).ticks(10))
      .call((g) =>
        //The following code draws the horizontal grid lines
        g
          .selectAll(".tick line")
          .clone()
          .attr("stroke-opacity", (d) => (d === 1 ? null : 0.2))
          .attr("x2", width),
      );

    keys.forEach((k) => {
      const data = props.chartData[k];

      // Add the line
      svg
        .append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", colors(k))
        .attr("stroke-width", 2)
        .attr("class", `line-${props.chartId}-${k}`)
        .attr(
          "d",
          $d3
            .line()
            .x((d) => x(d.year))
            .y((d) => y(d.value)),
        );

      svg
        .selectAll(`.circle-${props.chartId}-${k}`)
        .data(data)
        .join("circle")
        .attr("class", `circle-${props.chartId}-${k}`)
        .attr("r", 3.5)
        .attr("cy", (d) => y(d.value))
        .attr("cx", (d) => x(d.year))
        .attr("fill", colors(k))
        .style("cursor", "pointer")
        .on("mouseover", function (d) {
          const data = d.target.__data__;
          const date = new Date(data.year);
          const year = `Date: ${$dayjs(date).format("MMMM YYYY")}`;
          const value = `Value: ${data.value.toLocaleString()}`;
          $d3
            .select(`.tooltip-${props.chartId}`)
            .attr("x", x(data.year))
            .attr("y", y(data.value))
            .style("opacity", 1);
          $d3
            .select(`.tooltip-rect-${props.chartId}`)
            .attr("x", x(data.year))
            .attr("y", y(data.value));
          $d3
            .select(`.tooltip-year-text-${props.chartId}`)
            .attr("x", x(data.year) + 10)
            .attr("y", y(data.value) + 35)
            .text(year);

          $d3
            .select(`.tooltip-value-text-${props.chartId}`)
            .attr("x", x(data.year) + 10)
            .attr("y", y(data.value) + 55)
            .text(value);
        })
        .on("mouseout", function (d) {
          $d3.select(`.tooltip-${props.chartId}`).style("opacity", 0);
        });
    });
  }
}
function renderChart() {
  //remove all existing svgs
  deleteSVGs();
  const { svg, width, height } = renderSVG();
  renderGraph(svg, width, height);
  renderLegend(svg, Object.keys(props.chartData), width + 30, height + 60);
  renderTooltip(svg);
}
onMounted(async () => {
  renderChart();
});
</script>
<template>
  <div>
    <div :id="`multi-line-chart-${props.chartId}`" />
  </div>
</template>
