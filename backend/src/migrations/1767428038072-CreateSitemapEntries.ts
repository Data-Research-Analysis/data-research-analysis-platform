import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSitemapEntries1767428038072 implements MigrationInterface {
    name = 'CreateSitemapEntries1767428038072'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create enum type for publish status (if not exists)
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "public"."dra_sitemap_entries_publish_status_enum" AS ENUM('published', 'draft');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);
        
        // Create sitemap entries table (if not exists)
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "dra_sitemap_entries" (
                "id" SERIAL NOT NULL,
                "url" character varying(2048) NOT NULL,
                "publish_status" "public"."dra_sitemap_entries_publish_status_enum" NOT NULL,
                "priority" integer NOT NULL DEFAULT '0',
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                "users_platform_id" integer,
                CONSTRAINT "PK_dra_sitemap_entries" PRIMARY KEY ("id")
            )
        `);
        
        // Add foreign key constraint to users_platform (if not exists)
        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "dra_sitemap_entries" 
                ADD CONSTRAINT "FK_dra_sitemap_entries_users_platform" 
                FOREIGN KEY ("users_platform_id") 
                REFERENCES "dra_users_platform"("id") 
                ON DELETE CASCADE 
                ON UPDATE NO ACTION;
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop foreign key constraint
        await queryRunner.query(`ALTER TABLE "dra_sitemap_entries" DROP CONSTRAINT "FK_dra_sitemap_entries_users_platform"`);
        
        // Drop table
        await queryRunner.query(`DROP TABLE "dra_sitemap_entries"`);
        
        // Drop enum type
        await queryRunner.query(`DROP TYPE "public"."dra_sitemap_entries_publish_status_enum"`);
    }
}
