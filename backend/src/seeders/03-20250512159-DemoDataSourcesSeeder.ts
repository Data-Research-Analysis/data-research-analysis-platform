import { Seeder } from "@jorgebodega/typeorm-seeding";
import { DataSource } from "typeorm";
import { DRAProject } from '../models/DRAProject.js';
import { DRAUsersPlatform } from "../models/DRAUsersPlatform.js";
import { DRADataSource } from "../models/DRADataSource.js";
import { EDataSourceType } from "../types/EDataSourceType.js";

export class DemoDataSourcesSeeder extends Seeder {
    async run(dataSource: DataSource) {
        console.log('Running DemoDataSourcesSeeder');
        const manager = dataSource.manager;
        const user = await manager.findOne(DRAUsersPlatform, {
            where: { email: 'testuser@dataresearchanalysis.com' },
        });
        if (!user) {
            console.error('❌ User not found');
            return;
        }
        const project = await manager.findOne(DRAProject, {
            where: { name: 'DRA Demo Project' },
        });
        if (!project) {
            console.error('❌ Project not found');
            return;
        }
        
        // Check if data source already exists
        const existingDataSource = await manager.findOne(DRADataSource, {
            where: { 
                name: 'postresql',
                project: { id: project.id }
            }
        });
        
        if (!existingDataSource) {
            const dataSources = new DRADataSource();
            dataSources.name = 'postresql';
            dataSources.data_type = EDataSourceType.POSTGRESQL;
            dataSources.connection_details = {
                data_source_type: EDataSourceType.POSTGRESQL,
                host: 'database.dataresearchanalysis.test',
                port: 5432,
                schema: 'public',
                database: 'postgres_dra_db',
                username: 'postgres',
                password: 'postgres',
            };
            dataSources.users_platform = user,
            dataSources.created_at = new Date();
            dataSources.project = project;
            await manager.save(dataSources);
            console.log('✅ Created demo data source: postresql');
        } else {
            console.log('⏭️  Demo data source already exists: postresql');
        }
    }
}