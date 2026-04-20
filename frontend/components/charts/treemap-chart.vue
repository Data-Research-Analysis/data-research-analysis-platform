<script setup lang="ts">
import { onMounted, watch, nextTick, onBeforeUnmount } from 'vue';
const { $d3 } = useNuxtApp();
const d3 = $d3 as any;

const emit = defineEmits<{ 'segment-click': [chartId: any, column: any, value: any] }>();

interface Props {
  chartId: string
  data: any
  width?: number
  height?: number
  colorScheme?: string
  showLabels?: boolean
  showValues?: boolean
  labelFontSize?: number
  valueFontSize?: number
  enableTooltips?: boolean
  minTileSize?: number
  categoryName?: string
  valueName?: string
  categoryColumn?: string
  selectedValue?: string | null
  filterState?: any
}
const props = withDefaults(defineProps<Props>(), {
  width: 800,
  height: 500,
  colorScheme: 'schemeCategory10',
  showLabels: true,
  showValues: true,
  labelFontSize: 12,
  valueFontSize: 10,
  enableTooltips: true,
  minTileSize: 30,
  categoryName: 'Category',
  valueName: 'Value',
  categoryColumn: 'category',
  selectedValue: null,
  filterState: () => ({ activeFilter: null, isFiltering: false }),
});
let tooltipElement: any = null;

function deleteSVGs() {
  d3.select(`#treemap-chart-${props.chartId}`).selectAll('svg').remove();
  
  // Remove tooltip explicitly
  if (tooltipElement) {
    tooltipElement.remove();
    tooltipElement = null;
  }
  // Also remove by class as fallback
  d3.selectAll(`.treemap-tooltip-${props.chartId}`).remove();
}

function processTreemapData(rawData: any) {
  // Convert database rows to Option A (Simple Hierarchical) format
  if (!rawData.rows || rawData.rows.length === 0) {
    return { name: "No Data", children: [] };
  }

  interface TreeNode {
    name: string;
    children?: TreeNode[];
    value?: number;
  }

  const root: TreeNode = { name: rawData.name || "Root", children: [] };
  const categoryMap = new Map<any, TreeNode>();

  rawData.rows.forEach((row: any) => {
    const columns = rawData.columns;
    
    if (columns.length >= 3) {
      // 3 columns: category + subcategory + value
      const category = row[columns[0]];
      const subcategory = row[columns[1]];
      const value = parseFloat(row[columns[2]]) || 0;

      if (!categoryMap.has(category)) {
        const categoryNode: TreeNode = { name: category, children: [] };
        categoryMap.set(category, categoryNode);
        root.children!.push(categoryNode);
      }

      categoryMap.get(category)!.children!.push({
        name: subcategory,
        value: value
      });
    } else if (columns.length >= 2) {
      // 2 columns: category + value
      const category = row[columns[0]];
      const value = parseFloat(row[columns[1]]) || 0;

      root.children!.push({
        name: category,
        value: value
      });
    }
  });
  return root;
}

function getColorScale() {
  const schemes = {
    'schemeCategory10': d3.schemeCategory10,
    'schemeAccent': d3.schemeAccent,
    'schemeDark2': d3.schemeDark2,
    'schemeSet1': d3.schemeSet1,
    'schemeSet2': d3.schemeSet2,
    'schemeSet3': d3.schemeSet3,
    'schemePastel1': d3.schemePastel1,
    'schemePastel2': d3.schemePastel2
  };
  
  return d3.scaleOrdinal((schemes as any)[props.colorScheme] || d3.schemeCategory10);
}

