import { AppDataSource } from '../datasources/PostgresDS.js';
import { IExecutionResult, ICleaningHistory } from '../interfaces/IDataQuality.js';

/**
 * Data Quality History Service
 * Records and retrieves cleaning operation history
 * Part of Phase 1: Data Quality & Marketing Attribution Engine
 */
export class DataQualityHistoryService {
    private static instance: DataQualityHistoryService;

    private constructor() {}

    public static getInstance(): DataQualityHistoryService {
        if (!DataQualityHistoryService.instance) {
            DataQualityHistoryService.instance = new DataQualityHistoryService();
        }
        return DataQualityHistoryService.instance;
    }

    /**
     * Log cleaning operation execution
     */
    public async logExecution(
        dataModelId: number,
        userId: number,
        cleaningType: string,
        affectedColumns: string[],
        configuration: any,
        executionResult: IExecutionResult
    ): Promise<ICleaningHistory> {
        try {
            console.log(
                `Logging cleaning execution for data model ${dataModelId}, type: ${cleaningType}`
            );

            const queryRunner = AppDataSource.createQueryRunner();
            await queryRunner.connect();

            try {
                const status = executionResult.success ? 'completed' : 'failed';
                const errorMessage = executionResult.error || null;

                const result = await queryRunner.query(
                    `INSERT INTO "dra_data_cleaning_history" (
                        data_model_id,
                        user_id,
                        cleaning_type,
                        affected_columns,
                        rows_affected,
                        configuration,
                        status,
                        error_message,
                        execution_time_ms,
                        created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
                    RETURNING *`,
                    [
                        dataModelId,
                        userId,
                        cleaningType,
                        affectedColumns,
                        executionResult.rowsAffected,
                        JSON.stringify(configuration),
                        status,
                        errorMessage,
                        executionResult.executionTimeMs
                    ]
                );

                const historyRecord: ICleaningHistory = {
                    id: result[0].id,
                    dataModelId: result[0].data_model_id,
                    userId: result[0].user_id,
                    cleaningType: result[0].cleaning_type,
                    affectedColumns: result[0].affected_columns,
                    rowsAffected: result[0].rows_affected,
                    configuration: result[0].configuration,
                    status: result[0].status,
                    errorMessage: result[0].error_message,
                    executionTimeMs: result[0].execution_time_ms,
                    createdAt: result[0].created_at
                };

                console.log(
                    `Successfully logged cleaning execution (ID: ${historyRecord.id}) ` +
                    `for data model ${dataModelId}`
                );

                return historyRecord;

            } finally {
                await queryRunner.release();
            }
        } catch (error) {
            console.error('Error logging cleaning execution:', error);
            throw new Error(`Failed to log cleaning execution: ${error.message}`);
        }
    }

    /**
     * Get cleaning history for a data model
     */
    public async getHistory(
        dataModelId: number,
        limit: number = 50,
        offset: number = 0
    ): Promise<{ history: ICleaningHistory[]; total: number }> {
        try {
            const queryRunner = AppDataSource.createQueryRunner();
            await queryRunner.connect();

            try {
                // Get total count
                const countResult = await queryRunner.query(
                    `SELECT COUNT(*) as total
                     FROM "dra_data_cleaning_history"
                     WHERE data_model_id = $1`,
                    [dataModelId]
                );
                const total = parseInt(countResult[0].total);

                // Get history records
                const results = await queryRunner.query(
                    `SELECT *
                     FROM "dra_data_cleaning_history"
                     WHERE data_model_id = $1
                     ORDER BY created_at DESC
                     LIMIT $2 OFFSET $3`,
                    [dataModelId, limit, offset]
                );

                const history: ICleaningHistory[] = results.map((row: any) => ({
                    id: row.id,
                    dataModelId: row.data_model_id,
                    userId: row.user_id,
                    cleaningType: row.cleaning_type,
                    affectedColumns: row.affected_columns,
                    rowsAffected: row.rows_affected,
                    configuration: row.configuration,
                    status: row.status,
                    errorMessage: row.error_message,
                    executionTimeMs: row.execution_time_ms,
                    createdAt: row.created_at
                }));

                return { history, total };

            } finally {
                await queryRunner.release();
            }
        } catch (error) {
            console.error(`Error fetching cleaning history for model ${dataModelId}:`, error);
            throw new Error(`Failed to fetch cleaning history: ${error.message}`);
        }
    }

