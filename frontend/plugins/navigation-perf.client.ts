export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter()
  
  let navigationStart = 0
  
  router.beforeEach((to, from) => {
    navigationStart = performance.now()
    console.log(`%c🚀 Navigation Start: ${from.path} → ${to.path}`, 'color: #3b82f6; font-weight: bold')
  })
  
  router.afterEach((to, from) => {
    const navigationEnd = performance.now()
    const duration = navigationEnd - navigationStart
    
    // Color code based on performance
    let color = '#10b981' // green - good
    let assessment = '✓ Excellent'
    
    if (duration > 200) {
      color = '#ef4444' // red - slow
      assessment = '⚠ Slow'
    } else if (duration > 100) {
      color = '#f59e0b' // orange - okay
      assessment = '⚡ Good'
    }
    
    console.log(
      `%c✓ Navigation Complete: ${to.path}`,
      `color: ${color}; font-weight: bold`,
      `\n  Duration: ${duration.toFixed(2)}ms ${assessment}`
    )
  })
})
