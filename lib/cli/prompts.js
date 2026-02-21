/**
 * Interactive Prompts
 * 
 * Inquirer prompt definitions for configuration collection.
 */

const inquirer = require('inquirer');
const { validatePassword, validateEmail, validatePort, validateURL } = require('./validators.js');
const { generateEncryptionKey, generateJWTSecret, generateSecurePassword } = require('./generators.js');
const { ENVIRONMENT_DEFAULTS, EMAIL_PROVIDERS, CRON_PRESETS } = require('./constants.js');

/**
 * Prompt for environment type selection
 */
async function promptEnvironmentType() {
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'environmentType',
      message: 'Select environment type:',
      choices: [
        { name: 'Development (local development)', value: 'development' },
        { name: 'Docker (containerized development)', value: 'docker' },
        { name: 'Production', value: 'production' }
      ],
      default: 'development'
    }
  ]);
  return answers.environmentType;
}

/**
 * Prompt for setup mode (full vs express)
 */
async function promptSetupMode() {
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'setupMode',
      message: 'Setup mode:',
      choices: [
        { name: 'Express - Quick setup with sensible defaults', value: 'express' },
        { name: 'Custom - Configure all settings manually', value: 'custom' }
      ],
      default: 'express'
    }
  ]);
  return answers.setupMode;
}

/**
 * Prompt for database configuration
 */
async function promptDatabaseConfig(environmentType, isExpress = false) {
  const defaults = ENVIRONMENT_DEFAULTS[environmentType].postgres;
  
  if (isExpress) {
    // Express mode: use defaults with generated password
    return {
      host: defaults.host,
      port: defaults.dockerPort,
      hostMigrations: defaults.hostMigrations,
      portMigrations: defaults.localPort,
      database: defaults.database,
      user: defaults.user,
      password: generateSecurePassword()
    };
  }
  
  // Custom mode: prompt for all values
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'host',
      message: 'PostgreSQL host (for app connection):',
      default: defaults.host
    },
    {
      type: 'input',
      name: 'port',
      message: 'PostgreSQL port (for app connection):',
      default: defaults.dockerPort,
      validate: validatePort
    },
    {
      type: 'input',
      name: 'hostMigrations',
      message: 'PostgreSQL host (for migrations):',
      default: defaults.hostMigrations
    },
    {
      type: 'input',
      name: 'portMigrations',
      message: 'PostgreSQL port (for migrations):',
      default: defaults.localPort,
      validate: validatePort
    },
    {
      type: 'input',
      name: 'database',
      message: 'Database name:',
      default: defaults.database
    },
    {
      type: 'input',
      name: 'user',
      message: 'Database user:',
      default: defaults.user
    },
    {
      type: 'password',
      name: 'password',
      message: 'Database password:',
      validate: validatePassword
    }
  ]);
  
  return answers;
}

/**
 * Prompt for security configuration
 */
async function promptSecurityConfig(isExpress = false) {
  if (isExpress) {
    // Express mode: auto-generate all secrets
    return {
      encryptionKey: generateEncryptionKey(),
      jwtSecret: generateJWTSecret(),
      sessionSecret: generateJWTSecret(),
      passwordSalt: '13',
      recaptchaSecret: '',
      recaptchaSiteKey: ''
    };
  }
  
  // Custom mode: prompt with auto-generated defaults
  const defaultEncryptionKey = generateEncryptionKey();
  const defaultJwtSecret = generateJWTSecret();
  const defaultSessionSecret = generateJWTSecret();
  
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'encryptionKey',
      message: 'Encryption key (leave blank to auto-generate):',
      default: defaultEncryptionKey
    },
    {
      type: 'input',
      name: 'jwtSecret',
      message: 'JWT secret (leave blank to auto-generate):',
      default: defaultJwtSecret
    },
    {
      type: 'input',
      name: 'sessionSecret',
      message: 'Session secret (leave blank to auto-generate):',
      default: defaultSessionSecret
    },
    {
      type: 'input',
      name: 'passwordSalt',
      message: 'Password salt rounds:',
      default: '13',
      validate: (value) => {
        const num = parseInt(value);
        return num >= 10 && num <= 15 || 'Salt rounds must be between 10 and 15';
      }
    },
    {
      type: 'input',
      name: 'recaptchaSecret',
      message: 'reCAPTCHA secret key (optional):',
      default: ''
    },
    {
      type: 'input',
      name: 'recaptchaSiteKey',
      message: 'reCAPTCHA site key (optional):',
      default: ''
    }
  ]);
  
  return answers;
}

/**
 * Prompt for email service configuration
 */
