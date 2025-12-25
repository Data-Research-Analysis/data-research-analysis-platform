#!/usr/bin/env node

/**
 * Table Rename Execution Script
 * 
 * Physically renames tables to hash-based names, updates FK constraints,
 * fixes data model references, and creates metadata entries.
 * 
 * CRITICAL: This script modifies production data.  Always test on staging first!
 */

import { DataSource, QueryRunner } from 'typeorm';
import { PostgresDataSource } from '../src/datasources/PostgresDataSource.js';
import { TableMetadataService } from '../src/services/TableMetadataService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface RenameOperation {
    schema: string;
    oldName: string;
    newName: string;
    dataSourceId: number;
    usersPlatformId: number;
    logicalName: string;
    fileId: string;
    tableType: string;
}

interface RenameResult {
    success: boolean;
    tablesRenamed: number;
    dataModelsUpdated: number;
    metadataCreated: number;
    errors: string[];
    operations: Array<{
        table: string;
        status: 'SUCCESS' | 'SKIPPED' | 'FAILED';
        message: string;
    }>;
}

class TableRenameExecutor {
    private dataSource: DataSource;
    private queryRunner: QueryRunner;
    private tableMetadataService: TableMetadataService;
    private dryRun: boolean;
    private backupMetadata: Map<string, any> = new Map();
    
    constructor(dataSource: DataSource, dryRun: boolean = false) {
        this.dataSource = dataSource;
        this.queryRunner = dataSource.createQueryRunner();
        this.tableMetadataService = TableMetadataService.getInstance();
        this.dryRun = dryRun;
    }
    
    /**
     * Execute rename plan
     */
    async execute(planPath: string): Promise<RenameResult> {
        const result: RenameResult = {
            success: false,
            tablesRenamed: 0,
            dataModelsUpdated: 0,
            metadataCreated: 0,
            errors: [],
            operations: []
        };
        
        try {
            // Load rename plan
            const plan = JSON.parse(fs.readFileSync(planPath, 'utf-8'));
            
            console.log(`📋 Loaded rename plan with ${plan.tables.length} tables`);
            console.log(`🎯 Mode: ${this.dryRun ? 'DRY RUN' : 'LIVE EXECUTION'}\n`);
            
            // Filter to safe-to-rename tables
            const tablesToRename = plan.tables.filter((t: any) => t.safeToRename);
            
            if (tablesToRename.length === 0) {
                console.log('✅ No tables need renaming');
                result.success = true;
                return result;
            }
            
            console.log(`📊 Renaming ${tablesToRename.length} tables...\n`);
            
            // Start transaction
            if (!this.dryRun) {
                await this.queryRunner.startTransaction();
                console.log('🔒 Transaction started\n');
            }
            
            try {
                // Group by schema for ordered execution
                const bySchema = this.groupBySchema(tablesToRename);
                
                for (const [schema, tables] of Object.entries(bySchema)) {
                    console.log(`\n📂 Processing schema: ${schema}`);
                    console.log('─'.repeat(80));
                    
                    for (const table of tables) {
                        const operation = await this.renameTable(table, result);
                        result.operations.push(operation);
                    }
                }
                
                // Commit transaction
                if (!this.dryRun) {
                    await this.queryRunner.commitTransaction();
                    console.log('\n✅ Transaction committed successfully');
                }
                
                result.success = true;
            } catch (error) {
                // Rollback on error
                if (!this.dryRun) {
                    await this.queryRunner.rollbackTransaction();
                    console.error('\n❌ Transaction rolled back due to error');
                }
                throw error;
            }
            
        } catch (error) {
            result.success = false;
            result.errors.push(error instanceof Error ? error.message : String(error));
            console.error('\n❌ Rename execution failed:', error);
        } finally {
            await this.queryRunner.release();
        }
        
        return result;
    }
    
    /**
     * Rename a single table
     */
    private async renameTable(table: any, result: RenameResult): Promise<any> {
        const operation = {
            table: `${table.schema}.${table.currentName}`,
            status: 'FAILED' as 'SUCCESS' | 'SKIPPED' | 'FAILED',
            message: ''
        };
        
        try {
            console.log(`\n  🔄 ${table.currentName} → ${table.proposedName}`);
            
            // Skip if no data source ID
            if (!table.dataSourceId) {
                operation.status = 'SKIPPED';
                operation.message = 'No data source ID found';
                console.log(`     ⏭️  SKIPPED: ${operation.message}`);
                return operation;
            }
            
            // Check if target name already exists
            const exists = await this.checkTableExists(table.schema, table.proposedName);
            if (exists) {
                operation.status = 'SKIPPED';
                operation.message = 'Target name already exists';
                console.log(`     ⏭️  SKIPPED: ${operation.message}`);
                return operation;
            }
            
            // Step 1: Rename the physical table
            await this.renamePhysicalTable(table.schema, table.currentName, table.proposedName);
            console.log(`     ✓ Table renamed`);
            
            // Step 2: Update data model references
            const modelsUpdated = await this.updateDataModelReferences(
                table.schema,
                table.currentName,
                table.proposedName,
                table.usedInDataModels
            );
            result.dataModelsUpdated += modelsUpdated;
            if (modelsUpdated > 0) {
                console.log(`     ✓ Updated ${modelsUpdated} data model(s)`);
            }
            
            // Step 3: Create metadata entry
            await this.createMetadataEntry(table);
            result.metadataCreated++;
            console.log(`     ✓ Metadata created`);
            
            result.tablesRenamed++;
            operation.status = 'SUCCESS';
            operation.message = `Renamed successfully, ${modelsUpdated} model(s) updated`;
            
            console.log(`     ✅ SUCCESS`);
            
        } catch (error) {
            operation.status = 'FAILED';
            operation.message = error instanceof Error ? error.message : String(error);
            result.errors.push(`${table.schema}.${table.currentName}: ${operation.message}`);
            console.error(`     ❌ FAILED: ${operation.message}`);
            throw error; // Re-throw to trigger rollback
        }
        
        return operation;
    }
    
