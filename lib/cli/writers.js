/**
 * File Writers
 * 
 * Functions to write .env files safely with backups.
 */

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { generateRootEnv, generateBackendEnv, generateFrontendEnv } from './templates.js';

/**
 * Create a backup of an existing file
 */
async function createBackupFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const backupPath = `${filePath}.backup-${timestamp}`;
  
  await fs.copy(filePath, backupPath);
  return backupPath;
}

/**
 * Write .env file with backup
 */
async function writeEnvFile(filePath, content, backup = true) {
  try {
    // Create backup if file exists
    let backupPath = null;
    if (backup && fs.existsSync(filePath)) {
      backupPath = await createBackupFile(filePath);
    }
    
    // Ensure directory exists
    const dir = path.dirname(filePath);
    await fs.ensureDir(dir);
    
    // Write the file
    await fs.writeFile(filePath, content, 'utf8');
    
    return {
      success: true,
      filePath,
      backupPath
    };
  } catch (error) {
    return {
      success: false,
      filePath,
      error: error.message
    };
  }
}

/**
 * Write all .env files (root, backend, frontend)
 */
async function writeAllEnvFiles(config, backup = true) {
  const results = [];
  
  // Generate content for all .env files
  const rootContent = generateRootEnv(config);
  const backendContent = generateBackendEnv(config);
  const frontendContent = generateFrontendEnv(config);
  
  // Write root .env
  console.log(chalk.cyan('\n📝 Writing environment files...\n'));
  
  const rootResult = await writeEnvFile('.env', rootContent, backup);
  results.push(rootResult);
  if (rootResult.success) {
    console.log(chalk.green('✓ ' + '.env'));
    if (rootResult.backupPath) {
      console.log(chalk.gray(`  Backup: ${path.basename(rootResult.backupPath)}`));
    }
  } else {
    console.log(chalk.red('✗ ' + '.env'));
    console.log(chalk.red(`  Error: ${rootResult.error}`));
  }
  
  // Write backend/.env
  const backendResult = await writeEnvFile('backend/.env', backendContent, backup);
  results.push(backendResult);
  if (backendResult.success) {
    console.log(chalk.green('✓ backend/.env'));
    if (backendResult.backupPath) {
      console.log(chalk.gray(`  Backup: ${path.basename(backendResult.backupPath)}`));
    }
  } else {
    console.log(chalk.red('✗ backend/.env'));
    console.log(chalk.red(`  Error: ${backendResult.error}`));
  }
  
  // Write frontend/.env
  const frontendResult = await writeEnvFile('frontend/.env', frontendContent, backup);
  results.push(frontendResult);
  if (frontendResult.success) {
    console.log(chalk.green('✓ frontend/.env'));
    if (frontendResult.backupPath) {
      console.log(chalk.gray(`  Backup: ${path.basename(frontendResult.backupPath)}`));
    }
  } else {
    console.log(chalk.red('✗ frontend/.env'));
    console.log(chalk.red(`  Error: ${frontendResult.error}`));
  }
  
  console.log(); // Empty line
  
  // Summary
  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  
  if (successCount === totalCount) {
    console.log(chalk.green(`✅ All ${totalCount} environment files written successfully!\n`));
  } else {
    console.log(chalk.yellow(`⚠️  ${successCount}/${totalCount} environment files written successfully\n`));
  }
  
  return {
    success: successCount === totalCount,
    results,
    successCount,
    totalCount
  };
}

export {
  createBackupFile,
  writeEnvFile,
  writeAllEnvFiles
};
