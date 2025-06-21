<script setup>
import { useProjectsStore } from '@/stores/projects';
import { useDashboardsStore } from '~/stores/dashboards';
const projectsStore = useProjectsStore();
const dashboardsStore = useDashboardsStore();
const { $swal } = useNuxtApp();
const state = reactive({
    dashboards: [],

})
watch(
    dashboardsStore,
    (value, oldValue) => {
        getDashboards();
    },
)
const project = computed(() => {
    return projectsStore.getSelectedProject();
});
const dashboard = computed(() => {
    return dashboardsStore.getSelectedDashboard();
});
async function getDashboards() {
    state.dashboards = [];
    state.dashboards = dashboardsStore.getDashboards().filter((dashboardObj) => dashboardObj?.project?.id === project?.value?.id).map((dashboardObj) => {
        return {
            id: dashboardObj.id,
            dashboard: dashboardObj.data,
            project_id: dashboardObj.project_id,
            user_id: dashboardObj.user_platform_id,
        }
    });
    console.log("state.dashboards", state.dashboards);
    console.log("dashboardsStore.getDashboards()", dashboardsStore.getDashboards());
}
async function deleteDashboard(dashboardId) {
    const { value: confirmDelete } = await $swal.fire({
        title: "Are you sure you want to delete the dashboard?",
        text: "You won't be able to revert this!",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3C8DBC",
        cancelButtonColor: "#DD4B39",
        confirmButtonText: "Yes, delete it!",
    });
    if (!confirmDelete) {
        return;
    }
    const token = getAuthToken();
    const requestOptions = {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            "Authorization-Type": "auth",
        },
    };
    const response = await fetch(`${baseUrl()}/dashboards/delete/${dashboardId}`, requestOptions);
    if (response && response.status === 200) {
        const data = await response.json();
        $swal.fire(`The dashboard has been deleted successfully.`);
    } else {
        $swal.fire(`There was an error deleting the dashboard.`);
    }
    await dashboardsStore.retrieveDashboards();
    getDashboards();
}
onMounted(async () => {
    getDashboards();
})
</script>
<template>
    <div v-if="project && project.id" class="flex flex-col">
        <tabs :project-id="project.id"/>
        <div class="min-h-100 flex flex-col ml-4 mr-4 md:ml-10 md:mr-10 mb-10 border border-primary-blue-100 border-solid p-10 shadow-md">
            <div class="font-bold text-2xl mb-5">
                Dashboards
            </div>
            <div class="text-md">
                Data Models are part of the semantic data layer and will be the basis of the analysis that you will perform.
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 md:gap-10 lg:grid-cols-4 xl:grid-cols-5">
                <notched-card class="justify-self-center mt-10">
                    <template #body="{ onClick }">
                        <NuxtLink :to="`/projects/${project.id}/dashboards/create`">
                            <div class="flex flex-col justify-center text-md font-bold cursor-pointer items-center">
                                <div class="bg-gray-300 border border-gray-300 border-solid rounded-full w-20 h-20 flex items-center justify-center mb-5">
                                    <font-awesome icon="fas fa-plus" class="text-4xl text-gray-500" />
                                </div>
                                Create Dashboard
                            </div>
                        </NuxtLink>
                    </template>
                </notched-card>
                <div v-for="dashboard in state.dashboards" class="relative">
                    <notched-card class="justify-self-center mt-10">
                        <template #body="{ onClick }">
                            <NuxtLink :to="`/projects/${project.id}/dashboards/${dashboard.id}`" class="hover:text-gray-500 cursor-pointer">
                                <div class="flex flex-col justify-start h-full">
                                    <div class="text-md font-bold">
                                        Dashboard {{ dashboard.id }}
                                    </div>
                                    <div class="flex flex-row justify-between mt-4 mb-10">
                                        <ul class="text-xs">
                                            <li>Data Models</li>
                                        </ul>
                                    </div>
                                </div>
                            </NuxtLink>
                        </template>
                    </notched-card>
                    <div class="absolute top-5 -right-2 z-10 bg-gray-200 hover:bg-gray-300 border border-gray-200 border-solid rounded-full w-10 h-10 flex items-center justify-center mb-5 cursor-pointer" @click="deleteDashboard(dashboard.id)">
                        <font-awesome icon="fas fa-xmark" class="text-xl text-red-500 hover:text-red-400 select-none" />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
