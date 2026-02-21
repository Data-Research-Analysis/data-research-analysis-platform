/**
 * Docker Operations
 * 
 * Functions for Docker volume management, compose operations, and health checks.
 */

import { execa } from 'execa';
import ora from 'ora';
import chalk from 'chalk';
import pRetry from 'p-retry';
import { DOCKER_VOLUMES } from './constants.js';

/**
 * Check if a Docker volume exists
 */
async function volumeExists(volumeName) {
  try {
    const { stdout } = await execa('docker', ['volume', 'ls', '--format', '{{.Name}}']);
    const volumes = stdout.split('\n').filter(Boolean);
    return volumes.includes(volumeName);
  } catch (error) {
    return false;
  }
}

/**
 * Create a single Docker volume
 */
async function createVolume(volumeName) {
  try {
    const exists = await volumeExists(volumeName);
    
    if (exists) {
      return {
        success: true,
        volumeName,
        created: false,
        message: 'Already exists'
      };
    }
    
    await execa('docker', ['volume', 'create', volumeName]);
    
    return {
      success: true,
      volumeName,
      created: true,
      message: 'Created successfully'
    };
  } catch (error) {
    return {
      success: false,
      volumeName,
      created: false,
      message: error.message
    };
  }
}

/**
 * Create external Docker volumes BEFORE starting docker-compose.
 * These volumes are referenced in docker-compose.yml as external: true
 * and MUST exist before containers start.
 * 
 * IMPORTANT: These volumes are NEVER automatically deleted.
 */
async function createRequiredVolumes() {
  console.log(chalk.cyan('\n🐋 Creating required Docker volumes...\n'));
  
  const results = [];
  
  for (const volumeName of DOCKER_VOLUMES) {
    const spinner = ora(`Creating volume: ${volumeName}`).start();
    const result = await createVolume(volumeName);
    results.push(result);
    
    if (result.success) {
      if (result.created) {
        spinner.succeed(chalk.green(`${volumeName} - Created`));
      } else {
        spinner.succeed(chalk.gray(`${volumeName} - Already exists`));
      }
    } else {
      spinner.fail(chalk.red(`${volumeName} - Failed: ${result.message}`));
    }
  }
  
  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  
  console.log();
  
  if (successCount === totalCount) {
    console.log(chalk.green(`✅ All ${totalCount} volumes ready\n`));
    return { success: true, results };
  } else {
    console.log(chalk.red(`❌ ${totalCount - successCount}/${totalCount} volumes failed\n`));
    return { success: false, results };
  }
}

/**
 * Build Docker Compose images
 */
async function buildDockerCompose() {
  console.log(chalk.cyan('\n🔨 Building Docker images...\n'));
  
  const spinner = ora('Running docker-compose build').start();
  
  try {
    const { stdout, stderr } = await execa('docker-compose', ['build'], {
      all: true
    });
    
    spinner.succeed(chalk.green('Docker images built successfully'));
    
    // Show build output if there were any messages
    if (stderr || stdout) {
      console.log(chalk.gray('\nBuild output:'));
      if (stdout) console.log(chalk.gray(stdout));
      if (stderr) console.log(chalk.gray(stderr));
    }
    
    console.log();
    return { success: true };
  } catch (error) {
    spinner.fail(chalk.red('Docker build failed'));
    console.error(chalk.red(`\nError: ${error.message}`));
    
    if (error.stdout) {
      console.log(chalk.gray('\nStdout:'));
      console.log(chalk.gray(error.stdout));
    }
    if (error.stderr) {
      console.log(chalk.gray('\nStderr:'));
      console.log(chalk.gray(error.stderr));
    }
    
    console.log();
    return { success: false, error: error.message };
  }
}

/**
 * Start Docker Compose containers
 */
async function startDockerCompose(detached = true) {
  console.log(chalk.cyan('\n🚀 Starting Docker containers...\n'));
  
  const args = ['up'];
  if (detached) {
    args.push('-d');
  }
  
  const spinner = ora('Running docker-compose up').start();
  
  try {
    const { stdout, stderr } = await execa('docker-compose', args, {
      all: true
    });
    
    spinner.succeed(chalk.green('Docker containers started'));
    
    // Show startup output
    if (stderr || stdout) {
      console.log(chalk.gray('\nStartup output:'));
      if (stdout) console.log(chalk.gray(stdout));
      if (stderr) console.log(chalk.gray(stderr));
    }
    
    console.log();
    return { success: true };
  } catch (error) {
    spinner.fail(chalk.red('Docker startup failed'));
    console.error(chalk.red(`\nError: ${error.message}`));
    
    if (error.stdout) {
      console.log(chalk.gray('\nStdout:'));
      console.log(chalk.gray(error.stdout));
    }
    if (error.stderr) {
      console.log(chalk.gray('\nStderr:'));
      console.log(chalk.gray(error.stderr));
    }
    
    console.log();
    return { success: false, error: error.message };
  }
}

/**
 * Check if a container is running
 */
async function checkContainerRunning(containerName) {
  try {
    const { stdout } = await execa('docker', [
      'ps',
      '--filter', `name=${containerName}`,
      '--filter', 'status=running',
      '--format', '{{.Names}}'
    ]);
    
    return stdout.trim() === containerName;
  } catch (error) {
    return false;
  }
}

/**
 * Wait for services to be healthy (with retry logic)
 */
