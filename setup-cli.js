#!/usr/bin/env node

/**
 * Data Research Analysis Platform - Setup CLI
 * 
 * Interactive CLI tool for complete platform setup:
 * - Environment configuration (.env files)
 * - Docker orchestration (volumes, build, up)
 * - Database initialization (migrations, seeders)
 * - Health monitoring
 */

const chalk = require('chalk');
const ora = require('ora');
const { DOCKER_VOLUMES, ENVIRONMENT_DEFAULTS } = require('./lib/cli/constants.js');
const { detectEnvironment, loadExistingEnv, createBackup, buildConfiguration } = require('./lib/cli/utils.js');
const { generateEncryptionKey, generateJWTSecret, generateSecurePassword } = require('./lib/cli/generators.js');
const {
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
} = require('./lib/cli/prompts.js');
const { writeAllEnvFiles } = require('./lib/cli/writers.js');

// Parse command-line arguments
function parseArguments() {
  const args = process.argv.slice(2);
  
  return {
    help: args.includes('--help') || args.includes('-h'),
    express: args.includes('--express') || args.includes('--quick'),
    configOnly: args.includes('--config-only'),
    dockerOnly: args.includes('--docker-only'),
    update: args.includes('--update'),
    down: args.includes('--down'),
    rebuild: args.includes('--rebuild'),
    health: args.includes('--health'),
    skipMigrations: args.includes('--skip-migrations'),
    skipSeeders: args.includes('--skip-seeders'),
    removeConfig: args.includes('--remove-config'),
    dryRun: args.includes('--dry-run')
  };
}

// Show welcome banner
function showWelcomeBanner() {
  console.log(chalk.cyan(`
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   🚀 Data Research Analysis Platform Setup CLI         │
│                                                         │
│   Complete automated setup: Config → Docker → Ready!   │
│                                                         │
└─────────────────────────────────────────────────────────┘
  `));
}

// Show help message
function showHelp() {
  console.log(chalk.bold('\n📚 Data Research Analysis Platform - Setup CLI\n'));
  
  console.log(chalk.bold('USAGE:'));
  console.log('  npm run setup [options]\n');
  
  console.log(chalk.bold('MODES:'));
  console.log('  npm run setup                  Full setup (config + Docker + DB)');
  console.log('  npm run setup:express          Express mode (minimal prompts)');
  console.log('  npm run setup:config           Config only (skip Docker)');
  console.log('  npm run setup:docker           Docker only (skip config)');
  console.log('  npm run setup:update           Update existing config');
  console.log('  npm run setup:down             Stop containers');
  console.log('  npm run setup:rebuild          Rebuild containers');
  console.log('  npm run setup:health           Health check\n');
  
  console.log(chalk.bold('OPTIONS:'));
  console.log('  --help, -h                     Show this help message');
  console.log('  --express, --quick             Express mode (minimal prompts)');
  console.log('  --config-only                  Only generate .env files');
  console.log('  --docker-only                  Only run Docker operations');
  console.log('  --update                       Update existing configuration');
  console.log('  --down                         Stop and remove containers');
  console.log('  --rebuild                      Rebuild Docker images');
  console.log('  --health                       Run health check');
  console.log('  --skip-migrations              Skip database migrations');
  console.log('  --skip-seeders                 Skip database seeders');
  console.log('  --remove-config                Remove .env files on teardown');
  console.log('  --dry-run                      Show what would happen\n');
  
  console.log(chalk.bold('EXAMPLES:'));
  console.log('  npm run setup                  # Full interactive setup');
  console.log('  npm run setup:express          # Quick setup with defaults');
  console.log('  npm run setup:health           # Check system health');
  console.log('  npm run setup:down             # Stop all containers\n');
  
  console.log(chalk.yellow('💡 Tip: External Docker volumes are never automatically deleted.'));
  console.log(chalk.gray('   To remove volumes manually: docker volume rm <volume_name>\n'));
}

