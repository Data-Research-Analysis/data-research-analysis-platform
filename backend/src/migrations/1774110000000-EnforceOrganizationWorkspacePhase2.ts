import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Phase 2: Organization & Workspace Enforcement Migration
 * 
 * Adds organization_id and workspace_id columns to:
 * - dra_data_sources (inherit from project)
 * - dra_data_models (inherit from data_source)
 * - dra_dashboards (inherit from project)
 * - dra_dashboards_exported_metadata (inherit from dashboard)
 * - dra_data_model_refresh_history (inherit from data_model)
 * - dra_data_model_sources (inherit from data_model)
 * - dra_table_metadata (inherit from data_source)
 * - dra_mongodb_sync_history (inherit from data_source)
 * 
 * After Phase 1 (projects + campaigns), this ensures all data resource tables
 * have proper multi-tenant isolation.
 */
export class EnforceOrganizationWorkspacePhase21774110000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log('🚀 Starting Phase 2: Data Resources Enforcement Migration');
        
        // STEP 1: Add columns to all 8 tables
        console.log('📝 Step 1: Adding organization_id and workspace_id columns...');
        
        await queryRunner.query(`
            ALTER TABLE "dra_data_sources" 
            ADD COLUMN IF NOT EXISTS "organization_id" INT,
            ADD COLUMN IF NOT EXISTS "workspace_id" INT
        `);
        
        await queryRunner.query(`
            ALTER TABLE "dra_data_models" 
            ADD COLUMN IF NOT EXISTS "organization_id" INT,
            ADD COLUMN IF NOT EXISTS "workspace_id" INT
        `);
        
        await queryRunner.query(`
            ALTER TABLE "dra_dashboards" 
            ADD COLUMN IF NOT EXISTS "organization_id" INT,
            ADD COLUMN IF NOT EXISTS "workspace_id" INT
        `);
        
        await queryRunner.query(`
            ALTER TABLE "dra_dashboards_exported_metadata" 
            ADD COLUMN IF NOT EXISTS "organization_id" INT,
            ADD COLUMN IF NOT EXISTS "workspace_id" INT
        `);
        
        await queryRunner.query(`
            ALTER TABLE "dra_data_model_refresh_history" 
            ADD COLUMN IF NOT EXISTS "organization_id" INT,
            ADD COLUMN IF NOT EXISTS "workspace_id" INT
        `);
        
        await queryRunner.query(`
            ALTER TABLE "dra_data_model_sources" 
            ADD COLUMN IF NOT EXISTS "organization_id" INT,
            ADD COLUMN IF NOT EXISTS "workspace_id" INT
        `);
        
        await queryRunner.query(`
            ALTER TABLE "dra_table_metadata" 
            ADD COLUMN IF NOT EXISTS "organization_id" INT,
            ADD COLUMN IF NOT EXISTS "workspace_id" INT
        `);
        
        await queryRunner.query(`
            ALTER TABLE "dra_mongodb_sync_history" 
            ADD COLUMN IF NOT EXISTS "organization_id" INT,
            ADD COLUMN IF NOT EXISTS "workspace_id" INT
        `);
        
        // STEP 2: Backfill data sources from projects
        console.log('📝 Step 2: Backfilling dra_data_sources from projects...');
        await queryRunner.query(`
            UPDATE dra_data_sources ds
            SET 
                organization_id = p.organization_id,
                workspace_id = p.workspace_id
            FROM dra_projects p
            WHERE ds.project_id = p.id
              AND (ds.organization_id IS NULL OR ds.workspace_id IS NULL)
        `);
        
        // STEP 3: Backfill data models from data sources
        console.log('📝 Step 3: Backfilling dra_data_models from data sources...');
        await queryRunner.query(`
            UPDATE dra_data_models dm
            SET 
                organization_id = ds.organization_id,
                workspace_id = ds.workspace_id
            FROM dra_data_sources ds
            WHERE dm.data_source_id = ds.id
              AND (dm.organization_id IS NULL OR dm.workspace_id IS NULL)
        `);
        
        // STEP 4: Backfill dashboards from projects
        console.log('📝 Step 4: Backfilling dra_dashboards from projects...');
        await queryRunner.query(`
            UPDATE dra_dashboards d
            SET 
                organization_id = p.organization_id,
                workspace_id = p.workspace_id
            FROM dra_projects p
            WHERE d.project_id = p.id
              AND (d.organization_id IS NULL OR d.workspace_id IS NULL)
        `);
        
        // STEP 4b: Handle dashboards without projects (templates or personal dashboards)
        console.log('📝 Step 4b: Handling orphaned dashboards (no project)...');
        
        // For dashboards with users_platform_id but no project, create personal org/workspace or use existing
        await queryRunner.query(`
            DO $$
            DECLARE
                dashboard_record RECORD;
                user_org_id INT;
                user_workspace_id INT;
                free_tier_id INT;
            BEGIN
                -- Get FREE tier ID
                SELECT id INTO free_tier_id 
                FROM dra_subscription_tiers 
                WHERE tier_name = 'free' 
                LIMIT 1;
                
                -- Loop through dashboards without org/workspace
                FOR dashboard_record IN 
                    SELECT d.id, d.users_platform_id, u.email, u.first_name, u.last_name
                    FROM dra_dashboards d
                    LEFT JOIN dra_users_platform u ON u.id = d.users_platform_id
                    WHERE (d.organization_id IS NULL OR d.workspace_id IS NULL)
                      AND d.users_platform_id IS NOT NULL
                LOOP
                    -- Try to find user's existing organization
                    SELECT o.id, w.id INTO user_org_id, user_workspace_id
                    FROM dra_organization_members om
                    JOIN dra_organizations o ON o.id = om.organization_id
                    JOIN dra_workspaces w ON w.organization_id = o.id AND w.is_active = true
                    WHERE om.users_platform_id = dashboard_record.users_platform_id
                      AND om.is_active = true
                      AND o.is_active = true
                    ORDER BY om.joined_at ASC, w.created_at ASC
                    LIMIT 1;
                    
                    -- If user has no organization, create one
                    IF user_org_id IS NULL THEN
                        -- Create personal organization
                        INSERT INTO dra_organizations (name, created_at, updated_at, is_active)
                        VALUES (
                            COALESCE(
                                dashboard_record.email,
                                CONCAT(dashboard_record.first_name, ' ', dashboard_record.last_name),
                                'User ' || dashboard_record.users_platform_id
                            ) || '''s Organization',
                            NOW(),
                            NOW(),
                            true
                        )
                        RETURNING id INTO user_org_id;
                        
                        -- Create organization subscription
                        IF free_tier_id IS NOT NULL THEN
                            INSERT INTO dra_organization_subscriptions (organization_id, subscription_tier_id, start_date)
                            VALUES (user_org_id, free_tier_id, NOW());
                        END IF;
                        
                        -- Create organization membership
                        INSERT INTO dra_organization_members (organization_id, users_platform_id, role, is_active, joined_at)
                        VALUES (user_org_id, dashboard_record.users_platform_id, 'owner', true, NOW());
                        
                        -- Create default workspace
                        INSERT INTO dra_workspaces (organization_id, name, slug, description, is_active, created_at, updated_at)
                        VALUES (
                            user_org_id,
                            'Default Workspace',
                            'default',
                            'Automatically created default workspace',
                            true,
                            NOW(),
                            NOW()
                        )
                        RETURNING id INTO user_workspace_id;
                        
                        -- Add user as workspace admin
                        INSERT INTO dra_workspace_members (workspace_id, users_platform_id, role, is_active, joined_at)
                        VALUES (user_workspace_id, dashboard_record.users_platform_id, 'admin', true, NOW());
                        
                        RAISE NOTICE 'Created organization % and workspace % for dashboard %', user_org_id, user_workspace_id, dashboard_record.id;
                    END IF;
                    
                    -- Update dashboard with org/workspace
                    UPDATE dra_dashboards
                    SET 
                        organization_id = user_org_id,
                        workspace_id = user_workspace_id
                    WHERE id = dashboard_record.id;
                    
                END LOOP;
                
                -- Handle completely orphaned dashboards (no user, no project) - delete them
                DELETE FROM dra_dashboards
                WHERE (organization_id IS NULL OR workspace_id IS NULL)
                  AND users_platform_id IS NULL
                  AND project_id IS NULL;
                  
                RAISE NOTICE 'Cleaned up orphaned dashboards with no user or project';
            END $$;
        `);
        
        // STEP 5: Backfill dashboard export metadata from dashboards
        console.log('📝 Step 5: Backfilling dra_dashboards_exported_metadata from dashboards...');
        await queryRunner.query(`
            UPDATE dra_dashboards_exported_metadata dem
            SET 
                organization_id = d.organization_id,
                workspace_id = d.workspace_id
            FROM dra_dashboards d
            WHERE dem.dashboard_id = d.id
              AND (dem.organization_id IS NULL OR dem.workspace_id IS NULL)
        `);
        
        // STEP 6: Backfill data model refresh history from data models
        console.log('📝 Step 6: Backfilling dra_data_model_refresh_history from data models...');
        await queryRunner.query(`
            UPDATE dra_data_model_refresh_history dmrh
            SET 
                organization_id = dm.organization_id,
                workspace_id = dm.workspace_id
            FROM dra_data_models dm
            WHERE dmrh.data_model_id = dm.id
              AND (dmrh.organization_id IS NULL OR dmrh.workspace_id IS NULL)
        `);
        
        // STEP 7: Backfill data model sources from data models
        console.log('📝 Step 7: Backfilling dra_data_model_sources from data models...');
        await queryRunner.query(`
            UPDATE dra_data_model_sources dms
            SET 
                organization_id = dm.organization_id,
                workspace_id = dm.workspace_id
            FROM dra_data_models dm
            WHERE dms.data_model_id = dm.id
              AND (dms.organization_id IS NULL OR dms.workspace_id IS NULL)
        `);
        
        // STEP 8: Backfill table metadata from data sources
        console.log('📝 Step 8: Backfilling dra_table_metadata from data sources...');
        await queryRunner.query(`
            UPDATE dra_table_metadata tm
            SET 
                organization_id = ds.organization_id,
                workspace_id = ds.workspace_id
            FROM dra_data_sources ds
            WHERE tm.data_source_id = ds.id
              AND (tm.organization_id IS NULL OR tm.workspace_id IS NULL)
        `);
        
        // STEP 9: Backfill MongoDB sync history from data sources
        console.log('📝 Step 9: Backfilling dra_mongodb_sync_history from data sources...');
        await queryRunner.query(`
            UPDATE dra_mongodb_sync_history msh
            SET 
                organization_id = ds.organization_id,
                workspace_id = ds.workspace_id
            FROM dra_data_sources ds
            WHERE msh.data_source_id = ds.id
              AND (msh.organization_id IS NULL OR msh.workspace_id IS NULL)
        `);
        
        // STEP 10: Verify all records have both organization_id and workspace_id
        console.log('📝 Step 10: Verifying all records have organization and workspace...');
        
        const tables = [
            'dra_data_sources',
            'dra_data_models',
            'dra_dashboards',
            'dra_dashboards_exported_metadata',
            'dra_data_model_refresh_history',
            'dra_data_model_sources',
            'dra_table_metadata',
            'dra_mongodb_sync_history'
        ];
        
        for (const table of tables) {
            const nullCount = await queryRunner.query(`
                SELECT COUNT(*) as count 
                FROM ${table} 
                WHERE organization_id IS NULL OR workspace_id IS NULL
            `);
            
            if (parseInt(nullCount[0].count) > 0) {
                throw new Error(
                    `❌ Verification failed: ${nullCount[0].count} records in ${table} still have NULL organization_id or workspace_id. ` +
                    `All records must be associated with an organization and workspace before enforcing NOT NULL constraint.`
                );
            }
        }
        
        console.log('✅ Verification passed: All records have organization and workspace');
        
        // STEP 11: Make columns NOT NULL
        console.log('📝 Step 11: Enforcing NOT NULL constraints...');
        
        for (const table of tables) {
            await queryRunner.query(`
                ALTER TABLE "${table}"
                ALTER COLUMN "organization_id" SET NOT NULL,
                ALTER COLUMN "workspace_id" SET NOT NULL
            `);
        }
        
        // STEP 12: Add foreign key constraints with CASCADE delete
        console.log('📝 Step 12: Adding foreign key constraints...');
        
        for (const table of tables) {
            // Organization FK
            await queryRunner.query(`
                ALTER TABLE "${table}"
                ADD CONSTRAINT "fk_${table}_organization"
                FOREIGN KEY ("organization_id")
                REFERENCES "dra_organizations"("id")
                ON DELETE CASCADE
            `);
            
            // Workspace FK
            await queryRunner.query(`
                ALTER TABLE "${table}"
                ADD CONSTRAINT "fk_${table}_workspace"
                FOREIGN KEY ("workspace_id")
                REFERENCES "dra_workspaces"("id")
                ON DELETE CASCADE
            `);
        }
        
        // STEP 13: Add indexes for performance
        console.log('📝 Step 13: Creating indexes for query performance...');
        
        for (const table of tables) {
            // Composite index for organization + workspace filtering
            await queryRunner.query(`
                CREATE INDEX IF NOT EXISTS "idx_${table}_org_workspace"
                ON "${table}" ("organization_id", "workspace_id")
            `);
            
            // Individual indexes
            await queryRunner.query(`
                CREATE INDEX IF NOT EXISTS "idx_${table}_organization"
                ON "${table}" ("organization_id")
            `);
            
            await queryRunner.query(`
                CREATE INDEX IF NOT EXISTS "idx_${table}_workspace"
                ON "${table}" ("workspace_id")
            `);
        }
        
        console.log('✅ Phase 2 Migration Complete!');
        console.log('📊 Tables updated: dra_data_sources, dra_data_models, dra_dashboards, ' +
                    'dra_dashboards_exported_metadata, dra_data_model_refresh_history, ' +
                    'dra_data_model_sources, dra_table_metadata, dra_mongodb_sync_history');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        console.log('⏪ Rolling back Phase 2: Data Resources Enforcement Migration');
        
        const tables = [
            'dra_data_sources',
            'dra_data_models',
            'dra_dashboards',
            'dra_dashboards_exported_metadata',
            'dra_data_model_refresh_history',
            'dra_data_model_sources',
            'dra_table_metadata',
            'dra_mongodb_sync_history'
        ];
        
        // Drop indexes
        console.log('📝 Dropping indexes...');
        for (const table of tables) {
            await queryRunner.query(`DROP INDEX IF EXISTS "idx_${table}_org_workspace"`);
            await queryRunner.query(`DROP INDEX IF EXISTS "idx_${table}_organization"`);
            await queryRunner.query(`DROP INDEX IF EXISTS "idx_${table}_workspace"`);
        }
        
        // Drop foreign key constraints
        console.log('📝 Dropping foreign key constraints...');
        for (const table of tables) {
            await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "fk_${table}_organization"`);
            await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "fk_${table}_workspace"`);
        }
        
        // Make columns nullable again (don't drop - preserve data for possible re-migration)
        console.log('📝 Making columns nullable...');
        for (const table of tables) {
            await queryRunner.query(`
                ALTER TABLE "${table}"
                ALTER COLUMN "organization_id" DROP NOT NULL,
                ALTER COLUMN "workspace_id" DROP NOT NULL
            `);
        }
        
        console.log('✅ Phase 2 Migration rollback complete (data preserved)');
    }
}
