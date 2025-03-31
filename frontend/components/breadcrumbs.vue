<script setup>
const route = useRoute();
const state = reactive({
    paths: [],
})


function buildBreadcrumbs() {
    state.paths = [];
    state.authenticated = isAuthenticated();
    console.log('route', route);
    let url = '';
    route.fullPath.split('/').forEach((path, index) => {
        if (path !== '') {
            url += '/' + path;
            state.paths.push({
              path: path.replaceAll('-', ' '),
              url: url,
              isLast: index === route.fullPath.split('/').length - 1,
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
    <div class="flex flex-row static ml-63 mt-5">
        <span v-for="(path, index) in state.paths" class="text-md text-gray-500 capitalize" :key="path.path">
             &nbsp; <NuxtLink :to="path.url" class="font-bold hover:text-gray-300">{{ path.path }}</NuxtLink> &nbsp; <template v-if="index < state.paths.length - 1">/</template>
        </span>

    </div>
</template>