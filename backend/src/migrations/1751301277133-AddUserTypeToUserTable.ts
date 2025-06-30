import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserTypeToUserTable1751301277133 implements MigrationInterface {
    name = 'AddUserTypeToUserTable1751301277133'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."dra_users_platform_user_type_enum" AS ENUM('admin', 'normal')`);
        await queryRunner.query(`ALTER TABLE "dra_users_platform" ADD "user_type" "public"."dra_users_platform_user_type_enum" NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dra_users_platform" DROP COLUMN "user_type"`);
        await queryRunner.query(`DROP TYPE "public"."dra_users_platform_user_type_enum"`);
    }

}
