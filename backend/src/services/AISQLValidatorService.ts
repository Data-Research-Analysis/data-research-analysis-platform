import { AppDataSource } from '../datasources/PostgresDS.js';

/**
 * Validates AI-generated SQL before it is stored as a dashboard widget.
 *
 * Rules enforced:
 *  1. The statement must begin with SELECT (case-insensitive).
 *  2. Every schema.table reference in the SQL must exist in dra_table_metadata
 *     for the given projectId, ensuring Gemini cannot reference tables outside
 *     the project's data.
 *
 * Only dra_* schemas are checked — references to other schema prefixes are
 * ignored (e.g. pg_catalog, information_schema pseudo-references won't trip
 * this check, but they won't appear in real Gemini output either).
 */
export class AISQLValidatorService {
    private static instance: AISQLValidatorService;

    private constructor() {}

    public static getInstance(): AISQLValidatorService {
        if (!AISQLValidatorService.instance) {
            AISQLValidatorService.instance = new AISQLValidatorService();
        }
        return AISQLValidatorService.instance;
    }

    /**
     * Validate a Gemini-generated SQL string against the project's registered tables.
     *
     * @param sql       - The SQL string to validate.
     * @param projectId - The project whose dra_table_metadata rows are treated as the whitelist.
     * @returns         `{ valid: true }` on success, or `{ valid: false, reason: string }` on failure.
     */
    async validate(sql: string, projectId: number): Promise<{ valid: boolean; reason?: string }> {
        const trimmed = sql.trim();

        // Rule 1: must be a SELECT statement
        if (!/^SELECT\b/i.test(trimmed)) {
            return { valid: false, reason: 'Only SELECT statements are permitted.' };
        }

        // Rule 2: extract schema.table references and check against metadata
        const manager = AppDataSource.manager;
        const tableRefs = this.extractTableRefs(trimmed);

        if (tableRefs.length === 0) {
            return { valid: false, reason: 'No table references detected in SQL.' };
        }

        for (const { schema, table } of tableRefs) {
            const exists = await manager.query(
                `SELECT 1 FROM dra_table_metadata tm
                 JOIN dra_data_sources ds ON ds.id = tm.data_source_id
                 WHERE ds.project_id = $1
                   AND tm.schema_name   = $2
                   AND tm.physical_table_name = $3
                 LIMIT 1`,
                [projectId, schema, table]
            );
            if (!exists.length) {
                return {
                    valid: false,
                    reason: `Table "${schema}"."${table}" is not registered for this project.`,
                };
            }
        }

        return { valid: true };
    }

    /**
     * Extract all schema.table references from a SQL string.
     * Only returns refs whose schema name starts with 'dra_'.
     */
    private extractTableRefs(sql: string): Array<{ schema: string; table: string }> {
        // Matches: schema."table" or schema.table (quoted or unquoted identifier)
        const pattern = /(\w+)\."?([\w]+)"?/g;
        const refs: Array<{ schema: string; table: string }> = [];
        let match: RegExpExecArray | null;

        while ((match = pattern.exec(sql)) !== null) {
            const schema = match[1];
            const table = match[2];
            // Only validate references to known dra_ schemas
            if (schema.startsWith('dra_')) {
                refs.push({ schema, table });
            }
        }

        return refs;
    }
}
