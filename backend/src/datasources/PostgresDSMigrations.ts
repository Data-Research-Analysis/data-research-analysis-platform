import { DataSource } from "typeorm";
import { DRAUser } from "../models/DRAUser";
import { DRADataModel } from "../models/DRADataModel";
import { DRADataSource } from "../models/DRADataSource";
import { DRAVerificationCode } from "../models/DRAVerificationCode";
import { DRAUsersPlatform } from "../models/DRAUsersPlatform";
import { DRAProject } from "../models/DRAProject";
import { DRADashboard } from "../models/DRADashboard";
import dotenv from 'dotenv';
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
    entities: [DRAUsersPlatform, DRAProject, DRAVerificationCode, DRADataSource, DRADataModel, DRAUser, DRADashboard],
    subscribers: [],
    migrations: ['./src/migrations/*.ts'],
})