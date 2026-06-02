/**
 * KPI Classification Service
 *
 * Classifies columns from a data model into categories (metric, dimension,
 * time, identifier, unrecognized) and identifies KPI-relevant patterns.
 */

import type { DRAColumn } from '../models/DRAColumn.js';

/** A KPI pattern definition matched during classification */
export interface KPIPattern {
    id: string;
    label: string;
    aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'count_distinct';
    format: 'currency' | 'percentage' | 'number' | 'duration' | 'decimal';
}

/**
 * Enriched classification result for a single column.
 * Contains the classification category plus optional KPI metadata.
 */
export interface ColumnClassification {
    columnId: number;
    columnName: string;
    category: 'metric' | 'dimension' | 'time' | 'identifier' | 'unrecognized';
    isKPI: boolean;
    dimensionality?: 'high' | 'low';
    pattern?: KPIPattern | null;
    confidence: number;
}

/** Re-export the simple category type for consumers that only need the string union */
export type ColumnClassificationCategory = 'metric' | 'dimension' | 'time' | 'identifier' | 'unrecognized';

/** Also export as the simple type alias for backward compat with imports expecting `type ColumnClassification` */
export type { ColumnClassification as ColumnKPIClassification };

/**
 * Well-known KPI patterns matched by column name heuristics.
 */
const KPI_PATTERNS: Array<{ pattern: RegExp; kpi: KPIPattern }> = [
    { pattern: /revenue|sales|income|amount/i, kpi: { id: 'revenue', label: 'Revenue', aggregation: 'sum', format: 'currency' } },
    { pattern: /cost|spend|expense|budget/i, kpi: { id: 'cost', label: 'Cost', aggregation: 'sum', format: 'currency' } },
    { pattern: /profit|margin/i, kpi: { id: 'profit', label: 'Profit', aggregation: 'sum', format: 'currency' } },
    { pattern: /roas|return.on.ad/i, kpi: { id: 'roas', label: 'ROAS', aggregation: 'avg', format: 'decimal' } },
    { pattern: /roi|return.on.invest/i, kpi: { id: 'roi', label: 'ROI', aggregation: 'avg', format: 'percentage' } },
    { pattern: /ctr|click.?through/i, kpi: { id: 'ctr', label: 'CTR', aggregation: 'avg', format: 'percentage' } },
    { pattern: /conversion.?rate|cvr/i, kpi: { id: 'conversion_rate', label: 'Conversion Rate', aggregation: 'avg', format: 'percentage' } },
    { pattern: /impression/i, kpi: { id: 'impressions', label: 'Impressions', aggregation: 'sum', format: 'number' } },
    { pattern: /click/i, kpi: { id: 'clicks', label: 'Clicks', aggregation: 'sum', format: 'number' } },
    { pattern: /reach/i, kpi: { id: 'reach', label: 'Reach', aggregation: 'sum', format: 'number' } },
    { pattern: /engagement/i, kpi: { id: 'engagement', label: 'Engagement', aggregation: 'sum', format: 'number' } },
    { pattern: /session/i, kpi: { id: 'sessions', label: 'Sessions', aggregation: 'count', format: 'number' } },
    { pattern: /bounce.?rate/i, kpi: { id: 'bounce_rate', label: 'Bounce Rate', aggregation: 'avg', format: 'percentage' } },
    { pattern: /duration|time.on.site|avg.?session/i, kpi: { id: 'duration', label: 'Avg Duration', aggregation: 'avg', format: 'duration' } },
    { pattern: /page.?view/i, kpi: { id: 'pageviews', label: 'Page Views', aggregation: 'sum', format: 'number' } },
    { pattern: /lead/i, kpi: { id: 'leads', label: 'Leads', aggregation: 'sum', format: 'number' } },
    { pattern: /cpa|cost.per.acquisition/i, kpi: { id: 'cpa', label: 'CPA', aggregation: 'avg', format: 'currency' } },
    { pattern: /cpc|cost.per.click/i, kpi: { id: 'cpc', label: 'CPC', aggregation: 'avg', format: 'currency' } },
    { pattern: /cpm|cost.per.mille/i, kpi: { id: 'cpm', label: 'CPM', aggregation: 'avg', format: 'currency' } },
];

