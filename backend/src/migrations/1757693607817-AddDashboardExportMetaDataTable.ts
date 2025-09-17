import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDashboardExportMetaDataTable1757693607817 implements MigrationInterface {
    name = 'AddDashboardExportMetaDataTable1757693607817'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "dra_dashboards_exported_metadata" ("id" SERIAL NOT NULL, "key" character varying(1024) NOT NULL, "created_at" TIMESTAMP NOT NULL, "expiry_at" TIMESTAMP NOT NULL, "users_platform_id" integer, "dashboard_id" integer, CONSTRAINT "PK_acfbd394c943fbde564f3d31c62" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "dra_dashboards_exported_metadata" ADD CONSTRAINT "FK_992228d9e46c67b987062f3efc7" FOREIGN KEY ("users_platform_id") REFERENCES "dra_users_platform"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dra_dashboards_exported_metadata" ADD CONSTRAINT "FK_c3a2cacd43bf40076251ae112f5" FOREIGN KEY ("dashboard_id") REFERENCES "dra_dashboards"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dra_dashboards_exported_metadata" DROP CONSTRAINT "FK_c3a2cacd43bf40076251ae112f5"`);
        await queryRunner.query(`ALTER TABLE "dra_dashboards_exported_metadata" DROP CONSTRAINT "FK_992228d9e46c67b987062f3efc7"`);
        await queryRunner.query(`DROP TABLE "dra_dashboards_exported_metadata"`);
    }

}
