import { MigrationInterface, QueryRunner } from "typeorm";

export class RenumberCompanyPaidAuditStep1792073612000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // The company paid audit is step 3A and must run between competitor
        // research (3) and audience analysis (4). It was previously stored as
        // 31, which sorted it after plan-index (16) and made it look skipped.
        await queryRunner.query(`
            UPDATE dra_paid_media_plans
            SET current_step = CASE
                    WHEN current_step = 31 THEN 4
                    ELSE current_step + 1
                END
            WHERE current_step >= 4
              AND id IN (
                  SELECT plan_id FROM dra_paid_media_plan_steps
                  WHERE step_key = 'pm-company-paid-audit' AND step_number = 31
              )
        `);

        await queryRunner.query(`
            UPDATE dra_paid_media_plan_steps
            SET step_number = step_number + 1
            WHERE step_key <> 'pm-company-paid-audit'
              AND step_number >= 4
              AND plan_id IN (
                  SELECT plan_id FROM dra_paid_media_plan_steps
                  WHERE step_key = 'pm-company-paid-audit' AND step_number = 31
              )
        `);

        await queryRunner.query(`
            UPDATE dra_paid_media_plan_steps
            SET step_number = 4
            WHERE step_key = 'pm-company-paid-audit' AND step_number = 31
        `);
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        // Reordering existing plan steps is not reversible without the original
        // step numbers; downgrade is a no-op on purpose.
    }
}
