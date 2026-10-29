import { describe, it, expect } from '@jest/globals';
import { GoogleAdsProcessor } from '../../processors/GoogleAdsProcessor.js';
import { GOOGLE_DEFAULT_SYNC_TYPES } from '../../types/IGoogleAds.js';

describe('GoogleAdsProcessor.normalizeReportTypes', () => {
    const processor = GoogleAdsProcessor.getInstance();

    it('returns the full default set when nothing is configured', () => {
        expect(processor.normalizeReportTypes()).toEqual(GOOGLE_DEFAULT_SYNC_TYPES);
        expect(processor.normalizeReportTypes([])).toEqual(GOOGLE_DEFAULT_SYNC_TYPES);
    });

    it('adds ad_groups to sources created before it existed', () => {
        const legacyList = GOOGLE_DEFAULT_SYNC_TYPES.filter(t => t !== 'ad_groups');
        expect(legacyList).not.toContain('ad_groups');
        expect(processor.normalizeReportTypes(legacyList)).toContain('ad_groups');
    });

    it('adds the derived insight types when insights is requested', () => {
        const types = processor.normalizeReportTypes(['campaigns', 'insights']);
        expect(types).toEqual(expect.arrayContaining([
            'ad_group_insights',
            'demographic_insights',
            'device_insights',
            'geographic_insights',
            'placement_insights',
            'keyword_insights',
        ]));
    });

    it('migrates legacy pre-v25 names to the full default set', () => {
        expect(processor.normalizeReportTypes(['campaign', 'keyword'])).toEqual(GOOGLE_DEFAULT_SYNC_TYPES);
    });
});
