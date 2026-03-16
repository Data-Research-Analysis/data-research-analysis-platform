/**
 * Data Migration Script: Convert Users to Personal Organizations
 * 
 * Purpose: Migrate existing single-user architecture to multi-tenant organization model
 * 
 * What this script does:
 * 1. Creates personal organization for each existing user
 * 2. Transfers user subscription to organization subscription
 * 3. Creates default workspace within each organization
 * 4. Migrates all user's projects to their personal organization/workspace
 * 5. Creates organization membership with OWNER role
 * 
 * Safety Features:
 * - Transaction-based (all or nothing per user)
 * - Dry-run mode for testing
 * - Detailed logging with progress tracking
 * - Skip already-migrated users
 * - Rollback on error
 * 
 * Usage:
 *   npm run ts-node scripts/migrate-users-to-organizations.ts           # Dry run (preview)
 *   npm run ts-node scripts/migrate-users-to-organizations.ts --execute # Execute migration
 * 
 * CRITICAL: Run database migration first: npm run migration:run
 */

import { DataSource } from 'typeorm';
import { DBDriver } from '../src/drivers/DBDriver.js';
import { EDataSourceType } from '../src/types/EDataSourceType.js';
import { DRAUsersPlatform } from '../src/models/DRAUsersPlatform.js';
import { DRAOrganization } from '../src/models/DRAOrganization.js';
import { DRAWorkspace } from '../src/models/DRAWorkspace.js';
import { DRAOrganizationMember } from '../src/models/DRAOrganizationMember.js';
import { DRAOrganizationSubscription } from '../src/models/DRAOrganizationSubscription.js';
import { DRAUserSubscription } from '../src/models/DRAUserSubscription.js';
import { DRAProject } from '../src/models/DRAProject.js';
import { DRASubscriptionTier } from '../src/models/DRASubscriptionTier.js';

interface MigrationStats {
    totalUsers: number;
    migratedUsers: number;
    skippedUsers: number;
    errors: number;
    organizationsCreated: number;
    workspacesCreated: number;
    projectsMigrated: number;
}

interface UserMigrationResult {
    userId: number;
    email: string;
    organizationId?: number;
    organizationName?: string;
    projectsCount: number;
    success: boolean;
    error?: string;
}

const stats: MigrationStats = {
    totalUsers: 0,
    migratedUsers: 0,
    skippedUsers: 0,
    errors: 0,
    organizationsCreated: 0,
    workspacesCreated: 0,
    projectsMigrated: 0
};

/**
 * Generate unique organization slug from user details
 * Format: {firstname}-{lastname}-org or {username}-org
 */
function generateOrganizationSlug(user: DRAUsersPlatform, existingSlugs: Set<string>): string {
    let baseSlug: string;
    
    if (user.first_name && user.last_name) {
        baseSlug = `${user.first_name}-${user.last_name}-org`
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    } else {
        // Fallback to email username
        const emailUsername = user.email.split('@')[0];
        baseSlug = `${emailUsername}-org`
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }

    // Ensure uniqueness
    let slug = baseSlug;
    let counter = 1;
    while (existingSlugs.has(slug)) {
        slug = `${baseSlug}-${counter}`;
        counter++;
    }

    existingSlugs.add(slug);
    return slug;
}

/**
 * Generate organization name from user details
 */
function generateOrganizationName(user: DRAUsersPlatform): string {
    if (user.first_name) {
        return `${user.first_name}'s Organization`;
    }
    return `${user.email.split('@')[0]}'s Organization`;
}

/**
 * Determine max_members value based on subscription tier
 * Implements personal organizations strategy
 */
function getMaxMembersForTier(tierName: string): number | null {
    const normalizedTier = tierName.toUpperCase();
    
    switch (normalizedTier) {
        case 'FREE':
            return 1; // Personal org only
        case 'STARTER':
            return 1; // Personal org only
        case 'PROFESSIONAL':
            return 5;
        case 'PROFESSIONAL_PLUS':
        case 'PRO_PLUS':
            return 100;
        case 'ENTERPRISE':
            return null; // Unlimited
        default:
            console.warn(`Unknown subscription tier: ${tierName}, defaulting to max_members=1`);
            return 1; // Default to personal org for safety
    }
}

/**
 * Migrate a single user to personal organization
 */
