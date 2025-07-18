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

    async addArticle(title: string, content: string, publishStatus: EPublishStatus, categories: any[], tokenDetails: ITokenDetails): Promise<boolean> {
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

    async deleteArticle(articleId: number, tokenDetails: ITokenDetails): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            const manager = (await driver.getConcreteDriver()).manager;
            const user = await manager.findOne(DRAUsersPlatform, {where: {id: user_id}});
            if (!user) {
                return resolve(false);
            }
            const article = await manager.findOne(DRAArticle, {where: {id: articleId, users_platform: user}});
            if (!article) {
                return resolve(false);
            }
            const articleCategories = await manager.find(DRAArticleCategory, {where: {article: article}});
            await manager.transaction(async transactionalEntityManager => {
                await transactionalEntityManager.remove(articleCategories);
                await transactionalEntityManager.remove(article);
            });
            return resolve(true);
        });
    }

    async editArticle(articleId: number, title: string, content: string, categories: any[], tokenDetails: ITokenDetails): Promise<boolean> {
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
                // delete the existing categories for the article
                let articleCategories: DRAArticleCategory[] = await manager.find(DRAArticleCategory, {where: {article: article}});
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
                await manager.update(DRAArticle, {id: articleId}, {title: title, content: content});
                return resolve(true);
            } catch (error) {
                console.log('error', error);
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
            const articles = await manager.find(DRAArticle, { relations: ['dra_articles_categories']});
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