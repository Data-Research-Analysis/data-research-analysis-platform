import type { IInferredJoin } from '../types/ai-data-modeler/IInferredJoin.js';

interface TableColumn {
    column_name: string;
    data_type: string;
    is_nullable: string;
    column_default: string | null;
    character_maximum_length: number | null;
}

interface ForeignKey {
    constraint_name: string;
    table_name: string;
    column_name: string;
    foreign_table_name: string;
    foreign_column_name: string;
}

interface TableSchema {
    schema: string;
    tableName: string;
    columns: TableColumn[];
    primaryKeys: string[];
    foreignKeys: ForeignKey[];
}

interface Relationship {
    fromTable: string;
    fromColumn: string;
    toTable: string;
    toColumn: string;
    relationshipType: string;
}

export class SchemaFormatterUtility {
    /**
     * Format table schemas into markdown format for AI consumption
     * @param tables Array of table schemas
     * @param inferredJoins Optional array of AI-suggested JOIN relationships (for non-FK sources)
     */
    static formatSchemaToMarkdown(tables: TableSchema[], inferredJoins?: IInferredJoin[]): string {
        let markdown = '# Database Schema Information\n\n';
        
        // Add tables section
        markdown += '## Tables\n\n';
        
        for (const table of tables) {
            // Show display name if available
            const displayName = (table as any).displayName;
            if (displayName && displayName !== table.tableName) {
                markdown += `### Table: ${displayName} \`(${table.schema}.${table.tableName})\`\n`;
            } else {
                markdown += `### Table: ${table.schema}.${table.tableName}\n`;
            }
            markdown += '| Column Name | Data Type | Constraints |\n';
            markdown += '|-------------|-----------|-------------|\n';
            
            for (const column of table.columns) {
                const constraints = this.formatColumnConstraints(
                    column,
                    table.primaryKeys,
                    table.foreignKeys
                );
                const dataType = this.formatDataType(column);
                markdown += `| ${column.column_name} | ${dataType} | ${constraints} |\n`;
            }
            
            markdown += '\n';
        }
        
        // Add explicit foreign key relationships section
        const relationships = this.extractRelationships(tables);
        if (relationships.length > 0) {
            markdown += '## Relationships (Explicit Foreign Keys)\n\n';
            
            let relationshipIndex = 1;
            for (const rel of relationships) {
                markdown += `${relationshipIndex}. **${rel.fromTable} → ${rel.toTable}** (${rel.relationshipType})\n`;
                markdown += `   - Foreign Key: ${rel.fromTable}.${rel.fromColumn} → ${rel.toTable}.${rel.toColumn}\n`;
                markdown += `   - Description: ${this.generateRelationshipDescription(rel)}\n\n`;
                relationshipIndex++;
            }
        } else {
            markdown += '## Relationships (Explicit Foreign Keys)\n\n';
            markdown += '*No explicit foreign key relationships detected (common for Excel, PDF, or CSV sources).*\n\n';
        }
        
        // Add inferred relationships section if provided
        if (inferredJoins && inferredJoins.length > 0) {
            markdown += this.formatInferredRelationships(inferredJoins);
        }
        
        return markdown;
    }

    /**
     * Format column constraints into readable text
     */
    private static formatColumnConstraints(
        column: TableColumn,
        primaryKeys: string[],
        foreignKeys: ForeignKey[]
    ): string {
        const constraints: string[] = [];
        
        // Check if primary key
        if (primaryKeys.includes(column.column_name)) {
            constraints.push('PRIMARY KEY');
        }
        
        // Check if foreign key
        const fk = foreignKeys.find(fk => fk.column_name === column.column_name);
        if (fk) {
            constraints.push(`FOREIGN KEY (${fk.foreign_table_name}.${fk.foreign_column_name})`);
        }
        
        // Check if nullable
        if (column.is_nullable === 'NO') {
            constraints.push('NOT NULL');
        }
        
        // Check if has default
        if (column.column_default) {
            const defaultValue = column.column_default.substring(0, 30);
            constraints.push(`DEFAULT ${defaultValue}`);
        }
        
        // Check if unique (common pattern in defaults)
        if (column.column_default && column.column_default.includes('UNIQUE')) {
            constraints.push('UNIQUE');
        }
        
        return constraints.length > 0 ? constraints.join(', ') : '-';
    }

