<script setup>
import { onMounted, watch, nextTick } from 'vue';
const { $d3 } = useNuxtApp();

const emit = defineEmits(['element-click']);

const props = defineProps({
  chartId: {
    type: String,
    required: true,
  },
  data: {
    type: Object,
    required: true,
    // Expected format: { name: "root", children: [...] }
  },
  width: {
    type: Number,
    default: 800,
  },
  height: {
    type: Number,
    default: 500,
  },
  colorScheme: {
    type: String,
    default: 'schemeCategory10', // D3 color scheme
  },
  showLabels: {
    type: Boolean,
    default: true,
  },
  showValues: {
    type: Boolean,
    default: true,
  },
  labelFontSize: {
    type: Number,
    default: 12,
  },
  valueFontSize: {
    type: Number,
    default: 10,
  },
  enableTooltips: {
    type: Boolean,
    default: true,
  },
  minTileSize: {
    type: Number,
    default: 30, // Minimum tile size for labels
  }
});

function deleteSVGs() {
  $d3.select(`#treemap-chart-${props.chartId}`).selectAll('svg').remove();
}

function processTreemapData(rawData) {
  // Convert database rows to Option A (Simple Hierarchical) format
  if (!rawData.rows || rawData.rows.length === 0) {
    return { name: "No Data", children: [] };
  }

  const root = { name: rawData.name || "Root", children: [] };
  const categoryMap = new Map();

  rawData.rows.forEach(row => {
    const columns = rawData.columns;
    
    if (columns.length >= 3) {
      // 3 columns: category + subcategory + value
      const category = row[columns[0]];
      const subcategory = row[columns[1]];
      const value = parseFloat(row[columns[2]]) || 0;

      if (!categoryMap.has(category)) {
        const categoryNode = { name: category, children: [] };
        categoryMap.set(category, categoryNode);
        root.children.push(categoryNode);
      }

      categoryMap.get(category).children.push({
        name: subcategory,
        value: value
      });
    } else if (columns.length >= 2) {
      // 2 columns: category + value
      const category = row[columns[0]];
      const value = parseFloat(row[columns[1]]) || 0;

      root.children.push({
        name: category,
        value: value
      });
    }
  });
  return root;
}

function getColorScale() {
  const schemes = {
    'schemeCategory10': $d3.schemeCategory10,
    'schemeAccent': $d3.schemeAccent,
    'schemeDark2': $d3.schemeDark2,
    'schemeSet1': $d3.schemeSet1,
    'schemeSet2': $d3.schemeSet2,
    'schemeSet3': $d3.schemeSet3,
    'schemePastel1': $d3.schemePastel1,
    'schemePastel2': $d3.schemePastel2
  };
  
  return $d3.scaleOrdinal(schemes[props.colorScheme] || $d3.schemeCategory10);
}

const shouldShowLabel = (d) => {
  const width = d.x1 - d.x0;
  const height = d.y1 - d.y0;
  
  // Check if this is a child of a parent category
  const hasParentLabel = d.parent && d.parent.children && d.parent.depth === 1;
  const parentLabelHeight = hasParentLabel ? 22 : 0;
  const availableHeight = height - parentLabelHeight;
  
  // Minimum size requirements
  const minWidth = 40;
  let minHeight = 20; // Base minimum height
  
  // Adjust minimum height based on what will be shown
  if (props.showLabels) minHeight += 16;
  if (props.showValues) minHeight += 16;
  
  return width >= minWidth && availableHeight >= minHeight;
};

function truncateText(text, maxWidth, fontSize) {
  const charWidth = fontSize * 0.6; // Approximate character width
  const maxChars = Math.floor(maxWidth / charWidth);
  if (text.length > maxChars) {
    return text.substring(0, maxChars - 3) + '...';
  }
  return text;
}

