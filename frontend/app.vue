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
    
    // Cache warming - prefetch commonly accessed data in the background
    if (import.meta.client) {
      setTimeout(async () => {
        try {
          console.log('🔥 Starting cache warming...')
          
          // Import stores dynamically to avoid SSR issues
          const { useProjectsStore } = await import('@/stores/projects')
          const { useDataSourceStore } = await import('@/stores/data_sources')
          const { useLoggedInUserStore } = await import('@/stores/logged_in_user')
          
          const projectsStore = useProjectsStore()
          const dataSourcesStore = useDataSourceStore()
          const loggedInUserStore = useLoggedInUserStore()
          
          // Check if user is logged in
          const authToken = getAuthToken()
          if (!authToken) {
            console.log('⏭️  Cache warming skipped - user not logged in')
            return
          }
          
          // Warm up user data if not already loaded
          if (!loggedInUserStore.logged_in_user_email) {
            await loggedInUserStore.retrieveLoggedInUser().catch(err => {
              console.warn('Cache warming: Failed to prefetch user data', err)
            })
          }
          
          // Warm up projects if not already loaded
          if (projectsStore.projects.length === 0) {
            await projectsStore.retrieveProjects().catch(err => {
              console.warn('Cache warming: Failed to prefetch projects', err)
            })
          }
          
          // Warm up data sources for the first project (if exists)
          if (projectsStore.projects.length > 0 && dataSourcesStore.data_sources.length === 0) {
            await dataSourcesStore.retrieveDataSources().catch(err => {
              console.warn('Cache warming: Failed to prefetch data sources', err)
            })
          }
          
          console.log('✅ Cache warming completed')
        } catch (error) {
          console.warn('Cache warming error:', error)
        }
      }, 1500) // Wait 1.5 seconds after idle to avoid blocking user interactions
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
