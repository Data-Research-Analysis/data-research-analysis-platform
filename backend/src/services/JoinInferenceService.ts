import type { IInferredJoin } from '../types/ai-data-modeler/IInferredJoin.js';
import { getGeminiService } from './GeminiService.js';
import { SchemaCollectorService } from './SchemaCollectorService.js';
import { DataSource } from 'typeorm';
import { getRedisClient } from '../config/redis.config.js';

/**
 * Table schema structure from SchemaCollectorService
 */
interface ITableSchema {
    schema: string;
    tableName: string;
    displayName?: string;  // Logical/user-friendly name (e.g., "Orders" for "ds2_42d115c3")
    columns: IColumnSchema[];
    primaryKeys?: string[];
    foreignKeys?: any[];
}

interface IColumnSchema {
    column_name: string;
    data_type: string;
    is_nullable?: string;
    column_default?: string;
}

/**
 * Options for JOIN inference
 */
interface IJoinInferenceOptions {
    useAI?: boolean;           // Enable AI-powered suggestions
    userId?: number;           // User ID for tier/quota checking
    conversationId?: string;   // Gemini conversation ID for context
}

/**
 * JoinInferenceService - Singleton service for intelligent JOIN detection
 * 
 * Hybrid approach combining rule-based and AI-powered suggestions:
 * - Rule-based: Fast, deterministic pattern matching (always enabled)
 * - AI-powered: Semantic understanding via Gemini (optional, for Pro/Enterprise tiers)
 * 
 * Rule-based matching implements 5 patterns with confidence scoring:
 * 1. Exact column name match (95% confidence)
 * 2. ID pattern matching (90% confidence) - orders.id ↔ order_items.order_id
 * 3. Matching ID suffix (85% confidence) - product_id ↔ product_id
 * 4. Table reference in column name (75% confidence) - order_items.order_id ↔ orders.id
 * 5. Common identifier patterns (70% confidence) - uuid, code, key, reference
 * 
 * AI-powered matching provides:
 * - Semantic understanding of business relationships
 * - Better handling of non-standard naming conventions
 * - Context-aware suggestions based on domain knowledge
 * - Cross-source relationship detection
 * 
 * @see Issue #270: AI-Suggested Join Relationships for Non-FK Tables
 */
export class JoinInferenceService {
    private static instance: JoinInferenceService;

    private constructor() {}

    public static getInstance(): JoinInferenceService {
        if (!JoinInferenceService.instance) {
            JoinInferenceService.instance = new JoinInferenceService();
        }
        return JoinInferenceService.instance;
    }

    /**
     * Main entry point: Infer JOIN relationships between all table pairs
     * Supports hybrid rule-based + AI-powered approach
     * 
     * @param tables Array of table schemas from SchemaCollectorService
     * @param options Options for inference (AI enable, user tier, etc.)
     * @returns Array of suggested JOIN conditions with confidence scores
     */
    public async inferJoins(
        tables: ITableSchema[], 
        options?: IJoinInferenceOptions
    ): Promise<IInferredJoin[]> {
        const startTime = Date.now();

        console.log(`[JoinInferenceService] Analyzing ${tables.length} tables for join patterns`);
        console.log(`[JoinInferenceService] AI-powered suggestions: ${options?.useAI ? 'ENABLED' : 'DISABLED'}`);

        // Step 1: Always run rule-based suggestions (fast, free, deterministic)
        const ruleBasedSuggestions = await this.inferJoinsUsingRules(tables, options?.useAI, options?.conversationId);

        // Step 2: If AI enabled, enhance with semantic understanding
        let finalSuggestions = ruleBasedSuggestions;
        
        if (options?.useAI && options?.conversationId) {
            try {
                console.log(`[JoinInferenceService] Fetching AI-enhanced suggestions...`);
                const aiSuggestions = await this.inferJoinsUsingAI(tables, options.conversationId);
                
                // Merge and prioritize: AI suggestions get higher weight
                finalSuggestions = this.mergeAndRankSuggestions(aiSuggestions, ruleBasedSuggestions);
                
                console.log(`[JoinInferenceService] AI provided ${aiSuggestions.length} suggestions`);
            } catch (error) {
                console.error(`[JoinInferenceService] AI enhancement failed, falling back to rules:`, error);
                // Graceful degradation: use rule-based suggestions
            }
        }

        const processingTime = Date.now() - startTime;
        console.log(`[JoinInferenceService] Generated ${finalSuggestions.length} total suggestions in ${processingTime}ms`);

        return finalSuggestions;
    }