const shouldShowLabel = (d: any) => {
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

function truncateText(text: any, maxWidth: any, fontSize: any) {
  const charWidth = fontSize * 0.6; // Approximate character width
  const maxChars = Math.floor(maxWidth / charWidth);
  if (text.length > maxChars) {
    return text.substring(0, maxChars - 3) + '...';
  }
  return text;
}

function renderSVG(chartData: any) {
  const margin = { top: 20, right: 20, bottom: 20, left: 20 };
  const width = props.width - margin.left - margin.right;
  const height = props.height - margin.top - margin.bottom;

  // Process data to Option A format
  const processedData = processTreemapData(chartData);
  
  if (!processedData.children || processedData.children.length === 0) {
    // Show "No Data" message
    const svg = d3.select(`#treemap-chart-${props.chartId}`)
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
  const root = d3.hierarchy(processedData)
    .sum((d: any) => d.value || 0)
    .sort((a: any, b: any) => (b.value || 0) - (a.value || 0));

  const treemap = d3.treemap()
    .size([width, height])
    .padding(2)
    .round(true);

  treemap(root);

  // Color scale
  const color = getColorScale();

  // SVG creation
  const svg = d3.select(`#treemap-chart-${props.chartId}`)
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
    .attr('transform', (d: any) => `translate(${d.x0},${d.y0})`);

  // Add rectangles with hover effects
  leaf.append('rect')
    .attr('width', (d: any) => d.x1 - d.x0)
    .attr('height', (d: any) => d.y1 - d.y0)
    .attr('fill', (d: any) => {
      // Use parent color for leaf nodes, or own color if no parent
      const colorKey = d.parent ? d.parent.data.name : d.data.name;
      return color(colorKey);
    })
    .attr('stroke', '#fff')
    .attr('stroke-width', 1)
    .attr('rx', 2)
    .attr('ry', 2)
    .style('cursor', 'pointer')
    .style('opacity', (d: any) => {
      // Apply filtering logic
      if (!props.selectedValue) return 1.0;
      const nodeName = d.data.name || d.data.label;
      return String(nodeName) === String(props.selectedValue) ? 1.0 : 0.3;
    })
    .style('transition', 'opacity 0.3s ease')
    .on('click', function(event: any, d: any) {
      event.stopPropagation();
      const nodeName = d.data.name || d.data.label;
      
      emit('segment-click', props.chartId, 'label', nodeName);
    } as any);

  // Create custom tooltip for instant display in dashboard container
  const tooltip = d3.select('.dashboard-tooltip-container')
    .append('div')
    .attr('class', `treemap-tooltip treemap-tooltip-${props.chartId}`)
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

  // Attach tooltip handlers to treemap rectangles
  leaf.selectAll('rect')
    .on('mouseover', function(this: any, event: any, d: any) {
      d3.select(this as any)
        .attr('stroke', '#333')
        .attr('stroke-width', 3)
        .style('filter', 'brightness(1.1)');
      
      // Build tooltip content
      let tooltipContent = `
        <div style="font-weight: bold; margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.3); padding-bottom: 6px;">
          ${d.data.name}
        </div>
        <div style="margin-bottom: 4px;">
          <span style="color: #94a3b8;">${props.categoryName}:</span> 
          <span style="font-weight: 600;">${d.data.name}</span>
        </div>
        <div style="margin-bottom: 4px;">
          <span style="color: #94a3b8;">${props.valueName}:</span> 
          <span style="font-weight: 600;">${d.value.toLocaleString('en-US')}</span>
        </div>`;
      
      // Add parent info if exists
      if (d.parent && d.parent.data.name !== 'Root') {
        tooltipContent += `
        <div style="border-top: 1px solid rgba(255,255,255,0.2); margin-top: 6px; padding-top: 6px;">
          <span style="color: #94a3b8;">Parent:</span> 
          <span style="font-weight: 600;">${d.parent.data.name}</span>
        </div>`;
      }
      
      tooltip
        .html(tooltipContent)
        .style('left', (event.clientX + 15) + 'px')
        .style('top', (event.clientY - 10) + 'px')
        .style('opacity', 1);
    })
    .on('mouseout', function(this: any, event: any, d: any) {
      d3.select(this as any)
        .attr('stroke', '#fff')
        .attr('stroke-width', 1)
        .style('filter', 'brightness(1)');
      
      // Hide tooltip
      tooltip.style('opacity', 0);
    })
    .on('mousemove', function(event: any) {
      // Update tooltip position as mouse moves
      tooltip
        .style('left', (event.clientX + 15) + 'px')
        .style('top', (event.clientY - 10) + 'px');
    });

  // Add category labels for parent nodes (if there are subcategories)
  const parents = root.descendants().filter((d: any) => d.depth === 1 && d.children);
  const hasParentLabels = parents.length > 0;
  const parentLabelHeight = hasParentLabels ? 22 : 0; // Height reserved for parent labels

  if (hasParentLabels) {
    const parentLabels = svg.selectAll('.parent-label')
      .data(parents)
      .join('g')
      .attr('class', 'parent-label');

    parentLabels.append('rect')
      .attr('x', (d: any) => d.x0)
      .attr('y', (d: any) => d.y0)
      .attr('width', (d: any) => d.x1 - d.x0)
      .attr('height', parentLabelHeight)
      .attr('fill', (d: any) => color(d.data.name))
      .attr('opacity', 0.3)
      .attr('stroke', '#fff')
      .attr('stroke-width', 1);

    parentLabels.append('text')
      .attr('x', (d: any) => d.x0 + 4)
      .attr('y', (d: any) => d.y0 + 14)
      .attr('font-size', Math.min(props.labelFontSize + 2, 16))
      .attr('font-weight', 'bold')
      .attr('fill', '#000')
      .text((d: any) => {
        const maxWidth = (d.x1 - d.x0) - 8;
        return truncateText(d.data.name, maxWidth, props.labelFontSize + 2);
      });
  }

  // Add labels if enabled and tile is large enough
  if (props.showLabels) {
    leaf.filter((d: any) => shouldShowLabel(d))
      .append('text')
      .attr('x', 4)
      .attr('y', (d: any) => {
        // If this leaf has a parent with children (hierarchical), adjust Y position
        const hasParentLabel = d.parent && d.parent.children && d.parent.depth === 1;
        return hasParentLabel ? parentLabelHeight + 14 : 14;
      })
      .attr('font-size', props.labelFontSize)
      .attr('font-weight', 'bold')
      .attr('fill', '#000')
      .text((d: any) => {
        const maxWidth = (d.x1 - d.x0) - 8; // Account for padding
        return truncateText(d.data.name, maxWidth, props.labelFontSize);
      });
  }

  // Add values if enabled and tile is large enough
  if (props.showValues) {
    leaf.filter((d: any) => shouldShowLabel(d))
      .append('text')
      .attr('x', 4)
      .attr('y', (d: any) => {
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
      .text((d: any) => {
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
      .text((d: any) => {
        const path = d.parent ? `${d.parent.data.name} > ${d.data.name}` : d.data.name;
        const value = (d.value || 0).toLocaleString();
        return `${path}\nValue: ${value}`;
      });
  }
}

function renderChart(chartData: any) {
  deleteSVGs();
  nextTick(() => {
    renderSVG(chartData);
  });
}

// Lifecycle and watchers
onMounted(() => {
  renderChart(props.data);
});

watch(() => [props.data, props.width, props.height, props.filterState], () => {
  renderChart(props.data);
});

watch(() => [props.colorScheme, props.showLabels, props.showValues, props.labelFontSize, props.valueFontSize, props.minTileSize], () => {
  renderChart(props.data);
});

onBeforeUnmount(() => {
  deleteSVGs();
});
</script>

<template>
  <div>
    <div :id="`treemap-chart-${props.chartId}`"></div>
  </div>
</template>
