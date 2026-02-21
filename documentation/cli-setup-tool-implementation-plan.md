# CLI Environment Setup & Docker Orchestration Tool - Implementation Plan

**Status:** Planning Phase  
**Priority:** High  
**Estimated Effort:** 3-4 days  
**Target Completion:** Q1 2026  

---

## 📋 Overview

Create an interactive CLI tool that automates the complete local development setup:
1. **Environment configuration** - Generate `.env` files with validation
2. **Docker orchestration** - Create volumes, build, and run containers
3. **Database initialization** - Run migrations and seeders
4. **Health monitoring** - Verify all services are running
5. **Teardown support** - Clean shutdown and optional data cleanup

## 🎯 Objectives

- **Simplify onboarding**: Setup time from 30+ minutes to <5 minutes
- **Zero manual steps**: Fully automated from `npm run setup` to running platform
- **Docker integration**: Build, up, down, rebuild commands
- **Health monitoring**: Real-time service health checks
- **Error recovery**: Automatic retry and helpful error messages
- **Maintain security**: Generate secure random values, validate inputs

## 📝 Problem Statement

Current setup requires ~30 minutes of manual work:
1. Manually copy 3 `.env.example` files to `.env`
2. Fill in 60+ environment variables
3. Manually create Docker volumes
4. Run `docker-compose build`
5. Run `docker-compose up`
6. Wait and hope services start correctly
7. Manually run migrations in backend container
8. Manually run seeders
9. Check if everything works

**New Solution**: `npm run setup` → ☕ → Platform ready!

## 🏗️ Technical Approach

### Tool Architecture

**Primary CLI:** `/home/dataresearchanalysis/setup-cli.js`  
**Secondary Commands:** npm scripts wrapping CLI with flags

**Dependencies:**
- `inquirer@^9.2.12` - Interactive prompts
- `chalk@^5.3.0` - Terminal colors
- `ora@^6.3.1` - Spinners & progress
- `execa@^8.0.1` - Execute shell commands
- `p-retry@^6.2.0` - Retry logic for Docker operations
- `dockerode@^4.0.2` - Docker API client (optional, for advanced features)
- `fs-extra@^11.2.0` - File operations
- `dotenv@^16.3.1` - Parse .env files

### Docker Volume Requirements

**CRITICAL**: The `docker-compose.yml` file must declare volumes as **external**:

```yaml
volumes:
  data_research_analysis_postgres_data:
    external: true
  data_research_analysis_redis_data:
    external: true
```

**Why External Volumes?**
- CLI creates volumes BEFORE `docker-compose up` runs
- Prevents accidental data loss (never auto-deleted)
- Allows clean container teardown while preserving data
- Users have full control over data lifecycle

**Manual Volume Deletion** (if needed):
```bash
docker volume rm data_research_analysis_postgres_data
docker volume rm data_research_analysis_redis_data
```

### Execution Modes

#### 1. **Full Setup Mode** (Default)
```bash
npm run setup
```
- Interactive prompts for configuration
- Generate `.env` files
- Create Docker volumes
- Build Docker Compose
- Start containers
- Run migrations
- Run seeders
- Health check all services
- Display access URLs

#### 2. **Express Setup Mode**
```bash
npm run setup:express
# or
npm run setup -- --express
```
- Minimal prompts (only passwords/API keys)
- Auto-generate secure values
- All Docker operations
- Full initialization

#### 3. **Config-Only Mode**
```bash
npm run setup:config
# or
npm run setup -- --config-only
```
- Only generate `.env` files
- Skip Docker operations
- User runs Docker manually

#### 4. **Docker-Only Mode**
```bash
npm run setup:docker
# or
npm run setup -- --docker-only
```
- Assumes `.env` files exist
- Only Docker operations (volumes, build, up, migrate, seed)
- Useful for rebuilding after config changes

#### 5. **Update Mode**
```bash
npm run setup:update
```
- Update existing `.env` files with new variables
- Restart affected containers
- Re-run migrations if schema changed

#### 6. **Teardown Mode**
```bash
npm run setup:down
# or
npm run setup -- --down
```
- Stop all containers gracefully
- **Never** removes volumes (data preserved)
- Volumes must be manually deleted via Docker CLI if needed
- Optional: Remove `.env` files with `--remove-config` flag

#### 7. **Rebuild Mode**
```bash
npm run setup:rebuild
```
- Stop containers
- Rebuild images
- Restart containers
- Skip migrations (data preserved)

#### 8. **Health Check Mode**
```bash
npm run setup:health
```
- Check Docker services status
- Verify database connectivity
- Test API endpoints
- Report configuration health

