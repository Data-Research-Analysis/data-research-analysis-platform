import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from "typeorm";

export class CreateEnterpriseContactRequests1775656800000 implements MigrationInterface {
    name = 'CreateEnterpriseContactRequests1775656800000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: "dra_enterprise_contact_requests",
                columns: [
                    {
                        name: "id",
                        type: "serial",
                        isPrimary: true
                    },
                    {
                        name: "user_id",
                        type: "integer",
                        isNullable: false
                    },
                    {
                        name: "organization_id",
                        type: "integer",
                        isNullable: true
                    },
                    {
                        name: "company_name",
                        type: "varchar",
                        length: "255",
                        isNullable: false
                    },
                    {
                        name: "team_size",
                        type: "varchar",
                        length: "50",
                        isNullable: false
                    },
                    {
                        name: "message",
                        type: "text",
                        isNullable: true
                    },
                    {
                        name: "status",
                        type: "varchar",
                        length: "50",
                        default: "'pending'",
                        comment: "Status: pending, contacted, qualified, converted, declined"
                    },
                    {
                        name: "admin_notes",
                        type: "text",
                        isNullable: true
                    },
                    {
                        name: "created_at",
                        type: "timestamp",
                        default: "now()"
                    },
                    {
                        name: "updated_at",
                        type: "timestamp",
                        default: "now()"
                    },
                    {
                        name: "contacted_at",
                        type: "timestamp",
                        isNullable: true
                    }
                ]
            }),
            true
        );

        // Add foreign key for user
        await queryRunner.createForeignKey(
            "dra_enterprise_contact_requests",
            new TableForeignKey({
                name: "fk_enterprise_request_user",
                columnNames: ["user_id"],
                referencedTableName: "dra_users_platform",
                referencedColumnNames: ["id"],
                onDelete: "CASCADE"
            })
        );

        // Add foreign key for organization
        await queryRunner.createForeignKey(
            "dra_enterprise_contact_requests",
            new TableForeignKey({
                name: "fk_enterprise_request_organization",
                columnNames: ["organization_id"],
                referencedTableName: "dra_organizations",
                referencedColumnNames: ["id"],
                onDelete: "SET NULL"
            })
        );

        // Add indexes for common queries
        await queryRunner.createIndex(
            "dra_enterprise_contact_requests",
            new TableIndex({
                name: "idx_enterprise_requests_user_id",
                columnNames: ["user_id"]
            })
        );

        await queryRunner.createIndex(
            "dra_enterprise_contact_requests",
            new TableIndex({
                name: "idx_enterprise_requests_status",
                columnNames: ["status"]
            })
        );

        await queryRunner.createIndex(
            "dra_enterprise_contact_requests",
            new TableIndex({
                name: "idx_enterprise_requests_created_at",
                columnNames: ["created_at"]
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes
        await queryRunner.dropIndex("dra_enterprise_contact_requests", "idx_enterprise_requests_created_at");
        await queryRunner.dropIndex("dra_enterprise_contact_requests", "idx_enterprise_requests_status");
        await queryRunner.dropIndex("dra_enterprise_contact_requests", "idx_enterprise_requests_user_id");

        // Drop foreign keys
        await queryRunner.dropForeignKey("dra_enterprise_contact_requests", "fk_enterprise_request_organization");
        await queryRunner.dropForeignKey("dra_enterprise_contact_requests", "fk_enterprise_request_user");

        // Drop table
        await queryRunner.dropTable("dra_enterprise_contact_requests");
    }
}
