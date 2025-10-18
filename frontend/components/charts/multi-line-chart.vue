<script setup>
import { onMounted, watch, nextTick, reactive } from 'vue';
const { $d3 } = useNuxtApp();

const emit = defineEmits(['element-click', 'update:yAxisLabel', 'update:xAxisLabel']);

const state = reactive({
    xAxisLabelLocal: '',
    yAxisLabelLocal: '',
    hoveredPoint: null,
    selectedSeries: [],
    hiddenSeries: new Set()
});

const props = defineProps({
    chartId: {
        type: String,
        required: true,
    },
    data: {
        type: Object,
        required: true,
        // Expected format:
        // {
        //   categories: ['Jan', 'Feb', 'Mar', ...],
        //   series: [
        //     { name: 'Series 1', data: [10, 20, 15, ...], color: '#ff6b6b' },
        //     { name: 'Series 2', data: [5, 15, 25, ...], color: '#4ecdc4' }
        //   ]
        // }
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
    showDataPoints: {
        type: Boolean,
        default: true,
    },
    enableTooltips: {
        type: Boolean,
        default: true,
    },
    curveType: {
        type: String,
        default: 'monotoneX',
    },
    showGrid: {
        type: Boolean,
        default: true,
    },
    legendPosition: {
        type: String,
        default: 'right',
        validator: (value) => ['right', 'bottom', 'top'].includes(value)
    },
    maxLegendWidth: {
        type: Number,
        default: 400,
    },
    legendLineHeight: {
        type: Number,
        default: 25,
    },
    legendItemSpacing: {
        type: Number,
        default: 25,
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
    }
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
    const maxLabelLength = Math.max(...chartData.map(d => d.length));
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
    $d3.select(`#multi-line-chart-${props.chartId}`).selectAll('svg').remove();
}

function processData(rawData) {
    if (!rawData || !rawData.categories || !rawData.series) {
        return { categories: [], series: [], yMax: 0, yMin: 0 };
    }

    // Calculate combined min/max for Y-scale across all visible series
    let yMax = -Infinity;
    let yMin = Infinity;

    rawData.series.forEach((series, index) => {
        if (!state.hiddenSeries.has(series.name)) {
            const seriesMax = $d3.max(series.data);
            const seriesMin = $d3.min(series.data);
            
            if (seriesMax > yMax) yMax = seriesMax;
            if (seriesMin < yMin) yMin = seriesMin;
        }
    });

    // Handle case where all series are hidden
    if (yMax === -Infinity) {
        yMax = 1;
        yMin = 0;
    }

    // Add some padding to the y-scale
    const padding = (yMax - yMin) * 0.1;
    yMax += padding;
    yMin = Math.max(0, yMin - padding);

    return {
        categories: rawData.categories,
        series: rawData.series,
        yMax,
        yMin
    };
}

function generateColorScheme(seriesCount) {
    const colors = $d3.schemeCategory10;
    return colors.slice(0, seriesCount);
}

function renderSVG(chartData) {
    const processedData = processData(chartData);
    
    // Calculate legend lines first to adjust margin
    let legendLines = 1;
    let legendSpacing = 0;
    
    if (props.legendPosition === 'right') {
        legendSpacing = 120; // Base spacing for right legend
    } else if (props.legendPosition === 'top') {
        // Calculate how many lines the legend will need
        let currentX = 0;
        legendLines = 1;
        
        processedData.series.forEach((series) => {
            const estimatedTextWidth = series.name.length * 8 + 50; // Rough estimation for line + circle + text
            if (currentX + estimatedTextWidth > props.maxLegendWidth && currentX > 0) {
                legendLines++;
                currentX = estimatedTextWidth;
            } else {
                currentX += estimatedTextWidth;
            }
        });
    }
    
    // Calculate dynamic bottom margin based on X-axis rotation
    const baseBottomMargin = 80;
    const xAxisLabelOffset = calculateXAxisLabelPosition(processedData.categories, props.xAxisRotation, baseBottomMargin);
    const dynamicBottomMargin = Math.max(baseBottomMargin, xAxisLabelOffset + 40); // Extra space for axis label
    
    const margin = { 
        top: props.legendPosition === 'top' ? 40 + (legendLines - 1) * props.legendLineHeight : 40, 
        right: 30 + legendSpacing, 
        bottom: dynamicBottomMargin, 
        left: 80 
    };
    
    const svgWidth = props.width;
    const svgHeight = props.height;
    const width = svgWidth - margin.left - margin.right;
    const height = svgHeight - margin.top - margin.bottom;

    const svg = $d3.select(`#multi-line-chart-${props.chartId}`)
        .append('svg')
        .attr('width', svgWidth)
        .attr('height', svgHeight)
        .attr("viewBox", [0, 0, svgWidth, svgHeight])
        .attr("style", "max-width: 100%; height: auto;")
        .append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top})`);

    const scales = renderAxes(svg, width, height, processedData);
    renderLines(svg, width, height, processedData, scales);
    
    if (props.showDataPoints) {
        renderPoints(svg, width, height, processedData, scales);
    }
    
    if (props.legendPosition === 'right') {
        renderLegend(svg, width, height, processedData, margin);
    } else if (props.legendPosition === 'top') {
        renderLegend(svg, width, height, processedData, margin);
    }
    
    renderAxisLabels(svg, width, height, margin, processedData);
}

function renderAxes(svg, width, height, data) {
    // X axis - using scalePoint for evenly distributed categories
    const x = $d3.scalePoint()
        .domain(data.categories)
        .range([0, width])
        .padding(0.1);

    const xAxis = svg.append('g')
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
        .domain([data.yMin, data.yMax])
        .range([height, 0]);

    const yAxis = svg.append('g')
        .call($d3.axisLeft(y).tickFormat(formatTickValue));
        
    yAxis.selectAll('text')
        .style('text-anchor', 'end')
        .style('font-size', '12px')
        .style('fill', 'black')
        .style('font-weight', 'bold');

    // Style axis lines
    svg.selectAll('.tick line')
        .style('stroke', 'black');
    svg.selectAll('.domain')
        .style('stroke', 'black');

    // Add grid lines if enabled
    if (props.showGrid) {
        // Horizontal grid lines
        svg.selectAll('.horizontal-grid')
            .data(y.ticks())
            .join('line')
            .attr('class', 'horizontal-grid')
            .attr('x1', 0)
            .attr('x2', width)
            .attr('y1', d => y(d))
            .attr('y2', d => y(d))
            .style('stroke', '#e0e0e0')
            .style('stroke-width', 0.5)
            .style('stroke-dasharray', '2,2');

        // Vertical grid lines
        svg.selectAll('.vertical-grid')
            .data(data.categories)
            .join('line')
            .attr('class', 'vertical-grid')
            .attr('x1', d => x(d))
            .attr('x2', d => x(d))
            .attr('y1', 0)
            .attr('y2', height)
            .style('stroke', '#e0e0e0')
            .style('stroke-width', 0.5)
            .style('stroke-dasharray', '2,2');
    }

    // Store scales for other functions
    svg.property('xScale', x);
    svg.property('yScale', y);

    // Return scales for direct use
    return { x, y };
}

function renderLines(svg, width, height, data, scales) {
    const { x, y } = scales;
    const defaultColors = generateColorScheme(data.series.length);

    // Get curve function based on curveType prop
    const curveFunction = $d3[`curve${props.curveType.charAt(0).toUpperCase()}${props.curveType.slice(1)}`] || $d3.curveMonotoneX;

    // Line generator
    const line = $d3.line()
        .x((d, i) => x(data.categories[i]))
        .y(d => y(d))
        .curve(curveFunction);

    data.series.forEach((series, index) => {
        if (state.hiddenSeries.has(series.name)) {
            return; // Skip hidden series
        }

        const color = series.color || defaultColors[index % defaultColors.length];
        
        // Add line path without animation
        const path = svg.append('path')
            .datum(series.data)
            .attr('class', `line-series-${index}`)
            .attr('fill', 'none')
            .attr('stroke', color)
            .attr('stroke-width', 2.5)
            .attr('d', line);
    });
}

function renderPoints(svg, width, height, data, scales) {
    const { x, y } = scales;
    const defaultColors = generateColorScheme(data.series.length);

    data.series.forEach((series, seriesIndex) => {
        if (state.hiddenSeries.has(series.name)) {
            return; // Skip hidden series
        }

        const color = series.color || defaultColors[seriesIndex % defaultColors.length];
        
        // Create circles for each data point
        const points = svg.selectAll(`.points-series-${seriesIndex}`)
            .data(series.data)
            .join('circle')
            .attr('class', `points-series-${seriesIndex}`)
            .attr('cx', (d, i) => x(data.categories[i]))
            .attr('cy', d => y(d))
            .attr('r', 4)
            .attr('fill', color)
            .attr('stroke', '#fff')
            .attr('stroke-width', 2);

        if (props.enableTooltips) {
            setupPointInteractions(points, series, seriesIndex, data);
        }
    });
}

function setupPointInteractions(points, series, seriesIndex, data) {
    points
        .style('cursor', 'pointer')
        .on('click', function(event, d) {
            event.stopPropagation();
            const pointIndex = points.nodes().indexOf(this);
            emit('element-click', {
              chartId: props.chartId,
              chartType: 'multiline',
              clickedElement: {
                type: 'data_point',
                label: data.categories[pointIndex],
                value: d,
                category: series.name,
                metadata: {
                  seriesName: series.name,
                  pointIndex: pointIndex,
                  seriesColor: series.color,
                  seriesIndex: seriesIndex
                }
              },
              coordinates: { x: event.offsetX, y: event.offsetY },
              originalEvent: event
            });
        })
        .on('mouseover', function(event, d) {
            const pointIndex = points.nodes().indexOf(this);
            $d3.select(this).attr('r', 6);
            
            if (props.enableTooltips) {
                showTooltip(event, d, pointIndex, series, data);
            }
        })
        .on('mouseout', function(event, d) {
            $d3.select(this).attr('r', 4);
            
            hideTooltip();
        });
}

function showTooltip(event, value, pointIndex, series, data) {
    const tooltip = $d3.select('body').selectAll('.line-chart-tooltip')
        .data([0])
        .join('div')
        .attr('class', 'line-chart-tooltip')
        .style('position', 'absolute')
        .style('background', 'rgba(0,0,0,0.8)')
        .style('color', 'white')
        .style('padding', '10px')
        .style('border-radius', '5px')
        .style('font-size', '12px')
        .style('pointer-events', 'none')
        .style('z-index', '1000');

    const content = `
        <div><strong>${data.categories[pointIndex]}</strong></div>
        <div style="color: ${series.color || '#ff6b6b'}">${series.name}: ${value}</div>
    `;

    tooltip
        .html(content)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 10) + 'px')
        .style('opacity', 0)
        .transition()
        .duration(200)
        .style('opacity', 1);
}

function hideTooltip() {
    $d3.select('.line-chart-tooltip')
        .transition()
        .duration(200)
        .style('opacity', 0)
        .remove();
}

function renderLegend(svg, width, height, data, margin) {
    const defaultColors = generateColorScheme(data.series.length);
    
    if (props.legendPosition === 'top') {
        // Top legend with dynamic positioning and line wrapping
        let currentX = 0;
        let currentLine = 0;
        
        const legendContainer = svg.append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(${width / 4}, ${-margin.top + 20})`);

        data.series.forEach((series, index) => {
            // Create temporary text to measure width
            const tempText = svg.append('text')
                .text(series.name)
                .style('font-size', '12px')
                .style('opacity', 0);
            
            const textWidth = tempText.node().getComputedTextLength();
            tempText.remove();
            
            const itemWidth = textWidth + 30 + props.legendItemSpacing; // 30 for line + circle + spacing
            
            // Check if we need to wrap to next line
            if (currentX + itemWidth > props.maxLegendWidth && currentX > 0) {
                currentLine++;
                currentX = 0;
            }
            
            const color = series.color || defaultColors[index % defaultColors.length];
            const isHidden = state.hiddenSeries.has(series.name);
            
            const legendItem = legendContainer.append('g')
                .attr('class', `legend-item-${index}`)
                .attr('transform', `translate(${currentX}, ${currentLine * props.legendLineHeight})`)
                .style('cursor', 'pointer')
                .style('opacity', isHidden ? 0.5 : 1);

            // Color indicator (line + circle)
            legendItem.append('line')
                .attr('x1', 0)
                .attr('x2', 15)
                .attr('y1', 8)
                .attr('y2', 8)
                .attr('stroke', color)
                .attr('stroke-width', 2.5);

            legendItem.append('circle')
                .attr('cx', 7.5)
                .attr('cy', 8)
                .attr('r', 3)
                .attr('fill', color)
                .attr('stroke', '#fff')
                .attr('stroke-width', 1);

            // Text label
            const text = legendItem.append('text')
                .attr('x', 25)
                .attr('y', 8)
                .attr('dy', '0.35em')
                .style('font-size', '12px')
                .style('font-weight', 'bold')
                .style('fill', '#333')
                .text(series.name);

            if (isHidden) {
                text.style('text-decoration', 'line-through');
            }

            // Click interaction
            legendItem.on('click', () => {
                toggleSeries(series.name);
            });
            
            currentX += itemWidth;
        });
        
    } else if (props.legendPosition === 'right') {
        // Right legend with improved positioning (within bounds)
        const legendContainer = svg.append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(${width + 20}, 20)`);

        let currentY = 0;
        const itemHeight = 25;

        data.series.forEach((series, index) => {
            const color = series.color || defaultColors[index % defaultColors.length];
            const isHidden = state.hiddenSeries.has(series.name);
            
            const legendItem = legendContainer.append('g')
                .attr('class', `legend-item-${index}`)
                .attr('transform', `translate(0, ${currentY})`)
                .style('cursor', 'pointer')
                .style('opacity', isHidden ? 0.5 : 1);

            // Color indicator (line + circle)
            legendItem.append('line')
                .attr('x1', 0)
                .attr('x2', 15)
                .attr('y1', 8)
                .attr('y2', 8)
                .attr('stroke', color)
                .attr('stroke-width', 2.5);

            legendItem.append('circle')
                .attr('cx', 7.5)
                .attr('cy', 8)
                .attr('r', 3)
                .attr('fill', color)
                .attr('stroke', '#fff')
                .attr('stroke-width', 1);

            // Text label
            const text = legendItem.append('text')
                .attr('x', 25)
                .attr('y', 8)
                .attr('dy', '0.35em')
                .style('font-size', '12px')
                .style('font-weight', 'bold')
                .style('fill', '#333')
                .text(series.name);

            if (isHidden) {
                text.style('text-decoration', 'line-through');
            }

            // Click interaction
            legendItem.on('click', () => {
                toggleSeries(series.name);
            });

            currentY += itemHeight;
        });
    }
}

function toggleSeries(seriesName) {
    if (state.hiddenSeries.has(seriesName)) {
        state.hiddenSeries.delete(seriesName);
    } else {
        state.hiddenSeries.add(seriesName);
    }
    
    // Re-render the chart
    renderChart(props.data);
}

function renderAxisLabels(svg, width, height, margin, data) {
    // Y axis title - conditional rendering
    const yInputWidth = Math.min(150, height * 0.4);
    const yInputHeight = 35;
    
    if (props.editableAxisLabels) {
        // Editable input
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

    // X axis title - conditional rendering with dynamic positioning
    const xInputWidth = Math.min(250, width * 0.5);
    const xInputHeight = 35;
    const xAxisLabelOffset = calculateXAxisLabelPosition(data.categories, props.xAxisRotation, 80);
    const xAxisLabelY = height + xAxisLabelOffset;
    
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

function renderChart(chartData) {
    deleteSVGs();
    renderSVG(chartData);
}

onMounted(() => {
    state.xAxisLabelLocal = props.xAxisLabel;
    state.yAxisLabelLocal = props.yAxisLabel;
    renderChart(props.data);
});

watch(() => [props.data, props.width, props.height, props.xAxisRotation, props.enableTickShortening, props.editableAxisLabels], () => {
    nextTick(() => renderChart(props.data));
});

watch(() => props.xAxisLabel, (newVal) => {
    state.xAxisLabelLocal = newVal;
});

watch(() => props.yAxisLabel, (newVal) => {
    state.yAxisLabelLocal = newVal;
});
</script>

<template>
    <div>
        <div :id="`multi-line-chart-${props.chartId}`"></div>
    </div>
</template>
