import cron from 'node-cron';
import { AppDataSource } from '../datasources/PostgresDS.js';
import { DataModelHealthService } from '../services/DataModelHealthService.js';

/**
 * Cron Job: Nightly Data Model Health Re-analysis
 *
 * Iterates over every data model in the platform and re-runs
 * DataModelHealthService.recomputeAndPersist() so the persisted
 * health_status, health_issues, and source_row_count stay accurate even
 * when source table row counts change between user-triggered saves.
 *
 * Schedule: '0 2 * * *' = 02:00 UTC every night (low-traffic window).
 *
 * To disable: set env HEALTH_REANALYSIS_ENABLED=false
 */
export function startDataModelHealthReanalysisJob(): void {
    const enabled = process.env.HEALTH_REANALYSIS_ENABLED !== 'false';
    if (!enabled) {
        console.log('⏭️  Data model health re-analysis job is disabled (HEALTH_REANALYSIS_ENABLED=false)');
        return;
    }

    console.log('📅 Initialising nightly data model health re-analysis job (runs at 02:00 UTC)');

    cron.schedule('0 2 * * *', async () => {
        await runDataModelHealthReanalysis();
    });

    console.log('✅ Data model health re-analysis cron job scheduled');
}

/**
 * Reanalyse all data models. Exported for manual/admin-triggered execution.
 */
export async function runDataModelHealthReanalysis(): Promise<{
    total: number;
    updated: number;
    failed: number;
}> {
    console.log('⏰ Starting nightly data model health re-analysis...');
    const startTime = Date.now();

    const manager = AppDataSource.manager;
    const healthService = DataModelHealthService.getInstance();

    // Fetch all model IDs — process in small batches to avoid memory pressure
    const models: { id: number }[] = await manager.query(
        `SELECT id FROM dra_data_models ORDER BY id ASC`
    );

    let updated = 0;
    let failed = 0;

    for (const model of models) {
        try {
            await healthService.recomputeAndPersist(model.id);
            updated++;
        } catch (error: any) {
            failed++;
            console.error(`❌ [HealthReanalysis] Failed for model #${model.id}: ${error.message}`);
        }
    }

    const durationMs = Date.now() - startTime;
    console.log(
        `✅ Data model health re-analysis complete: ${updated}/${models.length} updated, ` +
        `${failed} failed (${Math.round(durationMs / 1000)}s)`
    );

    return { total: models.length, updated, failed };
}