    /**
     * Check if table exists
     */
    private async checkTableExists(schema: string, tableName: string): Promise<boolean> {
        const query = `
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = $1 AND table_name = $2
            )
        `;
        
        if (this.dryRun) {
            return false;
        }
        
        const result = await this.queryRunner.query(query, [schema, tableName]);
        return result[0].exists;
    }
    
    /**
     * Rename physical table using ALTER TABLE
     */
    private async renamePhysicalTable(schema: string, oldName: string, newName: string): Promise<void> {
        const sql = `ALTER TABLE "${schema}"."${oldName}" RENAME TO "${newName}"`;
        
        if (this.dryRun) {
            console.log(`     [DRY RUN] Would execute: ${sql}`);
            return;
        }
        
        await this.queryRunner.query(sql);
    }
    
    /**
     * Update data model query_json references
     */
    private async updateDataModelReferences(
        schema: string,
        oldName: string,
        newName: string,
        dataModelIds: number[]
    ): Promise<number> {
        if (dataModelIds.length === 0) {
            return 0;
        }
        
        let updatedCount = 0;
        
        for (const modelId of dataModelIds) {
            try {
                // Get current query_json
                const modelResult = await this.queryRunner.query(
                    'SELECT id, query_json FROM dra_data_models WHERE id = $1',
                    [modelId]
                );
                
                if (modelResult.length === 0) continue;
                
                const model = modelResult[0];
                let queryJson = model.query_json;
                
                if (!queryJson || typeof queryJson !== 'object') {
                    continue;
                }
                
                let modified = false;
                
                // Update table_name in tables array
                if (queryJson.tables && Array.isArray(queryJson.tables)) {
                    queryJson.tables.forEach((table: any) => {
                        if (table.schema === schema && table.table_name === oldName) {
                            table.table_name = newName;
                            modified = true;
                        }
                    });
                }
                
                // Update generated_sql
                if (queryJson.generated_sql && typeof queryJson.generated_sql === 'string') {
                    const oldReference = `"${schema}"."${oldName}"`;
                    const newReference = `"${schema}"."${newName}"`;
                    
                    if (queryJson.generated_sql.includes(oldReference)) {
                        queryJson.generated_sql = queryJson.generated_sql.replace(
                            new RegExp(oldReference.replace(/"/g, '\\"'), 'g'),
                            newReference
                        );
                        modified = true;
                    }
                }
                
                if (modified) {
                    if (this.dryRun) {
                        console.log(`     [DRY RUN] Would update data model ${modelId}`);
                    } else {
                        await this.queryRunner.query(
                            'UPDATE dra_data_models SET query_json = $1 WHERE id = $2',
                            [JSON.stringify(queryJson), modelId]
                        );
                    }
                    updatedCount++;
                }
            } catch (error) {
                console.error(`     ⚠️  Failed to update data model ${modelId}:`, error);
            }
        }
        
        return updatedCount;
    }
    
    /**
     * Create metadata entry for renamed table
     */
    private async createMetadataEntry(table: any): Promise<void> {
        const logicalName = this.extractLogicalName(table.schema, table.currentName);
        const fileId = this.extractFileId(table.schema, table.currentName);
        const tableType = this.getTableType(table.schema);
        
        const metadata = {
            dataSourceId: table.dataSourceId,
            usersPlatformId: table.usersPlatformId,
            schemaName: table.schema,
            physicalTableName: table.proposedName,
            logicalTableName: logicalName,
            originalSheetName: logicalName,
            fileId: fileId,
            tableType: tableType
        };
        
        if (this.dryRun) {
            console.log(`     [DRY RUN] Would create metadata:`, metadata);
            return;
        }
        
        await this.tableMetadataService.storeTableMetadata(this.queryRunner.manager, metadata);
    }
    
    /**
     * Extract logical name from old table name
     */
    private extractLogicalName(schema: string, tableName: string): string {
        if (schema === 'dra_excel' || schema === 'dra_pdf') {
            const parts = tableName.split('_data_source_');
            return parts[1]?.split('_').slice(1).join(' ') || tableName;
        }
        
        // Google services - map report types
        const reportTypes: Record<string, string> = {
            'traffic_overview': 'Traffic Overview',
            'page_performance': 'Page Performance',
            'user_acquisition': 'User Acquisition',
            'geographic': 'Geographic',
            'device': 'Device',
            'events': 'Events',
            'revenue': 'Revenue',
            'geography': 'Geography',
            'ad_unit': 'Ad Unit',
            'advertiser': 'Advertiser',
            'time_series': 'Time Series',
            'campaigns': 'Campaigns',
            'keywords': 'Keywords'
        };
        
        const match = tableName.match(/^(.+)_\d+$/);
        const reportType = match ? match[1] : tableName;
        return reportTypes[reportType] || reportType;
    }
    
    /**
     * Extract file ID from old table name
     */
    private extractFileId(schema: string, tableName: string): string {
        if (schema === 'dra_excel') {
            return tableName.split('_data_source_')[0].replace('excel_', '');
        }
        if (schema === 'dra_pdf') {
            return tableName.split('_data_source_')[0].replace('pdf_', '');
        }
        return tableName;
    }
    
    /**
     * Get table type from schema
     */
    private getTableType(schema: string): string {
        const typeMap: Record<string, string> = {
            'dra_excel': 'excel',
            'dra_pdf': 'pdf',
            'dra_google_analytics': 'google_analytics',
            'dra_google_ad_manager': 'google_ad_manager',
            'dra_google_ads': 'google_ads'
        };
        return typeMap[schema] || 'unknown';
    }
    
    /**
     * Group tables by schema
     */
    private groupBySchema(tables: any[]): Record<string, any[]> {
        return tables.reduce((acc, table) => {
            if (!acc[table.schema]) {
                acc[table.schema] = [];
            }
            acc[table.schema].push(table);
            return acc;
        }, {} as Record<string, any[]>);
    }
}

/**
 * Prompt user for confirmation
 */
async function confirm(message: string): Promise<boolean> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    return new Promise((resolve) => {
        rl.question(`${message} (yes/no): `, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'yes');
        });
    });
}

