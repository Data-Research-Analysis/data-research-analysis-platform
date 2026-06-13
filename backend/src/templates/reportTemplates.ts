/**
 * Report Templates with Data Model Awareness
 * 
 * Implements TICKET RPT-007: Report Templates with Data Model Awareness.
 * 
 * Each template defines a set of sections that adapt to the data model's
 * column types, KPI classifications, and available dimensions.
 * 
 * Templates use placeholder tokens that get resolved at generation time
 * based on the specific data model being used.
 */

import type { ColumnClassification } from '../services/KPIClassificationService.js';
import type { DRAColumn } from '../models/DRAColumn.js';

// ── Template Section Types ──────────────────────────────────────────

export type TemplateSectionType = 'kpi_row' | 'text_block' | 'ai_insights' | 'trend_note';

export interface ITemplateSection {
    /** Unique section identifier within the template */
    id: string;
    /** Type of report item to create */
    type: TemplateSectionType;
    /** Display title — supports {{placeholders}} */
    title: string;
    /** For kpi_row: which KPI slots to include (e.g., 'primary', 'all', 'top3') */
    kpiSlots?: 'primary' | 'top3' | 'all';
    /** For text_block: markdown content — supports {{placeholders}} */
    content?: string;
    /** Whether this section is required (always included) or conditional */
    required: boolean;
    /** Condition for conditional sections */
    condition?: ITemplateCondition;
    /** Display order within the template (relative, will be re-indexed) */
    displayOrder: number;
}

export interface ITemplateCondition {
    /** What to check */
    type: 'has_kpi_columns' | 'has_dimension_columns' | 'has_date_column' | 'has_numeric_columns' | 'always';
    /** Minimum number of matching columns required */
    minCount?: number;
}

// ── Template Definition ─────────────────────────────────────────────

export interface IReportTemplate {
    id: string;
    name: string;
    description: string;
    /** Category for grouping in the UI */
    category: 'marketing' | 'sales' | 'operations' | 'general';
    /** Icon identifier for the UI */
    icon: string;
    /** Preview sections shown in the template picker (simplified descriptions) */
    preview: ITemplatePreviewSection[];
    /** The actual template sections to generate */
    sections: ITemplateSection[];
    /** Minimum number of KPI columns required to use this template */
    requiresKpiColumns: number;
    /** Whether this template requires a date column */
    requiresDateColumn: boolean;
}

export interface ITemplatePreviewSection {
    label: string;
    type: TemplateSectionType;
    description: string;
}

// ── Template Definitions ────────────────────────────────────────────

