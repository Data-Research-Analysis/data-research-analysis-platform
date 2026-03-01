import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Adds marketing_role to dra_project_invitations so the intended marketing role
 * is preserved through the invitation lifecycle and applied to dra_project_members
 * when the invitation is accepted.
 */
export class AddMarketingRoleToInvitations1772700001000 implements MigrationInterface {
    name = 'AddMarketingRoleToInvitations1772700001000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(
            'dra_project_invitations',
            new TableColumn({
                name: 'marketing_role',
                type: 'varchar',
                length: '20',
                isNullable: false,
                default: "'cmo'",
                comment: "Marketing role that will be assigned on acceptance: 'analyst' | 'manager' | 'cmo'",
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('dra_project_invitations', 'marketing_role');
    }
}
