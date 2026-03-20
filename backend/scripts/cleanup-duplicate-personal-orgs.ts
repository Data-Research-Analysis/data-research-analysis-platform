/**
 * Cleanup Script: Remove Duplicate Personal Organizations
 * 
 * Problem:
 * - Users who were invited to organizations also got personal orgs auto-created during registration
 * - This created duplicate organizations with the same name (e.g., "Mustafa's Organization")
 * 
 * Solution:
 * - Find users who have multiple organization memberships
 * - Identify personal organizations (pattern: "FirstName's Organization")
 * - Remove personal orgs that are empty (no projects, only 1 member)
 * - Keep personal orgs that have been used (have projects, have multiple members)
 * 
 * Safety:
 * - Dry run mode by default (use --execute to actually delete)
 * - Only deletes truly empty organizations
 * - Logs all actions
 * 
 * Usage:
 *   npm run cleanup:personal-orgs          # Dry run (shows what would be deleted)
 *   npm run cleanup:personal-orgs --execute # Actually delete empty personal orgs
 */

import { DataSource } from 'typeorm';
import { PostgresDataSource } from '../src/datasources/PostgresDataSource.js';
import { DRAOrganization } from '../src/models/DRAOrganization.js';
import { DRAOrganizationMember } from '../src/models/DRAOrganizationMember.js';
import { DRAUsersPlatform } from '../src/models/DRAUsersPlatform.js';
import { DRAProject } from '../src/models/DRAProject.js';
import dotenv from 'dotenv';
dotenv.config();

interface CleanupCandidate {
    userId: number;
    userEmail: string;
    userName: string;
    personalOrgId: number;
    personalOrgName: string;
    memberCount: number;
    projectCount: number;
    otherOrgIds: number[];
    reason: string;
}

async function findDuplicatePersonalOrgs(dataSource: DataSource): Promise<CleanupCandidate[]> {
    const manager = dataSource.manager;
    const candidates: CleanupCandidate[] = [];

    console.log('\n🔍 Scanning for duplicate personal organizations...\n');

    // Get all users with multiple organization memberships
    const usersWithMultipleOrgs = await manager
        .createQueryBuilder(DRAOrganizationMember, 'member')
        .select('member.users_platform_id', 'userId')
        .addSelect('COUNT(DISTINCT member.organization_id)', 'orgCount')
        .where('member.is_active = :active', { active: true })
        .groupBy('member.users_platform_id')
        .having('COUNT(DISTINCT member.organization_id) > 1')
        .getRawMany();

    console.log(`Found ${usersWithMultipleOrgs.length} users with multiple organization memberships\n`);

    for (const userRecord of usersWithMultipleOrgs) {
        const userId = parseInt(userRecord.userId);

        // Get user details
        const user = await manager.findOne(DRAUsersPlatform, { where: { id: userId } });
        if (!user) continue;

        // Get all organizations this user belongs to
        const memberships = await manager.find(DRAOrganizationMember, {
            where: { users_platform_id: userId, is_active: true },
            relations: ['organization']
        });

        // Pattern to identify personal organizations: "{FirstName}'s Organization"
        const personalOrgPattern = new RegExp(`^${user.first_name}'s Organization$`, 'i');

        for (const membership of memberships) {
            const org = membership.organization;

            // Check if this matches the personal org pattern
            if (personalOrgPattern.test(org.name) && membership.role === 'owner') {
                // Count members in this org
                const memberCount = await manager.count(DRAOrganizationMember, {
                    where: { organization_id: org.id, is_active: true }
                });

                // Count projects in this org
                const projectCount = await manager.count(DRAProject, {
                    where: { organization_id: org.id }
                });

                // Get IDs of other organizations this user belongs to
                const otherOrgIds = memberships
                    .filter(m => m.organization_id !== org.id)
                    .map(m => m.organization_id);

                // Determine if this org should be cleaned up
                let shouldCleanup = false;
                let reason = '';

                if (memberCount === 1 && projectCount === 0) {
                    shouldCleanup = true;
                    reason = 'Empty personal org (no projects, only owner)';
                } else if (memberCount > 1) {
                    reason = `Has ${memberCount} members - keeping (actively used)`;
                } else if (projectCount > 0) {
                    reason = `Has ${projectCount} projects - keeping (actively used)`;
                }

                if (shouldCleanup || memberCount > 1 || projectCount > 0) {
                    candidates.push({
                        userId,
                        userEmail: user.email,
                        userName: `${user.first_name} ${user.last_name}`,
                        personalOrgId: org.id,
                        personalOrgName: org.name,
                        memberCount,
                        projectCount,
                        otherOrgIds,
                        reason
                    });
                }
            }
        }
    }

    return candidates;
}

