import { DataSource } from "typeorm";
import { DRAPrivateBetaUsers } from "../models/DRAPrivateBetaUsers.js";
import { DRADataModel } from "../models/DRADataModel.js";
import { DRADataModelSource } from "../models/DRADataModelSource.js";
import { DRATableMetadata } from "../models/DRATableMetadata.js";
import { DRACrossSourceJoinCatalog } from "../models/DRACrossSourceJoinCatalog.js";
import { DRADataSource } from "../models/DRADataSource.js";
import { DRAVerificationCode } from "../models/DRAVerificationCode.js";
import { DRAUsersPlatform } from "../models/DRAUsersPlatform.js";
import { DRAProject } from "../models/DRAProject.js";
import { DRADashboard } from "../models/DRADashboard.js";
import { DRAArticle } from "../models/DRAArticle.js";
import { DRAArticleCategory } from "../models/DRAArticleCategory.js";
import { DRACategory } from "../models/DRACategory.js";
import { DRASitemapEntry } from "../models/DRASitemapEntry.js";
import { DRADashboardExportMetaData } from "../models/DRADashboardExportMetaData.js";
import { DRAAIDataModelConversation } from "../models/DRAAIDataModelConversation.js";
import { DRAAIDataModelMessage } from "../models/DRAAIDataModelMessage.js";
import { DRADataModelRefreshHistory } from "../models/DRADataModelRefreshHistory.js";
import { DRAScheduledBackupRun } from "../models/DRAScheduledBackupRun.js";
import { DRASubscriptionTier } from "../models/DRASubscriptionTier.js";
import { DRAUserSubscription } from "../models/DRAUserSubscription.js";
import { DRAProjectMember } from "../models/DRAProjectMember.js";
import { DRAProjectInvitation } from "../models/DRAProjectInvitation.js";
import { DRANotification } from "../models/DRANotification.js";
import { DRAPlatformSettings } from "../models/DRAPlatformSettings.js";
import { DRAAccountCancellation } from "../models/DRAAccountCancellation.js";
import { DRAEmailPreferences } from "../models/DRAEmailPreferences.js";
import { SyncHistory } from "../entities/SyncHistory.js";
import dotenv from 'dotenv';
dotenv.config();

export class MongoDBDataSource {
    private static instance: MongoDBDataSource;

    private constructor() {
    }

    public static getInstance(): MongoDBDataSource {
        if (!MongoDBDataSource.instance) {
            MongoDBDataSource.instance = new MongoDBDataSource();
        }
        return MongoDBDataSource.instance;
    }

    public getDataSource(host: string, port: number, database: string, username?: string, password?: string) {
        return new DataSource({
            type: "mongodb",
            host: host,
            port: port,
            username: username,
            password: password,
            database: database,
            synchronize: false,
            logging: true,
            useUnifiedTopology: true,
            authSource: "admin", // Default to admin for auth
            entities: [
                DRAUsersPlatform, DRAProject, DRAVerificationCode, DRADataSource, DRADataModel,
                DRADataModelSource, DRATableMetadata, DRACrossSourceJoinCatalog, DRAPrivateBetaUsers,
                DRADashboard, DRAArticle, DRAArticleCategory, DRACategory, DRASitemapEntry,
                DRADashboardExportMetaData, DRAAIDataModelConversation, DRAAIDataModelMessage,
                DRADataModelRefreshHistory, DRAScheduledBackupRun, DRASubscriptionTier,
                DRAUserSubscription, DRAProjectMember, DRAProjectInvitation, DRANotification,
                DRAPlatformSettings, DRAAccountCancellation, DRAEmailPreferences, SyncHistory
            ],
            migrations: [],
            subscribers: [],
        });
    }
}
