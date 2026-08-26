import { DataSource } from 'typeorm';
import { DRAProjectMember } from './src/models/DRAProjectMember.js';
import { DRAProject } from './src/models/DRAProject.js';
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
    
    // Check if user 6 is the owner of project 35
    const project = await ds.manager.findOne(DRAProject, {
        where: { id: 35 },
        relations: ['users_platform']
    });
    console.log("Project owner ID:", project?.users_platform?.id);
    
    // Check members
    const members = await ds.manager.find(DRAProjectMember, {
        where: { project: { id: 35 } },
        relations: ['user']
    });
    console.log("Members:", members.map(m => ({ id: m.id, userId: m.user.id, role: m.marketing_role })));
    
    process.exit(0);
}

run().catch(console.error);
