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
            const usersList: DRAPrivateBetaUsers[] = [];
            const users = await manager.find(DRAPrivateBetaUsers);
            for (let i = 0; i < users.length; i++) {
                const user = users[i];
                usersList.push({
                    id: user.id,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    business_email: user.business_email,
                    phone_number: user.phone_number,
                    country: user.country,
                    agree_to_receive_updates: user.agree_to_receive_updates,
                    company_name: user.company_name,
                    created_at: user.created_at,
                });
            }
            return resolve(usersList);
        });
    }
}