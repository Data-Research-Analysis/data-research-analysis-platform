import dotenv from 'dotenv';
import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import { DBDriver } from '../drivers/DBDriver.js';
import { PostgresDataSource } from '../datasources/PostgresDataSource.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { QueueService } from './QueueService.js';
import { EncryptionService } from './EncryptionService.js';
import { SyncEventEmitter, SyncEventType, SyncCompletedEvent } from '../events/SyncEventEmitter.js';
import { DataModelRefreshService } from './DataModelRefreshService.js';
import { RefreshQueueService } from './RefreshQueueService.js';

export class UtilityService {
    private static instance: UtilityService;
    private constructor() {}
    public static getInstance(): UtilityService {
        if (!UtilityService.instance) {
            UtilityService.instance = new UtilityService();
        }
        return UtilityService.instance;
    }

    public async initialize() {
        dotenv.config();
        console.log('Initializing utilities');
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        console.log('Driver initialized', driver);
        
        const host = process?.env?.POSTGRESQL_HOST || 'localhost';
        const port = parseInt(process?.env?.POSTGRESQL_PORT || '5432');
        const database = process?.env?.POSTGRESQL_DB_NAME || 'dra_db';
        const username = process?.env?.POSTGRESQL_USERNAME || 'dra_user';
        const password = process?.env?.POSTGRESQL_PASSWORD || 'dra_password';
        const postgresDataSource = PostgresDataSource.getInstance().getDataSource(host, port, database, username, password);
        await driver.initialize(postgresDataSource);
        await QueueService.getInstance().run();
        // Initialize encryption service with validation
        try {
          const encryptionService = EncryptionService.getInstance();
          if (!encryptionService.validateKey()) {
            throw new Error('Encryption key validation failed');
          }
          const algorithmInfo = encryptionService.getAlgorithmInfo();
          console.log(`[SECURITY] Encryption initialized: ${algorithmInfo.algorithm.toUpperCase()}, ${algorithmInfo.keySize}-bit key`);
        } catch (error) {
          console.error('[SECURITY] Failed to initialize encryption service:', error.message);
          console.error('[SECURITY] Please check your ENCRYPTION_KEY in .env file');
          process.exit(1); // Fail fast - encryption is critical for security
        }
        
        // Initialize cascade refresh trigger
        this.initializeCascadeRefresh();
        
        console.log('Utilities initialized');
    }

    public getDataSourceType(dataSourceType: string): EDataSourceType {
        switch (dataSourceType) {
            case 'postgresql':
                return EDataSourceType.POSTGRESQL;
            case 'mysql':
                return EDataSourceType.MYSQL;
            case 'mariadb':
                return EDataSourceType.MARIADB;
            case 'mongodb':
                return EDataSourceType.MONGODB;
            case 'csv':
                return EDataSourceType.CSV;
            case 'excel':
                return EDataSourceType.EXCEL;
            case 'pdf':
                return EDataSourceType.PDF;
            default:
                return EDataSourceType.POSTGRESQL;
        }
    }

    public uniquiseName(name: string): string {
        const uuid = uuidv4();
        return `${name.toLowerCase().replace(/\s/g, '_')}_dra_${uuid.replace(/-/g, '_')}`;
    }