export const REPORT_TEMPLATES: IReportTemplate[] = [
    // ─── 1. Marketing Performance Report ─────────────────────────────
    {
        id: 'marketing-performance',
        name: 'Marketing Performance Report',
        description: 'Comprehensive marketing analysis with KPI cards, campaign comparisons, and AI-powered recommendations.',
        category: 'marketing',
        icon: 'megaphone',
        requiresKpiColumns: 1,
        requiresDateColumn: false,
        preview: [
            { label: 'KPI Summary', type: 'kpi_row', description: 'Key marketing metrics at a glance' },
            { label: 'AI Recommendations', type: 'ai_insights', description: 'AI-powered marketing optimization tips' },
            { label: 'Trend Note', type: 'trend_note', description: 'Highlights time-series capabilities if date column exists' },
            { label: 'Executive Summary', type: 'text_block', description: 'Placeholder for your analysis narrative' },
        ],
        sections: [
            {
                id: 'kpi-summary',
                type: 'kpi_row',
                title: 'Marketing KPI Summary',
                kpiSlots: 'all',
                required: true,
                displayOrder: 0,
            },
            {
                id: 'ai-recommendations',
                type: 'ai_insights',
                title: 'AI Marketing Recommendations',
                required: false,
                condition: { type: 'always' },
                displayOrder: 1,
            },
            {
                id: 'trend-capability',
                type: 'trend_note',
                title: 'Time-Series Analysis Available',
                required: false,
                condition: { type: 'has_date_column' },
                displayOrder: 2,
            },
            {
                id: 'exec-summary',
                type: 'text_block',
                title: 'Executive Summary',
                content: '# Executive Summary\n\n*Generated from **{{dataModelName}}** using the **Marketing Performance** template.*\n\nReplace this text with your marketing analysis narrative, key findings, and strategic recommendations.',
                required: true,
                displayOrder: 3,
            },
        ],
    },

    // ─── 2. Sales Performance Report ─────────────────────────────────
    {
        id: 'sales-performance',
        name: 'Sales Performance Report',
        description: 'Track revenue metrics, sales funnel comparisons, and identify growth opportunities with AI analysis.',
        category: 'sales',
        icon: 'trending-up',
        requiresKpiColumns: 1,
        requiresDateColumn: false,
        preview: [
            { label: 'Revenue KPIs', type: 'kpi_row', description: 'Revenue, deals, conversion rates' },
            { label: 'Growth Insights', type: 'ai_insights', description: 'AI-identified growth opportunities' },
            { label: 'Trend Note', type: 'trend_note', description: 'Revenue trend analysis capabilities' },
            { label: 'Executive Summary', type: 'text_block', description: 'Your sales narrative and next steps' },
        ],
        sections: [
            {
                id: 'revenue-kpis',
                type: 'kpi_row',
                title: 'Revenue KPIs',
                kpiSlots: 'top3',
                required: true,
                displayOrder: 0,
            },
            {
                id: 'growth-insights',
                type: 'ai_insights',
                title: 'Growth Opportunities',
                required: false,
                condition: { type: 'always' },
                displayOrder: 1,
            },
            {
                id: 'trend-capability',
                type: 'trend_note',
                title: 'Revenue Trend Analysis Available',
                required: false,
                condition: { type: 'has_date_column' },
                displayOrder: 2,
            },
            {
                id: 'exec-summary',
                type: 'text_block',
                title: 'Sales Executive Summary',
                content: '# Sales Executive Summary\n\n*Generated from **{{dataModelName}}** using the **Sales Performance** template.*\n\nDocument your sales targets, pipeline health, and strategic priorities here.',
                required: true,
                displayOrder: 3,
            },
        ],
    },

    // ─── 3. Executive Summary Report ─────────────────────────────────
    {
        id: 'executive-summary',
        name: 'Executive Summary Report',
        description: 'High-level overview with top KPIs, key AI insights, and a concise summary for leadership.',
        category: 'general',
        icon: 'clipboard',
        requiresKpiColumns: 1,
        requiresDateColumn: false,
        preview: [
            { label: 'Top KPIs', type: 'kpi_row', description: 'Most important metrics, top 3 only' },
            { label: 'Key Insights', type: 'ai_insights', description: 'Concise AI-powered executive insights' },
            { label: 'Executive Summary', type: 'text_block', description: 'Brief summary for leadership' },
        ],
        sections: [
            {
                id: 'top-kpis',
                type: 'kpi_row',
                title: 'Key Performance Indicators',
                kpiSlots: 'top3',
                required: true,
                displayOrder: 0,
            },
            {
                id: 'key-insights',
                type: 'ai_insights',
                title: 'Key Insights',
                required: false,
                condition: { type: 'always' },
                displayOrder: 1,
            },
            {
                id: 'exec-summary',
                type: 'text_block',
                title: 'Executive Summary',
                content: '# Executive Summary\n\n*Generated from **{{dataModelName}}** using the **Executive Summary** template.*\n\nProvide a brief overview of key findings, risks, and recommended actions.',
                required: true,
                displayOrder: 2,
            },
        ],
    },

    // ─── 4. Operational Metrics Report ───────────────────────────────
    {
        id: 'operational-metrics',
        name: 'Operational Metrics Report',
        description: 'Monitor operational KPIs, track efficiency metrics across categories, and surface operational bottlenecks.',
        category: 'operations',
        icon: 'settings',
        requiresKpiColumns: 2,
        requiresDateColumn: false,
        preview: [
            { label: 'Operational KPIs', type: 'kpi_row', description: 'All operational metrics in a single row' },
            { label: 'Operational Insights', type: 'ai_insights', description: 'AI-detected bottlenecks and efficiencies' },
            { label: 'Trend Note', type: 'trend_note', description: 'Track operational metrics over time' },
            { label: 'Operational Notes', type: 'text_block', description: 'Document operational findings and action items' },
        ],
        sections: [
            {
                id: 'ops-kpis',
                type: 'kpi_row',
                title: 'Operational KPIs',
                kpiSlots: 'all',
                required: true,
                displayOrder: 0,
            },
            {
                id: 'ops-insights',
                type: 'ai_insights',
                title: 'Operational Insights',
                required: false,
                condition: { type: 'always' },
                displayOrder: 1,
            },
            {
                id: 'trend-capability',
                type: 'trend_note',
                title: 'Operational Trends Available',
                required: false,
                condition: { type: 'has_date_column' },
                displayOrder: 2,
            },
            {
                id: 'ops-notes',
                type: 'text_block',
                title: 'Operational Notes',
                content: '# Operational Notes\n\n*Generated from **{{dataModelName}}** using the **Operational Metrics** template.*\n\nDocument operational findings, bottlenecks identified, and recommended process improvements.',
                required: true,
                displayOrder: 3,
            },
        ],
    },

    // ─── 5. Data Exploration Report ──────────────────────────────────
    {
        id: 'data-exploration',
        name: 'Data Exploration Report',
        description: 'Blank canvas with all detected KPIs, AI-assisted exploration, and space for ad-hoc analysis notes.',
        category: 'general',
        icon: 'search',
        requiresKpiColumns: 0,
        requiresDateColumn: false,
        preview: [
            { label: 'Detected KPIs', type: 'kpi_row', description: 'All auto-detected KPI columns' },
            { label: 'AI Exploration', type: 'ai_insights', description: 'AI-assisted data exploration insights' },
            { label: 'Analysis Notes', type: 'text_block', description: 'Blank space for your exploration notes' },
        ],
        sections: [
            {
                id: 'detected-kpis',
                type: 'kpi_row',
                title: 'Detected KPIs',
                kpiSlots: 'all',
                required: false,
                condition: { type: 'has_kpi_columns', minCount: 1 },
                displayOrder: 0,
            },
            {
                id: 'ai-exploration',
                type: 'ai_insights',
                title: 'AI Data Exploration',
                required: false,
                condition: { type: 'always' },
                displayOrder: 1,
            },
            {
                id: 'trend-capability',
                type: 'trend_note',
                title: 'Time-Series Exploration Available',
                required: false,
                condition: { type: 'has_date_column' },
                displayOrder: 2,
            },
            {
                id: 'analysis-notes',
                type: 'text_block',
                title: 'Exploration Notes',
                content: '# Data Exploration Notes\n\n*Generated from **{{dataModelName}}** using the **Data Exploration** template.*\n\nUse this space to document your findings as you explore the data.',
                required: true,
                displayOrder: 3,
            },
        ],
    },
];