## ✅ Implementation Checklist

### Phase 1: Project Setup (Day 1, 4 hours)

#### Dependencies Installation
- [ ] Create `setup-cli.js` in root directory
- [ ] Update root `package.json` with dependencies and scripts:
  ```json
  {
    "name": "data-research-analysis-setup",
    "version": "1.0.0",
    "description": "Interactive CLI for complete platform setup",
    "main": "setup-cli.js",
    "scripts": {
      "setup": "node setup-cli.js",
      "setup:express": "node setup-cli.js --express",
      "setup:config": "node setup-cli.js --config-only",
      "setup:docker": "node setup-cli.js --docker-only",
      "setup:update": "node setup-cli.js --update",
      "setup:down": "node setup-cli.js --down",
      "setup:rebuild": "node setup-cli.js --rebuild",
      "setup:health": "node setup-cli.js --health"
    },
    "dependencies": {
      "inquirer": "^9.2.12",
      "chalk": "^5.3.0",
      "ora": "^6.3.1",
      "execa": "^8.0.1",
      "p-retry": "^6.2.0",
      "dockerode": "^4.0.2",
      "fs-extra": "^11.2.0",
      "dotenv": "^16.3.1"
    }
  }
  ```
- [ ] Run `npm install` in root directory
- [ ] Test dependencies imported correctly

#### File Structure
- [ ] Create `lib/cli/` directory structure:
  ```
  lib/cli/
    ├── prompts.js         # Inquirer prompt definitions
    ├── validators.js      # Input validation
    ├── generators.js      # Random value generators
    ├── writers.js         # File writing logic
    ├── templates.js       # .env templates
    ├── constants.js       # Defaults & configurations
    ├── utils.js           # Helper functions
    ├── docker.js          # Docker operations (NEW)
    ├── database.js        # Migration & seeder operations (NEW)
    └── health.js          # Health check logic (NEW)
  ```

### Phase 2: Core CLI Structure (Day 1, 4 hours)

#### Command-Line Argument Parsing
- [ ] Implement argument parser:
  - `--help` / `-h` - Show usage
  - `--express` - Express mode
  - `--config-only` - Skip Docker
  - `--docker-only` - Skip config generation
  - `--update` - Update existing config
  - `--down` - Teardown environment
  - `--rebuild` - Rebuild containers
  - `--health` - Health check only
  - `--skip-migrations` - Skip DB migrations
  - `--skip-seeders` - Skip DB seeders
  - `--remove-config` - Remove .env files on teardown
  - `--dry-run` - Show what would happen
  
  Note: Volumes are NEVER automatically deleted (external volumes)

#### Main CLI Flow
```javascript
// setup-cli.js (simplified structure)
async function main() {
  const flags = parseArguments();
  
  if (flags.help) {
    showHelp();
    return;
  }
  
  if (flags.health) {
    await runHealthCheck();
    return;
  }
  
  if (flags.down) {
    await teardownEnvironment(flags);
    return;
  }
  
  if (flags.rebuild) {
    await rebuildEnvironment(flags);
    return;
  }
  
  // Full setup flow
  showWelcomeBanner();
  
  let config;
  if (!flags.dockerOnly) {
    // Step 1: Generate .env files
    config = await generateEnvironmentFiles(flags);
  } else {
    config = loadExistingConfig();
  }
  
  if (!flags.configOnly) {
    // Step 2: Docker operations
    // CRITICAL: Volumes MUST be created before docker-compose up
    // They are external volumes referenced in docker-compose.yml
    await createDockerVolumes(); // Create external volumes first
    await buildDockerImages();   // Build images
    await startDockerCompose();  // Start containers
    
    // Step 3: Database initialization
    if (!flags.skipMigrations) {
      await runMigrations();
    }
    
    if (!flags.skipSeeders) {
      await runSeeders();
    }
    
    // Step 4: Health check
    await verifyServices();
  }
  
  // Step 5: Display summary
  showCompletionSummary(config);
}
```

### Phase 3: Environment File Generation (Day 1-2, 8 hours)

*(Same as previous plan - prompts, validators, generators, templates)*

- [ ] Implement input validators (password, email, port, URL, etc.)
- [ ] Implement value generators (encryption key, JWT secret, passwords)
- [ ] Create interactive prompts for all configuration categories
- [ ] Implement template system for `.env` files
- [ ] Implement file writing with backups

### Phase 4: Docker Operations (Day 2, 8 hours)

