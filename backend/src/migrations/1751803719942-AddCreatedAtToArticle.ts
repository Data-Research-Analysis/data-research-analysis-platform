import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCreatedAtToArticle1751803719942 implements MigrationInterface {
    name = 'AddCreatedAtToArticle1751803719942'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dra_articles" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dra_articles" DROP COLUMN "created_at"`);
    }

}
