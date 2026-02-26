import { UtilityService } from "../services/UtilityService.js";
import jwt, { JwtPayload } from "jsonwebtoken";

export class UserProcessor {
    private static instance: UserProcessor;
    private constructor() {}

    public static getInstance(): UserProcessor {
        if (!UserProcessor.instance) {
            UserProcessor.instance = new UserProcessor();
        }
        return UserProcessor.instance;
    }



    /**
     * Look up a user by email address (returns limited fields for privacy).
     */
    public async lookupUserByEmail(email: string): Promise<{ id: number; email: string; first_name: string; last_name: string } | null> {
        const { DBDriver } = await import('../drivers/DBDriver.js');
        const { EDataSourceType } = await import('../types/EDataSourceType.js');
        const { DRAUsersPlatform } = await import('../models/DRAUsersPlatform.js');
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        const concreteDriver = await driver.getConcreteDriver();
        const user = await concreteDriver.manager.findOne(DRAUsersPlatform, {
            where: { email: email.toLowerCase() },
            select: ['id', 'email', 'first_name', 'last_name'],
        });
        if (!user) return null;
        return { id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name };
    }
}
