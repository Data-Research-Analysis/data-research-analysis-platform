import { DBDriver } from "../drivers/DBDriver";
import { DRADataModel } from "../models/DRADataModel";
import { ITokenDetails } from "../types/ITokenDetails";
import _ from "lodash";
import { IDBConnectionDetails } from "../types/IDBConnectionDetails";
import { UtilityService } from "../services/UtilityService";
import { DRADataSource } from "../models/DRADataSource";
import { DRADashboard } from "../models/DRADashboard";
import { IDashboard } from "../types/IDashboard";
import { EDataSourceType } from "../types/EDataSourceType";
import { DRAUsersPlatform } from "../models/DRAUsersPlatform";
import { DRAProject } from "../models/DRAProject";
import { DRAArticle } from "../models/DRAArticle";
import { EPublishStatus } from "../types/EPublishStatus";
import { DRAArticleCategory } from "../models/DRAArticleCategory";
import { DRACategory } from "../models/DRACategory";
import { In } from "typeorm";

export class ArticleProcessor {
    private static instance: ArticleProcessor;
    private constructor() {}

    public static getInstance(): ArticleProcessor {
        if (!ArticleProcessor.instance) {
            ArticleProcessor.instance = new ArticleProcessor();
        }
        return ArticleProcessor.instance;
    }

    async addArticle(title: string, content: string, publishStatus: EPublishStatus, categories: any[], tokenDetails: ITokenDetails): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve(null);
            }
            const manager = (await driver.getConcreteDriver()).manager;
            if (!manager) {
                return resolve(null);
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
                return reject(error);
            }
        });
    }
}