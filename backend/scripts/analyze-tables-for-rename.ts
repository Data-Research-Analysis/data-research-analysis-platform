#!/usr/bin/env node

/**
 * Table Rename Analysis Script
 * 
 * Analyzes existing tables to identify candidates for renaming to hash-based names.
 * Generates a detailed rename plan with dependency information.
 */

import { DataSource } from 'typeorm';
import { PostgresDataSource } from '../src/datasources/PostgresDataSource.js';
import { TableMetadataService } from '../src/services/TableMetadataService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface TableRenameCandidate {
    schema: string;
    currentName: string;
    currentNameLength: number;
    proposedName: string;
    dataSourceId: number | null;
    usersPlatformId: number | null;
    hasMetadata: boolean;
    hasIncomingFKs: boolean;
    hasOutgoingFKs: boolean;
    incomingFKs: Array<{ schema: string; table: string; column: string }>;
    outgoingFKs: Array<{ schema: string; table: string; column: string }>;
    usedInDataModels: number[];
    estimatedImpact: 'LOW' | 'MEDIUM' | 'HIGH';
    safeToRename: boolean;
    notes: string[];
}

interface RenamePlan {
    timestamp: string;
    totalTablesAnalyzed: number;
    tablesToRename: number;
    schemaBreakdown: Record<string, number>;
    riskAssessment: {
        low: number;
        medium: number;
        high: number;
    };
    tables: TableRenameCandidate[];
    warnings: string[];
    recommendations: string[];
}

class TableRenameAnalyzer {
    private dataSource: DataSource;
    private tableMetadataService: TableMetadataService;
    
    constructor(dataSource: DataSource) {
        this.dataSource = dataSource;
        this.tableMetadataService = TableMetadataService.getInstance();
    }
    
    /**
     * Main analysis method
     */
    async analyze(): Promise<RenamePlan> {
        console.log('🔍 Starting Table Rename Analysis...\n');
        
        const schemas = ['dra_excel', 'dra_pdf', 'dra_google_analytics', 'dra_google_ad_manager', 'dra_google_ads'];
        const candidates: TableRenameCandidate[] = [];
        const warnings: string[] = [];
        const recommendations: string[] = [];
        
        for (const schema of schemas) {
            console.log(`📊 Analyzing schema: ${schema}...`);
            const schemaCandidates = await this.analyzeSchema(schema);
            candidates.push(...schemaCandidates);
        }
        
        // Generate statistics
        const schemaBreakdown: Record<string, number> = {};
        const riskAssessment = { low: 0, medium: 0, high: 0 };
        
        candidates.forEach(candidate => {
            schemaBreakdown[candidate.schema] = (schemaBreakdown[candidate.schema] || 0) + 1;
            riskAssessment[candidate.estimatedImpact.toLowerCase() as 'low' | 'medium' | 'high']++;
        });
        
        // Generate warnings
        const highRiskTables = candidates.filter(c => c.estimatedImpact === 'HIGH');
        if (highRiskTables.length > 0) {
            warnings.push(`⚠️  ${highRiskTables.length} high-risk tables identified - manual review recommended`);
        }
        
        const tablesWithFKs = candidates.filter(c => c.hasIncomingFKs || c.hasOutgoingFKs);
        if (tablesWithFKs.length > 0) {
            warnings.push(`⚠️  ${tablesWithFKs.length} tables have FK constraints - careful ordering required`);
        }
        
        // Generate recommendations
        recommendations.push('✓ Test on staging environment first');
        recommendations.push('✓ Schedule during maintenance window');
        recommendations.push('✓ Create full database backup before execution');
        recommendations.push('✓ Review high-risk tables manually');
        
        if (candidates.length > 20) {
            recommendations.push('⚠️  Large number of renames detected - consider batched execution');
        }
        
        const plan: RenamePlan = {
            timestamp: new Date().toISOString(),
            totalTablesAnalyzed: candidates.length,
            tablesToRename: candidates.filter(c => c.safeToRename).length,
            schemaBreakdown,
            riskAssessment,
            tables: candidates,
            warnings,
            recommendations
        };
        
        return plan;
    }
    
