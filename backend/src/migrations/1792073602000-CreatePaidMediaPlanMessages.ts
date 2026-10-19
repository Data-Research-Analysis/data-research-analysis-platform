import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from "typeorm";

export class CreatePaidMediaPlanMessages1792073602000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: "dra_paid_media_plan_messages",
                columns: [
                    { name: "id", type: "int", isPrimary: true, isGenerated: true, generationStrategy: "increment" },
                    { name: "plan_id", type: "int", isNullable: false },
                    { name: "step_id", type: "int", isNullable: true },
                    { name: "role", type: "enum", enum: ["user", "assistant", "system", "tool"], isNullable: false },
                    { name: "content", type: "text", isNullable: false },
                    { name: "metadata", type: "jsonb", isNullable: true },
                    { name: "created_at", type: "timestamp", default: "CURRENT_TIMESTAMP" },
                ],
            }),
            true
        );

        await queryRunner.createIndex(
            "dra_paid_media_plan_messages",
            new TableIndex({ name: "idx_paid_media_plan_messages_plan_created", columnNames: ["plan_id", "created_at"] })
        );
        await queryRunner.createIndex(
            "dra_paid_media_plan_messages",
            new TableIndex({ name: "idx_paid_media_plan_messages_step", columnNames: ["step_id"] })
        );

        await queryRunner.createForeignKey(
            "dra_paid_media_plan_messages",
            new TableForeignKey({ name: "fk_paid_media_plan_messages_plan", columnNames: ["plan_id"], referencedTableName: "dra_paid_media_plans", referencedColumnNames: ["id"], onDelete: "CASCADE" })
        );
        await queryRunner.createForeignKey(
            "dra_paid_media_plan_messages",
            new TableForeignKey({ name: "fk_paid_media_plan_messages_step", columnNames: ["step_id"], referencedTableName: "dra_paid_media_plan_steps", referencedColumnNames: ["id"], onDelete: "SET NULL" })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropIndex("dra_paid_media_plan_messages", "idx_paid_media_plan_messages_step");
        await queryRunner.dropIndex("dra_paid_media_plan_messages", "idx_paid_media_plan_messages_plan_created");
        await queryRunner.dropForeignKey("dra_paid_media_plan_messages", "fk_paid_media_plan_messages_step");
        await queryRunner.dropForeignKey("dra_paid_media_plan_messages", "fk_paid_media_plan_messages_plan");
        await queryRunner.dropTable("dra_paid_media_plan_messages");
    }
}
