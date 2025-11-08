import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOnDeleteCascade1762541695865 implements MigrationInterface {
    name = 'AddOnDeleteCascade1762541695865'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dra_data_sources" DROP CONSTRAINT "FK_4659b4e1af9a86f2ead8f35f1a6"`);
        await queryRunner.query(`ALTER TABLE "dra_dashboards_exported_metadata" DROP CONSTRAINT "FK_992228d9e46c67b987062f3efc7"`);
        await queryRunner.query(`ALTER TABLE "dra_dashboards_exported_metadata" DROP CONSTRAINT "FK_c3a2cacd43bf40076251ae112f5"`);
        await queryRunner.query(`ALTER TABLE "dra_dashboards" DROP CONSTRAINT "FK_0c0ff5d5983ae79ca22b4abebd1"`);
        await queryRunner.query(`ALTER TABLE "dra_projects" DROP CONSTRAINT "FK_f5d2958e671c46cfd9a88ec8a39"`);
        await queryRunner.query(`ALTER TABLE "dra_verification_codes" DROP CONSTRAINT "FK_f01cca82b116a9e42890deaf3e4"`);
        await queryRunner.query(`ALTER TABLE "dra_categories" DROP CONSTRAINT "FK_101d871cd94144a0651f6f2edea"`);
        await queryRunner.query(`ALTER TABLE "dra_articles" DROP CONSTRAINT "FK_84f86c59bbc65d69ebaf10badc5"`);
        await queryRunner.query(`ALTER TABLE "dra_data_models" DROP CONSTRAINT "FK_81a3e0e9177a3b3ef77edccc322"`);
        await queryRunner.query(`ALTER TABLE "dra_private_beta_users" ALTER COLUMN "created_at" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "dra_private_beta_users" ALTER COLUMN "created_at" SET DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "dra_data_sources" ADD CONSTRAINT "FK_4659b4e1af9a86f2ead8f35f1a6" FOREIGN KEY ("project_id") REFERENCES "dra_projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dra_dashboards_exported_metadata" ADD CONSTRAINT "FK_992228d9e46c67b987062f3efc7" FOREIGN KEY ("users_platform_id") REFERENCES "dra_users_platform"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dra_dashboards_exported_metadata" ADD CONSTRAINT "FK_c3a2cacd43bf40076251ae112f5" FOREIGN KEY ("dashboard_id") REFERENCES "dra_dashboards"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dra_dashboards" ADD CONSTRAINT "FK_0c0ff5d5983ae79ca22b4abebd1" FOREIGN KEY ("project_id") REFERENCES "dra_projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dra_projects" ADD CONSTRAINT "FK_f5d2958e671c46cfd9a88ec8a39" FOREIGN KEY ("users_platform_id") REFERENCES "dra_users_platform"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dra_verification_codes" ADD CONSTRAINT "FK_f01cca82b116a9e42890deaf3e4" FOREIGN KEY ("users_platform_id") REFERENCES "dra_users_platform"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dra_categories" ADD CONSTRAINT "FK_101d871cd94144a0651f6f2edea" FOREIGN KEY ("users_platform_id") REFERENCES "dra_users_platform"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dra_articles" ADD CONSTRAINT "FK_84f86c59bbc65d69ebaf10badc5" FOREIGN KEY ("users_platform_id") REFERENCES "dra_users_platform"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dra_data_models" ADD CONSTRAINT "FK_81a3e0e9177a3b3ef77edccc322" FOREIGN KEY ("data_source_id") REFERENCES "dra_data_sources"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dra_data_models" DROP CONSTRAINT "FK_81a3e0e9177a3b3ef77edccc322"`);
        await queryRunner.query(`ALTER TABLE "dra_articles" DROP CONSTRAINT "FK_84f86c59bbc65d69ebaf10badc5"`);
        await queryRunner.query(`ALTER TABLE "dra_categories" DROP CONSTRAINT "FK_101d871cd94144a0651f6f2edea"`);
        await queryRunner.query(`ALTER TABLE "dra_verification_codes" DROP CONSTRAINT "FK_f01cca82b116a9e42890deaf3e4"`);
        await queryRunner.query(`ALTER TABLE "dra_projects" DROP CONSTRAINT "FK_f5d2958e671c46cfd9a88ec8a39"`);
        await queryRunner.query(`ALTER TABLE "dra_dashboards" DROP CONSTRAINT "FK_0c0ff5d5983ae79ca22b4abebd1"`);
        await queryRunner.query(`ALTER TABLE "dra_dashboards_exported_metadata" DROP CONSTRAINT "FK_c3a2cacd43bf40076251ae112f5"`);
        await queryRunner.query(`ALTER TABLE "dra_dashboards_exported_metadata" DROP CONSTRAINT "FK_992228d9e46c67b987062f3efc7"`);
        await queryRunner.query(`ALTER TABLE "dra_data_sources" DROP CONSTRAINT "FK_4659b4e1af9a86f2ead8f35f1a6"`);
        await queryRunner.query(`ALTER TABLE "dra_private_beta_users" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "dra_private_beta_users" ALTER COLUMN "created_at" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "dra_data_models" ADD CONSTRAINT "FK_81a3e0e9177a3b3ef77edccc322" FOREIGN KEY ("data_source_id") REFERENCES "dra_data_sources"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dra_articles" ADD CONSTRAINT "FK_84f86c59bbc65d69ebaf10badc5" FOREIGN KEY ("users_platform_id") REFERENCES "dra_users_platform"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dra_categories" ADD CONSTRAINT "FK_101d871cd94144a0651f6f2edea" FOREIGN KEY ("users_platform_id") REFERENCES "dra_users_platform"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dra_verification_codes" ADD CONSTRAINT "FK_f01cca82b116a9e42890deaf3e4" FOREIGN KEY ("users_platform_id") REFERENCES "dra_users_platform"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dra_projects" ADD CONSTRAINT "FK_f5d2958e671c46cfd9a88ec8a39" FOREIGN KEY ("users_platform_id") REFERENCES "dra_users_platform"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dra_dashboards" ADD CONSTRAINT "FK_0c0ff5d5983ae79ca22b4abebd1" FOREIGN KEY ("project_id") REFERENCES "dra_projects"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dra_dashboards_exported_metadata" ADD CONSTRAINT "FK_c3a2cacd43bf40076251ae112f5" FOREIGN KEY ("dashboard_id") REFERENCES "dra_dashboards"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dra_dashboards_exported_metadata" ADD CONSTRAINT "FK_992228d9e46c67b987062f3efc7" FOREIGN KEY ("users_platform_id") REFERENCES "dra_users_platform"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dra_data_sources" ADD CONSTRAINT "FK_4659b4e1af9a86f2ead8f35f1a6" FOREIGN KEY ("project_id") REFERENCES "dra_projects"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
