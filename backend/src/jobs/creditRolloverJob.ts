import cron from 'node-cron';
import { getAppDataSource } from '../datasources/PostgresDS.js';
import { DRAOrganization } from '../models/DRAOrganization.js';
import { CreditWalletService } from '../services/CreditWalletService.js';
import { registerCronTask } from './cronRegistry.js';

/**
 * Cron Job: Monthly credit grant / rollover (implementation plan §5.5).
 *
 * Runs daily just after midnight UTC. `grantMonthly` is idempotent per UTC
 * month, so the first run of a new month grants the allowance for every org and
 * later runs are no-ops. This covers:
 *  - Free orgs (500 cr/month, non-rollover — unused monthly credits expire)
 *  - monthly Pro subscriptions whose Paddle renewal webhook may arrive later
 *  - annual Pro subscriptions, which only receive a webhook once a year
 *  - rollover plans (Pro), whose unused monthly credits carry over
 *
 * Pack credits are never expired by this job.
 */

export function startCreditRolloverJob(): void {
    if (!CreditWalletService.isEnabled()) {
        console.log('ℹ️  CREDITS_ENABLED is off — monthly credit grant job not scheduled');
        registerCronTask('credit-rollover', null, false);
        return;
    }
    console.log('📅 Initializing monthly credit grant cron job (runs daily at 00:15 UTC)');
    const task = cron.schedule('15 0 * * *', async () => {
        await runCreditRollover();
    });
    registerCronTask('credit-rollover', task, true);
    console.log('✅ Monthly credit grant cron job scheduled successfully');
}

/** One-time manual execution (testing / immediate processing). */
export async function runCreditRolloverNow(): Promise<{ granted: number; failed: number }> {
    return runCreditRollover();
}

async function runCreditRollover(): Promise<{ granted: number; failed: number }> {
    if (!CreditWalletService.isEnabled()) {
        return { granted: 0, failed: 0 };
    }

    console.log('🔄 Running monthly credit grant/rollover...');
    const startTime = Date.now();
    let granted = 0;
    let failed = 0;

    try {
        const dataSource = await getAppDataSource();
        const orgs = await dataSource.getRepository(DRAOrganization).find({
            select: ['id'],
            order: { id: 'ASC' },
        });
        const wallet = CreditWalletService.getInstance();

        for (const org of orgs) {
            try {
                const before = await wallet.getWallet(org.id);
                const balance = await wallet.grantMonthly(org.id);
                if (Number(balance) !== Number(before.balance_credits)) {
                    granted++;
                }
            } catch (error) {
                failed++;
                console.error(
                    `❌ Monthly credit grant failed for org ${org.id}:`,
                    (error as Error)?.message
                );
            }
        }

        const duration = Date.now() - startTime;
        console.log(
            `✅ Monthly credit grant complete: ${granted} granted, ${failed} failed, ${orgs.length} orgs (${duration}ms)`
        );
    } catch (error) {
        console.error('❌ Error in monthly credit grant job:', error);
    }

    return { granted, failed };
}
