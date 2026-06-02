/**
 * DM-004: AI Analysis Prompt Template for Data Models
 * 
 * Provides a reusable, marketing-focused prompt template for generating
 * AI-powered insights from data model statistical summaries and sample data.
 */

export interface DataModelPromptContext {
    /** Data model name / description */
    modelName: string;
    /** Row count of the full dataset */
    rowCount: number;
    /** Column metadata from statistical analysis */
    columns: Array<{
        name: string;
        type: string;
        fill_rate: number;
        statistics?: Record<string, any>;
    }>;
    /** Correlation pairs (from statistical analysis) */
    correlations?: Array<{
        column_a: string;
        column_b: string;
        correlation: number;
        strength: string;
    }>;
    /** Detected anomalies */
    anomalies?: Array<{
        column: string;
        type: string;
        value: any;
        z_score?: number;
    }>;
    /** Trend analysis results */
    trends?: Array<{
        column: string;
        direction: string;
        slope?: number;
        r_squared?: number;
    }>;
    /** Sample rows (first N rows for AI context) */
    sampleData?: Array<Record<string, any>>;
    /** AI-002: Rich data model context from DataModelContextBuilder */
    dataModelContext?: DataModelContextSection;
    /** AI-003: Cross-source analysis context */
    crossSourceContext?: CrossSourceContext;
}

/**
 * AI-003: Cross-source context for data models that join multiple data sources.
 * Contains column-to-source mapping and source metadata for cross-channel analysis.
 */
export interface CrossSourceContext {
    /** Whether this data model joins multiple distinct data sources */
    isMultiSource: boolean;
    /** List of data source names that are joined */
    sourceNames: string[];
    /** Mapping of column names to their originating data source */
    columnToSourceMap: Array<{
        column: string;
        sourceName: string;
        sourceType?: string; // e.g. 'google-ads', 'meta-ads', 'csv', 'database'
    }>;
    /** Per-source summary: which metrics belong to which source */
    sourceMetrics: Array<{
        sourceName: string;
        sourceType?: string;
        metricColumns: string[];
        dimensionColumns: string[];
    }>;
    /** Budget/spend columns detected across sources for allocation analysis */
    spendColumns: Array<{ column: string; sourceName: string }>;
    /** Efficiency metric columns (CPA, CTR, ROAS, etc.) detected across sources */
    efficiencyColumns: Array<{ column: string; sourceName: string; kpiType: string }>;
    /** Conversion columns detected across sources */
    conversionColumns: Array<{ column: string; sourceName: string }>;
}

/**
 * AI-002: Data model context section for enriching prompts with
 * business logic, join relationships, field descriptions, and computed fields.
 */
export interface DataModelContextSection {
    /** Data model description */
    description?: string;
    /** Business logic explanation */
    businessLogic?: string;
    /** Data quality rules */
    dataQualityRules?: string;
    /** Join relationships to other models */
    joinRelationships?: Array<{
        parentModelName: string;
        joinType: string;
        conditions: Array<{ parentField: string; targetField: string }>;
    }>;
    /** Field descriptions from model metadata */
    fieldDescriptions?: Array<{
        fieldName: string;
        description?: string;
    }>;
    /** Computed/calculated fields */
    computedFields?: Array<{
        name: string;
        formula: string;
        dependencies: string[];
    }>;
    /** Model category */
    category?: string;
    /** Cross-model relationships */
    crossModelRelationships?: Array<{
        fromModel: string;
        toModel: string;
        joinType: string;
        joinConditions: string;
    }>;
}

/**
 * Builds the system instruction for the AI data model analysis.
 */
