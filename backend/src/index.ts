import "reflect-metadata";
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { createServer } from 'http';
import { UtilityService } from './services/UtilityService.js';
import { SocketIODriver } from './drivers/SocketIODriver.js';
import { generalApiLimiter } from './middleware/rateLimit.js';
import home from './routes/home.js';
import auth from './routes/auth.js';
import project from './routes/project.js';
import data_source from './routes/data_source.js';
import data_model from './routes/data_model.js';
import dashboard from './routes/dashboard.js';
import ai_data_modeler from './routes/ai_data_modeler.js';
import oauth from './routes/oauth.js';
import google_analytics from './routes/google_analytics.js';
import google_ad_manager from './routes/google_ad_manager.js';
import performance from './routes/performance.js';
import exports from './routes/exports.js';
import article from './routes/admin/article.js';
import category from './routes/admin/category.js';
import image from './routes/admin/image.js';
import private_beta_users from './routes/admin/private-beta-users.js';
import users from './routes/admin/users.js';
import database from './routes/admin/database.js';
import public_article from './routes/article.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

console.log('Starting up Data Research Analysis API Server');
const app = express();

// Create HTTP server that will be shared between Express and Socket.IO
const httpServer = createServer(app);

// Initialize utility services
await UtilityService.getInstance().initialize();

// Initialize OAuth session service (starts cleanup scheduler)
import { OAuthSessionService } from './services/OAuthSessionService.js';
OAuthSessionService.getInstance();
console.log('✅ OAuth session service initialized');

const port = parseInt(UtilityService.getInstance().getConstants('PORT'));
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
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
app.use('/project', project);
app.use('/data-source', data_source);
app.use('/data-model', data_model);
app.use('/dashboard', dashboard);
app.use('/ai-data-modeler', ai_data_modeler);
app.use('/oauth', oauth);
app.use('/google-analytics', google_analytics);
app.use('/google-ad-manager', google_ad_manager);
app.use('/performance', performance);
app.use('/exports', exports);
app.use('/admin/article', article);
app.use('/admin/category', category);
app.use('/admin/image', image);
app.use('/admin/private-beta-users', private_beta_users);
app.use('/admin/users', users);
app.use('/admin/database', database);
app.use('/article', public_article);

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