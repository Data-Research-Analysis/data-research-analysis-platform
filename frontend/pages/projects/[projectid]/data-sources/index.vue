<script setup lang="ts">
// Redirect to project page - data sources are now shown on the main project page
const route = useRoute();
const router = useRouter();
const projectId = route.params.projectid;

// Immediate redirect
router.push(`/projects/${projectId}`);
</script>

<template>
  <!-- This page redirects to the project page -->
</template>
