/**
 * MongoDBQueryTranslator - Translates MongoDB aggregation pipelines to SQL
 * 
 * This service enables querying imported MongoDB data in PostgreSQL by
 * converting MongoDB-style queries to equivalent SQL queries.
 */
export class MongoDBQueryTranslator {
    /**
     * Translate MongoDB aggregation pipeline to SQL
     */
    public translatePipeline(tableName: string, pipeline: any[]): string {
        // Sanitize table name
        const sanitizedTable = this.sanitizeIdentifier(tableName);
        
        let sql = `SELECT * FROM dra_mongodb.${sanitizedTable}`;
        const whereClauses: string[] = [];
        const groupBy: string[] = [];
        const orderBy: string[] = [];
        let selectFields: string[] | null = null;
        let limit: number | null = null;
        let skip: number | null = null;

        // Process each stage in the pipeline
        for (const stage of pipeline) {
            const stageType = Object.keys(stage)[0];
            const stageValue = stage[stageType];

            switch (stageType) {
                case '$match':
                    whereClauses.push(this.translateMatch(stageValue));
                    break;

                case '$project':
                    selectFields = this.translateProject(stageValue);
                    break;

                case '$group':
                    // TODO: Implement grouping translation
                    console.warn('[MongoDBQueryTranslator] $group stage not yet implemented');
                    break;

                case '$sort':
                    orderBy.push(this.translateSort(stageValue));
                    break;

                case '$limit':
                    limit = stageValue;
                    break;

                case '$skip':
                    skip = stageValue;
                    break;

                case '$lookup':
                    // TODO: Implement join translation
                    console.warn('[MongoDBQueryTranslator] $lookup stage not yet implemented');
                    break;

                default:
                    console.warn(`[MongoDBQueryTranslator] Unsupported stage: ${stageType}`);
            }
        }

        // Build SELECT clause
        if (selectFields && selectFields.length > 0) {
            sql = `SELECT ${selectFields.join(', ')} FROM dra_mongodb.${sanitizedTable}`;
        }

        // Build WHERE clause
        if (whereClauses.length > 0) {
            sql += ` WHERE ${whereClauses.join(' AND ')}`;
        }

        // Build ORDER BY clause
        if (orderBy.length > 0) {
            sql += ` ORDER BY ${orderBy.join(', ')}`;
        }

        // Build LIMIT clause
        if (limit !== null) {
            sql += ` LIMIT ${limit}`;
        }

        // Build OFFSET clause
        if (skip !== null) {
            sql += ` OFFSET ${skip}`;
        }

        return sql;
    }

    /**
     * Translate $match stage to WHERE clause
     */
    private translateMatch(match: Record<string, any>): string {
        const conditions: string[] = [];

        for (const [field, condition] of Object.entries(match)) {
            const sanitizedField = this.sanitizeIdentifier(field);
            
            if (typeof condition === 'object' && condition !== null && !Array.isArray(condition)) {
                // Handle operators: $gt, $lt, $gte, $lte, $eq, $ne, $in, $nin, $exists
                for (const [op, value] of Object.entries(condition)) {
                    switch (op) {
                        case '$gt':
                            conditions.push(`${sanitizedField} > ${this.formatValue(value)}`);
                            break;
                        case '$gte':
                            conditions.push(`${sanitizedField} >= ${this.formatValue(value)}`);
                            break;
                        case '$lt':
                            conditions.push(`${sanitizedField} < ${this.formatValue(value)}`);
                            break;
                        case '$lte':
                            conditions.push(`${sanitizedField} <= ${this.formatValue(value)}`);
                            break;
                        case '$eq':
                            conditions.push(`${sanitizedField} = ${this.formatValue(value)}`);
                            break;
                        case '$ne':
                            conditions.push(`${sanitizedField} != ${this.formatValue(value)}`);
                            break;
                        case '$in':
                            const inValues = (value as any[]).map(v => this.formatValue(v)).join(', ');
                            conditions.push(`${sanitizedField} IN (${inValues})`);
                            break;
                        case '$nin':
                            const ninValues = (value as any[]).map(v => this.formatValue(v)).join(', ');
                            conditions.push(`${sanitizedField} NOT IN (${ninValues})`);
                            break;
                        case '$exists':
                            if (value) {
                                conditions.push(`${sanitizedField} IS NOT NULL`);
                            } else {
                                conditions.push(`${sanitizedField} IS NULL`);
                            }
                            break;
                        case '$regex':
                            // Convert MongoDB regex to PostgreSQL ILIKE for simple patterns
                            const pattern = String(value).replace(/\\/g, '');
                            conditions.push(`${sanitizedField} ILIKE '%${pattern}%'`);
                            break;
                        default:
                            console.warn(`[MongoDBQueryTranslator] Unsupported operator: ${op}`);
                    }
                }
            } else {
                // Simple equality
                conditions.push(`${sanitizedField} = ${this.formatValue(condition)}`);
            }
        }

        return conditions.join(' AND ');
    }

    /**
     * Translate $project stage to SELECT clause
     */
    private translateProject(project: Record<string, any>): string[] {
        const fields: string[] = [];

        for (const [field, value] of Object.entries(project)) {
            const sanitizedField = this.sanitizeIdentifier(field);
            
            if (value === 1 || value === true) {
                // Include field
                fields.push(sanitizedField);
            } else if (value === 0 || value === false) {
                // Exclude field (handled by including only specified fields)
                continue;
            } else if (typeof value === 'object') {
                // Complex projection (e.g., computed fields)
                // TODO: Implement computed field translation
                console.warn(`[MongoDBQueryTranslator] Complex projection not yet implemented for field: ${field}`);
                fields.push(sanitizedField);
            }
        }

        // If no fields specified or all excluded, return null to use SELECT *
        return fields.length > 0 ? fields : [];
    }

    /**
     * Translate $sort stage to ORDER BY clause
     */
    private translateSort(sort: Record<string, number>): string {
        const orderItems: string[] = [];

        for (const [field, direction] of Object.entries(sort)) {
            const sanitizedField = this.sanitizeIdentifier(field);
            const dir = direction === 1 ? 'ASC' : 'DESC';
            orderItems.push(`${sanitizedField} ${dir}`);
        }

        return orderItems.join(', ');
    }

    /**
     * Format value for SQL
     */
    private formatValue(value: any): string {
        if (value === null || value === undefined) {
            return 'NULL';
        } else if (typeof value === 'string') {
            // Escape single quotes by doubling them
            return `'${value.replace(/'/g, "''")}'`;
        } else if (value instanceof Date) {
            return `'${value.toISOString()}'`;
        } else if (typeof value === 'boolean') {
            return value ? 'TRUE' : 'FALSE';
        } else if (typeof value === 'number') {
            return String(value);
        } else if (typeof value === 'object') {
            // For objects/arrays, convert to JSON string
            return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
        } else {
            return String(value);
        }
    }

    /**
     * Sanitize identifier (table/column name) for SQL
     */
    private sanitizeIdentifier(name: string): string {
        // Convert to lowercase and replace invalid characters
        return name
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '_')
            .replace(/^[0-9]/, '_$&')
            .substring(0, 63); // PostgreSQL identifier limit
    }

    /**
     * Sanitize table name for PostgreSQL
     */
    private sanitizeTableName(name: string): string {
        return this.sanitizeIdentifier(name);
    }
}