#### Docker Volume Management
```javascript
// lib/cli/docker.js

const execa = require('execa');
const chalk = require('chalk');
const ora = require('ora');

/**
 * Create external Docker volumes BEFORE starting docker-compose.
 * These volumes are referenced in docker-compose.yml as external: true
 * and MUST exist before containers start, or docker-compose will fail.
 * 
 * IMPORTANT: These volumes are NEVER automatically deleted.
 * Users must manually delete via: docker volume rm <volume_name>
 */
async function createRequiredVolumes() {
  const spinner = ora('Creating external Docker volumes...').start();
  
  // External volumes required by docker-compose.yml
  const volumes = [
    'data_research_analysis_postgres_data',
    'data_research_analysis_redis_data'
  ];
  
  for (const volume of volumes) {
    try {
      // Check if volume exists
      const { stdout } = await execa('docker', ['volume', 'ls', '-q']);
      
      if (!stdout.includes(volume)) {
        await execa('docker', ['volume', 'create', volume]);
        spinner.succeed(`Created external volume: ${volume}`);
      } else {
        spinner.info(`External volume already exists: ${volume}`);
      }
    } catch (error) {
      spinner.fail(`Failed to create volume: ${volume}`);
      console.error(chalk.red('\nExternal volumes are required before starting Docker.'));
      console.error(chalk.yellow('You can manually create them with:'));
      console.error(chalk.gray(`  docker volume create ${volume}`));
      throw error;
    }
  }
  
  spinner.succeed('All external Docker volumes ready');
  console.log(chalk.gray('  Note: Volumes are preserved on teardown and must be manually deleted\n'));
}
```

#### Docker Compose Build
```javascript
async function buildDockerCompose() {
  const spinner = ora('Building Docker images...').start();
  
  try {
    // Run docker-compose build with live output
    const buildProcess = execa('docker-compose', ['build'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    buildProcess.stdout.on('data', (data) => {
      const output = data.toString().trim();
      if (output) {
        spinner.text = `Building: ${output.substring(0, 60)}...`;
      }
    });
    
    await buildProcess;
    spinner.succeed('Docker images built successfully');
  } catch (error) {
    spinner.fail('Docker build failed');
    console.error(chalk.red(error.stderr || error.message));
    throw error;
  }
}
```

#### Docker Compose Up
```javascript
async function startDockerCompose(detached = true) {
  const spinner = ora('Starting Docker containers...').start();
  
  try {
    const args = ['up'];
    if (detached) {
      args.push('-d'); // Detached mode
    }
    
    const upProcess = execa('docker-compose', args, {
      stdio: detached ? ['ignore', 'pipe', 'pipe'] : 'inherit'
    });
    
    if (detached) {
      upProcess.stdout.on('data', (data) => {
        const output = data.toString().trim();
        if (output) {
          spinner.text = output;
        }
      });
    }
    
    await upProcess;
    spinner.succeed('Docker containers started');
    
    // Wait for services to be healthy
    await waitForServicesHealthy();
    
  } catch (error) {
    spinner.fail('Failed to start containers');
    throw error;
  }
}
```

#### Health Check & Wait Logic
```javascript
const pRetry = require('p-retry');

async function waitForServicesHealthy() {
  const spinner = ora('Waiting for services to be healthy...').start();
  
  const services = [
    { name: 'PostgreSQL', port: 5434, host: 'localhost' },
    { name: 'Redis', port: 6379, host: 'localhost' },
    { name: 'Backend', port: 3002, host: 'localhost' },
    { name: 'Frontend', port: 3000, host: 'localhost' }
  ];
  
  for (const service of services) {
    spinner.text = `Checking ${service.name}...`;
    
    try {
      await pRetry(
        async () => {
          const isHealthy = await checkServiceHealth(service);
          if (!isHealthy) {
            throw new Error(`${service.name} not ready`);
          }
        },
        {
          retries: 30,          // 30 attempts
          minTimeout: 2000,     // Start with 2s delay
          maxTimeout: 5000,     // Max 5s delay
          onFailedAttempt: (error) => {
            spinner.text = `Waiting for ${service.name}... (${error.attemptNumber}/30)`;
          }
        }
      );
      
      spinner.text = `${service.name} is healthy ✓`;
    } catch (error) {
      spinner.fail(`${service.name} failed to start`);
      throw error;
    }
  }
  
  spinner.succeed('All services are healthy');
}

async function checkServiceHealth(service) {
  try {
    const { default: net } = await import('net');
    
    return new Promise((resolve) => {
      const socket = new net.Socket();
      const timeout = setTimeout(() => {
        socket.destroy();
        resolve(false);
      }, 2000);
      
      socket.connect(service.port, service.host, () => {
        clearTimeout(timeout);
        socket.destroy();
        resolve(true);
      });
      
      socket.on('error', () => {
        clearTimeout(timeout);
        resolve(false);
      });
    });
  } catch {
    return false;
  }
}
```

