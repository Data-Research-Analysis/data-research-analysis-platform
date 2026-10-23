import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPlanNotificationTypes1792073610000 implements MigrationInterface {
    name = 'AddPlanNotificationTypes1792073610000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const enumExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT 1 FROM pg_type WHERE typname = 'dra_notifications_type_enum'
            );
        `);
        if (!enumExists[0].exists) {
            return;
        }
        await queryRunner.query(`
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'plan_gate_raised';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'plan_step_failed';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'plan_complete';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'plan_results_ready';
        `);
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        console.log('Rollback of enum values not supported in PostgreSQL. Manual intervention required.');
    }
}
