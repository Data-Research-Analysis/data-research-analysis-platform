import { describe, it, expect, beforeEach } from '@jest/globals';
import { GoogleAdsService } from '../../services/GoogleAdsService.js';

/**
 * Unit tests for GoogleAdsService query building.
 *
 * The GAQL queries must only reference fields that exist in Google Ads API
 * v25; otherwise the whole report type fails and its table stays empty.
 */
describe('GoogleAdsService', () => {
    let service: GoogleAdsService;

    beforeEach(() => {
        service = GoogleAdsService.getInstance();
    });

    describe('getReportType', () => {
        it('maps the settings sync types', () => {
            expect(service.getReportType('campaigns')).toBe('campaigns');
            expect(service.getReportType('ad_groups')).toBe('ad_groups');
            expect(service.getReportType('ads')).toBe('ads');
        });

        it('maps legacy pre-v25 names to the new tables', () => {
            expect(service.getReportType('campaign')).toBe('campaigns');
            expect(service.getReportType('ad_group')).toBe('ad_group_insights');
            expect(service.getReportType('keyword')).toBe('keyword_insights');
            expect(service.getReportType('geo')).toBe('geographic_insights');
        });
    });

    describe('buildAdsQuery', () => {
        it('orders by a selectable ad field', () => {
            const query = service.buildAdsQuery();
            expect(query).toContain('ORDER BY ad_group_ad.ad.id');
            expect(query).not.toMatch(/ORDER BY ad_group_ad\.name/);
        });
    });

    describe('buildCampaignInsightsQuery', () => {
        it('uses v25 metric field names', () => {
            const query = service.buildCampaignInsightsQuery('2026-01-01', '2026-01-31');
            expect(query).toContain('metrics.cost_per_conversion');
            expect(query).toContain('metrics.trueview_average_cpv');
            expect(query).toContain('metrics.video_trueview_views');
            expect(query).toContain('metrics.video_trueview_view_rate');
            expect(query).not.toMatch(/metrics\.average_cpa\b/);
            expect(query).not.toMatch(/metrics\.average_cpv\b/);
            expect(query).not.toMatch(/metrics\.video_views\b/);
            expect(query).not.toMatch(/metrics\.video_view_rate\b/);
            expect(query).not.toMatch(/metrics\.reach\b/);
        });
    });

    describe('buildAdGroupInsightsQuery', () => {
        it('uses v25 metric field names', () => {
            const query = service.buildAdGroupInsightsQuery('2026-01-01', '2026-01-31');
            expect(query).toContain('metrics.cost_per_conversion');
            expect(query).toContain('metrics.video_trueview_views');
            expect(query).not.toMatch(/metrics\.average_cpa\b/);
            expect(query).not.toMatch(/metrics\.video_views\b/);
        });
    });

    describe('buildDeviceInsightsQuery', () => {
        it('uses the v25 video metric name', () => {
            const query = service.buildDeviceInsightsQuery('2026-01-01', '2026-01-31');
            expect(query).toContain('metrics.video_trueview_views');
            expect(query).not.toMatch(/metrics\.video_views\b/);
        });
    });

    describe('buildPlacementInsightsQuery', () => {
        it('does not combine segments.slot with active view metrics', () => {
            const query = service.buildPlacementInsightsQuery('2026-01-01', '2026-01-31');
            expect(query).toContain('segments.slot');
            expect(query).not.toContain('metrics.active_view_impressions');
            expect(query).not.toContain('metrics.active_view_viewability');
        });
    });
});
