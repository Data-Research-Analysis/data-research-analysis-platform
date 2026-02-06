import { IValidationResult } from '../interfaces/IDataQuality.js';
import Logger from '../utils/Logger.js';

/**
 * SQL Validation Service
 * Validates AI-generated SQL for safety before execution
 * Part of Phase 1: Data Quality & Marketing Attribution Engine
 */
export class SQLValidationService {
    private static instance: SQLValidationService;

    // Dangerous operations that are NEVER allowed
    private static readonly BLOCKED_OPERATIONS = [
        'DROP',
        'TRUNCATE',
        'ALTER',
        'CREATE DATABASE',
        'DROP DATABASE',
        'CREATE USER',
        'DROP USER',
        'GRANT',
        'REVOKE',
        'VACUUM',
        'ANALYZE'
    ];

    // Operations that are allowed within transactions
    private static readonly ALLOWED_OPERATIONS = [
        'SELECT',
        'UPDATE',
        'DELETE',
        'INSERT',
        'WITH',
        'BEGIN',
        'COMMIT',
        'ROLLBACK',
        'SAVEPOINT'
    ];

    private constructor() {}

    public static getInstance(): SQLValidationService {
        if (!SQLValidationService.instance) {
            SQLValidationService.instance = new SQLValidationService();
        }
        return SQLValidationService.instance;
    }

    /**
     * Validate cleaning SQL for safety
     */
    public validateCleaningSQL(sql: string): IValidationResult {
        const issues: string[] = [];
        const warnings: string[] = [];
        const normalizedSQL = this.normalizeSQL(sql);

        Logger.info('Validating cleaning SQL...');

        // Check for blocked operations
        const blockedOps = this.detectBlockedOperations(normalizedSQL);
        if (blockedOps.length > 0) {
            issues.push(
                `Blocked operations detected: ${blockedOps.join(', ')}. ` +
                `These operations are not allowed for safety reasons.`
            );
        }

        // Check for CREATE TABLE (temporary tables are OK)
        if (this.hasCreateTable(normalizedSQL)) {
            const isTemp = normalizedSQL.includes('CREATE TEMP TABLE') ||
                          normalizedSQL.includes('CREATE TEMPORARY TABLE');
            if (!isTemp) {
                issues.push(
                    'CREATE TABLE is not allowed. Use CREATE TEMP TABLE for temporary tables.'
                );
            }
        }

        // Check for DELETE/UPDATE without WHERE clause
        const unsafeDeletes = this.hasDeleteWithoutWhere(normalizedSQL);
        if (unsafeDeletes) {
            warnings.push(
                'DELETE or UPDATE statement without WHERE clause detected. ' +
                'This will affect all rows. Ensure this is intentional.'
            );
        }

        // Check for multiple statements (should be in transaction)
        const statementCount = this.countStatements(normalizedSQL);
        if (statementCount > 1) {
            const hasTransaction = this.isWrappedInTransaction(normalizedSQL);
            if (!hasTransaction) {
                warnings.push(
                    `${statementCount} statements detected but not wrapped in transaction. ` +
                    `Consider adding BEGIN...COMMIT for atomicity.`
                );
            }
        }

        // Check for SQL injection patterns
        const injectionRisk = this.detectSQLInjectionRisks(normalizedSQL);
        if (injectionRisk) {
            issues.push(
                'Potential SQL injection pattern detected. ' +
                'Ensure all user input is properly parameterized.'
            );
        }

        // Extract allowed operations found
        const allowedOperations = this.extractAllowedOperations(normalizedSQL);

        return {
            safe: issues.length === 0,
            issues,
            warnings,
            allowedOperations,
            blockedOperations: blockedOps
        };
    }

    /**
     * Normalize SQL for easier parsing
     */
    private normalizeSQL(sql: string): string {
        return sql
            .replace(/--[^\n]*/g, '') // Remove single-line comments
            .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
            .replace(/\s+/g, ' ') // Normalize whitespace
            .toUpperCase()
            .trim();
    }

    /**
     * Detect blocked operations
     */
    private detectBlockedOperations(normalizedSQL: string): string[] {
        const detected: string[] = [];
        
        for (const op of SQLValidationService.BLOCKED_OPERATIONS) {
            // Use word boundaries to avoid false positives
            const regex = new RegExp(`\\b${op}\\b`, 'i');
            if (regex.test(normalizedSQL)) {
                detected.push(op);
            }
        }

        return detected;
    }

