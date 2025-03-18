import { Sequelize } from "sequelize";
import { UtilityService } from "../services/UtilityService";
import dotenv from 'dotenv';
import { IDBDriver } from "../interfaces/IDBDriver";

export class PostgresDriver implements IDBDriver{
    private static instance: PostgresDriver;
    private sequelize: Sequelize;
    private constructor() {
    }
    public static getInstance(): PostgresDriver {
        if (!PostgresDriver.instance) {
            PostgresDriver.instance = new PostgresDriver();
        }
        return PostgresDriver.instance;
    }

    public async initialize(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            dotenv.config();
            console.log('Initializing postgres driver');
            const postgresUrl = UtilityService.getInstance().getConstants('POSTGRESQL_URL');
            this.sequelize = new Sequelize(postgresUrl); 
            try {
                await this.sequelize.authenticate();
                console.log('PostgresSQL connection has been established successfully.');
            } catch (error) {
                console.error('Unable to connect to the database:', error);
            }
            return resolve();
        });
    }

    public getConcreteDriver(): Promise<any> {
        return new Promise<any>((resolve, reject) => {
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

}