/**
 * Main execution
 */
async function main() {
    console.log('═'.repeat(80));
    console.log('🔧 TABLE RENAME EXECUTION TOOL');
    console.log('═'.repeat(80));
    console.log();
    
    // Parse command line arguments
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const force = args.includes('--force');
    const planPath = args.find(arg => arg.endsWith('.json')) || 
        path.join(__dirname, '../rename-plan.json');
    
    if (!fs.existsSync(planPath)) {
        console.error(`❌ Rename plan not found: ${planPath}`);
        console.error('   Run analyze-tables-for-rename.ts first');
        process.exit(1);
    }
    
    if (!dryRun && !force) {
        console.log('⚠️  WARNING: This will physically rename tables in the database!');
        console.log('⚠️  Always test on staging environment first!');
        console.log();
        
        const confirmed = await confirm('Are you sure you want to proceed?');
        if (!confirmed) {
            console.log('❌ Aborted by user');
            process.exit(0);
        }
    }
    
    try {
        // Initialize database connection
        const dbDriver = PostgresDataSource.getInstance();
        const dataSource = dbDriver.getDataSource(
            process.env.POSTGRESQL_HOST_MIGRATIONS || process.env.POSTGRESQL_HOST || 'localhost',
            parseInt(process.env.POSTGRESQL_PORT_MIGRATIONS || process.env.POSTGRESQL_PORT || '5432'),
            process.env.POSTGRESQL_DB_NAME || 'database',
            process.env.POSTGRESQL_USERNAME || 'user',
            process.env.POSTGRESQL_PASSWORD || ''
        );
        
        await dataSource.initialize();
        
        if (!dataSource) {
            throw new Error('Failed to connect to database');
        }
        
        // Execute rename
        const executor = new TableRenameExecutor(dataSource, dryRun);
        const result = await executor.execute(planPath);
        
        // Display summary
        console.log('\n' + '═'.repeat(80));
        console.log('📊 EXECUTION SUMMARY');
        console.log('═'.repeat(80));
        console.log(`Status: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
        console.log(`Tables renamed: ${result.tablesRenamed}`);
        console.log(`Data models updated: ${result.dataModelsUpdated}`);
        console.log(`Metadata entries created: ${result.metadataCreated}`);
        
        if (result.errors.length > 0) {
            console.log(`\n❌ ERRORS (${result.errors.length}):`);
            result.errors.forEach(error => console.log(`  - ${error}`));
        }
        
        // Save result
        const resultPath = path.join(__dirname, '../rename-result.json');
        fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
        console.log(`\n📄 Full results saved to: ${resultPath}`);
        
        console.log('═'.repeat(80));
        
        process.exit(result.success ? 0 : 1);
    } catch (error) {
        console.error('\n❌ Execution failed:', error);
        process.exit(1);
    }
}

main();