export function getSystemInstruction(): string {
    return `You are a senior marketing analytics expert specializing in data analysis and business intelligence.
Your role is to analyze statistical summaries of marketing datasets and provide actionable insights.

Key responsibilities:
- Interpret statistical patterns in marketing data (campaigns, conversions, spend, CTR, CPC, ROAS, etc.)
- Identify anomalies and outliers that may indicate data quality issues or unusual campaign behavior
- Detect trends that can inform marketing strategy
- Provide concrete, actionable marketing recommendations based on the data

Response guidelines:
- Always return valid JSON matching the specified schema
- Be specific and reference actual column names and values from the data
- Provide severity levels for data quality issues (low/medium/high/critical)
- Categorize recommendations by priority (high/medium/low) and expected impact
- Use marketing domain terminology appropriately`;
}

/**
 * Builds the main prompt for AI data model analysis.
 * Combines statistical summary, correlations, anomalies, trends, and sample data
 * into a structured prompt for the AI.
 */
export function buildDataModelAnalysisPrompt(context: DataModelPromptContext): string {
    const parts: string[] = [];

    // 1. Dataset overview
    parts.push(`## Dataset Overview
- Model Name: ${context.modelName}
- Total Rows: ${context.rowCount.toLocaleString()}
- Total Columns: ${context.columns.length}
- Numeric Columns: ${context.columns.filter(c => c.type === 'numeric').length}`);

    // 2. Column summary statistics
    parts.push(`\n## Column Statistics`);
    for (const col of context.columns) {
        const stats = col.statistics || {};
        const lines: string[] = [];

        if (col.type === 'numeric') {
            lines.push(`- **${col.name}** (${col.type}): fill_rate=${(col.fill_rate * 100).toFixed(1)}%`);
            if (stats.min !== undefined) lines.push(`  min=${stats.min}, max=${stats.max}, mean=${stats.mean}, median=${stats.median}, std=${stats.std}`);
            if (stats.skewness !== undefined) lines.push(`  skewness=${stats.skewness?.toFixed(3)}, kurtosis=${stats.kurtosis?.toFixed(3)}`);
            if (stats.percentiles) {
                const p = stats.percentiles;
                lines.push(`  p25=${p.p25}, p75=${p.p75}, p95=${p.p95}, p99=${p.p99}`);
            }
        } else if (col.type === 'date') {
            lines.push(`- **${col.name}** (${col.type}): fill_rate=${(col.fill_rate * 100).toFixed(1)}%`);
            if (stats.min !== undefined) lines.push(`  range=${stats.min} to ${stats.max}, span_days=${stats.range_days}`);
        } else {
            lines.push(`- **${col.name}** (${col.type}): fill_rate=${(col.fill_rate * 100).toFixed(1)}%, unique=${stats.unique_count}`);
            if (stats.top_values && stats.top_values.length > 0) {
                const topItems = stats.top_values.slice(0, 5)
                    .map((v: any) => `${v.value}(${v.count})`)
                    .join(', ');
                lines.push(`  top_values=[${topItems}]`);
            }
        }

        parts.push(lines.join('\n'));
    }

    // 3. Correlations
    if (context.correlations && context.correlations.length > 0) {
        parts.push(`\n## Correlations`);
        for (const corr of context.correlations.slice(0, 15)) {
            parts.push(`- ${corr.column_a} ↔ ${corr.column_b}: r=${corr.correlation.toFixed(3)} (${corr.strength})`);
        }
    }

    // 4. Anomalies
    if (context.anomalies && context.anomalies.length > 0) {
        parts.push(`\n## Anomalies Detected`);
        for (const anomaly of context.anomalies.slice(0, 20)) {
            const zScore = anomaly.z_score ? `, z-score=${anomaly.z_score.toFixed(2)}` : '';
            parts.push(`- ${anomaly.column}: ${anomaly.type}, value=${anomaly.value}${zScore}`);
        }
    }

    // 5. Trends
    if (context.trends && context.trends.length > 0) {
        parts.push(`\n## Trends`);
        for (const trend of context.trends.slice(0, 15)) {
            const details = trend.slope !== undefined ? `, slope=${trend.slope.toFixed(4)}, R²=${(trend.r_squared || 0).toFixed(3)}` : '';
            parts.push(`- ${trend.column}: ${trend.direction}${details}`);
        }
    }

    // 6. Sample data
    if (context.sampleData && context.sampleData.length > 0) {
        const sampleLimit = Math.min(context.sampleData.length, 10);
        parts.push(`\n## Sample Data (first ${sampleLimit} rows)`);
        parts.push('```json');
        parts.push(JSON.stringify(context.sampleData.slice(0, sampleLimit), null, 2));
        parts.push('```');
    }

    // 6b. AI-002: Data model context (business logic, joins, field descriptions, computed fields)
    if (context.dataModelContext) {
        const dmc = context.dataModelContext;
        parts.push(`\n## Data Model Context`);

        if (dmc.description) {
            parts.push(`\n### Model Description\n${dmc.description}`);
        }
        if (dmc.category) {
            parts.push(`\n**Category:** ${dmc.category}`);
        }
        if (dmc.businessLogic) {
            parts.push(`\n### Business Logic\n${dmc.businessLogic}`);
        }
        if (dmc.dataQualityRules) {
            parts.push(`\n### Data Quality Rules\n${dmc.dataQualityRules}`);
        }

        // Field descriptions
        if (dmc.fieldDescriptions && dmc.fieldDescriptions.length > 0) {
            parts.push(`\n### Field Descriptions`);
            for (const fd of dmc.fieldDescriptions) {
                if (fd.description) {
                    parts.push(`- **${fd.fieldName}**: ${fd.description}`);
                }
            }
        }

        // Computed fields
        if (dmc.computedFields && dmc.computedFields.length > 0) {
            parts.push(`\n### Computed/Calculated Fields`);
            for (const cf of dmc.computedFields) {
                parts.push(`- **${cf.name}**: \`${cf.formula}\` (depends on: ${cf.dependencies.join(', ')})`);
            }
        }

        // Join relationships
        if (dmc.joinRelationships && dmc.joinRelationships.length > 0) {
            parts.push(`\n### Join Relationships`);
            for (const rel of dmc.joinRelationships) {
                parts.push(`- **${rel.joinType} JOIN** to **${rel.parentModelName}**`);
                for (const cond of rel.conditions) {
                    parts.push(`  - ON ${context.modelName}.${cond.targetField} = ${rel.parentModelName}.${cond.parentField}`);
                }
            }
        }

        // Cross-model relationships
        if (dmc.crossModelRelationships && dmc.crossModelRelationships.length > 0) {
            parts.push(`\n### Cross-Model Relationships`);
            for (const rel of dmc.crossModelRelationships) {
                parts.push(`- **${rel.fromModel}** → **${rel.toModel}** (${rel.joinType} JOIN): ${rel.joinConditions}`);
            }
        }
    }

    // 6c. AI-003: Cross-source analysis section
    if (context.crossSourceContext && context.crossSourceContext.isMultiSource) {
        const cs = context.crossSourceContext;
        parts.push(`\n## Cross-Source Analysis Context (Multi-Platform Data Model)
This data model JOINs data from **${cs.sourceNames.length} data sources**: ${cs.sourceNames.join(', ')}.
You MUST analyze cross-platform/cross-channel relationships and provide cross-source insights.

### Data Source Breakdown`);
        for (const src of cs.sourceMetrics) {
            parts.push(`\n**${src.sourceName}** (${src.sourceType || 'unknown type'}):
  - Metrics: ${src.metricColumns.length > 0 ? src.metricColumns.join(', ') : 'none detected'}
  - Dimensions: ${src.dimensionColumns.length > 0 ? src.dimensionColumns.join(', ') : 'none detected'}`);
        }

        if (cs.spendColumns.length > 0) {
            parts.push(`\n### Spend/Budget Columns by Source`);
            for (const sc of cs.spendColumns) {
                parts.push(`- **${sc.column}** → from ${sc.sourceName}`);
            }
        }

        if (cs.efficiencyColumns.length > 0) {
            parts.push(`\n### Efficiency Metrics by Source`);
            for (const ec of cs.efficiencyColumns) {
                parts.push(`- **${ec.column}** (${ec.kpiType}) → from ${ec.sourceName}`);
            }
        }

        if (cs.conversionColumns.length > 0) {
            parts.push(`\n### Conversion Columns by Source`);
            for (const cc of cs.conversionColumns) {
                parts.push(`- **${cc.column}** → from ${cc.sourceName}`);
            }
        }

        parts.push(`\n### Cross-Source Analysis Instructions
Since this model joins multiple data sources, you MUST provide the following cross-source insight categories in addition to standard insights:

1. **cross_channel_efficiency**: Compare CPA, CPL, ROAS, CTR, CPC across channels/platforms. Identify which channel has the best efficiency for each metric. Use the actual metric values from the data — not hypothetical numbers.
2. **budget_allocation**: Based on relative channel performance, recommend specific budget reallocation shifts. Include dollar amounts or percentages (e.g., "Shift $2,000 (15%) from ${cs.sourceNames[0]} to ${cs.sourceNames.length > 1 ? cs.sourceNames[1] : 'better-performing channel'}"). Recommendations must be grounded in the actual spend and conversion data provided.
3. **funnel_attribution**: Identify which channels drive top-of-funnel activity (impressions, clicks, awareness) vs. bottom-of-funnel (conversions, revenue). Map the customer journey across platforms.
4. **cross_source_correlations**: Identify metric correlations that span multiple sources (e.g., higher spend on ${cs.sourceNames[0]} correlates with higher conversions on ${cs.sourceNames.length > 1 ? cs.sourceNames[1] : 'other channels'}).
5. **unified_strategy**: Provide a unified cross-platform marketing strategy recommendation that considers all channels together, not in isolation.

CRITICAL: All cross-source recommendations must reference actual column names and values from the data. Do not make generic statements — be specific with numbers.`);
    }

    // 7. Output schema instruction
    const hasCrossSource = context.crossSourceContext?.isMultiSource;

    if (hasCrossSource) {
        parts.push(`\n## Required Output
Analyze the above dataset and respond with a JSON object matching this exact schema.
Since this is a multi-source data model, you MUST include the cross_source_insights section:

\`\`\`json
{
  "key_insights": [
    {
      "title": "string - short descriptive title",
      "description": "string - detailed explanation of the insight",
      "severity": "info | success | warning | danger",
      "metric": "string | null - specific metric value if applicable",
      "icon": "string - one of: TrendingUp, TrendingDown, Target, DollarSign, BarChart3, Users, AlertTriangle, CheckCircle",
      "source": "string | null - which data source this insight relates to"
    }
  ],
  "patterns_and_trends": [
    {
      "pattern": "string - description of the pattern",
      "columns_involved": ["string"],
      "confidence": "number 0-1",
      "marketing_implication": "string - what this means for marketing strategy"
    }
  ],
  "anomalies_detected": [
    {
      "anomaly": "string - description",
      "affected_column": "string",
      "expected_range": "string",
      "actual_value": "string",
      "severity": "low | medium | high | critical"
    }
  ],
  "marketing_recommendations": [
    {
      "recommendation": "string - specific actionable recommendation",
      "priority": "high | medium | low",
      "expected_impact": "string - description of expected impact",
      "related_metrics": ["string"]
    }
  ],
  "data_quality_score": {
    "overall_score": "number 0-100",
    "completeness_score": "number 0-100",
    "consistency_score": "number 0-100",
    "issues": [
      {
        "issue": "string - description of the quality issue",
        "severity": "low | medium | high | critical",
        "affected_columns": ["string"],
        "recommendation": "string - how to fix"
      }
    ]
  },
  "cross_source_insights": {
    "cross_channel_efficiency": [
      {
        "metric": "string - e.g. CPA, ROAS, CTR",
        "channel_comparison": [
          { "channel": "string - source name", "value": "number", "rank": "number (1=best)" }
        ],
        "best_channel": "string",
        "worst_channel": "string",
        "insight": "string - detailed analysis"
      }
    ],
    "budget_allocation": {
      "current_distribution": [
        { "channel": "string", "current_spend": "number", "percentage": "number" }
      ],
      "recommended_distribution": [
        { "channel": "string", "recommended_spend": "number", "percentage": "number", "change": "number - positive=increase, negative=decrease" }
      ],
      "total_budget": "number",
      "expected_improvement": "string - description of expected ROI improvement",
      "rationale": "string - why these shifts are recommended"
    },
    "funnel_attribution": {
      "top_of_funnel": [
        { "channel": "string", "role": "string", "key_metrics": ["string"] }
      ],
      "bottom_of_funnel": [
        { "channel": "string", "role": "string", "key_metrics": ["string"] }
      ],
      "insight": "string - cross-channel funnel analysis"
    },
    "cross_source_correlations": [
      {
        "source_a": "string",
        "metric_a": "string",
        "source_b": "string",
        "metric_b": "string",
        "relationship": "string - description",
        "strength": "strong | moderate | weak"
      }
    ],
    "unified_strategy": {
      "summary": "string - one-paragraph cross-platform strategy recommendation",
      "action_items": [
        { "action": "string", "priority": "high | medium | low", "channels_affected": ["string"], "expected_impact": "string" }
      ]
    }
  }
}
\`\`\`

Provide 3-5 key_insights, 2-4 patterns_and_trends, and 2-5 actionable marketing_recommendations.
The data_quality_score.overall_score should be a weighted average of completeness (60%) and consistency (40%).
For cross_source_insights, provide at least 2 cross_channel_efficiency entries, budget_allocation with specific numbers, and 1-3 unified_strategy action_items.
Return ONLY the JSON object, no markdown fences or additional text.`);
    } else {
        parts.push(`\n## Required Output
Analyze the above dataset and respond with a JSON object matching this exact schema:

\`\`\`json
{
  "key_insights": [
    {
      "title": "string - short descriptive title",
      "description": "string - detailed explanation of the insight",
      "severity": "info | success | warning | danger",
      "metric": "string | null - specific metric value if applicable",
      "icon": "string - one of: TrendingUp, TrendingDown, Target, DollarSign, BarChart3, Users, AlertTriangle, CheckCircle"
    }
  ],
  "patterns_and_trends": [
    {
      "pattern": "string - description of the pattern",
      "columns_involved": ["string"],
      "confidence": "number 0-1",
      "marketing_implication": "string - what this means for marketing strategy"
    }
  ],
  "anomalies_detected": [
    {
      "anomaly": "string - description",
      "affected_column": "string",
      "expected_range": "string",
      "actual_value": "string",
      "severity": "low | medium | high | critical"
    }
  ],
  "marketing_recommendations": [
    {
      "recommendation": "string - specific actionable recommendation",
      "priority": "high | medium | low",
      "expected_impact": "string - description of expected impact",
      "related_metrics": ["string"]
    }
  ],
  "data_quality_score": {
    "overall_score": "number 0-100",
    "completeness_score": "number 0-100",
    "consistency_score": "number 0-100",
    "issues": [
      {
        "issue": "string - description of the quality issue",
        "severity": "low | medium | high | critical",
        "affected_columns": ["string"],
        "recommendation": "string - how to fix"
      }
    ]
  }
}
\`\`\`

Provide 3-5 key_insights, 2-4 patterns_and_trends, and 2-5 actionable marketing_recommendations.
The data_quality_score.overall_score should be a weighted average of completeness (60%) and consistency (40%).
Return ONLY the JSON object, no markdown fences or additional text.`);
    }

    return parts.join('\n');
}