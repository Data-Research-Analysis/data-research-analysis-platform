import { describe, it, expect } from '@jest/globals';
import { GA4DateRangeService } from '../../services/GA4DateRangeService.js';

const NOW = new Date('2026-11-17T12:00:00Z'); // Tuesday

describe('GA4DateRangeService.resolvePreset', () => {
    it('resolves last_90_days ending yesterday', () => {
        expect(GA4DateRangeService.resolvePreset('last_90_days', 'UTC', NOW)).toEqual({
            start: '2026-08-19',
            end: '2026-11-16',
            preset: 'last_90_days',
        });
    });

    it('resolves yesterday', () => {
        expect(GA4DateRangeService.resolvePreset('yesterday', 'UTC', NOW)).toEqual({
            start: '2026-11-16',
            end: '2026-11-16',
            preset: 'yesterday',
        });
    });

    it('resolves last_7_days ending yesterday', () => {
        expect(GA4DateRangeService.resolvePreset('last_7_days', 'UTC', NOW)).toEqual({
            start: '2026-11-10',
            end: '2026-11-16',
            preset: 'last_7_days',
        });
    });

    it('resolves this_week starting Monday', () => {
        expect(GA4DateRangeService.resolvePreset('this_week', 'UTC', NOW)).toEqual({
            start: '2026-11-16',
            end: '2026-11-17',
            preset: 'this_week',
        });
    });

    it('resolves last_week Monday to Sunday', () => {
        expect(GA4DateRangeService.resolvePreset('last_week', 'UTC', NOW)).toEqual({
            start: '2026-11-09',
            end: '2026-11-15',
            preset: 'last_week',
        });
    });

    it('resolves last_week_sun_sat Sunday to Saturday', () => {
        // Tuesday Nov 17: this week's Sunday is Nov 15, so the previous
        // Sun-Sat week runs Nov 8 through Nov 14.
        expect(GA4DateRangeService.resolvePreset('last_week_sun_sat', 'UTC', NOW)).toEqual({
            start: '2026-11-08',
            end: '2026-11-14',
            preset: 'last_week_sun_sat',
        });
    });

    it('resolves this_month', () => {
        expect(GA4DateRangeService.resolvePreset('this_month', 'UTC', NOW)).toEqual({
            start: '2026-11-01',
            end: '2026-11-17',
            preset: 'this_month',
        });
    });

    it('resolves last_month to the full previous month', () => {
        expect(GA4DateRangeService.resolvePreset('last_month', 'UTC', NOW)).toEqual({
            start: '2026-10-01',
            end: '2026-10-31',
            preset: 'last_month',
        });
    });

    it('returns the custom range as provided', () => {
        expect(
            GA4DateRangeService.resolvePreset('custom', 'UTC', NOW, { start: '2026-01-01', end: '2026-02-01' }),
        ).toEqual({ start: '2026-01-01', end: '2026-02-01', preset: 'custom' });
    });

    it('computes today in the property timezone', () => {
        // 02:00 UTC on Nov 17 is 21:00 on Nov 16 in New York (EST).
        const range = GA4DateRangeService.resolvePreset(
            'today',
            'America/New_York',
            new Date('2026-11-17T02:00:00Z'),
        );
        expect(range).toEqual({ start: '2026-11-16', end: '2026-11-16', preset: 'today' });
    });
});

describe('GA4DateRangeService.resolveWindow', () => {
    it('uses explicit days when provided', () => {
        expect(GA4DateRangeService.resolveWindow('last_90_days', 30, 'UTC', NOW)).toEqual({
            start: '2026-10-19',
            end: '2026-11-17',
            preset: 'last_90_days',
        });
    });

    it('falls back to the preset when days are absent', () => {
        expect(GA4DateRangeService.resolveWindow('last_90_days', undefined, 'UTC', NOW).start).toBe('2026-08-19');
    });

    it('defaults to last_90_days', () => {
        expect(GA4DateRangeService.resolveWindow(undefined, undefined, 'UTC', NOW).preset).toBe('last_90_days');
    });
});

describe('GA4DateRangeService.presetList', () => {
    it('exposes the required presets', () => {
        const keys = GA4DateRangeService.presetList().map(p => p.key);
        expect(keys).toEqual([
            'last_365_days',
            'last_90_days',
            'last_month',
            'this_month',
            'last_week',
            'last_week_sun_sat',
            'last_7_days',
            'this_week',
            'yesterday',
            'today',
            'custom',
        ]);
    });
});
