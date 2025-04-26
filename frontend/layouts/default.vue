<script setup>
import {useProjectsStore} from '@/stores/projects';
import { useDataSourceStore } from '@/stores/data_sources';
const projectsStore = useProjectsStore();
const dataSourceStore = useDataSourceStore();
const route = useRoute();
const state = reactive({
    authenticated: false,
})
watch(
  route,
  async (value, oldValue) => {
    state.authenticated = isAuthenticated();
    await projectsStore.retrieveProjects();
    await dataSourceStore.retrieveDataSources();
  },
);

onMounted(async () => {
    state.authenticated = isAuthenticated();
    await projectsStore.retrieveProjects();
    await dataSourceStore.retrieveDataSources();
})
</script>
<template>
    <div class="relative">
        <header-nav />
        <breadcrumbs v-if="state.authenticated" />
        <div class="flex "
            :class="{
                'flex-row': state.authenticated,
                'flex-col': !state.authenticated,
            }"
        >
            <!-- <sidebar v-if="state.authenticated" class="-mt-12 w-1/6"/> -->
            <div class="w-full">
                <slot></slot>
            </div>
        </div>
        <footer-nav />
    </div>
</template>