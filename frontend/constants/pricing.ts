/**
 * Single source of truth for credit pricing shown in the UI.
 *
 * Keep this in sync with the Paddle recurring prices and the backend tier
 * seeder (`backend/src/seeders/06-20260108-SubscriptionTierSeeder.ts`).
 */

export type BillingCycle = 'monthly' | 'annual';

/** Selectable monthly credit volumes for the Pro plan. */
export const CREDIT_DIALS = [5000, 10000, 25000, 50000, 100000] as const;

/** Monthly rate per 1,000 credits when billed monthly. */
export const CREDIT_RATE_MONTHLY_PER_1000 = 9.8;

/** Monthly-equivalent rate per 1,000 credits when billed annually ($94.80/yr). */
export const CREDIT_RATE_ANNUAL_PER_1000 = 7.9;

/** Free plan: recurring monthly allowance. */
export const FREE_MONTHLY_CREDITS = 500;

/** Free plan: one-time onboarding bonus added in month one. */
export const FREE_ONBOARDING_CREDITS = 500;

/** One-off credit packs (available on Pro). */
export const CREDIT_PACKS = [
    { credits: 1000, price: 9 },
    { credits: 5000, price: 40 },
    { credits: 10000, price: 70 },
] as const;

export function formatCredits(value: number): string {
    return new Intl.NumberFormat('en-US').format(value);
}

/** Formats a price without trailing zeros but with two decimals when fractional. */
export function formatPrice(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/** Pro price per month for a credit volume and billing cycle. */
export function proPriceFor(credits: number, cycle: BillingCycle): number {
    const units = credits / 1000;
    const rate = cycle === 'annual' ? CREDIT_RATE_ANNUAL_PER_1000 : CREDIT_RATE_MONTHLY_PER_1000;
    return Math.round(units * rate * 100) / 100;
}

/** Total charged per year on annual billing for a credit volume. */
export function proAnnualTotal(credits: number): number {
    const units = credits / 1000;
    return Math.round(units * CREDIT_RATE_ANNUAL_PER_1000 * 12 * 100) / 100;
}

/** Smallest Pro dial that covers a monthly credit estimate. */
export function suggestedDialFor(credits: number): number {
    return CREDIT_DIALS.find((dial) => dial >= credits) ?? CREDIT_DIALS[CREDIT_DIALS.length - 1];
}
