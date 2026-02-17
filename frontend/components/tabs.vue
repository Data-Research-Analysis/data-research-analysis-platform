<script setup>
import { useDataModelsStore } from '@/stores/data_models';
import { useDataSourceStore } from '@/stores/data_sources';
const dataModelsStore = useDataModelsStore();
const dataSourceStore = useDataSourceStore();
const router = useRouter();
const route = useRoute();
const state = reactive({
    selectedTab: 'data_sources', // default tab
});
const props = defineProps({
    projectId: {
        type: Number,
        default: 0,
    },
});

const dataSourcesExist = computed(() => {
    if (!props.projectId) {
        console.log('[Tabs] No projectId provided');
        return false;
    }
    
    // Access reactive ref directly instead of calling getDataSources() which mutates state
    const allDataSources = dataSourceStore.dataSources;
    console.log('[Tabs] Checking data sources for projectId:', props.projectId);
    console.log('[Tabs] Total data sources in store:', allDataSources.length);
    
    const projectDataSources = allDataSources.filter((ds) => {
        const dsProjectId = ds.project_id || ds.project?.id;
        return dsProjectId === props.projectId;
    });
    
    console.log('[Tabs] Project data sources found:', projectDataSources.length);
    return projectDataSources.length > 0;
});

const dataModelsExist = computed(() => {
    if (!props.projectId) {
        console.log('[Tabs] No projectId provided');
        return false;
    }
    
    // Access reactive ref directly instead of calling getDataModels() which mutates state
    const allModels = dataModelsStore.dataModels;
    console.log('[Tabs] Checking models for projectId:', props.projectId);
    console.log('[Tabs] Total models in store:', allModels.length);
    
    // Log first model structure for debugging
    if (allModels.length > 0) {
        console.log('[Tabs] Sample model structure:', {
            id: allModels[0].id,
            name: allModels[0].name,
            data_source: allModels[0].data_source,
            data_model_sources: allModels[0].data_model_sources
        });
    }
    
    const projectModels = allModels.filter(model => {
        // Single-source models - check multiple paths
        if (model.data_source?.project?.id === props.projectId) {
            console.log('[Tabs] ✓ Found model via data_source.project.id:', model.name);
            return true;
        }
        
        // Check if data_source.project_id exists (direct foreign key)
        if (model.data_source?.project_id === props.projectId) {
            console.log('[Tabs] ✓ Found model via data_source.project_id:', model.name);
            return true;
        }
        
        // Cross-source/federated models
        if (model.data_model_sources?.some((dms) => 
            dms.data_source?.project?.id === props.projectId || 
            dms.data_source?.project_id === props.projectId)) {
            console.log('[Tabs] ✓ Found cross-source model:', model.name);
            return true;
        }
        
        console.log('[Tabs] ✗ Model did not match:', model.name, 'data_source:', model.data_source);
        return false;
    });
    
    console.log('[Tabs] Project models found:', projectModels.length);
    return projectModels.length > 0;
});
const isDashboardsRoute = computed(() => {
    return route.name === 'projects-projectid-dashboards-create' || route.name === 'projects-projectid-dashboards-dashboardid';
});
const emits = defineEmits(['update:selectedTab']);
function setSelectedTab(tab) {
    if (tab === 'data_sources') {
        router.push(`/projects/${props.projectId}`);
    } else if (tab === 'data_models') {
        router.push(`/projects/${props.projectId}/data-models`);
    } else if (tab === 'dashboards') {
        router.push(`/projects/${props.projectId}/dashboards`);
    } else if (tab === 'insights') {
        router.push(`/projects/${props.projectId}/insights`);
    }
}
onMounted(() => {
    // Use Nuxt's route.path instead of window.location for SSR compatibility
    const path = route.path;
    if (path.includes('insights')) {
        state.selectedTab = 'insights';
    } else if (path.includes('dashboards')) {
        state.selectedTab = 'dashboards';
    } else if (path.includes('data-models')) {
        state.selectedTab = 'data_models';
    } else {
        state.selectedTab = 'data_sources';
    }
})
</script>
<template>
    <div class="flex flex-row mt-5" :class="{ 'ml-10': !isDashboardsRoute }">
        <div class="bg-primary-blue-100 hover:bg-primary-blue-400 text-white p-3 border-r border-white border-solid rounded-tl-lg cursor-pointer font-bold select-none"
            @click="setSelectedTab('data_sources')"
            :class="{ 'bg-primary-blue-400': state.selectedTab === 'data_sources' }"
        >
            <font-awesome icon="fas fa-arrows-to-circle" class="text-xl text-white"/>
            Data Sources
        </div>
        
        <div v-if="dataSourcesExist" class="bg-primary-blue-100 hover:bg-primary-blue-400 text-white p-3 cursor-pointer font-bold select-none"
            @click="setSelectedTab('data_models')"
            :class="{ 'bg-primary-blue-400': state.selectedTab === 'data_models' }"
        >
            <font-awesome icon="fas fa-database" class="text-xl text-white"/>
            Data Models
        </div>
        <div v-else class="bg-gray-100 text-gray-500 p-3 border border-gray-500 border-solid font-bold select-none" v-tippy="{ content: 'Connect data sources in order to create data models', placement: 'top' }">
            <font-awesome icon="fas fa-database" class="text-xl text-gray-500"/>
            Data Models
        </div>

        <div v-if="dataSourcesExist" class="bg-primary-blue-100 hover:bg-primary-blue-400 text-white p-3 border-l border-white border-solid cursor-pointer font-bold select-none"
            @click="setSelectedTab('insights')"
            :class="{ 'bg-primary-blue-400': state.selectedTab === 'insights' }"
        >
            <font-awesome icon="fas fa-lightbulb" class="text-xl text-white"/>
            AI Insights
        </div>
        <div v-else class="bg-gray-100 text-gray-500 p-3 border border-gray-500 border-solid font-bold select-none" v-tippy="{ content: 'Connect data sources in order to generate AI insights', placement: 'top' }">
            <font-awesome icon="fas fa-lightbulb" class="text-xl text-gray-500"/>
            AI Insights
        </div>
        
        <div v-if="dataModelsExist" class="bg-primary-blue-100 hover:bg-primary-blue-400 text-white p-3 border-l border-white border-solid rounded-tr-lg cursor-pointer font-bold select-none"
            @click="setSelectedTab('dashboards')"
            :class="{ 'bg-primary-blue-400': state.selectedTab === 'dashboards' }"
        >
            <font-awesome icon="fas fa-table-columns" class="text-xl text-white"/>
            Dashboards
        </div>
        <div v-else class="bg-gray-100 text-gray-500 p-3 border border-gray-500 border-solid rounded-tr-lg font-bold select-none" v-tippy="{ content: 'Create data models in order to create dashboards', placement: 'top' }">
            <font-awesome icon="fas fa-table-columns" class="text-xl text-gray-500"/>
            Dashboards
        </div>
    </div>
</template>