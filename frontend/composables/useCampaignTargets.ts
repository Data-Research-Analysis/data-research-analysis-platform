/**
 * useCampaignTargets — Composable for reading and writing the CMO/manager
 * defined north-star targets for a channel campaign and its ad sets/ad groups,
 * plus helpers to measure actual performance against those targets.
 */
import { useAppFetch } from '@/composables/useAppFetch';
import { baseUrl } from '~/composables/Utils';
import { getAuthToken } from '~/composables/AuthToken';
import type {
    CampaignTargetEntityLevel,
    ICampaignTarget,
} from '@/composables/useCampaignAnalysis';

export interface IFetchCampaignTargetsParams {
    projectId: number;
    dataSourceId?: number | null;
    channel?: string | null;
    campaignId?: string | null;
    entityLevel?: CampaignTargetEntityLevel | null;
}

export interface IUpsertCampaignTargetPayload {
    projectId: number;
    dataSourceId?: number | null;
    channel?: string | null;
    entityLevel: CampaignTargetEntityLevel;
    campaignId?: string | null;
    entityId: string;
    entityName?: string | null;
    buyingModel?: string | null;
    audienceSize?: number | null;
    targetCtr?: number | null;
    targetClicks?: number | null;
    targetImpressions?: number | null;
    targetRoas?: number | null;
    targetLeads?: number | null;
    targetConversions?: number | null;
    targetRevenue?: number | null;
    targetCpc?: number | null;
    targetCpm?: number | null;
    targetCpa?: number | null;
    targetCpl?: number | null;
    targetFrequency?: number | null;
    initialInvestment?: number | null;
    dailyBudget?: number | null;
    lifetimeBudget?: number | null;
    currency?: string | null;
    flightStartDate?: string | null;
    flightEndDate?: string | null;
    notes?: string | null;
}

export interface ICopyCampaignTargetsPayload {
    projectId: number;
    dataSourceId?: number | null;
    channel?: string | null;
    campaignId?: string | null;
    entityLevel: 'ad_set';
    sourceEntityId: string;
    targets: { entityId: string; entityName?: string | null }[];
}

/** Actual values a target is measured against (percent metrics are 0-100). */
export interface ITargetActuals {
    spend?: number | null;
    impressions?: number | null;
    clicks?: number | null;
    conversions?: number | null;
    leads?: number | null;
    revenue?: number | null;
    ctr?: number | null;
    cpc?: number | null;
    cpm?: number | null;
    cpa?: number | null;
    cpl?: number | null;
    roas?: number | null;
    frequency?: number | null;
}

export type TargetDirection = 'higher_better' | 'lower_better' | 'budget';
export type TargetAttainmentStatus = 'met' | 'near' | 'missed' | 'over' | 'under' | 'unknown';
export type TargetValueFormat = 'number' | 'currency' | 'percent' | 'ratio';

export interface ITargetAttainmentRow {
    key: string;
    label: string;
    direction: TargetDirection;
    format: TargetValueFormat;
    target: number;
    actual: number | null;
    /** Percentage of target achieved (>100 = ahead). Null when actual unknown. */
    attainmentPct: number | null;
    status: TargetAttainmentStatus;
}

interface ITargetDefinition {
    key: keyof ICampaignTarget;
    label: string;
    direction: TargetDirection;
    format: TargetValueFormat;
    actual: keyof ITargetActuals;
}

/**
 * Metric definitions in display order. `budget` rows compare spend against a
 * planned budget (pacing) rather than "more/less is better".
 */
