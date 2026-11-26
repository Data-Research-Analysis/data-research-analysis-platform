import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAuthorSlug1800000030000 implements MigrationInterface {
    name = 'AddAuthorSlug1800000030000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "dra_authors"
            ADD COLUMN IF NOT EXISTS "slug" character varying(255)
        `);

        // Backfill a stable, unique slug for any authors that already exist.
        // The id suffix guarantees uniqueness even when names collide.
        await queryRunner.query(`
            UPDATE "dra_authors"
            SET "slug" = COALESCE(
                NULLIF(trim(both '-' from regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g')), ''),
                'author'
            ) || '-' || "id"
            WHERE "slug" IS NULL OR "slug" = ''
        `);

        await queryRunner.query(`
            ALTER TABLE "dra_authors"
            ALTER COLUMN "slug" SET NOT NULL
        `);

        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "UQ_dra_authors_slug"
            ON "dra_authors" ("slug")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "UQ_dra_authors_slug"`);
        await queryRunner.query(`ALTER TABLE "dra_authors" DROP COLUMN IF EXISTS "slug"`);
    }
}
