import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey, TableIndex } from "typeorm";

export class AddPlanIdToCampaigns1792073608000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(
            "dra_campaigns",
            new TableColumn({ name: "plan_id", type: "int", isNullable: true })
        );

        await queryRunner.createIndex(
            "dra_campaigns",
            new TableIndex({ name: "idx_campaigns_plan_id", columnNames: ["plan_id"] })
        );

        await queryRunner.createForeignKey(
            "dra_campaigns",
            new TableForeignKey({ name: "fk_campaigns_plan", columnNames: ["plan_id"], referencedTableName: "dra_paid_media_plans", referencedColumnNames: ["id"], onDelete: "SET NULL" })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropForeignKey("dra_campaigns", "fk_campaigns_plan");
        await queryRunner.dropIndex("dra_campaigns", "idx_campaigns_plan_id");
        await queryRunner.dropColumn("dra_campaigns", "plan_id");
    }
}
