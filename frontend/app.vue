<script setup>
// SSR Performance Monitoring
const { trackPageLoad, logMetrics, checkPerformanceBudgets } = useSSRPerformance()

onMounted(() => {
  // Track page load performance metrics
  trackPageLoad()

  // Log metrics in development mode
  if (import.meta.dev) {
    setTimeout(() => {
      logMetrics()
      checkPerformanceBudgets()
    }, 3000) // Wait 3 seconds for all metrics to be collected
  }
})
</script>

<template>
  <NuxtLayout>
    <div>
      <NuxtRouteAnnouncer />
      <NuxtPage />
    </div>
  </NuxtLayout>
</template>
