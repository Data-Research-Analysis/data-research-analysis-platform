import { describe, it, expect } from '@jest/globals';
import { FunnelMatcherService } from '../../services/FunnelMatcherService.js';

/**
 * Unit tests for the pure GA4 attribution helpers (no DB access).
 */
describe('FunnelMatcherService.toDateStr', () => {
    it('normalizes a JS Date to YYYY-MM-DD', () => {
        expect(FunnelMatcherService.toDateStr(new Date('2026-11-20T15:30:00Z'))).toBe('2026-11-20');
    });

    it('passes through an ISO string', () => {
        expect(FunnelMatcherService.toDateStr('2026-11-20')).toBe('2026-11-20');
    });

    it('returns empty string for nullish values', () => {
        expect(FunnelMatcherService.toDateStr(null)).toBe('');
        expect(FunnelMatcherService.toDateStr(undefined)).toBe('');
        expect(FunnelMatcherService.toDateStr('')).toBe('');
    });

    it('returns empty string for an invalid date', () => {
        expect(FunnelMatcherService.toDateStr(new Date('invalid'))).toBe('');
    });
});
