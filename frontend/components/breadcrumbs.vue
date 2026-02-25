<script setup>
import { useProjectsStore } from '@/stores/projects';
import { useDataSourceStore } from '@/stores/data_sources';
const projectsStore = useProjectsStore();
const dataSourceStore = useDataSourceStore();
const route = useRoute();
const state = reactive({
    paths: [],
})


function buildBreadcrumbs() {
    state.paths = [];
    state.authenticated = isAuthenticated();
    let url = '';
    //for this method change the name of the route data-sources to datasources so that it is not split into two parts
    //this is a workaround for the issue with the route name being split into two parts
    const routeName = route?.name?.replaceAll('data-sources', 'datasources');
    if (!routeName) {
        return;
    }
    const pathSegments = route.fullPath.split('/');
    pathSegments.forEach((path, index) => {
        if (path && path !== '') {
            let breadCrumbText = routeName.split('-')[index - 1];
            if (breadCrumbText === 'projectid') {
                breadCrumbText = projectsStore.getSelectedProject()?.name || path?.replaceAll('-', ' ') || '';
            } else if (breadCrumbText === 'datasourceid') {
                breadCrumbText = dataSourceStore.getSelectedDataSource()?.name || path?.replaceAll('-', ' ') || '';
            } else {
                breadCrumbText = path?.replaceAll('-', ' ') || '';
            }
            
            // Check if previous segment was a data model ID and current is 'edit'
            const prevSegment = pathSegments[index - 1];
            const nextSegment = pathSegments[index + 1];
            const isDataModelId = prevSegment === 'data-models' && !isNaN(path);
            const isEditAfterDataModel = path === 'edit' && prevSegment && !isNaN(prevSegment) && pathSegments[index - 2] === 'data-models';
            
            // Don't add 'edit' to URL if we already added it in the previous iteration for data model ID
            if (!isEditAfterDataModel) {
                url += `/${path}`;
            }
            
            // For data model IDs followed by 'edit', append /edit to URL
            if (isDataModelId && nextSegment === 'edit') {
                url += '/edit';
            }
            
            state.paths.push({
              path: path.replaceAll('-', ' '),
              url: url,
              isLast: index === pathSegments.length - 1,
              breadCrumbText: breadCrumbText,
            });
        }
    });
}

watch(
  route,
  (value, oldValue) => {
    buildBreadcrumbs();
  },
);

onMounted(() => {
    buildBreadcrumbs();
})
</script>
<template>
    <div class="min-h-20 flex flex-row items-center flex-wrap bg-primary-blue-100 px-4 py-3 pt-8 gap-y-1">
        <span v-for="(path, index) in state.paths" :key="path.path" class="flex items-center text-sm md:text-base lg:text-lg text-white capitalize">
            <NuxtLink :to="path.url" class="font-bold hover:text-gray-300 px-1">{{ path.breadCrumbText }}</NuxtLink>
            <span v-if="index < state.paths.length - 1" class="text-blue-200 pr-1">/</span>
        </span>
    </div>
</template>