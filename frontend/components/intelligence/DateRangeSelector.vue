<script setup lang="ts">
/**
 * DateRangeSelector — shared date range picker for the Intelligence Hub.
 *
 * Offers preset quick ranges (Last 7/30/90 days, MTD, YTD) and a custom
 * date range. Syncs the selected range with the `?range=` URL query parameter.
 */

export interface DateRangeValue {
    start: Date
    end: Date
    preset: string   // e.g. 'last7', 'last30', 'last90', 'mtd', 'ytd', 'custom'
}

interface Emits {
    (e: 'update:range', range: DateRangeValue): void
}

const emit = defineEmits<Emits>();

// ── Preset definitions ────────────────────────────────────────────────────────
const presets = [
    { id: 'last7',  label: 'Last 7 days' },
    { id: 'last30', label: 'Last 30 days' },
    { id: 'last90', label: 'Last 90 days' },
    { id: 'mtd',    label: 'Month to date' },
    { id: 'ytd',    label: 'Year to date' },
    { id: 'custom', label: 'Custom range' },
] as const;

type PresetId = typeof presets[number]['id'];

// ── State ─────────────────────────────────────────────────────────────────────
const activePreset = ref<PresetId>('last30');
const showDropdown = ref(false);
const customStart = ref('');
const customEnd = ref('');

const dropdownRef = ref<HTMLElement | null>(null);

// ── Helpers ───────────────────────────────────────────────────────────────────
function today(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

function daysAgo(n: number): Date {
    const d = today();
    d.setDate(d.getDate() - n);
    return d;
}

function startOfMonth(): Date {
    const d = today();
    d.setDate(1);
    return d;
}

function startOfYear(): Date {
    const d = today();
    d.setMonth(0, 1);
    return d;
}

function isoToInput(d: Date): string {
    return d.toISOString().split('T')[0];
}

function resolveRange(preset: PresetId, customStartDate?: string, customEndDate?: string): DateRangeValue {
    const now = today();

    switch (preset) {
        case 'last7':
            return { start: daysAgo(7), end: now, preset };
        case 'last30':
            return { start: daysAgo(30), end: now, preset };
        case 'last90':
            return { start: daysAgo(90), end: now, preset };
        case 'mtd':
            return { start: startOfMonth(), end: now, preset };
        case 'ytd':
            return { start: startOfYear(), end: now, preset };
        case 'custom': {
            const s = customStartDate ? new Date(customStartDate) : daysAgo(30);
            const e = customEndDate ? new Date(customEndDate) : now;
            return { start: s, end: e, preset };
        }
        default:
            return { start: daysAgo(30), end: now, preset: 'last30' };
    }
}

// ── Display label ─────────────────────────────────────────────────────────────
const displayLabel = computed(() => {
    if (activePreset.value === 'custom') {
        if (customStart.value && customEnd.value) {
            return `${customStart.value} → ${customEnd.value}`;
        }
        return 'Custom range';
    }
    return presets.find(p => p.id === activePreset.value)?.label ?? 'Last 30 days';
});

// ── Actions ───────────────────────────────────────────────────────────────────
function selectPreset(presetId: PresetId) {
    activePreset.value = presetId;

    if (presetId === 'custom') {
        // Pre-fill custom inputs with current range defaults
        if (!customStart.value) customStart.value = isoToInput(daysAgo(30));
        if (!customEnd.value) customEnd.value = isoToInput(today());
        return; // Don't emit yet — wait for user to pick dates
    }

    emitAndClose(presetId);
}

function applyCustomRange() {
    if (!customStart.value || !customEnd.value) return;
    activePreset.value = 'custom';
    emitAndClose('custom');
}

function emitAndClose(preset: PresetId) {
    const range = resolveRange(preset, customStart.value, customEnd.value);

    // Update URL query parameter
    if (import.meta.client) {
        const url = new URL(window.location.href);
        url.searchParams.set('range', preset);
        if (preset === 'custom' && customStart.value && customEnd.value) {
            url.searchParams.set('start', customStart.value);
            url.searchParams.set('end', customEnd.value);
        } else {
            url.searchParams.delete('start');
            url.searchParams.delete('end');
        }
        history.replaceState(history.state, '', url.toString());
    }

    emit('update:range', range);
    showDropdown.value = false;
}

// ── Init from URL ─────────────────────────────────────────────────────────────
function initFromUrl() {
    if (!import.meta.client) return;

    const params = new URLSearchParams(window.location.search);
    const rangeParam = params.get('range') as PresetId | null;

    if (rangeParam && presets.some(p => p.id === rangeParam)) {
        activePreset.value = rangeParam;

        if (rangeParam === 'custom') {
            customStart.value = params.get('start') ?? isoToInput(daysAgo(30));
            customEnd.value = params.get('end') ?? isoToInput(today());
        }

        const range = resolveRange(rangeParam, customStart.value, customEnd.value);
        emit('update:range', range);
    }
    // When no URL param is present, don't emit — the parent already set
    // the initial date range. Emitting here would clear the store's freshly
    // fetched hubSummary via setDateRange → hubSummary = null.
}

// ── Close dropdown on outside click ───────────────────────────────────────────
function onClickOutside(e: MouseEvent) {
    if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
        showDropdown.value = false;
    }
}

