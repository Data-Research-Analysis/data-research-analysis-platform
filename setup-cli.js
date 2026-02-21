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
      console.log(chalk.yellow('\n🏥 Health check mode - Coming soon!\n'));
      return;
    }
    
    // Teardown mode
    if (flags.down) {
      console.log(chalk.yellow('\n🔽 Teardown mode - Coming soon!\n'));
      return;
    }
    
    // Rebuild mode
    if (flags.rebuild) {
      console.log(chalk.yellow('\n🔨 Rebuild mode - Coming soon!\n'));
      return;
    }
    
    // Default: Full setup
    showWelcomeBanner();
    
    console.log(chalk.yellow('⚠️  Setup functionality coming soon!\n'));
    console.log(chalk.gray('This is Phase 1 - Project structure initialized.'));
    console.log(chalk.gray('Run with --help to see available modes.\n'));
    
  } catch (error) {
    console.error(chalk.red.bold('\n❌ Setup Failed\n'));
    console.error(chalk.red(error.message));
    
    if (error.stack) {
      console.error(chalk.gray('\nStack trace:'));
      console.error(chalk.gray(error.stack));
    }
    
    process.exit(1);
  }
}

// Run main function
if (require.main === module) {
  main();
}

module.exports = { parseArguments, showWelcomeBanner, showHelp };
