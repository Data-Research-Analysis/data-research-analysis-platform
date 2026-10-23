import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from "typeorm";

export class CreatePlanOutcomes1792073607000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: "dra_plan_outcomes",
                columns: [
                    { name: "id", type: "int", isPrimary: true, isGenerated: true, generationStrategy: "increment" },
                    { name: "plan_id", type: "int", isNullable: false },
                    { name: "campaign_id", type: "int", isNullable: true },
                    { name: "channel_type", type: "varchar", length: "64", isNullable: true },
                    { name: "market", type: "varchar", length: "64", isNullable: true },
                    { name: "period_start", type: "date", isNullable: true },
                    { name: "period_end", type: "date", isNullable: true },
                    { name: "spend", type: "numeric", precision: 14, scale: 2, default: 0, isNullable: false },
                    { name: "impressions", type: "bigint", default: 0, isNullable: false },
                    { name: "clicks", type: "int", default: 0, isNullable: false },
                    { name: "conversions", type: "int", default: 0, isNullable: false },
                    { name: "revenue", type: "numeric", precision: 14, scale: 2, default: 0, isNullable: false },
                    { name: "source", type: "enum", enum: ["platform_sync", "manual", "offline"], default: "'platform_sync'", isNullable: false },
                    { name: "raw", type: "jsonb", isNullable: true },
                    { name: "created_at", type: "timestamp", default: "CURRENT_TIMESTAMP" },
                ],
            }),
            true
        );

        await queryRunner.createIndex(
            "dra_plan_outcomes",
            new TableIndex({ name: "idx_plan_outcomes_plan_id", columnNames: ["plan_id"] })
        );

        await queryRunner.createForeignKey(
            "dra_plan_outcomes",
            new TableForeignKey({ name: "fk_plan_outcomes_plan", columnNames: ["plan_id"], referencedTableName: "dra_paid_media_plans", referencedColumnNames: ["id"], onDelete: "CASCADE" })
        );
        await queryRunner.createForeignKey(
            "dra_plan_outcomes",
            new TableForeignKey({ name: "fk_plan_outcomes_campaign", columnNames: ["campaign_id"], referencedTableName: "dra_campaigns", referencedColumnNames: ["id"], onDelete: "SET NULL" })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropIndex("dra_plan_outcomes", "idx_plan_outcomes_plan_id");
        await queryRunner.dropForeignKey("dra_plan_outcomes", "fk_plan_outcomes_campaign");
        await queryRunner.dropForeignKey("dra_plan_outcomes", "fk_plan_outcomes_plan");
        await queryRunner.dropTable("dra_plan_outcomes");
    }
}