/**
 * Dimension patterns — columns whose names suggest they are dimension/grouping columns.
 */
const DIMENSION_PATTERNS: RegExp[] = [
    /campaign/i, /channel/i, /source/i, /medium/i, /platform/i,
    /ad_group/i, /ad.?set/i, /creative/i, /audience/i,
    /region/i, /country/i, /city/i, /geo/i, /location/i,
    /device/i, /browser/i, /os/i, /gender/i, /age/i,
    /category/i, /segment/i, /group/i, /type/i, /status/i,
];

const TIME_PATTERNS: RegExp[] = [
    /date/i, /time/i, /timestamp/i, /created/i, /updated/i, /month/i, /year/i, /week/i, /day/i,
];

const IDENTIFIER_PATTERNS: RegExp[] = [
    /^id$/i, /_id$/i, /uuid/i, /guid/i, /key$/i, /code$/i,
];

class KPIClassificationServiceImpl {

    /**
     * Classify all columns of a data model.
     *
     * @param columns  Array of DRAColumn entities
     * @returns        Enriched classification array
     */
    classifyAllColumns(columns: DRAColumn[]): ColumnClassification[] {
        return columns.map((col) => this.classifyColumn(col));
    }

    /**
     * Classify a single column.
     */
    classifyColumn(col: DRAColumn): ColumnClassification {
        const name = col.name ?? '';
        const dtype = (col.data_type ?? '').toLowerCase();

        // 1. Identifier check
        if (IDENTIFIER_PATTERNS.some((p) => p.test(name))) {
            return {
                columnId: col.id,
                columnName: name,
                category: 'identifier',
                isKPI: false,
                confidence: 0.9,
            };
        }

        // 2. Time check
        if (TIME_PATTERNS.some((p) => p.test(name)) || /date|timestamp|time/i.test(dtype)) {
            return {
                columnId: col.id,
                columnName: name,
                category: 'time',
                isKPI: false,
                confidence: 0.9,
            };
        }

        // 3. Numeric check → potential metric / KPI
        const isNumeric = /int|float|decimal|numeric|double|number|bigint/i.test(dtype);

        // 4. Try to match a KPI pattern by column name
        const matchedKPI = KPI_PATTERNS.find((p) => p.pattern.test(name));

        if (matchedKPI && isNumeric) {
            return {
                columnId: col.id,
                columnName: name,
                category: 'metric',
                isKPI: true,
                pattern: matchedKPI.kpi,
                confidence: 0.85,
            };
        }

        // 5. Numeric column without a specific KPI match → still a metric
        if (isNumeric) {
            return {
                columnId: col.id,
                columnName: name,
                category: 'metric',
                isKPI: true,
                pattern: { id: name, label: name, aggregation: 'sum', format: 'number' },
                confidence: 0.6,
            };
        }

        // 6. Dimension check
        const isDimension = DIMENSION_PATTERNS.some((p) => p.test(name)) || /varchar|text|char|enum|set/i.test(dtype);
        if (isDimension) {
            // Heuristic: high-cardinality dimensions (e.g. campaign names)
            const dimensionality: 'high' | 'low' = /campaign|ad_group|creative|audience/i.test(name) ? 'high' : 'low';
            return {
                columnId: col.id,
                columnName: name,
                category: 'dimension',
                isKPI: false,
                dimensionality,
                confidence: 0.7,
            };
        }

        // 7. Fallback
        return {
            columnId: col.id,
            columnName: name,
            category: 'unrecognized',
            isKPI: false,
            confidence: 0.3,
        };
    }
}

/** Shared singleton instance */
export const singleton = new KPIClassificationServiceImpl();
export default KPIClassificationServiceImpl;