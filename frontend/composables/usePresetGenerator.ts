import type { ISchemaDetails } from '~/types/IAIDataModeler';
import { useSchemaAnalyzer } from './useSchemaAnalyzer';

export interface PresetModel {
    icon: string;
    title: string;
    description: string;
    prompt: string;
    confidence: number;
    relevantTables: string[];
}

/**
 * Template configurations for different patterns
 */
const PRESET_TEMPLATES = {
    sales: {
        icon: '📊',
        title: 'Sales Analysis',
        getDescription: (tables: string[]) => `Analyze ${tables.slice(0, 2).join(', ')} and more`,
        getPrompt: (tables: string[]) => 
            `Generate a sales analysis data model. Use tables: ${tables.join(', ')}. Include key columns for revenue, order dates, product details, and customer information. Add aggregations for total sales (SUM), order counts (COUNT), and average order values (AVG). Group by date or product category if applicable.`
    },
    user: {
        icon: '👥',
        title: 'User Behavior Analysis',
        getDescription: (tables: string[]) => `Insights from ${tables.slice(0, 2).join(', ')}`,
        getPrompt: (tables: string[]) => 
            `Generate a user behavior data model. Use tables: ${tables.join(', ')}. Select columns for user identification, demographics, activity timestamps, and engagement metrics. Include aggregations for user counts (COUNT), activity frequency, and signup trends over time.`
    },
    inventory: {
        icon: '📦',
        title: 'Inventory & Products',
        getDescription: (tables: string[]) => `Track ${tables.slice(0, 2).join(', ')} performance`,
        getPrompt: (tables: string[]) => 
            `Generate an inventory management data model. Use tables: ${tables.join(', ')}. Include columns for product names, stock quantities, warehouse locations, and reorder points. Add calculations for stock levels, inventory turnover, and low-stock items using WHERE conditions.`
    },
    financial: {
        icon: '💰',
        title: 'Financial Performance',
        getDescription: (tables: string[]) => `Analyze ${tables.slice(0, 2).join(', ')} data`,
        getPrompt: (tables: string[]) => 
            `Generate a financial performance data model. Use tables: ${tables.join(', ')}. Select columns for transaction amounts, payment dates, invoice details, and account information. Include aggregations for total revenue (SUM), transaction counts (COUNT), and average transaction values (AVG).`
    },
    timeseries: {
        icon: '📈',
        title: 'Trend Analysis Over Time',
        getDescription: (tables: string[]) => `Time-based patterns in your data`,
        getPrompt: (tables: string[]) => 
            `Generate a time-series analysis data model. Use tables: ${tables.join(', ')}. Include timestamp columns, metrics for aggregation, and relevant dimensions. Add date-based groupings and ORDER BY timestamp descending to show recent trends first.`
    }
};

/**
 * Fallback presets when pattern detection yields few results
 */
const FALLBACK_PRESETS: PresetModel[] = [
    {
        icon: '🔍',
        title: 'General Analytics',
        description: 'Overview of your main tables',
        prompt: 'Generate a general analytics data model using the available tables. Select important columns from the main tables and include basic aggregations (COUNT, SUM) for numeric fields. Focus on the most commonly used tables based on foreign key relationships.',
        confidence: 50,
        relevantTables: []
    },
    {
        icon: '📊',
        title: 'Summary Report',
        description: 'Key metrics and counts',
        prompt: 'Generate a summary report data model. Include columns from your primary tables and add COUNT aggregations to show record totals. Group by key categorical columns if present.',
        confidence: 50,
        relevantTables: []
    },
    {
        icon: '🔗',
        title: 'Related Data View',
        description: 'Connected tables together',
        prompt: 'Generate a data model that joins related tables using foreign key relationships. Select key identifier columns and descriptive fields from each table. Include all necessary junction tables to properly link the data.',
        confidence: 50,
        relevantTables: []
    }
];

export function usePresetGenerator(schemaDetails: ISchemaDetails | null) {
    /**
     * Generate contextual preset models based on schema
     */
    function generatePresets(): PresetModel[] {
        // If no schema details, return fallback presets
        if (!schemaDetails || !schemaDetails.tables || schemaDetails.tables.length === 0) {
            return FALLBACK_PRESETS.slice(0, 4);
        }

        const analyzer = useSchemaAnalyzer(schemaDetails);
        const detectedPatterns = analyzer.detectAllPatterns();
        
        const presets: PresetModel[] = [];
        
        // Convert detected patterns to preset models
        for (const pattern of detectedPatterns) {
            const template = PRESET_TEMPLATES[pattern.pattern as keyof typeof PRESET_TEMPLATES];
            
            if (template && pattern.tables.length > 0) {
                presets.push({
                    icon: template.icon,
                    title: template.title,
                    description: template.getDescription(pattern.tables),
                    prompt: template.getPrompt(pattern.tables),
                    confidence: pattern.confidence,
                    relevantTables: pattern.tables
                });
            }
        }
        
        // If we have fewer than 3 presets, add some fallbacks
        if (presets.length < 3) {
            const needed = 4 - presets.length;
            const fallbacks = FALLBACK_PRESETS.slice(0, needed);
            presets.push(...fallbacks);
        }
        
        // Limit to top 4-6 presets
        return presets.slice(0, 6);
    }

    return {
        generatePresets
    };
}