    /**
     * Rule-based JOIN inference (original implementation)
     * Fast, deterministic, works offline
     */
    private async inferJoinsUsingRules(
        tables: ITableSchema[], 
        useAI: boolean = false, 
        conversationId?: string
    ): Promise<IInferredJoin[]> {
        const startTime = Date.now();
        const suggestions: IInferredJoin[] = [];

        console.log(`[JoinInferenceService] Analyzing ${tables.length} tables for join patterns`);

        // Step 1: Detect potential junction tables (many-to-many relationships)
        const junctionTables = await this.detectJunctionTables(tables, useAI, conversationId);
        console.log(`[JoinInferenceService] Detected ${junctionTables.length} junction tables:`, 
            junctionTables.map(j => j.tableName));

        // Step 2: For each junction table, suggest joins to its referenced tables
        for (const junction of junctionTables) {
            console.log(`[JoinInferenceService] Processing junction table ${junction.tableName} with ${junction.referencedTables.length} referenced tables:`, 
                junction.referencedTables.map(r => `${r.tableName} via ${r.column}`));
            
            for (const refTable of junction.referencedTables) {
                const junctionTableObj = tables.find(t => t.tableName === junction.tableName);
                const refTableObj = tables.find(t => t.tableName === refTable.tableName);
                
                if (!junctionTableObj || !refTableObj) {
                    console.warn(`[JoinInferenceService] Could not find table objects for junction relationship`);
                    continue;
                }
                
                const suggestion = this.suggestJoinByColumnMatching(
                    junctionTableObj,
                    refTableObj
                );
                if (suggestion) {
                    // Mark as junction table join for better reasoning
                    suggestion.reasoning = `Junction table join: ${junction.tableName} connects multiple tables via ${refTable.column}`;
                    suggestion.matched_patterns.push('junction-table');
                    suggestions.push(suggestion);
                    console.log(`[JoinInferenceService] ✓ Junction join added: ${junction.tableName}.${suggestion.left_column} → ${refTable.tableName}.${suggestion.right_column} (${Math.round(suggestion.confidence_score * 100)}%)`);
                } else {
                    console.warn(`[JoinInferenceService] ✗ No match found for junction join: ${junction.tableName} → ${refTable.tableName}`);
                }
            }
        }

        // Step 3: Compare all other non-junction table pairs
        for (let i = 0; i < tables.length; i++) {
            for (let j = i + 1; j < tables.length; j++) {
                const table1 = tables[i];
                const table2 = tables[j];

                // Skip if BOTH tables are junction tables (no direct joins between junction tables)
                // But DO process if only ONE is a junction table (still need regular joins)
                const table1IsJunction = junctionTables.some(jt => jt.tableName === table1.tableName);
                const table2IsJunction = junctionTables.some(jt => jt.tableName === table2.tableName);

                if (table1IsJunction && table2IsJunction) {
                    continue; // Skip junction-to-junction joins
                }

                // Skip if this specific pair was already processed in junction relationships
                const alreadyProcessed = junctionTables.some(jt => {
                    // Check if this exact pair was already suggested in junction processing
                    return (jt.tableName === table1.tableName && jt.referencedTables.some(r => r.tableName === table2.tableName)) ||
                           (jt.tableName === table2.tableName && jt.referencedTables.some(r => r.tableName === table1.tableName));
                });

                if (alreadyProcessed) {
                    console.log(`[JoinInferenceService] Skipping already processed junction pair: ${table1.tableName} ↔ ${table2.tableName}`);
                    continue;
                }

                // Try to find best match between these two tables
                const suggestion = this.suggestJoinByColumnMatching(table1, table2);
                
                if (suggestion) {
                    suggestions.push(suggestion);
                    console.log(`[JoinInferenceService] Found match: ${table1.tableName}.${suggestion.left_column} ↔ ${table2.tableName}.${suggestion.right_column} (${Math.round(suggestion.confidence_score * 100)}%)`);
                }
            }
        }

        // Remove duplicates and rank by confidence
        const uniqueSuggestions = this.removeDuplicates(suggestions);
        const rankedSuggestions = this.rankByConfidence(uniqueSuggestions);

        const processingTime = Date.now() - startTime;
        console.log(`[JoinInferenceService] Generated ${rankedSuggestions.length} suggestions in ${processingTime}ms`);

        return rankedSuggestions;
    }