#### Docker Compose Down
```javascript
/**
 * Stop and remove containers.
 * NEVER removes volumes - they are external and must be manually deleted.
 * 
 * To manually delete volumes (WARNING: destructive):
 *   docker volume rm data_research_analysis_postgres_data
 *   docker volume rm data_research_analysis_redis_data
 */
async function teardownDockerCompose() {
  const spinner = ora('Stopping Docker containers...').start();
  
  try {
    // Use 'down' without -v flag to preserve volumes
    // External volumes are not removed by docker-compose down anyway
    await execa('docker-compose', ['down']);
    
    spinner.succeed('Docker containers stopped');
    console.log(chalk.cyan('\nℹ️  Data volumes preserved (external volumes)'));
    console.log(chalk.gray('   To manually remove volumes (⚠️  DESTRUCTIVE):'));
    console.log(chalk.gray('   docker volume rm data_research_analysis_postgres_data'));
    console.log(chalk.gray('   docker volume rm data_research_analysis_redis_data\n'));
  } catch (error) {
    spinner.fail('Failed to stop containers');
    throw error;
  }
}
```

### Phase 5: Database Operations (Day 2-3, 6 hours)

#### Migration Runner
```javascript
// lib/cli/database.js

async function runMigrations() {
  const spinner = ora('Running database migrations...').start();
  
  try {
    // Execute migrations inside backend container
    const { stdout, stderr } = await execa(
      'docker-compose',
      [
        'exec',
        '-T',  // No TTY
        'backend',
        'npm',
        'run',
        'migration:run'
      ],
      { cwd: process.cwd() }
    );
    
    // Parse migration output
    const migrations = parseMigrationOutput(stdout);
    
    if (migrations.length > 0) {
      spinner.succeed(`Ran ${migrations.length} migration(s)`);
      migrations.forEach(m => {
        console.log(chalk.gray(`  ✓ ${m}`));
      });
    } else {
      spinner.succeed('Database schema is up to date');
    }
  } catch (error) {
    spinner.fail('Migration failed');
    console.error(chalk.red(error.stderr || error.message));
    throw error;
  }
}

function parseMigrationOutput(output) {
  // Parse TypeORM migration output
  const migrationRegex = /Migration .+ has been executed successfully/g;
  const matches = output.match(migrationRegex) || [];
  return matches;
}
```

#### Seeder Runner
```javascript
async function runSeeders() {
  const spinner = ora('Running database seeders...').start();
  
  try {
    const { stdout } = await execa(
      'docker-compose',
      [
        'exec',
        '-T',
        'backend',
        'npm',
        'run',
        'seed:run',
        '--',
        '-d',
        './src/datasources/PostgresDSMigrations.ts',
        'src/seeders/*.ts'
      ],
      { cwd: process.cwd() }
    );
    
    spinner.succeed('Database seeded successfully');
    
    // Display test credentials
    console.log(chalk.cyan('\n📝 Test Credentials:'));
    console.log(chalk.gray('  Admin: testadminuser@dataresearchanalysis.com / testuser'));
    console.log(chalk.gray('  User:  testuser@dataresearchanalysis.com / testuser\n'));
  } catch (error) {
    spinner.fail('Seeding failed');
    console.error(chalk.red(error.stderr || error.message));
    throw error;
  }
}
```

#### Alternative: Direct Migration Execution
```javascript
// If migrations need to run on host (not in container)
async function runMigrationsOnHost() {
  const spinner = ora('Running database migrations...').start();
  
  try {
    // Change to backend directory
    const { stdout } = await execa('npm', ['run', 'migration:run'], {
      cwd: './backend'
    });
    
    spinner.succeed('Migrations complete');
  } catch (error) {
    spinner.fail('Migration failed');
    throw error;
  }
}
```

### Phase 6: Health Check System (Day 3, 4 hours)