    /**
     * Analyze tables in a specific schema
     */
    private async analyzeSchema(schema: string): Promise<TableRenameCandidate[]> {
        const candidates: TableRenameCandidate[] = [];
        
        // Get all tables in schema
        const tables = await this.dataSource.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = $1 
              AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `, [schema]);
        
        for (const table of tables) {
            const tableName = table.table_name;
            
            // Skip system tables
            if (tableName.startsWith('pg_') || tableName === 'dra_table_metadata') {
                continue;
            }
            
            const candidate = await this.analyzeTable(schema, tableName);
            if (candidate) {
                candidates.push(candidate);
            }
        }
        
        return candidates;
    }
    
    /**
     * Analyze a specific table
     */
    private async analyzeTable(schema: string, tableName: string): Promise<TableRenameCandidate | null> {
        const notes: string[] = [];
        
        // Check if already has metadata (already hash-named)
        const existingMetadata = await this.dataSource.query(`
            SELECT * FROM dra_table_metadata 
            WHERE schema_name = $1 AND physical_table_name = $2
        `, [schema, tableName]);
        
        if (existingMetadata.length > 0) {
            // Already has metadata, likely already hash-named or backfilled
            notes.push('Has existing metadata entry');
            
            // Check if the current name is already short (likely hash-based)
            if (tableName.length < 20 && tableName.match(/^ds\d+_[a-f0-9]{8}$/)) {
                notes.push('Already using hash-based naming');
                return null; // Skip, already renamed
            }
        }
        
        // Extract data source ID from table name
        const dataSourceId = this.extractDataSourceId(schema, tableName);
        
        // Get users_platform_id
        let usersPlatformId: number | null = null;
        if (dataSourceId) {
            const dsResult = await this.dataSource.query(`
                SELECT users_platform_id FROM dra_data_sources WHERE id = $1
            `, [dataSourceId]);
            usersPlatformId = dsResult[0]?.users_platform_id || null;
        }
        
        // Generate proposed hash-based name
        const logicalName = this.extractLogicalName(schema, tableName);
        const fileId = this.extractFileId(schema, tableName);
        const proposedName = dataSourceId && fileId
            ? this.tableMetadataService.generatePhysicalTableName(dataSourceId, logicalName, fileId)
            : `renamed_${tableName.substring(0, 15)}`;
        
        // Check for FK constraints
        const incomingFKs = await this.getIncomingForeignKeys(schema, tableName);
        const outgoingFKs = await this.getOutgoingForeignKeys(schema, tableName);
        
        // Find data models using this table
        const dataModelIds = await this.findDataModelsUsingTable(schema, tableName);
        
        // Assess risk
        let estimatedImpact: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
        let safeToRename = true;
        
        if (incomingFKs.length > 0) {
            estimatedImpact = 'HIGH';
            notes.push(`${incomingFKs.length} incoming FK constraint(s)`);
        }
        
        if (outgoingFKs.length > 0) {
            estimatedImpact = estimatedImpact === 'HIGH' ? 'HIGH' : 'MEDIUM';
            notes.push(`${outgoingFKs.length} outgoing FK constraint(s)`);
        }
        
        if (dataModelIds.length > 0) {
            estimatedImpact = 'HIGH';
            notes.push(`Used in ${dataModelIds.length} data model(s)`);
        }
        
        if (tableName.length < 40) {
            notes.push('Name length acceptable, rename optional');
            safeToRename = true; // Still safe, just lower priority
        }
        
        if (!dataSourceId) {
            notes.push('⚠️  Could not extract data source ID');
            safeToRename = false;
        }
        
        const candidate: TableRenameCandidate = {
            schema,
            currentName: tableName,
            currentNameLength: tableName.length,
            proposedName,
            dataSourceId,
            usersPlatformId,
            hasMetadata: existingMetadata.length > 0,
            hasIncomingFKs: incomingFKs.length > 0,
            hasOutgoingFKs: outgoingFKs.length > 0,
            incomingFKs,
            outgoingFKs,
            usedInDataModels: dataModelIds,
            estimatedImpact,
            safeToRename,
            notes
        };
        
        return candidate;
    }
    
    /**
     * Extract data source ID from table name
     */
    private extractDataSourceId(schema: string, tableName: string): number | null {
        // Excel/PDF: {type}_{fileId}_data_source_{id}_{name}
        const excelPdfMatch = tableName.match(/_data_source_(\d+)_/);
        if (excelPdfMatch) {
            return parseInt(excelPdfMatch[1]);
        }
        
        // Google services: {report_type}_{id}
        const googleMatch = tableName.match(/_(\d+)$/);
        if (googleMatch && (
            schema === 'dra_google_analytics' ||
            schema === 'dra_google_ad_manager' ||
            schema === 'dra_google_ads'
        )) {
            return parseInt(googleMatch[1]);
        }
        
        return null;
    }
    
    /**
     * Extract logical name from table name
     */
    private extractLogicalName(schema: string, tableName: string): string {
        if (schema === 'dra_excel' || schema === 'dra_pdf') {
            const parts = tableName.split('_data_source_');
            return parts[1]?.split('_').slice(1).join('_') || tableName;
        }
        
        // Google services - use report type
        const reportTypeMatch = tableName.match(/^(.+)_\d+$/);
        return reportTypeMatch ? reportTypeMatch[1] : tableName;
    }
    
    /**
     * Extract file ID from table name
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
     * Get incoming foreign keys (tables that reference this table)
     */
    private async getIncomingForeignKeys(schema: string, tableName: string): Promise<any[]> {
        const result = await this.dataSource.query(`
            SELECT
                tc.table_schema,
                tc.table_name,
                kcu.column_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
                AND ccu.table_schema = $1
                AND ccu.table_name = $2
        `, [schema, tableName]);
        
        return result.map((r: any) => ({
            schema: r.table_schema,
            table: r.table_name,
            column: r.column_name
        }));
    }
    
    /**
     * Get outgoing foreign keys (tables this table references)
     */
    private async getOutgoingForeignKeys(schema: string, tableName: string): Promise<any[]> {
        const result = await this.dataSource.query(`
            SELECT
                ccu.table_schema,
                ccu.table_name,
                kcu.column_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
                AND tc.table_schema = $1
                AND tc.table_name = $2
        `, [schema, tableName]);
        
        return result.map((r: any) => ({
            schema: r.table_schema,
            table: r.table_name,
            column: r.column_name
        }));
    }
    
    /**
     * Find data models that reference this table
     */
    private async findDataModelsUsingTable(schema: string, tableName: string): Promise<number[]> {
        const dataModels = await this.dataSource.query(`
            SELECT id, query_json 
            FROM dra_data_models 
            WHERE query_json::text LIKE $1
        `, [`%${tableName}%`]);
        
        return dataModels
            .filter((dm: any) => {
                const queryJson = dm.query_json;
                if (!queryJson || !queryJson.tables) return false;
                
                return queryJson.tables.some((t: any) => 
                    t.table_name === tableName && t.schema === schema
                );
            })
            .map((dm: any) => dm.id);
    }
}

/**
 * Main execution
 */
async function main() {
    console.log('═'.repeat(80));
    console.log('📊 TABLE RENAME ANALYSIS TOOL');
    console.log('═'.repeat(80));
    console.log();
    
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
        
        // Run analysis
        const analyzer = new TableRenameAnalyzer(dataSource);
        const plan = await analyzer.analyze();
        
        // Display summary
        console.log('\n' + '═'.repeat(80));
        console.log('📋 ANALYSIS SUMMARY');
        console.log('═'.repeat(80));
        console.log(`Total tables analyzed: ${plan.totalTablesAnalyzed}`);
        console.log(`Tables to rename: ${plan.tablesToRename}`);
        console.log();
        console.log('Schema Breakdown:');
        Object.entries(plan.schemaBreakdown).forEach(([schema, count]) => {
            console.log(`  ${schema}: ${count} table(s)`);
        });
        console.log();
        console.log('Risk Assessment:');
        console.log(`  LOW:    ${plan.riskAssessment.low} table(s)`);
        console.log(`  MEDIUM: ${plan.riskAssessment.medium} table(s)`);
        console.log(`  HIGH:   ${plan.riskAssessment.high} table(s)`);
        
        if (plan.warnings.length > 0) {
            console.log('\n⚠️  WARNINGS:');
            plan.warnings.forEach(w => console.log(`  ${w}`));
        }
        
        if (plan.recommendations.length > 0) {
            console.log('\n💡 RECOMMENDATIONS:');
            plan.recommendations.forEach(r => console.log(`  ${r}`));
        }
        
        // Save to file
        const outputPath = path.join(__dirname, '../rename-plan.json');
        fs.writeFileSync(outputPath, JSON.stringify(plan, null, 2));
        
        console.log(`\n✅ Analysis complete! Report saved to: ${outputPath}`);
        console.log('═'.repeat(80));
        
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Analysis failed:', error);
        process.exit(1);
    }
}

main();
