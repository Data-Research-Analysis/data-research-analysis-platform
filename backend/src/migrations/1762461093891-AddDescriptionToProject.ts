import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDescriptionToProject1762461093891 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dra_projects" ADD "description" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dra_projects" DROP COLUMN "description"`);
    }

}
