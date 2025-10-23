import { MigrationInterface, QueryRunner } from "typeorm";

export class ResizeEmailColumnSize1761163105847 implements MigrationInterface {
    name = 'ResizeEmailColumnSize1761163105847'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dra_private_beta_users" DROP COLUMN "business_email"`);
        await queryRunner.query(`ALTER TABLE "dra_private_beta_users" ADD "business_email" character varying(320) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "dra_private_beta_users" DROP COLUMN "company_name"`);
        await queryRunner.query(`ALTER TABLE "dra_private_beta_users" ADD "company_name" character varying(255) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "dra_users_platform" DROP COLUMN "email"`);
        await queryRunner.query(`ALTER TABLE "dra_users_platform" ADD "email" character varying(320) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "dra_users_platform" DROP COLUMN "first_name"`);
        await queryRunner.query(`ALTER TABLE "dra_users_platform" ADD "first_name" character varying(255) NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dra_users_platform" DROP COLUMN "first_name"`);
        await queryRunner.query(`ALTER TABLE "dra_users_platform" ADD "first_name" character varying(320) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "dra_users_platform" DROP COLUMN "email"`);
        await queryRunner.query(`ALTER TABLE "dra_users_platform" ADD "email" character varying(255) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "dra_private_beta_users" DROP COLUMN "company_name"`);
        await queryRunner.query(`ALTER TABLE "dra_private_beta_users" ADD "company_name" character varying(320) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "dra_private_beta_users" DROP COLUMN "business_email"`);
        await queryRunner.query(`ALTER TABLE "dra_private_beta_users" ADD "business_email" character varying(255) NOT NULL`);
    }

}