    /**
     * Get history for a specific user
     */
    public async getHistoryByUser(
        userId: number,
        limit: number = 50,
        offset: number = 0
    ): Promise<{ history: ICleaningHistory[]; total: number }> {
        try {
            const queryRunner = AppDataSource.createQueryRunner();
            await queryRunner.connect();

            try {
                // Get total count
                const countResult = await queryRunner.query(
                    `SELECT COUNT(*) as total
                     FROM "dra_data_cleaning_history"
                     WHERE user_id = $1`,
                    [userId]
                );
                const total = parseInt(countResult[0].total);

                // Get history records
                const results = await queryRunner.query(
                    `SELECT *
                     FROM "dra_data_cleaning_history"
                     WHERE user_id = $1
                     ORDER BY created_at DESC
                     LIMIT $2 OFFSET $3`,
                    [userId, limit, offset]
                );

                const history: ICleaningHistory[] = results.map((row: any) => ({
                    id: row.id,
                    dataModelId: row.data_model_id,
                    userId: row.user_id,
                    cleaningType: row.cleaning_type,
                    affectedColumns: row.affected_columns,
                    rowsAffected: row.rows_affected,
                    configuration: row.configuration,
                    status: row.status,
                    errorMessage: row.error_message,
                    executionTimeMs: row.execution_time_ms,
                    createdAt: row.created_at
                }));

                return { history, total };

            } finally {
                await queryRunner.release();
            }
        } catch (error) {
            console.error(`Error fetching cleaning history for user ${userId}:`, error);
            throw new Error(`Failed to fetch cleaning history: ${error.message}`);
        }
    }

    /**
     * Get recent cleaning operations across all data models
     */
    public async getRecentOperations(
        limit: number = 20
    ): Promise<ICleaningHistory[]> {
        try {
            const queryRunner = AppDataSource.createQueryRunner();
            await queryRunner.connect();

            try {
                const results = await queryRunner.query(
                    `SELECT *
                     FROM "dra_data_cleaning_history"
                     ORDER BY created_at DESC
                     LIMIT $1`,
                    [limit]
                );

                const history: ICleaningHistory[] = results.map((row: any) => ({
                    id: row.id,
                    dataModelId: row.data_model_id,
                    userId: row.user_id,
                    cleaningType: row.cleaning_type,
                    affectedColumns: row.affected_columns,
                    rowsAffected: row.rows_affected,
                    configuration: row.configuration,
                    status: row.status,
                    errorMessage: row.error_message,
                    executionTimeMs: row.execution_time_ms,
                    createdAt: row.created_at
                }));

                return history;

            } finally {
                await queryRunner.release();
            }
        } catch (error) {
            console.error('Error fetching recent cleaning operations:', error);
            throw new Error(`Failed to fetch recent operations: ${error.message}`);
        }
    }

    /**
     * Get statistics about cleaning operations
     */
    public async getStatistics(dataModelId: number): Promise<{
        totalOperations: number;
        successfulOperations: number;
        failedOperations: number;
        totalRowsAffected: number;
        averageExecutionTime: number;
        mostCommonType: string;
    }> {
        try {
            const queryRunner = AppDataSource.createQueryRunner();
            await queryRunner.connect();

            try {
                const result = await queryRunner.query(
                    `SELECT 
                        COUNT(*) as total_operations,
                        COUNT(*) FILTER (WHERE status = 'completed') as successful_operations,
                        COUNT(*) FILTER (WHERE status = 'failed') as failed_operations,
                        COALESCE(SUM(rows_affected), 0) as total_rows_affected,
                        COALESCE(AVG(execution_time_ms), 0) as average_execution_time,
                        MODE() WITHIN GROUP (ORDER BY cleaning_type) as most_common_type
                     FROM "dra_data_cleaning_history"
                     WHERE data_model_id = $1`,
                    [dataModelId]
                );

                return {
                    totalOperations: parseInt(result[0].total_operations),
                    successfulOperations: parseInt(result[0].successful_operations),
                    failedOperations: parseInt(result[0].failed_operations),
                    totalRowsAffected: parseInt(result[0].total_rows_affected),
                    averageExecutionTime: Math.round(parseFloat(result[0].average_execution_time)),
                    mostCommonType: result[0].most_common_type || 'unknown'
                };

            } finally {
                await queryRunner.release();
            }
        } catch (error) {
            console.error(`Error fetching statistics for model ${dataModelId}:`, error);
            throw new Error(`Failed to fetch statistics: ${error.message}`);
        }
    }

    /**
     * Mark operation as rolled back
     */
    public async markAsRolledBack(historyId: number): Promise<void> {
        try {
            const queryRunner = AppDataSource.createQueryRunner();
            await queryRunner.connect();

            try {
                await queryRunner.query(
                    `UPDATE "dra_data_cleaning_history"
                     SET status = 'rolled_back'
                     WHERE id = $1`,
                    [historyId]
                );

                console.log(`Marked cleaning history ${historyId} as rolled back`);

            } finally {
                await queryRunner.release();
            }
        } catch (error) {
            console.error(`Error marking history ${historyId} as rolled back:`, error);
            throw new Error(`Failed to update history: ${error.message}`);
        }
    }
}