    /**
     * Detect junction/bridge tables (typically for many-to-many relationships)
     * 
     * Junction tables have these characteristics:
     * - Table name often contains common patterns (e.g., table1_table2, orders_products)
     * - Contains 2+ foreign key columns (e.g., order_id, product_id)
     * - Often has few non-FK columns
     * - Column names reference other table names
     * 
     * Detection methods:
     * 1. Pattern-based: column names like "order_id" matching table "orders" (physical or logical)
     * 2. Type-based: columns with same name/type as primary keys in other tables
     * 3. AI-powered: semantic analysis of table/column relationships
     */
    private async detectJunctionTables(
        tables: ITableSchema[],
        useAI: boolean = false,
        conversationId?: string
    ): Promise<Array<{
        tableName: string;
        referencedTables: Array<{ tableName: string; column: string }>;
    }>> {
        const junctionTables: Array<{
            tableName: string;
            referencedTables: Array<{ tableName: string; column: string }>;
        }> = [];

        // Build a lookup map for logical names
        const logicalNameMap = new Map<string, ITableSchema>();
        tables.forEach(table => {
            if (table.displayName) {
                // Extract the meaningful part of the logical name
                // Handle formats like "Products - ecommerce.xlsx" or "Orders - filename.csv"
                let cleanName = table.displayName.toLowerCase();
                
                // Remove file extensions and filenames after dash
                cleanName = cleanName
                    .replace(/\s*-\s*[^-]+\.(xlsx?|csv|pdf|txt)$/i, '') // Remove " - filename.ext"
                    .replace(/\.(xlsx?|csv|pdf|txt)$/i, '')              // Remove ".ext"
                    .trim();
                
                // Replace spaces with underscores for multi-word names (e.g., "order items" → "order_items")
                const cleanNameWithUnderscores = cleanName.replace(/\s+/g, '_');
                
                console.log(`[JoinInferenceService] Processing logical name: "${table.displayName}" → cleaned: "${cleanName}" → with underscores: "${cleanNameWithUnderscores}"`);
                
                // Map both versions: with spaces AND with underscores
                // Original with spaces
                logicalNameMap.set(cleanName, table);
                logicalNameMap.set(this.getSingular(cleanName), table);
                
                // Version with underscores (important for column matching like "order_items_id")
                if (cleanNameWithUnderscores !== cleanName) {
                    logicalNameMap.set(cleanNameWithUnderscores, table);
                    logicalNameMap.set(this.getSingular(cleanNameWithUnderscores), table);
                }
                
                // Also add with 's' suffix if not already plural
                if (!cleanName.endsWith('s')) {
                    logicalNameMap.set(cleanName + 's', table);
                }
                if (!cleanNameWithUnderscores.endsWith('s')) {
                    logicalNameMap.set(cleanNameWithUnderscores + 's', table);
                }
                
                // Handle compound names (e.g., "order items" → also add "orderitems" without separators)
                const noSpaces = cleanName.replace(/\s+/g, '');
                if (noSpaces !== cleanName && noSpaces !== cleanNameWithUnderscores) {
                    logicalNameMap.set(noSpaces, table);
                    logicalNameMap.set(this.getSingular(noSpaces), table);
                }
            }
        });

        console.log(`[JoinInferenceService] Logical name map contains ${logicalNameMap.size} entries: ${Array.from(logicalNameMap.keys()).join(', ')}`);


        for (const table of tables) {
            const referencedTables: Array<{ tableName: string; column: string }> = [];
            
            // Method 1: Pattern-based detection (column names like "order_id")
            // Now checks BOTH physical table names AND logical names
            for (const col of table.columns) {
                const colLower = col.column_name.toLowerCase();
                
                // Pattern: column ends with _id or _key
                if (colLower.endsWith('_id') || colLower.endsWith('_key')) {
                    const refTableName = colLower.replace(/_(id|key)$/, '');
                    
                    console.log(`[JoinInferenceService] ===== Analyzing column: ${table.tableName}.${col.column_name} =====`);
                    console.log(`[JoinInferenceService]   Extracted reference name: "${refTableName}"`);
                    
                    // Check PHYSICAL table names first (existing logic)
                    let matchingTable = tables.find(t => {
                        const tLower = t.tableName.toLowerCase();
                        return tLower === refTableName || 
                               tLower === refTableName + 's' || 
                               tLower === this.getSingular(refTableName);
                    });
                    
                    if (matchingTable) {
                        console.log(`[JoinInferenceService]   ✓ Matched via physical name: ${refTableName} → ${matchingTable.tableName}`);
                    } else {
                        console.log(`[JoinInferenceService]   ✗ No physical name match for: ${refTableName}`);
                        console.log(`[JoinInferenceService]   Trying logical name lookup in map...`);
                        
                        // If no physical match, check LOGICAL names
                        matchingTable = logicalNameMap.get(refTableName);
                        
                        if (matchingTable) {
                            console.log(`[JoinInferenceService]   ✓ Matched via logical name: ${refTableName} → ${matchingTable.displayName} (${matchingTable.tableName})`);
                        } else {
                            console.log(`[JoinInferenceService]   ✗ No logical name match for: "${refTableName}"`);
                            console.log(`[JoinInferenceService]   Available logical names: [${Array.from(logicalNameMap.keys()).join(', ')}]`);
                            
                            // Try with singular form explicitly
                            const singularRef = this.getSingular(refTableName);
                            if (singularRef !== refTableName) {
                                console.log(`[JoinInferenceService]   Trying singular form: "${singularRef}"`);
                                matchingTable = logicalNameMap.get(singularRef);
                                if (matchingTable) {
                                    console.log(`[JoinInferenceService]   ✓ Matched via singular: ${singularRef} → ${matchingTable.displayName} (${matchingTable.tableName})`);
                                } else {
                                    console.log(`[JoinInferenceService]   ✗ Singular form also not found: "${singularRef}"`);
                                }
                            }
                        }
                    }
                    
                    if (matchingTable) {
                        // Check if not already added
                        const alreadyAdded = referencedTables.some(r => r.tableName === matchingTable!.tableName);
                        if (!alreadyAdded) {
                            referencedTables.push({
                                tableName: matchingTable.tableName,
                                column: col.column_name
                            });
                            console.log(`[JoinInferenceService]   ✓ Added to referenced tables: ${matchingTable.tableName}`);
                        } else {
                            console.log(`[JoinInferenceService]   ⚠ Already in referenced tables: ${matchingTable.tableName}`);
                        }
                    } else {
                        console.log(`[JoinInferenceService]   ✗ FINAL: No match found for column ${col.column_name}`);
                    }
                }
            }
            
            // Method 2: Type-based detection (for Excel/CSV tables with cryptic names)
            // Look for columns that match primary key columns in other tables by name+type
            if (referencedTables.length < 2) {
                for (const col of table.columns) {
                    const colLower = col.column_name.toLowerCase();
                    
                    // Look for other tables that have this same column as a primary key
                    for (const otherTable of tables) {
                        if (otherTable.tableName === table.tableName) continue;
                        
                        // Check if this column matches a primary key in another table
                        const isPrimaryKeyInOther = otherTable.primaryKeys?.some(pk => 
                            pk.toLowerCase() === colLower
                        );
                        
                        if (isPrimaryKeyInOther) {
                            // Find the matching column to verify type compatibility
                            const matchingCol = otherTable.columns.find(c => 
                                c.column_name.toLowerCase() === colLower
                            );
                            
                            if (matchingCol && this.areTypesCompatible(col.data_type, matchingCol.data_type)) {
                                // Check if not already added
                                const alreadyAdded = referencedTables.some(r => r.tableName === otherTable.tableName);
                                if (!alreadyAdded) {
                                    referencedTables.push({
                                        tableName: otherTable.tableName,
                                        column: col.column_name
                                    });
                                    console.log(`[JoinInferenceService] ✓ Detected potential junction reference: ${table.displayName || table.tableName}.${col.column_name} → ${otherTable.displayName || otherTable.tableName} (matches PK)`);
                                }
                            }
                        }
                    }
                }
            }
            
            // Method 3: AI-powered detection for ambiguous cases
            if (useAI && conversationId && referencedTables.length < 2 && table.columns.length <= 10) {
                try {
                    const aiReferences = await this.detectJunctionUsingAI(table, tables, conversationId);
                    if (aiReferences.length > 0) {
                        console.log(`[JoinInferenceService] AI detected ${aiReferences.length} junction references for ${table.displayName || table.tableName}`);
                        aiReferences.forEach(ref => {
                            const alreadyAdded = referencedTables.some(r => r.tableName === ref.tableName);
                            if (!alreadyAdded) {
                                referencedTables.push(ref);
                            }
                        });
                    }
                } catch (error) {
                    console.error(`[JoinInferenceService] AI junction detection failed:`, error);
                }
            }
            
            // A junction table should reference at least 2 other tables
            if (referencedTables.length >= 2) {
                junctionTables.push({
                    tableName: table.tableName,
                    referencedTables
                });
            }
        }

        return junctionTables;
    }

