import bcrypt  from 'bcryptjs';
import { Seeder } from "@jorgebodega/typeorm-seeding";
import { DataSource } from "typeorm";
import { DRAUsersPlatform } from "../models/DRAUsersPlatform";
import { UtilityService } from '../services/UtilityService';

export class DemoUsersPlatformSeeder extends Seeder {
    async run(dataSource: DataSource) {
        console.log('Running DemoUsersPlatformSeeder');
        const manager = dataSource.manager;
        const user = new DRAUsersPlatform();
        user.email = 'testuser@dataresearchanalysis.com';
        user.first_name = 'Test';
        user.last_name = 'User';
        const salt = parseInt(UtilityService.getInstance().getConstants('PASSWORD_SALT'));
        const password = 'testuser';
        const encryptedPassword = await bcrypt.hash(password, salt);
        user.password = encryptedPassword;
        await manager.save(user);

    }
}