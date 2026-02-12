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
    schema: string;
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
        } else if (databaseType === 'mongodb') {
            return this.collectMongoDBSchema(dataSource, dataSource.options.database as string);
        }

        throw new Error(`Unsupported database type: ${databaseType}`);
    }

    /**
     * Collect schema information from MongoDB database
     * Supports both TypeORM and native MongoDB driver connections
     */
    private async collectMongoDBSchema(dataSource: DataSource, databaseName: string): Promise<TableSchema[]> {
        const tables: TableSchema[] = [];

        // Check if this is a native MongoDB connection (mock DataSource)
        // In that case, use MongoDBDriver's methods which handle both connection types
        const { MongoDBDriver } = await import('../drivers/MongoDBDriver.js');
        const mongoDriver = MongoDBDriver.getInstance();
        
        // Check if dataSource is initialized (TypeORM) or mock (native)
        const isTypeORM = dataSource.isInitialized !== undefined;
        
        let collections: string[];
        let collectionSchemas: Map<string, any[]> = new Map();
        
        if (!isTypeORM) {
            // Native connection - use MongoDBDriver methods
            collections = await mongoDriver.getMongoDBCollections();
            
            for (const collectionName of collections) {
                const schemaResult = await mongoDriver.inferCollectionSchema(collectionName, 100);
                
                if (schemaResult.fields) {
                    collectionSchemas.set(collectionName, schemaResult.fields);
                }
            }
        } else {
            // TypeORM connection - access native client through TypeORM
            const typeormDriver = dataSource.driver as any;
            const client = typeormDriver.queryRunner.databaseConnection as import('mongodb').MongoClient;
            const db = client.db(databaseName);

            const collectionList = await db.listCollections().toArray();
            collections = collectionList.map(c => c.name);

            // Sample documents to infer schema
            for (const collectionName of collections) {
                const collection = db.collection(collectionName);
                const docs = await collection.find({}).limit(100).toArray();
                
                // Infer columns from docs
                const columnsMap = new Map<string, TableColumn>();

                docs.forEach((doc: any) => {
                    Object.keys(doc).forEach(key => {
                        if (!columnsMap.has(key)) {
                            const value = doc[key];
                            let type = 'string'; // Default
                            if (value === null) type = 'null';
                            else if (typeof value === 'number') type = 'numeric';
                            else if (typeof value === 'boolean') type = 'boolean';
                            else if (value instanceof Date) type = 'timestamp';
                            else if (Array.isArray(value)) type = 'jsonb'; // Treat arrays as JSON
                            else if (typeof value === 'object') {
                                // Check for ObjectId
                                if (value._bsontype === 'ObjectId') type = 'varchar(24)';
                                else type = 'jsonb';
                            }

                            columnsMap.set(key, {
                                column_name: key,
                                data_type: type,
                                is_nullable: 'YES', // No strict schema, assume nullable
                                column_default: null,
                                character_maximum_length: null
                            });
                        }
                    });
                });

                // Ensure _id is present
                if (!columnsMap.has('_id')) {
                    columnsMap.set('_id', {
                        column_name: '_id',
                        data_type: 'varchar(24)',
                        is_nullable: 'NO',
                        column_default: null,
                        character_maximum_length: 24
                    });
                }

                collectionSchemas.set(collectionName, Array.from(columnsMap.values()));
            }
        }

        // Build table schemas from collected data
        for (const collectionName of collections) {
            const columns = collectionSchemas.get(collectionName) || [];
            
            // Convert field schema format to TableColumn format if needed
            const tableColumns: TableColumn[] = columns.map((col: any) => {
                if (col.column_name) {
                    // Already in TableColumn format
                    return col;
                } else if (col.field_name) {
                    // Convert from field schema format (native driver)
                    return {
                        column_name: col.field_name,
                        data_type: col.data_type || 'string',
                        is_nullable: col.is_nullable ? 'YES' : 'NO',
                        column_default: null,
                        character_maximum_length: null
                    };
                }
                return col;
            });
            
            // Ensure _id is present
            if (!tableColumns.find(c => c.column_name === '_id')) {
                tableColumns.unshift({
                    column_name: '_id',
                    data_type: 'varchar(24)',
                    is_nullable: 'NO',
                    column_default: null,
                    character_maximum_length: 24
                });
            }

            tables.push({
                schema: 'dra_mongodb',  // Synthetic schema like Excel/PDF/Google sources
                tableName: collectionName,
                columns: tableColumns,
                primaryKeys: ['_id'],
                foreignKeys: [] // No FKs in MongoDB
            });
        }

        return tables;
    }

    /**
     * Collect schema information for specific tables only
     * @param dataSource - TypeORM DataSource connected to the database
     * @param schemaName - Schema name
     * @param tableNames - Array of table names to collect schema for
     */
    async collectSchemaForTables(dataSource: DataSource, schemaName: string, tableNames: string[]): Promise<TableSchema[]> {
        const databaseType = dataSource.options.type;

        if (databaseType === 'postgres') {
            return this.collectPostgresSchemaForTables(dataSource, schemaName, tableNames);
        } else if (databaseType === 'mysql' || databaseType === 'mariadb') {
            return this.collectMySQLSchemaForTables(dataSource, schemaName, tableNames);
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
                    tc.table_schema,
                    tc.table_name,
                    kcu.column_name,
                    ccu.table_schema AS foreign_table_schema,
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
                schema: schemaName,
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

            const columnResults = await dataSource.query(columnQuery, [databaseName, tableName]);

            // Normalize column metadata for MySQL/MariaDB (returns UPPERCASE keys)
            const columns = columnResults.map((col: any) => ({
                column_name: col.column_name || col.COLUMN_NAME,
                data_type: col.data_type || col.DATA_TYPE,
                is_nullable: col.is_nullable || col.IS_NULLABLE,
                column_default: col.column_default || col.COLUMN_DEFAULT,
                character_maximum_length: col.character_maximum_length || col.CHARACTER_MAXIMUM_LENGTH
            }));

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

            const fkResults = await dataSource.query(fkQuery, [databaseName, tableName]);

            // Normalize foreign key metadata
            const foreignKeys = fkResults.map((fk: any) => ({
                constraint_name: fk.constraint_name || fk.CONSTRAINT_NAME,
                table_name: fk.table_name || fk.TABLE_NAME,
                column_name: fk.column_name || fk.COLUMN_NAME,
                foreign_table_name: fk.foreign_table_name || fk.FOREIGN_TABLE_NAME,
                foreign_column_name: fk.foreign_column_name || fk.FOREIGN_COLUMN_NAME
            }));

            tables.push({
                schema: databaseName,
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

    /**
     * Collect PostgreSQL schema information for specific tables only
     */
    private async collectPostgresSchemaForTables(dataSource: DataSource, schemaName: string, tableNames: string[]): Promise<TableSchema[]> {
        if (tableNames.length === 0) {
            return [];
        }

        const tables: TableSchema[] = [];

        for (const tableName of tableNames) {
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
                    tc.table_schema,
                    tc.table_name,
                    kcu.column_name,
                    ccu.table_schema AS foreign_table_schema,
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
                schema: schemaName,
                tableName,
                columns,
                primaryKeys,
                foreignKeys
            });
        }

        return tables;
    }

    /**
     * Collect MySQL/MariaDB schema information for specific tables only
     */
    private async collectMySQLSchemaForTables(dataSource: DataSource, databaseName: string, tableNames: string[]): Promise<TableSchema[]> {
        if (tableNames.length === 0) {
            return [];
        }

        const tables: TableSchema[] = [];

        for (const tableName of tableNames) {
            // Get columns
            const columnQuery = `
                SELECT 
                    COLUMN_NAME as column_name,
                    DATA_TYPE as data_type,
                    IS_NULLABLE as is_nullable,
                    COLUMN_DEFAULT as column_default,
                    CHARACTER_MAXIMUM_LENGTH as character_maximum_length
                FROM information_schema.columns
                WHERE table_schema = ? AND table_name = ?
                ORDER BY ORDINAL_POSITION
            `;

            const columns = await dataSource.query(columnQuery, [databaseName, tableName]);

            // Get primary keys
            const pkQuery = `
                SELECT kcu.COLUMN_NAME as column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                    ON tc.constraint_name = kcu.constraint_name
                    AND tc.table_schema = kcu.table_schema
                WHERE tc.constraint_type = 'PRIMARY KEY'
                    AND tc.table_schema = ?
                    AND tc.table_name = ?
            `;

            const pkResults = await dataSource.query(pkQuery, [databaseName, tableName]);
            const primaryKeys = pkResults.map((row: any) => row.column_name);

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

            const fkResults = await dataSource.query(fkQuery, [databaseName, tableName]);

            const foreignKeys = fkResults.map((fk: any) => ({
                constraint_name: fk.constraint_name || fk.CONSTRAINT_NAME,
                table_name: fk.table_name || fk.TABLE_NAME,
                column_name: fk.column_name || fk.COLUMN_NAME,
                foreign_table_name: fk.foreign_table_name || fk.FOREIGN_TABLE_NAME,
                foreign_column_name: fk.foreign_column_name || fk.FOREIGN_COLUMN_NAME
            }));

            tables.push({
                schema: databaseName,
                tableName,
                columns,
                primaryKeys,
                foreignKeys
            });
        }

        return tables;
    }
}
