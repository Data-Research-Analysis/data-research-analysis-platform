import { DBDriver } from "../drivers/DBDriver.js";
import { ITokenDetails } from "../types/ITokenDetails.js";
import { EDataSourceType } from "../types/EDataSourceType.js";
import { DRAUsersPlatform } from "../models/DRAUsersPlatform.js";
import { DRASitemapEntry } from "../models/DRASitemapEntry.js";
import { EPublishStatus } from "../types/EPublishStatus.js";
import { ISitemapEntry } from "../types/ISitemapEntry.js";

export class SitemapProcessor {
    private static instance: SitemapProcessor;
    private constructor() {}

    public static getInstance(): SitemapProcessor {
        if (!SitemapProcessor.instance) {
            SitemapProcessor.instance = new SitemapProcessor();
        }
        return SitemapProcessor.instance;
    }

    async getSitemapEntries(tokenDetails: ITokenDetails): Promise<ISitemapEntry[]> {
        return new Promise<ISitemapEntry[]>(async (resolve, reject) => {
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
            const entries = await manager.find(DRASitemapEntry, {
                where: {users_platform: user},
                order: {priority: 'ASC', created_at: 'DESC'}
            });
            return resolve(entries);
        });
    }

    async getPublishedSitemapEntries(): Promise<ISitemapEntry[]> {
        return new Promise<ISitemapEntry[]>(async (resolve, reject) => {
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve([]);
            }
            const manager = (await driver.getConcreteDriver()).manager;
            if (!manager) {
                return resolve([]);
            }
            const entries = await manager.find(DRASitemapEntry, {
                where: {publish_status: EPublishStatus.PUBLISHED},
                order: {priority: 'ASC', created_at: 'DESC'}
            });
            return resolve(entries);
        });
    }

    async addSitemapEntry(url: string, publishStatus: EPublishStatus, priority: number, tokenDetails: ITokenDetails): Promise<boolean> {
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
                const entry = new DRASitemapEntry();
                entry.url = url;
                entry.publish_status = publishStatus;
                entry.priority = priority;
                entry.users_platform = user;
                await manager.save(entry);
                return resolve(true);
            } catch (error) {
                console.log('error', error);
                return resolve(false);
            }
        });
    }

    async editSitemapEntry(entryId: number, url: string, priority: number, tokenDetails: ITokenDetails): Promise<boolean> {
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
            const entry = await manager.findOne(DRASitemapEntry, {where: {id: entryId, users_platform: user}});
            if (!entry) {
                return resolve(false);
            }
            try {
                await manager.update(DRASitemapEntry, {id: entryId}, {url, priority});
                return resolve(true);
            } catch (error) {
                console.log('error', error);
                return resolve(false);
            }
        });
    }

    async publishSitemapEntry(entryId: number, tokenDetails: ITokenDetails): Promise<boolean> {
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
            const entry = await manager.findOne(DRASitemapEntry, {where: {id: entryId, users_platform: user}});
            if (!entry) {
                return resolve(false);
            }
            try {
                await manager.update(DRASitemapEntry, {id: entryId}, {publish_status: EPublishStatus.PUBLISHED});
                return resolve(true);
            } catch (error) {
                console.log('error', error);
                return resolve(false);
            }
        });
    }

    async unpublishSitemapEntry(entryId: number, tokenDetails: ITokenDetails): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            const manager = (await driver.getConcreteDriver()).manager;
            const user = await manager.findOne(DRAUsersPlatform, {where: {id: user_id}});
            if (!user) {
                return resolve(false);
            }
            try {
                const entry = await manager.findOne(DRASitemapEntry, {where: {id: entryId, users_platform: user}});
                if (!entry) {
                    return resolve(false);
                }
                await manager.update(DRASitemapEntry, {id: entryId}, {publish_status: EPublishStatus.DRAFT});
                return resolve(true);
            } catch (error) {
                console.log('error', error);
                return resolve(false);
            }
        });
    }

    async deleteSitemapEntry(entryId: number, tokenDetails: ITokenDetails): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            const manager = (await driver.getConcreteDriver()).manager;
            const user = await manager.findOne(DRAUsersPlatform, {where: {id: user_id}});
            if (!user) {
                return resolve(false);
            }
            try {
                const entry = await manager.findOne(DRASitemapEntry, {where: {id: entryId, users_platform: user}});
                if (!entry) {
                    return resolve(false);
                }
                await manager.delete(DRASitemapEntry, {id: entryId});
                return resolve(true);
            } catch (error) {
                console.log('error', error);
                return resolve(false);
            }
        });
    }

    async reorderSitemapEntries(entryIds: number[], tokenDetails: ITokenDetails): Promise<boolean> {
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
                // Update priorities based on array order
                for (let i = 0; i < entryIds.length; i++) {
                    await manager.update(DRASitemapEntry, {id: entryIds[i], users_platform: user}, {priority: i});
                }
                return resolve(true);
            } catch (error) {
                console.log('error', error);
                return resolve(false);
            }
        });
    }
}
