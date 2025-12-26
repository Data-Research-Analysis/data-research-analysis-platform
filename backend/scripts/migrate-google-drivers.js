#!/usr/bin/env node

/**
 * Migration Script: Update Google Service Drivers with Hash-Based Table Naming
 * 
 * This script automatically updates GoogleAnalyticsDriver, GoogleAdManagerDriver,
 * and GoogleAdsDriver to use hash-based physical table names with metadata storage.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DRIVERS_DIR = path.join(__dirname, '../src/drivers');

// Configuration for each driver
const DRIVER_CONFIGS = {
    'GoogleAnalyticsDriver.ts': {
        schemaName: 'dra_google_analytics',
        tableType: 'google_analytics',
        idVar: 'propertyId',
        methods: [
            { name: 'syncPagePerformance', logicalName: 'page_performance' },
            { name: 'syncUserAcquisition', logicalName: 'user_acquisition' },
            { name: 'syncGeographic', logicalName: 'geographic' },
            { name: 'syncDeviceData', logicalName: 'device' },
            { name: 'syncEvents', logicalName: 'events' }
        ]
    },
    'GoogleAdManagerDriver.ts': {
        schemaName: 'dra_google_ad_manager',
        tableType: 'google_ad_manager',
        idVar: 'networkCode',
        methods: [
            { name: 'syncRevenueData', logicalName: 'revenue' },
            { name: 'syncGeographyData', logicalName: 'geography' },
            { name: 'syncDeviceData', logicalName: 'device' },
            { name: 'syncAdUnitData', logicalName: 'ad_unit' },
            { name: 'syncAdvertiserData', logicalName: 'advertiser' },
            { name: 'syncTimeSeriesData', logicalName: 'time_series' }
        ]
    },
    'GoogleAdsDriver.ts': {
        schemaName: 'dra_google_ads',
        tableType: 'google_ads',
        idVar: 'customerId',
        methods: [
            { name: 'syncCampaignData', logicalName: 'campaigns' },
            { name: 'syncKeywordData', logicalName: 'keywords' },
            { name: 'syncGeographicData', logicalName: 'geographic' },
            { name: 'syncDeviceData', logicalName: 'device' }
        ]
    }
};

/**
 * Update a method to add usersPlatformId parameter if not present
 */
function addUsersPlatformIdToMethodSignature(content, methodName) {
    // Check if already has usersPlatformId
    const hasUsersPlatformId = new RegExp(`async ${methodName}[\\s\\S]*?usersPlatformId`).test(content);
    if (hasUsersPlatformId) {
        return content;
    }
    
    // Pattern to find method signature and add parameter after dataSourceId
    const pattern = new RegExp(
        `(private async ${methodName}\\([^)]*dataSourceId: number,)(?!\\s*usersPlatformId)`,
        'g'
    );
    
    return content.replace(pattern, '$1\n        usersPlatformId: number,');
}

/**
 * Add hash-based table name generation at the start of a method
 */
function addHashBasedNaming(content, methodName, logicalName, idVar) {
    // Check if already has hash-based naming
    if (content.includes(`const logicalTableName = '${logicalName}'`)) {
        return content;
    }
    
    // Find where const tableName is defined and replace it
    const tableNamePattern = new RegExp(
        `(private async ${methodName}[\\s\\S]*?\\): Promise<[^>]+> \\{[\\s\\S]*?)const tableName = \`[^\`]+\`;`,
        ''
    );
    
    const hashNamingCode = `// Generate hash-based physical table name
        const tableMetadataService = TableMetadataService.getInstance();
        const logicalTableName = '${logicalName}';
        const physicalTableName = tableMetadataService.generatePhysicalTableName(
            dataSourceId,
            logicalTableName,
            ${idVar}
        );
        const fullTableName = \`\${schemaName}.\${physicalTableName}\`;`;
    
    return content.replace(tableNamePattern, `$1${hashNamingCode}`);
}

/**
 * Replace ${tableName} with ${fullTableName} in SQL queries
 */
function replaceTableNameReferences(content, methodName) {
    // Find the method
    const methodStart = content.indexOf(`async ${methodName}(`);
    if (methodStart === -1) return content;
    
    // Find next method or end
    let methodEnd = content.indexOf('private async', methodStart + 1);
    if (methodEnd === -1) methodEnd = content.indexOf('public async', methodStart + 1);
    if (methodEnd === -1) methodEnd = content.length;
    
    const before = content.substring(0, methodStart);
    const methodBody = content.substring(methodStart, methodEnd);
    const after = content.substring(methodEnd);
    
    // Replace in method body
    const updatedMethod = methodBody
        .replace(/CREATE TABLE IF NOT EXISTS \$\{tableName\}/g, 'CREATE TABLE IF NOT EXISTS ${fullTableName}')
        .replace(/INSERT INTO \$\{tableName\}/g, 'INSERT INTO ${fullTableName}')
        .replace(/SELECT \* FROM \$\{tableName\}/g, 'SELECT * FROM ${fullTableName}')
        .replace(/DROP TABLE IF EXISTS \$\{tableName\}/g, 'DROP TABLE IF EXISTS ${fullTableName}');
    
    return before + updatedMethod + after;
}

