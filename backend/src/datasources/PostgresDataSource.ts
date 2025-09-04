import { DataSource, DataSourceOptions } from "typeorm";
import { DRAUser } from "../models/DRAUser.js";
import { DRADataModel } from "../models/DRADataModel.js";
import { DRADataSource } from "../models/DRADataSource.js";
import { DRAVerificationCode } from "../models/DRAVerificationCode.js";
import { DRAUsersPlatform } from "../models/DRAUsersPlatform.js";
import { DRAProject } from "../models/DRAProject.js";
import { DRADashboard } from "../models/DRADashboard.js";
import { DRAArticle } from "../models/DRAArticle.js";
import { DRAArticleCategory } from "../models/DRAArticleCategory.js";
import { DRACategory } from "../models/DRACategory.js";
import dotenv from 'dotenv';
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