    public getConstants(key: string): any {
        return {
            NODE_ENV: process.env.NODE_ENV || 'development',
            PUBLIC_BACKEND_URL: process.env.PUBLIC_BACKEND_URL || 'http://localhost:3002',
            FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
            PORT: process.env.PORT || 3002,
            RECAPTCHA_SECRET: process.env.RECAPTCHA_SECRET || '',
            JWT_SECRET: process.env.JWT_SECRET || '',
            PASSWORD_SALT: process.env.PASSWORD_SALT || 10,
            DB_Driver: process.env.DB_Driver || 'postgres',
            POSTGRESQL_HOST: process.env.POSTGRESQL_HOST || '',
            POSTGRESQL_HOST_MIGRATIONS: process.env.POSTGRESQL_HOST_MIGRATIONS || '',
            POSTGRESQL_PORT_MIGRATIONS: process.env.POSTGRESQL_PORT_MIGRATIONS || '',
            POSTGRESQL_PORT: process.env.POSTGRESQL_PORT || '',
            POSTGRESQL_USERNAME: process.env.POSTGRESQL_USERNAME || '',
            POSTGRESQL_PASSWORD: process.env.POSTGRESQL_PASSWORD || '',
            POSTGRESQL_DB_NAME: process.env.POSTGRESQL_DB_NAME || '',
            MYSQLDB_USER: process.env.MYSQLDB_USER || '',
            MYSQLDB_ROOT_PASSWORD: process.env.MYSQLDB_ROOT_PASSWORD || '',
            MYSQLDB_DATABASE: process.env.MYSQLDB_DATABASE || '',
            MYSQLDB_LOCAL_PORT: process.env.MYSQLDB_LOCAL_PORT || '',
            MYSQLDB_DOCKER_PORT: process.env.MYSQLDB_DOCKER_PORT || '',
            MARIADB_USER: process.env.MARIADB_USER || '',
            MARIADB_ROOT_PASSWORD: process.env.MARIADB_ROOT_PASSWORD || '',
            MARIADB_DATABASE: process.env.MARIADB_DATABASE || '',
            MARIADB_LOCAL_PORT: process.env.MARIADB_LOCAL_PORT || '',
            MARIADB_DOCKER_PORT: process.env.MARIADB_DOCKER_PORT || '',
            MAIL_DRIVER: process.env.MAIL_DRIVER || '',
            MAIL_HOST: process.env.MAIL_HOST || '',
            MAIL_PORT: process.env.MAIL_PORT || '',
            MAIL_USER: process.env.MAIL_USER || '',
            MAIL_PASS: process.env.MAIL_PASS || '',
            MAIL_FROM: process.env.MAIL_FROM || '',
            MAIL_REPLY_TO: process.env.MAIL_REPLY_TO || '',
            REDIS_HOST: process.env.REDIS_HOST || 'localhost',
            REDIS_PORT: process.env.REDIS_PORT || '6379',
            DATA_DRIVER: process.env.DATA_DRIVER || 'redis',
            SOCKETIO_SERVER_URL: process.env.SOCKETIO_SERVER_URL || 'http://localhost',
            SOCKETIO_SERVER_PORT: process.env.SOCKETIO_SERVER_PORT || 3002,
            SOCKETIO_CLIENT_URL: process.env.SOCKETIO_CLIENT_URL || 'http://localhost',
            SOCKETIO_CLIENT_PORT: process.env.SOCKETIO_CLIENT_PORT || 3000,
            QUEUE_STATUS_INTERVAL: process.env.QUEUE_STATUS_INTERVAL || 5000,
            NUM_WORKERS: process.env.NUM_WORKERS || 3,
            AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || '',
            AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || '',
            AWS_S3_REGION: process.env.AWS_S3_REGION || '',
            AWS_S3_IMAGES_EXTRACT_BUCKET: process.env.AWS_S3_IMAGES_EXTRACT_BUCKET || '',
            IMAGE_PAGE_WIDTH: process.env.IMAGE_PAGE_WIDTH || 4000,
            IMAGE_PAGE_HEIGHT: process.env.IMAGE_PAGE_HEIGHT || 6000
        }[key];
    }

