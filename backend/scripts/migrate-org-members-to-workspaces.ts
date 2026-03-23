#!/usr/bin/env node
/**
 * Migration Script: Add Organization Members to Default Workspaces
 * 
 * After Phase 2 migrations, organizations have workspaces but no workspace members.
 * This script automatically adds all organization members to their organization's
 * default workspace with the same role they have in the organization.
 * 
 * Usage:
 *   npm run tsx scripts/migrate-org-members-to-workspaces.ts
 */

import { DataSource } from 'typeorm';
import { DBDriver } from '../src/drivers/DBDriver.js';
import { EDataSourceType } from '../src/types/EDataSourceType.js';
import { PostgresDataSource } from '../src/datasources/PostgresDataSource.js';
import { DRAOrganization } from '../src/models/DRAOrganization.js';
import { DRAWorkspace } from '../src/models/DRAWorkspace.js';
import dotenv from 'dotenv';
dotenv.config();

interface OrganizationMember {
    id: number;
    users_platform_id: number;
    organization_id: number;
    role: string;
    is_active: boolean;
}

async function migrateOrgMembersToWorkspaces() {
    console.log('🚀 Starting migration: Organization Members → Workspace Members\n');

    let dataSource: DataSource | null = null;

    try {
        // Initialize database connection
        console.log('📡 Connecting to database...');
        
        const host = process.env.POSTGRESQL_HOST || 'localhost';
        const port = parseInt(process.env.POSTGRESQL_PORT || '5432');
        const database = process.env.POSTGRESQL_DB_NAME || 'postgres_dra_db';
        const username = process.env.POSTGRESQL_USERNAME || 'postgres';
        const password = process.env.POSTGRESQL_PASSWORD || 'postgres';
        
        // Create PostgresDataSource instance
        const postgresDataSource = PostgresDataSource.getInstance().getDataSource(
            host,
            port,
            database,
            username,
            password
        );
        
        // Get and initialize the driver
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) {
            throw new Error('PostgreSQL driver unavailable');
        }
        
        // Initialize driver with data source
        const connected = await driver.initialize(postgresDataSource);
        if (!connected) {
            throw new Error('Failed to establish database connection');
        }
        
        // Get the initialized data source
        dataSource = await driver.getConcreteDriver();
        if (!dataSource || !dataSource.isInitialized) {
            throw new Error('Database connection not initialized');
        }

        console.log('✅ Database connection established\n');

        const manager = dataSource.manager;

        // Get all organizations
        const organizations = await manager.find(DRAOrganization, {
            relations: ['workspaces']
        });

        console.log(`📊 Found ${organizations.length} organizations\n`);

        let totalMigrated = 0;
        let totalSkipped = 0;
        let totalErrors = 0;

        for (const org of organizations) {
            console.log(`\n📁 Processing Organization: ${org.name} (ID: ${org.id})`);
            console.log(`   Tier: ${org.tier}, Organization ID: ${org.id}`);

            // Find default workspace (first workspace for this org)
            const defaultWorkspace = org.workspaces.find(ws => ws.organization_id === org.id);
            
            if (!defaultWorkspace) {
                console.log(`   ⚠️  No workspace found - creating default workspace...`);
                
                // Create default workspace
                const newWorkspace = manager.create(DRAWorkspace, {
                    name: 'Default Workspace',
                    description: 'Default workspace for organization',
                    organization_id: org.id,
                    created_by_user_id: org.owner_id,
                    is_active: true
                });
                
                await manager.save(newWorkspace);
                console.log(`   ✅ Created workspace: ${newWorkspace.name} (ID: ${newWorkspace.id})`);
                
                // Now use this as the default workspace
                org.workspaces = [newWorkspace];
            }

            const workspace = org.workspaces[0];
            console.log(`   📂 Using Workspace: ${workspace.name} (ID: ${workspace.id})`);

            // Get organization members
            const orgMembers = await manager.query<OrganizationMember[]>(`
                SELECT id, users_platform_id, organization_id, role, is_active
                FROM dra_organization_members
                WHERE organization_id = $1 AND is_active = true
            `, [org.id]);

            console.log(`   👥 Found ${orgMembers.length} active organization members`);

            if (orgMembers.length === 0) {
                console.log(`   ⏭️  Skipping - no active members`);
                continue;
            }

            // Check existing workspace members
            const existingMembers = await manager.query<{ users_platform_id: number }[]>(`
                SELECT users_platform_id
                FROM dra_workspace_members
                WHERE workspace_id = $1
            `, [workspace.id]);

            const existingMemberIds = new Set(existingMembers.map(m => m.users_platform_id));
            console.log(`   🔍 Found ${existingMemberIds.size} existing workspace members`);

            // Add missing members
            let addedCount = 0;
            let skippedCount = 0;

            for (const orgMember of orgMembers) {
                if (existingMemberIds.has(orgMember.users_platform_id)) {
                    skippedCount++;
                    continue;
                }

                try {
                    // Map organization role to workspace role
                    let workspaceRole = 'member';
                    if (orgMember.role === 'owner' || orgMember.role === 'admin') {
                        workspaceRole = 'admin';
                    } else if (orgMember.role === 'member') {
                        workspaceRole = 'member';
                    } else if (orgMember.role === 'viewer') {
                        workspaceRole = 'viewer';
                    }

                    // Insert workspace member
                    await manager.query(`
                        INSERT INTO dra_workspace_members (workspace_id, users_platform_id, role, is_active, added_by_user_id)
                        VALUES ($1, $2, $3, true, $4)
                    `, [workspace.id, orgMember.users_platform_id, workspaceRole, org.owner_id]);

                    addedCount++;
                    totalMigrated++;
                } catch (error: any) {
                    console.error(`   ❌ Error adding user ${orgMember.users_platform_id}: ${error.message}`);
                    totalErrors++;
                }
            }

            totalSkipped += skippedCount;
            console.log(`   ✅ Added ${addedCount} members to workspace`);
            if (skippedCount > 0) {
                console.log(`   ⏭️  Skipped ${skippedCount} members (already in workspace)`);
            }
        }

        console.log(`\n${'='.repeat(60)}`);
        console.log('📊 Migration Summary:');
        console.log(`   ✅ Total migrated: ${totalMigrated} workspace memberships created`);
        console.log(`   ⏭️  Total skipped: ${totalSkipped} (already existed)`);
        console.log(`   ❌ Total errors: ${totalErrors}`);
        console.log(`${'='.repeat(60)}\n`);

        if (totalErrors === 0) {
            console.log('🎉 Migration completed successfully!\n');
        } else {
            console.log('⚠️  Migration completed with some errors. Review logs above.\n');
        }

    } catch (error: any) {
        console.error('\n❌ Migration failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        // Close database connection
        if (dataSource?.isInitialized) {
            await dataSource.destroy();
            console.log('\n🔌 Database connection closed');
        }
    }
}

// Run migration
migrateOrgMembersToWorkspaces()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