/**
 * Add metadata storage before console.log at end of method
 */
function addMetadataStorage(content, methodName, logicalName, schemaName, tableType, idVar) {
    // Check if already has metadata storage
    if (new RegExp(`${methodName}[\\s\\S]*?storeTableMetadata[\\s\\S]*?'${logicalName}'`).test(content)) {
        return content;
    }
    
    const metadataCode = `
        // Store table metadata
        await tableMetadataService.storeTableMetadata(manager, {
            dataSourceId,
            usersPlatformId,
            schemaName: '${schemaName}',
            physicalTableName,
            logicalTableName,
            originalSheetName: logicalTableName,
            fileId: ${idVar},
            tableType: '${tableType}'
        });
        
        console.log(\`✅ Synced \${transformedData?.length || rows?.length || recordsSynced || 0} rows to \${logicalTableName} (\${physicalTableName})\`);`;
    
    // Find last console.log in method and replace
    const methodStart = content.indexOf(`async ${methodName}(`);
    if (methodStart === -1) return content;
    
    let methodEnd = content.indexOf('private async', methodStart + 1);
    if (methodEnd === -1) methodEnd = content.indexOf('public async', methodStart + 1);
    if (methodEnd === -1) methodEnd = content.length;
    
    const before = content.substring(0, methodStart);
    let methodBody = content.substring(methodStart, methodEnd);
    const after = content.substring(methodEnd);
    
    // Replace last console.log before method end
    methodBody = methodBody.replace(
        /console\.log\(`[^`]*(?:rows\.length|recordsSynced|transformedData\.length)[^`]*`\);(\s*})?$/,
        metadataCode + '$1'
    );
    
    return before + methodBody + after;
}

/**
 * Process a single driver file
 */
function processDriver(driverFile, config) {
    const filePath = path.join(DRIVERS_DIR, driverFile);
    console.log(`\n📝 Processing ${driverFile}...`);
    
    let content = fs.readFileSync(filePath, 'utf8');
    let changesMade = 0;
    
    // Add TableMetadataService import if not present
    if (!content.includes('TableMetadataService')) {
        const importPattern = /import \{ DBDriver \}[^\n]*\n/;
        if (importPattern.test(content)) {
            content = content.replace(
                importPattern,
                (match) => match + `import { TableMetadataService } from '../services/TableMetadataService.js';\n`
            );
            console.log('  ✅ Added TableMetadataService import');
            changesMade++;
        }
    }
    
    // Process each method
    for (const method of config.methods) {
        const { name: methodName, logicalName } = method;
        
        // Check if method exists in file
        if (!content.includes(`async ${methodName}(`)) {
            console.log(`  ⏭️  Skipping ${methodName} (not found)`);
            continue;
        }
        
        console.log(`  📌 Updating ${methodName}...`);
        
        try {
            // 1. Add usersPlatformId parameter
            content = addUsersPlatformIdToMethodSignature(content, methodName);
            
            // 2. Add hash-based naming
            content = addHashBasedNaming(content, methodName, logicalName, config.idVar);
            
            // 3. Replace table name references
            content = replaceTableNameReferences(content, methodName);
            
            // 4. Add metadata storage
            content = addMetadataStorage(content, methodName, logicalName, config.schemaName, config.tableType, config.idVar);
            
            changesMade++;
        } catch (error) {
            console.error(`    ❌ Error updating ${methodName}:`, error.message);
        }
    }
    
    // Write back to file
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  ✅ ${driverFile} updated with ${changesMade} changes`);
}

/**
 * Main execution
 */
function main() {
    console.log('🚀 Starting Google Service Driver Migration Script\n');
    console.log('═'.repeat(60));
    
    for (const [driverFile, config] of Object.entries(DRIVER_CONFIGS)) {
        try {
            processDriver(driverFile, config);
        } catch (error) {
            console.error(`\n❌ Error processing ${driverFile}:`, error.message);
            console.error(error.stack);
        }
    }
    
    console.log('\n' + '═'.repeat(60));
    console.log('✅ Migration script completed!\n');
    console.log('📋 Next steps:');
    console.log('   1. Review the changes in the driver files');
    console.log('   2. Run TypeScript compilation to check for errors');
    console.log('   3. Test Google service data syncing');
}

main();
