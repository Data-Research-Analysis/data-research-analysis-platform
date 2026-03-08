export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter()
  
  let navigationStart = 0
  
  router.beforeEach((to, from) => {
    navigationStart = performance.now()
  })
  
  router.afterEach((to, from) => {
    const navigationEnd = performance.now()
    const duration = navigationEnd - navigationStart
    
    // Track navigation performance metrics
    // Duration: navigationEnd - navigationStart
  })
})
