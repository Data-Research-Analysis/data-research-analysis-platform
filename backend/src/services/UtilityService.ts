import dotenv from 'dotenv';
import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import { DBDriver } from '../drivers/DBDriver.js';
import { PostgresDataSource } from '../datasources/PostgresDataSource.js';
import { EDataSourceType } from '../types/EDataSourceType.js';

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
        const driver = await DBDriver.getInstance().getDriver('postgresql');
        console.log('Driver initialized', driver);
        
        const host = process?.env?.POSTGRESQL_HOST || 'localhost';
        const port = parseInt(process?.env?.POSTGRESQL_PORT || '5432');
        const database = process?.env?.POSTGRESQL_DB_NAME || 'dra_db';
        const username = process?.env?.POSTGRESQL_USERNAME || 'dra_user';
        const password = process?.env?.POSTGRESQL_PASSWORD || 'dra_password';
        const postgresDataSource = PostgresDataSource.getInstance().getDataSource(host, port, database, username, password);
        await driver.initialize(postgresDataSource);
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
            PUBLIC_BACKEND_URL: process.env.PUBLIC_BACKEND_URL || 'http://localhost:3002',
            PORT: process.env.PORT || 3002,
            RECAPTCHA_SECRET: process.env.RECAPTCHA_SECRET || '',
            JWT_SECRET: process.env.JWT_SECRET || '',
            PASSWORD_SALT: process.env.PASSWORD_SALT || 10,
            DB_Driver: process.env.DB_Driver || 'postgres',
            POSTGRESQL_HOST: process.env.POSTGRESQL_HOST || '',
            POSTGRESQL_HOST_MIGRATIONS: process.env.POSTGRESQL_HOST_MIGRATIONS || '',
            POSTGRESQL_PORT_MIGRATIONS: process.env.POSTGRESQL_PORT_MIGRATIONS || '',
            POSTGRESQL_PORT: process.env.POSTGRESQL_PORT || '',
            POSTGRESQL_DATABASE: process.env.POSTGRESQL_DATABASE || '',
            POSTGRESQL_USERNAME: process.env.POSTGRESQL_USERNAME || '',
            POSTGRESQL_PASSWORD: process.env.POSTGRESQL_PASSWORD || '',
            POSTGRESQL_DB_NAME: process.env.POSTGRESQL_DB_NAME || '',
            NODE_ENV: process.env.NODE_ENV || 'development',
            MAIL_DRIVER: process.env.MAIL_DRIVER || '',
            MAIL_HOST: process.env.MAIL_HOST || '',
            MAIL_PORT: process.env.MAIL_PORT || '',
            MAIL_USER: process.env.MAIL_USER || '',
            MAIL_PASS: process.env.MAIL_PASS || '',
            MAIL_FROM: process.env.MAIL_FROM || '',
            MAIL_REPLY_TO: process.env.MAIL_REPLY_TO || '',
        }[key];
    }

    public convertDataTypeToPostgresDataType(database: string, dataType: string): { type: string; size?: string | number } {
        // Early return for non-MySQL databases
        if (database.toLowerCase() !== 'mysql') {
            return { type: dataType }; // Pass through unchanged
        }

        // Parse MySQL data type
        const parsedType = this.parseMySQLDataType(dataType);
        
        // Map to PostgreSQL equivalent
        return this.mapMySQLToPostgreSQL(parsedType);
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

            // JSON Type
            case 'JSON':
                return { type: 'JSON' };

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
}