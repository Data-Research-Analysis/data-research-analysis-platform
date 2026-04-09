import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateDowngradeRequests1775657000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: 'dra_downgrade_requests',
                columns: [
                    { name: 'id', type: 'serial', isPrimary: true },
                    { name: 'user_id', type: 'integer', isNullable: false },
                    { name: 'organization_id', type: 'integer', isNullable: true },
                    { name: 'current_tier', type: 'varchar', length: '50', isNullable: false },
                    { name: 'requested_tier', type: 'varchar', length: '50', isNullable: false },
                    { name: 'reason', type: 'varchar', length: '100', isNullable: false },
                    { name: 'message', type: 'text', isNullable: true },
                    { name: 'status', type: 'varchar', length: '50', default: "'pending'" },
                    { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
                    { name: 'contacted_at', type: 'timestamp', isNullable: true },
                    { name: 'completed_at', type: 'timestamp', isNullable: true },
                    { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
                ],
            }),
            true
        );

        await queryRunner.createIndex(
            'dra_downgrade_requests',
            new TableIndex({ name: 'idx_downgrade_requests_status', columnNames: ['status'] })
        );

        await queryRunner.createIndex(
            'dra_downgrade_requests',
            new TableIndex({ name: 'idx_downgrade_requests_created', columnNames: ['created_at'] })
        );

        await queryRunner.createForeignKey(
            'dra_downgrade_requests',
            new TableForeignKey({
                columnNames: ['user_id'],
                referencedTableName: 'dra_users_platform',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
            })
        );

        await queryRunner.createForeignKey(
            'dra_downgrade_requests',
            new TableForeignKey({
                columnNames: ['organization_id'],
                referencedTableName: 'dra_organizations',
                referencedColumnNames: ['id'],
                onDelete: 'SET NULL',
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('dra_downgrade_requests');
    }
}
