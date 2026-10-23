import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPlanFailedStatus1792073611000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "dra_paid_media_plans_status_enum" ADD VALUE IF NOT EXISTS 'failed'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Postgres cannot drop enum values; downgrade is a no-op on purpose.
    }
}
