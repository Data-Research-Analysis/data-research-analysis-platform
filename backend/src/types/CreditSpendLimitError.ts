import { CreditInsufficientError } from './CreditInsufficientError.js';

/**
 * Thrown when a workspace monthly spend cap or a per-member limit would be
 * exceeded. Extends CreditInsufficientError so every existing 402 handler
 * treats it as a hard stop, while the payload keeps a distinct error code.
 */
export class CreditSpendLimitError extends CreditInsufficientError {
    public readonly scope: 'workspace' | 'member';
    public readonly limit: number;
    public readonly used: number;

    constructor(
        scope: 'workspace' | 'member',
        limit: number,
        used: number,
        required: number
    ) {
        super(
            scope === 'member' ? 'member_spend_limit' : 'workspace_spend_limit',
            required,
            Math.max(0, limit - used)
        );
        this.name = 'CreditSpendLimitError';
        this.scope = scope;
        this.limit = limit;
        this.used = used;
        this.message =
            scope === 'member'
                ? `Monthly member credit limit reached: ${used} of ${limit} used, ${required} required.`
                : `Monthly workspace spend cap reached: ${used} of ${limit} used, ${required} required.`;
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, CreditSpendLimitError);
        }
    }

    toJSON(): any {
        return {
            error: 'CREDIT_SPEND_CAP',
            message: this.message,
            scope: this.scope,
            limit: this.limit,
            used: this.used,
            required: this.required,
            upgradeUrl: '/billing',
        };
    }
}