    public convertDataTypeToPostgresDataType(database: string, dataType: string): { type: string; size?: string | number } {
        // Early return for non-MySQL/MariaDB databases
        const dbLower = database.toLowerCase();
        if (dbLower === EDataSourceType.EXCEL) {
            const parsedType = this.parseExcelDataType(dataType);
            return this.mapMySQLToPostgreSQL(parsedType);
        } else if (dbLower === EDataSourceType.PDF) {
            // PDF uses same data type parsing as Excel since they have similar structure
            const parsedType = this.parsePDFDataType(dataType);
            return this.mapMySQLToPostgreSQL(parsedType);
        } else if (dbLower === EDataSourceType.MYSQL || dbLower === EDataSourceType.MARIADB) {
            // Parse MySQL/MariaDB data type (MariaDB is MySQL-compatible)
            const parsedType = this.parseMySQLDataType(dataType);
            // Map to PostgreSQL equivalent
            return this.mapMySQLToPostgreSQL(parsedType);
        } else {
            // For PostgreSQL and other databases, preserve types
            const upperType = dataType.toUpperCase();
            if (upperType === 'USER-DEFINED') {
                return { type: 'TEXT' }; // Handle USER-DEFINED as TEXT
            }
            // Preserve JSON and JSONB types for PostgreSQL
            if (upperType === 'JSON' || upperType === 'JSONB') {
                return { type: upperType };
            }
            return { type: dataType }; // Pass through unchanged
        }
    }

