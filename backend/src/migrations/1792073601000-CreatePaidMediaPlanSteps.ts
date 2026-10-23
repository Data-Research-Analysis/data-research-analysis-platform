import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from "typeorm";

export class CreatePaidMediaPlanSteps1792073601000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: "dra_paid_media_plan_steps",
                columns: [
                    { name: "id", type: "int", isPrimary: true, isGenerated: true, generationStrategy: "increment" },
                    { name: "plan_id", type: "int", isNullable: false },
                    { name: "step_number", type: "int", isNullable: false },
                    { name: "step_key", type: "varchar", length: "64", isNullable: false },
                    { name: "title", type: "varchar", length: "255", isNullable: false },
                    { name: "status", type: "enum", enum: ["pending", "running", "waiting_for_input", "completed", "failed", "skipped"], default: "'pending'", isNullable: false },
                    { name: "started_at", type: "timestamp", isNullable: true },
                    { name: "completed_at", type: "timestamp", isNullable: true },
                    { name: "duration_ms", type: "int", isNullable: true },
                    { name: "attempts", type: "int", default: 0, isNullable: false },
                    { name: "error", type: "text", isNullable: true },
                    { name: "output_summary", type: "text", isNullable: true },
                    { name: "gate", type: "jsonb", isNullable: true },
                    { name: "run_meta", type: "jsonb", isNullable: true },
                    { name: "created_at", type: "timestamp", default: "CURRENT_TIMESTAMP" },
                    { name: "updated_at", type: "timestamp", default: "CURRENT_TIMESTAMP", onUpdate: "CURRENT_TIMESTAMP" },
                ],
            }),
            true
        );

        await queryRunner.createIndex(
            "dra_paid_media_plan_steps",
            new TableIndex({ name: "uq_paid_media_plan_steps_plan_key", columnNames: ["plan_id", "step_key"], isUnique: true })
        );
        await queryRunner.createIndex(
            "dra_paid_media_plan_steps",
            new TableIndex({ name: "idx_paid_media_plan_steps_plan_status", columnNames: ["plan_id", "status"] })
        );

        await queryRunner.createForeignKey(
            "dra_paid_media_plan_steps",
            new TableForeignKey({ name: "fk_paid_media_plan_steps_plan", columnNames: ["plan_id"], referencedTableName: "dra_paid_media_plans", referencedColumnNames: ["id"], onDelete: "CASCADE" })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropIndex("dra_paid_media_plan_steps", "idx_paid_media_plan_steps_plan_status");
        await queryRunner.dropIndex("dra_paid_media_plan_steps", "uq_paid_media_plan_steps_plan_key");
        await queryRunner.dropForeignKey("dra_paid_media_plan_steps", "fk_paid_media_plan_steps_plan");
        await queryRunner.dropTable("dra_paid_media_plan_steps");
    }
}
