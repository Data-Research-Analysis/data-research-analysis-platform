import { DataSource, DataSourceOptions } from "typeorm";
import dotenv from 'dotenv';
dotenv.config();

export class MySQLDataSource {
    private static instance: MySQLDataSource;
    private constructor() {
    }
    public static getInstance(): MySQLDataSource {
        if (!MySQLDataSource.instance) {
            MySQLDataSource.instance = new MySQLDataSource();
        }
        return MySQLDataSource.instance;
    }
    public getDataSource(host: string, port: number, database: string, username: string, password: string) {
        return new DataSource({
            type: "mysql",
            host: host,
            port: port,
            username: username,
            password: password,
            database: database,
            synchronize: false,
            logging: true,
            entities: [],
            subscribers: [],
            migrations: [],
        })
    }
}