import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateEmailPreferencesTable1768100000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create dra_email_preferences table
        await queryRunner.createTable(
            new Table({
                name: 'dra_email_preferences',
                columns: [
                    {
                        name: 'id',
                        type: 'serial',
                        isPrimary: true,
                    },
                    {
                        name: 'user_id',
                        type: 'integer',
                        isUnique: true,
                        isNullable: false,
                    },
                    {
                        name: 'subscription_updates',
                        type: 'boolean',
                        default: true,
                    },
                    {
                        name: 'expiration_warnings',
                        type: 'boolean',
                        default: true,
                    },
                    {
                        name: 'renewal_reminders',
                        type: 'boolean',
                        default: true,
                    },
                    {
                        name: 'promotional_emails',
                        type: 'boolean',
                        default: false,
                    },
                    {
                        name: 'created_at',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                    },
                    {
                        name: 'updated_at',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                    },
                ],
            }),
            true
        );

        // Add foreign key constraint
        await queryRunner.createForeignKey(
            'dra_email_preferences',
            new TableForeignKey({
                columnNames: ['user_id'],
                referencedColumnNames: ['id'],
                referencedTableName: 'dra_users_platform',
                onDelete: 'CASCADE',
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop foreign key first
        const table = await queryRunner.getTable('dra_email_preferences');
        if (table) {
            const foreignKey = table.foreignKeys.find(
                (fk) => fk.columnNames.indexOf('user_id') !== -1
            );
            if (foreignKey) {
                await queryRunner.dropForeignKey('dra_email_preferences', foreignKey);
            }
        }

        // Drop table
        await queryRunner.dropTable('dra_email_preferences');
    }
}