async function migrateUser(
    user: DRAUsersPlatform,
    dataSource: DataSource,
    existingSlugs: Set<string>,
    dryRun: boolean
): Promise<UserMigrationResult> {
    const manager = dataSource.manager;
    
    try {
        // Get user's current subscription
        const userSubscription = await manager.findOne(DRAUserSubscription, {
            where: { users_platform: { id: user.id }, is_active: true },
            relations: ['subscription_tier']
        });

        if (!userSubscription) {
            return {
                userId: user.id,
                email: user.email,
                projectsCount: 0,
                success: false,
                error: 'No active subscription found'
            };
        }

        // Get user's projects count
        const projectsCount = await manager.count(DRAProject, {
            where: { users_platform: { id: user.id } }
        });

        if (dryRun) {
            return {
                userId: user.id,
                email: user.email,
                organizationName: generateOrganizationName(user),
                projectsCount,
                success: true
            };
        }

        // Execute actual migration in transaction
        const result = await manager.transaction(async (transactionalManager) => {
            // 1. Create organization
            const orgName = generateOrganizationName(user);
            const orgSlug = generateOrganizationSlug(user, existingSlugs);
            
            const organization = transactionalManager.create(DRAOrganization, {
                name: orgName,
                slug: orgSlug,
                is_active: true,
                settings: {
                    migrated_from_user_id: user.id,
                    migration_date: new Date().toISOString()
                }
            });
            const savedOrg = await transactionalManager.save(organization);
            stats.organizationsCreated++;

            // 2. Create organization subscription (transfer from user subscription)
            const maxMembers = getMaxMembersForTier(userSubscription.subscription_tier.tier_name);
            const orgSubscription = transactionalManager.create(DRAOrganizationSubscription, {
                organization: savedOrg,
                subscription_tier: userSubscription.subscription_tier,
                max_members: maxMembers,
                current_members: 1, // Just the owner
                is_active: userSubscription.is_active,
                started_at: userSubscription.started_at,
                ends_at: userSubscription.ends_at,
                cancelled_at: userSubscription.cancelled_at,
                stripe_subscription_id: userSubscription.stripe_subscription_id,
                stripe_customer_id: null // Will be set during first billing cycle
            });
            await transactionalManager.save(orgSubscription);

            // 3. Create owner membership
            const ownerMembership = transactionalManager.create(DRAOrganizationMember, {
                organization: savedOrg,
                user: user,
                role: 'owner',
                is_active: true,
                joined_at: new Date(),
                invited_by_user: null // Self-created during migration
            });
            await transactionalManager.save(ownerMembership);

            // 4. Create default workspace
            const defaultWorkspace = transactionalManager.create(DRAWorkspace, {
                organization: savedOrg,
                name: 'Default Workspace',
                slug: 'default',
                description: 'Automatically created during migration',
                is_active: true
            });
            const savedWorkspace = await transactionalManager.save(defaultWorkspace);
            stats.workspacesCreated++;

            // 5. Migrate all user's projects to organization and workspace
            const userProjects = await transactionalManager.find(DRAProject, {
                where: { users_platform: { id: user.id } }
            });

            for (const project of userProjects) {
                project.organization = savedOrg;
                project.workspace = savedWorkspace;
                await transactionalManager.save(project);
                stats.projectsMigrated++;
            }

            return {
                userId: user.id,
                email: user.email,
                organizationId: savedOrg.id,
                organizationName: orgName,
                projectsCount,
                success: true
            };
        });

        stats.migratedUsers++;
        return result;
    } catch (error: any) {
        stats.errors++;
        return {
            userId: user.id,
            email: user.email,
            projectsCount: 0,
            success: false,
            error: error.message
        };
    }
}

/**
 * Main migration function
 */
