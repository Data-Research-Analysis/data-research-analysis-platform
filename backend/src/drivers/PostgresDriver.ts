import { DataSource } from "typeorm";
import dotenv from 'dotenv';
import { IDBDriver } from "../interfaces/IDBDriver.js";
import { IDBConnectionDetails } from "../types/IDBConnectionDetails.js";
import { PostgresDataSource } from "../datasources/PostgresDataSource.js";

export class PostgresDriver implements IDBDriver{
    private static instance: PostgresDriver;
    private dataSource!: DataSource;
    private externalDataSource!
    : DataSource;
    private constructor() {
    }
    public static getInstance(): PostgresDriver {
        if (!PostgresDriver.instance) {
            PostgresDriver.instance = new PostgresDriver();
        }
        return PostgresDriver.instance;
    }

    public async initialize(dataSource: DataSource): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            dotenv.config();
            console.log('Initializing postgres driver');
            try {
                    this.dataSource = await dataSource.initialize();
                    if (this.dataSource.isInitialized) {
                        console.log('PostgresSQL connection has been established successfully.');
                        return resolve(true);
                    } else {
                        console.error('Unable to connect to the database:', this.dataSource);
                        return resolve(false);
                    }
            } catch (error) {
                console.error('Unable to connect to the database:', error);
                return resolve(false);
            }
        });
    }

    public getConcreteDriver(): Promise<DataSource> {
        return new Promise<DataSource>((resolve, reject) => {
            return resolve(this.dataSource);
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
            await this.dataSource.close();
            return resolve();
        });
    }

    public async connectExternalDB(connection: IDBConnectionDetails): Promise<DataSource> {
        return new Promise<DataSource>(async (resolve, reject) => {
            console.log('Connecting to external postgres');
            const host = connection.host;
            const port = connection.port;
            const database = connection.database;
            const username = connection.username;
            const password = connection.password;
            let dataSource = PostgresDataSource.getInstance().getDataSource(host, port, database, username, password);
            try {
                const result = await dataSource.initialize();
                if (dataSource.isInitialized) {
                    this.externalDataSource = dataSource;
                    console.log('External PostgresSQL connection has been established successfully.');
                    return resolve(this.externalDataSource);
                }
                console.error('Unable to connect to the database');
                return reject(null);
            } catch (error) {
                console.error('Unable to connect to the database:', error);
                return reject(null);
            }
        });
    }
    public async getExternalConnection(): Promise<any> {
        return new Promise<any>(async (resolve, reject) => {
            return resolve(this.externalDataSource);
        });
    }

}