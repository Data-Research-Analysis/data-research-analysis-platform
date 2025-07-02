import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateArticleTables1751394007721 implements MigrationInterface {
    name = 'CreateArticleTables1751394007721'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "dra_categories" ("id" SERIAL NOT NULL, "title" character varying(512) NOT NULL, "users_platform_id" integer, CONSTRAINT "PK_cc1c1a6841ca963bc9d4ab97e27" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "dra_articles_categories" ("article_id" integer NOT NULL, "category_id" integer NOT NULL, "users_platform_id" integer, CONSTRAINT "PK_e913be29af1e9fb4b3ac1a19cbf" PRIMARY KEY ("article_id", "category_id"))`);
        await queryRunner.query(`CREATE TYPE "public"."dra_articles_publish_status_enum" AS ENUM('published', 'draft')`);
        await queryRunner.query(`CREATE TABLE "dra_articles" ("id" SERIAL NOT NULL, "title" character varying(512) NOT NULL, "content" text NOT NULL, "publish_status" "public"."dra_articles_publish_status_enum" NOT NULL, "users_platform_id" integer, CONSTRAINT "PK_09bda66152e7723be23585cb487" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "dra_categories" ADD CONSTRAINT "FK_101d871cd94144a0651f6f2edea" FOREIGN KEY ("users_platform_id") REFERENCES "dra_users_platform"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dra_articles_categories" ADD CONSTRAINT "FK_ec19f5ad9d9e2b8f8a8d71b6be9" FOREIGN KEY ("article_id") REFERENCES "dra_articles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dra_articles_categories" ADD CONSTRAINT "FK_1e85f54357c61d930c8c47100d1" FOREIGN KEY ("category_id") REFERENCES "dra_categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dra_articles_categories" ADD CONSTRAINT "FK_4cfb9971fb7b97ba0d1be8fb507" FOREIGN KEY ("users_platform_id") REFERENCES "dra_users_platform"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dra_articles" ADD CONSTRAINT "FK_84f86c59bbc65d69ebaf10badc5" FOREIGN KEY ("users_platform_id") REFERENCES "dra_users_platform"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dra_articles" DROP CONSTRAINT "FK_84f86c59bbc65d69ebaf10badc5"`);
        await queryRunner.query(`ALTER TABLE "dra_articles_categories" DROP CONSTRAINT "FK_4cfb9971fb7b97ba0d1be8fb507"`);
        await queryRunner.query(`ALTER TABLE "dra_articles_categories" DROP CONSTRAINT "FK_1e85f54357c61d930c8c47100d1"`);
        await queryRunner.query(`ALTER TABLE "dra_articles_categories" DROP CONSTRAINT "FK_ec19f5ad9d9e2b8f8a8d71b6be9"`);
        await queryRunner.query(`ALTER TABLE "dra_categories" DROP CONSTRAINT "FK_101d871cd94144a0651f6f2edea"`);
        await queryRunner.query(`DROP TABLE "dra_articles"`);
        await queryRunner.query(`DROP TYPE "public"."dra_articles_publish_status_enum"`);
        await queryRunner.query(`DROP TABLE "dra_articles_categories"`);
        await queryRunner.query(`DROP TABLE "dra_categories"`);
    }

}
