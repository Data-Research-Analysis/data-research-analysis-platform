import { DataSource, DataSourceOptions } from "typeorm";
import { DRAEnterpriseQuery } from "../models/DRAEnterpriseQuery.js";
import { DRADataModel } from "../models/DRADataModel.js";
import { DRADataModelLineage } from "../models/DRADataModelLineage.js";
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
import { DRAArticleVersion } from "../models/DRAArticleVersion.js";
import { DRACategory } from "../models/DRACategory.js";
import { DRASitemapEntry } from "../models/DRASitemapEntry.js";
import { DRADashboardExportMetaData } from "../models/DRADashboardExportMetaData.js";
import { DRAAIDataModelConversation } from "../models/DRAAIDataModelConversation.js";
import { DRAAIDataModelMessage } from "../models/DRAAIDataModelMessage.js";
import { DRAAIInsightReport } from "../models/DRAAIInsightReport.js";
import { DRAAIInsightMessage } from "../models/DRAAIInsightMessage.js";
import { DRADataModelRefreshHistory } from "../models/DRADataModelRefreshHistory.js";
import { DRAScheduledBackupRun } from "../models/DRAScheduledBackupRun.js";
import { DRASubscriptionTier } from "../models/DRASubscriptionTier.js";
import { DRAProjectMember } from "../models/DRAProjectMember.js";
import { DRAProjectInvitation } from "../models/DRAProjectInvitation.js";
import { DRANotification } from "../models/DRANotification.js";
import { DRAPlatformSettings } from "../models/DRAPlatformSettings.js";
import { DRAAccountCancellation } from "../models/DRAAccountCancellation.js";
import { DRAEmailPreferences } from "../models/DRAEmailPreferences.js";
import { DRAMongoDBSyncHistory } from "../models/DRAMongoDBSyncHistory.js";
import { SyncHistory } from "../entities/SyncHistory.js";
import { DRACampaign } from "../models/DRACampaign.js";
import { DRACampaignChannel } from "../models/DRACampaignChannel.js";
import { DRAAIJoinSuggestion } from "../models/DRAAIJoinSuggestion.js";
import { DRAReport } from "../models/DRAReport.js";
import { DRAReportItem } from "../models/DRAReportItem.js";
import { DRAReportShareKey } from "../models/DRAReportShareKey.js";
import { DRAOrganization } from "../models/DRAOrganization.js";
import { DRAWorkspace } from "../models/DRAWorkspace.js";
import { DRAOrganizationMember } from "../models/DRAOrganizationMember.js";
import { DRAOrganizationInvitation } from "../models/DRAOrganizationInvitation.js";
import { DRAWorkspaceMember } from "../models/DRAWorkspaceMember.js";
import { DRAOrganizationSubscription } from "../models/DRAOrganizationSubscription.js";
import { DRACampaignOfflineData } from "../models/DRACampaignOfflineData.js";
import { DRAPaddleWebhookEvent } from "../models/DRAPaddleWebhookEvent.js";
import { DRAEnterpriseContactRequest } from "../models/DRAEnterpriseContactRequest.js";
import { DRADowngradeRequest } from "../models/DRADowngradeRequest.js";
import dotenv from 'dotenv';
dotenv.config();

export class PostgresDataSource {
    private static instance: PostgresDataSource;
    private constructor() {
    }
    public static getInstance(): PostgresDataSource {
        if (!PostgresDataSource.instance) {
            PostgresDataSource.instance = new PostgresDataSource();
        }
        return PostgresDataSource.instance;
    }
    public getDataSource(host: string, port: number, database: string, username: string, password: string) {
        return new DataSource({
            type: "postgres",
            host: host,
            port: port,
            username: username,
            password: password,
            database: database,
            synchronize: false,
            logging: true,
            entities: [DRAUsersPlatform, DRAProject, DRAVerificationCode, DRADataSource, DRADataModel, DRADataModelLineage, DRADataModelSource, DRATableMetadata, DRACrossSourceJoinCatalog, DRAEnterpriseQuery, DRADashboard, DRAArticle, DRAArticleCategory, DRAArticleVersion, DRACategory, DRASitemapEntry, DRADashboardExportMetaData, DRAAIDataModelConversation, DRAAIDataModelMessage, DRAAIInsightReport, DRAAIInsightMessage, DRADataModelRefreshHistory, DRAScheduledBackupRun, DRASubscriptionTier, DRAProjectMember, DRAProjectInvitation, DRANotification, DRAPlatformSettings, DRAAccountCancellation, DRAEmailPreferences, DRAMongoDBSyncHistory, SyncHistory, DRACampaign, DRACampaignChannel, DRAAIJoinSuggestion, DRAReport, DRAReportItem, DRAReportShareKey, DRAOrganization, DRAWorkspace, DRAOrganizationMember, DRAOrganizationInvitation, DRAWorkspaceMember, DRAOrganizationSubscription, DRACampaignOfflineData, DRAPaddleWebhookEvent, DRAEnterpriseContactRequest, DRADowngradeRequest],
            subscribers: [],
            // Only load TypeORM migration files (exclude utility scripts like migrate-articles-markdown.ts)
            migrations: ['./src/migrations/*.ts'],
        })
    }
}