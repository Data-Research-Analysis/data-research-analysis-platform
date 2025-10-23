import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePrivateBetaUsers1761158025774 implements MigrationInterface {
    name = 'CreatePrivateBetaUsers1761158025774'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "dra_private_beta_users" ("id" SERIAL NOT NULL, "first_name" character varying(255) NOT NULL, "last_name" character varying(255) NOT NULL, "phone_number" character varying(255) NOT NULL, "business_email" character varying(255) NOT NULL, "company_name" character varying(255) NOT NULL, "country" character varying(255) NOT NULL, "agree_to_receive_updates" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP with time zone DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "PK_44c9d4357efe86c064faa32436a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TYPE "public"."dra_data_sources_data_type_enum" RENAME TO "dra_data_sources_data_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."dra_data_sources_data_type_enum" AS ENUM('postgresql', 'mysql', 'mariadb', 'mongodb', 'csv', 'excel', 'pdf')`);
        await queryRunner.query(`ALTER TABLE "dra_data_sources" ALTER COLUMN "data_type" TYPE "public"."dra_data_sources_data_type_enum" USING "data_type"::"text"::"public"."dra_data_sources_data_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."dra_data_sources_data_type_enum_old"`);
        await queryRunner.query(`DROP TABLE "dra_user"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."dra_data_sources_data_type_enum_old" AS ENUM('postgresql', 'mysql', 'mariadb', 'mongodb', 'csv', 'excel')`);
        await queryRunner.query(`ALTER TABLE "dra_data_sources" ALTER COLUMN "data_type" TYPE "public"."dra_data_sources_data_type_enum_old" USING "data_type"::"text"::"public"."dra_data_sources_data_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."dra_data_sources_data_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."dra_data_sources_data_type_enum_old" RENAME TO "dra_data_sources_data_type_enum"`);
        await queryRunner.query(`DROP TABLE "dra_private_beta_users"`);
        await queryRunner.query(`CREATE TABLE "dra_user" ("id" SERIAL NOT NULL, "email" character varying(255) NOT NULL, "created_at" TIMESTAMP, CONSTRAINT "PK_6de3fffe92c633d42fb076f3c09" PRIMARY KEY ("id"))`);
        
    }

}
