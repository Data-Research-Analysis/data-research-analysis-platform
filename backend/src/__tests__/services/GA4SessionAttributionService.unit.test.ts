import { describe, it, expect } from '@jest/globals';
import { GA4SessionAttributionService } from '../../services/GA4SessionAttributionService.js';

describe('GA4SessionAttributionService.channelLabel', () => {
    it('prefers the campaign name when present', () => {
        expect(GA4SessionAttributionService.channelLabel('google', 'cpc', 'Spring Sale')).toBe('Spring Sale');
    });

    it('falls back to source / medium when the campaign is not set', () => {
        expect(GA4SessionAttributionService.channelLabel('google', 'cpc', '(not set)')).toBe('google / cpc');
        expect(GA4SessionAttributionService.channelLabel('', '', '')).toBe('(not set) / (not set)');
    });
});

describe('GA4SessionAttributionService.modelLabel', () => {
    it('labels all six models', () => {
        expect(GA4SessionAttributionService.modelLabel('first_touch')).toBe('First Touch');
        expect(GA4SessionAttributionService.modelLabel('last_touch')).toBe('Last Touch');
        expect(GA4SessionAttributionService.modelLabel('linear')).toBe('Linear');
        expect(GA4SessionAttributionService.modelLabel('time_decay')).toBe('Time Decay');
        expect(GA4SessionAttributionService.modelLabel('u_shaped')).toBe('Position Based (U-Shaped)');
        expect(GA4SessionAttributionService.modelLabel('data_driven')).toBe('Data Driven (Shapley)');
    });
});
