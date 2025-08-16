import { DataSource, DataSourceOptions } from "typeorm";
import dotenv from 'dotenv';
dotenv.config();

export class MariaDBDataSource {
    private static instance: MariaDBDataSource;
    private constructor() {
    }
    public static getInstance(): MariaDBDataSource {
        if (!MariaDBDataSource.instance) {
            MariaDBDataSource.instance = new MariaDBDataSource();
        }
        return MariaDBDataSource.instance;
    }
    public getDataSource(host: string, port: number, database: string, username: string, password: string) {
        return new DataSource({
            type: "mariadb",
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