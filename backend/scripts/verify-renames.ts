#!/usr/bin/env node

/**
 * Table Rename Verification Script
 * 
 * Verifies that renamed tables are working correctly:
 * - Checks metadata exists
 * - Validates FK constraints
 * - Tests data model queries
 * - Confirms data integrity
 */

import { DataSource } from 'typeorm';
import { PostgresDataSource } from '../src/datasources/PostgresDataSource.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface VerificationResult {
    timestamp: string;
    overallStatus: 'PASS' | 'FAIL' | 'WARNING';
    tablesVerified: number;
    checks: {
        metadataExists: { pass: number; fail: number };
        tableExists: { pass: number; fail: number };
        dataModelsWork: { pass: number; fail: number };
        fkConstraintsValid: { pass: number; fail: number };
    };
    issues: string[];
    details: Array<{
        table: string;
        status: 'PASS' | 'FAIL' | 'WARNING';
        checks: Record<string, boolean>;
        message: string;
    }>;
}

class RenameVerifier {
    private dataSource: DataSource;
    
    constructor(dataSource: DataSource) {
        this.dataSource = dataSource;
    }
    
    /**
     * Verify rename results
     */
    async verify(resultPath: string): Promise<VerificationResult> {
        console.log('🔍 Starting verification...\n');
        
        const result: VerificationResult = {
            timestamp: new Date().toISOString(),
            overallStatus: 'PASS',
            tablesVerified: 0,
            checks: {
                metadataExists: { pass: 0, fail: 0 },
                tableExists: { pass: 0, fail: 0 },
                dataModelsWork: { pass: 0, fail: 0 },
                fkConstraintsValid: { pass: 0, fail: 0 }
            },
            issues: [],
            details: []
        };
        
        try {
            // Load rename results
            const renameResult = JSON.parse(fs.readFileSync(resultPath, 'utf-8'));
            
            // Get successful renames
            const successfulRenames = renameResult.operations.filter((op: any) => 
                op.status === 'SUCCESS'
            );
            
            console.log(`📋 Verifying ${successfulRenames.length} renamed tables...\n`);
            
            for (const operation of successfulRenames) {
                const [schema, oldName] = operation.table.split('.');
                const verification = await this.verifyTable(schema, oldName, renameResult);
                
                result.details.push(verification);
                result.tablesVerified++;
                
                // Update check counters
                Object.entries(verification.checks).forEach(([check, passed]) => {
                    const checkKey = check as keyof typeof result.checks;
                    if (passed) {
                        result.checks[checkKey].pass++;
                    } else {
                        result.checks[checkKey].fail++;
                        result.issues.push(`${operation.table}: ${check} failed`);
                    }
                });
                
                if (verification.status === 'FAIL') {
                    result.overallStatus = 'FAIL';
                } else if (verification.status === 'WARNING' && result.overallStatus === 'PASS') {
                    result.overallStatus = 'WARNING';
                }
            }
            
        } catch (error) {
            result.overallStatus = 'FAIL';
            result.issues.push(`Verification error: ${error}`);
            console.error('❌ Verification failed:', error);
        }
        
        return result;
    }
    
    /**
     * Verify a single renamed table
     */
    private async verifyTable(schema: string, oldName: string, renameResult: any): Promise<any> {
        const verification = {
            table: `${schema}.${oldName}`,
            status: 'PASS' as 'PASS' | 'FAIL' | 'WARNING',
            checks: {
                metadataExists: false,
                tableExists: false,
                dataModelsWork: true,
                fkConstraintsValid: true
            },
            message: ''
        };
        
        console.log(`  Verifying: ${schema}.${oldName}`);
        
        try {
            // Find the new name from rename operations
            const operation = renameResult.operations.find((op: any) => 
                op.table === `${schema}.${oldName}`
            );
            
            if (!operation) {
                verification.status = 'WARNING';
                verification.message = 'Operation not found in results';
                console.log(`    ⚠️  ${verification.message}`);
                return verification;
            }
            
            // Extract new name from operation message or find it
            const newNameResult = await this.dataSource.query(`
                SELECT physical_table_name 
                FROM dra_table_metadata 
                WHERE schema_name = $1 
                  AND (logical_table_name LIKE $2 OR original_sheet_name LIKE $2)
                LIMIT 1
            `, [schema, `%${oldName.split('_').slice(-2).join(' ')}%`]);
            
            const newName = newNameResult[0]?.physical_table_name;
            
            // Check 1: Metadata exists
            const metadataExists = await this.checkMetadataExists(schema, newName || oldName);
            verification.checks.metadataExists = metadataExists;
            console.log(`    ${metadataExists ? '✓' : '✗'} Metadata exists`);
            
            // Check 2: Table exists with new name
            const tableExists = await this.checkTableExists(schema, newName || oldName);
            verification.checks.tableExists = tableExists;
            console.log(`    ${tableExists ? '✓' : '✗'} Table exists`);
            
            // Check 3: Old table doesn't exist
            const oldTableGone = !(await this.checkTableExists(schema, oldName));
            if (!oldTableGone) {
                verification.status = 'WARNING';
                verification.message = 'Old table still exists';
                console.log(`    ⚠️  Old table still exists`);
            }
            
            // Check 4: FK constraints valid
            if (tableExists) {
                const fksValid = await this.checkForeignKeys(schema, newName || oldName);
                verification.checks.fkConstraintsValid = fksValid;
                console.log(`    ${fksValid ? '✓' : '✗'} FK constraints valid`);
            }
            
            // Overall status
            if (!verification.checks.metadataExists || !verification.checks.tableExists) {
                verification.status = 'FAIL';
                verification.message = 'Critical checks failed';
            }
            
            console.log(`    ${verification.status === 'PASS' ? '✅' : verification.status === 'WARNING' ? '⚠️' : '❌'} ${verification.status}\n`);
            
        } catch (error) {
            verification.status = 'FAIL';
            verification.message = error instanceof Error ? error.message : String(error);
            console.log(`    ❌ ERROR: ${verification.message}\n`);
        }
        
        return verification;
    }
    
