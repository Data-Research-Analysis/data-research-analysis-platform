<script setup lang="ts">
definePageMeta({ layout: 'project' });

const route = useRoute();
const projectId = computed(() => parseInt(String(route.params.projectid)));
</script>

<template>
    <IntelligenceReports :project-id="projectId" />
</template>
