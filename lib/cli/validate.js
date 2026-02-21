/**
 * Environment validation and pre-flight checks
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');

/**
 * Required environment variables by context
 */
const REQUIRED_VARS = {
  root: [
    'POSTGRES_USER',
    'POSTGRES_PASSWORD',
    'POSTGRES_DB',
    'REDIS_PASSWORD'
  ],
  backend: [
    'NODE_ENV',
    'PUBLIC_BACKEND_URL',
    'FRONTEND_URL',
    'PORT',
    'JWT_SECRET',
    'PASSWORD_SALT',
    'ENCRYPTION_KEY',
    'ENCRYPTION_ENABLED',
    'DB_DRIVER',
    'POSTGRESQL_HOST',
    'POSTGRESQL_PORT',
    'POSTGRESQL_USERNAME',
    'POSTGRESQL_PASSWORD',
    'POSTGRESQL_DB_NAME',
    'POSTGRESQL_HOST_MIGRATIONS',
    'POSTGRESQL_PORT_MIGRATIONS'
  ],
  frontend: [
    'NUXT_API_URL',
    'RECAPTCHA_SITE_KEY'
  ]
};

/**
 * Parse .env file into key-value pairs
 */
function parseEnvFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const env = {};
    
    content.split('\n').forEach(line => {
      // Skip comments and empty lines
      if (line.trim() === '' || line.trim().startsWith('#')) {
        return;
      }
      
      // Parse KEY=VALUE
      const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (match) {
        const [, key, value] = match;
        env[key] = value.trim();
      }
    });
    
    return env;
  } catch (error) {
    return null;
  }
}

/**
 * Validate a single environment file
 */
function validateEnvFile(context, envPath) {
  const env = parseEnvFile(envPath);
  
  if (!env) {
    return {
      valid: false,
      missing: REQUIRED_VARS[context],
      empty: [],
      errors: [`Failed to read ${envPath}`]
    };
  }
  
  const missing = [];
  const empty = [];
  
  REQUIRED_VARS[context].forEach(varName => {
    if (!(varName in env)) {
      missing.push(varName);
    } else if (env[varName] === '' || env[varName] === 'changeme') {
      empty.push(varName);
    }
  });
  
  return {
    valid: missing.length === 0 && empty.length === 0,
    missing,
    empty,
    errors: []
  };
}

/**
 * Run comprehensive pre-flight validation
 */
async function runPreflightCheck() {
  console.log(chalk.bold.cyan('\n🔍 Running Pre-flight Validation...\n'));
  
  const results = {
    root: null,
    backend: null,
    frontend: null
  };
  
  let allValid = true;
  
  // Check root .env
  const rootSpinner = ora('Validating root .env').start();
  const rootPath = path.join(process.cwd(), '.env');
  
  if (!fs.existsSync(rootPath)) {
    rootSpinner.fail(chalk.red('Root .env not found'));
    results.root = { valid: false, missing: REQUIRED_VARS.root, empty: [], errors: ['File not found'] };
    allValid = false;
  } else {
    results.root = validateEnvFile('root', rootPath);
    if (results.root.valid) {
      rootSpinner.succeed(chalk.green('Root .env valid'));
    } else {
      rootSpinner.fail(chalk.red('Root .env invalid'));
      allValid = false;
    }
  }
  
  // Check backend .env
  const backendSpinner = ora('Validating backend/.env').start();
  const backendPath = path.join(process.cwd(), 'backend', '.env');
  
  if (!fs.existsSync(backendPath)) {
    backendSpinner.fail(chalk.red('Backend .env not found'));
    results.backend = { valid: false, missing: REQUIRED_VARS.backend, empty: [], errors: ['File not found'] };
    allValid = false;
  } else {
    results.backend = validateEnvFile('backend', backendPath);
    if (results.backend.valid) {
      backendSpinner.succeed(chalk.green('Backend .env valid'));
    } else {
      backendSpinner.fail(chalk.red('Backend .env invalid'));
      allValid = false;
    }
  }
  
  // Check frontend .env
  const frontendSpinner = ora('Validating frontend/.env').start();
  const frontendPath = path.join(process.cwd(), 'frontend', '.env');
  
  if (!fs.existsSync(frontendPath)) {
    frontendSpinner.fail(chalk.red('Frontend .env not found'));
    results.frontend = { valid: false, missing: REQUIRED_VARS.frontend, empty: [], errors: ['File not found'] };
    allValid = false;
  } else {
    results.frontend = validateEnvFile('frontend', frontendPath);
    if (results.frontend.valid) {
      frontendSpinner.succeed(chalk.green('Frontend .env valid'));
    } else {
      frontendSpinner.fail(chalk.red('Frontend .env invalid'));
      allValid = false;
    }
  }
  
  // Display detailed errors
  console.log();
  if (!allValid) {
    console.log(chalk.yellow('⚠️  Validation Issues Found:\n'));
    
    ['root', 'backend', 'frontend'].forEach(context => {
      const result = results[context];
      if (!result.valid) {
        console.log(chalk.bold(`${context.charAt(0).toUpperCase() + context.slice(1)}:`));
        
        if (result.errors.length > 0) {
          result.errors.forEach(err => {
            console.log(chalk.red(`  ✗ ${err}`));
          });
        }
        
        if (result.missing.length > 0) {
          console.log(chalk.yellow(`  Missing variables (${result.missing.length}):`));
          result.missing.forEach(varName => {
            console.log(chalk.gray(`    - ${varName}`));
          });
        }
        
        if (result.empty.length > 0) {
          console.log(chalk.yellow(`  Empty/placeholder variables (${result.empty.length}):`));
          result.empty.forEach(varName => {
            console.log(chalk.gray(`    - ${varName}`));
          });
        }
        
        console.log();
      }
    });
    
    console.log(chalk.cyan('💡 Run "npm run setup" to generate valid .env files\n'));
  } else {
    console.log(chalk.green.bold('✅ All environment files are valid!\n'));
  }
  
  return { success: allValid, results };
}

/**
 * Quick validation (no spinner output, just return result)
 */
function quickValidate() {
  const rootPath = path.join(process.cwd(), '.env');
  const backendPath = path.join(process.cwd(), 'backend', '.env');
  const frontendPath = path.join(process.cwd(), 'frontend', '.env');
  
  const rootValid = fs.existsSync(rootPath) && validateEnvFile('root', rootPath).valid;
  const backendValid = fs.existsSync(backendPath) && validateEnvFile('backend', backendPath).valid;
  const frontendValid = fs.existsSync(frontendPath) && validateEnvFile('frontend', frontendPath).valid;
  
  return {
    valid: rootValid && backendValid && frontendValid,
    root: rootValid,
    backend: backendValid,
    frontend: frontendValid
  };
}

module.exports = {
  runPreflightCheck,
  quickValidate,
  validateEnvFile,
  REQUIRED_VARS
};
