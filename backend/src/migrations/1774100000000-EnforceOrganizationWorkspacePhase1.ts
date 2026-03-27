import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Multi-Tenant Organization & Workspace Enforcement - Phase 1
 * 
 * Enforces organization_id and workspace_id constraints on core tables:
 * - dra_projects: Make both columns NOT NULL (backfill workspace_id)
 * - dra_campaigns: Add both columns with constraints
 * 
 * **Backfill Strategy**:
 * 1. For projects with organization_id: assign to default workspace
 * 2. For projects without organization_id: create personal org + workspace
 * 3. For campaigns: inherit from parent project
 * 
 * **Requires**: Planned downtime (data migration)
 * 
 * @see documentation/multi-tenant-gap-analysis.md
 * @see Phase 2: Data sources, models, dashboards (separate migration)
 * @see Phase 3: Other resources (separate migration)
 */
export class EnforceOrganizationWorkspacePhase11774100000000 implements MigrationInterface {
    
    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log('🚀 Starting Phase 1: Organization & Workspace Enforcement Migration');
        
        // ============================================================
        // STEP 1: Add columns to dra_campaigns
        // ============================================================
        console.log('📝 Step 1: Adding organization_id and workspace_id to dra_campaigns...');
        
        await queryRunner.query(`
            ALTER TABLE "dra_campaigns" 
            ADD COLUMN IF NOT EXISTS "organization_id" INT,
            ADD COLUMN IF NOT EXISTS "workspace_id" INT
        `);
        
        // ============================================================
        // STEP 2: Backfill dra_projects.workspace_id from default workspace
        // ============================================================
        console.log('📝 Step 2: Backfilling dra_projects.workspace_id from default workspace...');
        
        // For projects that already have organization_id, find the default workspace
        await queryRunner.query(`
            UPDATE dra_projects p
            SET workspace_id = (
                SELECT w.id 
                FROM dra_workspaces w
                WHERE w.organization_id = p.organization_id
                  AND w.is_active = true
                  AND (w.slug = 'default' OR w.name = 'Default Workspace')
                ORDER BY w.created_at ASC
                LIMIT 1
            )
            WHERE p.organization_id IS NOT NULL 
              AND p.workspace_id IS NULL
        `);
        
        // ============================================================
        // STEP 3: Create personal organizations for legacy projects
        // ============================================================
        console.log('📝 Step 3: Creating personal organizations for projects without organization_id...');
        
        // Find all users with projects that have no organization
        // Create personal organization and default workspace for each
        await queryRunner.query(`
            DO $$
            DECLARE
                user_record RECORD;
                org_id INT;
                work_space_id INT;
                free_tier_id INT;
            BEGIN
                -- Get FREE tier ID (fallback if not found)
                SELECT id INTO free_tier_id 
                FROM dra_subscription_tiers 
                WHERE tier_name = 'free' 
                LIMIT 1;
                
                -- Loop through users with orphaned projects
                FOR user_record IN 
                    SELECT DISTINCT p.users_platform_id, u.email, u.first_name, u.last_name
                    FROM dra_projects p
                    LEFT JOIN dra_users_platform u ON u.id = p.users_platform_id
                    WHERE p.organization_id IS NULL
                LOOP
                    -- Create personal organization
                    INSERT INTO dra_organizations (name, created_at, updated_at, is_active)
                    VALUES (
                        COALESCE(
                            user_record.email,
                            CONCAT(user_record.first_name, ' ', user_record.last_name),
                            'User ' || user_record.users_platform_id
                        ) || '''s Organization',
                        NOW(),
                        NOW(),
                        true
                    )
                        RETURNING id INTO org_id;
                    
                    -- Create organization subscription
                    INSERT INTO dra_organization_subscriptions (organization_id, subscription_tier_id, started_at)
                    VALUES (org_id, free_tier_id, NOW());
                    
                    -- Create organization membership (owner)
                    INSERT INTO dra_organization_members (organization_id, users_platform_id, role, is_active, joined_at)
                    VALUES (org_id, user_record.users_platform_id, 'owner', true, NOW());
                    
                    -- Create default workspace
                    INSERT INTO dra_workspaces (organization_id, name, slug, description, is_active, created_at, updated_at)
                    VALUES (
                        org_id,
                        'Default Workspace',
                        'default',
                        'Automatically created default workspace',
                        true,
                        NOW(),
                        NOW()
                    )
                        RETURNING id INTO work_space_id;
                    
                    -- Add user as workspace admin
                    INSERT INTO dra_workspace_members (workspace_id, users_platform_id, role, is_active, joined_at)
                    VALUES (work_space_id, user_record.users_platform_id, 'admin', true, NOW());
                    
                    -- Update all projects for this user
                    UPDATE dra_projects
                    SET 
                        organization_id = org_id,
                        workspace_id = work_space_id
                    WHERE users_platform_id = user_record.users_platform_id
                      AND organization_id IS NULL;
                    
                    RAISE NOTICE 'Created organization % and workspace % for user %', org_id, work_space_id, user_record.users_platform_id;
                END LOOP;
            END $$;
        `);
        
