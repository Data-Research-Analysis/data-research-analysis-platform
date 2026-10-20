<script setup lang="ts">
// Legacy route: /projects/:projectid/data-sources/* → /channels/*
const route = useRoute();
const tail = Array.isArray(route.params.path) ? route.params.path.join('/') : String(route.params.path ?? '');
const target = `/projects/${route.params.projectid}/channels/${tail}`;
await navigateTo(target, { redirectCode: 301 });
</script>

<template>
    <div></div>
</template>
