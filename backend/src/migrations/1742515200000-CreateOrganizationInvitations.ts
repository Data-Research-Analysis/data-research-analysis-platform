import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateOrganizationInvitations1742515200000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: 'dra_organization_invitations',
                columns: [
                    {
                        name: 'id',
                        type: 'serial',
                        isPrimary: true
                    },
                    {
                        name: 'organization_id',
                        type: 'int',
                        isNullable: false
                    },
                    {
                        name: 'invited_email',
                        type: 'varchar',
                        length: '320',
                        isNullable: false
                    },
                    {
                        name: 'role',
                        type: 'varchar',
                        length: '20',
                        isNullable: false
                    },
                    {
                        name: 'invited_by_user_id',
                        type: 'int',
                        isNullable: false
                    },
                    {
                        name: 'invitation_token',
                        type: 'varchar',
                        length: '128',
                        isNullable: false,
                        isUnique: true
                    },
                    {
                        name: 'status',
                        type: 'varchar',
                        length: '20',
                        default: "'pending'"
                    },
                    {
                        name: 'created_at',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP'
                    },
                    {
                        name: 'expires_at',
                        type: 'timestamp',
                        isNullable: false
                    },
                    {
                        name: 'accepted_at',
                        type: 'timestamp',
                        isNullable: true
                    }
                ]
            }),
            true
        );

        // Foreign keys
        await queryRunner.createForeignKey(
            'dra_organization_invitations',
            new TableForeignKey({
                columnNames: ['organization_id'],
                referencedTableName: 'dra_organizations',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE'
            })
        );

        await queryRunner.createForeignKey(
            'dra_organization_invitations',
            new TableForeignKey({
                columnNames: ['invited_by_user_id'],
                referencedTableName: 'dra_users_platform',
                referencedColumnNames: ['id']
            })
        );

        // Indexes
        await queryRunner.createIndex(
            'dra_organization_invitations',
            new TableIndex({
                name: 'idx_org_invitations_organization',
                columnNames: ['organization_id']
            })
        );

        await queryRunner.createIndex(
            'dra_organization_invitations',
            new TableIndex({
                name: 'idx_org_invitations_email',
                columnNames: ['invited_email']
            })
        );

        await queryRunner.createIndex(
            'dra_organization_invitations',
            new TableIndex({
                name: 'idx_org_invitations_token',
                columnNames: ['invitation_token']
            })
        );

        await queryRunner.createIndex(
            'dra_organization_invitations',
            new TableIndex({
                name: 'idx_org_invitations_status',
                columnNames: ['status']
            })
        );

        // Add CHECK constraint for role
        await queryRunner.query(`
            ALTER TABLE dra_organization_invitations
            ADD CONSTRAINT chk_org_invitation_role
            CHECK (role IN ('owner', 'admin', 'member'))
        `);

        // Add CHECK constraint for status
        await queryRunner.query(`
            ALTER TABLE dra_organization_invitations
            ADD CONSTRAINT chk_org_invitation_status
            CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled'))
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('dra_organization_invitations');
    }
}
