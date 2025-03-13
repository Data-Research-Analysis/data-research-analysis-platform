import dotenv from 'dotenv';
import { PostgresDriver } from '../drivers/PostgresDriver';


export class UtilityService {
    private static instance: UtilityService;
    private constructor() {}
    public static getInstance(): UtilityService {
        if (!UtilityService.instance) {
            UtilityService.instance = new UtilityService();
        }
        return UtilityService.instance;
    }

    public async initialize() {
        dotenv.config();
        console.log('Initializing utilities');

    }

    public getConstants(key: string): any {
        return {
            PORT: process.env.PORT || 3003,
            RECAPTCHA_SECRET: process.env.RECAPTCHA_SECRET || '',
            JWT_SECRET: process.env.JWT_SECRET || '',
            POSTGRESQL_URL: process.env.POSTGRESQL_URL || '',
        }[key];
    }


}