// Show configuration preview
function showConfigPreview(config, mode = 'full') {
  console.log(chalk.bold.cyan('\n📋 Configuration Preview:\n'));
  
  // Environment mode
  console.log(chalk.bold('Environment:'), chalk.yellow(config.mode || 'development'));
  
  // Database settings
  if (config.database) {
    console.log(chalk.bold('\n🗄️  Database:'));
    console.log(`  Host: ${config.database.host || 'localhost'}`);
    console.log(`  Port: ${config.database.port || 5432}`);
    console.log(`  Database: ${config.database.name || 'data_research_analysis'}`);
    console.log(`  User: ${config.database.user || 'dra_user'}`);
    console.log(`  Password: ${chalk.gray('••••••••')}`);
  }
  
  // Security settings
  if (config.security) {
    console.log(chalk.bold('\n🔐 Security:'));
    console.log(`  Encryption Key: ${config.security.encryptionKey ? chalk.green('Generated ✓') : chalk.red('Missing ✗')}`);
    console.log(`  JWT Secret: ${config.security.jwtSecret ? chalk.green('Generated ✓') : chalk.red('Missing ✗')}`);
    console.log(`  Session Secret: ${config.security.sessionSecret ? chalk.green('Generated ✓') : chalk.red('Missing ✗')}`);
  }
  
  // Server settings
  if (config.server) {
    console.log(chalk.bold('\n🌐 Server:'));
    console.log(`  Backend URL: ${config.server.backendUrl || 'http://localhost:3002'}`);
    console.log(`  Frontend URL: ${config.server.frontendUrl || 'http://localhost:3000'}`);
    console.log(`  API Port: ${config.server.apiPort || 3002}`);
  }
  
  // Docker volumes
  if (mode === 'full' || mode === 'docker') {
    console.log(chalk.bold('\n🐋 Docker Volumes:'));
    DOCKER_VOLUMES.forEach(volumeName => {
      console.log(`  - ${chalk.cyan(volumeName)}`);
    });
  }
  
  console.log(); // Empty line
}