    private parseMySQLDataType(dataType: string): { 
        baseType: string; 
        size?: number; 
        precision?: number; 
        scale?: number;
        unsigned?: boolean;
        enumValues?: string[];
        setValues?: string[];
    } {
        const normalizedType = dataType.trim().toUpperCase();
        
        // Handle ENUM types
        const enumMatch = normalizedType.match(/^ENUM\s*\((.*)\)$/);
        if (enumMatch) {
            const enumValues = enumMatch[1].split(',').map(v => v.trim().replace(/['"]/g, ''));
            return { baseType: 'ENUM', enumValues };
        }

        // Handle SET types
        const setMatch = normalizedType.match(/^SET\s*\((.*)\)$/);
        if (setMatch) {
            const setValues = setMatch[1].split(',').map(v => v.trim().replace(/['"]/g, ''));
            return { baseType: 'SET', setValues };
        }

        // Handle DECIMAL/NUMERIC with precision and scale
        const decimalMatch = normalizedType.match(/^(DECIMAL|NUMERIC)\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)(\s+UNSIGNED)?$/);
        if (decimalMatch) {
            return {
                baseType: decimalMatch[1],
                precision: parseInt(decimalMatch[2]),
                scale: parseInt(decimalMatch[3]),
                unsigned: !!decimalMatch[4]
            };
        }

        // Handle types with size parameter
        const sizeMatch = normalizedType.match(/^(\w+)\s*\(\s*(\d+)\s*\)(\s+UNSIGNED)?$/);
        if (sizeMatch) {
            return {
                baseType: sizeMatch[1],
                size: parseInt(sizeMatch[2]),
                unsigned: !!sizeMatch[3]
            };
        }

        // Handle types with UNSIGNED modifier
        const unsignedMatch = normalizedType.match(/^(\w+)(\s+UNSIGNED)?$/);
        if (unsignedMatch) {
            return {
                baseType: unsignedMatch[1],
                unsigned: !!unsignedMatch[2]
            };
        }

        // Default case
        return { baseType: normalizedType };
    }

    private mapMySQLToPostgreSQL(parsed: {
        baseType: string; 
        size?: number; 
        precision?: number; 
        scale?: number;
        unsigned?: boolean;
        enumValues?: string[];
        setValues?: string[];
    }): { type: string; size?: string | number } {
        const { baseType, size, precision, scale, unsigned, enumValues, setValues } = parsed;

        switch (baseType) {
            // Numeric Types
            case 'TINYINT':
                return unsigned ? { type: 'SMALLINT' } : { type: 'SMALLINT' };
            case 'SMALLINT':
                return unsigned ? { type: 'INTEGER' } : { type: 'SMALLINT' };
            case 'MEDIUMINT':
                return unsigned ? { type: 'BIGINT' } : { type: 'INTEGER' };
            case 'INT':
            case 'INTEGER':
                return unsigned ? { type: 'BIGINT' } : { type: 'INTEGER' };
            case 'BIGINT':
                return unsigned ? { type: 'NUMERIC', size: '20,0' } : { type: 'BIGINT' };
            case 'DECIMAL':
            case 'NUMERIC':
                if (precision !== undefined && scale !== undefined) {
                    return { type: 'DECIMAL', size: `${precision},${scale}` };
                }
                return { type: 'DECIMAL' };
            case 'FLOAT':
                return { type: 'REAL' };
            case 'DOUBLE':
            case 'DOUBLE PRECISION':
                return { type: 'DOUBLE PRECISION' };
            case 'BIT':
                return size ? { type: 'BIT', size } : { type: 'BIT' };

            // String Types
            case 'CHAR':
                return size ? { type: 'CHAR', size } : { type: 'CHAR', size: 1 };
            case 'VARCHAR':
                if (size && size > 65535) {
                    return { type: 'TEXT' };
                }
                return size ? { type: 'VARCHAR', size } : { type: 'VARCHAR', size: 255 };
            case 'TINYTEXT':
            case 'TEXT':
            case 'MEDIUMTEXT':
            case 'LONGTEXT':
                return { type: 'TEXT' };

            // Binary Types
            case 'BINARY':
            case 'VARBINARY':
            case 'TINYBLOB':
            case 'BLOB':
            case 'MEDIUMBLOB':
            case 'LONGBLOB':
                return { type: 'BYTEA' };

            // Date/Time Types
            case 'DATE':
                return { type: 'DATE' };
            case 'TIME':
                return { type: 'TIME' };
            case 'DATETIME':
                return { type: 'TIMESTAMP' };
            case 'TIMESTAMP':
                return { type: 'TIMESTAMP WITH TIME ZONE' };
            case 'YEAR':
                return { type: 'SMALLINT' };

            // Boolean Type
            case 'BOOLEAN':
            case 'BOOL':
                return { type: 'BOOLEAN' };

            // JSON Types
            case 'JSON':
                return { type: 'JSON' };
            case 'JSONB':
                return { type: 'JSONB' };

            // Special Types
            case 'ENUM':
                // Convert ENUM to VARCHAR with CHECK constraint (simplified to VARCHAR)
                if (enumValues && enumValues.length > 0) {
                    const maxLength = Math.max(...enumValues.map(v => v.length));
                    return { type: 'VARCHAR', size: Math.max(maxLength, 50) };
                }
                return { type: 'VARCHAR', size: 255 };

            case 'SET':
                // Convert SET to TEXT array (simplified to TEXT)
                return { type: 'TEXT' };

            // Fallback for unknown types
            default:
                console.warn(`Unknown MySQL data type: ${baseType}. Using original type.`);
                return { type: baseType };
        }
    }

     private parseExcelDataType(dataType: string): { 
        baseType: string; 
        size?: number;
    } {
        //text, email, url, boolean, number
        const normalizedType = dataType.trim().toUpperCase();
        if (normalizedType === 'EMAIL' || normalizedType === 'URL') {
            return { baseType: 'VARCHAR', size: 512 };
        } else if (normalizedType === 'TEXT') {
            return { baseType: 'VARCHAR', size: 1024 };
        } else if (normalizedType === 'BOOLEAN') {
            return { baseType: 'BOOLEAN' };
        } else if (normalizedType === 'NUMBER') {
            return { baseType: 'NUMERIC' };
        } else if (normalizedType === 'DATE') {
            return { baseType: 'DATE' };
        }
    }

    private parsePDFDataType(dataType: string): { 
        baseType: string; 
        size?: number;
    } {
        // PDF data types are similar to Excel: text, email, url, boolean, number, date
        const normalizedType = dataType.trim().toUpperCase();
        if (normalizedType === 'EMAIL') {
            return { baseType: 'VARCHAR', size: 512 };
        } else if (normalizedType === 'URL') {
            return { baseType: 'VARCHAR', size: 1024 };
        } else if (normalizedType === 'TEXT') {
            return { baseType: 'VARCHAR', size: 2048 }; // PDF text might be longer
        } else if (normalizedType === 'BOOLEAN') {
            return { baseType: 'BOOLEAN' };
        } else if (normalizedType === 'NUMBER') {
            return { baseType: 'NUMERIC' };
        } else if (normalizedType === 'DATE') {
            return { baseType: 'DATE' };
        } else {
            // Default to text for unknown PDF data types
            return { baseType: 'VARCHAR', size: 1024 };
        }
    }
    /**
     * Sanitizes data for PostgreSQL by ensuring boolean values are properly formatted
     */
    public sanitizeDataForPostgreSQL(data: any): any {
        if (!data) return data;
        
        // Handle columns
        if (data.columns && Array.isArray(data.columns)) {
            data.columns = data.columns.map((column: any) => ({
                ...column,
                // Ensure column metadata is preserved
            }));
        }
        
        // Handle rows
        if (data.rows && Array.isArray(data.rows)) {
            data.rows = data.rows.map((row: any) => {
                let sanitizedRow = { ...row };
                
                // Sanitize row data if it's nested
                if (row.data && typeof row.data === 'object') {
                    sanitizedRow.data = this.sanitizeRowData(row.data, data.columns);
                } else {
                    // If row data is at the top level
                    sanitizedRow = this.sanitizeRowData(row, data.columns);
                }
                
                return sanitizedRow;
            });
        }
        
        return data;
    }
    
    /**
     * Sanitizes individual row data based on column types
     */
    public sanitizeRowData(rowData: any, columns: any[]): any {
        if (!rowData || !columns) return rowData;
        
        const sanitized = { ...rowData };
        
        columns.forEach((column: any) => {
            const value = sanitized[column.title] || sanitized[column.key];
            
            if (column.type === 'boolean' && (value !== null && value !== undefined)) {
                const stringValue = String(value).trim().toLowerCase();
                
                // Convert to standardized boolean values
                if (['true', '1', 'yes', 'y', 'on', 'active', 'enabled'].includes(stringValue)) {
                    sanitized[column.title || column.key] = 'true';
                } else if (['false', '0', 'no', 'n', 'off', 'inactive', 'disabled'].includes(stringValue)) {
                    sanitized[column.title || column.key] = 'false';
                } else {
                    // For ambiguous values, set to null
                    sanitized[column.title || column.key] = null;
                }
            }
        });
        
        return sanitized;
    }

    /**
     * Initialize cascade refresh trigger
     * Automatically refreshes data models when their data sources sync
     */
    private initializeCascadeRefresh(): void {
        const syncEmitter = SyncEventEmitter.getInstance();
        const refreshQueue = RefreshQueueService.getInstance();
        const refreshService = DataModelRefreshService.getInstance();

        console.log('[Cascade] Initializing cascade refresh trigger');

        // Listen for sync completed events
        syncEmitter.on(SyncEventType.SYNC_COMPLETED, async (event: SyncCompletedEvent) => {
            try {
                console.log(`[Cascade] Data source ${event.dataSourceId} synced successfully (status: ${event.status})`);

                // Only trigger cascade on successful or partial completion
                if (event.status === 'FAILED') {
                    console.log(`[Cascade] Skipping cascade refresh - sync failed`);
                    return;
                }

                // Find dependent models
                const modelIds = await refreshService.findDependentModels(event.dataSourceId);

                if (modelIds.length === 0) {
                    console.log(`[Cascade] No dependent models found for data source ${event.dataSourceId}`);
                    return;
                }

                console.log(`[Cascade] Found ${modelIds.length} dependent models for data source ${event.dataSourceId}`);

                // Queue refresh jobs for all dependent models
                const jobIds = await refreshQueue.queueRefreshForModels(modelIds, {
                    triggeredBy: 'cascade',
                    triggerSourceId: event.dataSourceId,
                    reason: `Data source ${event.dataSourceId} synced successfully with ${event.totalRecordsSynced} records`
                });

                console.log(`[Cascade] ✅ Queued ${jobIds.length} refresh jobs: ${jobIds.join(', ')}`);

            } catch (error: any) {
                console.error(`[Cascade] ❌ Error during cascade refresh:`, error.message);
            }
        });

        console.log('[Cascade] ✅ Cascade refresh trigger initialized');
    }
}
