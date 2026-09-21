<script setup lang="ts">
/**
 * CampaignTargetsPanel — Shows the CMO/manager-defined north-star targets for a
 * campaign and its ad sets/ad groups, and measures actual performance against
 * them. Editable only by users with the cmo/manager project role.
 */
import {
    computeAttainment,
    useCampaignTargets,
    type ICopyCampaignTargetsPayload,
    type ITargetActuals,
    type ITargetAttainmentRow,
    type TargetAttainmentStatus,
} from '@/composables/useCampaignTargets';
import type {
    ICampaignTarget,
    ICampaignTargetEntity,
    ICampaignTargetScope,
} from '@/composables/useCampaignAnalysis';

interface Props {
    scope: ICampaignTargetScope;
    entities: ICampaignTargetEntity[];
    targets: ICampaignTarget[];
    entityActuals: Record<string, ITargetActuals>;
    canEdit: boolean;
    days?: number;
}

const props = withDefaults(defineProps<Props>(), {
    days: 0,
});

const { saveTarget, deleteTarget, copyTargets, fetchTargets, isSaving, error } = useCampaignTargets();

// Working copy of the targets. Seeded once from the analysis response; after
// every mutation it is re-fetched from the backend so local state can never be
// clobbered by a stale analysis reload (which previously wiped saved rows and
// left the reopened form empty until a page refresh).
const localTargets = ref<ICampaignTarget[]>([...props.targets]);

/** Re-fetch the authoritative target rows for this campaign's ad sets. */
async function refreshTargets() {
    if (!props.scope.projectId) return;
    const campaignId = props.entities.find(e => e.level === 'ad_set')?.campaignId ?? null;
    const rows = await fetchTargets({
        projectId: props.scope.projectId,
        dataSourceId: props.scope.dataSourceId,
        channel: props.scope.channel,
        campaignId: campaignId ?? undefined,
        entityLevel: 'ad_set',
    });
    localTargets.value = [...rows];
}

const adSetEntities = computed(() => props.entities.filter(e => e.level === 'ad_set'));

function targetFor(entity: ICampaignTargetEntity): ICampaignTarget | null {
    return localTargets.value.find(
        t => t.entityLevel === 'ad_set' && t.entityId === entity.id && (t.campaignId ?? '') === (entity.campaignId ?? ''),
    ) || null;
}

function actualsFor(entity: ICampaignTargetEntity): ITargetActuals {
    return props.entityActuals[entity.id]
        || (entity.name ? props.entityActuals[entity.name] : undefined)
        || {};
}

function attainmentFor(entity: ICampaignTargetEntity): ITargetAttainmentRow[] {
    const target = targetFor(entity);
    if (!target) return [];
    return computeAttainment(target, actualsFor(entity), props.days);
}

const hasAnyTarget = computed(() => localTargets.value.length > 0);

// ---- Form / edit state -----------------------------------------------------

const formOpen = ref(false);
const activeEntity = ref<ICampaignTargetEntity | null>(null);

function openForm(entity: ICampaignTargetEntity) {
    if (!props.canEdit) return;
    activeEntity.value = entity;
    formOpen.value = true;
}

async function handleSubmit(payload: Record<string, any>) {
    try {
        await saveTarget(payload);
        await refreshTargets();
        formOpen.value = false;
    } catch {
        // Error text is surfaced via the composable error ref.
    }
}

async function handleDelete(id: number) {
    if (!props.scope.projectId) return;
    try {
        await deleteTarget(id, props.scope.projectId);
        await refreshTargets();
        formOpen.value = false;
    } catch {
        // Error text is surfaced via the composable error ref.
    }
}

// ---- Copy to all -----------------------------------------------------------

const copyingTo = ref<string | null>(null);

async function copyToAll(entity: ICampaignTargetEntity) {
    const others = adSetEntities.value.filter(e => e.id !== entity.id);
    if (!props.scope.projectId || others.length === 0) return;

    const overwrite = others.some(e => targetFor(e));
    const message = `Copy targets from "${entity.name || entity.id}" to all ${others.length} other ad sets?`
        + (overwrite ? ' Existing targets will be overwritten.' : '');
    if (!window.confirm(message)) return;

    copyingTo.value = entity.id;
    try {
        const payload: ICopyCampaignTargetsPayload = {
            projectId: props.scope.projectId,
            dataSourceId: props.scope.dataSourceId,
            channel: props.scope.channel,
            campaignId: entity.campaignId,
            entityLevel: 'ad_set',
            sourceEntityId: entity.id,
            targets: others.map(e => ({ entityId: e.id, entityName: e.name })),
        };
        await copyTargets(payload);

        // Re-fetch so the panel reflects the authoritative server state.
        await refreshTargets();
    } catch {
        // Error text is surfaced via the composable error ref.
    } finally {
        copyingTo.value = null;
    }
}

