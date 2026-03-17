import { DataSource } from "typeorm";
import { DRAEnterpriseQuery } from "../models/DRAEnterpriseQuery.js";
import { DRADataModel } from "../models/DRADataModel.js";
import { DRADataModelSource } from "../models/DRADataModelSource.js";
import { DRATableMetadata } from "../models/DRATableMetadata.js";
import { DRACrossSourceJoinCatalog } from "../models/DRACrossSourceJoinCatalog.js";
import { DRADataSource } from "../models/DRADataSource.js";
import { DRAVerificationCode } from "../models/DRAVerificationCode.js";
import { DRAUsersPlatform } from "../models/DRAUsersPlatform.js";
import { DRAProject } from "../models/DRAProject.js";
import { DRAProjectMember } from "../models/DRAProjectMember.js";
import { DRAProjectInvitation } from "../models/DRAProjectInvitation.js";
import { DRADashboard } from "../models/DRADashboard.js";
import { DRAArticle } from "../models/DRAArticle.js";
import { DRAArticleCategory } from "../models/DRAArticleCategory.js";
import { DRAArticleVersion } from "../models/DRAArticleVersion.js";
import { DRACategory } from "../models/DRACategory.js";
import { DRASitemapEntry } from "../models/DRASitemapEntry.js";
import { DRADashboardExportMetaData } from "../models/DRADashboardExportMetaData.js";
import { DRAAIDataModelConversation } from "../models/DRAAIDataModelConversation.js";
import { DRAAIDataModelMessage } from "../models/DRAAIDataModelMessage.js";
import { DRADataModelRefreshHistory } from "../models/DRADataModelRefreshHistory.js";
import { DRASubscriptionTier } from "../models/DRASubscriptionTier.js";
import { DRAPlatformSettings } from "../models/DRAPlatformSettings.js";
import { DRAAccountCancellation } from "../models/DRAAccountCancellation.js";
import { DRAMongoDBSyncHistory } from "../models/DRAMongoDBSyncHistory.js";
import { SyncHistory } from "../entities/SyncHistory.js";
import { DRACampaign } from '../models/DRACampaign.js';
import { DRACampaignChannel } from '../models/DRACampaignChannel.js';
import { DRACampaignOfflineData } from '../models/DRACampaignOfflineData.js';
import { DRAAIJoinSuggestion } from '../models/DRAAIJoinSuggestion.js';
import { DRAOrganization } from '../models/DRAOrganization.js';
import { DRAWorkspace } from '../models/DRAWorkspace.js';
import { DRAOrganizationMember } from '../models/DRAOrganizationMember.js';
import { DRAWorkspaceMember } from '../models/DRAWorkspaceMember.js';
import { DRAOrganizationSubscription } from '../models/DRAOrganizationSubscription.js';
import { DRAAIInsightReport } from '../models/DRAAIInsightReport.js';
import { DRAAIInsightMessage } from '../models/DRAAIInsightMessage.js';
import { DRANotification } from '../models/DRANotification.js';
import { DRAEmailPreferences } from '../models/DRAEmailPreferences.js';
import { DRAScheduledBackupRun } from '../models/DRAScheduledBackupRun.js';
import { DRAReport } from '../models/DRAReport.js';
import { DRAReportItem } from '../models/DRAReportItem.js';
import { DRAReportShareKey } from '../models/DRAReportShareKey.js';
import dotenv from 'dotenv';
dotenv.config();

const host = process.env.POSTGRESQL_HOST_MIGRATIONS;
const port = parseInt(process.env.POSTGRESQL_PORT_MIGRATIONS);
const database = process.env.POSTGRESQL_DB_NAME;
const username = process.env.POSTGRESQL_USERNAME;
const password = process.env.POSTGRESQL_PASSWORD;

// Single DataSource export - use default import in code: import PostgresDSMigrations from '...'
export default new DataSource({
    type: "postgres",
    host: host,
    port: port,
    username: username,
    password: password,
    database: database,
    synchronize: false,
    logging: true,
    entities: [DRAUsersPlatform, DRAProject, DRAProjectMember, DRAProjectInvitation, DRAVerificationCode, DRADataSource, DRADataModel, DRADataModelSource, DRATableMetadata, DRACrossSourceJoinCatalog, DRAEnterpriseQuery, DRADashboard, DRAArticle, DRAArticleCategory, DRAArticleVersion, DRACategory, DRASitemapEntry, DRADashboardExportMetaData, DRAAIDataModelConversation, DRAAIDataModelMessage, DRAAIInsightReport, DRAAIInsightMessage, DRADataModelRefreshHistory, DRAScheduledBackupRun, DRASubscriptionTier, DRAPlatformSettings, DRAAccountCancellation, DRAEmailPreferences, DRANotification, DRAMongoDBSyncHistory, SyncHistory, DRACampaign, DRACampaignChannel, DRACampaignOfflineData, DRAAIJoinSuggestion, DRAReport, DRAReportItem, DRAReportShareKey, DRAOrganization, DRAWorkspace, DRAOrganizationMember, DRAWorkspaceMember, DRAOrganizationSubscription],
    subscribers: [],
    migrations: ['./src/migrations/*.ts'],
});