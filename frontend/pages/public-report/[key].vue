<script setup lang="ts">
import { useReports, type IReport } from '@/composables/useReports';
import { useBranding } from '@/composables/useBranding';
import TextBlock from '@/components/report-items/TextBlock.vue';
import AiInsightsSection from '@/components/report-items/AiInsightsSection.vue';
import KpiCardRow from '@/components/report-items/KpiCardRow.vue';
import ReportDataTable from '@/components/report-items/ReportDataTable.vue';

definePageMeta({ layout: false });

const route = useRoute();
const reportsApi = useReports();
const { applyBranding } = useBranding();
const key = String(route.params.key);

const report = ref<IReport | null>(null);
const branding = ref<any | null>(null);
const loading = ref(true);
const notFound = ref(false);

async function load() {
    loading.value = true;
    const data = await reportsApi.getPublicReport(key);
    if (!data) {
        notFound.value = true;
    } else {
        report.value = data.report;
        branding.value = data.branding ?? null;
        if (import.meta.client && branding.value) {
            applyBranding(branding.value);
        }
    }
    loading.value = false;
}

function printReport() {
    if (import.meta.client) window.print();
}

useHead(() => {
    const title = report.value ? `${report.value.name} — Report` : 'Shared Report';
    const description = report.value?.description || 'Shared report from Data Research Analysis';
    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
    const brandedLogo = branding.value?.enabled && branding.value?.logoUrl
        ? branding.value.logoUrl
        : 'https://dataresearchanalysis.com/images/dashboard-preview.png';

    return {
        title,
        description,
        meta: [
            { name: 'robots', content: 'noindex, follow' },
            { property: 'og:type', content: 'website' },
            { property: 'og:url', content: currentUrl },
            { property: 'og:title', content: title },
            { property: 'og:description', content: description },
            { property: 'og:image', content: brandedLogo },
            { name: 'twitter:card', content: 'summary_large_image' },
            { name: 'twitter:url', content: currentUrl },
            { name: 'twitter:title', content: title },
            { name: 'twitter:description', content: description },
            { name: 'twitter:image', content: brandedLogo },
        ],
        link: [
            { rel: 'canonical', href: currentUrl },
        ],
    };
});

onMounted(() => {
    load();
});
</script>

