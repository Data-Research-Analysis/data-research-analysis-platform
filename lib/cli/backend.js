/**
 * Backend Operations
 * 
 * Functions for running migrations and seeders from the backend project directory.
 */

import { execa } from 'execa';
import ora from 'ora';
import chalk from 'chalk';

/**
 * Check if backend container is running
 */
async function checkBackendContainer() {
  try {
    const { stdout } = await execa('docker', [
      'ps',
      '--filter', 'name=backend.dataresearchanalysis.test',
      '--filter', 'status=running',
      '--format', '{{.Names}}'
    ]);
    
    return stdout.trim() === 'backend.dataresearchanalysis.test';
  } catch (error) {
    return false;
  }
}

/**
 * Run database migrations inside backend container
 */
async function runMigrations() {
  console.log(chalk.cyan('\n📊 Running database migrations...\n'));
  
  // Check if backend container is running
  const spinner = ora('Checking backend container').start();
  const isRunning = await checkBackendContainer();
  
  if (!isRunning) {
    spinner.fail(chalk.red('Backend container is not running'));
    console.log(chalk.yellow('\n💡 Start containers first: npm run setup:docker\n'));
    return { success: false, error: 'Backend container not running' };
  }
  
  spinner.succeed(chalk.green('Backend container is running'));
  
  // Run migrations from the backend project directory
  const migrationSpinner = ora('Executing migrations').start();
  
  try {
    const { stdout, stderr } = await execa('npm', [
      'run', 'typeorm', 'migration:run',
      '--', '-d', './src/datasources/PostgresDSMigrations.ts'
    ], { cwd: 'backend' });
    
    migrationSpinner.succeed(chalk.green('Migrations executed'));
    
    // Parse and display results
    const output = stdout + stderr;
    const migrations = parseMigrationOutput(output);
    
    console.log();
    if (migrations.length > 0) {
      console.log(chalk.green(`✅ ${migrations.length} migration(s) executed:\n`));
      migrations.forEach(migration => {
        console.log(chalk.gray(`  - ${migration}`));
      });
    } else if (output.includes('No migrations are pending')) {
      console.log(chalk.cyan('✅ No pending migrations - database is up to date'));
    } else {
      console.log(chalk.cyan('✅ Migrations completed'));
    }
    
    console.log();
    return { success: true, migrations, output };
  } catch (error) {
    migrationSpinner.fail(chalk.red('Migration failed'));
    
    console.error(chalk.red(`\nError: ${error.message}`));
    
    if (error.stdout) {
      console.log(chalk.gray('\nStdout:'));
      console.log(chalk.gray(error.stdout));
    }
    if (error.stderr) {
      console.log(chalk.gray('\nStderr:'));
      console.log(chalk.gray(error.stderr));
    }
    
    console.log(chalk.yellow('\n💡 Troubleshooting:'));
    console.log(chalk.gray('  - Check database connection in backend/.env'));
    console.log(chalk.gray('  - Verify PostgreSQL container is running'));
    console.log(chalk.gray('  - Check logs: docker-compose logs backend\n'));
    
    return { success: false, error: error.message };
  }
}

/**
 * Run database seeders inside backend container
 */
async function runSeeders() {
  console.log(chalk.cyan('\n🌱 Running database seeders...\n'));
  
  // Check if backend container is running
  const spinner = ora('Checking backend container').start();
  const isRunning = await checkBackendContainer();
  
  if (!isRunning) {
    spinner.fail(chalk.red('Backend container is not running'));
    console.log(chalk.yellow('\n💡 Start containers first: npm run setup:docker\n'));
    return { success: false, error: 'Backend container not running' };
  }
  
  spinner.succeed(chalk.green('Backend container is running'));
  
  // Run seeders from the backend project directory
  const seederSpinner = ora('Executing seeders').start();
  
  try {
    const { stdout, stderr } = await execa('npm', [
      'run', 'seed:run',
      '--', '-d', './src/datasources/PostgresDSMigrations.ts',
      'src/seeders/*.ts'
    ], { cwd: 'backend', shell: true });
    
    seederSpinner.succeed(chalk.green('Seeders executed'));
    
    // Parse and display results
    const output = stdout + stderr;
    const seeders = parseSeederOutput(output);
    
    console.log();
    if (seeders.length > 0) {
      console.log(chalk.green(`✅ ${seeders.length} seeder(s) executed:\n`));
      seeders.forEach(seeder => {
        console.log(chalk.gray(`  - ${seeder}`));
      });
    } else {
      console.log(chalk.cyan('✅ Seeders completed'));
    }
    
    console.log();
    return { success: true, seeders, output };
  } catch (error) {
    seederSpinner.fail(chalk.red('Seeder failed'));
    
    console.error(chalk.red(`\nError: ${error.message}`));
    
    if (error.stdout) {
      console.log(chalk.gray('\nStdout:'));
      console.log(chalk.gray(error.stdout));
    }
    if (error.stderr) {
      console.log(chalk.gray('\nStderr:'));
      console.log(chalk.gray(error.stderr));
    }
    
    console.log(chalk.yellow('\n💡 Troubleshooting:'));
    console.log(chalk.gray('  - Ensure migrations have been run first'));
    console.log(chalk.gray('  - Check database connection in backend/.env'));
    console.log(chalk.gray('  - Check logs: docker-compose logs backend\n'));
    
    return { success: false, error: error.message };
  }
}

/**
 * Parse TypeORM migration output
 */
function parseMigrationOutput(output) {
  if (!output) return [];
  
  // Match migration execution messages
  const migrationRegex = /Migration\s+(.+?)\s+has been executed successfully/gi;
  const matches = [];
  let match;
  
  while ((match = migrationRegex.exec(output)) !== null) {
    matches.push(match[1]);
  }
  
  return matches;
}

/**
 * Parse seeder output
 */
function parseSeederOutput(output) {
  if (!output) return [];
  
  // Match seeder execution messages
  const seederRegex = /Seeding\s+(.+?)\.{3}/gi;
  const matches = [];
  let match;
  
  while ((match = seederRegex.exec(output)) !== null) {
    matches.push(match[1]);
  }
  
  // If no matches, try alternative patterns
  if (matches.length === 0) {
    const altRegex = /Running\s+(.+?Seeder)/gi;
    while ((match = altRegex.exec(output)) !== null) {
      matches.push(match[1]);
    }
  }
  
  return matches;
}

/**
 * Install npm dependencies in frontend and backend folders
 */
async function installDependencies() {
  console.log(chalk.cyan('\n📦 Installing npm dependencies...\n'));

  const dirs = ['backend', 'frontend'];

  for (const dir of dirs) {
    const spinner = ora(`Installing packages in ${dir}/`).start();
    try {
      await execa('npm', ['install'], { cwd: dir });
      spinner.succeed(chalk.green(`Packages installed in ${dir}/`));
    } catch (error) {
      spinner.fail(chalk.red(`Failed to install packages in ${dir}/`));
      console.error(chalk.gray(error.message));
      return { success: false, error: error.message };
    }
  }

  return { success: true };
}

export {
  runMigrations,
  runSeeders,
  installDependencies,
  checkBackendContainer,
  parseMigrationOutput,
  parseSeederOutput
};
