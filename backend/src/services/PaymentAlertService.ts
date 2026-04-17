import { getRedisClient } from '../config/redis.config.js';
import { EmailService } from './EmailService.js';

/**
 * PaymentAlertService — Rate-limited admin notifications for critical payment events.
 *
 * Motivations:
 * - Avoid alert storms when Paddle repeatedly retries a failed payment
 * - Give ops teams early warning of systemic issues (many orgs failing simultaneously)
 * - Provide a single audit trail of what alerts were suppressed / sent
 *
 * Rate limiting strategy (Redis):
 * - One ALERT_TYPE:ORG_ID alert at most once per `cooldownSeconds` window
 * - Global de-dup key per event type prevents spam during Paddle webhook replays
 *
 * Configuration:
 * - PAYMENT_ALERT_EMAIL — recipient for all admin alerts (required; omit to disable)
 * - PAYMENT_ALERT_COOLDOWN_SECONDS — per-org cooldown (default 3600 = 1 hr)
 */
export type PaymentAlertType =
    | 'payment_failed'
    | 'grace_period_started'
    | 'grace_period_expired'
    | 'subscription_cancelled'
    | 'payment_disputed'
    | 'high_failure_rate';

export class PaymentAlertService {
    private static instance: PaymentAlertService;
    private redis = getRedisClient();

    private readonly alertEmail: string | undefined = process.env.PAYMENT_ALERT_EMAIL;
    private readonly cooldownSeconds: number = parseInt(process.env.PAYMENT_ALERT_COOLDOWN_SECONDS ?? '3600', 10);

    private constructor() {}

    public static getInstance(): PaymentAlertService {
        if (!PaymentAlertService.instance) {
            PaymentAlertService.instance = new PaymentAlertService();
        }
        return PaymentAlertService.instance;
    }

    // ------------------------------------------------------------------ Public API

    /**
     * Send a per-organisation alert (once per cooldown window per org+type combination).
     */
    async alertOrg(
        type: PaymentAlertType,
        organizationId: number,
        details: Record<string, string | number | null | undefined>
    ): Promise<void> {
        if (!this.alertEmail) return; // alerting not configured

        const dedupKey = `payment_alert:${type}:org:${organizationId}`;
        if (await this.isDuplicate(dedupKey)) {
            console.log(`[PaymentAlert] Suppressed duplicate ${type} alert for org ${organizationId} (within cooldown)`);
            return;
        }

        const subject = this.buildSubject(type, organizationId);
        const text    = this.buildBody(type, organizationId, details);

        await this.send(subject, text);
        await this.markSent(dedupKey);
    }

    /**
     * Send a global alert (not tied to a specific org — e.g. high overall failure rate).
     */
    async alertGlobal(
        type: PaymentAlertType,
        details: Record<string, string | number | null | undefined>
    ): Promise<void> {
        if (!this.alertEmail) return;

        const dedupKey = `payment_alert:${type}:global`;
        if (await this.isDuplicate(dedupKey)) {
            console.log(`[PaymentAlert] Suppressed duplicate global ${type} alert (within cooldown)`);
            return;
        }

        const subject = `[DRA Global Alert] ${type.replace(/_/g, ' ').toUpperCase()}`;
        const text    = this.buildBody(type, null, details);

        await this.send(subject, text);
        await this.markSent(dedupKey);
    }

    // ------------------------------------------------------------------ Helpers

    private async isDuplicate(key: string): Promise<boolean> {
        try {
            const val = await this.redis.get(key);
            return val !== null;
        } catch (err) {
            console.warn('[PaymentAlert] Redis check failed (allowing alert through):', err);
            return false; // fail-open: let the alert send if Redis is down
        }
    }

    private async markSent(key: string): Promise<void> {
        try {
            await this.redis.setex(key, this.cooldownSeconds, '1');
        } catch (err) {
            console.warn('[PaymentAlert] Failed to mark alert as sent in Redis (non-fatal):', err);
        }
    }

    private async send(subject: string, text: string): Promise<void> {
        try {
            await EmailService.getInstance().sendEmailImmediately({
                to: this.alertEmail!,
                subject,
                text,
                html: `<pre style="font-family:monospace;font-size:13px">${text}</pre>`,
            });
            console.log(`[PaymentAlert] ✅ Sent alert: ${subject}`);
        } catch (err) {
            console.error(`[PaymentAlert] ❌ Failed to send alert "${subject}":`, err);
        }
    }

    private buildSubject(type: PaymentAlertType, organizationId: number): string {
        const labels: Record<PaymentAlertType, string> = {
            payment_failed:         'Payment Failed',
            grace_period_started:   'Grace Period Started',
            grace_period_expired:   'Grace Period Expired — Subscription Suspended',
            subscription_cancelled: 'Subscription Cancelled',
            payment_disputed:       'Payment Disputed',
            high_failure_rate:      'High Payment Failure Rate Detected',
        };
        return `[DRA] ${labels[type] ?? type} — Org #${organizationId}`;
    }

    private buildBody(
        type: PaymentAlertType,
        organizationId: number | null,
        details: Record<string, string | number | null | undefined>
    ): string {
        const lines: string[] = [
            `Alert Type : ${type}`,
            `Org ID     : ${organizationId ?? 'N/A'}`,
            `Timestamp  : ${new Date().toISOString()}`,
            '',
            'Details:',
            ...Object.entries(details).map(([k, v]) => `  ${k}: ${v ?? 'N/A'}`),
            '',
            'This is an automated alert from the DRA payment system.',
            `Cooldown: next duplicate alert for this event suppressed for ${this.cooldownSeconds}s.`,
        ];
        return lines.join('\n');
    }
}
