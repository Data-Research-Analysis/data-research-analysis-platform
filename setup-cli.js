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

import chalk from 'chalk';
import ora from 'ora';
import { DOCKER_VOLUMES, ENVIRONMENT_DEFAULTS } from './lib/cli/constants.js';
import { detectEnvironment, loadExistingEnv, createBackup, buildConfiguration } from './lib/cli/utils.js';
import { generateEncryptionKey, generateJWTSecret, generateSecurePassword } from './lib/cli/generators.js';
import {
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
} from './lib/cli/prompts.js';
import { writeAllEnvFiles } from './lib/cli/writers.js';
import {
  createRequiredVolumes,
  buildDockerCompose,
  startDockerCompose,
  waitForServicesHealthy,
  teardownDockerCompose,
  rebuildDockerCompose
} from './lib/cli/docker.js';
import { runHealthCheck } from './lib/cli/health.js';
import { runMigrations, runSeeders } from './lib/cli/database.js';
import { runPreflightCheck, quickValidate } from './lib/cli/validate.js';
import { 
  restartService, 
  displayServicesStatus, 
  viewLogs 
} from './lib/cli/services.js';

// Parse command-line arguments
function parseArguments() {
  const args = process.argv.slice(2);
  
  // Extract values for flags that take arguments
  const restartIndex = args.indexOf('--restart');
  const restartService = restartIndex !== -1 && args[restartIndex + 1] ? args[restartIndex + 1] : null;
  
  const logsIndex = args.indexOf('--logs');
  const logsService = logsIndex !== -1 && args[logsIndex + 1] ? args[logsIndex + 1] : null;
  
  return {
    help: args.includes('--help') || args.includes('-h'),
    express: args.includes('--express') || args.includes('--quick'),
    configOnly: args.includes('--config-only'),
    dockerOnly: args.includes('--docker-only'),
    update: args.includes('--update'),
    down: args.includes('--down'),
    rebuild: args.includes('--rebuild'),
    health: args.includes('--health'),
    validate: args.includes('--validate'),
    status: args.includes('--status'),
    restart: restartService,
    logs: logsService,
    follow: args.includes('--follow') || args.includes('-f'),
    tail: args.includes('--tail') ? parseInt(args[args.indexOf('--tail') + 1]) || 100 : null,
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
  console.log('  npm run setup:health           Health check');
  console.log('  npm run setup:migrate          Run database migrations');
  console.log('  npm run setup:seed             Run database seeders');
  console.log('  node setup-cli.js --validate   Validate .env files');
  console.log('  node setup-cli.js --status     Show services status');
  console.log('  node setup-cli.js --restart <service>   Restart a service');
  console.log('  node setup-cli.js --logs <service>      View service logs\n');
  
  console.log(chalk.bold('OPTIONS:'));
  console.log('  --help, -h                     Show this help message');
  console.log('  --express, --quick             Express mode (minimal prompts)');
  console.log('  --config-only                  Only generate .env files');
  console.log('  --docker-only                  Only run Docker operations');
  console.log('  --update                       Update existing configuration');
  console.log('  --down                         Stop and remove containers');
  console.log('  --rebuild                      Rebuild Docker images');
  console.log('  --validate                     Run pre-flight validation');
  console.log('  --status                       Show services status');
  console.log('  --restart <service>            Restart specific service');
  console.log('  --logs <service>               View service logs');
  console.log('  --follow, -f                   Follow logs (with --logs)');
  console.log('  --tail <n>                     Show last n lines (with --logs)');
  console.log('  --health                       Run health check');
  console.log('  --skip-migrations              Skip database migrations');
  console.log('  --skip-seeders                 Skip database seeders');
  console.log('  --remove-config                Remove .env files on teardown');
  console.log('  --dry-run                      Show what would happen\n');
  
  console.log(chalk.bold('EXAMPLES:'));
  console.log('  npm run setup                  # Full interactive setup');
  console.log('  npm run setup:express          # Quick setup with defaults');
  console.log('  npm run setup:health           # Check system health');
  console.log('  npm run setup:down             # Stop all containers');
  console.log('  npm run setup:migrate          # Run database migrations');
  console.log('  npm run setup:seed             # Run database seeders');
  console.log('  node setup-cli.js --validate   # Validate .env files');
  console.log('  node setup-cli.js --status     # Show services status');
  console.log('  node setup-cli.js --restart backend  # Restart backend');
  console.log('  node setup-cli.js --logs backend --follow  # Follow backend logs\n');
  
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
      const healthResult = await runHealthCheck();
      process.exit(healthResult.success ? 0 : 1);
    }
    
    // Teardown mode
    if (flags.down) {
      const result = await teardownDockerCompose();
      if (result.success) {
        console.log(chalk.green('✅ Teardown complete\n'));
      } else {
        console.log(chalk.red('❌ Teardown failed\n'));
        process.exit(1);
      }
      return;
    }
    
    // Rebuild mode
    if (flags.rebuild) {
      const rebuildResult = await rebuildDockerCompose();
      if (!rebuildResult.success) {
        console.log(chalk.red('❌ Rebuild failed\n'));
        process.exit(1);
      }
      
      // After rebuild, start containers
      const startResult = await startDockerCompose(true);
      if (!startResult.success) {
        console.log(chalk.red('❌ Failed to start containers after rebuild\n'));
        process.exit(1);
      }
      
      // Wait for services to be healthy
      await waitForServicesHealthy();
      
      console.log(chalk.green('✅ Rebuild and restart complete!\n'));
      return;
    }
    
    // Validation mode
    if (flags.validate) {
      const validationResult = await runPreflightCheck();
      process.exit(validationResult.success ? 0 : 1);
    }
    
    // Status mode
    if (flags.status) {
      const statusResult = await displayServicesStatus();
      process.exit(statusResult.allRunning ? 0 : 1);
    }
    
    // Restart service mode
    if (flags.restart) {
      const restartResult = await restartService(flags.restart);
      process.exit(restartResult.success ? 0 : 1);
    }
    
    // Logs mode
    if (flags.logs) {
      const logsOptions = {
        follow: flags.follow,
        tail: flags.tail || 100
      };
      const logsResult = await viewLogs(flags.logs, logsOptions);
      process.exit(logsResult.success ? 0 : 1);
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
    
    // Step 7: Docker operations
    if (flags.configOnly) {
      console.log(chalk.green('✅ Configuration complete!\n'));
      console.log(chalk.cyan('Next steps:'));
      console.log(chalk.gray('  1. Review the generated .env files'));
      console.log(chalk.gray('  2. Run setup without --config-only to start Docker'));
      console.log(chalk.gray('  3. Or run: npm run setup:docker\n'));
    } else {
      // Full setup: Run Docker operations
      console.log(chalk.green('✅ Environment files generated!\n'));
      
      // Step 7.1: Create external Docker volumes
      const volumeResult = await createRequiredVolumes();
      if (!volumeResult.success) {
        console.log(chalk.red('❌ Failed to create Docker volumes'));
        console.log(chalk.yellow('\n💡 Ensure Docker is installed and running\n'));
        process.exit(1);
      }
      
      // Step 7.2: Build Docker images
      const buildResult = await buildDockerCompose();
      if (!buildResult.success) {
        console.log(chalk.red('❌ Failed to build Docker images'));
        console.log(chalk.yellow('\n💡 Check docker-compose.yml and Dockerfiles\n'));
        process.exit(1);
      }
      
      // Step 7.3: Start Docker containers
      const startResult = await startDockerCompose(true);
      if (!startResult.success) {
        console.log(chalk.red('❌ Failed to start Docker containers'));
        console.log(chalk.yellow('\n💡 Check .env files and Docker logs\n'));
        process.exit(1);
      }
      
      // Step 7.4: Wait for services to be healthy
      const healthResult = await waitForServicesHealthy();
      
      // Step 7.5: Database migrations
      if (!flags.skipMigrations) {
        const migrationResult = await runMigrations();
        if (!migrationResult.success) {
          console.log(chalk.yellow('⚠️  Migrations failed, but continuing setup'));
          console.log(chalk.gray('  You can run migrations later with: docker exec backend.dataresearchanalysis.test npm run migration:run\n'));
        }
      } else {
        console.log(chalk.gray('\n⏭  Skipping migrations (--skip-migrations flag)\n'));
      }
      
      // Step 7.6: Database seeders
      if (!flags.skipSeeders) {
        const seederResult = await runSeeders();
        if (!seederResult.success) {
          console.log(chalk.yellow('⚠️  Seeders failed, but continuing setup'));
          console.log(chalk.gray('  You can run seeders later with: docker exec backend.dataresearchanalysis.test npm run seed:run\n'));
        }
      } else {
        console.log(chalk.gray('\n⏭  Skipping seeders (--skip-seeders flag)\n'));
      }
      
      // Success summary
      console.log(chalk.green.bold('\n🎉 Setup Complete!\n'));
      console.log(chalk.cyan('Your Data Research Analysis Platform is ready:\n'));
      console.log(chalk.gray('  Frontend:  ') + chalk.cyan(config.server.frontendUrl));
      console.log(chalk.gray('  Backend:   ') + chalk.cyan(config.server.backendUrl));
      console.log(chalk.gray('  Database:  ') + chalk.cyan(`${config.database.host}:${config.database.port}`));
      console.log();
      
      console.log(chalk.cyan('Next steps:'));
      console.log(chalk.gray('  1. Access the frontend at ' + config.server.frontendUrl));
      console.log(chalk.gray('  2. Check logs: docker-compose logs -f'));
      console.log(chalk.gray('  3. Stop services: npm run setup:down'));
      console.log(chalk.gray('  4. Rebuild: npm run setup:rebuild\n'));
      
      if (!healthResult.success) {
        console.log(chalk.yellow('⚠️  Note: Some services may still be starting up'));
        console.log(chalk.gray('   Run "npm run setup:health" to check status\n'));
      }
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
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
