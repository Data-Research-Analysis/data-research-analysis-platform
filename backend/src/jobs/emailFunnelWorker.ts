import { EmailFunnelProcessor } from '../processors/EmailFunnelProcessor.js';

const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes
const DAILY_LIMIT_ENV = process.env.EMAIL_FUNNEL_DAILY_LIMIT || '200';

export class EmailFunnelWorker {
    private static instance: EmailFunnelWorker;
    private timer: ReturnType<typeof setInterval> | null = null;

    private constructor() {}

    public static getInstance(): EmailFunnelWorker {
        if (!EmailFunnelWorker.instance) {
            EmailFunnelWorker.instance = new EmailFunnelWorker();
        }
        return EmailFunnelWorker.instance;
    }

    public start(): void {
        console.log(`[EmailFunnelWorker] Starting — daily limit: ${DAILY_LIMIT_ENV}, poll interval: ${POLL_INTERVAL}ms`);

        // Run immediately on start, then every POLL_INTERVAL
        this.run().catch((err) => console.error('[EmailFunnelWorker] Initial run error:', err));

        this.timer = setInterval(() => {
            this.run().catch((err) => console.error('[EmailFunnelWorker] Poll error:', err));
        }, POLL_INTERVAL);
    }

    public stop(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        console.log('[EmailFunnelWorker] Stopped');
    }

    private async run(): Promise<void> {
        const processor = EmailFunnelProcessor.getInstance();
        let totalSent = 0;

        const funnelSent = await processor.processReadySteps();
        totalSent += funnelSent;

        const broadcastSent = await processor.processBroadcasts();
        totalSent += broadcastSent;

        if (totalSent > 0) {
            console.log(`[EmailFunnelWorker] Sent ${totalSent} email(s) (funnel: ${funnelSent}, broadcast: ${broadcastSent}) — daily total: ${processor.getDailySentCount()}/${processor.getDailyLimit()}`);
        }
    }
}
