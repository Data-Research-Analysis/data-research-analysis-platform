import "reflect-metadata";
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { createServer } from 'http';
import { UtilityService } from './services/UtilityService.js';
import { SocketIODriver } from './drivers/SocketIODriver.js';
import { DBDriver } from './drivers/DBDriver.js';
import { generalApiLimiter } from './middleware/rateLimit.js';
import home from './routes/home.js';
import auth from './routes/auth.js';
import user from './routes/user.js';
import project from './routes/project.js';
import project_members from './routes/project_members.js';
import project_invitations from './routes/project_invitations.js';
import data_source from './routes/data_source.js';
import data_model from './routes/data_model.js';
import data_model_refresh from './routes/data_model_refresh.js';
import dashboard from './routes/dashboard.js';
import dashboard_query from './routes/dashboard_query.js';
import ai_data_modeler from './routes/ai_data_modeler.js';
import oauth from './routes/oauth.js';
import google_analytics from './routes/google_analytics.js';
import google_ad_manager from './routes/google_ad_manager.js';
import google_ads from './routes/google_ads.js';
import performance from './routes/performance.js';
import article from './routes/admin/article.js';
import category from './routes/admin/category.js';
import image from './routes/admin/image.js';
import private_beta_users from './routes/admin/private_beta_users.js';
import users from './routes/admin/users.js';
import database from './routes/admin/database.js';
import scheduled_backups from './routes/admin/scheduled_backups.js';
import admin_sitemap from './routes/admin/sitemap.js';
import admin_subscription_tiers from './routes/admin/subscription_tiers.js';
import user_subscriptions from './routes/admin/user_subscriptions.js';
import platform_settings from './routes/admin/platform-settings.js';
import account_cancellations from './routes/admin/account-cancellations.js';
import public_article from './routes/article.js';
import sitemap from './routes/sitemap.js';
import subscription from './routes/subscription.js';
import email_preferences from './routes/email_preferences.js';
import notifications from './routes/notifications.js';
import account from './routes/account.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

console.log('Starting up Data Research Analysis API Server');
const app = express();

// Create HTTP server that will be shared between Express and Socket.IO
const httpServer = createServer(app);

// Initialize utility services
await UtilityService.getInstance().initialize();

// Initialize NotificationProcessor with database connection
import { NotificationProcessor } from './processors/NotificationProcessor.js';
import { PostgresDriver } from './drivers/PostgresDriver.js';
import { EDataSourceType } from './types/EDataSourceType.js';
const dbDriver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
const dataSource = await dbDriver.getConcreteDriver();
NotificationProcessor.getInstance().initialize(dataSource);
console.log('✅ Notification processor initialized');

// Initialize OAuth session service (starts cleanup scheduler)
import { OAuthSessionService } from './services/OAuthSessionService.js';
OAuthSessionService.getInstance();
console.log('✅ OAuth session service initialized');

// Initialize scheduled backup service and start scheduler
// Note: Must happen after database initialization
import { ScheduledBackupService } from './services/ScheduledBackupService.js';
const scheduledBackupService = ScheduledBackupService.getInstance();
if (process.env.BACKUP_ENABLED !== 'false') {
    await scheduledBackupService.startScheduler();
}
console.log('✅ Scheduled backup service initialized');

// Initialize data source sync scheduler
import { SchedulerService } from './services/SchedulerService.js';
if (process.env.SYNC_SCHEDULER_ENABLED !== 'false') {
    await SchedulerService.getInstance().initialize();
}
console.log('✅ Data source sync scheduler initialized');

// Start invitation expiration cron job
import { startInvitationExpirationJob } from './jobs/expireInvitations.js';
startInvitationExpirationJob();
console.log('✅ Invitation expiration job started');

// Start account deletion scheduled job
import { ScheduledDeletionJob } from './services/ScheduledDeletionJob.js';
if (process.env.SCHEDULED_DELETION_ENABLED !== 'false') {
    ScheduledDeletionJob.getInstance().start();
    console.log('✅ Scheduled deletion job started');
}


const port = parseInt(UtilityService.getInstance().getConstants('PORT'));
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Trust proxy to get real client IP from X-Forwarded-For header
// This is essential when behind Nuxt SSR, reverse proxies, or load balancers
app.set('trust proxy', true);

app.use(express.json());
app.use(cors());
app.use(bodyParser.urlencoded({ limit: '1000mb', extended: true }));
app.use(bodyParser.json({ limit: '1000mb' }));
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
  next()
});

// Apply global rate limiter to all routes
// Individual routes may have stricter limits
app.use(generalApiLimiter);

app.use('/', home);
app.use('/auth', auth);
app.use('/user', user);
app.use('/project', project);
app.use('/project', project_members);
app.use('/project-invitations', project_invitations);
app.use('/data-source', data_source);
app.use('/data-model', data_model);
app.use('/refresh', data_model_refresh);
app.use('/dashboard', dashboard);
app.use('/dashboard', dashboard_query);
app.use('/ai-data-modeler', ai_data_modeler);
app.use('/oauth', oauth);
app.use('/google-analytics', google_analytics);
app.use('/google-ad-manager', google_ad_manager);
app.use('/google-ads', google_ads);
app.use('/performance', performance);
app.use('/admin/article', article);
app.use('/admin/category', category);
app.use('/admin/image', image);
app.use('/admin/private-beta-users', private_beta_users);
app.use('/admin/users', users);
app.use('/admin/users', user_subscriptions);
app.use('/admin/database', database);
app.use('/admin/scheduled-backups', scheduled_backups);
app.use('/admin/sitemap', admin_sitemap);
app.use('/admin/subscription-tiers', admin_subscription_tiers);
app.use('/admin/platform-settings', platform_settings);
app.use('/admin/account-cancellations', account_cancellations);
app.use('/article', public_article);
app.use('/sitemap.txt', sitemap);
app.use('/subscription', subscription);
app.use('/email-preferences', email_preferences);
app.use('/notifications', notifications);
app.use('/account', account);

app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));
app.use('/', express.static(path.join(__dirname, '../public')));

// Initialize Socket.IO with the shared HTTP server
try {
  await SocketIODriver.getInstance().initialize(httpServer);
  console.log('Socket.IO server initialized successfully');
} catch (error) {
  console.error('Failed to initialize Socket.IO server:', error);
}

// Start the HTTP server (handles both Express and Socket.IO)
httpServer.listen(port, () => {
  console.log(`Data Research Analysis server is running at http://localhost:${port}`);
  console.log(`Socket.IO server is also available on the same port`);
});