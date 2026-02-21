import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateArticleVersionsAndFixCascade1771400000000 implements MigrationInterface {
    name = 'CreateArticleVersionsAndFixCascade1771400000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Fix cascade delete on dra_articles_categories so deleting an article
        //    automatically removes its category mappings at the DB level.
        await queryRunner.query(`ALTER TABLE "dra_articles_categories" DROP CONSTRAINT IF EXISTS "FK_ec19f5ad9d9e2b8f8a8d71b6be9"`);
        await queryRunner.query(`
            ALTER TABLE "dra_articles_categories"
            ADD CONSTRAINT "FK_ec19f5ad9d9e2b8f8a8d71b6be9"
            FOREIGN KEY ("article_id") REFERENCES "dra_articles"("id")
            ON DELETE CASCADE ON UPDATE NO ACTION
        `);

        // 2. Create article versions table
        await queryRunner.query(`
            CREATE TABLE "dra_article_versions" (
                "id"              SERIAL          NOT NULL,
                "version_number"  integer         NOT NULL,
                "title"           character varying(512) NOT NULL,
                "content"         text            NOT NULL,
                "content_markdown" text,
                "change_summary"  character varying(512),
                "article_id"      integer         NOT NULL,
                "users_platform_id" integer,
                "created_at"      TIMESTAMP       NOT NULL DEFAULT now(),
                CONSTRAINT "PK_dra_article_versions" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            ALTER TABLE "dra_article_versions"
            ADD CONSTRAINT "FK_dra_article_versions_article"
            FOREIGN KEY ("article_id") REFERENCES "dra_articles"("id")
            ON DELETE CASCADE ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "dra_article_versions"
            ADD CONSTRAINT "FK_dra_article_versions_user"
            FOREIGN KEY ("users_platform_id") REFERENCES "dra_users_platform"("id")
            ON DELETE SET NULL ON UPDATE NO ACTION
        `);

        // Index for fast per-article lookups
        await queryRunner.query(`
            CREATE INDEX "IDX_dra_article_versions_article_id"
            ON "dra_article_versions" ("article_id", "version_number")
        `);

        // 3. Backfill: create version 1 for every existing article that has no version yet.
        //    Uses the article's own created_at so the version timestamp is historically correct.
        await queryRunner.query(`
            INSERT INTO "dra_article_versions"
                ("version_number", "title", "content", "content_markdown",
                 "change_summary", "article_id", "users_platform_id", "created_at")
            SELECT
                1,
                a.title,
                a.content,
                a.content_markdown,
                'Initial version (backfilled)',
                a.id,
                a.users_platform_id,
                a.created_at
            FROM "dra_articles" a
            WHERE NOT EXISTS (
                SELECT 1
                FROM "dra_article_versions" av
                WHERE av.article_id = a.id
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_dra_article_versions_article_id"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "dra_article_versions"`);

        // Revert articles_categories FK back to NO ACTION
        await queryRunner.query(`ALTER TABLE "dra_articles_categories" DROP CONSTRAINT IF EXISTS "FK_ec19f5ad9d9e2b8f8a8d71b6be9"`);
        await queryRunner.query(`
            ALTER TABLE "dra_articles_categories"
            ADD CONSTRAINT "FK_ec19f5ad9d9e2b8f8a8d71b6be9"
            FOREIGN KEY ("article_id") REFERENCES "dra_articles"("id")
            ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    }
}