async function promptEmailConfig(isExpress = false) {
  if (isExpress) {
    // Express mode: use Mailtrap defaults
    return {
      provider: 'mailtrap',
      host: EMAIL_PROVIDERS.mailtrap.host,
      port: EMAIL_PROVIDERS.mailtrap.port,
      user: '',
      password: '',
      from: 'noreply@dataresearchanalysis.com',
      replyTo: 'hello@dataresearchanalysis.com'
    };
  }
  
  // Custom mode: prompt for email provider and credentials
  const providerAnswer = await inquirer.prompt([
    {
      type: 'list',
      name: 'provider',
      message: 'Email service provider:',
      choices: [
        { name: 'Mailtrap (development)', value: 'mailtrap' },
        { name: 'SendGrid', value: 'sendgrid' },
        { name: 'Amazon SES', value: 'ses' },
        { name: 'Custom SMTP', value: 'custom' }
      ],
      default: 'mailtrap'
    }
  ]);
  
  let host, port;
  if (providerAnswer.provider !== 'custom') {
    host = EMAIL_PROVIDERS[providerAnswer.provider].host;
    port = EMAIL_PROVIDERS[providerAnswer.provider].port;
  }
  
  const credentialsAnswers = await inquirer.prompt([
    {
      type: 'input',
      name: 'host',
      message: 'SMTP host:',
      default: host,
      when: () => providerAnswer.provider === 'custom'
    },
    {
      type: 'input',
      name: 'port',
      message: 'SMTP port:',
      default: port || 587,
      validate: validatePort,
      when: () => providerAnswer.provider === 'custom'
    },
    {
      type: 'input',
      name: 'user',
      message: 'SMTP username:',
      default: ''
    },
    {
      type: 'password',
      name: 'password',
      message: 'SMTP password:',
      default: ''
    },
    {
      type: 'input',
      name: 'from',
      message: 'From email address:',
      default: 'noreply@dataresearchanalysis.com',
      validate: validateEmail
    },
    {
      type: 'input',
      name: 'replyTo',
      message: 'Reply-to email address:',
      default: 'hello@dataresearchanalysis.com',
      validate: validateEmail
    }
  ]);
  
  return {
    provider: providerAnswer.provider,
    host: host || credentialsAnswers.host,
    port: port || credentialsAnswers.port,
    user: credentialsAnswers.user,
    password: credentialsAnswers.password,
    from: credentialsAnswers.from,
    replyTo: credentialsAnswers.replyTo
  };
}

/**
 * Prompt for server URLs and ports
 */
async function promptServerConfig(environmentType, isExpress = false) {
  const defaults = ENVIRONMENT_DEFAULTS[environmentType];
  
  if (isExpress) {
    // Express mode: use defaults
    return {
      backendUrl: defaults.backend.url,
      backendPort: defaults.backend.localPort,
      frontendUrl: defaults.frontend.url,
      frontendPort: defaults.frontend.localPort,
      nodeEnv: defaults.backend.nodeEnv
    };
  }
  
  // Custom mode: prompt for URLs and ports
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'backendUrl',
      message: 'Backend URL:',
      default: defaults.backend.url,
      validate: validateURL
    },
    {
      type: 'input',
      name: 'backendPort',
      message: 'Backend port:',
      default: defaults.backend.localPort,
      validate: validatePort
    },
    {
      type: 'input',
      name: 'frontendUrl',
      message: 'Frontend URL:',
      default: defaults.frontend.url,
      validate: validateURL
    },
    {
      type: 'input',
      name: 'frontendPort',
      message: 'Frontend port:',
      default: defaults.frontend.localPort,
      validate: validatePort
    },
    {
      type: 'list',
      name: 'nodeEnv',
      message: 'Node environment:',
      choices: ['development', 'production'],
      default: defaults.backend.nodeEnv
    }
  ]);
  
  return answers;
}

/**
 * Prompt for Redis configuration
 */
async function promptRedisConfig(environmentType, isExpress = false) {
  const defaults = ENVIRONMENT_DEFAULTS[environmentType].redis;
  
  if (isExpress) {
    // Express mode: use defaults
    return {
      host: defaults.host,
      port: defaults.dockerPort,
      password: defaults.password || generateSecurePassword()
    };
  }
  
  // Custom mode: prompt for Redis settings
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'host',
      message: 'Redis host:',
      default: defaults.host
    },
    {
      type: 'input',
      name: 'port',
      message: 'Redis port:',
      default: defaults.dockerPort,
      validate: validatePort
    },
    {
      type: 'password',
      name: 'password',
      message: 'Redis password (leave blank for none):',
      default: defaults.password || ''
    }
  ]);
  
  return answers;
}

/**
 * Prompt for backup configuration
 */
