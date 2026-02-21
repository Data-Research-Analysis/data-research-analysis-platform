/**
 * Service management utilities
 */

import { execa } from 'execa';
import chalk from 'chalk';
import ora from 'ora';

/**
 * Available services
 */
const SERVICES = {
  backend: 'backend.dataresearchanalysis.test',
  frontend: 'frontend.dataresearchanalysis.test',
  database: 'database.dataresearchanalysis.test',
  redis: 'redis.dataresearchanalysis.test',
  'mysql-test': 'mysql-test-database.dataresearchanalysis.test',
  'mariadb-test': 'mariadb-test-database.dataresearchanalysis.test'
};

/**
 * Check if a service is running
 */
async function isServiceRunning(serviceName) {
  try {
    const containerName = SERVICES[serviceName];
    if (!containerName) {
      return false;
    }
    
    const { stdout } = await execa('docker', [
      'ps',
      '--filter', `name=^${containerName}$`,
      '--format', '{{.Names}}'
    ]);
    
    return stdout.trim() === containerName;
  } catch (error) {
    return false;
  }
}

/**
 * Restart a specific service
 */
async function restartService(serviceName) {
  const containerName = SERVICES[serviceName];
  
  if (!containerName) {
    console.log(chalk.red(`\n❌ Unknown service: ${serviceName}`));
    console.log(chalk.gray('\nAvailable services:'));
    Object.keys(SERVICES).forEach(name => {
      console.log(chalk.gray(`  - ${name}`));
    });
    console.log();
    return { success: false };
  }
  
  console.log(chalk.cyan(`\n🔄 Restarting ${serviceName}...\n`));
  
  // Check if service is running
  const checkSpinner = ora('Checking service status').start();
  const running = await isServiceRunning(serviceName);
  
  if (!running) {
    checkSpinner.warn(chalk.yellow('Service is not running'));
    console.log(chalk.gray('  Start all services with: npm run setup:docker\n'));
    return { success: false };
  }
  
  checkSpinner.succeed(chalk.green('Service is running'));
  
  // Restart the service
  const restartSpinner = ora(`Restarting ${containerName}`).start();
  
  try {
    await execa('docker', ['restart', containerName]);
    restartSpinner.succeed(chalk.green(`${serviceName} restarted successfully`));
    
    console.log(chalk.gray(`\n💡 Check logs: docker logs ${containerName}\n`));
    
    return { success: true };
  } catch (error) {
    restartSpinner.fail(chalk.red('Restart failed'));
    console.error(chalk.red(`\nError: ${error.message}\n`));
    return { success: false, error: error.message };
  }
}

/**
 * Restart multiple services
 */
async function restartServices(serviceNames) {
  console.log(chalk.cyan(`\n🔄 Restarting ${serviceNames.length} service(s)...\n`));
  
  const results = [];
  
  for (const serviceName of serviceNames) {
    const result = await restartService(serviceName);
    results.push({ service: serviceName, ...result });
  }
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(chalk.bold('\n📊 Restart Summary:'));
  console.log(chalk.green(`  ✓ Successful: ${successful}`));
  if (failed > 0) {
    console.log(chalk.red(`  ✗ Failed: ${failed}`));
  }
  console.log();
  
  return {
    success: failed === 0,
    results
  };
}

/**
 * Get status of all services
 */
async function getServicesStatus() {
  const status = {};
  
  for (const [serviceName, containerName] of Object.entries(SERVICES)) {
    try {
      const { stdout } = await execa('docker', [
        'ps',
        '--filter', `name=^${containerName}$`,
        '--format', '{{.Status}}'
      ]);
      
      if (stdout.trim()) {
        status[serviceName] = {
          running: true,
          status: stdout.trim()
        };
      } else {
        status[serviceName] = {
          running: false,
          status: 'Not running'
        };
      }
    } catch (error) {
      status[serviceName] = {
        running: false,
        status: 'Error checking status'
      };
    }
  }
  
  return status;
}

/**
 * Display services status
 */
async function displayServicesStatus() {
  console.log(chalk.bold.cyan('\n📊 Services Status:\n'));
  
  const spinner = ora('Checking services').start();
  const status = await getServicesStatus();
  spinner.stop();
  process.stdout.write('\r\x1b[K'); // Clear the current line
  
  let allRunning = true;
  
  Object.entries(status).forEach(([serviceName, info]) => {
    const icon = info.running ? chalk.green('✓') : chalk.red('✗');
    const nameDisplay = serviceName.padEnd(15);
    const statusDisplay = info.running ? chalk.green(info.status) : chalk.gray(info.status);
    
    console.log(`  ${icon} ${nameDisplay} ${statusDisplay}`);
    
    if (!info.running) {
      allRunning = false;
    }
  });
  
  console.log();
  
  if (!allRunning) {
    console.log(chalk.yellow('💡 Start services: npm run setup:docker'));
    console.log(chalk.gray('   Restart a service: node setup-cli.js --restart <service>\n'));
  }
  
  return { allRunning, status };
}

/**
 * View logs for a service
 */
async function viewLogs(serviceName, options = {}) {
  const containerName = SERVICES[serviceName];
  
  if (!containerName) {
    console.log(chalk.red(`\n❌ Unknown service: ${serviceName}`));
    console.log(chalk.gray('\nAvailable services:'));
    Object.keys(SERVICES).forEach(name => {
      console.log(chalk.gray(`  - ${name}`));
    });
    console.log();
    return { success: false };
  }
  
  console.log(chalk.cyan(`\n📜 Viewing logs for ${serviceName}...\n`));
  
  const args = ['logs'];
  
  if (options.follow) {
    args.push('-f');
  }
  
  if (options.tail) {
    args.push('--tail', options.tail.toString());
  }
  
  args.push(containerName);
  
  try {
    // For follow mode, stream directly
    if (options.follow) {
      console.log(chalk.gray(`Press Ctrl+C to stop following logs\n`));
      await execa('docker', args, { stdio: 'inherit' });
    } else {
      const { stdout } = await execa('docker', args);
      console.log(stdout);
    }
    
    console.log();
    return { success: true };
  } catch (error) {
    if (error.signal === 'SIGINT') {
      // User cancelled with Ctrl+C
      console.log(chalk.gray('\n\nStopped following logs\n'));
      return { success: true };
    }
    
    console.error(chalk.red(`\nError: ${error.message}\n`));
    return { success: false, error: error.message };
  }
}

export {
  SERVICES,
  isServiceRunning,
  restartService,
  restartServices,
  getServicesStatus,
  displayServicesStatus,
  viewLogs
};
