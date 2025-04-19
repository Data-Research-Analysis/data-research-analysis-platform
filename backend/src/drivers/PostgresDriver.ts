import { Sequelize } from "sequelize";
import { UtilityService } from "../services/UtilityService";
import dotenv from 'dotenv';
import { IDBDriver } from "../interfaces/IDBDriver";
import { IDBConnectionDetails } from "../types/IDBConnectionDetails";

export class PostgresDriver implements IDBDriver{
    private static instance: PostgresDriver;
    private sequelize: Sequelize;
    private externalSequelize: Sequelize;
    private constructor() {
    }
    public static getInstance(): PostgresDriver {
        if (!PostgresDriver.instance) {
            PostgresDriver.instance = new PostgresDriver();
        }
        return PostgresDriver.instance;
    }

    public async initialize(): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            dotenv.config();
            console.log('Initializing postgres driver');
            const postgresUrl = UtilityService.getInstance().getConstants('POSTGRESQL_URL');
            this.sequelize = new Sequelize(postgresUrl); 
            try {
                await this.sequelize.authenticate();
                console.log('PostgresSQL connection has been established successfully.');
                return resolve(true);
            } catch (error) {
                console.error('Unable to connect to the database:', error);
                return resolve(false);
            }
        });
    }

    public getConcreteDriver(): Promise<Sequelize> {
        return new Promise<Sequelize>((resolve, reject) => {
            return resolve(this.sequelize);
        });
    }

    public async query(query: string, params: any): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            console.log('Querying postgres', query, params);
            return resolve(null);
        });
    }

    public async close(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            console.log('Closing postgres connection');
            await this.sequelize.close();
            return resolve();
        });
    }

    public async connectExternalDB(connection: IDBConnectionDetails): Promise<Sequelize> {
        return new Promise<Sequelize>(async (resolve, reject) => {
            console.log('Connecting to external postgres');
            const postgresUrl = `postgres://${connection.user}:${connection.password}@${connection.host}:${connection.port}/${connection.database}`;
            this.externalSequelize = new Sequelize(postgresUrl);
            try {
                await this.externalSequelize.authenticate();
                console.log('External PostgresSQL connection has been established successfully.');
                return resolve(this.externalSequelize);
            } catch (error) {
                console.error('Unable to connect to the database:', error);
                return resolve(null);
            }
        });
    }
    public async getExternalConnection(): Promise<any> {
        return new Promise<any>(async (resolve, reject) => {
            return resolve(this.externalSequelize);
        });
    }

}