// Main entry point
async function main() {
  try {
    const flags = parseArguments();
    
    // Show help
    if (flags.help) {
      showHelp();
      return;
    }
    
    // Health check mode
    if (flags.health) {
      console.log(chalk.yellow('\n🏥 Health check mode - Coming soon in Phase 6!\n'));
      return;
    }
    
    // Teardown mode
    if (flags.down) {
      console.log(chalk.yellow('\n🔽 Teardown mode - Coming soon in Phase 4!\n'));
      return;
    }
    
    // Rebuild mode
    if (flags.rebuild) {
      console.log(chalk.yellow('\n🔨 Rebuild mode - Coming soon in Phase 4!\n'));
      return;
    }
    
    // Default: Full setup or specific mode
    showWelcomeBanner();
    
    // Step 1: Detect existing environment
    const spinner = ora('Detecting existing environment...').start();
    const env = detectEnvironment();
    spinner.succeed('Environment detection complete');
    
    // Show environment status
    if (!env.isNew) {
      console.log(chalk.yellow('\n⚠️  Existing environment detected:'));
      if (env.files.root) console.log(chalk.gray('  - Root .env found'));
      if (env.files.backend) console.log(chalk.gray('  - Backend .env found'));
      if (env.files.frontend) console.log(chalk.gray('  - Frontend .env found'));
      
      if (!flags.update && !flags.dryRun) {
        console.log(chalk.yellow('\n💡 Use --update to modify existing configuration'));
        console.log(chalk.yellow('💡 Use --dry-run to preview changes\n'));
        return;
      }
    }
    
    // Step 2: Determine mode and environment type
    let environmentType = 'development';
    let setupMode = 'express';
    let isExpress = true;
    
    if (flags.express) {
      setupMode = 'express';
      isExpress = true;
      console.log(chalk.cyan('\n⚡ Express mode - using sensible defaults\n'));
    } else if (flags.configOnly) {
      console.log(chalk.cyan('\n📝 Config-only mode\n'));
    } else if (flags.dockerOnly) {
      console.log(chalk.cyan('\n🐋 Docker-only mode\n'));
      console.log(chalk.yellow('⚠️  Docker operations coming in Phase 4!\n'));
      return;
    } else if (!env.isNew && flags.update) {
      // Update mode - prompt for environment type
      environmentType = await promptEnvironmentType();
      setupMode = await promptSetupMode();
      isExpress = setupMode === 'express';
    } else if (env.isNew) {
      // New setup - prompt for environment type and mode
      environmentType = await promptEnvironmentType();
      setupMode = await promptSetupMode();
      isExpress = setupMode === 'express';
    }
    
    // Step 3: Collect configuration values
    console.log(chalk.cyan('\n🔧 Collecting configuration values...\n'));
    
    const database = await promptDatabaseConfig(environmentType, isExpress);
    const security = await promptSecurityConfig(isExpress);
    const email = await promptEmailConfig(isExpress);
    const server = await promptServerConfig(environmentType, isExpress);
    const redis = await promptRedisConfig(environmentType, isExpress);
    const backup = await promptBackupConfig(isExpress);
    const google = await promptGoogleServices(isExpress);
    const aws = await promptAWSConfig(isExpress);
    
    // Build complete configuration object
    const config = {
      mode: environmentType,
      database,
      security,
      email,
      server,
      redis,
      backup,
      google,
      aws
    };
    
    // Step 4: Show configuration preview
    showConfigPreview(config, flags.configOnly ? 'config' : 'full');
    
    // Step 5: Dry-run mode - stop here
    if (flags.dryRun) {
      console.log(chalk.yellow('🔍 Dry-run mode - no changes made'));
      console.log(chalk.gray('\nWhat would happen next:'));
      if (!flags.dockerOnly) {
        console.log(chalk.gray('  1. Generate .env files for root, backend, frontend'));
        if (env.files.root || env.files.backend || env.files.frontend) {
          console.log(chalk.gray('  2. Create backups of existing .env files'));
        }
      }
      if (!flags.configOnly) {
        console.log(chalk.gray('  3. Create external Docker volumes'));
        console.log(chalk.gray('  4. Build Docker images'));
        console.log(chalk.gray('  5. Start Docker containers'));
        if (!flags.skipMigrations) {
          console.log(chalk.gray('  6. Run database migrations'));
        }
        if (!flags.skipSeeders) {
          console.log(chalk.gray('  7. Run database seeders'));
        }
        console.log(chalk.gray('  8. Perform health checks'));
      }
      console.log(chalk.yellow('\n✅ Dry-run complete - remove --dry-run to apply changes\n'));
      return;
    }
    
    // Step 6: Write environment files
    if (!flags.dockerOnly) {
      const writeResult = await writeAllEnvFiles(config, !env.isNew);
      
      if (!writeResult.success) {
        console.log(chalk.red('❌ Some environment files failed to write'));
        console.log(chalk.yellow('\n💡 Check the errors above and try again\n'));
        process.exit(1);
      }
    } else {
      // Docker-only mode - skip file writing
      console.log(chalk.yellow('⚠️  Skipping file write in docker-only mode'));
      console.log(chalk.gray('  Docker operations will use existing .env files\n'));
    }
    
    // Step 7: Next steps
    if (flags.configOnly) {
      console.log(chalk.green('✅ Configuration complete!\n'));
      console.log(chalk.cyan('Next steps:'));
      console.log(chalk.gray('  1. Review the generated .env files'));
      console.log(chalk.gray('  2. Run setup without --config-only to start Docker'));
      console.log(chalk.gray('  3. Or run: npm run setup:docker\n'));
    } else {
      console.log(chalk.green('✅ Environment files generated!\n'));
      console.log(chalk.yellow('⚠️  Docker operations coming in Phase 4'));
      console.log(chalk.gray('\nPhase 3 Complete - Environment file generation:'));
      console.log(chalk.green('  ✓ Interactive prompts'));
      console.log(chalk.green('  ✓ Configuration collection'));
      console.log(chalk.green('  ✓ .env file generation'));
      console.log(chalk.green('  ✓ Automatic backups\n'));
      
      console.log(chalk.cyan('Next phases:'));
      console.log(chalk.gray('  Phase 4: Docker operations (volumes, build, up)'));
      console.log(chalk.gray('  Phase 5: Database operations (migrations, seeders)'));
      console.log(chalk.gray('  Phase 6: Health checks and monitoring\n'));
    }
    
  } catch (error) {
    console.error(chalk.red.bold('\n❌ Setup Failed\n'));
    console.error(chalk.red(error.message));
    
    if (error.stack) {
      console.error(chalk.gray('\nStack trace:'));
      console.error(chalk.gray(error.stack));
    }
    
    console.log(chalk.yellow('\n💡 Troubleshooting tips:'));
    console.log(chalk.gray('  - Run with --dry-run to preview without making changes'));
    console.log(chalk.gray('  - Check file permissions in project directory'));
    console.log(chalk.gray('  - Ensure Docker is installed and running'));
    console.log(chalk.gray('  - Use --help to see all available options\n'));
    
    process.exit(1);
  }
}

// Run main function
if (require.main === module) {
  main();
}

module.exports = { parseArguments, showWelcomeBanner, showHelp, showConfigPreview };
