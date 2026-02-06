import { AppDataSource } from '../datasources/PostgresDS.js';
import { DRADataModel } from '../models/DRADataModel.js';
import { IExecutionResult } from '../interfaces/IDataQuality.js';
import { SQLValidationService } from './SQLValidationService.js';
import Logger from '../utils/Logger.js';

/**
 * Data Quality Execution Service
 * Executes AI-generated cleaning SQL in safe transactions
 * Part of Phase 1: Data Quality & Marketing Attribution Engine
 */
export class DataQualityExecutionService {
    private static instance: DataQualityExecutionService;
    private sqlValidator: SQLValidationService;

    private constructor() {
        this.sqlValidator = SQLValidationService.getInstance();
    }

    public static getInstance(): DataQualityExecutionService {
        if (!DataQualityExecutionService.instance) {
            DataQualityExecutionService.instance = new DataQualityExecutionService();
        }
        return DataQualityExecutionService.instance;
    }

    /**
     * Execute cleaning SQL with transaction safety
     */
    public async executeCleaningSQL(
        dataModel: DRADataModel,
        sql: string,
        dryRun: boolean = false
    ): Promise<IExecutionResult> {
        const startTime = Date.now();
        
        Logger.info(
            `${dryRun ? 'Dry-run' : 'Executing'} cleaning SQL for data model: ${dataModel.name} (ID: ${dataModel.id})`
        );

        // Validate SQL first
        const validation = this.sqlValidator.validateCleaningSQL(sql);
        if (!validation.safe) {
            return {
                success: false,
                rowsAffected: 0,
                executionTimeMs: Date.now() - startTime,
                dryRun,
                error: `SQL validation failed: ${validation.issues.join('; ')}`,
                rollbackAvailable: false
            };
        }

        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();

        try {
            // Start transaction
            await queryRunner.startTransaction();

            // Create savepoint for rollback capability
            await queryRunner.query('SAVEPOINT before_cleaning');

            let rowsAffected = 0;
            let changes: { before: any[]; after: any[] } | undefined;

            try {
                // For UPDATE/DELETE, capture before state if dry-run
                if (dryRun) {
                    changes = await this.captureBeforeState(queryRunner, sql, dataModel);
                }

                // Execute the SQL
                const result = await queryRunner.query(sql);
                
                // Extract rows affected from result
                if (Array.isArray(result)) {
                    rowsAffected = result.length;
                } else if (result && typeof result === 'object') {
                    // For INSERT/UPDATE/DELETE, affected rows in different properties
                    rowsAffected = result.affectedRows || result.rowCount || 0;
                }

                // Capture after state if dry-run
                if (dryRun && changes) {
                    changes.after = await this.captureAfterState(queryRunner, sql, dataModel);
                }

                // If dry-run, rollback to savepoint
                if (dryRun) {
                    await queryRunner.query('ROLLBACK TO SAVEPOINT before_cleaning');
                    await queryRunner.rollbackTransaction();
                    
                    Logger.info(`Dry-run completed for data model ${dataModel.id}. Changes rolled back.`);
                } else {
                    // Commit transaction
                    await queryRunner.commitTransaction();
                    
                    Logger.info(
                        `Successfully executed cleaning SQL for data model ${dataModel.id}. ` +
                        `Rows affected: ${rowsAffected}`
                    );
                }

                return {
                    success: true,
                    rowsAffected,
                    executionTimeMs: Date.now() - startTime,
                    dryRun,
                    changes: dryRun ? changes : undefined,
                    rollbackAvailable: !dryRun
                };

            } catch (executionError) {
                // Rollback to savepoint
                await queryRunner.query('ROLLBACK TO SAVEPOINT before_cleaning');
                await queryRunner.rollbackTransaction();
                
                Logger.error(`Error executing cleaning SQL for model ${dataModel.id}:`, executionError);
                
                return {
                    success: false,
                    rowsAffected: 0,
                    executionTimeMs: Date.now() - startTime,
                    dryRun,
                    error: `Execution failed: ${executionError.message}`,
                    rollbackAvailable: false
                };
            }

        } catch (error) {
            // Transaction start/setup error
            Logger.error(`Transaction setup error for model ${dataModel.id}:`, error);
            
            if (queryRunner.isTransactionActive) {
                await queryRunner.rollbackTransaction();
            }
            
            return {
                success: false,
                rowsAffected: 0,
                executionTimeMs: Date.now() - startTime,
                dryRun,
                error: `Transaction setup failed: ${error.message}`,
                rollbackAvailable: false
            };
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Capture state before SQL execution for dry-run comparison
     */
    private async captureBeforeState(
        queryRunner: any,
        sql: string,
        dataModel: DRADataModel
    ): Promise<any[]> {
        try {
            // Extract table name from SQL (simple heuristic)
            const tableMatch = sql.match(/FROM\s+"?(\w+)"?/i);
            if (!tableMatch) {
                return [];
            }

            const tableName = tableMatch[1];
            const fullyQualifiedTable = `"${dataModel.schema}"."${tableName}"`;

            // Get a sample of rows (limit 100 for performance)
            const result = await queryRunner.query(
                `SELECT * FROM ${fullyQualifiedTable} LIMIT 100`
            );

            return result;
        } catch (error) {
            Logger.warn('Could not capture before state:', error);
            return [];
        }
    }

    /**
     * Capture state after SQL execution for dry-run comparison
     */
    private async captureAfterState(
        queryRunner: any,
        sql: string,
        dataModel: DRADataModel
    ): Promise<any[]> {
        try {
            // Extract table name from SQL
            const tableMatch = sql.match(/FROM\s+"?(\w+)"?/i);
            if (!tableMatch) {
                return [];
            }

            const tableName = tableMatch[1];
            const fullyQualifiedTable = `"${dataModel.schema}"."${tableName}"`;

            // Get a sample of rows (limit 100 for performance)
            const result = await queryRunner.query(
                `SELECT * FROM ${fullyQualifiedTable} LIMIT 100`
            );

            return result;
        } catch (error) {
            Logger.warn('Could not capture after state:', error);
            return [];
        }
    }

    /**
     * Execute SQL with explicit transaction control
     */
    public async executeWithTransaction(
        sql: string,
        dataModel: DRADataModel
    ): Promise<IExecutionResult> {
        // Wrap SQL in explicit transaction if not already wrapped
        const wrappedSQL = this.ensureTransaction(sql);
        return this.executeCleaningSQL(dataModel, wrappedSQL, false);
    }

    /**
     * Ensure SQL is wrapped in transaction
     */
    private ensureTransaction(sql: string): string {
        const normalizedSQL = sql.trim().toUpperCase();
        
        if (normalizedSQL.startsWith('BEGIN') || normalizedSQL.startsWith('START TRANSACTION')) {
            return sql; // Already has transaction
        }

        return `BEGIN;\n\n${sql}\n\nCOMMIT;`;
    }

    /**
     * Estimate rows affected by SQL (before execution)
     */
    public async estimateRowsAffected(
        dataModel: DRADataModel,
        sql: string
    ): Promise<number> {
        try {
            const queryRunner = AppDataSource.createQueryRunner();
            await queryRunner.connect();

            try {
                // Convert UPDATE/DELETE to SELECT COUNT(*)
                let estimateSQL = sql;

                // Handle UPDATE
                if (sql.toUpperCase().includes('UPDATE')) {
                    const match = sql.match(/UPDATE\s+"?(\w+)"?\s+SET.*?(WHERE.*?)(;|$)/is);
                    if (match) {
                        const tableName = match[1];
                        const whereClause = match[2];
                        estimateSQL = `SELECT COUNT(*) FROM "${dataModel.schema}"."${tableName}" ${whereClause}`;
                    }
                }

                // Handle DELETE
                if (sql.toUpperCase().includes('DELETE FROM')) {
                    const match = sql.match(/DELETE\s+FROM\s+"?(\w+)"?(.*?WHERE.*?)(;|$)/is);
                    if (match) {
                        const tableName = match[1];
                        const whereClause = match[2];
                        estimateSQL = `SELECT COUNT(*) FROM "${dataModel.schema}"."${tableName}" ${whereClause}`;
                    }
                }

                const result = await queryRunner.query(estimateSQL);
                return parseInt(result[0].count) || 0;

            } finally {
                await queryRunner.release();
            }
        } catch (error) {
            Logger.error('Error estimating rows affected:', error);
            return 0;
        }
    }
}
