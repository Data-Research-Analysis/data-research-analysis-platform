import { DataSource, DataSourceOptions } from "typeorm";
import { DRAUser } from "../models/DRAUser";
import { DRADataModel } from "../models/DRADataModel";
import { DRADataSource } from "../models/DRADataSource";
import { DRAVerificationCode } from "../models/DRAVerificationCode";
import { DRAUsersPlatform } from "../models/DRAUsersPlatform";
import { DRAProject } from "../models/DRAProject";
import { DRADashboard } from "../models/DRADashboard";
import dotenv from 'dotenv';
import { DRAArticle } from "../models/DRAArticle";
import { DRAArticleCategory } from "../models/DRAArticleCategory";
import { DRACategory } from "../models/DRACategory";
dotenv.config();

export class PostgresDataSource {
    private static instance: PostgresDataSource;
    private constructor() {
    }
    public static getInstance(): PostgresDataSource {
        if (!PostgresDataSource.instance) {
            PostgresDataSource.instance = new PostgresDataSource();
        }
        return PostgresDataSource.instance;
    }
    public getDataSource(host: string, port: number, database: string, username: string, password: string) {
        return new DataSource({
            type: "postgres",
            host: host,
            port: port,
            username: username,
            password: password,
            database: database,
            synchronize: false,
            logging: true,
            entities: [DRAUsersPlatform, DRAProject, DRAVerificationCode, DRADataSource, DRADataModel, DRAUser, DRADashboard, DRAArticle, DRAArticleCategory, DRACategory],
            subscribers: [],
            migrations: ['./src/migrations/*.ts'],
        })
    }
}