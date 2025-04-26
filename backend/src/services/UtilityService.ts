import dotenv from 'dotenv';
import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';

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

    public uniquiseName(name: string): string {
        const uuid = uuidv4();
        return `${name.toLowerCase().replace(/\s/g, '_')}_dra_${uuid.replace(/-/g, '_')}`;
    }

    public getConstants(key: string): any {
        return {
            PORT: process.env.PORT || 3003,
            RECAPTCHA_SECRET: process.env.RECAPTCHA_SECRET || '',
            JWT_SECRET: process.env.JWT_SECRET || '',
            DB_Driver: process.env.DB_Driver || 'postgres',
            POSTGRESQL_URL: process.env.POSTGRESQL_URL || '',
            MAIL_DRIVER: process.env.MAIL_DRIVER || '',
            MAIL_HOST: process.env.MAIL_HOST || '',
            MAIL_PORT: process.env.MAIL_PORT || '',
            MAIL_USER: process.env.MAIL_USER || '',
            MAIL_PASS: process.env.MAIL_PASS || '',
            MAIL_FROM: process.env.MAIL_FROM || '',
            MAIL_REPLY_TO: process.env.MAIL_REPLY_TO || '',
        }[key];
    }


}