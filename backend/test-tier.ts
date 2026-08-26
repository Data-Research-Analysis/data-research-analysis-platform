import { DataSource } from 'typeorm';
import { DRADataModel } from './src/models/DRADataModel.js';
import { DRADashboard } from './src/models/DRADashboard.js';
import { DRASubscription } from './src/models/DRASubscription.js';
import { TierEnforcementService } from './src/services/TierEnforcementService.js';
import * as dotenv from 'dotenv';
dotenv.config();

const ds = new DataSource({
    type: 'postgres',
    host: process.env.POSTGRESQL_HOST,
    port: parseInt(process.env.POSTGRESQL_PORT || '5432'),
    username: process.env.POSTGRESQL_USERNAME,
    password: process.env.POSTGRESQL_PASSWORD,
    database: process.env.POSTGRESQL_DB_NAME,
    entities: ['./src/models/*.ts'],
    synchronize: false,
});

async function run() {
    await ds.initialize();
    const service = TierEnforcementService.getInstance();
    
    try {
        const stats = await service.getUsageStats(6); // dataresearchanalysis.com demo user
        console.log("Usage stats:", JSON.stringify(stats, null, 2));
    } catch (e) {
        console.error(e);
    }
    
    process.exit(0);
}

run().catch(console.error);
