import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddTierRankColumn1745060000000 implements MigrationInterface {
    name = 'AddTierRankColumn1745060000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add tier_rank column
        await queryRunner.addColumn('dra_subscription_tiers', new TableColumn({
            name: 'tier_rank',
            type: 'int',
            isNullable: false,
            default: 0,
            comment: 'Numeric rank for tier comparison (0=free, 10=starter, 20=professional, 30=professional_plus, 40=enterprise)'
        }));

        // Update existing tiers with rank based on their tier_name patterns
        // Free tier
        await queryRunner.query(`
            UPDATE dra_subscription_tiers 
            SET tier_rank = 0 
            WHERE LOWER(tier_name) = 'free' OR LOWER(tier_name) LIKE '%free%'
        `);

        // Starter tier
        await queryRunner.query(`
            UPDATE dra_subscription_tiers 
            SET tier_rank = 10 
            WHERE LOWER(tier_name) LIKE '%starter%'
        `);

        // Professional tier (not plus)
        await queryRunner.query(`
            UPDATE dra_subscription_tiers 
            SET tier_rank = 20 
            WHERE LOWER(tier_name) LIKE '%professional%' 
            AND LOWER(tier_name) NOT LIKE '%plus%'
        `);

        // Professional Plus tier
        await queryRunner.query(`
            UPDATE dra_subscription_tiers 
            SET tier_rank = 30 
            WHERE LOWER(tier_name) LIKE '%professional%plus%' 
            OR LOWER(tier_name) LIKE '%professional plus%'
        `);

        // Enterprise tier
        await queryRunner.query(`
            UPDATE dra_subscription_tiers 
            SET tier_rank = 40 
            WHERE LOWER(tier_name) LIKE '%enterprise%'
        `);

        // Log any tiers that weren't matched (rank=0 but not 'free')
        console.log('⚠️  Check tiers with rank=0 (may need manual update):');
        const unmatchedTiers = await queryRunner.query(`
            SELECT id, tier_name, tier_rank 
            FROM dra_subscription_tiers 
            WHERE tier_rank = 0 AND LOWER(tier_name) NOT LIKE '%free%'
        `);
        if (unmatchedTiers.length > 0) {
            console.log(unmatchedTiers);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('dra_subscription_tiers', 'tier_rank');
    }
}
