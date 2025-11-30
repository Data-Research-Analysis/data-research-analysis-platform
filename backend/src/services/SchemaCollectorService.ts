import { DataSource } from 'typeorm';

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
    tableName: string;
    columns: TableColumn[];
    primaryKeys: string[];
    foreignKeys: ForeignKey[];
}

export class SchemaCollectorService {
    /**
     * Collect comprehensive schema information from a database
     * @param dataSource - TypeORM DataSource connected to the database
     * @param schemaName - Schema name (optional, defaults based on database type)
     */
    async collectSchema(dataSource: DataSource, schemaName?: string): Promise<TableSchema[]> {
        const databaseType = dataSource.options.type;
        
        if (databaseType === 'postgres') {
            return this.collectPostgresSchema(dataSource, schemaName || 'public');
        } else if (databaseType === 'mysql' || databaseType === 'mariadb') {
            return this.collectMySQLSchema(dataSource, schemaName || dataSource.options.database as string);
        }
        
        throw new Error(`Unsupported database type: ${databaseType}`);
    }

    /**
     * Collect schema information from PostgreSQL database
     */
    private async collectPostgresSchema(dataSource: DataSource, schemaName: string): Promise<TableSchema[]> {
        const tables: TableSchema[] = [];
        
        // Get all tables in the schema
        const tableQuery = `
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = $1 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `;
        
        const tableResults = await dataSource.query(tableQuery, [schemaName]);
        
        for (const tableRow of tableResults) {
            const tableName = tableRow.table_name;
            
            // Get columns
            const columnQuery = `
                SELECT 
                    column_name,
                    data_type,
                    is_nullable,
                    column_default,
                    character_maximum_length
                FROM information_schema.columns
                WHERE table_schema = $1 AND table_name = $2
                ORDER BY ordinal_position
            `;
            
            const columns = await dataSource.query(columnQuery, [schemaName, tableName]);
            
            // Get primary keys
            const pkQuery = `
                SELECT kcu.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                    ON tc.constraint_name = kcu.constraint_name
                    AND tc.table_schema = kcu.table_schema
                WHERE tc.constraint_type = 'PRIMARY KEY'
                    AND tc.table_schema = $1
                    AND tc.table_name = $2
            `;
            
            const pkResults = await dataSource.query(pkQuery, [schemaName, tableName]);
            const primaryKeys = pkResults.map((row: any) => row.column_name);
            
            // Get foreign keys
            const fkQuery = `
                SELECT
                    tc.constraint_name,
                    tc.table_name,
                    kcu.column_name,
                    ccu.table_name AS foreign_table_name,
                    ccu.column_name AS foreign_column_name
                FROM information_schema.table_constraints AS tc
                JOIN information_schema.key_column_usage AS kcu
                    ON tc.constraint_name = kcu.constraint_name
                    AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage AS ccu
                    ON ccu.constraint_name = tc.constraint_name
                    AND ccu.table_schema = tc.table_schema
                WHERE tc.constraint_type = 'FOREIGN KEY'
                    AND tc.table_schema = $1
                    AND tc.table_name = $2
            `;
            
            const foreignKeys = await dataSource.query(fkQuery, [schemaName, tableName]);
            
            tables.push({
                tableName,
                columns,
                primaryKeys,
                foreignKeys
            });
        }
        
        return tables;
    }

    /**
     * Collect schema information from MySQL/MariaDB database
     */
    private async collectMySQLSchema(dataSource: DataSource, databaseName: string): Promise<TableSchema[]> {
        const tables: TableSchema[] = [];
        
        // Get all tables in the database
        const tableQuery = `
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = ? 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `;
        
        const tableResults = await dataSource.query(tableQuery, [databaseName]);
        
        for (const tableRow of tableResults) {
            const tableName = tableRow.table_name || tableRow.TABLE_NAME;
            
            // Get columns
            const columnQuery = `
                SELECT 
                    column_name,
                    data_type,
                    is_nullable,
                    column_default,
                    character_maximum_length
                FROM information_schema.columns
                WHERE table_schema = ? AND table_name = ?
                ORDER BY ordinal_position
            `;
            
            const columns = await dataSource.query(columnQuery, [databaseName, tableName]);
            
            // Get primary keys
            const pkQuery = `
                SELECT column_name
                FROM information_schema.key_column_usage
                WHERE table_schema = ?
                    AND table_name = ?
                    AND constraint_name = 'PRIMARY'
            `;
            
            const pkResults = await dataSource.query(pkQuery, [databaseName, tableName]);
            const primaryKeys = pkResults.map((row: any) => row.column_name || row.COLUMN_NAME);
            
            // Get foreign keys
            const fkQuery = `
                SELECT
                    kcu.constraint_name,
                    kcu.table_name,
                    kcu.column_name,
                    kcu.referenced_table_name AS foreign_table_name,
                    kcu.referenced_column_name AS foreign_column_name
                FROM information_schema.key_column_usage kcu
                WHERE kcu.table_schema = ?
                    AND kcu.table_name = ?
                    AND kcu.referenced_table_name IS NOT NULL
            `;
            
            const foreignKeys = await dataSource.query(fkQuery, [databaseName, tableName]);
            
            tables.push({
                tableName,
                columns,
                primaryKeys,
                foreignKeys
            });
        }
        
        return tables;
    }

    /**
     * Get database type from DataSource
     */
    getDatabaseType(dataSource: DataSource): string {
        return dataSource.options.type;
    }
}
