/**
 * Health Check System
 * 
 * Comprehensive health checks for Docker, services, and configuration.
 */

import { execa } from 'execa';
import fs from 'fs-extra';
import chalk from 'chalk';
import dotenv from 'dotenv';
import { DOCKER_VOLUMES } from './constants.js';
import { checkContainerRunning, volumeExists } from './docker.js';

/**
 * Run comprehensive health check
 */
async function runHealthCheck() {
  console.log(chalk.cyan('\n🏥 Running System Health Check\n'));
  
  const checks = [];
  
  // Docker installation checks
  checks.push(await checkDockerInstalled());
  checks.push(await checkDockerRunning());
  checks.push(await checkDockerComposeInstalled());
  
  // Configuration checks
  checks.push(await checkEnvFilesExist());
  
  // Volume checks
  checks.push(await checkDockerVolumes());
  
  // Container checks
  checks.push(await checkContainersRunning());
  
  // Display all results
  console.log();
  checks.forEach(check => displayCheckResult(check));
  
  // Summary
  const passCount = checks.filter(c => c.status === 'pass').length;
  const totalCount = checks.length;
  
  console.log();
  if (passCount === totalCount) {
    console.log(chalk.green.bold(`✅ All ${totalCount} checks passed\n`));
    return { success: true, checks };
  } else {
    console.log(chalk.yellow.bold(`⚠️  ${passCount}/${totalCount} checks passed\n`));
    return { success: false, checks };
  }
}

/**
 * Check if Docker is installed
 */
async function checkDockerInstalled() {
  try {
    await execa('docker', ['--version']);
    return {
      name: 'Docker Installation',
      status: 'pass',
      message: 'Docker is installed'
    };
  } catch (error) {
    return {
      name: 'Docker Installation',
      status: 'fail',
      message: 'Docker is not installed',
      help: 'Install Docker from https://docs.docker.com/get-docker/'
    };
  }
}

/**
 * Check if Docker daemon is running
 */
async function checkDockerRunning() {
  try {
    await execa('docker', ['info']);
    return {
      name: 'Docker Daemon',
      status: 'pass',
      message: 'Docker daemon is running'
    };
  } catch (error) {
    return {
      name: 'Docker Daemon',
      status: 'fail',
      message: 'Docker daemon is not running',
      help: 'Start Docker daemon or Docker Desktop'
    };
  }
}

/**
 * Check if docker-compose is installed
 */
async function checkDockerComposeInstalled() {
  try {
    await execa('docker-compose', ['--version']);
    return {
      name: 'Docker Compose',
      status: 'pass',
      message: 'Docker Compose is installed'
    };
  } catch (error) {
    return {
      name: 'Docker Compose',
      status: 'fail',
      message: 'Docker Compose is not installed',
      help: 'Install Docker Compose from https://docs.docker.com/compose/install/'
    };
  }
}

/**
 * Check if .env files exist
 */
async function checkEnvFilesExist() {
  const files = ['.env', 'backend/.env', 'frontend/.env'];
  const existingFiles = files.filter(f => fs.existsSync(f));
  
  if (existingFiles.length === files.length) {
    return {
      name: 'Environment Files',
      status: 'pass',
      message: `All ${files.length} .env files exist`
    };
  } else if (existingFiles.length > 0) {
    return {
      name: 'Environment Files',
      status: 'warn',
      message: `${existingFiles.length}/${files.length} .env files exist`,
      help: 'Run "npm run setup:config" to generate missing files'
    };
  } else {
    return {
      name: 'Environment Files',
      status: 'fail',
      message: 'No .env files found',
      help: 'Run "npm run setup" to generate configuration files'
    };
  }
}

/**
 * Check if Docker volumes exist
 */
