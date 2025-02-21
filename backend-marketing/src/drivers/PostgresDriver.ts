import { Sequelize } from "sequelize";
import { Utility } from "../utility/Utility";
import dotenv from 'dotenv';

export class PostgresDriver {
    private static instance: PostgresDriver;
    private sequelize: Sequelize;
    private constructor() {}
    public static getInstance(): PostgresDriver {
        if (!PostgresDriver.instance) {
            PostgresDriver.instance = new PostgresDriver();
        }
        return PostgresDriver.instance;
    }

    public async initialize() {
        dotenv.config();
        console.log('Initializing postgres driver');
        const postgresUrl = Utility.getInstance().getConstants('POSTGRESQL_URL');
        this.sequelize = new Sequelize(postgresUrl);
        
        try {
            await this.sequelize.authenticate();
            console.log('PostgresSQL connection has been established successfully.');
        } catch (error) {
            console.error('Unable to connect to the database:', error);
        }

    }

    public getSequelize() {
        return this.sequelize;
    }

    public async query(query: string, params: any) {
        console.log('Querying postgres', query, params);
    }

    public async close() {
        console.log('Closing postgres connection');
        await this.sequelize.close();
    }

}