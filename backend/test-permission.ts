import { DataSource } from 'typeorm';
import { DRADataModel } from './src/models/DRADataModel.js';
import { DRADataModelSource } from './src/models/DRADataModelSource.js';
import { DRADataSource } from './src/models/DRADataSource.js';
import { DRAProject } from './src/models/DRAProject.js';
import { PermissionService } from './src/services/PermissionService.js';
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
    
    const manager = ds.manager;
    const junction = await manager.findOne(DRADataModelSource, {
        where: { data_model_id: 195 },
        relations: ['data_source', 'data_source.project']
    });
    
    console.log("Junction:", JSON.stringify(junction, null, 2));
    
    const permissionService = PermissionService.getInstance();
    
    // User ID 6 (hello@dataresearchanalysis.com)
    const canRead = await permissionService.canPerformActionOnDataModel(6, 195, 'read' as any, manager);
    console.log("Can read:", canRead);
    
    const projectId = await permissionService.getProjectIdFromDataModel(195, manager);
    console.log("Project ID:", projectId);
    
    process.exit(0);
}

run().catch(console.error);
