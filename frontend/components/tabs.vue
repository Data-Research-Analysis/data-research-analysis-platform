<script setup>
import { useDataModelsStore } from '@/stores/data_models';
const dataModelsStore = useDataModelsStore();
const router = useRouter();
const state = reactive({
    selectedTab: 'data_sources', // default tab
});
const props = defineProps({
    projectId: {
        type: Number,
        default: 0,
    },

});
const dataModelsExist = computed(() => {
    return dataModelsStore.getDataModels().length > 0;
});
const emits = defineEmits(['update:selectedTab']);
function setSelectedTab(tab) {
    if (tab === 'data_sources') {
        router.push(`/projects/${props.projectId}`);
    } else if (tab === 'dashboards') {
        router.push(`/projects/${props.projectId}/dashboards`);
    }
}
onMounted(() => {
    const path = window.location.pathname;
    if (path.includes('dashboards')) {
        state.selectedTab = 'dashboards';
    } else {
        state.selectedTab = 'data_sources';
    }
})
</script>
<template>
    <div class="flex flex-row mt-5 ml-10">
        <div class="bg-primary-blue-100 hover:bg-primary-blue-400 text-white p-3 border border-white border-solid cursor-pointer font-bold select-none"
            @click="setSelectedTab('data_sources')"
            :class="{ 'bg-primary-blue-400': state.selectedTab === 'data_sources' }"
        >
            <font-awesome icon="fas fa-arrows-to-circle" class="text-xl text-white"/>
            Data Sources
        </div>        
        <div v-if="dataModelsExist" class="bg-primary-blue-100 hover:bg-primary-blue-400 text-white p-3 border border-white border-solid cursor-pointer font-bold select-none"
            @click="setSelectedTab('dashboards')"
            :class="{ 'bg-primary-blue-400': state.selectedTab === 'dashboards' }"
        >
            <font-awesome icon="fas fa-table-columns" class="text-xl text-white"/>
            Dashboards
        </div>
        <div v-else class="bg-gray-100 text-gray-500 p-3 border border-gray-500 border-solid font-bold select-none" v-tippy="{ content: 'Create data models in order to create dashboards', placement: 'top' }">
            <font-awesome icon="fas fa-table-columns" class="text-xl text-gray-500"/>
            Dashboards
        </div>
    </div>
</template>