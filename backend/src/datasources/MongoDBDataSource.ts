import { DataSource } from "typeorm";
import dotenv from 'dotenv';
dotenv.config();

export class MongoDBDataSource {
    private static instance: MongoDBDataSource;

    private constructor() {
    }

    public static getInstance(): MongoDBDataSource {
        if (!MongoDBDataSource.instance) {
            MongoDBDataSource.instance = new MongoDBDataSource();
        }
        return MongoDBDataSource.instance;
    }

    public getDataSource(host: string, port: number, database: string, username?: string, password?: string) {
        // MongoDB Atlas detection: if host contains 'mongodb.net' or has 'shard' in hostname
        const isAtlas = host.includes('mongodb.net');
        
        if (isAtlas) {
            // MongoDB Atlas SRV connection format
            const connectionUrl = `mongodb+srv://${username}:${encodeURIComponent(password || '')}@${host}/${database}?retryWrites=true&w=majority`;
            return new DataSource({
                type: "mongodb",
                url: connectionUrl,
                database: database,
                synchronize: false,
                logging: true,
                entities: [], // External MongoDB has no predefined entities
                migrations: [],
                subscribers: [],
            });
        } else {
            // Standalone MongoDB connection
            return new DataSource({
                type: "mongodb",
                host: host,
                port: port,
                username: username,
                password: password,
                database: database,
                synchronize: false,
                logging: true,
                authSource: "admin", // Default to admin for auth
                entities: [], // External MongoDB has no predefined entities
                migrations: [],
                subscribers: [],
            });
        }
    }
}
