<script setup lang="ts">
import { useReports, type IReport } from '@/composables/useReports';

definePageMeta({ layout: false });

const route = useRoute();
const reportsApi = useReports();
const key = String(route.params.key);

const report = ref<IReport | null>(null);
const loading = ref(true);
const notFound = ref(false);

async function load() {
    loading.value = true;
    const data = await reportsApi.getPublicReport(key);
    if (!data) {
        notFound.value = true;
    } else {
        report.value = data;
    }
    loading.value = false;
}

function printReport() {
    if (import.meta.client) window.print();
}

useHead(() => ({
    title: report.value ? `${report.value.name} — Report` : 'Shared Report',
}));

onMounted(() => {
    load();
});
</script>

<template>
    <div class="min-h-screen bg-gray-50">
        <!-- Header bar -->
        <div class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between print:hidden">
            <div class="flex items-center gap-3">
                <font-awesome-icon :icon="['fas', 'chart-bar']" class="text-primary-blue-300 text-xl" />
                <span class="text-sm font-medium text-gray-600">Shared Report</span>
            </div>
            <button
                class="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                @click="printReport"
            >
                <font-awesome-icon :icon="['fas', 'print']" />
                Print / Save as PDF
            </button>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="flex justify-center items-center py-24">
            <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin text-4xl text-gray-300" />
        </div>

        <!-- Not found / expired -->
        <div v-else-if="notFound" class="flex flex-col items-center justify-center py-24 px-4 text-center">
            <font-awesome-icon :icon="['fas', 'link-slash']" class="text-5xl text-gray-300 mb-4" />
            <h1 class="text-xl font-bold text-gray-700 mb-2">Link not found or expired</h1>
            <p class="text-sm text-gray-500 max-w-sm">
                This report link is invalid or has expired. Please ask the report owner to share a new link.
            </p>
        </div>

        <!-- Report content -->
        <div v-else-if="report" class="max-w-5xl mx-auto py-10 px-4">
            <!-- Title + meta -->
            <div class="mb-8">
                <h1 class="text-3xl font-bold text-gray-900 mb-2">{{ report.name }}</h1>
                <p v-if="report.description" class="text-gray-500 text-base mb-3">{{ report.description }}</p>
                <div class="flex items-center gap-4 text-xs text-gray-400">
                    <span v-if="report.created_by_name">
                        <font-awesome-icon :icon="['fas', 'user']" class="mr-1" />
                        Created by {{ report.created_by_name }}
                    </span>
                    <span v-if="report.updated_at">
                        <font-awesome-icon :icon="['fas', 'clock']" class="mr-1" />
                        Last updated
                        {{ new Date(report.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }}
                    </span>
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                        <font-awesome-icon :icon="['fas', 'circle-check']" />
                        Published
                    </span>
                </div>
            </div>

            <!-- Items -->
            <div v-if="report.items && report.items.length > 0" class="flex flex-col gap-8">
                <div
                    v-for="(item, idx) in report.items"
                    :key="item.id ?? idx"
                >
                    <!-- Dashboard item: embed via iframe if share key available -->
                    <template v-if="item.item_type === 'dashboard'">
                        <div class="mb-3 flex items-center gap-2">
                            <div class="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                                <font-awesome-icon :icon="['fas', 'table-columns']" class="text-blue-400 text-xs" />
                            </div>
                            <h3 class="font-semibold text-gray-800 text-base">
                                {{ item.resolved_title || item.title_override || `Dashboard #${item.ref_id ?? idx + 1}` }}
                            </h3>
                            <span class="text-xs text-gray-400">#{{ idx + 1 }}</span>
                        </div>
                        <!-- Embedded dashboard -->
                        <div v-if="item.dashboard_share_key" class="w-full rounded-xl overflow-hidden border border-gray-200 shadow-sm bg-white">
                            <iframe
                                :src="`/public-dashboard/${item.dashboard_share_key}`"
                                class="w-full"
                                style="height: 700px; border: none;"
                                loading="lazy"
                                :title="item.resolved_title || `Dashboard #${item.ref_id}`"
                            />
                        </div>
                        <!-- Dashboard has no public share link -->
                        <div v-else class="flex flex-col items-center justify-center py-10 bg-white rounded-xl border border-dashed border-gray-300 text-center">
                            <font-awesome-icon :icon="['fas', 'lock']" class="text-3xl text-gray-300 mb-3" />
                            <p class="text-sm font-medium text-gray-500 mb-1">Dashboard not publicly shared</p>
                            <p class="text-xs text-gray-400">The owner needs to generate a public link for this dashboard to embed it here.</p>
                        </div>
                    </template>

                    <!-- Other item types (widget, insight) -->
                    <template v-else>
                        <div class="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
                            <div class="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                                :class="{
                                    'bg-purple-50 text-purple-400': item.item_type === 'widget',
                                    'bg-amber-50 text-amber-400': item.item_type === 'insight',
                                }"
                            >
                                <font-awesome-icon
                                    :icon="['fas', item.item_type === 'widget' ? 'chart-pie' : 'lightbulb']"
                                />
                            </div>
                            <div class="flex-1 min-w-0">
                                <p class="text-sm font-semibold text-gray-800 truncate">
                                    {{ item.resolved_title || item.title_override || `${item.item_type.charAt(0).toUpperCase() + item.item_type.slice(1)} #${item.ref_id ?? idx + 1}` }}
                                </p>
                                <p class="text-xs text-gray-400 capitalize">{{ item.item_type }}</p>
                            </div>
                            <span class="shrink-0 text-xs text-gray-300">#{{ idx + 1 }}</span>
                        </div>
                    </template>
                </div>
            </div>

            <!-- No items -->
            <div v-else class="bg-white rounded-xl border border-gray-200 p-10 text-center">
                <font-awesome-icon :icon="['fas', 'layer-group']" class="text-4xl text-gray-200 mb-3" />
                <p class="text-sm text-gray-400">This report has no content items.</p>
            </div>

            <!-- Footer -->
            <div class="mt-10 pt-6 border-t border-gray-200 text-center print:hidden">
                <p class="text-xs text-gray-400">
                    This report was shared using Data Research Analysis.
                    <span v-if="report.share_expires_at">
                        Link expires
                        {{ new Date(report.share_expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }}.
                    </span>
                </p>
            </div>
        </div>
    </div>
</template>