const TARGET_DEFINITIONS: ITargetDefinition[] = [
    { key: 'targetImpressions', label: 'Impressions', direction: 'higher_better', format: 'number', actual: 'impressions' },
    { key: 'targetClicks', label: 'Clicks', direction: 'higher_better', format: 'number', actual: 'clicks' },
    { key: 'targetCtr', label: 'CTR', direction: 'higher_better', format: 'percent', actual: 'ctr' },
    { key: 'targetCpc', label: 'CPC', direction: 'lower_better', format: 'currency', actual: 'cpc' },
    { key: 'targetCpm', label: 'CPM', direction: 'lower_better', format: 'currency', actual: 'cpm' },
    { key: 'targetCpa', label: 'CPA', direction: 'lower_better', format: 'currency', actual: 'cpa' },
    { key: 'targetCpl', label: 'CPL', direction: 'lower_better', format: 'currency', actual: 'cpl' },
    { key: 'targetRoas', label: 'ROAS', direction: 'higher_better', format: 'ratio', actual: 'roas' },
    { key: 'targetLeads', label: 'Leads', direction: 'higher_better', format: 'number', actual: 'leads' },
    { key: 'targetConversions', label: 'Conversions', direction: 'higher_better', format: 'number', actual: 'conversions' },
    { key: 'targetRevenue', label: 'Revenue', direction: 'higher_better', format: 'currency', actual: 'revenue' },
    { key: 'targetFrequency', label: 'Frequency', direction: 'higher_better', format: 'ratio', actual: 'frequency' },
];

/**
 * Compute target-vs-actual attainment for a target row.
 *
 * `days` is used to prorate a daily-budget target over the reporting window.
 */
export function computeAttainment(
    target: ICampaignTarget,
    actuals: ITargetActuals,
    days?: number,
): ITargetAttainmentRow[] {
    const rows: ITargetAttainmentRow[] = [];

    for (const def of TARGET_DEFINITIONS) {
        const targetValue = target[def.key] as number | null;
        if (targetValue === null || targetValue === undefined || targetValue <= 0) continue;

        const actualValue = (actuals[def.actual] ?? null) as number | null;
        rows.push(buildRow(def.key, def.label, def.direction, def.format, targetValue, actualValue));
    }

    // Budget pacing rows: spend against planned budget.
    const spend = actuals.spend ?? null;
    if (spend !== null) {
        if (target.initialInvestment && target.initialInvestment > 0) {
            rows.push(buildRow('initialInvestment', 'Initial Investment', 'budget', 'currency', target.initialInvestment, spend));
        }
        if (target.lifetimeBudget && target.lifetimeBudget > 0) {
            rows.push(buildRow('lifetimeBudget', 'Lifetime Budget', 'budget', 'currency', target.lifetimeBudget, spend));
        }
        if (target.dailyBudget && target.dailyBudget > 0) {
            const proratedTarget = days && days > 0 ? target.dailyBudget * days : target.dailyBudget;
            rows.push(buildRow('dailyBudget', 'Daily Budget', 'budget', 'currency', proratedTarget, spend));
        }
    }

    return rows;
}

function buildRow(
    key: string,
    label: string,
    direction: TargetDirection,
    format: TargetValueFormat,
    target: number,
    actual: number | null,
): ITargetAttainmentRow {
    if (actual === null || !Number.isFinite(actual)) {
        return { key, label, direction, format, target, actual: null, attainmentPct: null, status: 'unknown' };
    }

    if (direction === 'higher_better') {
        const attainmentPct = (actual / target) * 100;
        return {
            key, label, direction, format, target, actual, attainmentPct,
            status: attainmentPct >= 100 ? 'met' : attainmentPct >= 90 ? 'near' : 'missed',
        };
    }

    if (direction === 'lower_better') {
        // For cost metrics the target is a ceiling: at/below target is met.
        const attainmentPct = actual <= 0 ? 100 : (target / actual) * 100;
        return {
            key, label, direction, format, target, actual, attainmentPct,
            status: actual <= target ? 'met' : attainmentPct >= 90 ? 'near' : 'missed',
        };
    }

    // Budget: report pacing without a "good/bad" judgement.
    const attainmentPct = target > 0 ? (actual / target) * 100 : null;
    const status: TargetAttainmentStatus =
        attainmentPct === null ? 'unknown' : attainmentPct > 110 ? 'over' : attainmentPct < 90 ? 'under' : 'met';
    return { key, label, direction, format, target, actual, attainmentPct, status };
}

