import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAuthors1800000020000 implements MigrationInterface {
    name = 'CreateAuthors1800000020000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "dra_authors" (
                "id" SERIAL NOT NULL,
                "name" character varying(255) NOT NULL,
                "picture" character varying(1000),
                "linkedin_url" character varying(500),
                "website_url" character varying(500),
                "bio" character varying(512),
                "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT "PK_dra_authors" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            ALTER TABLE "dra_articles"
            ADD COLUMN IF NOT EXISTS "author_id" integer
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "dra_articles"
                ADD CONSTRAINT "FK_dra_articles_author"
                FOREIGN KEY ("author_id")
                REFERENCES "dra_authors"("id")
                ON DELETE SET NULL
                ON UPDATE NO ACTION;
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_dra_articles_author_id"
            ON "dra_articles" ("author_id")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_dra_articles_author_id"`);
        await queryRunner.query(`ALTER TABLE "dra_articles" DROP CONSTRAINT IF EXISTS "FK_dra_articles_author"`);
        await queryRunner.query(`ALTER TABLE "dra_articles" DROP COLUMN IF EXISTS "author_id"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "dra_authors"`);
    }
}
