import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.unstable_mockModule('googleapis', () => ({
    google: {
        analyticsdata: jest.fn(),
        analyticsadmin: jest.fn(),
        auth: { OAuth2: jest.fn() },
    },
}));

jest.unstable_mockModule('../../services/GoogleOAuthService.js', () => ({
    GoogleOAuthService: {
        getInstance: jest.fn(() => ({
            getAuthenticatedClient: jest.fn(() => ({})),
        })),
    },
}));

const { GoogleAnalyticsService } = await import('../../services/GoogleAnalyticsService.js');
const { GoogleAnalyticsDriver } = await import('../../drivers/GoogleAnalyticsDriver.js');
const { google } = await import('googleapis');
const { GA4_REPORT_TYPES } = await import('../../types/IGoogleAnalytics.js');

const mockedAnalyticsData = google.analyticsdata as unknown as jest.Mock;

/**
 * Unit tests for the Google Analytics 4 sync implementation.
 * Focuses on the regression that crashed production (invalid GA4 dimension
 * name), report preset validity, pagination, and row transforms.
 */
describe('GoogleAnalyticsService', () => {
    const service = GoogleAnalyticsService.getInstance();
    const connectionDetails: any = {
        oauth_access_token: 'access',
        oauth_refresh_token: 'refresh',
        token_expiry: new Date(),
        api_config: { property_id: 'properties/123' },
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getReportPresets', () => {
        it('should cover every declared report type with non-empty dimensions and metrics', () => {
            const presets = GoogleAnalyticsService.getReportPresets();
            const keys = Object.keys(presets);

            expect(keys).toEqual([...GA4_REPORT_TYPES]);
            for (const key of GA4_REPORT_TYPES) {
                const preset = presets[key];
                expect(preset.logicalTableName).toBe(key);
                expect(preset.dimensions.length).toBeGreaterThan(0);
                expect(preset.metrics.length).toBeGreaterThan(0);
                expect(preset.dateRangeDays).toBeGreaterThan(0);
            }
        });

        it('must not request the invalid firstUserGoogleAdsClickId dimension', () => {
            const presets = GoogleAnalyticsService.getReportPresets();
            const allDimensions = Object.values(presets).flatMap(p => p.dimensions);
            expect(allDimensions).not.toContain('firstUserGoogleAdsClickId');
        });

        it('should expose the Google Ads click ID via the session-scoped dimension', () => {
            const presets = GoogleAnalyticsService.getReportPresets();
            const attribution = presets.session_attribution;
            expect(attribution.dimensions).toContain('sessionGoogleAdsClickId');
        });

        it('should include full UTM attribution fields', () => {
            const presets = GoogleAnalyticsService.getReportPresets();
            expect(presets.traffic_overview.dimensions).toEqual(
                expect.arrayContaining(['sessionSource', 'sessionMedium', 'sessionCampaignId', 'sessionCampaignName', 'sessionDefaultChannelGroup'])
            );
            expect(presets.user_acquisition.dimensions).toEqual(
                expect.arrayContaining(['firstUserSource', 'firstUserMedium', 'firstUserCampaignId', 'firstUserCampaignName', 'firstUserGoogleAdsCampaignId', 'firstUserGoogleAdsCampaignName', 'firstUserDefaultChannelGroup'])
            );
            expect(presets.session_attribution.dimensions).toEqual(
                expect.arrayContaining(['sessionManualTerm', 'sessionManualAdContent', 'sessionGoogleAdsCampaignId', 'sessionGoogleAdsCampaignName', 'sessionGoogleAdsClickId'])
            );
        });

        it('should preserve the logical table names consumed by the platform', () => {
            const presets = GoogleAnalyticsService.getReportPresets();
            expect(presets.traffic_overview.logicalTableName).toBe('traffic_overview');
            expect(presets.user_acquisition.logicalTableName).toBe('user_acquisition');
        });
    });

    describe('runReport', () => {
        it('should merge rows across pages using the nextPageToken', async () => {
            const page1 = {
                data: {
                    rows: [{ dimensionValues: [{ value: '20261101' }], metricValues: [{ value: '10' }] }],
                    dimensionHeaders: [{ name: 'date' }],
                    metricHeaders: [{ name: 'sessions' }],
                    rowCount: '2',
                    nextPageToken: 'token-2',
                },
            };
            const page2 = {
                data: {
                    rows: [{ dimensionValues: [{ value: '20261102' }], metricValues: [{ value: '12' }] }],
                    dimensionHeaders: [{ name: 'date' }],
                    metricHeaders: [{ name: 'sessions' }],
                    rowCount: '2',
                    nextPageToken: '',
                },
            };
            const runReportMock = jest.fn<(args: any) => Promise<any>>()
                .mockResolvedValueOnce(page1)
                .mockResolvedValueOnce(page2);
            mockedAnalyticsData.mockReturnValue({ properties: { runReport: runReportMock } });

            const result = await service.runReport(
                'properties/123',
                connectionDetails,
                ['date'],
                ['sessions'],
                [{ startDate: '30daysAgo', endDate: 'today' }]
            );

            expect(result.rows).toHaveLength(2);
            expect(runReportMock).toHaveBeenCalledTimes(2);
            const secondCall = runReportMock.mock.calls[1][0];
            expect(secondCall.requestBody.offsetToken).toBe('token-2');
        });

        it('should not paginate further when the API returns no nextPageToken', async () => {
            const runReportMock = jest.fn<(args: any) => Promise<any>>().mockResolvedValue({
                data: {
                    rows: [{ dimensionValues: [{ value: '20261101' }], metricValues: [{ value: '5' }] }],
                    dimensionHeaders: [{ name: 'date' }],
                    metricHeaders: [{ name: 'sessions' }],
                },
            });
            mockedAnalyticsData.mockReturnValue({ properties: { runReport: runReportMock } });

            const result = await service.runReport(
                'properties/123',
                connectionDetails,
                ['date'],
                ['sessions']
            );

            expect(result.rows).toHaveLength(1);
            expect(runReportMock).toHaveBeenCalledTimes(1);
        });
    });

    describe('getMetadata', () => {
        it('should call properties.getMetadata (not a non-existent top-level method)', async () => {
            const getMetadataMock = jest.fn<(args: any) => Promise<any>>().mockResolvedValue({
                data: { dimensions: [{ apiName: 'date' }], metrics: [{ apiName: 'sessions' }] },
            });
            mockedAnalyticsData.mockReturnValue({ properties: { getMetadata: getMetadataMock } });

            const metadata = await service.getMetadata('properties/123', connectionDetails);

            expect(getMetadataMock).toHaveBeenCalledWith({ name: 'properties/123/metadata' });
            expect(metadata.dimensions).toHaveLength(1);
        });
    });

    describe('transformReportToRows', () => {
        it('should map dimension and metric values by header name', () => {
            const response = {
                dimensionHeaders: [{ name: 'date' }, { name: 'eventName' }],
                metricHeaders: [{ name: 'eventCount' }, { name: 'conversions' }],
                rows: [
                    {
                        dimensionValues: [{ value: '20261101' }, { value: 'purchase' }],
                        metricValues: [{ value: '4' }, { value: '2' }],
                    },
                ],
            };

            const rows = service.transformReportToRows(response);

            expect(rows).toEqual([{ date: '20261101', eventName: 'purchase', eventCount: 4, conversions: 2 }]);
        });
    });
});

