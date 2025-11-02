/**
 * SSR Performance Monitoring Composable
 * 
 * Tracks key performance metrics for SSR applications:
 * - TTFB (Time to First Byte)
 * - FCP (First Contentful Paint)
 * - LCP (Largest Contentful Paint)
 * - Hydration Time
 * - Total Blocking Time (TBT)
 * 
 * Usage:
 * const { trackPageLoad, getMetrics } = useSSRPerformance()
 * trackPageLoad()
 * const metrics = getMetrics()
 */

export interface SSRMetrics {
  ttfb: number | null
  fcp: number | null
  lcp: number | null
  hydrationTime: number | null
  tbt: number | null
  timestamp: number
  url: string
}

export const useSSRPerformance = () => {
  const metrics = ref<SSRMetrics>({
    ttfb: null,
    fcp: null,
    lcp: null,
    hydrationTime: null,
    tbt: null,
    timestamp: Date.now(),
    url: ''
  })

  const hydrationStart = ref<number | null>(null)

  /**
   * Track Time to First Byte (TTFB)
   * Measures server response time
   */
  const trackTTFB = () => {
    if (!import.meta.client) return

    try {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      if (navigation) {
        metrics.value.ttfb = navigation.responseStart - navigation.requestStart
      }
    } catch (error) {
      console.warn('Failed to track TTFB:', error)
    }
  }

  /**
   * Track First Contentful Paint (FCP)
   * Measures when first content is rendered
   */
  const trackFCP = () => {
    if (!import.meta.client) return

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const fcpEntry = entries.find(entry => entry.name === 'first-contentful-paint')
        
        if (fcpEntry) {
          metrics.value.fcp = fcpEntry.startTime
          observer.disconnect()
        }
      })

      observer.observe({ entryTypes: ['paint'] })
    } catch (error) {
      console.warn('Failed to track FCP:', error)
    }
  }

  /**
   * Track Largest Contentful Paint (LCP)
   * Measures when largest content element is rendered
   */
  const trackLCP = () => {
    if (!import.meta.client) return

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const lastEntry = entries[entries.length - 1]
        
        if (lastEntry) {
          metrics.value.lcp = lastEntry.startTime
        }
      })

      observer.observe({ entryTypes: ['largest-contentful-paint'] })

      // Disconnect after 10 seconds (LCP should be captured by then)
      setTimeout(() => observer.disconnect(), 10000)
    } catch (error) {
      console.warn('Failed to track LCP:', error)
    }
  }

  /**
   * Track Total Blocking Time (TBT)
   * Measures main thread blocking time
   */
  const trackTBT = () => {
    if (!import.meta.client) return

    try {
      let totalBlockingTime = 0

      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        
        entries.forEach((entry: any) => {
          if (entry.duration > 50) {
            totalBlockingTime += entry.duration - 50
          }
        })

        metrics.value.tbt = totalBlockingTime
      })

      observer.observe({ entryTypes: ['longtask'] })

      // Disconnect after 10 seconds
      setTimeout(() => observer.disconnect(), 10000)
    } catch (error) {
      console.warn('Failed to track TBT:', error)
    }
  }

  /**
   * Start tracking hydration time
   * Call this at the start of app initialization
   */
  const startHydrationTracking = () => {
    if (!import.meta.client) return
    hydrationStart.value = performance.now()
  }

  /**
   * End tracking hydration time
   * Call this after Vue app is fully hydrated
   */
  const endHydrationTracking = () => {
    if (!import.meta.client || !hydrationStart.value) return

    metrics.value.hydrationTime = performance.now() - hydrationStart.value
    console.log(`Hydration completed in ${metrics.value.hydrationTime.toFixed(2)}ms`)
  }

  /**
   * Track all page load metrics
   * Call this on page mount or in app.vue
   */
  const trackPageLoad = () => {
    if (!import.meta.client) return

    metrics.value.url = window.location.href
    metrics.value.timestamp = Date.now()

    // Start hydration tracking immediately
    startHydrationTracking()

    // Track metrics after page load
    if (document.readyState === 'complete') {
      trackTTFB()
      trackFCP()
      trackLCP()
      trackTBT()
      endHydrationTracking()
    } else {
      window.addEventListener('load', () => {
        trackTTFB()
        trackFCP()
        trackLCP()
        trackTBT()
        endHydrationTracking()
      })
    }
  }

  /**
   * Get current metrics
   */
  const getMetrics = (): SSRMetrics => {
    return { ...metrics.value }
  }

  /**
   * Log metrics to console (useful for debugging)
   */
  const logMetrics = () => {
    if (!import.meta.client) return

    console.group('🚀 SSR Performance Metrics')
    console.log(`URL: ${metrics.value.url}`)
    console.log(`TTFB: ${metrics.value.ttfb?.toFixed(2) || 'N/A'}ms`)
    console.log(`FCP: ${metrics.value.fcp?.toFixed(2) || 'N/A'}ms`)
    console.log(`LCP: ${metrics.value.lcp?.toFixed(2) || 'N/A'}ms`)
    console.log(`Hydration Time: ${metrics.value.hydrationTime?.toFixed(2) || 'N/A'}ms`)
    console.log(`TBT: ${metrics.value.tbt?.toFixed(2) || 'N/A'}ms`)
    console.groupEnd()
  }

  /**
   * Send metrics to analytics endpoint
   * @param endpoint - API endpoint to send metrics to
   */
  const sendMetricsToAnalytics = async (endpoint: string) => {
    if (!import.meta.client) return

    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metrics.value),
      })
    } catch (error) {
      console.warn('Failed to send metrics to analytics:', error)
    }
  }

  /**
   * Check if metrics meet performance budgets
   */
  const checkPerformanceBudgets = () => {
    if (!import.meta.client) return

    const budgets = {
      ttfb: 600,      // 600ms
      fcp: 1800,      // 1.8s
      lcp: 2500,      // 2.5s
      hydrationTime: 1000, // 1s
      tbt: 300,       // 300ms
    }

    const warnings: string[] = []

    if (metrics.value.ttfb && metrics.value.ttfb > budgets.ttfb) {
      warnings.push(`⚠️ TTFB (${metrics.value.ttfb.toFixed(2)}ms) exceeds budget (${budgets.ttfb}ms)`)
    }
    if (metrics.value.fcp && metrics.value.fcp > budgets.fcp) {
      warnings.push(`⚠️ FCP (${metrics.value.fcp.toFixed(2)}ms) exceeds budget (${budgets.fcp}ms)`)
    }
    if (metrics.value.lcp && metrics.value.lcp > budgets.lcp) {
      warnings.push(`⚠️ LCP (${metrics.value.lcp.toFixed(2)}ms) exceeds budget (${budgets.lcp}ms)`)
    }
    if (metrics.value.hydrationTime && metrics.value.hydrationTime > budgets.hydrationTime) {
      warnings.push(`⚠️ Hydration (${metrics.value.hydrationTime.toFixed(2)}ms) exceeds budget (${budgets.hydrationTime}ms)`)
    }
    if (metrics.value.tbt && metrics.value.tbt > budgets.tbt) {
      warnings.push(`⚠️ TBT (${metrics.value.tbt.toFixed(2)}ms) exceeds budget (${budgets.tbt}ms)`)
    }

    if (warnings.length > 0) {
      console.group('⚠️ Performance Budget Warnings')
      warnings.forEach(warning => console.warn(warning))
      console.groupEnd()
    } else {
      console.log('✅ All performance budgets met!')
    }

    return warnings
  }

  return {
    metrics: readonly(metrics),
    trackPageLoad,
    startHydrationTracking,
    endHydrationTracking,
    getMetrics,
    logMetrics,
    sendMetricsToAnalytics,
    checkPerformanceBudgets,
  }
}
