/**
 * Utility Functions
 * 
 * Helper functions used throughout the CLI.
 */

const fs = require('fs-extra');
const path = require('path');

/**
 * Check if a file exists
 */
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

/**
 * Detect existing environment setup
 */
function detectEnvironment() {
  const existingRoot = fileExists('.env');
  const existingBackend = fileExists('backend/.env');
  const existingFrontend = fileExists('frontend/.env');

  return {
    isNew: !existingRoot && !existingBackend && !existingFrontend,
    files: {
      root: existingRoot,
      backend: existingBackend,
      frontend: existingFrontend
    }
  };
}

/**
 * Load existing .env file and parse variables
 */
function loadExistingEnv(filePath) {
  if (!fileExists(filePath)) {
    return {};
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const config = {};

  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Parse KEY=VALUE
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      config[key] = value;
    }
  }

  return config;
}

/**
 * Load all existing configuration
 */
function loadExistingConfig() {
  return {
    root: loadExistingEnv('.env'),
    backend: loadExistingEnv('backend/.env'),
    frontend: loadExistingEnv('frontend/.env')
  };
}

/**
 * Get timestamp string for backups
 */
function getTimestamp() {
  const now = new Date();
  return now.toISOString()
    .replace(/[:.]/g, '-')
    .split('T')
    .join('-')
    .slice(0, -5); // Remove milliseconds
}

/**
 * Create backup of existing file
 */
async function createBackup(filePath) {
  if (!fileExists(filePath)) {
    return null;
  }

  const timestamp = getTimestamp();
  const backupPath = `${filePath}.backup.${timestamp}`;
  
  await fs.copy(filePath, backupPath);
  return backupPath;
}

/**
 * Ensure directory exists
 */
async function ensureDir(dirPath) {
  await fs.ensureDir(dirPath);
}

/**
 * Parse boolean from string
 */
function parseBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    return lower === 'true' || lower === 'yes' || lower === '1';
  }
  return false;
}

/**
 * Build configuration object from answers
 */
function buildConfiguration(answers, environmentType) {
  const { ENVIRONMENT_DEFAULTS } = require('./constants');
  const defaults = ENVIRONMENT_DEFAULTS[environmentType] || ENVIRONMENT_DEFAULTS.development;

  return {
    environment: environmentType,
    
    // Root .env configuration
    root: {
      postgres: {
        user: answers.postgresUser || defaults.postgres.user,
        password: answers.postgresPassword,
        database: answers.postgresDatabase || defaults.postgres.database,
        localPort: answers.postgresLocalPort || defaults.postgres.localPort,
        dockerPort: defaults.postgres.dockerPort
      },
      frontend: {
        localPort: answers.frontendPort || defaults.frontend.localPort,
        dockerPort: defaults.frontend.dockerPort
      },
      backend: {
        localPort: answers.backendPort || defaults.backend.localPort,
        dockerPort: defaults.backend.dockerPort
      },
      redis: {
        localPort: answers.redisPort || defaults.redis.localPort,
        dockerPort: defaults.redis.dockerPort,
        password: answers.redisPassword || defaults.redis.password
      }
    },
    
    // Backend .env configuration
    backend: {
      port: answers.backendPort || defaults.backend.localPort,
      publicBackendUrl: answers.publicBackendUrl || defaults.backend.url,
      frontendUrl: answers.frontendUrl || defaults.frontend.url,
      nodeEnv: defaults.backend.nodeEnv,
      
      // Security (will be populated by generators)
      recaptchaSecret: answers.recaptchaSecret,
      jwtSecret: answers.jwtSecret,
      encryptionKey: answers.encryptionKey,
      passwordSalt: 10,
      
      // Database
      postgres: {
        hostMigrations: answers.postgresHostMigrations || defaults.postgres.hostMigrations,
        host: answers.postgresHost || defaults.postgres.host,
        portMigrations: answers.postgresLocalPort || defaults.postgres.localPort,
        port: defaults.postgres.dockerPort,
        username: answers.postgresUser || defaults.postgres.user,
        password: answers.postgresPassword,
        database: answers.postgresDatabase || defaults.postgres.database
      },
      
      // Redis
      redis: {
        host: answers.redisHost || defaults.redis.host,
        port: answers.redisPort || defaults.redis.localPort,
        password: answers.redisPassword || defaults.redis.password
      }
    },
    
    // Frontend .env configuration
    frontend: {
      env: environmentType,
      apiUrl: answers.publicBackendUrl || defaults.backend.url,
      publicSiteUrl: answers.publicSiteUrl || 'https://www.dataresearchanalysis.com',
      port: answers.frontendPort || defaults.frontend.localPort,
      recaptchaSiteKey: answers.recaptchaSiteKey,
      platformEnabled: answers.platformEnabled !== false
    }
  };
}

module.exports = {
  fileExists,
  detectEnvironment,
  loadExistingEnv,
  loadExistingConfig,
  getTimestamp,
  createBackup,
  ensureDir,
  parseBoolean,
  buildConfiguration
};