#### Comprehensive Health Check
```javascript
// lib/cli/health.js

async function runHealthCheck() {
  console.log(chalk.bold('\n🏥 Health Check Report\n'));
  
  const checks = [
    checkDockerInstalled,
    checkDockerRunning,
    checkDockerComposeInstalled,
    checkEnvFilesExist,
    checkDockerVolumes,
    checkContainersRunning,
    checkServiceConnectivity,
    checkDatabaseConnection,
    checkAPIEndpoint
  ];
  
  const results = [];
  
  for (const check of checks) {
    const result = await check();
    results.push(result);
    displayCheckResult(result);
  }
  
  // Summary
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const warnings = results.filter(r => r.status === 'warn').length;
  
  console.log(chalk.bold('\n📊 Summary:'));
  console.log(chalk.green(`  ✓ Passed: ${passed}`));
  if (warnings > 0) {
    console.log(chalk.yellow(`  ⚠ Warnings: ${warnings}`));
  }
  if (failed > 0) {
    console.log(chalk.red(`  ✗ Failed: ${failed}`));
  }
  
  return failed === 0;
}

async function checkDockerInstalled() {
  try {
    await execa('docker', ['--version']);
    return { 
      name: 'Docker Installed', 
      status: 'pass', 
      message: 'Docker is installed' 
    };
  } catch {
    return { 
      name: 'Docker Installed', 
      status: 'fail', 
      message: 'Docker is not installed',
      help: 'Install Docker: https://docs.docker.com/get-docker/'
    };
  }
}

async function checkDockerRunning() {
  try {
    await execa('docker', ['ps']);
    return { 
      name: 'Docker Running', 
      status: 'pass', 
      message: 'Docker daemon is running' 
    };
  } catch {
    return { 
      name: 'Docker Running', 
      status: 'fail', 
      message: 'Docker daemon is not running',
      help: 'Start Docker Desktop or run: sudo systemctl start docker'
    };
  }
}

async function checkContainersRunning() {
  try {
    const { stdout } = await execa('docker-compose', ['ps', '--services', '--filter', 'status=running']);
    const runningServices = stdout.trim().split('\n').filter(Boolean);
    
    const expectedServices = ['frontend', 'backend', 'database', 'redis'];
    const missingServices = expectedServices.filter(s => !runningServices.includes(s));
    
    if (missingServices.length === 0) {
      return {
        name: 'Docker Containers',
        status: 'pass',
        message: `All ${runningServices.length} containers running`
      };
    } else {
      return {
        name: 'Docker Containers',
        status: 'warn',
        message: `${missingServices.length} container(s) not running: ${missingServices.join(', ')}`,
        help: 'Run: npm run setup:docker'
      };
    }
  } catch {
    return {
      name: 'Docker Containers',
      status: 'fail',
      message: 'No containers are running',
      help: 'Run: npm run setup'
    };
  }
}

async function checkDatabaseConnection() {
  try {
    const { stdout } = await execa('docker-compose', [
      'exec',
      '-T',
      'database',
      'pg_isready',
      '-h',
      'localhost'
    ]);
    
    return {
      name: 'Database Connection',
      status: 'pass',
      message: 'PostgreSQL is accepting connections'
    };
  } catch {
    return {
      name: 'Database Connection',
      status: 'fail',
      message: 'Cannot connect to PostgreSQL'
    };
  }
}

async function checkAPIEndpoint() {
  try {
    const response = await fetch('http://localhost:3002/health');
    
    if (response.ok) {
      return {
        name: 'Backend API',
        status: 'pass',
        message: 'API is responding'
      };
    } else {
      return {
        name: 'Backend API',
        status: 'warn',
        message: `API returned status ${response.status}`
      };
    }
  } catch {
    return {
      name: 'Backend API',
      status: 'fail',
      message: 'API is not responding',
      help: 'Check backend logs: docker-compose logs backend'
    };
  }
}

function displayCheckResult(result) {
  const icon = {
    pass: chalk.green('✓'),
    fail: chalk.red('✗'),
    warn: chalk.yellow('⚠')
  }[result.status];
  
  console.log(`${icon} ${result.name}: ${result.message}`);
  
  if (result.help) {
    console.log(chalk.gray(`    → ${result.help}`));
  }
}
```

### Phase 7: User Experience & Output (Day 3, 4 hours)

#### Welcome Banner
```javascript
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
```

#### Progress Tracking
```javascript
function showProgress(step, total, message) {
  const percentage = Math.round((step / total) * 100);
  const bar = '█'.repeat(Math.round(percentage / 5)) + '░'.repeat(20 - Math.round(percentage / 5));
  
  console.log(chalk.cyan(`\n[${step}/${total}] ${bar} ${percentage}%`));
  console.log(chalk.bold(`${message}\n`));
}
```

