import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateReports1773100000000 implements MigrationInterface {
    name = 'CreateReports1773100000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Reports
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "dra_reports" (
                "id"           SERIAL PRIMARY KEY,
                "project_id"   INT NOT NULL REFERENCES "dra_projects"("id") ON DELETE CASCADE,
                "created_by"   INT NOT NULL REFERENCES "dra_users_platform"("id") ON DELETE CASCADE,
                "name"         VARCHAR(255) NOT NULL,
                "description"  TEXT,
                "status"       VARCHAR(20) NOT NULL DEFAULT 'draft'
                                   CHECK (status IN ('draft', 'published')),
                "created_at"   TIMESTAMP NOT NULL DEFAULT NOW(),
                "updated_at"   TIMESTAMP NOT NULL DEFAULT NOW()
            )
        `);

        // Report items (ordered list of selected content)
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "dra_report_items" (
                "id"             SERIAL PRIMARY KEY,
                "report_id"      INT NOT NULL REFERENCES "dra_reports"("id") ON DELETE CASCADE,
                "item_type"      VARCHAR(20) NOT NULL
                                     CHECK (item_type IN ('dashboard', 'widget', 'insight')),
                "ref_id"         INT,
                "widget_id"      VARCHAR(255),
                "display_order"  INT NOT NULL DEFAULT 0,
                "title_override" VARCHAR(255)
            )
        `);

        // Report share keys (mirrors dra_dashboards_exported_metadata)
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "dra_report_share_keys" (
                "id"          SERIAL PRIMARY KEY,
                "report_id"   INT NOT NULL REFERENCES "dra_reports"("id") ON DELETE CASCADE,
                "created_by"  INT NOT NULL REFERENCES "dra_users_platform"("id") ON DELETE CASCADE,
                "key"         VARCHAR(1024) NOT NULL UNIQUE,
                "created_at"  TIMESTAMP NOT NULL DEFAULT NOW(),
                "expiry_at"   TIMESTAMP NOT NULL
            )
        `);

        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_dra_reports_project_id" ON "dra_reports"("project_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_dra_report_items_report_id" ON "dra_report_items"("report_id")`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_dra_report_share_keys_report_id" ON "dra_report_share_keys"("report_id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "dra_report_share_keys"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "dra_report_items"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "dra_reports"`);
    }
}
