import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddMarketingRoleToProjectMembers1772000000000 implements MigrationInterface {
    name = 'AddMarketingRoleToProjectMembers1772000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(
            'dra_project_members',
            new TableColumn({
                name: 'marketing_role',
                type: 'varchar',
                length: '20',
                isNullable: true,
                comment: "Optional marketing persona: 'cmo' | 'manager' | 'analyst'",
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('dra_project_members', 'marketing_role');
    }
}