    /**
     * Format data type with length if applicable
     */
    private static formatDataType(column: TableColumn): string {
        // Handle undefined or null data_type
        if (!column.data_type) {
            return 'UNKNOWN';
        }
        
        let dataType = column.data_type.toUpperCase();
        
        if (column.character_maximum_length) {
            dataType += `(${column.character_maximum_length})`;
        }
        
        return dataType;
    }

    /**
     * Extract all relationships from foreign keys
     */
    private static extractRelationships(tables: TableSchema[]): Relationship[] {
        const relationships: Relationship[] = [];
        const relationshipMap = new Map<string, number>();
        
        for (const table of tables) {
            for (const fk of table.foreignKeys) {
                const relKey = `${fk.table_name}.${fk.column_name}->${fk.foreign_table_name}.${fk.foreign_column_name}`;
                
                // Avoid duplicates
                if (!relationshipMap.has(relKey)) {
                    // Determine relationship type
                    const relationshipType = this.determineRelationshipType(
                        table,
                        fk,
                        tables
                    );
                    
                    relationships.push({
                        fromTable: fk.table_name,
                        fromColumn: fk.column_name,
                        toTable: fk.foreign_table_name,
                        toColumn: fk.foreign_column_name,
                        relationshipType
                    });
                    
                    relationshipMap.set(relKey, 1);
                }
            }
        }
        
        return relationships;
    }

    /**
     * Determine relationship type (One-to-Many, Many-to-One, etc.)
     */
    private static determineRelationshipType(
        table: TableSchema,
        fk: ForeignKey,
        allTables: TableSchema[]
    ): string {
        // Check if the foreign key column is also a primary key (One-to-One)
        if (table.primaryKeys.includes(fk.column_name)) {
            return 'One-to-One';
        }
        
        // Check if this is a junction table (Many-to-Many)
        if (table.foreignKeys.length >= 2 && table.columns.length <= 4) {
            return 'Many-to-Many (Junction)';
        }
        
        // Default to One-to-Many
        return 'One-to-Many';
    }

    /**
     * Generate human-readable relationship description
     */
    private static generateRelationshipDescription(rel: Relationship): string {
        const fromTableSingular = this.singularize(rel.fromTable);
        const toTableSingular = this.singularize(rel.toTable);
        
        if (rel.relationshipType === 'One-to-One') {
            return `Each ${fromTableSingular} is associated with one ${toTableSingular}`;
        } else if (rel.relationshipType === 'One-to-Many') {
            return `A ${toTableSingular} can have multiple ${rel.fromTable}`;
        } else if (rel.relationshipType.includes('Many-to-Many')) {
            return `${rel.fromTable} and ${rel.toTable} have a many-to-many relationship`;
        }
        
        return `${rel.fromTable} references ${rel.toTable}`;
    }

    /**
     * Simple singularize function (basic implementation)
     */
    private static singularize(word: string): string {
        if (word.endsWith('ies')) {
            return word.slice(0, -3) + 'y';
        } else if (word.endsWith('ses') || word.endsWith('xes') || word.endsWith('zes')) {
            return word.slice(0, -2);
        } else if (word.endsWith('s') && !word.endsWith('ss')) {
            return word.slice(0, -1);
        }
        return word;
    }

