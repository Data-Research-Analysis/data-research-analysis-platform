import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Multi-Tenant Organization Management - Phase 1 Migration
 * 
 * Creates all tables needed for organization-based multi-tenancy:
 * - dra_organizations (owns all data)
 * - dra_workspaces (groups projects by department/team)
 * - dra_organization_members (org-level access control)
 * - dra_workspace_members (workspace-level access control)
 * - dra_organization_subscriptions (billing at org level)
 * 
 * Updates:
 * - dra_projects: Adds organization_id and workspace_id (nullable for migration)
 * 
 * @see Issue #283: Multi-Tenant Organization Management
 * @see documentation/multi-tenant-gap-analysis.md
 */
export class CreateOrganizationTables1774000000000 implements MigrationInterface {
    name = 'CreateOrganizationTables1774000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Create dra_organizations table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "dra_organizations" (
                "id"           SERIAL PRIMARY KEY,
                "name"         VARCHAR(255) NOT NULL,
                "slug"         VARCHAR(100) NOT NULL UNIQUE,
                "domain"       VARCHAR(255),
                "logo_url"     TEXT,
                "is_active"    BOOLEAN NOT NULL DEFAULT true,
                "settings"     JSONB NOT NULL DEFAULT '{}',
                "created_at"   TIMESTAMP NOT NULL DEFAULT NOW(),
                "updated_at"   TIMESTAMP NOT NULL DEFAULT NOW()
            )
        `);

        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_dra_organizations_slug" ON "dra_organizations"("slug")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_dra_organizations_domain" ON "dra_organizations"("domain")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_dra_organizations_is_active" ON "dra_organizations"("is_active")`);

        // 2. Create dra_workspaces table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "dra_workspaces" (
                "id"              SERIAL PRIMARY KEY,
                "organization_id" INT NOT NULL REFERENCES "dra_organizations"("id") ON DELETE CASCADE,
                "name"            VARCHAR(255) NOT NULL,
                "description"     TEXT,
                "slug"            VARCHAR(100) NOT NULL,
                "is_active"       BOOLEAN NOT NULL DEFAULT true,
                "created_at"      TIMESTAMP NOT NULL DEFAULT NOW(),
                "updated_at"      TIMESTAMP NOT NULL DEFAULT NOW(),
                CONSTRAINT "uq_workspace_org_slug" UNIQUE ("organization_id", "slug")
            )
        `);

        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_dra_workspaces_organization_id" ON "dra_workspaces"("organization_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_dra_workspaces_is_active" ON "dra_workspaces"("is_active")`);

        // 3. Create dra_organization_members table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "dra_organization_members" (
                "id"                   SERIAL PRIMARY KEY,
                "organization_id"      INT NOT NULL REFERENCES "dra_organizations"("id") ON DELETE CASCADE,
                "users_platform_id"    INT NOT NULL REFERENCES "dra_users_platform"("id") ON DELETE CASCADE,
                "role"                 VARCHAR(20) NOT NULL DEFAULT 'member'
                                           CHECK ("role" IN ('owner', 'admin', 'member')),
                "is_active"            BOOLEAN NOT NULL DEFAULT true,
                "joined_at"            TIMESTAMP NOT NULL DEFAULT NOW(),
                "invited_by_user_id"   INT REFERENCES "dra_users_platform"("id") ON DELETE SET NULL,
                CONSTRAINT "uq_org_member" UNIQUE ("organization_id", "users_platform_id")
            )
        `);

        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_dra_organization_members_org_id" ON "dra_organization_members"("organization_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_dra_organization_members_user_id" ON "dra_organization_members"("users_platform_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_dra_organization_members_user_org" ON "dra_organization_members"("users_platform_id", "organization_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_dra_organization_members_is_active" ON "dra_organization_members"("is_active")`);

        // 4. Create dra_workspace_members table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "dra_workspace_members" (
                "id"                 SERIAL PRIMARY KEY,
                "workspace_id"       INT NOT NULL REFERENCES "dra_workspaces"("id") ON DELETE CASCADE,
                "users_platform_id"  INT NOT NULL REFERENCES "dra_users_platform"("id") ON DELETE CASCADE,
                "role"               VARCHAR(20) NOT NULL DEFAULT 'viewer'
                                         CHECK ("role" IN ('admin', 'editor', 'viewer')),
                "is_active"          BOOLEAN NOT NULL DEFAULT true,
                "joined_at"          TIMESTAMP NOT NULL DEFAULT NOW(),
                "added_by_user_id"   INT REFERENCES "dra_users_platform"("id") ON DELETE SET NULL,
                CONSTRAINT "uq_workspace_member" UNIQUE ("workspace_id", "users_platform_id")
            )
        `);

        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_dra_workspace_members_workspace_id" ON "dra_workspace_members"("workspace_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_dra_workspace_members_user_id" ON "dra_workspace_members"("users_platform_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_dra_workspace_members_user_workspace" ON "dra_workspace_members"("users_platform_id", "workspace_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_dra_workspace_members_is_active" ON "dra_workspace_members"("is_active")`);

        // 5. Create dra_organization_subscriptions table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "dra_organization_subscriptions" (
                "id"                     SERIAL PRIMARY KEY,
                "organization_id"        INT NOT NULL UNIQUE REFERENCES "dra_organizations"("id") ON DELETE CASCADE,
                "subscription_tier_id"   INT NOT NULL REFERENCES "dra_subscription_tiers"("id"),
                "stripe_subscription_id" VARCHAR(100),
                "stripe_customer_id"     VARCHAR(100),
                "max_members"            INT,
                "current_members"        INT NOT NULL DEFAULT 1,
                "is_active"              BOOLEAN NOT NULL DEFAULT true,
                "started_at"             TIMESTAMP NOT NULL DEFAULT NOW(),
                "ends_at"                TIMESTAMP,
                "cancelled_at"           TIMESTAMP,
                "trial_ends_at"          TIMESTAMP
            )
        `);

        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_dra_organization_subscriptions_org_id" ON "dra_organization_subscriptions"("organization_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_dra_organization_subscriptions_tier_id" ON "dra_organization_subscriptions"("subscription_tier_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_dra_organization_subscriptions_stripe_sub" ON "dra_organization_subscriptions"("stripe_subscription_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_dra_organization_subscriptions_is_active" ON "dra_organization_subscriptions"("is_active")`);

        // 6. Add organization_id and workspace_id columns to dra_projects (nullable for migration)
        await queryRunner.query(`
            ALTER TABLE "dra_projects" 
            ADD COLUMN IF NOT EXISTS "organization_id" INT REFERENCES "dra_organizations"("id") ON DELETE CASCADE
        `);

        await queryRunner.query(`
            ALTER TABLE "dra_projects" 
            ADD COLUMN IF NOT EXISTS "workspace_id" INT REFERENCES "dra_workspaces"("id") ON DELETE CASCADE
        `);

        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_dra_projects_organization_id" ON "dra_projects"("organization_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_dra_projects_workspace_id" ON "dra_projects"("workspace_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_dra_projects_org_workspace" ON "dra_projects"("organization_id", "workspace_id")`);

        // Note: Phase 2 migration script will:
        // 1. Create personal organizations for existing users
        // 2. Create default workspaces
        // 3. Migrate user subscriptions to organization subscriptions
        // 4. Update projects with organization_id and workspace_id
        // 5. Make these columns NOT NULL
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop in reverse order (respect foreign key constraints)
        
        // Remove columns from dra_projects
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_dra_projects_org_workspace"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_dra_projects_workspace_id"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_dra_projects_organization_id"`);
        await queryRunner.query(`ALTER TABLE "dra_projects" DROP COLUMN IF EXISTS "workspace_id"`);
        await queryRunner.query(`ALTER TABLE "dra_projects" DROP COLUMN IF EXISTS "organization_id"`);

        // Drop tables
        await queryRunner.query(`DROP TABLE IF EXISTS "dra_organization_subscriptions"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "dra_workspace_members"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "dra_organization_members"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "dra_workspaces"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "dra_organizations"`);
    }
}
