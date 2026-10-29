import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { CurrencyService } from '../../services/CurrencyService.js';

describe('CurrencyService', () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
        delete process.env.USD_EXCHANGE_RATES;
    });

    afterEach(() => {
        delete process.env.USD_EXCHANGE_RATES;
        globalThis.fetch = originalFetch;
        jest.restoreAllMocks();
    });

    it('returns 1 for USD', async () => {
        expect(await CurrencyService.getInstance().getUsdRate('USD')).toBe(1);
        expect(await CurrencyService.getInstance().getUsdRate(null)).toBe(1);
    });

    it('uses the USD_EXCHANGE_RATES override', async () => {
        process.env.USD_EXCHANGE_RATES = JSON.stringify({ PKR: 0.0036 });
        expect(await CurrencyService.getInstance().getUsdRate('PKR')).toBe(0.0036);
        expect(await CurrencyService.getInstance().getUsdRate('pkr')).toBe(0.0036);
    });

    it('converts and rounds amounts', () => {
        const service = CurrencyService.getInstance();
        expect(service.toUsd(100000, 0.003611)).toBe(361.1);
        expect(service.toUsd(978, 0.003611)).toBe(3.5316);
    });

    it('fetches and caches a rate when no override exists', async () => {
        const fetchMock = jest.fn(async () => ({
            ok: true,
            json: async () => ({ result: 'success', rates: { USD: 0.25 } }),
        })) as any;
        globalThis.fetch = fetchMock;

        const first = await CurrencyService.getInstance().getUsdRate('ZZZ');
        const second = await CurrencyService.getInstance().getUsdRate('ZZZ');

        expect(first).toBe(0.25);
        expect(second).toBe(0.25);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('throws when the rate cannot be resolved', async () => {
        globalThis.fetch = (async () => ({ ok: false, status: 500, json: async () => ({}) })) as any;
        await expect(CurrencyService.getInstance().getUsdRate('YYY')).rejects.toThrow(
            /Currency rate request failed/,
        );
    });
});
