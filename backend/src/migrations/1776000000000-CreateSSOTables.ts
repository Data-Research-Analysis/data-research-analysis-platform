import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateSSOTables1776000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const hasSsoConfigurations = await queryRunner.hasTable('dra_sso_configurations');
        if (!hasSsoConfigurations) {
            await queryRunner.createTable(
                new Table({
                    name: 'dra_sso_configurations',
                    columns: [
                        { name: 'id', type: 'serial', isPrimary: true },
                        { name: 'organization_id', type: 'int', isNullable: false, isUnique: true },
                        { name: 'idp_name', type: 'varchar', length: '50', isNullable: false },
                        { name: 'idp_entity_id', type: 'text', isNullable: false },
                        { name: 'idp_sso_url', type: 'text', isNullable: false },
                        { name: 'idp_certificate', type: 'text', isNullable: false },
                        { name: 'sp_entity_id', type: 'text', isNullable: false },
                        { name: 'attribute_mapping', type: 'jsonb', isNullable: true },
                        { name: 'is_enabled', type: 'boolean', default: 'false' },
                        { name: 'allow_jit_provisioning', type: 'boolean', default: 'true' },
                        { name: 'enforce_sso', type: 'boolean', default: 'false' },
                        { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
                        { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' }
                    ]
                }),
                true
            );

            await queryRunner.createForeignKey(
                'dra_sso_configurations',
                new TableForeignKey({
                    columnNames: ['organization_id'],
                    referencedTableName: 'dra_organizations',
                    referencedColumnNames: ['id'],
                    onDelete: 'CASCADE'
                })
            );

            await queryRunner.createIndex(
                'dra_sso_configurations',
                new TableIndex({
                    name: 'idx_sso_configurations_org_id',
                    columnNames: ['organization_id'],
                    isUnique: true
                })
            );
        }

        const hasSsoUserMappings = await queryRunner.hasTable('dra_sso_user_mappings');
        if (!hasSsoUserMappings) {
            await queryRunner.createTable(
                new Table({
                    name: 'dra_sso_user_mappings',
                    columns: [
                        { name: 'id', type: 'serial', isPrimary: true },
                        { name: 'user_id', type: 'int', isNullable: false },
                        { name: 'organization_id', type: 'int', isNullable: false },
                        { name: 'sso_name_id', type: 'varchar', length: '512', isNullable: false },
                        { name: 'sso_provider', type: 'varchar', length: '100', isNullable: false },
                        { name: 'last_sso_login_at', type: 'timestamp', isNullable: true },
                        { name: 'sso_attributes', type: 'jsonb', isNullable: true },
                        { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' }
                    ],
                    uniques: [
                        {
                            name: 'uq_sso_user_mappings_user_org_nameid',
                            columnNames: ['user_id', 'organization_id', 'sso_name_id']
                        }
                    ]
                }),
                true
            );

            await queryRunner.createForeignKeys('dra_sso_user_mappings', [
                new TableForeignKey({
                    columnNames: ['user_id'],
                    referencedTableName: 'dra_users_platform',
                    referencedColumnNames: ['id'],
                    onDelete: 'CASCADE'
                }),
                new TableForeignKey({
                    columnNames: ['organization_id'],
                    referencedTableName: 'dra_organizations',
                    referencedColumnNames: ['id'],
                    onDelete: 'CASCADE'
                })
            ]);

            await queryRunner.createIndex(
                'dra_sso_user_mappings',
                new TableIndex({
                    name: 'idx_sso_user_mappings_org_id',
                    columnNames: ['organization_id']
                })
            );
        }

        const hasDomainVerifications = await queryRunner.hasTable('dra_domain_verifications');
        if (!hasDomainVerifications) {
            await queryRunner.createTable(
                new Table({
                    name: 'dra_domain_verifications',
                    columns: [
                        { name: 'id', type: 'serial', isPrimary: true },
                        { name: 'organization_id', type: 'int', isNullable: false },
                        { name: 'domain', type: 'varchar', length: '255', isNullable: false },
                        { name: 'verification_token', type: 'varchar', length: '100', isNullable: false },
                        { name: 'status', type: 'varchar', length: '20', default: "'pending'" },
                        { name: 'verified_at', type: 'timestamp', isNullable: true },
                        { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' }
                    ]
                }),
                true
            );

            await queryRunner.createForeignKey(
                'dra_domain_verifications',
                new TableForeignKey({
                    columnNames: ['organization_id'],
                    referencedTableName: 'dra_organizations',
                    referencedColumnNames: ['id'],
                    onDelete: 'CASCADE'
                })
            );

            await queryRunner.createIndex(
                'dra_domain_verifications',
                new TableIndex({
                    name: 'idx_domain_verifications_org_domain',
                    columnNames: ['organization_id', 'domain']
                })
            );
        }

        const hasSsoEnabled = await queryRunner.hasColumn('dra_organizations', 'sso_enabled');
        if (!hasSsoEnabled) {
            await queryRunner.query(`ALTER TABLE dra_organizations ADD COLUMN sso_enabled boolean NOT NULL DEFAULT false`);
        }

        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'chk_domain_verification_status'
                    AND conrelid = 'dra_domain_verifications'::regclass
                ) THEN
                    ALTER TABLE dra_domain_verifications
                    ADD CONSTRAINT chk_domain_verification_status
                    CHECK (status IN ('pending', 'verified', 'failed'));
                END IF;
            END $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const hasSsoEnabled = await queryRunner.hasColumn('dra_organizations', 'sso_enabled');
        if (hasSsoEnabled) {
            await queryRunner.query(`ALTER TABLE dra_organizations DROP COLUMN sso_enabled`);
        }

        const hasDomainVerifications = await queryRunner.hasTable('dra_domain_verifications');
        if (hasDomainVerifications) {
            await queryRunner.dropTable('dra_domain_verifications');
        }

        const hasSsoUserMappings = await queryRunner.hasTable('dra_sso_user_mappings');
        if (hasSsoUserMappings) {
            await queryRunner.dropTable('dra_sso_user_mappings');
        }

        const hasSsoConfigurations = await queryRunner.hasTable('dra_sso_configurations');
        if (hasSsoConfigurations) {
            await queryRunner.dropTable('dra_sso_configurations');
        }
    }
}