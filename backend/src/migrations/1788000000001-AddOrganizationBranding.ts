import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrganizationBranding1788000000001 implements MigrationInterface {
    name = 'AddOrganizationBranding1788000000001';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "dra_organizations"
            ADD COLUMN "primary_color" VARCHAR(7) DEFAULT NULL
        `);

        await queryRunner.query(`
            ALTER TABLE "dra_organizations"
            ADD COLUMN "secondary_color" VARCHAR(7) DEFAULT NULL
        `);

        await queryRunner.query(`
            ALTER TABLE "dra_organizations"
            ADD COLUMN "branding_enabled" BOOLEAN NOT NULL DEFAULT false
        `);

        await queryRunner.query(`
            ALTER TABLE "dra_organizations"
            ADD COLUMN "branding_logo_url" TEXT DEFAULT NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dra_organizations" DROP COLUMN "branding_logo_url"`);
        await queryRunner.query(`ALTER TABLE "dra_organizations" DROP COLUMN "branding_enabled"`);
        await queryRunner.query(`ALTER TABLE "dra_organizations" DROP COLUMN "secondary_color"`);
        await queryRunner.query(`ALTER TABLE "dra_organizations" DROP COLUMN "primary_color"`);
    }
}
