import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from "typeorm";

export class AddPlanInterestTrackingToUsers1773400000000 implements MigrationInterface {
    name = 'AddPlanInterestTrackingToUsers1773400000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add interested_subscription_tier_id column to dra_users_platform
        await queryRunner.addColumn('dra_users_platform', new TableColumn({
            name: 'interested_subscription_tier_id',
            type: 'integer',
            isNullable: true,
            comment: 'Tracks which paid plan the user expressed interest in (for notification when plans launch)'
        }));

        // Add foreign key constraint
        await queryRunner.createForeignKey('dra_users_platform', new TableForeignKey({
            name: 'FK_users_platform_interested_subscription_tier',
            columnNames: ['interested_subscription_tier_id'],
            referencedTableName: 'dra_subscription_tiers',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL'
        }));

        // Add dismissed_paid_plan_banner_until column
        await queryRunner.addColumn('dra_users_platform', new TableColumn({
            name: 'dismissed_paid_plan_banner_until',
            type: 'timestamp',
            isNullable: true,
            comment: 'Timestamp until which the paid plan launch banner should be hidden (7 days from dismissal)'
        }));

        console.log('✅ Added plan interest tracking columns to dra_users_platform table');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove foreign key
        await queryRunner.dropForeignKey('dra_users_platform', 'FK_users_platform_interested_subscription_tier');

        // Remove columns
        await queryRunner.dropColumn('dra_users_platform', 'interested_subscription_tier_id');
        await queryRunner.dropColumn('dra_users_platform', 'dismissed_paid_plan_banner_until');

        console.log('✅ Removed plan interest tracking columns from dra_users_platform table');
    }
}