async function waitForServicesHealthy() {
  console.log(chalk.cyan('\n🏥 Waiting for services to be healthy...\n'));
  
  const services = [
    { name: 'database.dataresearchanalysis.test', displayName: 'PostgreSQL Database' },
    { name: 'redis.dataresearchanalysis.test', displayName: 'Redis' },
    { name: 'backend.dataresearchanalysis.test', displayName: 'Backend API' },
    { name: 'frontend.dataresearchanalysis.test', displayName: 'Frontend' }
  ];
  
  const results = [];
  
  for (const service of services) {
    const spinner = ora(`Checking ${service.displayName}`).start();
    
    try {
      const isRunning = await pRetry(
        async () => {
          const running = await checkContainerRunning(service.name);
          if (!running) {
            throw new Error(`Container ${service.name} not running yet`);
          }
          return running;
        },
        {
          retries: 30,
          minTimeout: 1000,
          maxTimeout: 2000
        }
      );
      
      if (isRunning) {
        spinner.succeed(chalk.green(`${service.displayName} - Running`));
        results.push({ service: service.name, success: true });
      } else {
        spinner.fail(chalk.red(`${service.displayName} - Not running`));
        results.push({ service: service.name, success: false });
      }
    } catch (error) {
      spinner.fail(chalk.red(`${service.displayName} - Timeout`));
      results.push({ service: service.name, success: false, error: 'Timeout' });
    }
  }
  
  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  
  console.log();
  
  if (successCount === totalCount) {
    console.log(chalk.green(`✅ All ${totalCount} services are healthy\n`));
    return { success: true, results };
  } else {
    console.log(chalk.yellow(`⚠️  ${successCount}/${totalCount} services are healthy\n`));
    return { success: false, results };
  }
}

/**
 * Check if a service is healthy (port connectivity check)
 */
async function checkServiceHealth(service) {
  try {
    const isRunning = await checkContainerRunning(service.containerName);
    
    return {
      service: service.name,
      status: isRunning ? 'healthy' : 'unhealthy',
      running: isRunning
    };
  } catch (error) {
    return {
      service: service.name,
      status: 'error',
      running: false,
      error: error.message
    };
  }
}

/**
 * Stop and remove containers.
 * NEVER removes volumes - they are external and must be manually deleted.
 */
async function teardownDockerCompose(removeOrphans = true) {
  console.log(chalk.cyan('\n🔽 Stopping Docker containers...\n'));
  
  const args = ['down'];
  if (removeOrphans) {
    args.push('--remove-orphans');
  }
  
  const spinner = ora('Running docker-compose down').start();
  
  try {
    const { stdout, stderr } = await execa('docker-compose', args, {
      all: true
    });
    
    spinner.succeed(chalk.green('Docker containers stopped'));
    
    // Show teardown output
    if (stderr || stdout) {
      console.log(chalk.gray('\nTeardown output:'));
      if (stdout) console.log(chalk.gray(stdout));
      if (stderr) console.log(chalk.gray(stderr));
    }
    
    console.log();
    console.log(chalk.yellow('💡 Note: External volumes were NOT deleted'));
    console.log(chalk.gray('   To remove volumes manually:'));
    DOCKER_VOLUMES.forEach(vol => {
      console.log(chalk.gray(`   docker volume rm ${vol}`));
    });
    console.log();
    
    return { success: true };
  } catch (error) {
    spinner.fail(chalk.red('Docker teardown failed'));
    console.error(chalk.red(`\nError: ${error.message}`));
    
    if (error.stdout) {
      console.log(chalk.gray('\nStdout:'));
      console.log(chalk.gray(error.stdout));
    }
    if (error.stderr) {
      console.log(chalk.gray('\nStderr:'));
      console.log(chalk.gray(error.stderr));
    }
    
    console.log();
    return { success: false, error: error.message };
  }
}

/**
 * Rebuild Docker images
 */
async function rebuildDockerCompose() {
  console.log(chalk.cyan('\n🔨 Rebuilding Docker images...\n'));
  
  // First, stop containers
  const teardownResult = await teardownDockerCompose();
  if (!teardownResult.success) {
    return { success: false, error: 'Teardown failed' };
  }
  
  // Build with --no-cache to force rebuild
  const spinner = ora('Running docker-compose build --no-cache').start();
  
  try {
    const { stdout, stderr } = await execa('docker-compose', ['build', '--no-cache'], {
      all: true
    });
    
    spinner.succeed(chalk.green('Docker images rebuilt'));
    
    // Show build output if there were any messages
    if (stderr || stdout) {
      console.log(chalk.gray('\nBuild output:'));
      if (stdout) console.log(chalk.gray(stdout));
      if (stderr) console.log(chalk.gray(stderr));
    }
    
    console.log();
    return { success: true };
  } catch (error) {
    spinner.fail(chalk.red('Docker rebuild failed'));
    console.error(chalk.red(`\nError: ${error.message}`));
    
    if (error.stdout) {
      console.log(chalk.gray('\nStdout:'));
      console.log(chalk.gray(error.stdout));
    }
    if (error.stderr) {
      console.log(chalk.gray('\nStderr:'));
      console.log(chalk.gray(error.stderr));
    }
    
    console.log();
    return { success: false, error: error.message };
  }
}

export {
  createRequiredVolumes,
  buildDockerCompose,
  startDockerCompose,
  waitForServicesHealthy,
  checkServiceHealth,
  teardownDockerCompose,
  rebuildDockerCompose,
  volumeExists,
  createVolume,
  checkContainerRunning
};
