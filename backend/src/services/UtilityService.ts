import dotenv from 'dotenv';
import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import { DBDriver } from '../drivers/DBDriver';
import { PostgresDataSource } from '../datasources/PostgresDataSource';
import { EDataSourceType } from '../types/EDataSourceType';

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
        
        const host = process.env.POSTGRESQL_HOST;
        const port = parseInt(process.env.POSTGRESQL_PORT);
        const database = process.env.POSTGRESQL_DB_NAME;
        const username = process.env.POSTGRESQL_USERNAME;
        const password = process.env.POSTGRESQL_PASSWORD;
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
                return null;
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


}