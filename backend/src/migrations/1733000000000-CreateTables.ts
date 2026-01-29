import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTables1733000000000 implements MigrationInterface {
    name = 'CreateTables1733000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "dra_user" ("id" SERIAL NOT NULL, "email" character varying(255) NOT NULL, "created_at" TIMESTAMP, CONSTRAINT "PK_6de3fffe92c633d42fb076f3c09" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."dra_data_sources_data_type_enum" AS ENUM('postgresql', 'mysql', 'mariadb', 'mongodb', 'csv', 'excel')`);
        await queryRunner.query(`CREATE TABLE "dra_data_sources" ("id" SERIAL NOT NULL, "name" character varying(255) NOT NULL, "data_type" "public"."dra_data_sources_data_type_enum" NOT NULL, "connection_details" jsonb NOT NULL, "created_at" TIMESTAMP, "users_platform_id" integer, "project_id" integer, CONSTRAINT "PK_ab441c0a416fb2261320461dd6c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "dra_dashboards" ("id" SERIAL NOT NULL, "data" jsonb NOT NULL, "users_platform_id" integer, "project_id" integer, CONSTRAINT "PK_2413ff056e1718806e6303e0d03" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "dra_projects" ("id" SERIAL NOT NULL, "name" character varying(255) NOT NULL, "created_at" TIMESTAMP, "users_platform_id" integer, CONSTRAINT "PK_0913025f5f0d4b4dd99b37a90a9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "dra_verification_codes" ("id" SERIAL NOT NULL, "code" character varying(1024) NOT NULL, "expired_at" TIMESTAMP, "users_platform_id" integer, CONSTRAINT "PK_8413fe5ec42a43b26227f328aaf" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "dra_users_platform" ("id" SERIAL NOT NULL, "email" character varying(255) NOT NULL, "first_name" character varying(255) NOT NULL, "last_name" character varying(255) NOT NULL, "password" character varying(255) NOT NULL, "email_verified_at" TIMESTAMP, "unsubscribe_from_emails_at" TIMESTAMP, CONSTRAINT "PK_3a4fe441e5f66829c8b2a875972" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "dra_data_models" ("id" SERIAL NOT NULL, "schema" character varying(255) NOT NULL, "name" character varying(255) NOT NULL, "sql_query" text NOT NULL, "query" jsonb NOT NULL, "users_platform_id" integer, "data_source_id" integer, CONSTRAINT "PK_9e11098d75a57d608a9812c88c2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "dra_data_sources" ADD CONSTRAINT "FK_a2670896f4b1713ba5bb3971229" FOREIGN KEY ("users_platform_id") REFERENCES "dra_users_platform"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dra_data_sources" ADD CONSTRAINT "FK_4659b4e1af9a86f2ead8f35f1a6" FOREIGN KEY ("project_id") REFERENCES "dra_projects"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dra_dashboards" ADD CONSTRAINT "FK_11f35fc890b8913691fc2c24110" FOREIGN KEY ("users_platform_id") REFERENCES "dra_users_platform"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dra_dashboards" ADD CONSTRAINT "FK_0c0ff5d5983ae79ca22b4abebd1" FOREIGN KEY ("project_id") REFERENCES "dra_projects"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dra_projects" ADD CONSTRAINT "FK_f5d2958e671c46cfd9a88ec8a39" FOREIGN KEY ("users_platform_id") REFERENCES "dra_users_platform"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dra_verification_codes" ADD CONSTRAINT "FK_f01cca82b116a9e42890deaf3e4" FOREIGN KEY ("users_platform_id") REFERENCES "dra_users_platform"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dra_data_models" ADD CONSTRAINT "FK_0b3fff05af975ea9892b92fc39c" FOREIGN KEY ("users_platform_id") REFERENCES "dra_users_platform"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dra_data_models" ADD CONSTRAINT "FK_81a3e0e9177a3b3ef77edccc322" FOREIGN KEY ("data_source_id") REFERENCES "dra_data_sources"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dra_data_models" DROP CONSTRAINT "FK_81a3e0e9177a3b3ef77edccc322"`);
        await queryRunner.query(`ALTER TABLE "dra_data_models" DROP CONSTRAINT "FK_0b3fff05af975ea9892b92fc39c"`);
        await queryRunner.query(`ALTER TABLE "dra_verification_codes" DROP CONSTRAINT "FK_f01cca82b116a9e42890deaf3e4"`);
        await queryRunner.query(`ALTER TABLE "dra_projects" DROP CONSTRAINT "FK_f5d2958e671c46cfd9a88ec8a39"`);
        await queryRunner.query(`ALTER TABLE "dra_dashboards" DROP CONSTRAINT "FK_0c0ff5d5983ae79ca22b4abebd1"`);
        await queryRunner.query(`ALTER TABLE "dra_dashboards" DROP CONSTRAINT "FK_11f35fc890b8913691fc2c24110"`);
        await queryRunner.query(`ALTER TABLE "dra_data_sources" DROP CONSTRAINT "FK_4659b4e1af9a86f2ead8f35f1a6"`);
        await queryRunner.query(`ALTER TABLE "dra_data_sources" DROP CONSTRAINT "FK_a2670896f4b1713ba5bb3971229"`);
        await queryRunner.query(`DROP TABLE "dra_data_models"`);
        await queryRunner.query(`DROP TABLE "dra_users_platform"`);
        await queryRunner.query(`DROP TABLE "dra_verification_codes"`);
        await queryRunner.query(`DROP TABLE "dra_projects"`);
        await queryRunner.query(`DROP TABLE "dra_dashboards"`);
        await queryRunner.query(`DROP TABLE "dra_data_sources"`);
        await queryRunner.query(`DROP TYPE "public"."dra_data_sources_data_type_enum"`);
        await queryRunner.query(`DROP TABLE "dra_user"`);
    }

}
