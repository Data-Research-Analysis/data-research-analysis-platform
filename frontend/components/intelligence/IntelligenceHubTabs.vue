<script setup lang="ts">
/**
 * IntelligenceHubTabs — tab navigation for the Intelligence Hub.
 *
 * - On desktop (≥ md) the tabs render as a vertical sidebar inside the hub.
 * - On mobile (< md) the tabs render as a horizontally-scrollable strip.
 *
 * The active tab is driven by the URL hash (e.g. #campaigns, #attribution).
 * Clicking a tab updates the hash and emits an event so the parent page
 * can swap the displayed child component.
 */
export interface IntelligenceTab {
    id: string
    label: string
    icon: [string, string]  // FontAwesome icon tuple, e.g. ['fas', 'chart-pie']
}

interface Props {
    /** Currently active tab id */
    activeTab: string
}

interface Emits {
    (e: 'update:activeTab', tabId: string): void
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const tabs: IntelligenceTab[] = [
    { id: 'overview',    label: 'Overview',     icon: ['fas', 'chart-pie'] },
    { id: 'campaigns',   label: 'Campaigns',    icon: ['fas', 'bullhorn'] },
    { id: 'attribution', label: 'Attribution',  icon: ['fas', 'diagram-project'] },
    { id: 'reports',     label: 'Reports',      icon: ['fas', 'file-chart-column'] },
    { id: 'insights',    label: 'AI Insights',  icon: ['fas', 'robot'] },
    { id: 'settings',    label: 'Settings',     icon: ['fas', 'gear'] },
];

function selectTab(tabId: string) {
    if (tabId === props.activeTab) return;
    emit('update:activeTab', tabId);
}

// Ref for the scrollable mobile container (used to scroll active tab into view)
const scrollContainer = ref<HTMLElement | null>(null);

watch(
    () => props.activeTab,
    () => {
        // Scroll the active tab into view on mobile
        nextTick(() => {
            const container = scrollContainer.value;
            if (!container) return;
            const activeEl = container.querySelector('[data-active="true"]') as HTMLElement | null;
            if (activeEl) {
                activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        });
    },
);
</script>

<template>
    <!-- ── Mobile: horizontal scrollable tab strip ──────────────────────── -->
    <div
        ref="scrollContainer"
        class="intelligence-hub-tabs flex md:hidden overflow-x-auto gap-1 px-3 py-2 border-b border-gray-200 bg-white sticky top-0 z-10 scrollbar-hide"
        role="tablist"
        aria-label="Intelligence Hub tabs"
    >
        <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            role="tab"
            :aria-selected="activeTab === tab.id"
            :data-active="activeTab === tab.id"
            class="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors shrink-0 cursor-pointer"
            :class="[
                activeTab === tab.id
                    ? 'bg-primary-blue-100 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
            ]"
            @click="selectTab(tab.id)"
        >
            <font-awesome-icon :icon="tab.icon" class="w-3.5 h-3.5" />
            {{ tab.label }}
        </button>
    </div>

    <!-- ── Desktop: vertical sidebar tabs ───────────────────────────────── -->
    <nav
        class="intelligence-hub-tabs-sidebar hidden md:flex flex-col gap-0.5 w-52 shrink-0 border-r border-gray-200 bg-white py-4 pr-2"
        role="tablist"
        aria-label="Intelligence Hub tabs"
    >
        <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            role="tab"
            :aria-selected="activeTab === tab.id"
            :data-active="activeTab === tab.id"
            class="flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer text-left"
            :class="[
                activeTab === tab.id
                    ? 'bg-primary-blue-100 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
            ]"
            @click="selectTab(tab.id)"
        >
            <font-awesome-icon :icon="tab.icon" class="w-4 h-4 shrink-0" />
            {{ tab.label }}
        </button>
    </nav>
</template>

<style scoped>
/* Hide scrollbar on mobile tab strip */
.scrollbar-hide::-webkit-scrollbar {
    display: none;
}
.scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
}
</style>