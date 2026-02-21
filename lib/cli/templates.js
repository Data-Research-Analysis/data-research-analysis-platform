/**
 * Environment File Templates
 * 
 * Template generators for .env files.
 */

/**
 * Generate root .env template
 */
function generateRootEnv(config) {
  const lines = [];
  
  lines.push('# PostgreSQL Configuration');
  lines.push(`POSTGRESDB_USER=${config.database.user}`);
  lines.push(`POSTGRESDB_ROOT_PASSWORD=${config.database.password}`);
  lines.push(`POSTGRESDB_DATABASE=${config.database.database}`);
  lines.push(`POSTGRESDB_LOCAL_PORT=${config.database.portMigrations || 5434}`);
  lines.push(`POSTGRESDB_DOCKER_PORT=${config.database.port || 5432}`);
  lines.push('');
  
  lines.push('# Frontend Configuration');
  lines.push(`FRONTEND_LOCAL_PORT=${config.server.frontendPort || 3000}`);
  lines.push(`FRONTEND_DOCKER_PORT=${config.server.frontendPort || 3000}`);
  lines.push('');
  
  lines.push('# Backend Configuration');
  lines.push(`BACKEND_LOCAL_PORT=${config.server.backendPort || 3002}`);
  lines.push(`BACKEND_DOCKER_PORT=${config.server.backendPort || 3002}`);
  lines.push('');
  
  // MySQL (placeholder for future compatibility)
  lines.push('# MySQL Configuration (optional)');
  lines.push('MYSQLDB_USER=mysql');
  lines.push('MYSQLDB_ROOT_PASSWORD=mysql');
  lines.push('MYSQLDB_DATABASE=mysql_dra_db');
  lines.push('MYSQLDB_LOCAL_PORT=3307');
  lines.push('MYSQLDB_DOCKER_PORT=3306');
  lines.push('');
  
  // MariaDB (placeholder for future compatibility)
  lines.push('# MariaDB Configuration (optional)');
  lines.push('MARIADB_USER=mariadb_user');
  lines.push('MARIADB_ROOT_PASSWORD=mariadb_password');
  lines.push('MARIADB_DATABASE=mariadb_dra_db');
  lines.push('MARIADB_LOCAL_PORT=3308');
  lines.push('MARIADB_DOCKER_PORT=3306');
  lines.push('');
  
  // Redis Configuration
  lines.push('# Redis Configuration');
  lines.push(`REDIS_LOCAL_PORT=${config.redis.port || 6379}`);
  lines.push(`REDIS_DOCKER_PORT=${config.redis.port || 6379}`);
  if (config.redis.password) {
    lines.push(`REDIS_PASSWORD=${config.redis.password}`);
  }
  lines.push('');
  
  // Database Backup Configuration
  lines.push('# Database Backup Configuration');
  lines.push(`POSTGRESDB_HOST=${config.database.host}`);
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Generate backend/.env template
 */
function generateBackendEnv(config) {
  const lines = [];
  
  lines.push('# Node Environment');
  lines.push(`NODE_ENV=${config.server.nodeEnv || 'development'}`);
  lines.push(`PUBLIC_BACKEND_URL=${config.server.backendUrl}`);
  lines.push(`FRONTEND_URL=${config.server.frontendUrl}`);
  lines.push(`PORT=${config.server.backendPort || 3002}`);
  lines.push('');
  
  // Security Configuration
  lines.push('# Security Configuration');
  if (config.security.recaptchaSecret) {
    lines.push(`RECAPTCHA_SECRET=${config.security.recaptchaSecret}`);
  }
  lines.push(`JWT_SECRET=${config.security.jwtSecret}`);
  lines.push(`PASSWORD_SALT=${config.security.passwordSalt || 13}`);
  lines.push(`ENCRYPTION_KEY=${config.security.encryptionKey}`);
  lines.push('ENCRYPTION_ENABLED=true');
  lines.push('');
  
  // Database Configuration
  lines.push('# Database Configuration');
  lines.push('DB_DRIVER=postgres');
  lines.push(`POSTGRESQL_HOST_MIGRATIONS=${config.database.hostMigrations}`);
  lines.push(`POSTGRESQL_HOST=${config.database.host}`);
  lines.push(`POSTGRESQL_PORT_MIGRATIONS=${config.database.portMigrations || 5434}`);
  lines.push(`POSTGRESQL_PORT=${config.database.port || 5432}`);
  lines.push(`POSTGRESQL_USERNAME=${config.database.user}`);
  lines.push(`POSTGRESQL_PASSWORD=${config.database.password}`);
  lines.push(`POSTGRESQL_DB_NAME=${config.database.database}`);
  lines.push('');
  
  // Email Configuration
  lines.push('# Email Configuration');
  lines.push(`MAIL_DRIVER=${config.email.provider || 'mailtrap'}`);
  lines.push(`MAIL_HOST=${config.email.host}`);
  lines.push(`MAIL_PORT=${config.email.port}`);
  if (config.email.user) {
    lines.push(`MAIL_USER=${config.email.user}`);
  }
  if (config.email.password) {
    lines.push(`MAIL_PASS=${config.email.password}`);
  }
  lines.push(`MAIL_FROM=${config.email.from}`);
  lines.push(`MAIL_REPLY_TO=${config.email.replyTo}`);
  lines.push('');
  
  // Redis Configuration
  lines.push('# Redis Configuration');
  lines.push(`REDIS_HOST=${config.redis.host}`);
  lines.push(`REDIS_PORT=${config.redis.port || 6379}`);
  lines.push('DATA_DRIVER=redis');
  lines.push('');
  
  // Socket.IO Configuration
  lines.push('# Socket.IO Configuration');
  lines.push(`SOCKETIO_CLIENT_URL=${config.server.frontendUrl.replace(/:\d+$/, '')}`);
  lines.push(`SOCKETIO_CLIENT_PORT=${config.server.frontendPort || 3000}`);
  lines.push(`SOCKETIO_SERVER_URL=${config.server.backendUrl.replace(/:\d+$/, '')}`);
  lines.push(`SOCKETIO_SERVER_PORT=${config.server.backendPort || 3002}`);
  lines.push('QUEUE_STATUS_INTERVAL=5000');
  lines.push('NUM_WORKERS=3');
  lines.push('');
  
  // AWS Configuration
  if (config.aws && config.aws.accessKeyId) {
    lines.push('# AWS Configuration');
    lines.push(`AWS_ACCESS_KEY_ID=${config.aws.accessKeyId}`);
    lines.push(`AWS_SECRET_ACCESS_KEY=${config.aws.secretAccessKey}`);
    lines.push(`AWS_S3_REGION=${config.aws.region || 'ap-southeast-1'}`);
    if (config.aws.s3ImagesBucket) {
      lines.push(`AWS_S3_IMAGES_EXTRACT_BUCKET=${config.aws.s3ImagesBucket}`);
    }
    lines.push('IMAGE_PAGE_WIDTH=4000');
    lines.push('IMAGE_PAGE_HEIGHT=6000');
    lines.push('');
  }
  
  // Gemini AI Configuration
  if (config.google && config.google.geminiApiKey) {
    lines.push('# Gemini AI Configuration');
    lines.push(`GEMINI_API_KEY=${config.google.geminiApiKey}`);
    lines.push('');
  }
  
  // Google OAuth Configuration
  if (config.google && config.google.clientId) {
    lines.push('# Google OAuth Configuration');
    lines.push(`GOOGLE_CLIENT_ID=${config.google.clientId}`);
    lines.push(`GOOGLE_CLIENT_SECRET=${config.google.clientSecret}`);
    lines.push(`GOOGLE_REDIRECT_URI=${config.google.redirectUri}`);
    if (config.google.adsDevToken) {
      lines.push(`GOOGLE_ADS_DEVELOPER_TOKEN=${config.google.adsDevToken}`);
    }
    lines.push('');
  }
  
  // Backup Configuration
  if (config.backup && config.backup.enabled) {
    lines.push('# Scheduled Backup Configuration');
    lines.push(`BACKUP_SCHEDULE=${config.backup.schedule}`);
    lines.push(`BACKUP_ENABLED=${config.backup.enabled}`);
    lines.push(`BACKUP_RETENTION_DAYS=${config.backup.retentionDays}`);
    lines.push(`BACKUP_SYSTEM_USER_ID=${config.backup.systemUserId}`);
    lines.push(`BACKUP_MAX_SIZE_MB=${config.backup.maxSizeMB}`);
    lines.push(`BACKUP_AUTO_CLEANUP=${config.backup.autoCleanup}`);
    lines.push('BACKUP_STORAGE_PATH=./backend/private/backups');
    lines.push('');
  }
  
  // Meta Ads Configuration (placeholder)
  lines.push('# Meta Ads Configuration (optional)');
  lines.push('# META_APP_ID=');
  lines.push('# META_APP_SECRET=');
  lines.push('# META_REDIRECT_URI=');
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Generate frontend/.env template
 */
function generateFrontendEnv(config) {
  const lines = [];
  
  lines.push('# Nuxt Environment');
  lines.push(`NUXT_ENV=${config.server.nodeEnv || 'development'}`);
  lines.push(`NUXT_API_URL=${config.server.backendUrl}`);
  lines.push(`NUXT_PUBLIC_SITE_URL=${config.server.frontendUrl}`);
  lines.push('');
  
  // reCAPTCHA Configuration
  if (config.security.recaptchaSiteKey) {
    lines.push('# reCAPTCHA Configuration');
    lines.push(`NUXT_RECAPTCHA_SITE_KEY=${config.security.recaptchaSiteKey}`);
    lines.push('');
  }
  
  // Server Configuration
  lines.push('# Server Configuration');
  lines.push(`NUXT_PORT=${config.server.frontendPort || 3000}`);
  lines.push('');
  
  // Analytics (placeholder)
  lines.push('# Analytics Configuration (optional)');
  lines.push('# NUXT_GA_ID=');
  lines.push('');
  
  // Platform Features
  lines.push('# Platform Features');
  lines.push('NUXT_PLATFORM_ENABLED=true');
  lines.push('NUXT_PLATFORM_REGISTRATION_ENABLED=true');
  lines.push('NUXT_PLATFORM_LOGIN_ENABLED=true');
  lines.push('');
  
  // Socket.IO Configuration
  lines.push('# Socket.IO Configuration');
  lines.push(`NUXT_SOCKETIO_SERVER_URL=${config.server.backendUrl.replace(/:\d+$/, '')}`);
  lines.push(`NUXT_SOCKETIO_SERVER_PORT=${config.server.backendPort || 3002}`);
  lines.push('');
  
  return lines.join('\n');
}

module.exports = {
  generateRootEnv,
  generateBackendEnv,
  generateFrontendEnv
};


module.exports = {
  generateRootEnv,
  generateBackendEnv,
  generateFrontendEnv
};
