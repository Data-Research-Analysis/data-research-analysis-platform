import { DataSource } from "typeorm";
import dotenv from 'dotenv';
import { IDBDriver } from "../interfaces/IDBDriver.js";
import { IDBConnectionDetails } from "../types/IDBConnectionDetails.js";
import { MariaDBDataSource } from "../datasources/MariaDBDataSource.js";

export class MariaDBDriver implements IDBDriver{
    private static instance: MariaDBDriver;
    private dataSource!: DataSource;
    private externalDataSource!
    : DataSource;
    private constructor() {
    }
    public static getInstance(): MariaDBDriver {
        if (!MariaDBDriver.instance) {
            MariaDBDriver.instance = new MariaDBDriver();
        }
        return MariaDBDriver.instance;
    }

    public async initialize(dataSource: DataSource): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            dotenv.config();
            console.log('Initializing MariaDB driver');
            try {
                    this.dataSource = await dataSource.initialize();
                    if (this.dataSource.isInitialized) {
                        console.log('MariaDB connection has been established successfully.');
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
            console.log('Querying MariaDB', query, params);
            return resolve(null);
        });
    }

    public async close(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            console.log('Closing MariaDB connection');
            await this.dataSource.close();
            return resolve();
        });
    }

    public async connectExternalDB(connection: IDBConnectionDetails): Promise<DataSource> {
        return new Promise<DataSource>(async (resolve, reject) => {
            console.log('Connecting to external MariaDB');
            const host = connection.host;
            const port = connection.port;
            const database = connection.database;
            const username = connection.username;
            const password = connection.password;
            let dataSource = MariaDBDataSource.getInstance().getDataSource(host, port, database, username, password);
            try {
                const result = await dataSource.initialize();
                if (dataSource.isInitialized) {
                    this.externalDataSource = dataSource;
                    console.log('External MariaDB connection has been established successfully.');
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
    public getTablesColumnDetails(schema: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            const query = `SELECT
                            tb.table_catalog,
                            tb.table_schema,
                            tb.table_name,
                            co.column_name,
                            co.data_type,
                            co.character_maximum_length
                            FROM information_schema.tables AS tb
                            JOIN information_schema.columns AS co
                            ON tb.table_schema = co.table_schema AND tb.table_name = co.table_name
                            WHERE tb.table_schema = '${schema}' AND tb.table_type = 'BASE TABLE';`;
            return resolve(query);
        });
    }
    public getTablesRelationships(schema: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            const query = `SELECT
                            kcu.table_schema AS local_table_schema,
                            kcu.constraint_name,
                            kcu.table_name AS local_table_name,
                            kcu.column_name AS local_column_name,
                            kcu.referenced_table_schema AS foreign_table_schema,
                            kcu.referenced_table_name AS foreign_table_name,
                            kcu.referenced_column_name AS foreign_column_name
                            FROM
                            information_schema.key_column_usage AS kcu
                            WHERE
                            kcu.referenced_table_name IS NOT NULL
                            AND kcu.table_schema = '${schema}';`;
            return resolve(query);
        });
    }

}