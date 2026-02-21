/**
 * Constants and Default Configurations
 * 
 * Centralized configuration values used throughout the setup CLI.
 */

// External Docker volumes (must be created before docker-compose up)
const DOCKER_VOLUMES = [
  'data_research_analysis_postgres_data',
  'data_research_analysis_redis_data'
];

// Default environment configurations by deployment type
const ENVIRONMENT_DEFAULTS = {
  development: {
    postgres: {
      user: 'dra_user',
      database: 'dra_database',
      localPort: 5434,
      dockerPort: 5432,
      hostMigrations: 'localhost',
      host: 'database.dataresearchanalysis.test'
    },
    redis: {
      localPort: 6379,
      dockerPort: 6379,
      host: 'localhost',
      password: ''
    },
    frontend: {
      localPort: 3000,
      dockerPort: 3000,
      url: 'http://localhost:3000'
    },
    backend: {
      localPort: 3002,
      dockerPort: 3002,
      url: 'http://localhost:3002',
      nodeEnv: 'development'
    }
  },
  docker: {
    postgres: {
      user: 'dra_user',
      database: 'dra_database',
      localPort: 5434,
      dockerPort: 5432,
      hostMigrations: 'localhost',
      host: 'database.dataresearchanalysis.test'
    },
    redis: {
      localPort: 6379,
      dockerPort: 6379,
      host: 'redis.dataresearchanalysis.test',
      password: ''
    },
    frontend: {
      localPort: 3000,
      dockerPort: 3000,
      url: 'http://frontend.dataresearchanalysis.test:3000'
    },
    backend: {
      localPort: 3002,
      dockerPort: 3002,
      url: 'http://backend.dataresearchanalysis.test:3002',
      nodeEnv: 'development'
    }
  },
  production: {
    postgres: {
      user: 'dra_user',
      database: 'dra_database',
      localPort: 5432,
      dockerPort: 5432,
      hostMigrations: 'localhost',
      host: 'localhost'
    },
    redis: {
      localPort: 6379,
      dockerPort: 6379,
      host: 'localhost',
      password: '' // Should be set in production
    },
    frontend: {
      localPort: 3000,
      dockerPort: 3000,
      url: 'https://www.dataresearchanalysis.com'
    },
    backend: {
      localPort: 3002,
      dockerPort: 3002,
      url: 'https://api.dataresearchanalysis.com',
      nodeEnv: 'production'
    }
  }
};

// Rate limiting defaults
const RATE_LIMIT_DEFAULTS = {
  enabled: true,
  authWindowMs: 900000,      // 15 minutes
  authMax: 5,
  expensiveWindowMs: 60000,  // 1 minute
  expensiveMax: 10,
  apiWindowMs: 60000,        // 1 minute
  apiMax: 100,
  aiWindowMs: 60000,         // 1 minute
  aiMax: 5,
  oauthWindowMs: 300000,     // 5 minutes
  oauthMax: 10
};

// Backup configuration defaults
const BACKUP_DEFAULTS = {
  enabled: true,
  schedule: '0 0 * * *',     // Daily at midnight
  retentionDays: 30,
  systemUserId: 1,
  maxSizeMB: 500,
  autoCleanup: true,
  storagePath: './backend/private/backups'
};

// Common cron schedule presets
const CRON_PRESETS = {
  'Daily at midnight': '0 0 * * *',
  'Daily at 2 AM': '0 2 * * *',
  'Every 6 hours': '0 */6 * * *',
  'Weekly (Sunday midnight)': '0 0 * * 0',
  'Monthly (1st at midnight)': '0 0 1 * *'
};

// Service health check timeouts
const HEALTH_CHECK = {
  retries: 30,
  minTimeout: 2000,  // 2 seconds
  maxTimeout: 5000   // 5 seconds
};

// Email service providers
const EMAIL_PROVIDERS = {
  mailtrap: {
    host: 'sandbox.smtp.mailtrap.io',
    port: 2525
  },
  sendgrid: {
    host: 'smtp.sendgrid.net',
    port: 587
  },
  ses: {
    host: 'email-smtp.us-east-1.amazonaws.com',
    port: 587
  }
};

export {
  DOCKER_VOLUMES,
  ENVIRONMENT_DEFAULTS,
  RATE_LIMIT_DEFAULTS,
  BACKUP_DEFAULTS,
  CRON_PRESETS,
  HEALTH_CHECK,
  EMAIL_PROVIDERS
};