#### Completion Summary
```javascript
function showCompletionSummary(config) {
  console.log(chalk.green.bold('\n✨ Setup Complete! ✨\n'));
  
  console.log(chalk.bold('📦 Services Running:'));
  console.log(chalk.gray(`  Frontend:  http://localhost:${config.frontend.port}`));
  console.log(chalk.gray(`  Backend:   http://localhost:${config.backend.port}`));
  console.log(chalk.gray(`  Database:  localhost:${config.postgres.localPort}`));
  console.log(chalk.gray(`  Redis:     localhost:${config.redis.localPort}`));
  
  console.log(chalk.bold('\n👤 Test Credentials:'));
  console.log(chalk.gray('  Admin:  testadminuser@dataresearchanalysis.com / testuser'));
  console.log(chalk.gray('  User:   testuser@dataresearchanalysis.com / testuser'));
  
  console.log(chalk.bold('\n🔗 Quick Links:'));
  console.log(chalk.blue(`  Platform:  https://online.studiesw.test:3000`));
  console.log(chalk.blue(`  API Docs:  http://localhost:3002/api-docs`));
  
  console.log(chalk.bold('\n📝 Useful Commands:'));
  console.log(chalk.gray('  View logs:     docker-compose logs -f'));
  console.log(chalk.gray('  Stop:          npm run setup:down'));
  console.log(chalk.gray('  Restart:       npm run setup:rebuild'));
  console.log(chalk.gray('  Health check:  npm run setup:health'));
  
  console.log(chalk.bold('\n⚠️  Important:'));
  console.log(chalk.yellow('  Encryption key backed up in: ENVIRONMENT_SETUP.md'));
  console.log(chalk.yellow('  Keep this file secure!\n'));
}
```

### Phase 8: Error Handling & Recovery (Day 3-4, 4 hours)

#### Error Handler
```javascript
class SetupError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = 'SetupError';
    this.context = context;
  }
}

function handleError(error) {
  console.log(chalk.red.bold('\n❌ Setup Failed\n'));
  
  if (error instanceof SetupError) {
    console.log(chalk.red(error.message));
    
    if (error.context.help) {
      console.log(chalk.yellow(`\n💡 Help: ${error.context.help}`));
    }
    
    if (error.context.logs) {
      console.log(chalk.gray(`\nLogs:\n${error.context.logs}`));
    }
  } else {
    console.log(chalk.red(error.message));
  }
  
  console.log(chalk.bold('\n🔧 Troubleshooting:'));
  console.log(chalk.gray('  1. Check Docker is running: docker ps'));
  console.log(chalk.gray('  2. Check .env files exist'));
  console.log(chalk.gray('  3. View logs: docker-compose logs'));
  console.log(chalk.gray('  4. Run health check: npm run setup:health'));
  console.log(chalk.gray('  5. See docs: documentation/cli-setup-guide.md\n'));
  
  process.exit(1);
}
```

#### Cleanup on Failure
```javascript
async function safeSetup() {
  let containersStarted = false;
  
  try {
    // ... setup steps
    await startDockerCompose();
    containersStarted = true;
    // ... more steps
  } catch (error) {
    console.log(chalk.yellow('\n⚠️  Setup failed, cleaning up...'));
    
    if (containersStarted) {
      await teardownDockerCompose(false); // Stop but keep volumes
    }
    
    throw error;
  }
}
```

### Phase 9: Testing & Documentation (Day 4, 6 hours)

#### Integration Tests
```javascript
// __tests__/setup-cli.test.js

describe('Setup CLI', () => {
  test('generates valid .env files', async () => {
    // Mock inquirer responses
    // Run CLI
    // Verify .env files created
  });
  
  test('creates Docker volumes', async () => {
    // Run volume creation
    // Verify volumes exist
  });
  
  test('health check detects running services', async () => {
    // Start services
    // Run health check
    // Verify all pass
  });
});
```

#### Documentation
- [ ] Create `documentation/cli-setup-guide.md`:
  - Installation
  - All command modes
  - Troubleshooting
  - FAQ
  - Architecture diagrams
- [ ] Update `README.md` with new setup process
- [ ] Create video/GIF demo (optional)
- [ ] Add JSDoc comments to all functions

### Phase 10: Advanced Features (Day 4, 4 hours)

#### Logs Viewer
```javascript
async function viewLogs(service = null, follow = false) {
  const args = ['logs'];
  
  if (follow) {
    args.push('-f');
  }
  
  if (service) {
    args.push(service);
  }
  
  await execa('docker-compose', args, { stdio: 'inherit' });
}

