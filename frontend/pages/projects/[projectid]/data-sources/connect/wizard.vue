<template>
    <div class="wizard-page">
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

<style scoped>
.wizard-page {
    min-height: 100vh;
    background: #f9fafb;
}
</style>