        // ============================================================
        // STEP 4: Verify all projects now have both IDs
        // ============================================================
        console.log('📝 Step 4: Verifying all projects have organization_id and workspace_id...');
        
        const nullOrgProjects = await queryRunner.query(`
            SELECT COUNT(*) as count FROM dra_projects WHERE organization_id IS NULL
        `);
        
        const nullWorkspaceProjects = await queryRunner.query(`
            SELECT COUNT(*) as count FROM dra_projects WHERE workspace_id IS NULL
        `);
        
        if (parseInt(nullOrgProjects[0].count) > 0) {
            throw new Error(`Migration failed: ${nullOrgProjects[0].count} projects still have NULL organization_id`);
        }
        
        if (parseInt(nullWorkspaceProjects[0].count) > 0) {
            throw new Error(`Migration failed: ${nullWorkspaceProjects[0].count} projects still have NULL workspace_id`);
        }
        
        console.log('✅ All projects have organization_id and workspace_id');
        
        // ============================================================
        // STEP 5: Backfill dra_campaigns from parent projects
        // ============================================================
        console.log('📝 Step 5: Backfilling dra_campaigns from parent projects...');
        
        await queryRunner.query(`
            UPDATE dra_campaigns c
            SET 
                organization_id = p.organization_id,
                workspace_id = p.workspace_id
            FROM dra_projects p
            WHERE c.project_id = p.id
              AND c.organization_id IS NULL
        `);
        
        // ============================================================
        // STEP 6: Make columns NOT NULL (enforce constraints)
        // ============================================================
        console.log('📝 Step 6: Making organization_id and workspace_id NOT NULL...');
        
        await queryRunner.query(`
            ALTER TABLE "dra_projects"
            ALTER COLUMN "organization_id" SET NOT NULL,
            ALTER COLUMN "workspace_id" SET NOT NULL
        `);
        
        await queryRunner.query(`
            ALTER TABLE "dra_campaigns"
            ALTER COLUMN "organization_id" SET NOT NULL,
            ALTER COLUMN "workspace_id" SET NOT NULL
        `);
        
        // ============================================================
        // STEP 7: Add foreign key constraints
        // ============================================================
        console.log('📝 Step 7: Adding foreign key constraints...');
        
        // Campaign constraints (projects already have them)
        await queryRunner.query(`
            ALTER TABLE "dra_campaigns"
            ADD CONSTRAINT "fk_campaigns_organization" 
                FOREIGN KEY ("organization_id") REFERENCES "dra_organizations"("id") ON DELETE CASCADE,
            ADD CONSTRAINT "fk_campaigns_workspace"
                FOREIGN KEY ("workspace_id") REFERENCES "dra_workspaces"("id") ON DELETE CASCADE
        `);
        
        // ============================================================
        // STEP 8: Add indexes for query performance
        // ==================================================================================================================        console.log('📝 Step 8: Adding performance indexes...');
        
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_campaigns_organization_id" ON "dra_campaigns"("organization_id");
            CREATE INDEX IF NOT EXISTS "idx_campaigns_workspace_id" ON "dra_campaigns"("workspace_id");
            CREATE INDEX IF NOT EXISTS "idx_campaigns_org_workspace" ON "dra_campaigns"("organization_id", "workspace_id");
        `);
        
        // Also add composite index for projects if not exists
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_projects_org_workspace_user" 
            ON "dra_projects"("organization_id", "workspace_id", "users_platform_id");
        `);
        
        console.log('✅ Phase 1 Migration Complete!');
        console.log('📊 Summary:');
        console.log('   - dra_projects: organization_id and workspace_id now REQUIRED');
        console.log('   - dra_campaigns: organization_id and workspace_id now REQUIRED');
        console.log('   - All existing data backfilled');
        console.log('   - Foreign key constraints added');
        console.log('   - Performance indexes created');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        console.log('⏪ Rolling back Phase 1: Organization & Workspace Enforcement...');
        
        // Drop indexes
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_projects_org_workspace_user"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_campaigns_org_workspace"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_campaigns_workspace_id"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_campaigns_organization_id"`);
        
        // Drop foreign key constraints
        await queryRunner.query(`ALTER TABLE "dra_campaigns" DROP CONSTRAINT IF EXISTS "fk_campaigns_workspace"`);
        await queryRunner.query(`ALTER TABLE "dra_campaigns" DROP CONSTRAINT IF EXISTS "fk_campaigns_organization"`);
        
        // Make columns nullable again
        await queryRunner.query(`ALTER TABLE "dra_projects" ALTER COLUMN "workspace_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "dra_projects" ALTER COLUMN "organization_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "dra_campaigns" ALTER COLUMN "workspace_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "dra_campaigns" ALTER COLUMN "organization_id" DROP NOT NULL`);
        
        // NOTE: We do NOT drop the columns or delete created organizations
        // This allows re-running the migration without data loss
        // To fully revert, manually drop columns and clean up data
        
        console.log('⏪ Rollback complete (columns remain but constraints removed)');
    }
}
