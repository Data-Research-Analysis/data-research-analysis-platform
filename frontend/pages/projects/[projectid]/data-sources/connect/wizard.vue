<template>
    <div class="min-h-screen bg-gray-50">
        <ConnectionWizard />
    </div>
</template>

<script setup lang="ts">
import ConnectionWizard from '~/components/connection-wizard/ConnectionWizard.vue';

definePageMeta({
    layout: 'project',
});

useHead({
    title: 'Smart Connection Wizard — Data Research Analysis',
});
</script>

