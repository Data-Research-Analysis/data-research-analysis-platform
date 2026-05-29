<script setup lang="ts">
/**
 * Campaign Drill-Down Page — CMP-001
 *
 * Route: /projects/:projectid/intelligence/campaigns/:campaignid
 *
 * Shows full campaign performance analysis when a user clicks a campaign
 * from the Campaign Performance Table.
 */
import { useMarketingHubStore } from '@/stores/marketingHub';
import { useDataModelsStore } from '@/stores/data_models';
import CampaignDrillDown from '@/components/intelligence/campaign/CampaignDrillDown.vue';

definePageMeta({ layout: 'project' });

const route = useRoute();
const router = useRouter();
const marketingHubStore = useMarketingHubStore();
const dataModelsStore = useDataModelsStore();

const projectId = computed(() => parseInt(String(route.params.projectid)));
const campaignId = computed(() => String(route.params.campaignid));

/** First data model ID for the current project */
const firstDataModelId = computed<number | null>(() => {
    const models = dataModelsStore.getDataModels();
    const projectModels = models.filter(
        (m: any) => m.data_source?.project_id === projectId.value
            || m.data_model_sources?.some((dms: any) => dms.data_source?.project_id === projectId.value),
    );
    return projectModels.length > 0 ? projectModels[0].id : null;
});

/** ISO date strings from the marketing hub store */
const isoStartDate = computed(() => marketingHubStore.dateRange.start.toISOString().split('T')[0]);
const isoEndDate = computed(() => marketingHubStore.dateRange.end.toISOString().split('T')[0]);

/** Campaign metadata from URL query params (passed from table click) */
const campaignName = computed(() => (route.query.name as string) || '');
const channel = computed(() => (route.query.channel as string) || '');

function handleBack() {
    router.push(`/projects/${projectId.value}/intelligence#campaigns`);
}

onMounted(async () => {
    await dataModelsStore.retrieveDataModels(projectId.value);
});
</script>

<template>
    <IntelligenceHubLayout>
        <div class="flex-1 min-w-0 p-4 md:p-6 overflow-y-auto">
            <CampaignDrillDown
                :data-model-id="firstDataModelId"
                :campaign-id="campaignId"
                :campaign-name="campaignName"
                :channel="channel"
                :start-date="isoStartDate"
                :end-date="isoEndDate"
                @back="handleBack"
            />
        </div>
    </IntelligenceHubLayout>
</template>