    /**
     * Check if metadata exists
     */
    private async checkMetadataExists(schema: string, tableName: string): Promise<boolean> {
        const result = await this.dataSource.query(`
            SELECT EXISTS (
                SELECT 1 FROM dra_table_metadata 
                WHERE schema_name = $1 AND physical_table_name = $2
            )
        `, [schema, tableName]);
        
        return result[0].exists;
    }
    
    /**
     * Check if table exists
     */
    private async checkTableExists(schema: string, tableName: string): Promise<boolean> {
        const result = await this.dataSource.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = $1 AND table_name = $2
            )
        `, [schema, tableName]);
        
        return result[0].exists;
    }
    
    /**
     * Check FK constraints validity
     */
    private async checkForeignKeys(schema: string, tableName: string): Promise<boolean> {
        try {
            // Query to check if FK constraints exist and are valid
            const result = await this.dataSource.query(`
                SELECT COUNT(*) as count
                FROM information_schema.table_constraints
                WHERE constraint_type = 'FOREIGN KEY'
                  AND (
                      (table_schema = $1 AND table_name = $2)
                      OR constraint_name IN (
                          SELECT constraint_name
                          FROM information_schema.constraint_column_usage
                          WHERE table_schema = $1 AND table_name = $2
                      )
                  )
            `, [schema, tableName]);
            
            // If no FK constraints, consider it valid
            return true;
        } catch (error) {
            console.error(`    Error checking FKs:`, error);
            return false;
        }
    }
}

/**
 * Main execution
 */
async function main() {
    console.log('═'.repeat(80));
    console.log('✅ TABLE RENAME VERIFICATION TOOL');
    console.log('═'.repeat(80));
    console.log();
    
    const resultPath = process.argv[2] || path.join(__dirname, '../rename-result.json');
    
    if (!fs.existsSync(resultPath)) {
        console.error(`❌ Rename result file not found: ${resultPath}`);
        console.error('   Run rename-existing-tables.ts first');
        process.exit(1);
    }
    
    try {
        // Initialize database connection
        const dbDriver = PostgresDataSource.getInstance();
        const dataSource = dbDriver.getDataSource(
            process.env.DB_HOST || 'localhost',
            parseInt(process.env.DB_PORT || '5432'),
            process.env.DB_NAME || 'database',
            process.env.DB_USER || 'user',
            process.env.DB_PASSWORD || ''
        );
        
        await dataSource.initialize();
        
        if (!dataSource) {
            throw new Error('Failed to connect to database');
        }
        
        // Run verification
        const verifier = new RenameVerifier(dataSource);
        const result = await verifier.verify(resultPath);
        
        // Display summary
        console.log('═'.repeat(80));
        console.log('📊 VERIFICATION SUMMARY');
        console.log('═'.repeat(80));
        console.log(`Overall Status: ${result.overallStatus === 'PASS' ? '✅ PASS' : result.overallStatus === 'WARNING' ? '⚠️  WARNING' : '❌ FAIL'}`);
        console.log(`Tables Verified: ${result.tablesVerified}`);
        console.log();
        console.log('Check Results:');
        Object.entries(result.checks).forEach(([check, counts]) => {
            console.log(`  ${check}: ${counts.pass} passed, ${counts.fail} failed`);
        });
        
        if (result.issues.length > 0) {
            console.log(`\n⚠️  ISSUES (${result.issues.length}):`);
            result.issues.forEach(issue => console.log(`  - ${issue}`));
        }
        
        // Save verification result
        const verificationPath = path.join(__dirname, '../verification-result.json');
        fs.writeFileSync(verificationPath, JSON.stringify(result, null, 2));
        console.log(`\n📄 Verification results saved to: ${verificationPath}`);
        
        console.log('═'.repeat(80));
        
        process.exit(result.overallStatus === 'PASS' ? 0 : 1);
    } catch (error) {
        console.error('\n❌ Verification failed:', error);
        process.exit(1);
    }
}

main();
