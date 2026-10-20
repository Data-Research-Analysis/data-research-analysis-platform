<script setup lang="ts">
definePageMeta({ layout: 'project' });

const route = useRoute();
const projectId = computed(() => parseInt(String(route.params.projectid)));
</script>

<template>
    <div class="flex-1 min-w-0 p-4 md:p-6 overflow-y-auto">
        <IntelligenceReports :project-id="projectId" />
    </div>
</template>
