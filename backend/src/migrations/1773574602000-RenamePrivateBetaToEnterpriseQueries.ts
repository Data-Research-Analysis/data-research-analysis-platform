import { MigrationInterface, QueryRunner } from "typeorm";

export class RenamePrivateBetaToEnterpriseQueries1773574602000 implements MigrationInterface {
    name = 'RenamePrivateBetaToEnterpriseQueries1773574602000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Rename the table from dra_private_beta_users to dra_enterprise_queries
        await queryRunner.query(`ALTER TABLE "dra_private_beta_users" RENAME TO "dra_enterprise_queries"`);
        
        // Rename the sequence
        await queryRunner.query(`ALTER SEQUENCE "dra_private_beta_users_id_seq" RENAME TO "dra_enterprise_queries_id_seq"`);
        
        // Note: PostgreSQL automatically renames constraints when a table is renamed,
        // so we don't need to explicitly rename PK_dra_private_beta_users or UQ_dra_private_beta_users_business_email
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revert: Rename sequence back
        await queryRunner.query(`ALTER SEQUENCE "dra_enterprise_queries_id_seq" RENAME TO "dra_private_beta_users_id_seq"`);
        
        // Revert: Rename table back (constraints will automatically revert)
        await queryRunner.query(`ALTER TABLE "dra_enterprise_queries" RENAME TO "dra_private_beta_users"`);
    }
}