// ── Template Resolution Helpers ─────────────────────────────────────

/**
 * Replace {{placeholders}} in a string with actual values from the data model context.
 */
export function resolvePlaceholders(
    text: string,
    context: {
        dataModelName: string;
        dimensionName?: string;
        metricName?: string;
    },
): string {
    return text
        .replace(/\{\{dataModelName\}\}/g, context.dataModelName)
        .replace(/\{\{dimension\}\}/g, context.dimensionName || 'Data')
        .replace(/\{\{metric\}\}/g, context.metricName || 'Value');
}

/**
 * Evaluate whether a template condition is met given the data model's column state.
 */
export function evaluateCondition(
    condition: ITemplateCondition | undefined,
    context: {
        kpiColumnCount: number;
        dimensionColumnCount: number;
        hasDateColumn: boolean;
        numericColumnCount: number;
    },
): boolean {
    if (!condition) return true;

    switch (condition.type) {
        case 'always':
            return true;
        case 'has_kpi_columns':
            return context.kpiColumnCount >= (condition.minCount ?? 1);
        case 'has_dimension_columns':
            return context.dimensionColumnCount >= (condition.minCount ?? 1);
        case 'has_date_column':
            return context.hasDateColumn;
        case 'has_numeric_columns':
            return context.numericColumnCount >= (condition.minCount ?? 1);
        default:
            return true;
    }
}

/**
 * Check if a template is compatible with the given data model column state.
 * Returns { compatible: boolean; reason?: string }
 */
export function checkTemplateCompatibility(
    template: IReportTemplate,
    context: {
        kpiColumnCount: number;
        dimensionColumnCount: number;
        hasDateColumn: boolean;
        numericColumnCount: number;
    },
): { compatible: boolean; reason?: string } {
    if (context.kpiColumnCount < template.requiresKpiColumns) {
        return {
            compatible: false,
            reason: `Requires at least ${template.requiresKpiColumns} KPI column(s), but only ${context.kpiColumnCount} detected.`,
        };
    }

    if (template.requiresDateColumn && !context.hasDateColumn) {
        return {
            compatible: false,
            reason: 'Requires a date/time column, but none was detected.',
        };
    }

    return { compatible: true };
}

/**
 * Get a template by ID, or null if not found.
 */
export function getTemplateById(templateId: string): IReportTemplate | null {
    return REPORT_TEMPLATES.find((t) => t.id === templateId) || null;
}

/**
 * Get all templates, optionally filtered by category.
 */
export function getTemplates(category?: string): IReportTemplate[] {
    if (!category) return REPORT_TEMPLATES;
    return REPORT_TEMPLATES.filter((t) => t.category === category);
}