    /**
     * Check if SQL has CREATE TABLE
     */
    private hasCreateTable(normalizedSQL: string): boolean {
        return /\bCREATE\s+(TEMP|TEMPORARY)?\s*TABLE\b/i.test(normalizedSQL);
    }

    /**
     * Check for DELETE/UPDATE without WHERE
     */
    private hasDeleteWithoutWhere(normalizedSQL: string): boolean {
        // Split by semicolon to check each statement
        const statements = normalizedSQL.split(';').filter(s => s.trim());
        
        for (const stmt of statements) {
            const trimmed = stmt.trim();
            
            // Check DELETE without WHERE
            if (/\bDELETE\s+FROM\b/i.test(trimmed) && !/\bWHERE\b/i.test(trimmed)) {
                // Allow if it's using a CTE with WHERE
                if (!/\bWITH\b/i.test(trimmed)) {
                    return true;
                }
            }
            
            // Check UPDATE without WHERE
            if (/\bUPDATE\b/i.test(trimmed) && /\bSET\b/i.test(trimmed) && !/\bWHERE\b/i.test(trimmed)) {
                // Allow if it's using a FROM clause with joins
                if (!/\bFROM\b/i.test(trimmed)) {
                    return true;
                }
            }
        }
        
        return false;
    }

    /**
     * Count SQL statements
     */
    private countStatements(normalizedSQL: string): number {
        // Remove strings to avoid counting semicolons in strings
        const withoutStrings = normalizedSQL.replace(/'[^']*'/g, '');
        const statements = withoutStrings.split(';').filter(s => s.trim());
        return statements.length;
    }

    /**
     * Check if SQL is wrapped in transaction
     */
    private isWrappedInTransaction(normalizedSQL: string): boolean {
        return (
            normalizedSQL.includes('BEGIN') &&
            (normalizedSQL.includes('COMMIT') || normalizedSQL.includes('ROLLBACK'))
        );
    }

    /**
     * Detect SQL injection risks
     */
    private detectSQLInjectionRisks(normalizedSQL: string): boolean {
        // Check for common injection patterns
        const injectionPatterns = [
            /;\s*DROP/i,
            /;\s*DELETE\s+FROM/i,
            /UNION\s+SELECT/i,
            /1\s*=\s*1/i,
            /'.*OR.*'/i,
            /--\s*$/i
        ];

        return injectionPatterns.some(pattern => pattern.test(normalizedSQL));
    }

    /**
     * Extract allowed operations from SQL
     */
    private extractAllowedOperations(normalizedSQL: string): string[] {
        const operations: Set<string> = new Set();

        for (const op of SQLValidationService.ALLOWED_OPERATIONS) {
            const regex = new RegExp(`\\b${op}\\b`, 'i');
            if (regex.test(normalizedSQL)) {
                operations.add(op);
            }
        }

        return Array.from(operations);
    }

    /**
     * Validate table reference exists in schema
     */
    public async validateTableReference(
        schema: string,
        tableName: string,
        queryRunner: any
    ): Promise<boolean> {
        try {
            const result = await queryRunner.query(
                `SELECT EXISTS (
                    SELECT 1 
                    FROM information_schema.tables 
                    WHERE table_schema = $1 
                    AND table_name = $2
                )`,
                [schema, tableName]
            );
            
            return result[0].exists;
        } catch (error) {
            Logger.error(`Error validating table reference ${schema}.${tableName}:`, error);
            return false;
        }
    }

    /**
     * Validate column references exist in table
     */
    public async validateColumnReferences(
        schema: string,
        tableName: string,
        columns: string[],
        queryRunner: any
    ): Promise<{ valid: boolean; missingColumns: string[] }> {
        try {
            const result = await queryRunner.query(
                `SELECT column_name
                 FROM information_schema.columns
                 WHERE table_schema = $1
                 AND table_name = $2
                 AND column_name = ANY($3)`,
                [schema, tableName, columns]
            );

            const existingColumns = result.map((row: any) => row.column_name);
            const missingColumns = columns.filter(col => !existingColumns.includes(col));

            return {
                valid: missingColumns.length === 0,
                missingColumns
            };
        } catch (error) {
            Logger.error(`Error validating column references:`, error);
            return {
                valid: false,
                missingColumns: columns
            };
        }
    }
}
