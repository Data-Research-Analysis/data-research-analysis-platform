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
    const target = e.target as Node
    
    // Ensure we have an Element (text nodes don't have .closest())
    const element = target instanceof Element ? target : (target as Node).parentElement
    if (!element) return
    
    // Skip if inside editor or form elements to prevent interference during editing
    if (
      element.closest('[contenteditable="true"]') ||
      element.closest('.ProseMirror') ||
      element.closest('.tiptap') ||
      element.closest('.prose') ||
      element.closest('textarea') ||
      element.closest('input[type="text"]') ||
      element.closest('input[type="email"]') ||
      element.closest('form')
    ) {
      return
    }
    
    const link = element.closest('a')
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
      return
    }
    
    // Add hover listeners to all links
    document.addEventListener('mouseenter', handleMouseEnter, { capture: true, passive: true } as AddEventListenerOptions)
    
    // Observe all NuxtLinks in viewport
    const links = document.querySelectorAll('a[href^="/"]')
    links.forEach(link => observer.observe(link))
  }
  
  // Initialize when app is mounted (Nuxt app hook instead of onMounted)
  nuxtApp.hook('app:mounted', () => {
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
  
  // Cleanup when app is unmounted
  nuxtApp.hook('app:beforeUnmount', () => {
    document.removeEventListener('mouseenter', handleMouseEnter, { capture: true } as AddEventListenerOptions)
    observer.disconnect()
    if (hoverTimeout) clearTimeout(hoverTimeout)
  })
})
