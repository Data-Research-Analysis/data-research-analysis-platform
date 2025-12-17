<template>
  <div class="gam-dashboard-page">
    <GAMAdminDashboard />
  </div>
</template>

<script setup lang="ts">
import GAMAdminDashboard from '~/components/GAMAdminDashboard.vue';

// Set page metadata
useHead({
  title: 'Google Ad Manager Dashboard - Data Research Analysis',
  meta: [
    { name: 'description', content: 'Monitor and manage Google Ad Manager data synchronization' }
  ]
});
</script>

<style scoped>
.gam-dashboard-page {
  min-height: 100vh;
  background-color: #f3f4f6;
}
</style>