onMounted(() => {
    initFromUrl();
    document.addEventListener('click', onClickOutside, true);
});

onUnmounted(() => {
    document.removeEventListener('click', onClickOutside, true);
});
</script>

<template>
    <div ref="dropdownRef" class="relative inline-flex">
        <!-- Trigger button -->
        <button
            type="button"
            class="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-blue-100 transition-colors cursor-pointer"
            @click.stop="showDropdown = !showDropdown"
        >
            <font-awesome-icon :icon="['fas', 'calendar-days']" class="w-3.5 h-3.5 text-gray-400" />
            {{ displayLabel }}
            <font-awesome-icon
                :icon="['fas', 'chevron-down']"
                class="w-3 h-3 text-gray-400 transition-transform"
                :class="{ 'rotate-180': showDropdown }"
            />
        </button>

        <!-- Dropdown panel -->
        <Transition
            enter-active-class="transition ease-out duration-100"
            enter-from-class="opacity-0 scale-95"
            enter-to-class="opacity-100 scale-100"
            leave-active-class="transition ease-in duration-75"
            leave-from-class="opacity-100 scale-100"
            leave-to-class="opacity-0 scale-95"
        >
            <div
                v-if="showDropdown"
                class="absolute top-full left-0 mt-1.5 z-50 w-64 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden"
            >
                <!-- Preset list -->
                <div class="py-1">
                    <button
                        v-for="preset in presets"
                        :key="preset.id"
                        type="button"
                        class="w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors cursor-pointer"
                        :class="[
                            activePreset === preset.id
                                ? 'bg-primary-blue-100/10 text-primary-blue-100 font-medium'
                                : 'text-gray-700 hover:bg-gray-50',
                        ]"
                        @click="selectPreset(preset.id)"
                    >
                        <span
                            class="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            :class="activePreset === preset.id ? 'bg-primary-blue-100' : 'bg-transparent'"
                        />
                        {{ preset.label }}
                    </button>
                </div>

                <!-- Custom range inputs -->
                <Transition
                    enter-active-class="transition-all ease-out duration-200"
                    enter-from-class="max-h-0 opacity-0"
                    enter-to-class="max-h-40 opacity-100"
                    leave-active-class="transition-all ease-in duration-150"
                    leave-from-class="max-h-40 opacity-100"
                    leave-to-class="max-h-0 opacity-0"
                >
                    <div v-if="activePreset === 'custom'" class="border-t border-gray-100 px-4 py-3 space-y-2 overflow-hidden">
                        <div class="flex items-center gap-2">
                            <label class="text-xs text-gray-500 w-10">From</label>
                            <input
                                v-model="customStart"
                                type="date"
                                class="flex-1 text-sm border border-gray-200 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-primary-blue-100 text-gray-700"
                            />
                        </div>
                        <div class="flex items-center gap-2">
                            <label class="text-xs text-gray-500 w-10">To</label>
                            <input
                                v-model="customEnd"
                                type="date"
                                class="flex-1 text-sm border border-gray-200 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-primary-blue-100 text-gray-700"
                            />
                        </div>
                        <button
                            type="button"
                            class="w-full mt-1 px-3 py-1.5 text-sm font-medium text-white bg-primary-blue-100 rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
                            @click="applyCustomRange"
                        >
                            Apply
                        </button>
                    </div>
                </Transition>
            </div>
        </Transition>
    </div>
</template>