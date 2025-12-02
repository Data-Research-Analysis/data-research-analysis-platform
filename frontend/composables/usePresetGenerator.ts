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
            `Build a sales analysis data model using ${tables.join(', ')}. Focus on revenue trends, order patterns, and customer purchasing behavior. Include aggregations for total sales, order counts, and average order values.`
    },
    user: {
        icon: '👥',
        title: 'User Behavior Analysis',
        getDescription: (tables: string[]) => `Insights from ${tables.slice(0, 2).join(', ')}`,
        getPrompt: (tables: string[]) => 
            `Create a user behavior analysis data model using ${tables.join(', ')}. Analyze user demographics, activity patterns, and engagement metrics. Include customer segmentation and user lifetime value if possible.`
    },
    inventory: {
        icon: '📦',
        title: 'Inventory & Products',
        getDescription: (tables: string[]) => `Track ${tables.slice(0, 2).join(', ')} performance`,
        getPrompt: (tables: string[]) => 
            `Build an inventory and product performance data model using ${tables.join(', ')}. Show stock levels, product sales, turnover rates, and inventory metrics. Include low stock alerts if applicable.`
    },
    financial: {
        icon: '💰',
        title: 'Financial Performance',
        getDescription: (tables: string[]) => `Analyze ${tables.slice(0, 2).join(', ')} data`,
        getPrompt: (tables: string[]) => 
            `Create a financial performance data model using ${tables.join(', ')}. Analyze revenue, costs, profits, and key financial metrics. Include period-over-period comparisons and trend analysis.`
    },
    timeseries: {
        icon: '📈',
        title: 'Trend Analysis Over Time',
        getDescription: (tables: string[]) => `Time-based patterns in your data`,
        getPrompt: (tables: string[]) => 
            `Build a time-based analysis data model using ${tables.join(', ')}. Show trends over time, identify seasonality patterns, and analyze growth metrics. Include date-based aggregations.`
    }
};

/**
 * Fallback presets when pattern detection yields few results
 */
const FALLBACK_PRESETS: PresetModel[] = [
    {
        icon: '🔍',
        title: 'Explore All Data',
        description: 'Let AI analyze your entire schema',
        prompt: 'Analyze my database schema and suggest the most useful data model for analytics. Focus on the most important relationships and metrics.',
        confidence: 50,
        relevantTables: []
    },
    {
        icon: '📊',
        title: 'Common Metrics',
        description: 'Build a general analytics model',
        prompt: 'Create a data model that shows common business metrics like counts, totals, and averages across my main tables. Use aggregations where appropriate.',
        confidence: 50,
        relevantTables: []
    },
    {
        icon: '🔗',
        title: 'Table Relationships',
        description: 'Explore connected tables',
        prompt: 'Build a data model that demonstrates the relationships between my tables. Show how different entities are connected through foreign keys.',
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
