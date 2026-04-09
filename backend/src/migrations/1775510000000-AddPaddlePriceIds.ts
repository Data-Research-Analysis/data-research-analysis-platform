import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Migration to add Paddle price IDs to subscription tiers
 * 
 * Adds:
 * - paddle_price_id_monthly: Monthly subscription price ID from Paddle
 * - paddle_price_id_annual: Annual subscription price ID from Paddle
 * - paddle_product_id: Product ID from Paddle (parent of price IDs)
 * 
 * These IDs are configured in Paddle dashboard and stored here for reference.
 * Admin can update via subscription tier management UI.
 * 
 * Part of Paddle.com payment integration
 * @see documentation/paddle-integration-plan.md
 */
export class AddPaddlePriceIds1775510000000 implements MigrationInterface {
    name = 'AddPaddlePriceIds1775510000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn('dra_subscription_tiers', new TableColumn({
            name: 'paddle_price_id_monthly',
            type: 'varchar',
            length: '100',
            isNullable: true,
            comment: 'Paddle price ID for monthly billing cycle (e.g., pri_01...)'
        }));
        
        await queryRunner.addColumn('dra_subscription_tiers', new TableColumn({
            name: 'paddle_price_id_annual',
            type: 'varchar',
            length: '100',
            isNullable: true,
            comment: 'Paddle price ID for annual billing cycle (e.g., pri_02...)'
        }));
        
        await queryRunner.addColumn('dra_subscription_tiers', new TableColumn({
            name: 'paddle_product_id',
            type: 'varchar',
            length: '100',
            isNullable: true,
            comment: 'Paddle product ID (e.g., pro_01...)'
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('dra_subscription_tiers', 'paddle_product_id');
        await queryRunner.dropColumn('dra_subscription_tiers', 'paddle_price_id_annual');
        await queryRunner.dropColumn('dra_subscription_tiers', 'paddle_price_id_monthly');
    }
}
