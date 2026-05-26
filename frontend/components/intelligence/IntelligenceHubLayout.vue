<script setup lang="ts">
/**
 * IntelligenceHubLayout — shared layout wrapper for the Intelligence Hub.
 *
 * Provides the page shell (header, breadcrumb-friendly title, content slot)
 * used by every tab inside /projects/:projectid/intelligence/.
 */
interface Props {
    /** Whether the tab content is still loading */
    isLoading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
    isLoading: false,
});
</script>

<template>
    <div class="intelligence-hub-layout min-h-full">
        <slot />
    </div>
</template>

<style scoped>
.intelligence-hub-layout {
    display: flex;
    flex-direction: column;
}
</style>