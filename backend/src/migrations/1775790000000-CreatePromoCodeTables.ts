import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreatePromoCodeTables1775790000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create dra_promo_codes table
        await queryRunner.createTable(
            new Table({
                name: 'dra_promo_codes',
                columns: [
                    { name: 'id', type: 'serial', isPrimary: true },
                    { name: 'code', type: 'varchar', length: '50', isUnique: true, isNullable: false },
                    
                    // Discount details
                    { 
                        name: 'discount_type', 
                        type: 'varchar', 
                        length: '20', 
                        isNullable: false,
                        comment: 'percentage, fixed_amount, free_trial, upgraded_tier'
                    },
                    { name: 'discount_value', type: 'decimal', precision: 10, scale: 2, isNullable: true },
                    { 
                        name: 'discount_duration_months', 
                        type: 'integer', 
                        isNullable: true,
                        comment: 'null = apply once, -1 = forever, N = apply for N months'
                    },
                    
                    // Tier upgrade (for upgraded_tier type)
                    { name: 'upgraded_tier_id', type: 'integer', isNullable: true },
                    { name: 'upgraded_tier_duration_months', type: 'integer', isNullable: true },
                    
                    // Validity
                    { name: 'valid_from', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
                    { name: 'valid_until', type: 'timestamp', isNullable: true },
                    { name: 'is_active', type: 'boolean', default: true },
                    
                    // Usage limits
                    { name: 'max_uses', type: 'integer', isNullable: true, comment: 'null = unlimited' },
                    { name: 'max_uses_per_user', type: 'integer', default: '1' },
                    { name: 'current_uses', type: 'integer', default: '0' },
                    
                    // Restrictions
                    { 
                        name: 'applicable_tiers', 
                        type: 'jsonb', 
                        isNullable: true,
                        comment: 'null = all tiers, or array of tier IDs'
                    },
                    { 
                        name: 'applicable_users', 
                        type: 'jsonb', 
                        isNullable: true,
                        comment: 'null = all users, or array of user IDs/emails'
                    },
                    { 
                        name: 'email_domain_restriction', 
                        type: 'varchar', 
                        length: '255', 
                        isNullable: true,
                        comment: 'e.g., .edu for students'
                    },
                    { name: 'new_users_only', type: 'boolean', default: false },
                    
                    // Metadata
                    { name: 'created_by', type: 'integer', isNullable: true },
                    { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
                    { name: 'description', type: 'text', isNullable: true },
                    { name: 'campaign_name', type: 'varchar', length: '100', isNullable: true },
                    
                    // Paddle integration
                    { name: 'paddle_discount_id', type: 'varchar', length: '255', isNullable: true },
                ],
            }),
            true
        );

        // Create indexes for dra_promo_codes
        await queryRunner.createIndex(
            'dra_promo_codes',
            new TableIndex({ 
                name: 'idx_promo_codes_code', 
                columnNames: ['code'],
                isUnique: true
            })
        );

        await queryRunner.createIndex(
            'dra_promo_codes',
            new TableIndex({ 
                name: 'idx_promo_codes_active', 
                columnNames: ['is_active', 'valid_from', 'valid_until']
            })
        );

        await queryRunner.createIndex(
            'dra_promo_codes',
            new TableIndex({ 
                name: 'idx_promo_codes_campaign', 
                columnNames: ['campaign_name']
            })
        );

        // Create foreign key for created_by
        await queryRunner.createForeignKey(
            'dra_promo_codes',
            new TableForeignKey({
                columnNames: ['created_by'],
                referencedTableName: 'dra_users_platform',
                referencedColumnNames: ['id'],
                onDelete: 'SET NULL',
            })
        );

        // Create foreign key for upgraded_tier_id
        await queryRunner.createForeignKey(
            'dra_promo_codes',
            new TableForeignKey({
                columnNames: ['upgraded_tier_id'],
                referencedTableName: 'dra_subscription_tiers',
                referencedColumnNames: ['id'],
                onDelete: 'SET NULL',
            })
        );

        // Create check constraint for discount_type
        await queryRunner.query(`
            ALTER TABLE dra_promo_codes 
            ADD CONSTRAINT chk_promo_codes_discount_type 
            CHECK (discount_type IN ('percentage', 'fixed_amount', 'free_trial', 'upgraded_tier'))
        `);

        // Create dra_promo_code_redemptions table
        await queryRunner.createTable(
            new Table({
                name: 'dra_promo_code_redemptions',
                columns: [
                    { name: 'id', type: 'serial', isPrimary: true },
                    { name: 'promo_code_id', type: 'integer', isNullable: false },
                    { name: 'user_id', type: 'integer', isNullable: false },
                    { name: 'organization_id', type: 'integer', isNullable: true },
                    { name: 'subscription_id', type: 'integer', isNullable: true },
                    
                    // Redemption details
                    { name: 'redeemed_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
                    { name: 'discount_applied', type: 'decimal', precision: 10, scale: 2, isNullable: false },
                    { name: 'original_price', type: 'decimal', precision: 10, scale: 2, isNullable: false },
                    { name: 'final_price', type: 'decimal', precision: 10, scale: 2, isNullable: false },
                    
                    // Status
                    { 
                        name: 'status', 
                        type: 'varchar', 
                        length: '20', 
                        default: "'active'",
                        comment: 'active, expired, cancelled'
                    },
                    { name: 'expires_at', type: 'timestamp', isNullable: true },
                ],
            }),
            true
        );

        // Create indexes for dra_promo_code_redemptions
        await queryRunner.createIndex(
            'dra_promo_code_redemptions',
            new TableIndex({ 
                name: 'idx_redemptions_user', 
                columnNames: ['user_id']
            })
        );

        await queryRunner.createIndex(
            'dra_promo_code_redemptions',
            new TableIndex({ 
                name: 'idx_redemptions_promo_code', 
                columnNames: ['promo_code_id']
            })
        );

        await queryRunner.createIndex(
            'dra_promo_code_redemptions',
            new TableIndex({ 
                name: 'idx_redemptions_status', 
                columnNames: ['status']
            })
        );

        await queryRunner.createIndex(
            'dra_promo_code_redemptions',
            new TableIndex({ 
                name: 'idx_redemptions_organization', 
                columnNames: ['organization_id']
            })
        );

        // Create unique constraint for promo_code_id + user_id
        await queryRunner.createIndex(
            'dra_promo_code_redemptions',
            new TableIndex({ 
                name: 'idx_redemptions_unique_user_promo', 
                columnNames: ['promo_code_id', 'user_id'],
                isUnique: true
            })
        );

        // Create foreign keys for dra_promo_code_redemptions
        await queryRunner.createForeignKey(
            'dra_promo_code_redemptions',
            new TableForeignKey({
                columnNames: ['promo_code_id'],
                referencedTableName: 'dra_promo_codes',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
            })
        );

        await queryRunner.createForeignKey(
            'dra_promo_code_redemptions',
            new TableForeignKey({
                columnNames: ['user_id'],
                referencedTableName: 'dra_users_platform',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
            })
        );

        await queryRunner.createForeignKey(
            'dra_promo_code_redemptions',
            new TableForeignKey({
                columnNames: ['organization_id'],
                referencedTableName: 'dra_organizations',
                referencedColumnNames: ['id'],
                onDelete: 'SET NULL',
            })
        );

        await queryRunner.createForeignKey(
            'dra_promo_code_redemptions',
            new TableForeignKey({
                columnNames: ['subscription_id'],
                referencedTableName: 'dra_organization_subscriptions',
                referencedColumnNames: ['id'],
                onDelete: 'SET NULL',
            })
        );

        // Create check constraint for status
        await queryRunner.query(`
            ALTER TABLE dra_promo_code_redemptions 
            ADD CONSTRAINT chk_redemptions_status 
            CHECK (status IN ('active', 'expired', 'cancelled'))
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('dra_promo_code_redemptions');
        await queryRunner.dropTable('dra_promo_codes');
    }
}
