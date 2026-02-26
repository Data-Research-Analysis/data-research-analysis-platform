import { DBDriver } from "../drivers/DBDriver.js";
import { ITokenDetails } from "../types/ITokenDetails.js";
import { EDataSourceType } from "../types/EDataSourceType.js";
import { DRAUsersPlatform } from "../models/DRAUsersPlatform.js";
import { DRAArticle } from "../models/DRAArticle.js";
import { EPublishStatus } from "../types/EPublishStatus.js";
import { DRAArticleCategory } from "../models/DRAArticleCategory.js";
import { DRACategory } from "../models/DRACategory.js";
import { IArticle } from "../types/IArticle.js";
import { In } from "typeorm";
import _ from "lodash";
import { DRAPrivateBetaUsers } from "../models/DRAPrivateBetaUsers.js";
import { IPrivateBetaUser } from "../types/IPrivateBetaUser.js";

export class PrivateBetaUserProcessor {
    private static instance: PrivateBetaUserProcessor;
    private constructor() {}

    public static getInstance(): PrivateBetaUserProcessor {
        if (!PrivateBetaUserProcessor.instance) {
            PrivateBetaUserProcessor.instance = new PrivateBetaUserProcessor();
        }
        return PrivateBetaUserProcessor.instance;
    }

    async getUsers(tokenDetails: ITokenDetails): Promise<IPrivateBetaUser[]> {
        return new Promise<IPrivateBetaUser[]>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve([]);
            }
            const manager = (await driver.getConcreteDriver()).manager;
            if (!manager) {
                return resolve([]);
            }
            const user = await manager.findOne(DRAUsersPlatform, {where: {id: user_id}});
            if (!user) {
                return resolve([]);
            }
            const usersList: IPrivateBetaUser[] = [];
            const users = await manager.find(DRAPrivateBetaUsers);
            for (let i = 0; i < users.length; i++) {
                const betaUser = users[i];
                
                // Check if beta user email exists in main users table
                const existingUser = await manager.findOne(DRAUsersPlatform, {
                    where: { email: betaUser.business_email }
                });
                
                usersList.push({
                    id: betaUser.id,
                    first_name: betaUser.first_name,
                    last_name: betaUser.last_name,
                    business_email: betaUser.business_email,
                    phone_number: betaUser.phone_number,
                    country: betaUser.country,
                    agree_to_receive_updates: betaUser.agree_to_receive_updates,
                    company_name: betaUser.company_name,
                    created_at: betaUser.created_at,
                    is_converted: existingUser ? true : false,
                    converted_user_id: existingUser ? existingUser.id : null,
                });
            }
            return resolve(usersList);
        });
    }
    /**
     * Apply for private beta access.
     * Returns null if email already registered, or the new user record.
     */
    public async applyForBeta(fields: {
        first_name: string; last_name: string; phone_number: string;
        business_email: string; company_name: string;
        agree_to_receive_updates: boolean; country: string;
    }): Promise<{ alreadyExists: boolean; email: string }> {
        const { DBDriver } = await import('../drivers/DBDriver.js');
        const { EDataSourceType } = await import('../types/EDataSourceType.js');
        const { DRAPrivateBetaUsers } = await import('../models/DRAPrivateBetaUsers.js');
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        const manager = (await driver.getConcreteDriver()).manager;
        const existing = await manager.findOne(DRAPrivateBetaUsers, { where: { business_email: fields.business_email } });
        if (existing) return { alreadyExists: true, email: fields.business_email };
        const user = new DRAPrivateBetaUsers();
        user.first_name = fields.first_name;
        user.last_name = fields.last_name;
        user.phone_number = fields.phone_number;
        user.business_email = fields.business_email;
        user.company_name = fields.company_name;
        user.agree_to_receive_updates = fields.agree_to_receive_updates;
        user.country = fields.country;
        await manager.save(user);
        return { alreadyExists: false, email: fields.business_email };
    }
}