    /**
     * Find best JOIN match between two tables using column name pattern analysis
     */
    private suggestJoinByColumnMatching(table1: ITableSchema, table2: ITableSchema): IInferredJoin | null {
        let bestMatch: IInferredJoin | null = null;
        let highestConfidence = 0;
        const MIN_CONFIDENCE = 0.6; // 60% threshold

        // Compare every column in table1 with every column in table2
        for (const col1 of table1.columns) {
            for (const col2 of table2.columns) {
                const match = this.evaluateColumnMatch(
                    col1,
                    col2,
                    table1.tableName,
                    table2.tableName
                );

                if (match.confidence > highestConfidence && match.confidence >= MIN_CONFIDENCE) {
                    highestConfidence = match.confidence;
                    
                    bestMatch = {
                        id: `inferred_join_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        left_schema: table1.schema,
                        left_table: table1.tableName,
                        left_column: col1.column_name,
                        left_column_type: col1.data_type,
                        right_schema: table2.schema,
                        right_table: table2.tableName,
                        right_column: col2.column_name,
                        right_column_type: col2.data_type,
                        confidence: this.getConfidenceLevel(match.confidence),
                        confidence_score: match.confidence,
                        reasoning: match.reason,
                        suggested_join_type: 'LEFT', // Default to LEFT JOIN for safety
                        matched_patterns: match.patterns || [],
                        created_at: new Date(),
                        applied: false,
                        dismissed: false
                    };
                }
            }
        }

        return bestMatch;
    }

    /**
     * Evaluate if two columns are likely JOIN candidates using 5 matching rules
     */
    private evaluateColumnMatch(
        col1: IColumnSchema,
        col2: IColumnSchema,
        table1Name: string,
        table2Name: string
    ): { confidence: number; reason: string; patterns: string[] } {
        const col1Lower = col1.column_name.toLowerCase();
        const col2Lower = col2.column_name.toLowerCase();
        const table1Lower = table1Name.toLowerCase();
        const table2Lower = table2Name.toLowerCase();
        const patterns: string[] = [];

        // Check type compatibility first
        if (!this.areTypesCompatible(col1.data_type, col2.data_type)) {
            return { confidence: 0, reason: 'Incompatible types', patterns: [] };
        }

        patterns.push('type_match');

        // Rule 1: Exact name match (95% confidence)
        if (col1Lower === col2Lower) {
            return {
                confidence: 0.95,
                reason: `Exact column name match: ${col1.column_name}`,
                patterns: ['exact_name_match', ...patterns]
            };
        }

        // Rule 2: ID pattern matching (90% confidence)
        const table1Singular = this.getSingular(table1Lower);
        const table2Singular = this.getSingular(table2Lower);

        if (col1Lower === 'id' && col2Lower === `${table1Singular}_id`) {
            return {
                confidence: 0.90,
                reason: `ID pattern: ${table1Name}.id → ${col2.column_name}`,
                patterns: ['id_suffix', ...patterns]
            };
        }
        if (col2Lower === 'id' && col1Lower === `${table2Singular}_id`) {
            return {
                confidence: 0.90,
                reason: `ID pattern: ${table2Name}.id → ${col1.column_name}`,
                patterns: ['id_suffix', ...patterns]
            };
        }

        // Rule 3: Both columns have matching suffix (85% confidence)
        if (col1Lower.endsWith('_id') && col2Lower.endsWith('_id')) {
            const col1Prefix = col1Lower.replace(/_id$/, '');
            const col2Prefix = col2Lower.replace(/_id$/, '');
            if (col1Prefix === col2Prefix) {
                return {
                    confidence: 0.85,
                    reason: `Matching ID suffix: ${col1.column_name}`,
                    patterns: ['matching_suffix', ...patterns]
                };
            }
        }

        // Rule 4: Column name references the other table (75% confidence)
        if (col1Lower.includes(table2Singular) && col2Lower === 'id') {
            return {
                confidence: 0.75,
                reason: `Table reference: ${col1.column_name} → ${table2Name}`,
                patterns: ['table_reference', ...patterns]
            };
        }
        if (col2Lower.includes(table1Singular) && col1Lower === 'id') {
            return {
                confidence: 0.75,
                reason: `Table reference: ${col2.column_name} → ${table1Name}`,
                patterns: ['table_reference', ...patterns]
            };
        }

        // Rule 5: Common identifier patterns (70% confidence)
        const idPatterns = ['uuid', 'code', 'key', 'reference', 'ref'];
        for (const pattern of idPatterns) {
            if (col1Lower === pattern && col2Lower === pattern) {
                return {
                    confidence: 0.70,
                    reason: `Common identifier pattern: ${pattern}`,
                    patterns: ['common_pattern', ...patterns]
                };
            }
            if (col1Lower === `${table2Singular}_${pattern}` && col2Lower === pattern) {
                return {
                    confidence: 0.70,
                    reason: `Identifier reference: ${col1.column_name}`,
                    patterns: ['common_pattern', ...patterns]
                };
            }
            if (col2Lower === `${table1Singular}_${pattern}` && col1Lower === pattern) {
                return {
                    confidence: 0.70,
                    reason: `Identifier reference: ${col2.column_name}`,
                    patterns: ['common_pattern', ...patterns]
                };
            }
        }

        // No match found
        return { confidence: 0, reason: 'No pattern match', patterns: [] };
    }

    /**
     * Check if two data types are compatible for JOIN operations
     */
    private areTypesCompatible(type1: string, type2: string): boolean {
        if (!type1 || !type2) return false;

        const t1 = type1.toLowerCase();
        const t2 = type2.toLowerCase();

        // Exact match
        if (t1 === t2) return true;

        // Define type families
        const intTypes = ['int', 'integer', 'smallint', 'bigint', 'serial', 'bigserial'];
        const numericTypes = ['numeric', 'decimal', 'real', 'double', 'float', 'money'];
        const textTypes = ['char', 'varchar', 'text', 'character'];
        const dateTypes = ['date', 'timestamp', 'timestamptz', 'time', 'timetz'];
        const uuidTypes = ['uuid'];

        const families = [intTypes, numericTypes, textTypes, dateTypes, uuidTypes];

        // Check if both types belong to the same family
        for (const family of families) {
            const t1InFamily = family.some(type => t1.includes(type));
            const t2InFamily = family.some(type => t2.includes(type));

            if (t1InFamily && t2InFamily) {
                return true;
            }
        }

        return false;
    }

    /**
     * Convert plural table names to singular for pattern matching
     */
    private getSingular(word: string): string {
        if (!word) return word;

        const lower = word.toLowerCase();

        // Special cases
        const specialCases: Record<string, string> = {
            'people': 'person',
            'children': 'child',
            'men': 'man',
            'women': 'woman'
        };

        if (specialCases[lower]) {
            return specialCases[lower];
        }

        // Standard rules
        if (lower.endsWith('ies')) {
            return lower.slice(0, -3) + 'y'; // categories → category
        }
        if (lower.endsWith('es')) {
            return lower.slice(0, -2); // boxes → box
        }
        if (lower.endsWith('s')) {
            return lower.slice(0, -1); // orders → order
        }

        return lower;
    }

    /**
     * Convert numeric confidence to category
     */
    private getConfidenceLevel(score: number): 'high' | 'medium' | 'low' {
        if (score >= 0.7) return 'high';
        if (score >= 0.4) return 'medium';
        return 'low';
    }

    /**
     * Use AI to detect if a table is a junction table and identify referenced tables
     * This is helpful for tables with cryptic names where pattern matching fails
     */
    private async detectJunctionUsingAI(
        table: ITableSchema, 
        allTables: ITableSchema[], 
        conversationId: string
    ): Promise<Array<{ tableName: string; column: string }>> {
        try {
            const geminiService = getGeminiService();
            
            // Initialize conversation if it doesn't exist yet
            try {
                await geminiService.initializeConversation(conversationId, 'You are a database expert analyzing table relationships.');
            } catch (error) {
                // Conversation might already exist, that's okay
                console.log(`[JoinInferenceService] Conversation ${conversationId} may already exist, continuing...`);
            }
            
            // Build context with logical names
            const tableInfo = {
                physical_name: table.tableName,
                logical_name: table.displayName || table.tableName,
                columns: table.columns.map(c => ({
                    name: c.column_name,
                    type: c.data_type
                })),
                primary_keys: table.primaryKeys || []
            };
            
            const otherTablesInfo = allTables
                .filter(t => t.tableName !== table.tableName)
                .map(t => ({
                    physical_name: t.tableName,
                    logical_name: t.displayName || t.tableName,
                    columns: t.columns.map(c => c.column_name),
                    primary_keys: t.primaryKeys || []
                }));
            
            const prompt = `You are a database expert analyzing table relationships.

CANDIDATE TABLE TO ANALYZE:
${JSON.stringify(tableInfo, null, 2)}

OTHER TABLES IN SCHEMA:
${JSON.stringify(otherTablesInfo, null, 2)}

QUESTION: Is "${tableInfo.logical_name}" (physical: ${tableInfo.physical_name}) a JUNCTION/BRIDGE table?

A junction table typically:
- Has 2+ columns that reference primary keys in other tables
- Has few non-foreign-key columns (often just the FKs plus timestamps)
- Serves to create many-to-many relationships between other tables
- May have compound primary keys

TASK: 
1. Determine if this is likely a junction table (yes/no)
2. If YES, identify which OTHER tables it connects by analyzing column names/types
3. Consider BOTH physical names AND logical names when matching

Return ONLY a JSON object in this format:
{
  "is_junction": true or false,
  "confidence": 0-100,
  "referenced_tables": [
    {
      "table_name": "physical_table_name",
      "column": "column_name_in_junction",
      "reasoning": "brief explanation"
    }
  ]
}

If NOT a junction table, return:
{
  "is_junction": false,
  "confidence": 0,
  "referenced_tables": []
}`;

            const response = await geminiService.sendMessage(conversationId, prompt);
            
            // Parse JSON response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                console.warn('[JoinInferenceService] AI response missing JSON structure');
                return [];
            }
            
            const result = JSON.parse(jsonMatch[0]);
            
            if (result.is_junction && result.confidence >= 70 && result.referenced_tables?.length >= 2) {
                console.log(`[JoinInferenceService] AI confirmed ${table.displayName || table.tableName} is a junction table (${result.confidence}% confidence)`);
                
                // Validate table names exist
                const validReferences = result.referenced_tables
                    .map((ref: any) => {
                        const matchingTable = allTables.find(t => 
                            t.tableName === ref.table_name || 
                            t.displayName?.toLowerCase() === ref.table_name.toLowerCase()
                        );
                        if (matchingTable) {
                            return {
                                tableName: matchingTable.tableName,
                                column: ref.column
                            };
                        }
                        return null;
                    })
                    .filter((ref: any) => ref !== null);
                
                return validReferences;
            }
            
            return [];
            
        } catch (error) {
            console.error(`[JoinInferenceService] AI junction detection failed for ${table.tableName}:`, error);
            return [];
        }
    }

    /**
     * AI-powered JOIN inference using Gemini
     * Provides semantic understanding of business relationships
     * 
     * @param tables Array of table schemas
     * @param conversationId Gemini conversation ID for context
     * @returns Array of AI-suggested JOIN conditions
     */
    private async inferJoinsUsingAI(tables: ITableSchema[], conversationId: string): Promise<IInferredJoin[]> {
        const geminiService = getGeminiService();
        
        // Format schema for AI consumption
        const schemaContext = this.formatSchemaForAI(tables);
        
        const prompt = `You are a database expert analyzing table schemas to suggest JOIN relationships.

SCHEMA ANALYSIS:
${schemaContext}

TASK: Suggest JOIN relationships between these tables based on:
1. Semantic column meanings (not just syntactic names)
2. Business logic relationships (e.g., orders belong to customers)
3. Data cardinality patterns (one-to-many, many-to-many)
4. Junction/bridge table detection
5. Cross-reference patterns

For each suggested join, provide:
- left_table: Source table name (use the PHYSICAL table name from the schema)
- left_column: Source column name
- right_table: Target table name (use the PHYSICAL table name from the schema)
- right_column: Target column name
- confidence_score: 0-100 (your confidence in this suggestion)
- reasoning: Business justification for this join (2-3 sentences)
- join_type: INNER, LEFT, or RIGHT (recommend based on cardinality)

IMPORTANT:
- Tables have both PHYSICAL names (e.g., ds2_42d115c3) and LOGICAL names (e.g., "Order Items - ecommerce.xlsx")
- Use LOGICAL names to understand relationships, but return PHYSICAL names in suggestions
- Only suggest joins that make semantic business sense
- Avoid suggesting joins between unrelated entities
- Detect junction tables and suggest appropriate two-step joins
- Consider plural/singular table name variations
- Look for columns like "order_id" that reference logical table names like "Orders"
- Confidence should reflect semantic certainty, not just naming similarity

Return ONLY a JSON array of suggestions. Example format:
[
  {
    "left_table": "ds2_orders",
    "left_column": "customer_id",
    "right_table": "ds2_customers",
    "right_column": "id",
    "confidence_score": 95,
    "reasoning": "Orders are placed by customers. The customer_id in orders references the primary key in customers table. This is a standard one-to-many relationship.",
    "join_type": "LEFT"
  }
]`;

        try {
            // Initialize conversation if it doesn't exist yet
            try {
                await geminiService.initializeConversation(conversationId, 'You are a database expert analyzing table schemas to suggest JOIN relationships.');
            } catch (error) {
                // Conversation might already exist, that's okay
                console.log(`[JoinInferenceService] Conversation ${conversationId} may already exist for AI inference, continuing...`);
            }
            
            const response = await geminiService.sendMessage(conversationId, prompt);
            
            // Parse AI response
            const aiSuggestions = this.parseAISuggestions(response, tables);
            
            console.log(`[JoinInferenceService] AI parsed ${aiSuggestions.length} suggestions`);
            return aiSuggestions;
            
        } catch (error) {
            console.error(`[JoinInferenceService] AI inference failed:`, error);
            return []; // Return empty array on failure (graceful degradation)
        }
    }

    /**
     * Format table schemas into markdown for AI consumption
     */
    private formatSchemaForAI(tables: ITableSchema[]): string {
        let markdown = '';
        
        for (const table of tables) {
            // Include both physical and logical names for better AI understanding
            const logicalName = table.displayName && table.displayName !== table.tableName 
                ? ` (Logical: "${table.displayName}")`
                : '';
            
            markdown += `\n## Table: ${table.schema}.${table.tableName}${logicalName}\n`;
            
            markdown += `**Columns:**\n`;
            
            for (const col of table.columns) {
                const nullable = col.is_nullable === 'YES' ? ' (nullable)' : '';
                const isPK = table.primaryKeys?.includes(col.column_name) ? ' [PRIMARY KEY]' : '';
                markdown += `- ${col.column_name}: ${col.data_type}${nullable}${isPK}\n`;
            }
            
            // Add FK info if available
            if (table.foreignKeys && table.foreignKeys.length > 0) {
                markdown += `\n**Foreign Keys:**\n`;
                for (const fk of table.foreignKeys) {
                    markdown += `- ${fk.column_name} → ${fk.foreign_table}.${fk.foreign_column}\n`;
                }
            }
            
            markdown += `\n`;
        }
        
        return markdown;
    }

    /**
     * Parse AI response into IInferredJoin[] format
     */
    private parseAISuggestions(aiResponse: string, tables: ITableSchema[]): IInferredJoin[] {
        try {
            // Extract JSON from markdown code blocks if present
            let jsonString = aiResponse;
            const jsonMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (jsonMatch) {
                jsonString = jsonMatch[1];
            }
            
            const rawSuggestions = JSON.parse(jsonString);
            
            if (!Array.isArray(rawSuggestions)) {
                console.warn('[JoinInferenceService] AI response is not an array');
                return [];
            }
            
            // Convert to IInferredJoin format
            const suggestions: IInferredJoin[] = [];
            
            for (const raw of rawSuggestions) {
                // Clean table names - AI might include schema prefix (e.g., "dra_excel.ds2_7e1dc7cf")
                const leftTableName = raw.left_table.includes('.') 
                    ? raw.left_table.split('.').pop() 
                    : raw.left_table;
                const rightTableName = raw.right_table.includes('.') 
                    ? raw.right_table.split('.').pop() 
                    : raw.right_table;
                
                // Find table schemas to get correct schema names and data types
                const leftTable = tables.find(t => t.tableName.toLowerCase() === leftTableName.toLowerCase());
                const rightTable = tables.find(t => t.tableName.toLowerCase() === rightTableName.toLowerCase());
                
                if (!leftTable || !rightTable) {
                    console.warn(`[JoinInferenceService] AI suggested unknown tables: ${raw.left_table} or ${raw.right_table}`);
                    console.log(`[JoinInferenceService] Available tables:`, tables.map(t => t.tableName).join(', '));
                    continue;
                }
                
                const leftColumn = leftTable.columns.find(c => c.column_name.toLowerCase() === raw.left_column.toLowerCase());
                const rightColumn = rightTable.columns.find(c => c.column_name.toLowerCase() === raw.right_column.toLowerCase());
                
                if (!leftColumn || !rightColumn) {
                    console.warn(`[JoinInferenceService] AI suggested unknown columns: ${raw.left_column} or ${raw.right_column}`);
                    continue;
                }
                
                // Normalize confidence score (AI might return 0-100 or 0-1)
                const confidenceScore = raw.confidence_score > 1 ? raw.confidence_score / 100 : raw.confidence_score;
                
                suggestions.push({
                    id: `ai_join_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    left_schema: leftTable.schema,
                    left_table: leftTable.tableName,
                    left_column: leftColumn.column_name,
                    left_column_type: leftColumn.data_type,
                    right_schema: rightTable.schema,
                    right_table: rightTable.tableName,
                    right_column: rightColumn.column_name,
                    right_column_type: rightColumn.data_type,
                    confidence: this.getConfidenceLevel(confidenceScore),
                    confidence_score: confidenceScore,
                    reasoning: raw.reasoning || 'AI-suggested relationship based on semantic analysis',
                    suggested_join_type: raw.join_type || 'LEFT',
                    matched_patterns: ['ai-powered', 'semantic-analysis'],
                    created_at: new Date(),
                    applied: false,
                    dismissed: false
                });
            }
            
            return suggestions;
            
        } catch (error) {
            console.error('[JoinInferenceService] Failed to parse AI suggestions:', error);
            return [];
        }
    }

    /**
     * Merge AI and rule-based suggestions, prioritizing AI
     */
    private mergeAndRankSuggestions(aiSuggestions: IInferredJoin[], ruleSuggestions: IInferredJoin[]): IInferredJoin[] {
        // Create a map to detect overlaps
        const aiMap = new Map<string, IInferredJoin>();
        
        for (const aiSugg of aiSuggestions) {
            const key = this.createJoinKey(aiSugg);
            aiMap.set(key, aiSugg);
        }
        
        // Add rule-based suggestions that don't conflict with AI
        const merged: IInferredJoin[] = [...aiSuggestions];
        
        for (const ruleSugg of ruleSuggestions) {
            const key = this.createJoinKey(ruleSugg);
            const reverseKey = this.createReverseJoinKey(ruleSugg);
            
            // Only add if AI didn't suggest this join
            if (!aiMap.has(key) && !aiMap.has(reverseKey)) {
                // Boost confidence slightly if rule-based also found it
                merged.push(ruleSugg);
            } else {
                // AI and rules agree - boost AI suggestion confidence
                const aiSugg = aiMap.get(key) || aiMap.get(reverseKey);
                if (aiSugg && aiSugg.confidence_score < 0.95) {
                    aiSugg.confidence_score = Math.min(0.98, aiSugg.confidence_score + 0.05);
                    aiSugg.matched_patterns.push('confirmed-by-rules');
                    aiSugg.reasoning += ' (Confirmed by pattern analysis)';
                }
            }
        }
        
        // Sort by confidence (highest first)
        return this.rankByConfidence(merged);
    }

    /**
     * Create unique key for join (order-independent)
     */
    private createJoinKey(join: IInferredJoin): string {
        return `${join.left_schema}.${join.left_table}.${join.left_column}::${join.right_schema}.${join.right_table}.${join.right_column}`;
    }

    /**
     * Create reverse join key for bidirectional matching
     */
    private createReverseJoinKey(join: IInferredJoin): string {
        return `${join.right_schema}.${join.right_table}.${join.right_column}::${join.left_schema}.${join.left_table}.${join.left_column}`;
    }

    /**
     * Infer JOIN relationships from an entire data source
     * Used for preloading suggestions on page load
     * 
     * @param dataSource TypeORM DataSource for the database
     * @param schemaName Optional schema name (defaults to 'public' for PostgreSQL)
     * @param options Inference options (AI enable, user tier, etc.)
     * @param maxTables Maximum number of tables to analyze (default: 20)
     * @returns Promise<IInferredJoin[]> All possible join suggestions
     */
    public async inferJoinsFromDataSource(
        dataSource: DataSource,
        dataSourceId: number,
        schemaName?: string,
        options?: IJoinInferenceOptions,
        maxTables: number = 20
    ): Promise<IInferredJoin[]> {
        const startTime = Date.now();
        // Use numeric dataSourceId for unique cache key per Excel file
        const cacheKey = `join-suggestions:ds${dataSourceId}:${schemaName || 'default'}`;

        console.log(`[JoinInferenceService] Inferring joins for data source ID: ${dataSourceId}`);

        // Try Redis cache first
        try {
            const redis = getRedisClient();
            const cached = await redis.get(cacheKey);
            
            if (cached) {
                const suggestions = JSON.parse(cached);
                console.log(`[JoinInferenceService] Cache HIT: ${cacheKey} (${suggestions.length} suggestions)`);
                return suggestions;
            }
            
            console.log(`[JoinInferenceService] Cache MISS: ${cacheKey}`);
        } catch (error) {
            console.warn(`[JoinInferenceService] Redis cache error:`, error);
            // Continue without cache
        }

        // Collect schema for all tables
        const schemaCollector = new SchemaCollectorService();
        let tables: ITableSchema[];

        try {
            const collectedTables = await schemaCollector.collectSchema(
                dataSource, 
                schemaName
            );

            // Limit to maxTables to prevent performance issues
            if (collectedTables.length > maxTables) {
                console.warn(`[JoinInferenceService] Data source has ${collectedTables.length} tables, limiting to ${maxTables}`);
                tables = collectedTables.slice(0, maxTables);
            } else {
                tables = collectedTables;
            }

            console.log(`[JoinInferenceService] Collected schema for ${tables.length} tables`);
        } catch (error) {
            console.error(`[JoinInferenceService] Failed to collect schema:`, error);
            return [];
        }

        // Fetch display names from dra_table_metadata (platform database)
        // Use dataSource which is already connected (passed from controller)
        let displayNameMap = new Map<string, string>();
        
        try {
            const metadataQuery = `
                SELECT physical_table_name, logical_table_name
                FROM dra_table_metadata
                WHERE data_source_id = $1 AND schema_name = $2
            `;
            const metadata = await dataSource.query(metadataQuery, [dataSourceId, schemaName || 'public']);
            
            // Build lookup map: physical_table_name → logical_table_name
            metadata.forEach((row: any) => {
                displayNameMap.set(row.physical_table_name, row.logical_table_name);
            });
        } catch (error) {
            console.warn(`[JoinInferenceService] Failed to fetch metadata, using physical names:`, error);
            // Continue with physical names as fallback
        }

        // Convert to ITableSchema format with displayName from metadata
        const formattedTables: ITableSchema[] = tables.map(t => ({
            schema: t.schema,
            tableName: t.tableName,
            displayName: displayNameMap.get(t.tableName) || t.tableName,
            columns: t.columns,
            primaryKeys: t.primaryKeys,
            foreignKeys: t.foreignKeys
        }));

        // Run inference on all tables
        const suggestions = await this.inferJoins(formattedTables, options);

        // Cache results for 24 hours (unique per data source ID)
        try {
            const redis = getRedisClient();
            await redis.setex(cacheKey, 86400, JSON.stringify(suggestions));
            console.log(`[JoinInferenceService] Cached ${suggestions.length} suggestions at ${cacheKey} (24h TTL, unique per data source)`);
        } catch (error) {
            console.warn(`[JoinInferenceService] Failed to cache results:`, error);
            // Continue without caching
        }

        const processingTime = Date.now() - startTime;
        console.log(`[JoinInferenceService] Completed data source inference in ${processingTime}ms`);

        return suggestions;
    }

    /**
     * Remove duplicate suggestions (same join, different order)
     */
    private removeDuplicates(suggestions: IInferredJoin[]): IInferredJoin[] {
        const seen = new Set<string>();
        const unique: IInferredJoin[] = [];

        for (const suggestion of suggestions) {
            // Create bidirectional key
            const key1 = `${suggestion.left_schema}.${suggestion.left_table}.${suggestion.left_column}|${suggestion.right_schema}.${suggestion.right_table}.${suggestion.right_column}`;
            const key2 = `${suggestion.right_schema}.${suggestion.right_table}.${suggestion.right_column}|${suggestion.left_schema}.${suggestion.left_table}.${suggestion.left_column}`;

            if (!seen.has(key1) && !seen.has(key2)) {
                seen.add(key1);
                unique.push(suggestion);
            }
        }

        return unique;
    }

    /**
     * Sort suggestions by confidence score (descending)
     */
    private rankByConfidence(suggestions: IInferredJoin[]): IInferredJoin[] {
        return suggestions.sort((a, b) => b.confidence_score - a.confidence_score);
    }
}