function renderSVG(chartData) {
  const margin = { top: 20, right: 20, bottom: 20, left: 20 };
  const width = props.width - margin.left - margin.right;
  const height = props.height - margin.top - margin.bottom;

  // Process data to Option A format
  const processedData = processTreemapData(chartData);
  
  if (!processedData.children || processedData.children.length === 0) {
    // Show "No Data" message
    const svg = $d3.select(`#treemap-chart-${props.chartId}`)
      .append('svg')
      .attr('width', props.width)
      .attr('height', props.height);
      
    svg.append('text')
      .attr('x', props.width / 2)
      .attr('y', props.height / 2)
      .attr('text-anchor', 'middle')
      .attr('font-size', 16)
      .attr('fill', '#666')
      .text('No data available for treemap');
    return;
  }

  // Create D3 hierarchy and treemap layout
  const root = $d3.hierarchy(processedData)
    .sum(d => d.value || 0)
    .sort((a, b) => (b.value || 0) - (a.value || 0));

  const treemap = $d3.treemap()
    .size([width, height])
    .padding(2)
    .round(true);

  treemap(root);

  // Color scale
  const color = getColorScale();

  // SVG creation
  const svg = $d3.select(`#treemap-chart-${props.chartId}`)
    .append('svg')
    .attr('width', props.width)
    .attr('height', props.height)
    .attr('viewBox', [0, 0, props.width, props.height])
    .attr('style', 'max-width: 100%; height: auto; font: sans-serif;')
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Render leaf nodes (actual data tiles)
  const leaf = svg.selectAll('.leaf')
    .data(root.leaves())
    .join('g')
    .attr('class', 'leaf')
    .attr('transform', d => `translate(${d.x0},${d.y0})`);

  // Add rectangles with hover effects
  leaf.append('rect')
    .attr('width', d => d.x1 - d.x0)
    .attr('height', d => d.y1 - d.y0)
    .attr('fill', d => {
      // Use parent color for leaf nodes, or own color if no parent
      const colorKey = d.parent ? d.parent.data.name : d.data.name;
      return color(colorKey);
    })
    .attr('stroke', '#fff')
    .attr('stroke-width', 1)
    .attr('rx', 2)
    .attr('ry', 2)
    .style('cursor', 'pointer')
    .on('click', function(event, d) {
      event.stopPropagation();
      emit('element-click', {
        chartId: props.chartId,
        chartType: 'treemap',
        clickedElement: {
          type: 'tile',
          label: d.data.name || d.data.label,
          value: d.value,
          category: d.parent?.data?.name || 'root',
          metadata: {
            depth: d.depth,
            area: d.value,
            bounds: { x0: d.x0, y0: d.y0, x1: d.x1, y1: d.y1 },
            width: d.x1 - d.x0,
            height: d.y1 - d.y0,
            parentName: d.parent?.data?.name
          }
        },
        coordinates: { x: event.offsetX, y: event.offsetY },
        originalEvent: event
      });
    })
    .on('mouseover', function(event, d) {
      $d3.select(this)
        .attr('stroke', '#333')
        .attr('stroke-width', 2)
        .style('opacity', 0.8);
    })
    .on('mouseout', function(event, d) {
      $d3.select(this)
        .attr('stroke', '#fff')
        .attr('stroke-width', 1)
        .style('opacity', 1);
    });

  // Add category labels for parent nodes (if there are subcategories)
  const parents = root.descendants().filter(d => d.depth === 1 && d.children);
  const hasParentLabels = parents.length > 0;
  const parentLabelHeight = hasParentLabels ? 22 : 0; // Height reserved for parent labels

  if (hasParentLabels) {
    const parentLabels = svg.selectAll('.parent-label')
      .data(parents)
      .join('g')
      .attr('class', 'parent-label');

    parentLabels.append('rect')
      .attr('x', d => d.x0)
      .attr('y', d => d.y0)
      .attr('width', d => d.x1 - d.x0)
      .attr('height', parentLabelHeight)
      .attr('fill', d => color(d.data.name))
      .attr('opacity', 0.3)
      .attr('stroke', '#fff')
      .attr('stroke-width', 1);

    parentLabels.append('text')
      .attr('x', d => d.x0 + 4)
      .attr('y', d => d.y0 + 14)
      .attr('font-size', Math.min(props.labelFontSize + 2, 16))
      .attr('font-weight', 'bold')
      .attr('fill', '#000')
      .text(d => {
        const maxWidth = (d.x1 - d.x0) - 8;
        return truncateText(d.data.name, maxWidth, props.labelFontSize + 2);
      });
  }

  // Add labels if enabled and tile is large enough
  if (props.showLabels) {
    leaf.filter(d => shouldShowLabel(d))
      .append('text')
      .attr('x', 4)
      .attr('y', d => {
        // If this leaf has a parent with children (hierarchical), adjust Y position
        const hasParentLabel = d.parent && d.parent.children && d.parent.depth === 1;
        return hasParentLabel ? parentLabelHeight + 14 : 14;
      })
      .attr('font-size', props.labelFontSize)
      .attr('font-weight', 'bold')
      .attr('fill', '#000')
      .text(d => {
        const maxWidth = (d.x1 - d.x0) - 8; // Account for padding
        return truncateText(d.data.name, maxWidth, props.labelFontSize);
      });
  }

  // Add values if enabled and tile is large enough
  if (props.showValues) {
    leaf.filter(d => shouldShowLabel(d))
      .append('text')
      .attr('x', 4)
      .attr('y', d => {
        const hasParentLabel = d.parent && d.parent.children && d.parent.depth === 1;
        let baseY = hasParentLabel ? parentLabelHeight : 0;
        
        if (props.showLabels) {
          baseY += 26; // Add space for the label
        } else {
          baseY += 14; // No label, just basic spacing
        }
        return baseY;
      })
      .attr('font-size', props.valueFontSize)
      .attr('fill', '#555')
      .text(d => {
        const value = d.value || 0;
        if (value >= 1000000) {
          return (value / 1000000).toFixed(1) + 'M';
        } else if (value >= 1000) {
          return (value / 1000).toFixed(1) + 'K';
        }
        return value.toLocaleString();
      });
  }

  // Add tooltips if enabled
  if (props.enableTooltips) {
    leaf.append('title')
      .text(d => {
        const path = d.parent ? `${d.parent.data.name} > ${d.data.name}` : d.data.name;
        const value = (d.value || 0).toLocaleString();
        return `${path}\nValue: ${value}`;
      });
  }
}

function renderChart(chartData) {
  deleteSVGs();
  nextTick(() => {
    renderSVG(chartData);
  });
}

// Lifecycle and watchers
onMounted(() => {
  renderChart(props.data);
});

watch(() => [props.data, props.width, props.height], () => {
  renderChart(props.data);
});

watch(() => [props.colorScheme, props.showLabels, props.showValues, props.labelFontSize, props.valueFontSize, props.minTileSize], () => {
  renderChart(props.data);
});
</script>

<template>
  <div>
    <div :id="`treemap-chart-${props.chartId}`"></div>
  </div>
</template>