/**
 * Unit tests for the Google Analytics driver's per-report row transforms.
 */
describe('GoogleAnalyticsDriver transforms', () => {
    const driver: any = GoogleAnalyticsDriver.getInstance();

    it('should normalize GA4 YYYYMMDD dates and never leave conflict-key columns null', () => {
        const config = driver.getReportConfig('user_acquisition');
        const row = config.transform({
            date: '20261116',
            firstUserSource: 'google',
            firstUserMedium: 'cpc',
            firstUserCampaignId: '123456',
            firstUserCampaignName: 'Spring Sale',
            firstUserGoogleAdsCampaignId: '987654',
            firstUserGoogleAdsCampaignName: 'Brand Search',
            firstUserDefaultChannelGroup: 'Paid Search',
            newUsers: '5',
            sessions: '8',
            engagementRate: '62.5',
            conversions: '2',
        });

        expect(row.date).toBe('2026-11-16');
        expect(row.first_user_source).toBe('google');
        expect(row.first_user_campaign_name).toBe('Spring Sale');
        expect(row.first_user_google_ads_campaign_id).toBe('987654');
        // Google Ads campaign ID takes priority for the join key
        expect(row.campaign_key).toBe('987654');
        expect(row.row_key).toBeDefined();
        expect(row.row_key).toHaveLength(32);
        // GA4 returns "(not set)" for missing values; empty strings must fall back
        const missing = config.transform({
            date: '20261116',
            firstUserSource: '',
            firstUserMedium: null,
            firstUserCampaignId: undefined,
            firstUserCampaignName: '(not set)',
            firstUserDefaultChannelGroup: '(not set)',
        });
        expect(missing.first_user_source).toBe('direct');
        expect(missing.first_user_medium).toBe('(none)');
        expect(missing.first_user_campaign_id).toBe('(not set)');
        expect(missing.row_key).toBeDefined();
    });

    it('should not include a first_user_gclid column in user_acquisition', () => {
        const row = driver.getReportConfig('user_acquisition').transform({
            date: '20261116', firstUserSource: 'google', firstUserMedium: 'cpc',
        });
        expect(row).not.toHaveProperty('first_user_gclid');
    });

    it('should capture the Google Ads click ID in session_attribution', () => {
        const config = driver.getReportConfig('session_attribution');
        const row = config.transform({
            date: '20261116',
            sessionSource: 'google',
            sessionMedium: 'cpc',
            sessionCampaignId: '456',
            sessionCampaignName: 'Brand',
            sessionGoogleAdsCampaignId: '789',
            sessionGoogleAdsCampaignName: 'Search Brand',
            sessionManualTerm: 'shoes',
            sessionManualAdContent: 'banner',
            sessionGoogleAdsClickId: 'Cj0KCQiA',
            sessionDefaultChannelGroup: 'Paid Search',
            sessions: '3',
            engagedSessions: '2',
            totalUsers: '2',
            conversions: '1',
        });

        expect(row.session_gclid).toBe('Cj0KCQiA');
        expect(row.session_manual_term).toBe('shoes');
        expect(row.session_manual_ad_content).toBe('banner');
        expect(row.session_google_ads_campaign_id).toBe('789');
        // Google Ads campaign ID takes priority for the join key
        expect(row.campaign_key).toBe('789');
        expect(row.row_key).toHaveLength(32);
    });

    it('should produce distinct row keys for different dimension values', () => {
        const config = driver.getReportConfig('traffic_overview');
        const base = { date: '20261116', sessionSource: 'google', sessionMedium: 'cpc' };
        const a = config.transform({ ...base, sessionCampaignId: '1', sessionCampaignName: 'A', sessionDefaultChannelGroup: 'Paid Search' });
        const b = config.transform({ ...base, sessionCampaignId: '2', sessionCampaignName: 'B', sessionDefaultChannelGroup: 'Paid Search' });
        expect(a.row_key).not.toBe(b.row_key);
        expect(a.sessions).toBe(0);
        expect(a.row_key).toHaveLength(32);
    });

    it('should define valid conflict keys for every report type', () => {
        for (const syncType of GA4_REPORT_TYPES) {
            const config = driver.getReportConfig(syncType);
            expect(config.conflictKeys.length).toBeGreaterThan(0);
            expect(typeof config.transform).toBe('function');
            expect(typeof config.createTable).toBe('function');
        }
    });
});