async function promptBackupConfig(isExpress = false) {
  const { BACKUP_DEFAULTS } = require('./constants.js');
  
  if (isExpress) {
    // Express mode: use defaults
    return {
      enabled: BACKUP_DEFAULTS.enabled,
      schedule: BACKUP_DEFAULTS.schedule,
      retentionDays: BACKUP_DEFAULTS.retentionDays,
      systemUserId: BACKUP_DEFAULTS.systemUserId,
      maxSizeMB: BACKUP_DEFAULTS.maxSizeMB,
      autoCleanup: BACKUP_DEFAULTS.autoCleanup
    };
  }
  
  // Custom mode: prompt for backup settings
  const answers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'enabled',
      message: 'Enable automatic database backups?',
      default: BACKUP_DEFAULTS.enabled
    },
    {
      type: 'list',
      name: 'schedule',
      message: 'Backup schedule:',
      choices: Object.keys(CRON_PRESETS).map(key => ({
        name: `${key} (${CRON_PRESETS[key]})`,
        value: CRON_PRESETS[key]
      })),
      default: BACKUP_DEFAULTS.schedule,
      when: (answers) => answers.enabled
    },
    {
      type: 'input',
      name: 'retentionDays',
      message: 'Backup retention period (days):',
      default: BACKUP_DEFAULTS.retentionDays,
      validate: (value) => {
        const num = parseInt(value);
        return num > 0 || 'Retention days must be greater than 0';
      },
      when: (answers) => answers.enabled
    },
    {
      type: 'input',
      name: 'maxSizeMB',
      message: 'Maximum backup file size (MB):',
      default: BACKUP_DEFAULTS.maxSizeMB,
      validate: (value) => {
        const num = parseInt(value);
        return num > 0 || 'Max size must be greater than 0';
      },
      when: (answers) => answers.enabled
    },
    {
      type: 'confirm',
      name: 'autoCleanup',
      message: 'Auto-cleanup old backups?',
      default: BACKUP_DEFAULTS.autoCleanup,
      when: (answers) => answers.enabled
    }
  ]);
  
  return {
    enabled: answers.enabled || false,
    schedule: answers.schedule || BACKUP_DEFAULTS.schedule,
    retentionDays: answers.retentionDays || BACKUP_DEFAULTS.retentionDays,
    systemUserId: BACKUP_DEFAULTS.systemUserId,
    maxSizeMB: answers.maxSizeMB || BACKUP_DEFAULTS.maxSizeMB,
    autoCleanup: answers.autoCleanup !== undefined ? answers.autoCleanup : BACKUP_DEFAULTS.autoCleanup
  };
}

/**
 * Prompt for Google services configuration
 */
async function promptGoogleServices(isExpress = false) {
  if (isExpress) {
    // Express mode: skip Google services configuration
    return {
      clientId: '',
      clientSecret: '',
      redirectUri: '',
      adsDevToken: '',
      geminiApiKey: ''
    };
  }
  
  // Custom mode: prompt for Google API credentials
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'clientId',
      message: 'Google OAuth Client ID (optional):',
      default: ''
    },
    {
      type: 'password',
      name: 'clientSecret',
      message: 'Google OAuth Client Secret (optional):',
      default: '',
      when: (answers) => answers.clientId
    },
    {
      type: 'input',
      name: 'redirectUri',
      message: 'Google OAuth Redirect URI (optional):',
      default: '',
      when: (answers) => answers.clientId
    },
    {
      type: 'input',
      name: 'adsDevToken',
      message: 'Google Ads Developer Token (optional):',
      default: ''
    },
    {
      type: 'password',
      name: 'geminiApiKey',
      message: 'Gemini API Key (optional):',
      default: ''
    }
  ]);
  
  return answers;
}

/**
 * Prompt for AWS services configuration
 */
async function promptAWSConfig(isExpress = false) {
  if (isExpress) {
    // Express mode: skip AWS configuration
    return {
      accessKeyId: '',
      secretAccessKey: '',
      region: 'ap-southeast-1',
      s3ImagesBucket: ''
    };
  }
  
  // Custom mode: prompt for AWS credentials
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'accessKeyId',
      message: 'AWS Access Key ID (optional):',
      default: ''
    },
    {
      type: 'password',
      name: 'secretAccessKey',
      message: 'AWS Secret Access Key (optional):',
      default: '',
      when: (answers) => answers.accessKeyId
    },
    {
      type: 'input',
      name: 'region',
      message: 'AWS Region:',
      default: 'ap-southeast-1',
      when: (answers) => answers.accessKeyId
    },
    {
      type: 'input',
      name: 's3ImagesBucket',
      message: 'S3 Images Bucket Name (optional):',
      default: '',
      when: (answers) => answers.accessKeyId
    }
  ]);
  
  return answers;
}

module.exports = {
  promptEnvironmentType,
  promptSetupMode,
  promptDatabaseConfig,
  promptSecurityConfig,
  promptEmailConfig,
  promptServerConfig,
  promptRedisConfig,
  promptBackupConfig,
  promptGoogleServices,
  promptAWSConfig
};
