import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from "typeorm";

export class CreatePaidMediaPlans1792073600000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: "dra_paid_media_plans",
                columns: [
                    { name: "id", type: "int", isPrimary: true, isGenerated: true, generationStrategy: "increment" },
                    { name: "project_id", type: "int", isNullable: false },
                    { name: "organization_id", type: "int", isNullable: false },
                    { name: "workspace_id", type: "int", isNullable: false },
                    { name: "created_by", type: "int", isNullable: false },
                    { name: "name", type: "varchar", length: "255", isNullable: false },
                    { name: "slug", type: "varchar", length: "255", isNullable: false },
                    { name: "mode", type: "enum", enum: ["basic", "advanced"], default: "'basic'", isNullable: false },
                    { name: "status", type: "enum", enum: ["draft", "running", "paused", "completed", "archived"], default: "'draft'", isNullable: false },
                    { name: "funnel_coverage", type: "enum", enum: ["bofu", "bofu_mofu", "full_funnel"], default: "'bofu_mofu'", isNullable: false },
                    { name: "build_mode", type: "enum", enum: ["test_only", "build_to_scale"], default: "'test_only'", isNullable: false },
                    { name: "platforms", type: "jsonb", isNullable: false, default: "'[]'" },
                    { name: "markets", type: "jsonb", isNullable: false, default: "'[]'" },
                    { name: "budget_total", type: "numeric", precision: 14, scale: 2, isNullable: true },
                    { name: "currency", type: "varchar", length: "3", default: "'USD'", isNullable: false },
                    { name: "start_date", type: "date", isNullable: true },
                    { name: "end_date", type: "date", isNullable: true },
                    { name: "current_step", type: "int", default: 0, isNullable: false },
                    { name: "state", type: "jsonb", isNullable: false, default: "'{}'" },
                    { name: "settings", type: "jsonb", isNullable: false, default: "'{}'" },
                    { name: "created_at", type: "timestamp", default: "CURRENT_TIMESTAMP" },
                    { name: "updated_at", type: "timestamp", default: "CURRENT_TIMESTAMP", onUpdate: "CURRENT_TIMESTAMP" },
                ],
            }),
            true
        );

        await queryRunner.createIndex(
            "dra_paid_media_plans",
            new TableIndex({ name: "idx_paid_media_plans_project_status", columnNames: ["project_id", "status"] })
        );
        await queryRunner.createIndex(
            "dra_paid_media_plans",
            new TableIndex({ name: "idx_paid_media_plans_org_workspace", columnNames: ["organization_id", "workspace_id"] })
        );
        await queryRunner.createIndex(
            "dra_paid_media_plans",
            new TableIndex({ name: "uq_paid_media_plans_project_slug", columnNames: ["project_id", "slug"], isUnique: true })
        );

        await queryRunner.createForeignKey(
            "dra_paid_media_plans",
            new TableForeignKey({ name: "fk_paid_media_plans_project", columnNames: ["project_id"], referencedTableName: "dra_projects", referencedColumnNames: ["id"], onDelete: "CASCADE" })
        );
        await queryRunner.createForeignKey(
            "dra_paid_media_plans",
            new TableForeignKey({ name: "fk_paid_media_plans_organization", columnNames: ["organization_id"], referencedTableName: "dra_organizations", referencedColumnNames: ["id"], onDelete: "CASCADE" })
        );
        await queryRunner.createForeignKey(
            "dra_paid_media_plans",
            new TableForeignKey({ name: "fk_paid_media_plans_workspace", columnNames: ["workspace_id"], referencedTableName: "dra_workspaces", referencedColumnNames: ["id"], onDelete: "CASCADE" })
        );
        await queryRunner.createForeignKey(
            "dra_paid_media_plans",
            new TableForeignKey({ name: "fk_paid_media_plans_created_by", columnNames: ["created_by"], referencedTableName: "dra_users_platform", referencedColumnNames: ["id"], onDelete: "RESTRICT" })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropIndex("dra_paid_media_plans", "uq_paid_media_plans_project_slug");
        await queryRunner.dropIndex("dra_paid_media_plans", "idx_paid_media_plans_org_workspace");
        await queryRunner.dropIndex("dra_paid_media_plans", "idx_paid_media_plans_project_status");
        await queryRunner.dropForeignKey("dra_paid_media_plans", "fk_paid_media_plans_created_by");
        await queryRunner.dropForeignKey("dra_paid_media_plans", "fk_paid_media_plans_workspace");
        await queryRunner.dropForeignKey("dra_paid_media_plans", "fk_paid_media_plans_organization");
        await queryRunner.dropForeignKey("dra_paid_media_plans", "fk_paid_media_plans_project");
        await queryRunner.dropTable("dra_paid_media_plans");
    }
}
