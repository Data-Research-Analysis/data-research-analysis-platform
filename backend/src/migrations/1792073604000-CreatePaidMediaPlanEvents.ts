import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from "typeorm";

export class CreatePaidMediaPlanEvents1792073604000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: "dra_paid_media_plan_events",
                columns: [
                    { name: "id", type: "int", isPrimary: true, isGenerated: true, generationStrategy: "increment" },
                    { name: "plan_id", type: "int", isNullable: false },
                    { name: "step_id", type: "int", isNullable: true },
                    { name: "event_type", type: "varchar", length: "64", isNullable: false },
                    { name: "severity", type: "enum", enum: ["info", "warn", "error"], default: "'info'", isNullable: false },
                    { name: "message", type: "text", isNullable: false },
                    { name: "data", type: "jsonb", isNullable: true },
                    { name: "created_at", type: "timestamp", default: "CURRENT_TIMESTAMP" },
                ],
            }),
            true
        );

        await queryRunner.createIndex(
            "dra_paid_media_plan_events",
            new TableIndex({ name: "idx_paid_media_plan_events_plan_created", columnNames: ["plan_id", "created_at"] })
        );

        await queryRunner.createForeignKey(
            "dra_paid_media_plan_events",
            new TableForeignKey({ name: "fk_paid_media_plan_events_plan", columnNames: ["plan_id"], referencedTableName: "dra_paid_media_plans", referencedColumnNames: ["id"], onDelete: "CASCADE" })
        );
        await queryRunner.createForeignKey(
            "dra_paid_media_plan_events",
            new TableForeignKey({ name: "fk_paid_media_plan_events_step", columnNames: ["step_id"], referencedTableName: "dra_paid_media_plan_steps", referencedColumnNames: ["id"], onDelete: "SET NULL" })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropIndex("dra_paid_media_plan_events", "idx_paid_media_plan_events_plan_created");
        await queryRunner.dropForeignKey("dra_paid_media_plan_events", "fk_paid_media_plan_events_step");
        await queryRunner.dropForeignKey("dra_paid_media_plan_events", "fk_paid_media_plan_events_plan");
        await queryRunner.dropTable("dra_paid_media_plan_events");
    }
}