// Usage: npm run setup:logs -- backend --follow
```

#### Service Restart
```javascript
async function restartService(service) {
  const spinner = ora(`Restarting ${service}...`).start();
  
  try {
    await execa('docker-compose', ['restart', service]);
    spinner.succeed(`${service} restarted`);
  } catch (error) {
    spinner.fail(`Failed to restart ${service}`);
    throw error;
  }
}
```

#### Configuration Diff
```javascript
async function showConfigDiff() {
  // Compare current .env with .env.example
  // Highlight missing or new variables
  // Suggest running update mode
}
```

## 📊 Complete User Experience Flow

### First-Time Setup

```bash
$ npm run setup

┌─────────────────────────────────────────────────────────┐
│                                                         │
│   🚀 Data Research Analysis Platform Setup CLI         │
│                                                         │
│   Complete automated setup: Config → Docker → Ready!   │
│                                                         │
└─────────────────────────────────────────────────────────┘

✓ No existing configuration found
✓ Docker is installed and running
✓ Starting fresh setup...

? Select your deployment environment: (Use arrow keys)
❯ Development (localhost, default ports)
  Docker (container hostnames)
  Production (custom URLs)

? Select setup mode: (Use arrow keys)
❯ Full Setup (config + Docker + database)
  Config Only (skip Docker operations)
  Express Setup (minimal prompts, all automation)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  [1/6] 📦 DATABASE CONFIGURATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

? PostgreSQL password: [hidden] ••••••••••••••
✓ Password meets security requirements

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  [2/6] 🔐 SECURITY & AUTHENTICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

? Generate encryption key automatically? (Y/n) y
✓ Generated: 8f3a9c2e1d7b6a5f...

? reCAPTCHA site key: 6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI
? reCAPTCHA secret key: [hidden] ••••••••••••••

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  [3/6] 📧 EMAIL & OPTIONAL SERVICES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

? Email provider: Mailtrap (development/testing)
... (more prompts)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  [4/6] 📝 GENERATING CONFIGURATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Created .env (root)
✓ Created backend/.env
✓ Created frontend/.env
✓ Generated ENVIRONMENT_SETUP.md

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  [5/6] 🐳 DOCKER SETUP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ℹ️  External volumes required before starting Docker...
✓ Created external volume: data_research_analysis_postgres_data
✓ External volume already exists: data_research_analysis_redis_data
ℹ️  Note: Volumes are preserved on teardown and must be manually deleted

⏳ Building Docker images (this may take 3-5 minutes)...
✓ Docker images built successfully
⏳ Starting Docker containers...
✓ Docker containers started
⏳ Waiting for services to be healthy...
  ✓ PostgreSQL (2s)
  ✓ Redis (1s)
  ✓ Backend (12s)
  ✓ Frontend (8s)
✓ All services are healthy

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  [6/6] 💾 DATABASE INITIALIZATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Ran 15 migration(s)
  ✓ Migration CreateUsersTable has been executed
  ✓ Migration CreateProjectsTable has been executed
  ... (13 more)
✓ Database seeded successfully

📝 Test Credentials:
  Admin: testadminuser@dataresearchanalysis.com / testuser
  User:  testuser@dataresearchanalysis.com / testuser

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✨ Setup Complete! ✨

📦 Services Running:
  Frontend:  http://localhost:3000
  Backend:   http://localhost:3002
  Database:  localhost:5434
  Redis:     localhost:6379

🔗 Quick Links:
  Platform:  https://online.studiesw.test:3000
  API Docs:  http://localhost:3002/api-docs

📝 Useful Commands:
  View logs:     docker-compose logs -f
  Stop:          npm run setup:down
  Restart:       npm run setup:rebuild
  Health check:  npm run setup:health

⚠️  Important:
  Encryption key backed up in: ENVIRONMENT_SETUP.md
  Keep this file secure!

Total setup time: 4m 32s
```

### Express Mode

```bash
$ npm run setup:express

🚀 Express Setup - Fastest way to get started!

Required values (3 questions):
? PostgreSQL password: [hidden] ••••••••••••••
? reCAPTCHA site key: 6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI
? reCAPTCHA secret: [hidden] ••••••••••••••

✓ Using recommended defaults
✓ Generating secure values...
✓ Creating .env files...
✓ Creating Docker volumes...
⏳ Building Docker (3-5 min)...
✓ Starting containers...
✓ Waiting for services... (18s)
✓ Running migrations... (15 migrations)
✓ Seeding database...

✨ Ready to go! Visit: https://online.studiesw.test:3000

Total time: 4m 12s
```

### Teardown

```bash
$ npm run setup:down

🔽 Tearing down environment...

✓ Stopping containers...
✓ Containers stopped

