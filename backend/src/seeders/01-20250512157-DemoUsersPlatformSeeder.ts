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

        user = new DRAUsersPlatform();
        user.email = 'testuser@dataresearchanalysis.com';
        user.first_name = 'Test';
        user.last_name = 'User';
        user.user_type = EUserType.NORMAL;
        salt = parseInt(UtilityService.getInstance().getConstants('PASSWORD_SALT'));
        password = 'testuser';
        encryptedPassword = await bcrypt.hash(password, salt);
        user.password = encryptedPassword;
        await manager.save(user);

    }
}