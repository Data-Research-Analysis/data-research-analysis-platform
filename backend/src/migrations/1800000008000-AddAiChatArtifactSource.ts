import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAiChatArtifactSource1800000008000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "dra_paid_media_plan_artifacts_source_enum" ADD VALUE IF NOT EXISTS 'ai_chat'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Postgres cannot drop enum values; downgrade is a no-op on purpose.
    }
}