ℹ️  Data volumes preserved (external volumes)
   To manually remove volumes (⚠️  DESTRUCTIVE):
   docker volume rm data_research_analysis_postgres_data
   docker volume rm data_research_analysis_redis_data

? Remove .env configuration files? (y/N) n
✓ Configuration files preserved
```

### Health Check

```bash
$ npm run setup:health

🏥 Health Check Report

✓ Docker Installed: Docker is installed
✓ Docker Running: Docker daemon is running
✓ Docker Compose: docker-compose version 2.24.0
✓ Environment Files: All .env files exist
✓ Docker Volumes: 2/2 volumes exist
✓ Docker Containers: All 4 containers running
✓ PostgreSQL: Accepting connections
✓ Redis: Connected
✓ Backend API: Responding (200 OK)
✓ Frontend: Responding (200 OK)

📊 Summary:
  ✓ Passed: 10
  ✗ Failed: 0

✨ All systems operational!
```

## 🔐 Security Considerations

1. **No credentials in logs**: Mask all passwords/secrets in output
2. **File permissions**: `.env` files created with `0600` (read/write owner only)
3. **Backup encryption key**: Warn user prominently to backup encryption key
4. **Docker socket access**: Validate Docker daemon is running safely
5. **No external API calls**: All operations local except optional health check endpoints

## 📅 Updated Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| 1 | 4 hours | Project setup, dependencies |
| 2 | 4 hours | Core CLI structure |
| 3 | 8 hours | Environment file generation |
| 4 | 8 hours | Docker operations |
| 5 | 6 hours | Database operations |
| 6 | 4 hours | Health check system |
| 7 | 4 hours | UX & output |
| 8 | 4 hours | Error handling |
| 9 | 6 hours | Testing & docs |
| 10 | 4 hours | Advanced features |
| **Total** | **52 hours** | **~3-4 days** |

## 🗂️ Files to Create/Modify

### New Files (14)
1. `setup-cli.js` - Main entry point
2. `lib/cli/prompts.js` - Interactive prompts
3. `lib/cli/validators.js` - Input validators
4. `lib/cli/generators.js` - Value generators
5. `lib/cli/writers.js` - File writers
6. `lib/cli/templates.js` - .env templates
7. `lib/cli/constants.js` - Constants
8. `lib/cli/utils.js` - Utilities
9. `lib/cli/docker.js` - **Docker operations (NEW)**
10. `lib/cli/database.js` - **Database operations (NEW)**
11. `lib/cli/health.js` - **Health checks (NEW)**
12. `documentation/cli-setup-guide.md` - User guide
13. `ENVIRONMENT_SETUP.md` - Generated after setup
14. `__tests__/setup-cli.test.js` - Tests

### Modified Files (2)
1. `package.json` - Scripts & dependencies
2. `README.md` - Updated setup instructions

## ✅ Success Criteria

- ✅ One command (`npm run setup`) takes user from zero to running platform
- ✅ Setup completes in <5 minutes (excluding Docker build on first run)
- ✅ All 3 `.env` files generated correctly
- ✅ Docker volumes created automatically
- ✅ Containers build and start successfully
- ✅ Migrations run automatically
- ✅ Seeders populate test data
- ✅ Health check verifies all services
- ✅ Clear error messages with recovery steps
- ✅ Teardown cleanly stops all services (volumes preserved)
- ✅ External volumes created before Docker starts
- ✅ Volumes never automatically deleted (manual deletion only)
- ✅ Works on Windows, macOS, Linux
- ✅ Zero manual intervention required

## 🔗 Additional Commands

### npm Scripts to Add

```json
{
  "scripts": {
    "setup": "node setup-cli.js",
    "setup:express": "node setup-cli.js --express",
    "setup:config": "node setup-cli.js --config-only",
    "setup:docker": "node setup-cli.js --docker-only",
    "setup:update": "node setup-cli.js --update",
    "setup:down": "node setup-cli.js --down",
    "setup:rebuild": "node setup-cli.js --rebuild",
    "setup:health": "node setup-cli.js --health",
    "setup:logs": "docker-compose logs",
    "setup:logs:follow": "docker-compose logs -f",
    "setup:logs:backend": "docker-compose logs backend",
    "setup:logs:frontend": "docker-compose logs frontend",
    "setup:restart": "docker-compose restart",
    "setup:restart:backend": "docker-compose restart backend",
    "setup:restart:frontend": "docker-compose restart frontend"
  }
}
```

---

**Total Estimated Effort:** 52 hours (~3-4 days full-time)  
**Complexity:** Medium-High  
**Business Value:** Very High (massive onboarding improvement)  
**Technical Debt:** None (significantly improves existing process)
