import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCurrentPlanIdToProjects1793002000000 implements MigrationInterface {
    name = 'AddCurrentPlanIdToProjects1793002000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // The CMO/manager picks which paid media plan is aligned with the
        // intelligence overview. Stored on the project, null = "no alignment
        // chosen" (the overview then falls back to the most recent plan).
        await queryRunner.query(`ALTER TABLE "dra_projects" ADD COLUMN "current_plan_id" integer`);
        await queryRunner.query(
            `ALTER TABLE "dra_projects" ADD CONSTRAINT "FK_dra_projects_current_plan" FOREIGN KEY ("current_plan_id") REFERENCES "dra_paid_media_plans"("id") ON DELETE SET NULL`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dra_projects" DROP CONSTRAINT IF EXISTS "FK_dra_projects_current_plan"`);
        await queryRunner.query(`ALTER TABLE "dra_projects" DROP COLUMN IF EXISTS "current_plan_id"`);
    }
}
