<script setup lang="ts">
/**
 * CampaignSettingsPanel — Displays Meta Ads campaign and ad set configuration
 * (objective, budgets, bid strategy, spend targets/caps, optimization goal,
 * targeting audience) on the campaign drill-down.
 */
import type { ICampaignSettings, IAdSetSettings } from '@/composables/useCampaignAnalysis';

interface Props {
    settings: ICampaignSettings;
}

const props = defineProps<Props>();

const showAdSets = ref(true);

function humanize(value: string | null | undefined): string {
    if (!value) return '—';
    if (value.toLowerCase() === 'undefined') return '—';
    return value
        .toLowerCase()
        .split('_')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function money(value: number | null | undefined): string {
    if (value === null || value === undefined) return '—';
    return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Budget display: a 0 (or unset) budget means Meta reports the other budget
 * mode is in use (daily vs lifetime are mutually exclusive), so show "—".
 */
function budget(value: number | null | undefined): string {
    if (value === null || value === undefined || value <= 0) return '—';
    return money(value);
}

interface IUrlParam {
    key: string;
    value: string;
}

function parseUrlParameters(tags: string[] | null | undefined): IUrlParam[] {
    const params: IUrlParam[] = [];
    for (const tag of tags || []) {
        for (const part of tag.split('&')) {
            const eq = part.indexOf('=');
            const key = eq >= 0 ? part.slice(0, eq) : part;
            const value = eq >= 0 ? part.slice(eq + 1) : '';
            if (key) params.push({ key, value });
        }
    }
    return params;
}

function formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    const d = new Date(value);
    return isNaN(d.getTime()) ? value : d.toLocaleDateString();
}

const campaignFields = computed(() => {
    const s = props.settings;
    return [
        { label: 'Objective', value: humanize(s.objective) },
        { label: 'Status', value: humanize(s.effectiveStatus) },
        { label: 'Buying Type', value: humanize(s.buyingType) },
        { label: 'Bid Strategy', value: humanize(s.bidStrategy) },
        { label: 'Daily Budget', value: budget(s.dailyBudget) },
        { label: 'Lifetime Budget', value: budget(s.lifetimeBudget) },
        { label: 'Spend Cap', value: budget(s.spendCap) },
        { label: 'Budget Remaining', value: money(s.budgetRemaining) },
        {
            label: 'Special Ad Categories',
            value: s.specialAdCategories && s.specialAdCategories.length > 0
                ? s.specialAdCategories.map(c => humanize(c)).join(', ')
                : 'None',
        },
        { label: 'Schedule', value: `${formatDate(s.startTime)} → ${formatDate(s.stopTime)}` },
    ];
});

function adSetFields(as: IAdSetSettings) {
    return [
        { label: 'Optimization Goal', value: humanize(as.optimizationGoal) },
        { label: 'Billing Event', value: humanize(as.billingEvent) },
        { label: 'Bid Strategy', value: humanize(as.bidStrategy) },
        { label: 'Bid Amount', value: money(as.bidAmount) },
        { label: 'Daily Budget', value: budget(as.dailyBudget) },
        { label: 'Lifetime Budget', value: budget(as.lifetimeBudget) },
        { label: 'Daily Min Spend Target', value: budget(as.dailyMinSpendTarget) },
        { label: 'Daily Spend Cap', value: budget(as.dailySpendCap) },
        { label: 'Destination Type', value: humanize(as.destinationType) },
        { label: 'Pacing', value: as.pacingType && as.pacingType.length ? as.pacingType.join(', ') : '—' },
    ];
}

function targetingFields(as: IAdSetSettings) {
    const t = as.targeting;
    if (!t) return [];
    const fields: Array<{ label: string; value: string }> = [];
    if (t.ageMin !== null || t.ageMax !== null) {
        fields.push({ label: 'Age', value: `${t.ageMin ?? '?'} - ${t.ageMax ?? '?'}` });
    }
    if (t.genders?.length) fields.push({ label: 'Genders', value: t.genders.map(g => humanize(g)).join(', ') });
    if (t.countries?.length) fields.push({ label: 'Countries', value: t.countries.join(', ') });
    if (t.regions?.length) fields.push({ label: 'Regions', value: t.regions.slice(0, 5).join(', ') });
    if (t.cityCount !== null) fields.push({ label: 'Cities Targeted', value: String(t.cityCount) });
    if (t.interests?.length) fields.push({ label: 'Interests', value: t.interests.slice(0, 8).join(', ') });
    if (t.customAudienceCount !== null) fields.push({ label: 'Custom Audiences', value: String(t.customAudienceCount) });
    if (t.excludedCustomAudienceCount !== null) {
        fields.push({ label: 'Excluded Audiences', value: String(t.excludedCustomAudienceCount) });
    }
    if (t.publisherPlatforms?.length) {
        fields.push({ label: 'Publisher Platforms', value: t.publisherPlatforms.map(p => humanize(p)).join(', ') });
    }
    if (t.positions?.length) {
        fields.push({ label: 'Placements', value: t.positions.map(p => humanize(p)).join(', ') });
    }
    return fields;
}
</script>

<template>
    <div class="bg-white rounded-xl border border-gray-200 p-5">
        <h3 class="text-sm font-semibold text-gray-800 mb-4">Campaign Settings</h3>

        <dl class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div v-for="field in campaignFields" :key="field.label">
                <dt class="text-[11px] font-medium text-gray-500 uppercase tracking-wide">{{ field.label }}</dt>
                <dd class="text-sm font-semibold text-gray-900 mt-0.5 truncate" :title="field.value">{{ field.value }}</dd>
            </div>
        </dl>

        <div v-if="settings.adSets.length" class="mt-6 pt-4 border-t border-gray-100">
            <button
                class="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3 cursor-pointer"
                @click="showAdSets = !showAdSets"
            >
                <font-awesome-icon
                    :icon="['fas', showAdSets ? 'chevron-down' : 'chevron-right']"
                    class="text-xs"
                />
                Ad Set Settings ({{ settings.adSets.length }})
            </button>

            <div v-if="showAdSets" class="space-y-4">
                <div
                    v-for="as in settings.adSets"
                    :key="as.id"
                    class="rounded-lg border border-gray-100 bg-gray-50/60 p-4"
                >
                    <div class="flex items-center justify-between gap-2 mb-3">
                        <span class="text-sm font-semibold text-gray-900 truncate">{{ as.name || as.id }}</span>
                        <span
                            class="px-2 py-0.5 rounded-full text-[11px] font-medium"
                            :class="((as.effectiveStatus || as.status) === 'ACTIVE')
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-gray-200 text-gray-600'"
                        >
                            {{ humanize(as.effectiveStatus || as.status) }}
                        </span>
                    </div>

                    <dl class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        <div v-for="field in adSetFields(as)" :key="field.label">
                            <dt class="text-[11px] font-medium text-gray-500 uppercase tracking-wide">{{ field.label }}</dt>
                            <dd class="text-sm font-semibold text-gray-900 mt-0.5 truncate" :title="field.value">{{ field.value }}</dd>
                        </div>
                    </dl>

                    <div v-if="as.destinationUrls?.length" class="mt-3 pt-3 border-t border-gray-200/70">
                        <h4 class="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Destination</h4>
                        <ul class="space-y-1">
                            <li v-for="url in as.destinationUrls" :key="url" class="text-xs">
                                <a
                                    :href="url"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="text-indigo-600 hover:underline break-all"
                                >{{ url }}</a>
                            </li>
                        </ul>
                    </div>

                    <div v-if="parseUrlParameters(as.urlParameters).length" class="mt-3 pt-3 border-t border-gray-200/70">
                        <h4 class="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">URL Parameters</h4>
                        <div class="flex flex-wrap gap-1.5">
                            <span
                                v-for="param in parseUrlParameters(as.urlParameters)"
                                :key="`${param.key}=${param.value}`"
                                class="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs"
                            >
                                <span class="font-medium text-gray-700">{{ param.key }}</span>
                                <span class="text-gray-500">=</span>
                                <span class="text-gray-600 break-all">{{ param.value || '—' }}</span>
                            </span>
                        </div>
                    </div>

                    <div v-if="targetingFields(as).length" class="mt-3 pt-3 border-t border-gray-200/70">
                        <h4 class="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Targeting</h4>
                        <dl class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                            <div v-for="field in targetingFields(as)" :key="field.label">
                                <dt class="text-[11px] font-medium text-gray-500">{{ field.label }}</dt>
                                <dd class="text-xs text-gray-800 mt-0.5 truncate" :title="field.value">{{ field.value }}</dd>
                            </div>
                        </dl>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