async function cleanup(executeDelete: boolean = false) {
    let dataSource: DataSource | null = null;
    
    try {
        console.log('🔌 Connecting to database...');
        
        // Get database connection info from environment
        const host = process.env.POSTGRESDB_HOST || process.env.DB_HOST || 'localhost';
        const port = parseInt(process.env.POSTGRESDB_DOCKER_PORT || process.env.DB_PORT || '5432');
        const username = process.env.POSTGRESDB_USER || process.env.DB_USERNAME || 'postgres';
        const password = process.env.POSTGRESDB_ROOT_PASSWORD || process.env.DB_PASSWORD || 'postgres';
        const database = process.env.POSTGRESDB_DATABASE || process.env.DB_DATABASE || 'data_research_analysis';
        
        // Create DataSource configuration
        const dataSourceConfig = PostgresDataSource.getInstance().getDataSource(
            host,
            port,
            database,
            username,
            password
        );
        
        // Initialize the data source directly
        dataSource = await dataSourceConfig.initialize();
        
        if (!dataSource || !dataSource.isInitialized) {
            throw new Error('Database connection not initialized');
        }
        
        console.log('✅ Database connected\n');

        const candidates = await findDuplicatePersonalOrgs(dataSource);

        if (candidates.length === 0) {
            console.log('✅ No duplicate personal organizations found!\n');
            process.exit(0);
        }

        // Separate candidates into deletable and keep
        const toDelete = candidates.filter(c => c.reason.includes('Empty personal org'));
        const toKeep = candidates.filter(c => !c.reason.includes('Empty personal org'));

        console.log('📊 SUMMARY:\n');
        console.log(`   Total personal orgs found: ${candidates.length}`);
        console.log(`   Empty (will be deleted): ${toDelete.length}`);
        console.log(`   Active (will be kept): ${toKeep.length}\n`);

        // Show organizations that will be kept
        if (toKeep.length > 0) {
            console.log('✅ KEEPING (Active personal organizations):\n');
            for (const candidate of toKeep) {
                console.log(`   User: ${candidate.userName} (${candidate.userEmail})`);
                console.log(`   Organization: "${candidate.personalOrgName}" (ID: ${candidate.personalOrgId})`);
                console.log(`   Reason: ${candidate.reason}`);
                console.log(`   Members: ${candidate.memberCount}, Projects: ${candidate.projectCount}`);
                console.log(`   Also belongs to orgs: ${candidate.otherOrgIds.join(', ')}\n`);
            }
        }

        // Show organizations that will be deleted
        if (toDelete.length > 0) {
            console.log(`${executeDelete ? '🗑️  DELETING' : '🔍 WOULD DELETE'} (Empty personal organizations):\n`);
            for (const candidate of toDelete) {
                console.log(`   User: ${candidate.userName} (${candidate.userEmail})`);
                console.log(`   Organization: "${candidate.personalOrgName}" (ID: ${candidate.personalOrgId})`);
                console.log(`   Reason: ${candidate.reason}`);
                console.log(`   User will remain in orgs: ${candidate.otherOrgIds.join(', ')}\n`);
            }

            if (executeDelete) {
                console.log('⚠️  EXECUTING DELETIONS...\n');
                const manager = dataSource.manager;

                for (const candidate of toDelete) {
                    try {
                        // Delete organization (cascade will handle members, subscriptions, etc.)
                        await manager.delete(DRAOrganization, { id: candidate.personalOrgId });
                        console.log(`   ✅ Deleted org ${candidate.personalOrgId}: "${candidate.personalOrgName}" for ${candidate.userEmail}`);
                    } catch (error: any) {
                        console.error(`   ❌ Failed to delete org ${candidate.personalOrgId}:`, error.message);
                    }
                }

                console.log(`\n✅ Cleanup complete! Deleted ${toDelete.length} empty personal organizations.\n`);
            } else {
                console.log('ℹ️  This is a DRY RUN. No organizations were deleted.');
                console.log('   To execute deletions, run: npm run cleanup:personal-orgs --execute\n');
            }
        }

        // Close connection
        if (dataSource && dataSource.isInitialized) {
            await dataSource.destroy();
        }
        process.exit(0);

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        if (dataSource && dataSource.isInitialized) {
            await dataSource.destroy();
        }
        process.exit(1);
    }
}

// Parse command line args
const executeMode = process.argv.includes('--execute');

console.log('\n========================================');
console.log('  Cleanup Duplicate Personal Orgs');
console.log('========================================\n');

if (executeMode) {
    console.log('⚠️  EXECUTE MODE - Changes will be permanent!\n');
} else {
    console.log('ℹ️  DRY RUN MODE - No changes will be made\n');
}

cleanup(executeMode);
