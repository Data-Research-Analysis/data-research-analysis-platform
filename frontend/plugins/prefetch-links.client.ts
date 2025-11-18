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
    const target = e.target as HTMLElement
    
    // Skip if inside editor or form elements to prevent interference during editing
    if (
      target.closest('[contenteditable="true"]') ||
      target.closest('.ProseMirror') ||
      target.closest('.tiptap') ||
      target.closest('.prose') ||
      target.closest('textarea') ||
      target.closest('input[type="text"]') ||
      target.closest('input[type="email"]') ||
      target.closest('form')
    ) {
      return
    }
    
    const link = target.closest('a')
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
    const currentPath = router.currentRoute.value.path
    
    // Skip prefetching on admin pages to avoid interference with editors
    if (currentPath.startsWith('/admin')) {
      console.log('[prefetch] Disabled on admin pages')
      return
    }
    
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
      const currentPath = router.currentRoute.value.path
      
      // Skip on admin pages
      if (currentPath.startsWith('/admin')) {
        return
      }
      
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
