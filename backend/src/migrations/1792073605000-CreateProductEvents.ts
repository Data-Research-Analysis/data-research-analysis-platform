import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from "typeorm";

export class CreateProductEvents1792073605000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: "dra_product_events",
                columns: [
                    { name: "id", type: "int", isPrimary: true, isGenerated: true, generationStrategy: "increment" },
                    { name: "user_id", type: "int", isNullable: true },
                    { name: "organization_id", type: "int", isNullable: true },
                    { name: "workspace_id", type: "int", isNullable: true },
                    { name: "project_id", type: "int", isNullable: true },
                    { name: "plan_id", type: "int", isNullable: true },
                    { name: "event_name", type: "varchar", length: "128", isNullable: false },
                    { name: "properties", type: "jsonb", isNullable: true },
                    { name: "session_id", type: "varchar", length: "64", isNullable: true },
                    { name: "source", type: "enum", enum: ["backend", "frontend"], default: "'frontend'", isNullable: false },
                    { name: "created_at", type: "timestamp", default: "CURRENT_TIMESTAMP" },
                ],
            }),
            true
        );

        await queryRunner.createIndex(
            "dra_product_events",
            new TableIndex({ name: "idx_product_events_event_name_created_at", columnNames: ["event_name", "created_at"] })
        );
        await queryRunner.createIndex(
            "dra_product_events",
            new TableIndex({ name: "idx_product_events_plan_id", columnNames: ["plan_id"] })
        );
        await queryRunner.createIndex(
            "dra_product_events",
            new TableIndex({ name: "idx_product_events_project_id", columnNames: ["project_id"] })
        );

        await queryRunner.createForeignKey(
            "dra_product_events",
            new TableForeignKey({ name: "fk_product_events_user", columnNames: ["user_id"], referencedTableName: "dra_users_platform", referencedColumnNames: ["id"], onDelete: "SET NULL" })
        );
        await queryRunner.createForeignKey(
            "dra_product_events",
            new TableForeignKey({ name: "fk_product_events_organization", columnNames: ["organization_id"], referencedTableName: "dra_organizations", referencedColumnNames: ["id"], onDelete: "SET NULL" })
        );
        await queryRunner.createForeignKey(
            "dra_product_events",
            new TableForeignKey({ name: "fk_product_events_workspace", columnNames: ["workspace_id"], referencedTableName: "dra_workspaces", referencedColumnNames: ["id"], onDelete: "SET NULL" })
        );
        await queryRunner.createForeignKey(
            "dra_product_events",
            new TableForeignKey({ name: "fk_product_events_project", columnNames: ["project_id"], referencedTableName: "dra_projects", referencedColumnNames: ["id"], onDelete: "SET NULL" })
        );
        await queryRunner.createForeignKey(
            "dra_product_events",
            new TableForeignKey({ name: "fk_product_events_plan", columnNames: ["plan_id"], referencedTableName: "dra_paid_media_plans", referencedColumnNames: ["id"], onDelete: "SET NULL" })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropIndex("dra_product_events", "idx_product_events_project_id");
        await queryRunner.dropIndex("dra_product_events", "idx_product_events_plan_id");
        await queryRunner.dropIndex("dra_product_events", "idx_product_events_event_name_created_at");
        await queryRunner.dropForeignKey("dra_product_events", "fk_product_events_plan");
        await queryRunner.dropForeignKey("dra_product_events", "fk_product_events_project");
        await queryRunner.dropForeignKey("dra_product_events", "fk_product_events_workspace");
        await queryRunner.dropForeignKey("dra_product_events", "fk_product_events_organization");
        await queryRunner.dropForeignKey("dra_product_events", "fk_product_events_user");
        await queryRunner.dropTable("dra_product_events");
    }
}
