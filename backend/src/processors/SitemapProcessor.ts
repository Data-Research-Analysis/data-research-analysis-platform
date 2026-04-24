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

    /**
     * Generate text sitemap (plain text list of URLs)
     */
    async generateTextSitemap(): Promise<string> {
        const entries = await this.getPublishedSitemapEntries();
        return entries.map(entry => entry.url).join('\n');
    }

    /**
     * Generate XML sitemap following sitemaps.org protocol
     * Maps database fields:
     *  - url → <loc>
     *  - updated_at → <lastmod>
     *  - priority (0-100) → <priority> (0.0-1.0)
     *  - static "weekly" → <changefreq>
     */
    async generateXmlSitemap(): Promise<string> {
        const entries = await this.getPublishedSitemapEntries();
        
        const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>\n' +
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
        const xmlFooter = '</urlset>';
        
        const urlEntries = entries.map(entry => {
            // Normalize priority from 0-100 integer to 0.0-1.0 decimal
            const normalizedPriority = (entry.priority / 100).toFixed(1);
            return `  <url>\n` +
                `    <loc>${this.escapeXml(entry.url)}</loc>\n` +
                `    <lastmod>${entry.updated_at.toISOString()}</lastmod>\n` +
                `    <changefreq>weekly</changefreq>\n` +
                `    <priority>${normalizedPriority}</priority>\n` +
                `  </url>`;
        }).join('\n');
        
        return xmlHeader + urlEntries + '\n' + xmlFooter;
    }

    /**
     * Escape special XML characters to prevent injection and ensure valid XML
     * Handles: & < > " '
     */
    private escapeXml(unsafe: string): string {
        return unsafe
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
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