    /**
     * Format inferred JOIN relationships for AI consumption
     * Shows pattern-based suggestions when explicit FKs are not available
     */
    private static formatInferredRelationships(inferredJoins: IInferredJoin[]): string {
        let markdown = '## Inferred Relationships (Pattern-Based Suggestions)\n\n';
        markdown += '*These joins are suggested based on column name and type analysis. Use them when the user requests multi-table queries.*\n\n';

        // Group by confidence level
        const highConfidence = inferredJoins.filter(j => j.confidence === 'high');
        const mediumConfidence = inferredJoins.filter(j => j.confidence === 'medium');
        const lowConfidence = inferredJoins.filter(j => j.confidence === 'low');

        // High confidence suggestions (>70%)
        if (highConfidence.length > 0) {
            markdown += '### 🟢 High Confidence Suggestions (>70%)\n';
            markdown += '*These follow standard database patterns (e.g., customer_id → customers.id). Treat these AS IF they were explicit foreign keys.*\n\n';
            
            for (const join of highConfidence) {
                markdown += `- **${join.left_table}.${join.left_column}** → **${join.right_table}.${join.right_column}**\n`;
                markdown += `  - Confidence: ${Math.round(join.confidence_score * 100)}%\n`;
                markdown += `  - Reasoning: ${join.reasoning}\n`;
                markdown += `  - Suggested JOIN: ${join.suggested_join_type} JOIN\n`;
                markdown += `  - Patterns: ${join.matched_patterns.join(', ')}\n`;
                markdown += `  - Column Types: ${join.left_column_type} ↔ ${join.right_column_type}\n\n`;
            }
        }

        // Medium confidence suggestions (40-70%)
        if (mediumConfidence.length > 0) {
            markdown += '### 🟡 Medium Confidence Suggestions (40-70%)\n';
            markdown += '*These are plausible joins based on naming patterns. Review the reasoning before using.*\n\n';
            
            for (const join of mediumConfidence) {
                markdown += `- **${join.left_table}.${join.left_column}** → **${join.right_table}.${join.right_column}**\n`;
                markdown += `  - Confidence: ${Math.round(join.confidence_score * 100)}%\n`;
                markdown += `  - Reasoning: ${join.reasoning}\n`;
                markdown += `  - Suggested JOIN: ${join.suggested_join_type} JOIN\n`;
                markdown += `  - Patterns: ${join.matched_patterns.join(', ')}\n`;
                markdown += `  - ⚠️ Note: Verify this join makes business sense before using\n\n`;
            }
        }

        // Low confidence suggestions (<40%)
        if (lowConfidence.length > 0) {
            markdown += '### 🔴 Low Confidence Suggestions (<40%)\n';
            markdown += '*These are weak matches. Only use if the user explicitly requests these specific columns.*\n\n';
            
            for (const join of lowConfidence) {
                markdown += `- **${join.left_table}.${join.left_column}** → **${join.right_table}.${join.right_column}**\n`;
                markdown += `  - Confidence: ${Math.round(join.confidence_score * 100)}%\n`;
                markdown += `  - Reasoning: ${join.reasoning}\n`;
                markdown += `  - ⚠️ Caution: High risk of incorrect join\n\n`;
            }
        }

        return markdown;
    }

    /**
     * Format schema for compact JSON representation
     */
    static formatSchemaToJSON(tables: TableSchema[]): string {
        return JSON.stringify(tables, null, 2);
    }

    /**
     * Get summary statistics of the schema
     */
    static getSchemaSummary(tables: TableSchema[]): {
        tableCount: number;
        totalColumns: number;
        totalForeignKeys: number;
        avgColumnsPerTable: number;
    } {
        const tableCount = tables.length;
        const totalColumns = tables.reduce((sum, table) => sum + table.columns.length, 0);
        const totalForeignKeys = tables.reduce((sum, table) => sum + table.foreignKeys.length, 0);
        const avgColumnsPerTable = tableCount > 0 ? totalColumns / tableCount : 0;
        
        return {
            tableCount,
            totalColumns,
            totalForeignKeys,
            avgColumnsPerTable: Math.round(avgColumnsPerTable * 10) / 10
        };
    }
}
