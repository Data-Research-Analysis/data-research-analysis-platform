import {
    resolveSyncWindow,
    buildSyncWindowConfig,
} from '../../utils/SyncWindowUtils.js';

describe('SyncWindowUtils', () => {
    describe('resolveSyncWindow', () => {
        it('returns a rolling window when sync_window_days is set', () => {
            const { startDate, endDate } = resolveSyncWindow({ sync_window_days: 30 });
            const expectedStart = new Date();
            expectedStart.setDate(expectedStart.getDate() - 30);
            const expectedStartIso = expectedStart.toISOString().split('T')[0];

            expect(startDate).toBe(expectedStartIso);
            expect(endDate).toBe(new Date().toISOString().split('T')[0]);
        });

        it('returns the fixed range when start_date and end_date are set', () => {
            const { startDate, endDate } = resolveSyncWindow({
                start_date: '2026-01-01',
                end_date: '2026-03-31',
            });
            expect(startDate).toBe('2026-01-01');
            expect(endDate).toBe('2026-03-31');
        });

        it('prioritizes the rolling window over fixed dates when both are present', () => {
            const { startDate, endDate } = resolveSyncWindow({
                sync_window_days: 7,
                start_date: '2026-01-01',
                end_date: '2026-03-31',
            });
            const expectedStart = new Date();
            expectedStart.setDate(expectedStart.getDate() - 7);
            expect(startDate).toBe(expectedStart.toISOString().split('T')[0]);
            expect(endDate).toBe(new Date().toISOString().split('T')[0]);
        });

        it('defaults to a 30-day rolling window when no config is provided', () => {
            const { startDate, endDate } = resolveSyncWindow(undefined);
            const expectedStart = new Date();
            expectedStart.setDate(expectedStart.getDate() - 30);
            expect(startDate).toBe(expectedStart.toISOString().split('T')[0]);
            expect(endDate).toBe(new Date().toISOString().split('T')[0]);
        });
    });

    describe('buildSyncWindowConfig', () => {
        it('builds a fixed config from explicit dates', () => {
            const config = buildSyncWindowConfig('fixed', null, '2026-01-01', '2026-03-31');
            expect(config).toEqual({
                window_type: 'fixed',
                start_date: '2026-01-01',
                end_date: '2026-03-31',
                sync_window_days: undefined,
                sync_window_preset: undefined,
            });
        });

        it('builds a rolling config with the matching preset', () => {
            const config = buildSyncWindowConfig('rolling', 90, null, null);
            expect(config.window_type).toBe('rolling');
            expect(config.sync_window_days).toBe(90);
            expect(config.sync_window_preset).toBe('last_90_days');
            expect(config.start_date).toBeUndefined();
            expect(config.end_date).toBeUndefined();
        });

        it('falls back to 30 days and the custom preset for unknown day counts', () => {
            const config = buildSyncWindowConfig('rolling', 45, null, null);
            expect(config.sync_window_days).toBe(45);
            expect(config.sync_window_preset).toBe('custom');
        });

        it('defaults to 30 days when the day count is missing', () => {
            const config = buildSyncWindowConfig('rolling', null, null, null);
            expect(config.sync_window_days).toBe(30);
            expect(config.sync_window_preset).toBe('last_30_days');
        });
    });
});
