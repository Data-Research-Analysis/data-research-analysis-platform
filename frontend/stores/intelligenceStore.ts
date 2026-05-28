/**
 * Intelligence Hub — Central store for shared Intelligence Hub state.
 *
 * Holds the shared date range, data model ID, and provides coordinated
 * refresh across all sections (KPIs, channels, alerts, campaigns).
 *
 * TICKET MKT-007: Intelligence Hub Overview — Integration
 */

import { defineStore } from 'pinia';

export interface IIntelligenceDateRange {
    start: Date;
    end: Date;
}

export const useIntelligenceStore = defineStore('intelligence', () => {
    // ── Shared state ──────────────────────────────────────────────────────────

    /** Date range for all intelligence sections */
    const _defaultEnd = new Date();
    const _defaultStart = new Date();
    _defaultStart.setDate(_defaultEnd.getDate() - 30);
    const dateRange = ref<IIntelligenceDateRange>({ start: _defaultStart, end: _defaultEnd });

    /** First data model ID for the project */
    const dataModelId = ref<number | null>(null);

    /** Refresh trigger counter — incrementing forces all watchers to re-fetch */
    const refreshCounter = ref(0);

    /** Per-section loading states */
    const sectionLoading = ref<Record<string, boolean>>({
        kpi: false,
        channels: false,
        alerts: false,
        campaigns: false,
    });

    /** Per-section error states */
    const sectionErrors = ref<Record<string, string | null>>({
        kpi: null,
        channels: null,
        alerts: null,
        campaigns: null,
    });

    // ── Computed ──────────────────────────────────────────────────────────────

    /** ISO start date string (YYYY-MM-DD) */
    const isoStartDate = computed(() =>
        dateRange.value.start.toISOString().split('T')[0],
    );

    /** ISO end date string (YYYY-MM-DD) */
    const isoEndDate = computed(() =>
        dateRange.value.end.toISOString().split('T')[0],
    );

    // ── Actions ───────────────────────────────────────────────────────────────

    /** Update the shared date range */
    function setDateRange(start: Date, end: Date) {
        dateRange.value = { start, end };
    }

    /** Set the data model ID */
    function setDataModelId(id: number | null) {
        dataModelId.value = id;
    }

    /** Trigger a refresh on all sections */
    function triggerRefresh() {
        refreshCounter.value++;
    }

    /** Set loading state for a specific section */
    function setSectionLoading(section: string, loading: boolean) {
        sectionLoading.value[section] = loading;
    }

    /** Set error state for a specific section */
    function setSectionError(section: string, error: string | null) {
        sectionErrors.value[section] = error;
    }

    /** Clear all errors */
    function clearErrors() {
        Object.keys(sectionErrors.value).forEach(key => {
            sectionErrors.value[key] = null;
        });
    }

    return {
        // State
        dateRange,
        dataModelId,
        refreshCounter,
        sectionLoading,
        sectionErrors,

        // Computed
        isoStartDate,
        isoEndDate,

        // Actions
        setDateRange,
        setDataModelId,
        triggerRefresh,
        setSectionLoading,
        setSectionError,
        clearErrors,
    };
});