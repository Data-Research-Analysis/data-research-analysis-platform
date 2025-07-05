import { DBDriver } from "../drivers/DBDriver";
import { ITokenDetails } from "../types/ITokenDetails";
import _ from "lodash";
import { EDataSourceType } from "../types/EDataSourceType";
import { DRAUsersPlatform } from "../models/DRAUsersPlatform";
import { DRACategory } from "../models/DRACategory";
import { DRAArticleCategory } from "../models/DRAArticleCategory";

export class CategoryProcessor {
    private static instance: CategoryProcessor;
    private constructor() {}

    public static getInstance(): CategoryProcessor {
        if (!CategoryProcessor.instance) {
            CategoryProcessor.instance = new CategoryProcessor();
        }
        return CategoryProcessor.instance;
    }

    async getCategories(tokenDetails: ITokenDetails): Promise<DRACategory[]> {
        return new Promise<DRACategory[]>(async (resolve, reject) => {
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
            const categories = await manager.find(DRACategory, {where: {users_platform: user}});
            return resolve(categories);
        });
    }

    async addCategory(title: string, tokenDetails: ITokenDetails): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve(false);
            }
            const manager = (await driver.getConcreteDriver()).manager;
            if (!manager) {
                return resolve(false);
            }
            const user = await manager.findOne(DRAUsersPlatform, {where: {id: user_id}});
            if (!user) {
                return resolve(false);
            }
            try {
                const category = new DRACategory();
                category.title = title;
                category.users_platform = user;
                await manager.save(category);
                return resolve(true);
            } catch (error) {
                console.log('error', error);
                return reject(error);
            }
        });
    }

    async deleteCategory(categoryId: number, tokenDetails: ITokenDetails): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            const manager = (await driver.getConcreteDriver()).manager;
            const user = await manager.findOne(DRAUsersPlatform, {where: {id: user_id}});
            if (!user) {
                return resolve(false);
            }
            const category = await manager.findOne(DRACategory, {where: {id: categoryId}});
            if (!category) {
                return resolve(false);
            }
            const articleCategories = await manager.find(DRAArticleCategory, {where: {category: category, users_platform: user}});
            await manager.transaction(async transactionalEntityManager => {
                await transactionalEntityManager.remove(articleCategories);
                await transactionalEntityManager.remove(category);
            });
            return resolve(true);
        });
    }

    async editCategory(title: string, categoryId: number, tokenDetails: ITokenDetails): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve(false);
            }
            const manager = (await driver.getConcreteDriver()).manager;
            if (!manager) {
                return resolve(false);
            }
            const user = await manager.findOne(DRAUsersPlatform, {where: {id: user_id}});
            if (!user) {
                return resolve(false);
            }
            const category = await manager.findOne(DRACategory, {where: {id: categoryId, users_platform: user}});
            if (!category) {
                return resolve(false);
            }
            try {
                await manager.update(DRACategory, {id: categoryId}, {title: title});                
                return resolve(true);
            } catch (error) {
                console.log('error', error);
                return resolve(false);
            }
        });
    }
}