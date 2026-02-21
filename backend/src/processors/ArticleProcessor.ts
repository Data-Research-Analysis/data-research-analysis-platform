import { DBDriver } from "../drivers/DBDriver.js";
import { ITokenDetails } from "../types/ITokenDetails.js";
import { EDataSourceType } from "../types/EDataSourceType.js";
import { DRAUsersPlatform } from "../models/DRAUsersPlatform.js";
import { DRAArticle } from "../models/DRAArticle.js";
import { EPublishStatus } from "../types/EPublishStatus.js";
import { DRAArticleCategory } from "../models/DRAArticleCategory.js";
import { DRAArticleVersion } from "../models/DRAArticleVersion.js";
import { DRACategory } from "../models/DRACategory.js";
import { IArticle } from "../types/IArticle.js";
import { IArticleVersion } from "../types/IArticleVersion.js";
import { In } from "typeorm";
import _ from "lodash";

export class ArticleProcessor {
    private static instance: ArticleProcessor;
    private constructor() {}

    public static getInstance(): ArticleProcessor {
        if (!ArticleProcessor.instance) {
            ArticleProcessor.instance = new ArticleProcessor();
        }
        return ArticleProcessor.instance;
    }

    async getArticles(tokenDetails: ITokenDetails): Promise<IArticle[]> {
        return new Promise<IArticle[]>(async (resolve, reject) => {
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
            const articlesList: IArticle[] = [];
            const articles = await manager.find(DRAArticle, {where: {users_platform: user}, relations: ['dra_articles_categories']});
            for (let i = 0; i < articles.length; i++) {
                const article = articles[i];
                const categories = await manager.find(DRACategory, {where: {id: In(article.dra_articles_categories.map(cat => cat.category_id))}});
                articlesList.push({
                    article: article,
                    categories: categories
                });
            }
            return resolve(articlesList);
        });
    }

