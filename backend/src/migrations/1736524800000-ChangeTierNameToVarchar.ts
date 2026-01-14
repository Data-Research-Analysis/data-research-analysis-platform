import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangeTierNameToVarchar1736524800000 implements MigrationInterface {
    name = 'ChangeTierNameToVarchar1736524800000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if table exists before attempting to modify it
        const tableExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = 'dra_subscription_tiers'
            );
        `);

        if (!tableExists[0].exists) {
            console.log('⚠️  Table dra_subscription_tiers does not exist yet, skipping this migration');
            console.log('   This migration will be applied after subscription tables are created');
            return;
        }

        // First convert enum to text, then to varchar
        await queryRunner.query(`
            ALTER TABLE "dra_subscription_tiers" 
            ALTER COLUMN "tier_name" TYPE text
        `);
        
        // Then change to varchar
        await queryRunner.query(`
            ALTER TABLE "dra_subscription_tiers" 
            ALTER COLUMN "tier_name" TYPE varchar(50)
        `);
        
        // Drop the enum type
        await queryRunner.query(`
            DROP TYPE IF EXISTS "dra_subscription_tiers_tier_name_enum"
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Create the enum type
        await queryRunner.query(`
            CREATE TYPE "dra_subscription_tiers_tier_name_enum" AS ENUM('free', 'pro', 'team', 'business', 'enterprise')
        `);
        
        // Revert back to enum type
        await queryRunner.query(`
            ALTER TABLE "dra_subscription_tiers" 
            ALTER COLUMN "tier_name" TYPE "dra_subscription_tiers_tier_name_enum" 
            USING "tier_name"::"dra_subscription_tiers_tier_name_enum"
        `);
    }
}