// ---- Formatting / styling --------------------------------------------------

const STATUS_STYLES: Record<TargetAttainmentStatus, { badge: string; bar: string; label: string }> = {
    met: { badge: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500', label: 'Met' },
    near: { badge: 'bg-amber-100 text-amber-700', bar: 'bg-amber-500', label: 'Near' },
    missed: { badge: 'bg-red-100 text-red-700', bar: 'bg-red-500', label: 'Missed' },
    over: { badge: 'bg-orange-100 text-orange-700', bar: 'bg-orange-500', label: 'Over budget' },
    under: { badge: 'bg-sky-100 text-sky-700', bar: 'bg-sky-500', label: 'Under budget' },
    unknown: { badge: 'bg-gray-100 text-gray-500', bar: 'bg-gray-300', label: 'No data' },
};

function statusStyle(status: TargetAttainmentStatus) {
    return STATUS_STYLES[status] || STATUS_STYLES.unknown;
}

function formatValue(value: number | null, format: string): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return '—';
    switch (format) {
        case 'currency':
            return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        case 'percent':
            return `${value.toFixed(2)}%`;
        case 'ratio':
            return `${value.toFixed(2)}x`;
        default:
            return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
    }
}

function barWidth(row: ITargetAttainmentRow): number {
    if (row.attainmentPct === null || !Number.isFinite(row.attainmentPct)) return 0;
    return Math.max(0, Math.min(100, row.attainmentPct));
}
</script>

<template>
    <div class="bg-white rounded-xl border border-gray-200 p-5">
        <div class="flex items-center justify-between gap-3 mb-4">
            <div class="flex items-center gap-2">
                <font-awesome-icon :icon="['fas', 'bullseye']" class="text-indigo-500" />
                <h3 class="text-sm font-semibold text-gray-800">North-Star Targets</h3>
                <span v-if="!hasAnyTarget" class="text-xs text-gray-400">Not defined yet</span>
            </div>
            <span v-if="!canEdit" class="text-[11px] text-gray-400">Read-only · CMO/Manager can edit</span>
        </div>

        <p v-if="error" class="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{{ error }}</p>

        <!-- Ad sets / ad groups -->
        <div v-if="adSetEntities.length">
            <h4 class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Ad Sets / Ad Groups ({{ adSetEntities.length }})
            </h4>
            <div class="space-y-3">
                <div
                    v-for="entity in adSetEntities"
                    :key="entity.id"
                    class="rounded-lg border border-gray-100 p-3"
                >
                    <div class="flex items-center justify-between gap-2">
                        <span class="text-sm font-medium text-gray-800 truncate">{{ entity.name || entity.id }}</span>
                        <div class="flex shrink-0 items-center gap-1.5">
                            <button
                                v-if="canEdit && targetFor(entity) && adSetEntities.length > 1"
                                class="rounded-lg border border-gray-200 px-2.5 py-1 text-[11px] font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 cursor-pointer"
                                :disabled="copyingTo !== null || isSaving"
                                @click="copyToAll(entity)"
                            >
                                <font-awesome-icon :icon="['fas', 'copy']" class="mr-1" />
                                {{ copyingTo === entity.id ? 'Copying…' : 'Copy to all' }}
                            </button>
                            <button
                                v-if="canEdit"
                                class="shrink-0 rounded-lg border border-gray-200 px-2.5 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-50 cursor-pointer"
                                @click="openForm(entity)"
                            >
                                {{ targetFor(entity) ? 'Edit' : 'Set targets' }}
                            </button>
                        </div>
                    </div>

                    <div v-if="attainmentFor(entity).length" class="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                        <div v-for="row in attainmentFor(entity)" :key="row.key">
                            <span class="text-[10px] font-medium text-gray-500">{{ row.label }}</span>
                            <p class="text-xs font-semibold text-gray-800">
                                {{ formatValue(row.actual, row.format) }}
                                <span class="font-normal text-gray-400">/ {{ formatValue(row.target, row.format) }}</span>
                            </p>
                        </div>
                    </div>
                    <p v-else-if="targetFor(entity)" class="mt-1 text-[11px] text-gray-400">No measurable targets set.</p>
                    <p v-else class="mt-1 text-[11px] text-gray-400">No targets defined.</p>
                </div>
            </div>
        </div>
        <p v-else class="text-xs text-gray-400">No ad sets / ad groups found for this campaign.</p>

        <!-- Form modal -->
        <CampaignTargetsForm
            v-if="activeEntity"
            v-model="formOpen"
            :entity="activeEntity"
            :scope="scope"
            :target="targetFor(activeEntity)"
            :is-saving="isSaving"
            :error="error"
            @submit="handleSubmit"
            @delete="handleDelete"
        />
    </div>
</template>
