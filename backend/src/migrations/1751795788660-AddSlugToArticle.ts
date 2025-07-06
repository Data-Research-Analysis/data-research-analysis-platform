import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSlugToArticle1751795788660 implements MigrationInterface {
    name = 'AddSlugToArticle1751795788660'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dra_articles" ADD "slug" character varying(255) NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dra_articles" DROP COLUMN "slug"`);
    }

}
