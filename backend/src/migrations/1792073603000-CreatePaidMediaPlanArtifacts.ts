import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from "typeorm";

export class CreatePaidMediaPlanArtifacts1792073603000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: "dra_paid_media_plan_artifacts",
                columns: [
                    { name: "id", type: "int", isPrimary: true, isGenerated: true, generationStrategy: "increment" },
                    { name: "plan_id", type: "int", isNullable: false },
                    { name: "step_id", type: "int", isNullable: true },
                    { name: "artifact_key", type: "varchar", length: "64", isNullable: false },
                    { name: "title", type: "varchar", length: "255", isNullable: false },
                    { name: "kind", type: "enum", enum: ["markdown", "json", "csv", "xlsx", "pptx", "html", "image"], isNullable: false },
                    { name: "mime_type", type: "varchar", length: "128", isNullable: false },
                    { name: "content", type: "text", isNullable: true },
                    { name: "storage_key", type: "varchar", length: "1024", isNullable: true },
                    { name: "byte_size", type: "int", default: 0, isNullable: false },
                    { name: "version", type: "int", default: 1, isNullable: false },
                    { name: "is_current", type: "boolean", default: true, isNullable: false },
                    { name: "source", type: "enum", enum: ["ai", "user_edited", "uploaded"], default: "'ai'", isNullable: false },
                    { name: "metadata", type: "jsonb", isNullable: true },
                    { name: "created_at", type: "timestamp", default: "CURRENT_TIMESTAMP" },
                    { name: "updated_at", type: "timestamp", default: "CURRENT_TIMESTAMP", onUpdate: "CURRENT_TIMESTAMP" },
                ],
            }),
            true
        );

        await queryRunner.createIndex(
            "dra_paid_media_plan_artifacts",
            new TableIndex({ name: "idx_paid_media_plan_artifacts_plan_current", columnNames: ["plan_id", "is_current"] })
        );
        await queryRunner.createIndex(
            "dra_paid_media_plan_artifacts",
            new TableIndex({ name: "uq_paid_media_plan_artifacts_plan_key_version", columnNames: ["plan_id", "artifact_key", "version"], isUnique: true })
        );

        await queryRunner.createForeignKey(
            "dra_paid_media_plan_artifacts",
            new TableForeignKey({ name: "fk_paid_media_plan_artifacts_plan", columnNames: ["plan_id"], referencedTableName: "dra_paid_media_plans", referencedColumnNames: ["id"], onDelete: "CASCADE" })
        );
        await queryRunner.createForeignKey(
            "dra_paid_media_plan_artifacts",
            new TableForeignKey({ name: "fk_paid_media_plan_artifacts_step", columnNames: ["step_id"], referencedTableName: "dra_paid_media_plan_steps", referencedColumnNames: ["id"], onDelete: "SET NULL" })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropIndex("dra_paid_media_plan_artifacts", "uq_paid_media_plan_artifacts_plan_key_version");
        await queryRunner.dropIndex("dra_paid_media_plan_artifacts", "idx_paid_media_plan_artifacts_plan_current");
        await queryRunner.dropForeignKey("dra_paid_media_plan_artifacts", "fk_paid_media_plan_artifacts_step");
        await queryRunner.dropForeignKey("dra_paid_media_plan_artifacts", "fk_paid_media_plan_artifacts_plan");
        await queryRunner.dropTable("dra_paid_media_plan_artifacts");
    }
}
