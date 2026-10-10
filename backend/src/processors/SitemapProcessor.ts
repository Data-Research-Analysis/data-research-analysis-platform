import { DBDriver } from "../drivers/DBDriver.js";
import { ITokenDetails } from "../types/ITokenDetails.js";
import { EDataSourceType } from "../types/EDataSourceType.js";
import { DRAUsersPlatform } from "../models/DRAUsersPlatform.js";
import { DRASitemapEntry } from "../models/DRASitemapEntry.js";
import { DRAArticle } from "../models/DRAArticle.js";
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
     * Published articles are always included in the sitemap, regardless of
     * whether a manual sitemap entry exists for them. Deriving them from the
     * article table keeps the sitemap complete and self-healing.
     */
    private async getArticleSitemapEntries(): Promise<Array<{ url: string; lastmod: Date; priority: number }>> {
        const baseUrl = (process.env.FRONTEND_URL || 'https://www.dataresearchanalysis.com').replace(/\/+$/, '');
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) return [];
        const manager = (await driver.getConcreteDriver()).manager;
        if (!manager) return [];
        const articles = await manager.find(DRAArticle, { where: { publish_status: EPublishStatus.PUBLISHED } });
        return articles.map((article) => ({
            url: `${baseUrl}/articles/${article.slug}`,
            lastmod: article.created_at,
            priority: 0.8
        }));
    }

    /**
     * Generate text sitemap (plain text list of URLs)
     */
    async generateTextSitemap(): Promise<string> {
        const entries = await this.getPublishedSitemapEntries();
        const articles = await this.getArticleSitemapEntries();
        const urls = new Set<string>();
        for (const entry of entries) urls.add(entry.url);
        for (const article of articles) urls.add(article.url);
        return Array.from(urls).join('\n');
    }

    /**
     * Generate XML sitemap following sitemaps.org protocol.
     * Includes manual sitemap entries plus every published article.
     */
    async generateXmlSitemap(): Promise<string> {
        const entries = await this.getPublishedSitemapEntries();
        const articles = await this.getArticleSitemapEntries();

        const seen = new Set<string>();
        const merged: Array<{ url: string; lastmod: Date; priority: number }> = [];
        for (const entry of entries) {
            if (seen.has(entry.url)) continue;
            seen.add(entry.url);
            merged.push({
                url: entry.url,
                lastmod: entry.updated_at,
                // DB priority is a 0-100 integer; fall back to a neutral 0.5 when unset (0).
                priority: entry.priority > 0 ? Number((entry.priority / 100).toFixed(1)) : 0.5
            });
        }
        for (const article of articles) {
            if (seen.has(article.url)) continue;
            seen.add(article.url);
            merged.push(article);
        }

        const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>\n' +
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
        const xmlFooter = '</urlset>';

        const urlEntries = merged.map(item => {
            return `  <url>\n` +
                `    <loc>${this.escapeXml(item.url)}</loc>\n` +
                `    <lastmod>${item.lastmod.toISOString()}</lastmod>\n` +
                `    <changefreq>weekly</changefreq>\n` +
                `    <priority>${item.priority.toFixed(1)}</priority>\n` +
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
