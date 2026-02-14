import crypto from 'crypto';
import { DataSource } from 'typeorm';

/**
 * Utility for generating schema hashes to detect changes that invalidate cached join suggestions
 */
export class SchemaHashUtil {
    /**
     * Generate a hash of the schema structure for a data source
     * Hash includes: table names, column names, column types
     * Changes to any of these invalidate cached join suggestions
     */
    static async generateSchemaHash(
        dataSource: DataSource,
        schemaName?: string
    ): Promise<string> {
        const queryRunner = dataSource.createQueryRunner();
        
        try {
            // Get all tables with their columns and types
            const schemaFilter = schemaName ? `AND table_schema = '${schemaName}'` : '';
            
            const query = `
                SELECT 
                    table_name,
                    column_name,
                    data_type,
                    ordinal_position
                FROM information_schema.columns
                WHERE table_schema = COALESCE($1, 'public')
                ORDER BY table_name, ordinal_position
            `;
            
            const columns = await queryRunner.query(query, [schemaName || 'public']);
            
            // Create a deterministic string representation
            const schemaStructure = columns
                .map((col: any) => `${col.table_name}:${col.column_name}:${col.data_type}`)
                .join('|');
            
            // Generate MD5 hash
            return crypto.createHash('md5').update(schemaStructure).digest('hex');
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Check if schema hash has changed for a data source
     */
    static async hasSchemaChanged(
        dataSource: DataSource,
        currentHash: string,
        schemaName?: string
    ): Promise<boolean> {
        const newHash = await this.generateSchemaHash(dataSource, schemaName);
        return newHash !== currentHash;
    }

    /**
     * Generate hash from in-memory table metadata (used when we already have table structures)
     */
    static generateHashFromTables(tables: Array<{ name: string; columns: Array<{ name: string; type: string }> }>): string {
        const schemaStructure = tables
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(table => {
                const sortedColumns = table.columns
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(col => `${table.name}:${col.name}:${col.type}`)
                    .join('|');
                return sortedColumns;
            })
            .join('|');
        
        return crypto.createHash('md5').update(schemaStructure).digest('hex');
    }
}
