/**
 * Custom error class for insufficient credit balance.
 * Mirrors TierLimitError — returns a 402 Payment Required response with
 * balance/required and a path to buy credits.
 */
export class CreditInsufficientError extends Error {
    public readonly actionKey: string;
    public readonly required: number;
    public readonly balance: number;

    constructor(actionKey: string, required: number, balance: number) {
        super(
            `Not enough credits: ${required} required for "${actionKey}", ${balance} available. ` +
                `Buy a credit pack or increase your monthly credits.`
        );
        this.name = 'CreditInsufficientError';
        this.actionKey = actionKey;
        this.required = required;
        this.balance = balance;
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, CreditInsufficientError);
        }
    }

    toJSON() {
        return {
            error: 'CREDIT_INSUFFICIENT',
            message: this.message,
            actionKey: this.actionKey,
            required: this.required,
            balance: this.balance,
            upgradeUrl: '/billing',
        };
    }
}