    async addArticle(title: string, content: string, contentMarkdown: string | undefined, publishStatus: EPublishStatus, categories: any[], tokenDetails: ITokenDetails): Promise<boolean> {
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
                const article = new DRAArticle();
                article.title = title;
                article.content = content;
                article.content_markdown = contentMarkdown;
                article.publish_status = publishStatus;
                article.slug = _.kebabCase(title).substring(0,100); // Generate a slug from the title
                article.users_platform = user;
                const savedArticle = await manager.save(article);
                const categoriesList = await manager.findBy(DRACategory, {id: In(categories)});
                const articleCategories: DRAArticleCategory[] = [];
                for (let i=0; i< categoriesList.length; i++) {
                    const articleCategory = new DRAArticleCategory();
                    articleCategory.article = savedArticle;
                    articleCategory.category = categoriesList[i];
                    articleCategory.users_platform = user;
                    articleCategories.push(articleCategory);
                }
                await manager.save(articleCategories);
                return resolve(true);
            } catch (error) {
                console.log('error', error);
                return resolve(error);
            }
        });
    }

    async publishArticle(articleId: number, tokenDetails: ITokenDetails): Promise<boolean> {
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
            const article = await manager.findOne(DRAArticle, {where: {id: articleId}});
            if (!article) {
                return resolve(false);
            }
            try {
                await manager.update(DRAArticle, {id: articleId}, {publish_status: EPublishStatus.PUBLISHED});                
                return resolve(true);
            } catch (error) {
                console.log('error', error);
                return resolve(error);
            }
        });
    }

    async unpublishArticle(articleId: number, tokenDetails: ITokenDetails): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            const manager = (await driver.getConcreteDriver()).manager;
            const user = await manager.findOne(DRAUsersPlatform, {where: {id: user_id}});
            if (!user) {
                return resolve(false);
            }
            try {
                const article = await manager.findOne(DRAArticle, {where: {id: articleId}});
                if (!article) {
                    return resolve(false);
                }
                await manager.update(DRAArticle, {id: articleId}, {publish_status: EPublishStatus.DRAFT});                
                return resolve(true);
            } catch (error) {
                console.log('error', error);
                return resolve(error);
            }
        });
    }

    async deleteArticle(articleId: number, tokenDetails: ITokenDetails): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
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
            const article = await manager.findOne(DRAArticle, {where: {id: articleId, users_platform: user}});
            if (!article) {
                return resolve(false);
            }
            try {
                // Delete category mappings first using article_id column directly
                const articleCategories = await manager.find(DRAArticleCategory, {where: {article_id: articleId}});
                await manager.transaction(async transactionalEntityManager => {
                    await transactionalEntityManager.remove(articleCategories);
                    await transactionalEntityManager.remove(article);
                });
                return resolve(true);
            } catch (error) {
                console.log('deleteArticle error', error);
                return resolve(false);
            }
        });
    }

    async editArticle(articleId: number, title: string, content: string, contentMarkdown: string | undefined, categories: any[], tokenDetails: ITokenDetails): Promise<boolean> {
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
            const article = await manager.findOne(DRAArticle, {where: {id: articleId, users_platform: user}});
            if (!article) {
                return resolve(false);
            }
            try {
                // Snapshot current state as a new version before applying changes
                await this.createVersion(articleId, undefined, tokenDetails);

                // delete the existing categories for the article
                let articleCategories: DRAArticleCategory[] = await manager.find(DRAArticleCategory, {where: {article_id: articleId}});
                await manager.remove(articleCategories);

                const categoriesList = await manager.findBy(DRACategory, {id: In(categories)});
                articleCategories = [];
                for (let i=0; i< categoriesList.length; i++) {
                    const articleCategory = new DRAArticleCategory();
                    articleCategory.article = article;
                    articleCategory.category = categoriesList[i];
                    articleCategory.users_platform = user;
                    articleCategories.push(articleCategory);
                }
                await manager.save(articleCategories);
                await manager.update(DRAArticle, {id: articleId}, {title: title, content: content, content_markdown: contentMarkdown});
                return resolve(true);
            } catch (error) {
                console.log('error', error);
                return resolve(false);
            }
        });
    }

    // ----------------------------------------------------------------
    // Article Versioning
    // ----------------------------------------------------------------

    /**
     * Snapshot the current state of an article as the next version number.
     * Called automatically inside editArticle and can be called explicitly.
     */
    async createVersion(articleId: number, changeSummary?: string, tokenDetails?: ITokenDetails): Promise<boolean> {
        return new Promise<boolean>(async (resolve) => {
            try {
                const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
                if (!driver) return resolve(false);
                const manager = (await driver.getConcreteDriver()).manager;
                if (!manager) return resolve(false);

                const article = await manager.findOne(DRAArticle, {where: {id: articleId}});
                if (!article) return resolve(false);

                // Determine next version number
                const lastVersion = await manager.findOne(DRAArticleVersion, {
                    where: {article_id: articleId},
                    order: {version_number: 'DESC'},
                });
                const nextVersionNumber = lastVersion ? lastVersion.version_number + 1 : 1;

                let user: DRAUsersPlatform | null = null;
                if (tokenDetails?.user_id) {
                    user = await manager.findOne(DRAUsersPlatform, {where: {id: tokenDetails.user_id}}) ?? null;
                }

                const version = new DRAArticleVersion();
                version.version_number = nextVersionNumber;
                version.title = article.title;
                version.content = article.content;
                version.content_markdown = article.content_markdown;
                version.change_summary = changeSummary ?? undefined;
                version.article_id = article.id;
                version.article = article;
                if (user) {
                    version.users_platform = user;
                }

                await manager.save(version);
                return resolve(true);
            } catch (error) {
                console.log('createVersion error', error);
                return resolve(false);
            }
        });
    }

    /**
     * Return all versions for an article, newest first.
     */
    async getVersions(articleId: number, tokenDetails: ITokenDetails): Promise<IArticleVersion[]> {
        return new Promise<IArticleVersion[]>(async (resolve) => {
            try {
                const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
                if (!driver) return resolve([]);
                const manager = (await driver.getConcreteDriver()).manager;
                if (!manager) return resolve([]);

                const versions = await manager.find(DRAArticleVersion, {
                    where: {article_id: articleId},
                    order: {version_number: 'DESC'},
                });

                return resolve(versions.map(v => ({
                    id: v.id,
                    version_number: v.version_number,
                    title: v.title,
                    content: v.content,
                    content_markdown: v.content_markdown,
                    change_summary: v.change_summary,
                    article_id: v.article_id,
                    created_at: v.created_at?.toISOString?.() ?? '',
                } as IArticleVersion)));
            } catch (error) {
                console.log('getVersions error', error);
                return resolve([]);
            }
        });
    }

    /**
     * Return a single version by version number.
     */
    async getVersion(articleId: number, versionNumber: number, tokenDetails: ITokenDetails): Promise<IArticleVersion | null> {
        return new Promise<IArticleVersion | null>(async (resolve) => {
            try {
                const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
                if (!driver) return resolve(null);
                const manager = (await driver.getConcreteDriver()).manager;
                if (!manager) return resolve(null);

                const version = await manager.findOne(DRAArticleVersion, {
                    where: {article_id: articleId, version_number: versionNumber},
                });
                if (!version) return resolve(null);

                return resolve({
                    id: version.id,
                    version_number: version.version_number,
                    title: version.title,
                    content: version.content,
                    content_markdown: version.content_markdown,
                    change_summary: version.change_summary,
                    article_id: version.article_id,
                    created_at: version.created_at?.toISOString?.() ?? '',
                } as IArticleVersion);
            } catch (error) {
                console.log('getVersion error', error);
                return resolve(null);
            }
        });
    }

    /**
     * Restore an article to a previous version.
     * Creates a new version snapshot of the current content first, then applies the old version's content.
     */
    async restoreVersion(articleId: number, versionNumber: number, tokenDetails: ITokenDetails): Promise<boolean> {
        return new Promise<boolean>(async (resolve) => {
            const { user_id } = tokenDetails;
            try {
                const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
                if (!driver) return resolve(false);
                const manager = (await driver.getConcreteDriver()).manager;
                if (!manager) return resolve(false);

                const user = await manager.findOne(DRAUsersPlatform, {where: {id: user_id}});
                if (!user) return resolve(false);

                const article = await manager.findOne(DRAArticle, {where: {id: articleId, users_platform: user}});
                if (!article) return resolve(false);

                const targetVersion = await manager.findOne(DRAArticleVersion, {
                    where: {article_id: articleId, version_number: versionNumber},
                });
                if (!targetVersion) return resolve(false);

                // Snapshot the current state before overwriting
                await this.createVersion(articleId, `Auto-snapshot before restoring to v${versionNumber}`, tokenDetails);

                // Apply the old version's content to the live article
                await manager.update(DRAArticle, {id: articleId}, {
                    title: targetVersion.title,
                    content: targetVersion.content,
                    content_markdown: targetVersion.content_markdown,
                });

                return resolve(true);
            } catch (error) {
                console.log('restoreVersion error', error);
                return resolve(false);
            }
        });
    }

    async getPublicArticles(): Promise<IArticle[]> {
        return new Promise<IArticle[]>(async (resolve, reject) => {
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve([]);
            }
            const manager = (await driver.getConcreteDriver()).manager;
            if (!manager) {
                return resolve([]);
            }
            const articlesList: IArticle[] = [];
            const articles = await manager.find(DRAArticle, { where:{ publish_status: EPublishStatus.PUBLISHED }, relations: ['dra_articles_categories']});
            for (let i = 0; i < articles.length; i++) {
                const article = articles[i];
                const categories = await manager.find(DRACategory, {where: {id: In(article.dra_articles_categories.map(cat => cat.category_id))}});
                articlesList.push({
                    article: article,
                    categories: categories
                });
            }
            return resolve(articlesList);
        });
    }
}