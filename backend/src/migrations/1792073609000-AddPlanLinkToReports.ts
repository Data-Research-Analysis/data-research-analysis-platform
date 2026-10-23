import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey, TableIndex } from "typeorm";

export class AddPlanLinkToReports1792073609000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(
            "dra_reports",
            new TableColumn({ name: "plan_id", type: "int", isNullable: true })
        );
        await queryRunner.addColumn(
            "dra_reports",
            new TableColumn({ name: "artifact_key", type: "varchar", length: "64", isNullable: true })
        );

        await queryRunner.createIndex(
            "dra_reports",
            new TableIndex({ name: "idx_reports_plan_id", columnNames: ["plan_id"] })
        );

        await queryRunner.createForeignKey(
            "dra_reports",
            new TableForeignKey({ name: "fk_reports_plan", columnNames: ["plan_id"], referencedTableName: "dra_paid_media_plans", referencedColumnNames: ["id"], onDelete: "SET NULL" })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropForeignKey("dra_reports", "fk_reports_plan");
        await queryRunner.dropIndex("dra_reports", "idx_reports_plan_id");
        await queryRunner.dropColumn("dra_reports", "artifact_key");
        await queryRunner.dropColumn("dra_reports", "plan_id");
    }
}
