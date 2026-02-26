<script setup lang="ts">
definePageMeta({ layout: 'marketing-project' });

const route = useRoute();
const activeTab = ref<'my-reports' | 'templates'>('my-reports');

const projectId = computed(() => parseInt(String(route.params.projectid)));

// Support ?tab=templates deep-link (e.g. from sidebar "Dashboard Templates" link)
onMounted(() => {
    if (route.query.tab === 'templates') {
        activeTab.value = 'templates';
    }
});
</script>

<template>
    <div class="flex flex-col">
        <!-- Tab header -->
        <div class="flex border-b border-gray-200 mb-6">
            <button
                class="px-6 py-3 text-sm font-medium transition-colors"
                :class="activeTab === 'my-reports'
                    ? 'border-b-2 border-primary-blue-300 text-primary-blue-300'
                    : 'text-gray-500 hover:text-gray-700'"
                @click="activeTab = 'my-reports'"
            >
                <font-awesome-icon :icon="['fas', 'chart-bar']" class="mr-2" />
                My Reports
            </button>
            <button
                class="px-6 py-3 text-sm font-medium transition-colors"
                :class="activeTab === 'templates'
                    ? 'border-b-2 border-primary-blue-300 text-primary-blue-300'
                    : 'text-gray-500 hover:text-gray-700'"
                @click="activeTab = 'templates'"
            >
                <font-awesome-icon :icon="['fas', 'layer-group']" class="mr-2" />
                Templates
            </button>
        </div>

        <!-- My Reports tab -->
        <div v-if="activeTab === 'my-reports'">
            <tab-content-panel :corners="['top-right', 'bottom-left', 'bottom-right']">
                <div class="flex justify-between items-center mb-4">
                    <h2 class="font-bold text-2xl">My Reports</h2>
                    <NuxtLink
                        :to="`/marketing-projects/${projectId}/dashboards`"
                        class="inline-flex items-center px-4 py-2 bg-primary-blue-300 hover:bg-primary-blue-100 text-white rounded-lg transition-colors text-sm"
                    >
                        <font-awesome-icon :icon="['fas', 'arrow-left']" class="mr-2" />
                        Go to Dashboards
                    </NuxtLink>
                </div>
                <p class="text-sm text-gray-500 mb-6">
                    Your saved marketing dashboards and reports for this project.
                </p>
                <div class="text-center py-12 text-gray-400">
                    <font-awesome-icon :icon="['fas', 'chart-bar']" class="text-5xl mb-4" />
                    <p class="text-lg font-medium text-gray-600">View all your dashboards</p>
                    <p class="text-sm mt-2">
                        All dashboards for this project are available from the
                        <NuxtLink
                            :to="`/marketing-projects/${projectId}/dashboards`"
                            class="text-primary-blue-300 hover:underline"
                        >
                            Dashboards
                        </NuxtLink>
                        section.
                    </p>
                </div>
            </tab-content-panel>
        </div>

        <!-- Templates tab -->
        <div v-if="activeTab === 'templates'">
            <DashboardTemplateGallery :project-id="projectId" />
        </div>
    </div>
</template>
