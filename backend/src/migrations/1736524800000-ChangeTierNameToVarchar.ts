import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangeTierNameToVarchar1736524800000 implements MigrationInterface {
    name = 'ChangeTierNameToVarchar1736524800000'

    public async up(queryRunner: QueryRunner): Promise<void> {
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
