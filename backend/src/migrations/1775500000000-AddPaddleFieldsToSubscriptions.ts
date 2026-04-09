import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Migration to replace Stripe fields with Paddle fields in organization subscriptions
 * 
 * Changes:
 * - Rename stripe_subscription_id → paddle_subscription_id
 * - Rename stripe_customer_id → paddle_customer_id
 * - Add paddle_transaction_id (latest transaction ID from Paddle)
 * - Add paddle_update_url (billing portal URL)
 * - Add billing_cycle enum ('monthly', 'annual')
 * - Add grace_period_ends_at (for failed payment handling)
 * - Add last_payment_failed_at (timestamp of last failed payment)
 * 
 * Part of Paddle.com payment integration (replacing Stripe)
 * @see documentation/paddle-integration-plan.md
 */
export class AddPaddleFieldsToSubscriptions1775500000000 implements MigrationInterface {
    name = 'AddPaddleFieldsToSubscriptions1775500000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Rename Stripe fields to Paddle
        await queryRunner.renameColumn('dra_organization_subscriptions', 'stripe_subscription_id', 'paddle_subscription_id');
        await queryRunner.renameColumn('dra_organization_subscriptions', 'stripe_customer_id', 'paddle_customer_id');
        
        // Add new Paddle-specific fields
        await queryRunner.addColumn('dra_organization_subscriptions', new TableColumn({
            name: 'paddle_transaction_id',
            type: 'varchar',
            length: '100',
            isNullable: true,
            comment: 'Latest Paddle transaction ID'
        }));
        
        await queryRunner.addColumn('dra_organization_subscriptions', new TableColumn({
            name: 'paddle_update_url',
            type: 'text',
            isNullable: true,
            comment: 'URL to Paddle billing portal for customer self-service'
        }));
        
        await queryRunner.addColumn('dra_organization_subscriptions', new TableColumn({
            name: 'billing_cycle',
            type: 'enum',
            enum: ['monthly', 'annual'],
            default: "'annual'",
            comment: 'Billing frequency for subscription'
        }));
        
        await queryRunner.addColumn('dra_organization_subscriptions', new TableColumn({
            name: 'grace_period_ends_at',
            type: 'timestamp',
            isNullable: true,
            comment: '14-day grace period after payment failure before downgrade to FREE'
        }));
        
        await queryRunner.addColumn('dra_organization_subscriptions', new TableColumn({
            name: 'last_payment_failed_at',
            type: 'timestamp',
            isNullable: true,
            comment: 'Timestamp of most recent failed payment'
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove new fields
        await queryRunner.dropColumn('dra_organization_subscriptions', 'last_payment_failed_at');
        await queryRunner.dropColumn('dra_organization_subscriptions', 'grace_period_ends_at');
        await queryRunner.dropColumn('dra_organization_subscriptions', 'billing_cycle');
        await queryRunner.dropColumn('dra_organization_subscriptions', 'paddle_update_url');
        await queryRunner.dropColumn('dra_organization_subscriptions', 'paddle_transaction_id');
        
        // Rename back to Stripe
        await queryRunner.renameColumn('dra_organization_subscriptions', 'paddle_customer_id', 'stripe_customer_id');
        await queryRunner.renameColumn('dra_organization_subscriptions', 'paddle_subscription_id', 'stripe_subscription_id');
    }
}