export function useCampaignTargets() {
    const targets = ref<ICampaignTarget[]>([]);
    const isLoading = ref(false);
    const isSaving = ref(false);
    const error = ref<string | null>(null);

    async function fetchTargets(params: IFetchCampaignTargetsParams): Promise<ICampaignTarget[]> {
        if (!params.projectId) {
            targets.value = [];
            return [];
        }

        isLoading.value = true;
        error.value = null;

        try {
            const query: Record<string, string> = { projectId: String(params.projectId) };
            if (params.dataSourceId != null) query.dataSourceId = String(params.dataSourceId);
            if (params.channel) query.channel = params.channel;
            if (params.campaignId) query.campaignId = params.campaignId;
            if (params.entityLevel) query.entityLevel = params.entityLevel;

            const url = `${baseUrl()}/campaign-targets?${new URLSearchParams(query).toString()}`;
            const response = await useAppFetch<{ success: boolean; data: ICampaignTarget[] }>(url, {
                headers: {
                    Authorization: `Bearer ${getAuthToken()}`,
                    'Authorization-Type': 'auth',
                },
            });

            targets.value = response?.data || [];
            return targets.value;
        } catch (err: any) {
            console.error('[useCampaignTargets] fetch error:', err);
            error.value = err?.message || 'Failed to load campaign targets';
            targets.value = [];
            return [];
        } finally {
            isLoading.value = false;
        }
    }

    async function saveTarget(payload: IUpsertCampaignTargetPayload): Promise<ICampaignTarget | null> {
        isSaving.value = true;
        error.value = null;

        try {
            const response = await useAppFetch<{ success: boolean; data: ICampaignTarget }>(
                `${baseUrl()}/campaign-targets`,
                {
                    method: 'PUT',
                    headers: {
                        Authorization: `Bearer ${getAuthToken()}`,
                        'Authorization-Type': 'auth',
                        'Content-Type': 'application/json',
                    },
                    body: payload,
                },
            );

            const saved = response?.data || null;
            if (saved) {
                const idx = targets.value.findIndex(t => t.id === saved.id);
                if (idx >= 0) targets.value[idx] = saved;
                else targets.value.push(saved);
            }
            return saved;
        } catch (err: any) {
            console.error('[useCampaignTargets] save error:', err);
            error.value = err?.message || 'Failed to save campaign target';
            throw err;
        } finally {
            isSaving.value = false;
        }
    }

    async function deleteTarget(id: number, projectId: number): Promise<void> {
        isSaving.value = true;
        error.value = null;

        try {
            await useAppFetch(`${baseUrl()}/campaign-targets/${id}?projectId=${projectId}`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${getAuthToken()}`,
                    'Authorization-Type': 'auth',
                },
            });
            targets.value = targets.value.filter(t => t.id !== id);
        } catch (err: any) {
            console.error('[useCampaignTargets] delete error:', err);
            error.value = err?.message || 'Failed to delete campaign target';
            throw err;
        } finally {
            isSaving.value = false;
        }
    }

    /**
     * Copy one entity's targets onto a list of recipient entities. Returns the
     * created/updated rows and merges them into the local `targets` state.
     */
    async function copyTargets(payload: ICopyCampaignTargetsPayload): Promise<ICampaignTarget[]> {
        isSaving.value = true;
        error.value = null;

        try {
            const response = await useAppFetch<{ success: boolean; data: ICampaignTarget[] }>(
                `${baseUrl()}/campaign-targets/copy`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${getAuthToken()}`,
                        'Authorization-Type': 'auth',
                        'Content-Type': 'application/json',
                    },
                    body: payload,
                },
            );

            const rows = response?.data || [];
            if (rows.length) {
                const newIds = new Set(rows.map(r => r.id));
                targets.value = targets.value.filter(t => !newIds.has(t.id));
                targets.value.push(...rows);
            }
            return rows;
        } catch (err: any) {
            console.error('[useCampaignTargets] copy error:', err);
            error.value = err?.message || 'Failed to copy campaign targets';
            throw err;
        } finally {
            isSaving.value = false;
        }
    }

    return {
        targets,
        isLoading,
        isSaving,
        error,
        fetchTargets,
        saveTarget,
        deleteTarget,
        copyTargets,
    };
}
