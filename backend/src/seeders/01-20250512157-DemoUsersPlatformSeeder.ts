import bcrypt  from 'bcryptjs';
import { Seeder } from '@jorgebodega/typeorm-seeding';
import { DataSource } from 'typeorm';
import { DRAUsersPlatform } from '../models/DRAUsersPlatform.js';
import { UtilityService } from '../services/UtilityService.js';
import { EUserType } from '../types/EUserType.js';

export class DemoUsersPlatformSeeder extends Seeder {
    async run(dataSource: DataSource) {
        console.log('Running DemoUsersPlatformSeeder');
        const manager = dataSource.manager;
        
        // Check and create admin user
        const existingAdmin = await manager.findOne(DRAUsersPlatform, {
            where: { email: 'testadminuser@dataresearchanalysis.com' }
        });
        
        if (!existingAdmin) {
            let user = new DRAUsersPlatform();
            user.email = 'testadminuser@dataresearchanalysis.com';
            user.first_name = 'TestAdmin';
            user.last_name = 'User';
            user.user_type = EUserType.ADMIN;
            let salt = parseInt(UtilityService.getInstance().getConstants('PASSWORD_SALT'));
            let password = 'testuser';
            let encryptedPassword = await bcrypt.hash(password, salt);
            user.password = encryptedPassword;
            await manager.save(user);
            console.log('✅ Created admin user: testadminuser@dataresearchanalysis.com');
        } else {
            console.log('⏭️  Admin user already exists: testadminuser@dataresearchanalysis.com');
        }

        // Check and create normal user
        const existingUser = await manager.findOne(DRAUsersPlatform, {
            where: { email: 'testuser@dataresearchanalysis.com' }
        });
        
        if (!existingUser) {
            let user = new DRAUsersPlatform();
            user.email = 'testuser@dataresearchanalysis.com';
            user.first_name = 'Test';
            user.last_name = 'User';
            user.user_type = EUserType.NORMAL;
            let salt = parseInt(UtilityService.getInstance().getConstants('PASSWORD_SALT'));
            let password = 'testuser';
            let encryptedPassword = await bcrypt.hash(password, salt);
            user.password = encryptedPassword;
            await manager.save(user);
            console.log('✅ Created normal user: testuser@dataresearchanalysis.com');
        } else {
            console.log('⏭️  Normal user already exists: testuser@dataresearchanalysis.com');
        }
    }
}