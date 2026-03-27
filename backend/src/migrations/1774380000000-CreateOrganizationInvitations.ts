import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateOrganizationInvitations1774380000000 implements MigrationInterface {
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

        // Check if table was just created (if it existed, we skip adding constraints)
        const table = await queryRunner.getTable('dra_organization_invitations');
        if (!table) {
            throw new Error('Table dra_organization_invitations should exist at this point');
        }

        // Foreign keys - check if they already exist before creating
        const existingForeignKeys = table.foreignKeys;
        
        const fkOrganization = existingForeignKeys.find(
            fk => fk.columnNames.includes('organization_id') && fk.referencedTableName === 'dra_organizations'
        );
        if (!fkOrganization) {
            await queryRunner.createForeignKey(
                'dra_organization_invitations',
                new TableForeignKey({
                    columnNames: ['organization_id'],
                    referencedTableName: 'dra_organizations',
                    referencedColumnNames: ['id'],
                    onDelete: 'CASCADE'
                })
            );
        }

        const fkInvitedBy = existingForeignKeys.find(
            fk => fk.columnNames.includes('invited_by_user_id') && fk.referencedTableName === 'dra_users_platform'
        );
        if (!fkInvitedBy) {
            await queryRunner.createForeignKey(
                'dra_organization_invitations',
                new TableForeignKey({
                    columnNames: ['invited_by_user_id'],
                    referencedTableName: 'dra_users_platform',
                    referencedColumnNames: ['id']
                })
            );
        }

        // Indexes - check if they already exist before creating
        const existingIndices = table.indices;
        
        if (!existingIndices.find(idx => idx.name === 'idx_org_invitations_organization')) {
            await queryRunner.createIndex(
                'dra_organization_invitations',
                new TableIndex({
                    name: 'idx_org_invitations_organization',
                    columnNames: ['organization_id']
                })
            );
        }

        if (!existingIndices.find(idx => idx.name === 'idx_org_invitations_email')) {
            await queryRunner.createIndex(
                'dra_organization_invitations',
                new TableIndex({
                    name: 'idx_org_invitations_email',
                    columnNames: ['invited_email']
                })
            );
        }

        if (!existingIndices.find(idx => idx.name === 'idx_org_invitations_token')) {
            await queryRunner.createIndex(
                'dra_organization_invitations',
                new TableIndex({
                    name: 'idx_org_invitations_token',
                    columnNames: ['invitation_token']
                })
            );
        }

        if (!existingIndices.find(idx => idx.name === 'idx_org_invitations_status')) {
            await queryRunner.createIndex(
                'dra_organization_invitations',
                new TableIndex({
                    name: 'idx_org_invitations_status',
                    columnNames: ['status']
                })
            );
        }

        // Check constraints - use DO block to check existence
        await queryRunner.query(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint 
                    WHERE conname = 'chk_org_invitation_role' 
                    AND conrelid = 'dra_organization_invitations'::regclass
                ) THEN
                    ALTER TABLE dra_organization_invitations
                    ADD CONSTRAINT chk_org_invitation_role
                    CHECK (role IN ('owner', 'admin', 'member'));
                END IF;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint 
                    WHERE conname = 'chk_org_invitation_status' 
                    AND conrelid = 'dra_organization_invitations'::regclass
                ) THEN
                    ALTER TABLE dra_organization_invitations
                    ADD CONSTRAINT chk_org_invitation_status
                    CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled'));
                END IF;
            END $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('dra_organization_invitations');
    }
}
