import type { ISchemaDetails, ITableInfo } from '~/types/IAIDataModeler';

interface DetectedPattern {
    pattern: string;
    confidence: number;
    tables: string[];
    description: string;
}

export function useSchemaAnalyzer(schemaDetails: ISchemaDetails) {
    /**
     * Check if table name matches keywords (case-insensitive)
     */
    function tableMatchesKeywords(tableName: string, keywords: string[]): boolean {
        const lowerName = tableName.toLowerCase();
        return keywords.some(keyword => lowerName.includes(keyword));
    }

    /**
     * Find tables matching specific keywords
     */
    function findTablesByKeywords(keywords: string[]): ITableInfo[] {
        return schemaDetails.tables.filter(table => 
            tableMatchesKeywords(table.name, keywords)
        );
    }

    /**
     * Check if tables are connected via foreign keys
     */
    function areTablesConnected(table1: string, table2: string): boolean {
        const t1 = schemaDetails.tables.find(t => t.name === table1);
        const t2 = schemaDetails.tables.find(t => t.name === table2);
        
        if (!t1 || !t2) return false;
        
        // Check if t1 references t2 or vice versa
        return t1.foreignKeyReferences.includes(table2) || 
               t2.foreignKeyReferences.includes(table1);
    }

    /**
     * Detect sales/e-commerce pattern
     */
    function detectSalesPattern(): DetectedPattern | null {
        const orderTables = findTablesByKeywords(['order', 'sale', 'purchase']);
        const productTables = findTablesByKeywords(['product', 'item', 'inventory']);
        const customerTables = findTablesByKeywords(['customer', 'user', 'client', 'buyer']);
        
        const allTables = [...orderTables, ...productTables, ...customerTables];
        
        if (allTables.length < 2) return null;
        
        // Calculate confidence based on completeness
        let confidence = 0;
        if (orderTables.length > 0) confidence += 40;
        if (productTables.length > 0) confidence += 30;
        if (customerTables.length > 0) confidence += 30;
        
        return {
            pattern: 'sales',
            confidence,
            tables: allTables.map(t => t.name),
            description: 'Sales and order management data'
        };
    }

    /**
     * Detect user/customer insights pattern
     */
    function detectUserPattern(): DetectedPattern | null {
        const userTables = findTablesByKeywords(['user', 'customer', 'member', 'account']);
        const profileTables = findTablesByKeywords(['profile', 'preference', 'setting']);
        const activityTables = findTablesByKeywords(['activity', 'log', 'event', 'session', 'interaction']);
        
        const allTables = [...userTables, ...profileTables, ...activityTables];
        
        if (userTables.length === 0) return null;
        
        let confidence = 50; // Base confidence for having user tables
        if (profileTables.length > 0) confidence += 25;
        if (activityTables.length > 0) confidence += 25;
        
        return {
            pattern: 'user',
            confidence,
            tables: allTables.map(t => t.name),
            description: 'User behavior and demographics'
        };
    }

    /**
     * Detect inventory/product pattern
     */
    function detectInventoryPattern(): DetectedPattern | null {
        const productTables = findTablesByKeywords(['product', 'item', 'sku', 'inventory']);
        const stockTables = findTablesByKeywords(['stock', 'warehouse', 'inventory']);
        const categoryTables = findTablesByKeywords(['category', 'tag', 'classification']);
        
        const allTables = [...productTables, ...stockTables, ...categoryTables];
        
        if (productTables.length === 0) return null;
        
        let confidence = 50;
        if (stockTables.length > 0) confidence += 30;
        if (categoryTables.length > 0) confidence += 20;
        
        return {
            pattern: 'inventory',
            confidence,
            tables: allTables.map(t => t.name),
            description: 'Product and inventory management'
        };
    }

    /**
     * Detect financial/transaction pattern
     */
    function detectFinancialPattern(): DetectedPattern | null {
        const transactionTables = findTablesByKeywords(['transaction', 'payment', 'invoice', 'billing']);
        const accountTables = findTablesByKeywords(['account', 'balance', 'ledger']);
        const revenueTables = findTablesByKeywords(['revenue', 'income', 'expense', 'cost']);
        
        const allTables = [...transactionTables, ...accountTables, ...revenueTables];
        
        if (allTables.length < 2) return null;
        
        let confidence = 0;
        if (transactionTables.length > 0) confidence += 40;
        if (accountTables.length > 0) confidence += 30;
        if (revenueTables.length > 0) confidence += 30;
        
        return {
            pattern: 'financial',
            confidence,
            tables: allTables.map(t => t.name),
            description: 'Financial transactions and metrics'
        };
    }

    /**
     * Detect time-series pattern (tables with timestamps)
     */
    function detectTimeSeriesPattern(): DetectedPattern | null {
        const timeSeriesTables = schemaDetails.tables.filter(table => table.hasTimestamps);
        
        if (timeSeriesTables.length < 2) return null;
        
        // Higher confidence if many tables have timestamps
        const confidence = Math.min(30 + (timeSeriesTables.length * 10), 90);
        
        return {
            pattern: 'timeseries',
            confidence,
            tables: timeSeriesTables.map(t => t.name),
            description: 'Time-based trends and patterns'
        };
    }

    /**
     * Detect all patterns and return sorted by confidence
     */
    function detectAllPatterns(): DetectedPattern[] {
        const patterns: DetectedPattern[] = [];
        
        const sales = detectSalesPattern();
        if (sales) patterns.push(sales);
        
        const user = detectUserPattern();
        if (user) patterns.push(user);
        
        const inventory = detectInventoryPattern();
        if (inventory) patterns.push(inventory);
        
        const financial = detectFinancialPattern();
        if (financial) patterns.push(financial);
        
        const timeSeries = detectTimeSeriesPattern();
        if (timeSeries) patterns.push(timeSeries);
        
        // Sort by confidence (highest first)
        return patterns.sort((a, b) => b.confidence - a.confidence);
    }

    return {
        detectSalesPattern,
        detectUserPattern,
        detectInventoryPattern,
        detectFinancialPattern,
        detectTimeSeriesPattern,
        detectAllPatterns
    };
}
