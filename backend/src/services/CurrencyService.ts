/**
 * Resolves the exchange rate needed to normalize ad-platform spend and
 * revenue into USD. Ad platforms report monetary metrics in the ad account's
 * own currency (Google Ads: customer.currency_code), while the marketing
 * intelligence layer aggregates and displays everything in USD.
 */
export class CurrencyService {
    private static instance: CurrencyService;

    /** Rates are refreshed at most once per 12 hours. */
    private static readonly CACHE_TTL_MS = 12 * 60 * 60 * 1000;
    private static readonly API_BASE = 'https://open.er-api.com/v6/latest';

    private cache = new Map<string, { rate: number; fetchedAt: number }>();

    private constructor() { }

    public static getInstance(): CurrencyService {
        if (!CurrencyService.instance) {
            CurrencyService.instance = new CurrencyService();
        }
        return CurrencyService.instance;
    }

    /**
     * Multiplier that converts an amount in `currency` to USD.
     * Returns 1 for USD.
     */
    public async getUsdRate(currency?: string | null): Promise<number> {
        const code = (currency || 'USD').toUpperCase();
        if (code === 'USD') return 1;

        const override = this.getOverrideRate(code);
        if (override != null) return override;

        const cached = this.cache.get(code);
        if (cached && Date.now() - cached.fetchedAt < CurrencyService.CACHE_TTL_MS) {
            return cached.rate;
        }

        try {
            const rate = await this.fetchUsdRate(code);
            this.cache.set(code, { rate, fetchedAt: Date.now() });
            return rate;
        } catch (error: any) {
            if (cached) {
                console.warn(
                    `⚠️ Could not refresh ${code}->USD rate, using cached ${cached.rate}: ${error?.message || error}`,
                );
                return cached.rate;
            }
            throw error;
        }
    }

    /**
     * Convert an amount to USD and round to the given number of decimals.
     */
    public toUsd(amount: number, rate: number, decimals = 4): number {
        const factor = 10 ** decimals;
        return Math.round(amount * rate * factor) / factor;
    }

    /**
     * Optional deterministic override, e.g. USD_EXCHANGE_RATES={"PKR":0.0036}
     * Useful for tests and offline environments.
     */
    private getOverrideRate(code: string): number | null {
        const raw = process.env.USD_EXCHANGE_RATES;
        if (!raw) return null;
        try {
            const parsed = JSON.parse(raw) as Record<string, number>;
            const rate = Number(parsed[code]);
            return Number.isFinite(rate) && rate > 0 ? rate : null;
        } catch {
            return null;
        }
    }

    private async fetchUsdRate(code: string): Promise<number> {
        const response = await fetch(`${CurrencyService.API_BASE}/${encodeURIComponent(code)}`);
        if (!response.ok) {
            throw new Error(`Currency rate request failed (${response.status}) for ${code}`);
        }
        const data: any = await response.json();
        const rate = Number(data?.rates?.USD);
        if (!Number.isFinite(rate) || rate <= 0) {
            throw new Error(`No USD exchange rate available for ${code}`);
        }
        return rate;
    }
}