async function checkDockerVolumes() {
  try {
    const volumeChecks = await Promise.all(
      DOCKER_VOLUMES.map(vol => volumeExists(vol))
    );
    
    const existingCount = volumeChecks.filter(Boolean).length;
    
    if (existingCount === DOCKER_VOLUMES.length) {
      return {
        name: 'Docker Volumes',
        status: 'pass',
        message: `All ${DOCKER_VOLUMES.length} volumes exist`
      };
    } else if (existingCount > 0) {
      return {
        name: 'Docker Volumes',
        status: 'warn',
        message: `${existingCount}/${DOCKER_VOLUMES.length} volumes exist`,
        help: 'Run "npm run setup" to create missing volumes'
      };
    } else {
      return {
        name: 'Docker Volumes',
        status: 'fail',
        message: 'No Docker volumes found',
        help: 'Run "npm run setup" to create required volumes'
      };
    }
  } catch (error) {
    return {
      name: 'Docker Volumes',
      status: 'fail',
      message: 'Cannot check volumes',
      help: 'Ensure Docker daemon is running'
    };
  }
}

/**
 * Check if containers are running
 */
async function checkContainersRunning() {
  const containers = [
    'database.dataresearchanalysis.test',
    'redis.dataresearchanalysis.test',
    'backend.dataresearchanalysis.test',
    'frontend.dataresearchanalysis.test'
  ];
  
  try {
    const containerChecks = await Promise.all(
      containers.map(c => checkContainerRunning(c))
    );
    
    const runningCount = containerChecks.filter(Boolean).length;
    
    if (runningCount === containers.length) {
      return {
        name: 'Docker Containers',
        status: 'pass',
        message: `All ${containers.length} containers are running`
      };
    } else if (runningCount > 0) {
      return {
        name: 'Docker Containers',
        status: 'warn',
        message: `${runningCount}/${containers.length} containers are running`,
        help: 'Run "docker-compose ps" to see container status'
      };
    } else {
      return {
        name: 'Docker Containers',
        status: 'fail',
        message: 'No containers are running',
        help: 'Run "npm run setup" to start containers'
      };
    }
  } catch (error) {
    return {
      name: 'Docker Containers',
      status: 'fail',
      message: 'Cannot check containers',
      help: 'Ensure Docker daemon is running'
    };
  }
}

/**
 * Check database connection using pg_isready via docker exec
 */
async function checkDatabaseConnection() {
  try {
    const { exitCode } = await execa('docker', [
      'exec', 'database.dataresearchanalysis.test', 'pg_isready'
    ], { reject: false });
    
    if (exitCode === 0) {
      return {
        name: 'Database Connection',
        status: 'pass',
        message: 'PostgreSQL is accepting connections'
      };
    }
    return {
      name: 'Database Connection',
      status: 'fail',
      message: 'PostgreSQL is not accepting connections',
      help: 'Check logs: docker-compose logs database'
    };
  } catch (error) {
    return {
      name: 'Database Connection',
      status: 'fail',
      message: `Database check failed: ${error.message}`,
      help: 'Ensure database container is running'
    };
  }
}

/**
 * Check API endpoint health
 */
async function checkAPIEndpoint() {
  try {
    const env = dotenv.config({ path: 'backend/.env' }).parsed || {};
    const port = env.PORT || 3002;
    const url = `http://localhost:${port}/health`;
    
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    
    if (response.ok) {
      return {
        name: 'API Endpoint',
        status: 'pass',
        message: `Backend API responding at ${url}`
      };
    }
    return {
      name: 'API Endpoint',
      status: 'warn',
      message: `Backend API returned status ${response.status}`,
      help: 'Check logs: docker-compose logs backend'
    };
  } catch (error) {
    return {
      name: 'API Endpoint',
      status: 'fail',
      message: 'Backend API is not reachable',
      help: 'Ensure backend container is running: docker-compose logs backend'
    };
  }
}

/**
 * Display health check result
 */
function displayCheckResult(result) {
  const icon = {
    pass: chalk.green('✓'),
    fail: chalk.red('✗'),
    warn: chalk.yellow('⚠')
  }[result.status];
  
  const statusColor = {
    pass: chalk.green,
    fail: chalk.red,
    warn: chalk.yellow
  }[result.status];
  
  console.log(`${icon} ${chalk.bold(result.name)}: ${statusColor(result.message)}`);
  
  if (result.help) {
    console.log(chalk.gray(`    → ${result.help}`));
  }
}

export {
  runHealthCheck,
  checkDockerInstalled,
  checkDockerRunning,
  checkDockerComposeInstalled,
  checkEnvFilesExist,
  checkDockerVolumes,
  checkContainersRunning,
  checkDatabaseConnection,
  checkAPIEndpoint,
  displayCheckResult
};
