import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMarkdownToArticle1761163105848 implements MigrationInterface {
    name = 'AddMarkdownToArticle1761163105848'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if column exists before adding it
        const table = await queryRunner.getTable("dra_articles");
        const column = table?.findColumnByName("content_markdown");
        
        if (!column) {
            await queryRunner.query(`ALTER TABLE "dra_articles" ADD "content_markdown" text`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dra_articles" DROP COLUMN "content_markdown"`);
    }

}
