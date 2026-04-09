import { MigrationInterface, QueryRunner } from "typeorm";

export class AddInterestedBillingCycleToUsersPlatform1743977400000 implements MigrationInterface {
    name = 'AddInterestedBillingCycleToUsersPlatform1743977400000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add interested_billing_cycle column to users platform table
        await queryRunner.query(`
            ALTER TABLE "dra_users_platform" 
            ADD COLUMN "interested_billing_cycle" varchar(10) NULL
        `);

        // Add CHECK constraint to ensure only 'monthly' or 'annual' values
        await queryRunner.query(`
            ALTER TABLE "dra_users_platform" 
            ADD CONSTRAINT "chk_interested_billing_cycle" 
            CHECK ("interested_billing_cycle" IN ('monthly', 'annual'))
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop the CHECK constraint first
        await queryRunner.query(`
            ALTER TABLE "dra_users_platform" 
            DROP CONSTRAINT IF EXISTS "chk_interested_billing_cycle"
        `);
        
        // Drop the column
        await queryRunner.query(`
            ALTER TABLE "dra_users_platform" 
            DROP COLUMN "interested_billing_cycle"
        `);
    }
}
