import { describe, it, expect } from '@jest/globals';
import { FunnelAutoBuilderService } from '../../services/FunnelAutoBuilderService.js';
import { GA4AttributionService } from '../../services/GA4AttributionService.js';

/**
 * Unit tests for the P1 auto-funnel definitions and blended ROI channel mapping.
 * These exercise the pure helpers (no DB access).
 */
describe('FunnelAutoBuilderService.buildAutoFunnelDefinitions', () => {
    it('builds all three auto funnels when GA and ads are available', () => {
        const defs = FunnelAutoBuilderService.buildAutoFunnelDefinitions({
            hasSessionAttribution: true,
            hasUserAcquisition: true,
            hasAds: true,
        });

        expect(defs.map(d => d.autoKey)).toEqual([
            'ga4_site_acquisition',
            'ga4_first_touch',
            'ga4_paid_to_site',
        ]);

        const paid = defs.find(d => d.autoKey === 'ga4_paid_to_site')!;
        expect(paid.source).toBe('blended');
        expect(paid.steps.map(s => s.metric)).toEqual([
            'impressions',
            'clicks',
            'sessions',
            'engaged_sessions',
            'key_event_sessions',
        ]);
        expect(paid.steps[paid.steps.length - 1].name).toBe('Sessions with Key Events');
        expect(paid.steps.every(s => s.type === 'stage')).toBe(true);
    });

    it('uses session-level key event stages instead of raw conversion counts', () => {
        const defs = FunnelAutoBuilderService.buildAutoFunnelDefinitions({
            hasSessionAttribution: true,
            hasUserAcquisition: true,
            hasAds: false,
        });

        const site = defs.find(d => d.autoKey === 'ga4_site_acquisition')!;
        expect(site.steps.map(s => s.metric)).toEqual(['sessions', 'engaged_sessions', 'key_event_sessions']);
        expect(site.steps.map(s => s.name)).toEqual(['Sessions', 'Engaged Sessions', 'Sessions with Key Events']);

        const firstTouch = defs.find(d => d.autoKey === 'ga4_first_touch')!;
        expect(firstTouch.steps.map(s => s.metric)).toEqual(['new_users', 'sessions', 'key_event_sessions']);
    });

    it('omits paid_to_site when no ads source is present', () => {
        const defs = FunnelAutoBuilderService.buildAutoFunnelDefinitions({
            hasSessionAttribution: true,
            hasUserAcquisition: true,
            hasAds: false,
        });

        expect(defs.map(d => d.autoKey)).toEqual(['ga4_site_acquisition', 'ga4_first_touch']);
    });

    it('omits funnels when the required GA tables are absent', () => {
        const defs = FunnelAutoBuilderService.buildAutoFunnelDefinitions({
            hasSessionAttribution: false,
            hasUserAcquisition: false,
            hasAds: true,
        });

        expect(defs).toEqual([]);
    });

    it('marks stage steps with source and metric', () => {
        const defs = FunnelAutoBuilderService.buildAutoFunnelDefinitions({
            hasSessionAttribution: true,
            hasUserAcquisition: false,
            hasAds: false,
        });

        const site = defs[0];
        expect(site.autoKey).toBe('ga4_site_acquisition');
        expect(site.steps[0]).toMatchObject({
            type: 'stage',
            source: 'google_analytics',
            metric: 'sessions',
            aggregation: 'sum',
        });
    });

    it('builds only the first-touch funnel when only user_acquisition exists', () => {
        const defs = FunnelAutoBuilderService.buildAutoFunnelDefinitions({
            hasSessionAttribution: false,
            hasUserAcquisition: true,
            hasAds: true,
        });

        expect(defs.map(d => d.autoKey)).toEqual(['ga4_first_touch']);
    });

    it('adds the user-journey funnel when BigQuery sessions are available', () => {
        const defs = FunnelAutoBuilderService.buildAutoFunnelDefinitions({
            hasSessionAttribution: true,
            hasUserAcquisition: true,
            hasAds: true,
            hasBigQuery: true,
        });

        const journey = defs.find(d => d.autoKey === 'ga4_user_journey');
        expect(journey).toBeDefined();
        expect(journey!.source).toBe('google_analytics_bigquery');
        expect(journey!.steps.map(s => s.metric)).toEqual([
            'sessions_first',
            'sessions_return',
            'conversion_sessions',
        ]);
    });
});

describe('GA4AttributionService.mapChannelGroupToPlatform', () => {
    const platforms = new Set(['google_ads', 'meta_ads']);

    it('maps paid search and display to Google Ads', () => {
        expect(GA4AttributionService.mapChannelGroupToPlatform('Paid Search', platforms)).toBe('google_ads');
        expect(GA4AttributionService.mapChannelGroupToPlatform('Display', platforms)).toBe('google_ads');
        expect(GA4AttributionService.mapChannelGroupToPlatform('Paid Shopping', platforms)).toBe('google_ads');
    });

    it('maps paid social to Meta when available, else LinkedIn', () => {
        expect(GA4AttributionService.mapChannelGroupToPlatform('Paid Social', platforms)).toBe('meta_ads');
        expect(
            GA4AttributionService.mapChannelGroupToPlatform('Paid Social', new Set(['google_ads', 'linkedin_ads'])),
        ).toBe('linkedin_ads');
    });

    it('maps paid video to Google Ads when available', () => {
        expect(GA4AttributionService.mapChannelGroupToPlatform('Paid Video', platforms)).toBe('google_ads');
    });

    it('returns null for organic, direct and unknown channels', () => {
        expect(GA4AttributionService.mapChannelGroupToPlatform('Organic Search', platforms)).toBeNull();
        expect(GA4AttributionService.mapChannelGroupToPlatform('Direct', platforms)).toBeNull();
        expect(GA4AttributionService.mapChannelGroupToPlatform('Email', platforms)).toBeNull();
    });
});
