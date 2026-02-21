/**
 * Health Check System
 * 
 * Comprehensive health checks for Docker, services, and configuration.
 */

const execa = require('execa');
const fs = require('fs-extra');
const chalk = require('chalk');
const { DOCKER_VOLUMES } = require('./constants.js');
const { checkContainerRunning, volumeExists } = require('./docker.js');

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
 * Check database connection
 */
async function checkDatabaseConnection() {
  // TODO: Implement actual database connection test
  return {
    name: 'Database Connection',
    status: 'warn',
    message: 'Database connection test not yet implemented'
  };
}

/**
 * Check API endpoint
 */
async function checkAPIEndpoint() {
  // TODO: Implement actual API endpoint test
  return {
    name: 'API Endpoint',
    status: 'warn',
    message: 'API endpoint test not yet implemented'
  };
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

module.exports = {
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
