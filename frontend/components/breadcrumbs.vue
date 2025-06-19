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
    route.fullPath.split('/').forEach((path, index) => {
        if (path && path !== '') {
            let breadCrumbText = routeName.split('-')[index - 1];
            if (breadCrumbText === 'projectid') {
                breadCrumbText = projectsStore.getSelectedProject()?.name || path?.replaceAll('-', ' ') || '';
            } else if (breadCrumbText === 'datasourceid') {
                breadCrumbText = dataSourceStore.getSelectedDataSource()?.name || path?.replaceAll('-', ' ') || '';
            } else {
                breadCrumbText = path?.replaceAll('-', ' ') || '';
            }
            url += `/${path}`;
            state.paths.push({
              path: path.replaceAll('-', ' '),
              url: url,
              isLast: index === route.fullPath.split('/').length - 1,
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
    <div class="grid grid-cols-3 md:flex md:flex-row bg-primary-blue-100 p-1">
        <span v-for="(path, index) in state.paths" class="text-md lg:text-lg text-white capitalize mt-5" :key="path.path">
             &nbsp; <NuxtLink :to="path.url" class="font-bold hover:text-gray-300">{{ path.breadCrumbText }}</NuxtLink> &nbsp; <template v-if="index < state.paths.length - 1">/</template>
        </span>

    </div>
</template>