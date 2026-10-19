import { MigrationInterface, QueryRunner } from "typeorm";

export class NormalizeEscapedArtifactContent1792073613000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Some early AI artifacts were stored as JSON-escaped strings: the
        // document was one line with literal \n and \' sequences, so the UI
        // rendered it as a single oversized heading. Decode only rows where
        // literal newlines clearly dominate over real newlines.
        const literalNewlines = `(length(content) - length(replace(content, chr(92) || 'n', '')))`;
        const realNewlines = `(length(content) - length(replace(content, chr(10), '')))`;

        await queryRunner.query(`
            WITH target AS (
                SELECT id FROM dra_paid_media_plan_artifacts
                WHERE content IS NOT NULL
                  AND ${literalNewlines} > 0
                  AND ${realNewlines} <= ${literalNewlines} / 2
            )
            UPDATE dra_paid_media_plan_artifacts AS artifact
            SET content = replace(
                    replace(
                        replace(
                            replace(
                                replace(artifact.content,
                                    chr(92) || 'r' || chr(92) || 'n', chr(10)),
                                chr(92) || 'n', chr(10)),
                            chr(92) || 't', chr(9)),
                        chr(92) || '''', ''''),
                    chr(92) || '"', '"'),
                byte_size = octet_length(replace(
                    replace(
                        replace(
                            replace(
                                replace(artifact.content,
                                    chr(92) || 'r' || chr(92) || 'n', chr(10)),
                                chr(92) || 'n', chr(10)),
                            chr(92) || 't', chr(9)),
                        chr(92) || '''', ''''),
                    chr(92) || '"', '"')),
                updated_at = NOW()
            WHERE artifact.id IN (SELECT id FROM target)
        `);
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        // Escaped content cannot be reconstructed reliably; no-op on purpose.
    }
}
