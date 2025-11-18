import { DataSource } from "typeorm";
import { DRAPrivateBetaUsers } from "../models/DRAPrivateBetaUsers.js";
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
import { DRADashboardExportMetaData } from "../models/DRADashboardExportMetaData.js";
dotenv.config();

const host = process.env.POSTGRESQL_HOST_MIGRATIONS;
const port = parseInt(process.env.POSTGRESQL_PORT_MIGRATIONS);
const database = process.env.POSTGRESQL_DB_NAME;
const username = process.env.POSTGRESQL_USERNAME;
const password = process.env.POSTGRESQL_PASSWORD;
export const PostgresDSMigrations = new DataSource({
    type: "postgres",
    host: host,
    port: port,
    username: username,
    password: password,
    database: database,
    synchronize: false,
    logging: true,
    entities: [DRAUsersPlatform, DRAProject, DRAVerificationCode, DRADataSource, DRADataModel, DRAPrivateBetaUsers, DRADashboard, DRAArticle, DRAArticleCategory, DRACategory, DRADashboardExportMetaData],
    subscribers: [],
    migrations: ['./src/migrations/*.ts'],
})