export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter()
  const prefetchedRoutes = new Set<string>()
  
  // Debounce helper
  let hoverTimeout: ReturnType<typeof setTimeout> | null = null
  
  // Prefetch route helper
  const prefetchRoute = async (path: string) => {
    if (!path || prefetchedRoutes.has(path) || path === router.currentRoute.value.path) {
      return
    }
    
    prefetchedRoutes.add(path)
    
    try {
      // Use Nuxt's preloadRouteComponents to prefetch
      await preloadRouteComponents(path)
    } catch (error) {
      // Remove from set if prefetch fails
      prefetchedRoutes.delete(path)
    }
  }
  
  // Hover prefetching
  const handleMouseEnter = (e: MouseEvent) => {
    const link = (e.target as HTMLElement).closest('a')
    if (!link) return
    
    const href = link.getAttribute('href')
    if (!href || href.startsWith('http') || href.startsWith('#')) return
    
    // Debounce to avoid excessive prefetching
    if (hoverTimeout) clearTimeout(hoverTimeout)
    hoverTimeout = setTimeout(() => {
      prefetchRoute(href)
    }, 100)
  }
  
  // Viewport prefetching with Intersection Observer
  const observerOptions = {
    rootMargin: '50px'
  }
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const link = entry.target as HTMLAnchorElement
        const href = link.getAttribute('href')
        if (href && !href.startsWith('http') && !href.startsWith('#')) {
          prefetchRoute(href)
        }
      }
    })
  }, observerOptions)
  
  // Initialize observers
  const initializePrefetching = () => {
    // Add hover listeners to all links
    document.addEventListener('mouseenter', handleMouseEnter, { capture: true, passive: true })
    
    // Observe all NuxtLinks in viewport
    const links = document.querySelectorAll('a[href^="/"]')
    links.forEach(link => observer.observe(link))
  }
  
  // Initialize on mount
  onMounted(() => {
    initializePrefetching()
  })
  
  // Re-initialize after route changes (new links may be added)
  router.afterEach(() => {
    nextTick(() => {
      const links = document.querySelectorAll('a[href^="/"]')
      links.forEach(link => {
        if (!observer) return
        observer.observe(link)
      })
    })
  })
  
  // Cleanup
  onBeforeUnmount(() => {
    document.removeEventListener('mouseenter', handleMouseEnter, { capture: true })
    observer.disconnect()
    if (hoverTimeout) clearTimeout(hoverTimeout)
  })
})
