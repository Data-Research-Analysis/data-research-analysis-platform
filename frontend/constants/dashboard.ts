/**
 * Shared dashboard constants used across create, edit, and view pages.
 * Single source of truth for chart type metadata.
 */

/** Map of chart type → placeholder image path */
export const CHART_PLACEHOLDERS: Record<string, string> = {
    table: '/assets/images/chart-placeholders/table.png',
    text_block: '/assets/images/chart-placeholders/text_block.png',
    pie: '/assets/images/chart-placeholders/pie.png',
    donut: '/assets/images/chart-placeholders/donut.png',
    vertical_bar: '/assets/images/chart-placeholders/vertical_bar.png',
    horizontal_bar: '/assets/images/chart-placeholders/horizontal_bar.png',
    vertical_bar_line: '/assets/images/chart-placeholders/vertical_bar_line.png',
    stacked_bar: '/assets/images/chart-placeholders/stacked_bar.png',
    multiline: '/assets/images/chart-placeholders/multiline.png',
    treemap: '/assets/images/chart-placeholders/treemap.png',
    bubble: '/assets/images/chart-placeholders/bubble.png',
    funnel_steps: '/assets/images/chart-placeholders/funnel_steps.jpg',
};

/** Map of chart type → human-readable label */
export const CHART_TYPE_LABELS: Record<string, string> = {
    table: 'Table',
    text_block: 'Text Block',
    pie: 'Pie Chart',
    donut: 'Donut Chart',
    vertical_bar: 'Bar Chart',
    horizontal_bar: 'Horizontal Bar Chart',
    vertical_bar_line: 'Combo Chart',
    stacked_bar: 'Stacked Bar Chart',
    multiline: 'Line Chart',
    treemap: 'Treemap',
    bubble: 'Bubble Chart',
    funnel_steps: 'Funnel Steps',
};
