import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from "typeorm";

export class CreateAIInsightTables1739836800000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create dra_ai_insight_reports table
        await queryRunner.createTable(
            new Table({
                name: "dra_ai_insight_reports",
                columns: [
                    {
                        name: "id",
                        type: "int",
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: "increment",
                    },
                    {
                        name: "title",
                        type: "varchar",
                        length: "255",
                        isNullable: false,
                    },
                    {
                        name: "project_id",
                        type: "int",
                        isNullable: false,
                    },
                    {
                        name: "user_id",
                        type: "int",
                        isNullable: false,
                    },
                    {
                        name: "data_source_ids",
                        type: "jsonb",
                        isNullable: false,
                    },
                    {
                        name: "insights_summary",
                        type: "jsonb",
                        isNullable: true,
                    },
                    {
                        name: "status",
                        type: "enum",
                        enum: ["draft", "saved", "archived"],
                        default: "'draft'",
                    },
                    {
                        name: "started_at",
                        type: "timestamp",
                        default: "CURRENT_TIMESTAMP",
                    },
                    {
                        name: "saved_at",
                        type: "timestamp",
                        isNullable: true,
                    },
                    {
                        name: "created_at",
                        type: "timestamp",
                        default: "CURRENT_TIMESTAMP",
                    },
                    {
                        name: "updated_at",
                        type: "timestamp",
                        default: "CURRENT_TIMESTAMP",
                        onUpdate: "CURRENT_TIMESTAMP",
                    },
                ],
            }),
            true
        );

        // Create dra_ai_insight_messages table
        await queryRunner.createTable(
            new Table({
                name: "dra_ai_insight_messages",
                columns: [
                    {
                        name: "id",
                        type: "int",
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: "increment",
                    },
                    {
                        name: "report_id",
                        type: "int",
                        isNullable: false,
                    },
                    {
                        name: "role",
                        type: "enum",
                        enum: ["user", "assistant", "system"],
                        isNullable: false,
                    },
                    {
                        name: "content",
                        type: "text",
                        isNullable: false,
                    },
                    {
                        name: "metadata",
                        type: "jsonb",
                        isNullable: true,
                    },
                    {
                        name: "created_at",
                        type: "timestamp",
                        default: "CURRENT_TIMESTAMP",
                    },
                ],
            }),
            true
        );

        // Add foreign key: dra_ai_insight_reports -> dra_projects
        await queryRunner.createForeignKey(
            "dra_ai_insight_reports",
            new TableForeignKey({
                name: "fk_ai_insight_reports_project",
                columnNames: ["project_id"],
                referencedTableName: "dra_projects",
                referencedColumnNames: ["id"],
                onDelete: "CASCADE",
            })
        );

        // Add foreign key: dra_ai_insight_reports -> dra_users_platform
        await queryRunner.createForeignKey(
            "dra_ai_insight_reports",
            new TableForeignKey({
                name: "fk_ai_insight_reports_user",
                columnNames: ["user_id"],
                referencedTableName: "dra_users_platform",
                referencedColumnNames: ["id"],
                onDelete: "CASCADE",
            })
        );

        // Add foreign key: dra_ai_insight_messages -> dra_ai_insight_reports
        await queryRunner.createForeignKey(
            "dra_ai_insight_messages",
            new TableForeignKey({
                name: "fk_ai_insight_messages_report",
                columnNames: ["report_id"],
                referencedTableName: "dra_ai_insight_reports",
                referencedColumnNames: ["id"],
                onDelete: "CASCADE",
            })
        );

        // Add indexes for better query performance
        await queryRunner.createIndex(
            "dra_ai_insight_reports",
            new TableIndex({
                name: "idx_ai_insight_reports_project_id",
                columnNames: ["project_id"],
            })
        );

        await queryRunner.createIndex(
            "dra_ai_insight_reports",
            new TableIndex({
                name: "idx_ai_insight_reports_user_id",
                columnNames: ["user_id"],
            })
        );

        await queryRunner.createIndex(
            "dra_ai_insight_reports",
            new TableIndex({
                name: "idx_ai_insight_reports_status",
                columnNames: ["status"],
            })
        );

        await queryRunner.createIndex(
            "dra_ai_insight_messages",
            new TableIndex({
                name: "idx_ai_insight_messages_report_id",
                columnNames: ["report_id"],
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes
        await queryRunner.dropIndex("dra_ai_insight_messages", "idx_ai_insight_messages_report_id");
        await queryRunner.dropIndex("dra_ai_insight_reports", "idx_ai_insight_reports_status");
        await queryRunner.dropIndex("dra_ai_insight_reports", "idx_ai_insight_reports_user_id");
        await queryRunner.dropIndex("dra_ai_insight_reports", "idx_ai_insight_reports_project_id");

        // Drop foreign keys
        await queryRunner.dropForeignKey("dra_ai_insight_messages", "fk_ai_insight_messages_report");
        await queryRunner.dropForeignKey("dra_ai_insight_reports", "fk_ai_insight_reports_user");
        await queryRunner.dropForeignKey("dra_ai_insight_reports", "fk_ai_insight_reports_project");

        // Drop tables
        await queryRunner.dropTable("dra_ai_insight_messages");
        await queryRunner.dropTable("dra_ai_insight_reports");
    }
}