<template>
    <div class="min-h-screen bg-gray-50">
        <!-- Print-only branded header -->
        <div
            class="hidden print:flex items-center justify-between px-6 py-4 border-b"
            :style="branding?.enabled && branding?.primaryColor
                ? { backgroundColor: branding.primaryColor, borderColor: 'transparent' }
                : { backgroundColor: '#1e293b', borderColor: 'transparent' }"
        >
            <div class="flex items-center gap-3">
                <img
                    v-if="branding?.enabled && branding?.logoUrl"
                    :src="branding.logoUrl"
                    class="h-6 w-auto object-contain"
                    :alt="branding?.orgName ?? 'Logo'"
                />
            </div>
            <span class="text-xs text-gray-400">Printed {{ new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }}</span>
        </div>

        <!-- Interactive header bar (hidden in print) -->
        <div
            class="border-b px-6 py-4 flex items-center justify-between print:hidden"
            :style="branding?.enabled && branding?.primaryColor
                ? { backgroundColor: branding.primaryColor, borderColor: 'transparent' }
                : { backgroundColor: '#ffffff', borderColor: '#e5e7eb' }"
        >
            <div class="flex items-center gap-3">
                <img
                    v-if="branding?.enabled && branding?.logoUrl"
                    :src="branding.logoUrl"
                    class="h-6 w-auto object-contain"
                    :alt="branding?.orgName ?? 'Logo'"
                />
                <font-awesome-icon
                    v-else
                    :icon="['fas', 'chart-bar']"
                    class="text-xl"
                    :class="branding?.enabled ? 'text-white/70' : 'text-primary-blue-300'"
                />
                <span
                    class="text-sm font-medium"
                    :class="branding?.enabled ? 'text-white/80' : 'text-gray-600'"
                >
                    Shared Report
                </span>
            </div>
            <button
                class="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors cursor-pointer"
                :class="branding?.enabled
                    ? 'text-white bg-white/10 border border-white/30 hover:bg-white/20'
                    : 'text-gray-600 bg-white border border-gray-300 hover:bg-gray-50'"
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
        <div v-else-if="report" class="max-w-5xl mx-auto py-6 px-4 print:py-4 print:px-8">
            <!-- Title + meta -->
            <div class="mb-6 print:mb-3">
                <h1 class="text-3xl font-bold text-gray-900 mb-2 print:text-2xl">{{ report.name }}</h1>
                <p v-if="report.description" class="text-gray-500 text-base mb-3 print:mb-2 print:text-sm">{{ report.description }}</p>
                <div class="flex items-center gap-4 text-xs text-gray-400">
                    <span v-if="report.created_by_name">
                        <font-awesome-icon :icon="['fas', 'user']" class="mr-1" />
                        Created by {{ report.created_by_name }}
                    </span>
                    <span v-if="report.updated_at">
                        <font-awesome-icon :icon="['fas', 'clock']" class="mr-1" />
                        {{ new Date(report.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }}
                    </span>
                </div>
            </div>

            <!-- Items -->
            <div v-if="report.items && report.items.length > 0" class="flex flex-col gap-6 print:gap-3">
                <div
                    v-for="(item, idx) in report.items"
                    :key="item.id ?? idx"
                    class="public-report-item"
                >
                    <!-- Dashboard item: embed via iframe if share key available -->
                    <template v-if="item.item_type === 'dashboard'">
                        <div class="mb-2 flex items-center gap-2">
                            <div class="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                                <font-awesome-icon :icon="['fas', 'table-columns']" class="text-blue-400 text-xs" />
                            </div>
                            <h3 class="font-semibold text-gray-800 text-base print:text-sm">
                                {{ item.resolved_title || item.title_override || `Dashboard #${item.ref_id ?? idx + 1}` }}
                            </h3>
                            <span class="text-xs text-gray-400">#{{ idx + 1 }}</span>
                        </div>
                        <div v-if="item.dashboard_share_key" class="w-full rounded-xl overflow-hidden border border-gray-200 shadow-sm bg-white">
                            <iframe
                                :src="`/public-dashboard/${item.dashboard_share_key}`"
                                class="w-full"
                                style="height: 700px; border: none;"
                                loading="lazy"
                                :title="item.resolved_title || `Dashboard #${item.ref_id}`"
                            />
                        </div>
                        <div v-else class="flex flex-col items-center justify-center py-10 bg-white rounded-xl border border-dashed border-gray-300 text-center">
                            <font-awesome-icon :icon="['fas', 'lock']" class="text-3xl text-gray-300 mb-3" />
                            <p class="text-sm font-medium text-gray-500 mb-1">Dashboard not publicly shared</p>
                            <p class="text-xs text-gray-400">The owner needs to generate a public link for this dashboard to embed it here.</p>
                        </div>
                    </template>

                    <template v-else-if="item.item_type === 'text_block'">
                        <div class="mb-2 flex items-center gap-2">
                            <div class="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                                <font-awesome-icon :icon="['fas', 'align-left']" class="text-gray-400 text-xs" />
                            </div>
                            <h3 class="font-semibold text-gray-800 text-base print:text-sm">
                                {{ item.resolved_title || item.title_override || 'Text Block' }}
                            </h3>
                            <span class="text-xs text-gray-400">#{{ idx + 1 }}</span>
                        </div>
                        <TextBlock
                            v-if="item.payload?.markdown_content"
                            :model-value="item.payload.markdown_content"
                            :editable="false"
                        />
                        <div v-else class="text-sm text-gray-400 italic bg-white rounded-xl border border-dashed border-gray-300 p-4">
                            Empty text block
                        </div>
                    </template>

                    <template v-else-if="item.item_type === 'ai_insight'">
                        <div class="mb-2 flex items-center gap-2">
                            <div class="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                                <font-awesome-icon :icon="['fas', 'wand-magic-sparkles']" class="text-violet-400 text-xs" />
                            </div>
                            <h3 class="font-semibold text-gray-800 text-base print:text-sm">
                                {{ item.resolved_title || item.title_override || 'AI Insights' }}
                            </h3>
                            <span class="text-xs text-gray-400">#{{ idx + 1 }}</span>
                        </div>
                        <AiInsightsSection
                            v-if="item.payload?.report_id || item.payload?.data_model_id"
                            :data-model-id="item.payload?.data_model_id"
                            :report-id="item.payload?.report_id"
                            :show-refresh="false"
                            :show-summary="true"
                        />
                        <div v-else class="bg-white rounded-xl border border-dashed border-gray-300 p-6 text-center">
                            <font-awesome-icon :icon="['fas', 'wand-magic-sparkles']" class="text-2xl text-gray-300 mb-2" />
                            <p class="text-sm text-gray-400">No AI insights configured</p>
                        </div>
                    </template>

                    <template v-else-if="item.item_type === 'kpi_card'">
                        <div class="mb-2 flex items-center gap-2">
                            <div class="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                                <font-awesome-icon :icon="['fas', 'gauge-high']" class="text-emerald-400 text-xs" />
                            </div>
                            <h3 class="font-semibold text-gray-800 text-base print:text-sm">
                                {{ item.resolved_title || item.title_override || 'KPI Cards' }}
                            </h3>
                            <span class="text-xs text-gray-400">#{{ idx + 1 }}</span>
                        </div>
                        <KpiCardRow
                            v-if="item.payload?.data_model_id"
                            :data-model-id="item.payload.data_model_id"
                            :cards="item.payload?.cards"
                        />
                        <div v-else class="bg-white rounded-xl border border-dashed border-gray-300 p-6 text-center">
                            <font-awesome-icon :icon="['fas', 'gauge-high']" class="text-2xl text-gray-300 mb-2" />
                            <p class="text-sm text-gray-400">No KPI cards configured</p>
                        </div>
                    </template>

                    <template v-else-if="item.item_type === 'data_table'">
                        <div class="mb-2 flex items-center gap-2">
                            <div class="w-7 h-7 rounded-lg bg-cyan-50 flex items-center justify-center shrink-0">
                                <font-awesome-icon :icon="['fas', 'table']" class="text-cyan-400 text-xs" />
                            </div>
                            <h3 class="font-semibold text-gray-800 text-base print:text-sm">
                                {{ item.resolved_title || item.title_override || 'Data Table' }}
                            </h3>
                            <span class="text-xs text-gray-400">#{{ idx + 1 }}</span>
                        </div>
                        <ReportDataTable
                            :data-model-id="item.payload?.data_model_id ?? null"
                            :columns="item.payload?.columns ?? []"
                            :title="item.payload?.title ?? ''"
                        />
                    </template>

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

            <div v-else class="bg-white rounded-xl border border-gray-200 p-10 text-center">
                <font-awesome-icon :icon="['fas', 'layer-group']" class="text-4xl text-gray-200 mb-3" />
                <p class="text-sm text-gray-400">This report has no content items.</p>
            </div>

            <!-- Print-visible footer -->
            <div class="hidden print:block mt-6 pt-3 border-t border-gray-200 text-center">
                <p class="text-xs text-gray-400">
                    Shared via Data Research Analysis
                    <span v-if="report.share_expires_at">
                        &mdash; Expires {{ new Date(report.share_expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }}
                    </span>
                </p>
            </div>

            <!-- Interactive footer (hidden in print) -->
            <div class="mt-8 pt-6 border-t border-gray-200 text-center print:hidden">
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
