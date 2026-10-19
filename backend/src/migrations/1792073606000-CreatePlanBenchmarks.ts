import { MigrationInterface, QueryRunner, Table, TableIndex } from "typeorm";

export class CreatePlanBenchmarks1792073606000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: "dra_plan_benchmarks",
                columns: [
                    { name: "id", type: "int", isPrimary: true, isGenerated: true, generationStrategy: "increment" },
                    { name: "industry", type: "varchar", length: "128", isNullable: false },
                    { name: "market", type: "varchar", length: "64", isNullable: false },
                    { name: "platform", type: "varchar", length: "64", isNullable: false },
                    { name: "metric", type: "enum", enum: ["cpc", "cpm", "ctr", "cvr", "cpl", "roas", "cpa"], isNullable: false },
                    { name: "value", type: "numeric", precision: 14, scale: 4, isNullable: false },
                    { name: "sample_size", type: "int", default: 0, isNullable: false },
                    { name: "source", type: "enum", enum: ["learned", "external", "user"], default: "'learned'", isNullable: false },
                    { name: "confidence", type: "numeric", precision: 6, scale: 4, default: 0, isNullable: false },
                    { name: "updated_at", type: "timestamp", default: "CURRENT_TIMESTAMP", onUpdate: "CURRENT_TIMESTAMP" },
                ],
            }),
            true
        );

        await queryRunner.createIndex(
            "dra_plan_benchmarks",
            new TableIndex({ name: "uq_plan_benchmarks_scope", columnNames: ["industry", "market", "platform", "metric", "source"], isUnique: true })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropIndex("dra_plan_benchmarks", "uq_plan_benchmarks_scope");
        await queryRunner.dropTable("dra_plan_benchmarks");
    }
}
