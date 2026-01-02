import { MigrationInterface, QueryRunner, Table, TableForeignKey } from "typeorm";

export class CreateScheduledBackupRunsTable1766696000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if table already exists
        const tableExists = await queryRunner.hasTable("dra_scheduled_backup_runs");
        
        if (tableExists) {
            console.log('Table dra_scheduled_backup_runs already exists, skipping creation');
            return;
        }

        // Create dra_scheduled_backup_runs table
        await queryRunner.createTable(
            new Table({
                name: "dra_scheduled_backup_runs",
                columns: [
                    {
                        name: "id",
                        type: "int",
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: "increment",
                    },
                    {
                        name: "backup_id",
                        type: "varchar",
                        length: "255",
                        isNullable: true,
                    },
                    {
                        name: "trigger_type",
                        type: "enum",
                        enum: ["scheduled", "manual"],
                        default: "'scheduled'",
                    },
                    {
                        name: "status",
                        type: "enum",
                        enum: ["queued", "processing", "completed", "failed"],
                        default: "'queued'",
                    },
                    {
                        name: "started_at",
                        type: "timestamp",
                        default: "CURRENT_TIMESTAMP",
                    },
                    {
                        name: "completed_at",
                        type: "timestamp",
                        isNullable: true,
                    },
                    {
                        name: "error_message",
                        type: "text",
                        isNullable: true,
                    },
                    {
                        name: "backup_size_bytes",
                        type: "bigint",
                        isNullable: true,
                    },
                    {
                        name: "backup_filepath",
                        type: "varchar",
                        length: "512",
                        isNullable: true,
                    },
                    {
                        name: "triggered_by_user_id",
                        type: "int",
                        isNullable: false,
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

        // Create foreign key for triggered_by_user_id
        await queryRunner.createForeignKey(
            "dra_scheduled_backup_runs",
            new TableForeignKey({
                columnNames: ["triggered_by_user_id"],
                referencedTableName: "dra_users_platform",
                referencedColumnNames: ["id"],
                onDelete: "CASCADE",
            })
        );

        // Create index on status for quick filtering
        await queryRunner.query(`
            CREATE INDEX "idx_scheduled_backup_runs_status" 
            ON "dra_scheduled_backup_runs" ("status")
        `);

        // Create index on trigger_type for filtering
        await queryRunner.query(`
            CREATE INDEX "idx_scheduled_backup_runs_trigger_type" 
            ON "dra_scheduled_backup_runs" ("trigger_type")
        `);

        // Create index on started_at for sorting
        await queryRunner.query(`
            CREATE INDEX "idx_scheduled_backup_runs_started_at" 
            ON "dra_scheduled_backup_runs" ("started_at" DESC)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop foreign keys
        const table = await queryRunner.getTable("dra_scheduled_backup_runs");
        if (table) {
            const foreignKey = table.foreignKeys.find(
                fk => fk.columnNames.indexOf("triggered_by_user_id") !== -1
            );
            if (foreignKey) {
                await queryRunner.dropForeignKey("dra_scheduled_backup_runs", foreignKey);
            }
        }

        // Drop indexes
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_scheduled_backup_runs_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_scheduled_backup_runs_trigger_type"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_scheduled_backup_runs_started_at"`);

        // Drop table
        await queryRunner.dropTable("dra_scheduled_backup_runs");
    }
}
