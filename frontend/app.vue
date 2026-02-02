<script setup>
// SSR Performance Monitoring
const { trackPageLoad, logMetrics, checkPerformanceBudgets } = useSSRPerformance()

// Global structured data
const { getOrganizationSchema, injectSchema } = useStructuredData()

onMounted(() => {
  // Defer non-critical operations to improve FCP
  requestIdleCallback(() => {
    // Track page load performance metrics
    trackPageLoad()

    // Inject global organization schema
    if (import.meta.client) {
      injectSchema(getOrganizationSchema())
    }

    // Log metrics in development mode
    if (import.meta.dev) {
      setTimeout(() => {
        logMetrics()
        checkPerformanceBudgets()
      }, 3000) // Wait 3 seconds for all metrics to be collected
    }
  })
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