async function migrateMigrationUsersToOrganizations(dryRun: boolean = true) {
    console.log('='.repeat(80));
    console.log('Data Migration: Users → Personal Organizations');
    console.log('='.repeat(80));
    console.log(`Mode: ${dryRun ? 'DRY RUN (Preview Only)' : 'EXECUTE (Real Migration)'}`);
    console.log(`Date: ${new Date().toISOString()}`);
    console.log('='.repeat(80));
    console.log();

    let dataSource: DataSource | null = null;

    try {
        // Initialize database connection
        console.log('📡 Connecting to database...');
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) {
            throw new Error('PostgreSQL driver unavailable');
        }
        dataSource = await driver.getConcreteDriver();
        console.log('✅ Database connected');
        console.log();

        // Verify migration tables exist
        console.log('🔍 Verifying database schema...');
        const hasOrgTable = await dataSource.query(
            `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'dra_organizations')`
        );
        
        if (!hasOrgTable[0].exists) {
            throw new Error(
                'Organization tables not found. Run database migration first: npm run migration:run'
            );
        }
        console.log('✅ Database schema verified');
        console.log();

        // Get all users
        console.log('👥 Loading users...');
        const users = await dataSource.manager.find(DRAUsersPlatform, {
            order: { id: 'ASC' }
        });
        stats.totalUsers = users.length;
        console.log(`Found ${stats.totalUsers} users to migrate`);
        console.log();

        // Check for already-migrated users
        const existingOrgs = await dataSource.manager.find(DRAOrganization);
        const migratedUserIds = new Set(
            existingOrgs
                .filter(org => org.settings?.migrated_from_user_id)
                .map(org => org.settings.migrated_from_user_id)
        );

        if (migratedUserIds.size > 0) {
            console.log(`⚠️  Found ${migratedUserIds.size} already-migrated users (will skip)`);
            console.log();
        }

        // Track existing slugs for uniqueness
        const existingSlugs = new Set(existingOrgs.map(org => org.slug));

        // Migrate each user
        console.log('🚀 Starting migration...');
        console.log();

        const results: UserMigrationResult[] = [];

        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            const progress = `[${i + 1}/${users.length}]`;

            // Skip already-migrated users
            if (migratedUserIds.has(user.id)) {
                console.log(`${progress} ⏭️  Skipping ${user.email} (already migrated)`);
                stats.skippedUsers++;
                continue;
            }

            console.log(`${progress} 🔄 Migrating ${user.email}...`);
            const result = await migrateUser(user, dataSource, existingSlugs, dryRun);
            results.push(result);

            if (result.success) {
                if (dryRun) {
                    console.log(`${progress} ✅ Would create: "${result.organizationName}" with ${result.projectsCount} projects`);
                } else {
                    console.log(`${progress} ✅ Created org #${result.organizationId}: "${result.organizationName}" with ${result.projectsCount} projects`);
                }
            } else {
                console.log(`${progress} ❌ Failed: ${result.error}`);
            }
        }

        console.log();
        console.log('='.repeat(80));
        console.log('Migration Summary');
        console.log('='.repeat(80));
        console.log(`Total Users:           ${stats.totalUsers}`);
        console.log(`Migrated Users:        ${stats.migratedUsers}`);
        console.log(`Skipped Users:         ${stats.skippedUsers}`);
        console.log(`Errors:                ${stats.errors}`);
        console.log(`Organizations Created: ${stats.organizationsCreated}`);
        console.log(`Workspaces Created:    ${stats.workspacesCreated}`);
        console.log(`Projects Migrated:     ${stats.projectsMigrated}`);
        console.log('='.repeat(80));
        console.log();

        if (dryRun) {
            console.log('💡 This was a DRY RUN - no changes were made to the database.');
            console.log('   To execute the migration, run with --execute flag:');
            console.log('   npm run ts-node scripts/migrate-users-to-organizations.ts --execute');
        } else {
            console.log('✅ Migration completed successfully!');
            console.log();
            console.log('📋 Next Steps:');
            console.log('   1. Verify organizations: SELECT * FROM dra_organizations;');
            console.log('   2. Verify memberships: SELECT * FROM dra_organization_members;');
            console.log('   3. Verify projects assigned: SELECT id, name, organization_id, workspace_id FROM dra_projects;');
            console.log('   4. Test frontend organization switcher');
            console.log('   5. Monitor user subscriptions billing cycle');
        }

        // Log failed migrations if any
        const failures = results.filter(r => !r.success);
        if (failures.length > 0) {
            console.log();
            console.log('❌ Failed Migrations:');
            failures.forEach(f => {
                console.log(`   - User ${f.userId} (${f.email}): ${f.error}`);
            });
        }

    } catch (error: any) {
        console.error();
        console.error('💥 Fatal Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        // Close database connection
        if (dataSource?.isInitialized) {
            await dataSource.destroy();
            console.log();
            console.log('📡 Database connection closed');
        }
    }
}

// Execute migration
const args = process.argv.slice(2);
const executeMode = args.includes('--execute');
const dryRun = !executeMode;

migrateMigrationUsersToOrganizations(dryRun)
    .then(() => {
        console.log();
        console.log('✨ Script completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Unhandled error:', error);
        process.exit(1);
    });
