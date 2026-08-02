import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateBlogDigestTables1788000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: 'dra_blog_digest_sends',
                columns: [
                    { name: 'id', type: 'integer', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
                    { name: 'sent_count', type: 'integer', default: 0 },
                    { name: 'sent_at', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
                ],
            }),
        );

        await queryRunner.createTable(
            new Table({
                name: 'dra_blog_digest_articles',
                columns: [
                    { name: 'id', type: 'integer', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
                    { name: 'digest_id', type: 'integer' },
                    { name: 'article_id', type: 'integer' },
                    { name: 'created_at', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
                ],
            }),
        );

        await queryRunner.createForeignKey(
            'dra_blog_digest_articles',
            new TableForeignKey({
                columnNames: ['digest_id'],
                referencedTableName: 'dra_blog_digest_sends',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
            }),
        );

        await queryRunner.createForeignKey(
            'dra_blog_digest_articles',
            new TableForeignKey({
                columnNames: ['article_id'],
                referencedTableName: 'dra_articles',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('dra_blog_digest_articles');
        await queryRunner.dropTable('dra_blog_digest_sends');
    }
}
