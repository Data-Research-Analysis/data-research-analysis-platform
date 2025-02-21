import dotenv from 'dotenv';
import { PostgresDriver } from '../drivers/PostgresDriver';


export class Utility {
    private static instance: Utility;
    private constructor() {}
    public static getInstance(): Utility {
        if (!Utility.instance) {
            Utility.instance = new Utility();
        }
        return Utility.instance;
    }

    public async initialize() {
        dotenv.config();
        console.log('Initializing utilities');

    }

    public getConstants(key: string): any {
        return {
            PORT: process.env.PORT || 3002,
            RECAPTCHA_SECRET: process.env.RECAPTCHA_SECRET || '',
            JWT_SECRET: process.env.JWT_SECRET || '',
            POSTGRESQL_URL: process.env.POSTGRESQL_URL || '',
        }[key];
    }


}