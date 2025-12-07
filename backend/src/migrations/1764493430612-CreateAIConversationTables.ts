import { MigrationInterface, QueryRunner, Table, TableForeignKey } from "typeorm";

export class CreateAIConversationTables1764493430612 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create ai_data_model_conversations table
        await queryRunner.createTable(
            new Table({
                name: "dra_ai_data_model_conversations",
                columns: [
                    {
                        name: "id",
                        type: "int",
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: "increment",
                    },
                    {
                        name: "data_source_id",
                        type: "int",
                        isNullable: false,
                    },
                    {
                        name: "user_id",
                        type: "int",
                        isNullable: false,
                    },
                    {
                        name: "data_model_id",
                        type: "int",
                        isNullable: true,
                    },
                    {
                        name: "title",
                        type: "varchar",
                        length: "255",
                        isNullable: false,
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

        // Create ai_data_model_messages table
        await queryRunner.createTable(
            new Table({
                name: "dra_ai_data_model_messages",
                columns: [
                    {
                        name: "id",
                        type: "int",
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: "increment",
                    },
                    {
                        name: "conversation_id",
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
                        type: "json",
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

        // Add foreign keys
        await queryRunner.createForeignKey(
            "dra_ai_data_model_conversations",
            new TableForeignKey({
                columnNames: ["data_source_id"],
                referencedColumnNames: ["id"],
                referencedTableName: "dra_data_sources",
                onDelete: "CASCADE",
            })
        );

        await queryRunner.createForeignKey(
            "dra_ai_data_model_conversations",
            new TableForeignKey({
                columnNames: ["user_id"],
                referencedColumnNames: ["id"],
                referencedTableName: "dra_users_platform",
                onDelete: "CASCADE",
            })
        );

        await queryRunner.createForeignKey(
            "dra_ai_data_model_conversations",
            new TableForeignKey({
                columnNames: ["data_model_id"],
                referencedColumnNames: ["id"],
                referencedTableName: "dra_data_models",
                onDelete: "SET NULL",
            })
        );

        await queryRunner.createForeignKey(
            "dra_ai_data_model_messages",
            new TableForeignKey({
                columnNames: ["conversation_id"],
                referencedColumnNames: ["id"],
                referencedTableName: "dra_ai_data_model_conversations",
                onDelete: "CASCADE",
            })
        );

        // Create indexes for better query performance
        await queryRunner.query(
            `CREATE INDEX "IDX_ai_conversations_data_source_user" ON "dra_ai_data_model_conversations" ("data_source_id", "user_id", "status")`
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_ai_conversations_saved_at" ON "dra_ai_data_model_conversations" ("saved_at")`
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_ai_messages_conversation" ON "dra_ai_data_model_messages" ("conversation_id", "created_at")`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes
        await queryRunner.query(`DROP INDEX "IDX_ai_messages_conversation"`);
        await queryRunner.query(`DROP INDEX "IDX_ai_conversations_saved_at"`);
        await queryRunner.query(`DROP INDEX "IDX_ai_conversations_data_source_user"`);

        // Drop foreign keys
        const messagesTable = await queryRunner.getTable("dra_ai_data_model_messages");
        const conversationsForeignKey = messagesTable?.foreignKeys.find(
            (fk) => fk.columnNames.indexOf("conversation_id") !== -1
        );
        if (conversationsForeignKey) {
            await queryRunner.dropForeignKey("dra_ai_data_model_messages", conversationsForeignKey);
        }

        const conversationsTable = await queryRunner.getTable("dra_ai_data_model_conversations");
        const foreignKeys = conversationsTable?.foreignKeys || [];
        
        for (const fk of foreignKeys) {
            await queryRunner.dropForeignKey("dra_ai_data_model_conversations", fk);
        }

        // Drop tables
        await queryRunner.dropTable("dra_ai_data_model_messages");
        await queryRunner.dropTable("dra_ai_data_model_conversations");
    }

}
