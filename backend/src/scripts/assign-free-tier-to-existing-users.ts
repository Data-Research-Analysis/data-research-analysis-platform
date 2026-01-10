/**
 * One-time migration script to assign FREE tier to all existing users
 * Run this script after deploying subscription tier feature to production
 * 
 * Usage:
 *   cd backend
 *   tsx ./src/scripts/assign-free-tier-to-existing-users.ts
 */

import { DBDriver } from '../drivers/DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { DRAUsersPlatform } from '../models/DRAUsersPlatform.js';
import { DRAUserSubscription } from '../models/DRAUserSubscription.js';
import { DRASubscriptionTier, ESubscriptionTier } from '../models/DRASubscriptionTier.js';
import { UtilityService } from '../services/UtilityService.js';

async function assignFreeTierToExistingUsers() {
    console.log('Starting FREE tier assignment for existing users...\n');
    
    try {
        // Initialize utility service first
        await UtilityService.getInstance().initialize();
        console.log('\u2705 Utility service initialized\n');
        
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) {
            throw new Error('PostgreSQL driver not available');
        }
        
        const concreteDriver = await driver.getConcreteDriver();
        if (!concreteDriver) {
            throw new Error('Failed to get PostgreSQL connection');
        }
        
        const manager = concreteDriver.manager;
        if (!manager) {
            throw new Error('Database manager not available');
        }
        
        // Get FREE tier
        const freeTier = await manager.findOne(DRASubscriptionTier, {
            where: { tier_name: ESubscriptionTier.FREE }
        });
        
        if (!freeTier) {
            throw new Error('FREE tier not found - run seeders first');
        }
        
        console.log(`\u2705 Found FREE tier (ID: ${freeTier.id})`);
        console.log(`   Max rows: ${freeTier.max_rows_per_data_model}`);
        console.log(`   Price: $${freeTier.price_per_month_usd}/month\n`);
        
        // Get all users
        const allUsers = await manager.find(DRAUsersPlatform);
        console.log(`\ud83d\udc65 Found ${allUsers.length} total users\n`);
        
        let assignedCount = 0;
        let skippedCount = 0;
        
        for (const user of allUsers) {
            // Check if user already has a subscription
            const existingSubscription = await manager.findOne(DRAUserSubscription, {
                where: {
                    users_platform: { id: user.id },
                    is_active: true
                }
            });
            
            if (existingSubscription) {
                console.log(`\u23ed\ufe0f  Skipping user ${user.id} (${user.email}) - already has active subscription`);
                skippedCount++;
                continue;
            }
            
            // Create FREE tier subscription
            const subscription = manager.create(DRAUserSubscription, {
                users_platform: user,
                tier: freeTier,
                started_at: new Date(),
                is_active: true
            });
            
            await manager.save(subscription);
            assignedCount++;
            
            console.log(`\u2705 Assigned FREE tier to user ${user.id} (${user.email})`);
        }
        
        console.log(`\n${'='.repeat(60)}`);
        console.log('MIGRATION COMPLETE');
        console.log(`${'='.repeat(60)}`);
        console.log(`\u2705 Successfully assigned: ${assignedCount} users`);
        console.log(`\u23ed\ufe0f  Skipped (already subscribed): ${skippedCount} users`);
        console.log(`\ud83d\udc65 Total users: ${allUsers.length}`);
        console.log(`${'='.repeat(60)}\n`);
        
    } catch (error) {
        console.error('\u274c Error assigning FREE tier to existing users:', error);
        process.exit(1);
    }
    
    process.exit(0);
}

// Run the migration
assignFreeTierToExistingUsers();
