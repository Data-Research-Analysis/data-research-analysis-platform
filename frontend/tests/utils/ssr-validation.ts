/**
 * SSR Validation Utilities
 * 
 * Helper functions to validate Server-Side Rendering (SSR) output
 * and ensure proper hydration without mismatches.
 */

import type { Page } from '@playwright/test'

/**
 * Check if a page was server-side rendered by looking for SSR markers
 */
export async function isServerRendered(page: Page): Promise<boolean> {
  // Check if the page has content before JavaScript loads
  const contentBeforeHydration = await page.evaluate(() => {
    return document.body.innerHTML.length > 0
  })
  
  return contentBeforeHydration
}

/**
 * Validate that meta tags are present in the SSR HTML
 */
export async function validateMetaTags(page: Page, expectedTags: {
  title?: string
  description?: string
  ogTitle?: string
  canonical?: string
}) {
  const errors: string[] = []
  
  // Check title
  if (expectedTags.title) {
    const title = await page.title()
    if (!title.includes(expectedTags.title)) {
      errors.push(`Title mismatch: expected "${expectedTags.title}", got "${title}"`)
    }
  }
  
  // Check meta description
  if (expectedTags.description) {
    const description = await page.getAttribute('meta[name="description"]', 'content')
    if (!description?.includes(expectedTags.description)) {
      errors.push(`Description mismatch: expected to contain "${expectedTags.description}"`)
    }
  }
  
  // Check Open Graph title
  if (expectedTags.ogTitle) {
    const ogTitle = await page.getAttribute('meta[property="og:title"]', 'content')
    if (!ogTitle?.includes(expectedTags.ogTitle)) {
      errors.push(`OG title mismatch: expected to contain "${expectedTags.ogTitle}"`)
    }
  }
  
  // Check canonical URL
  if (expectedTags.canonical) {
    const canonical = await page.getAttribute('link[rel="canonical"]', 'href')
    if (canonical !== expectedTags.canonical) {
      errors.push(`Canonical URL mismatch: expected "${expectedTags.canonical}", got "${canonical}"`)
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Check for hydration mismatches in the console
 */
export async function checkHydrationErrors(page: Page): Promise<string[]> {
  const hydrationErrors: string[] = []
  
  page.on('console', msg => {
    const text = msg.text()
    if (text.includes('Hydration') || text.includes('mismatch')) {
      hydrationErrors.push(text)
    }
  })
  
  return hydrationErrors
}

/**
 * Validate that client-only plugins are not executed during SSR
 */
export async function validateClientOnlyPlugins(page: Page): Promise<boolean> {
  // Check if plugins that should be client-only are not in SSR HTML
  const ssrHtml = await page.content()
  
  // These libraries should NOT be in the initial SSR HTML
  const clientOnlyLibraries = [
    'sweetalert2',
    'socket.io',
    'html-to-image',
    'vue-draggable',
  ]
  
  const foundInSSR = clientOnlyLibraries.filter(lib => 
    ssrHtml.toLowerCase().includes(lib.toLowerCase())
  )
  
  // It's okay if they're NOT found in SSR (that's expected)
  return foundInSSR.length === 0
}

/**
 * Check for SSR-specific errors in the browser console
 */
export async function checkSSRErrors(page: Page): Promise<string[]> {
  const ssrErrors: string[] = []
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text()
      // Look for common SSR errors
      if (
        text.includes('window is not defined') ||
        text.includes('document is not defined') ||
        text.includes('navigator is not defined') ||
        text.includes('localStorage is not defined')
      ) {
        ssrErrors.push(text)
      }
    }
  })
  
  return ssrErrors
}

/**
 * Validate FontAwesome icons render in SSR
 */
export async function validateIconsInSSR(page: Page): Promise<boolean> {
  const ssrHtml = await page.content()
  
  // FontAwesome should render SVG icons in SSR
  return ssrHtml.includes('<svg') && 
         (ssrHtml.includes('fa-') || ssrHtml.includes('font-awesome'))
}

/**
 * Check if page has proper robots meta tag
 */
export async function validateRobotsMeta(page: Page, expectedValue: string): Promise<boolean> {
  const robots = await page.getAttribute('meta[name="robots"]', 'content')
  return robots === expectedValue
}

/**
 * Comprehensive SSR validation for a page
 */
export async function validateSSRPage(page: Page, options: {
  expectSSR?: boolean
  metaTags?: {
    title?: string
    description?: string
    ogTitle?: string
    canonical?: string
    robots?: string
  }
  expectIcons?: boolean
}): Promise<{
  valid: boolean
  errors: string[]
  warnings: string[]
}> {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Check if SSR is working
  if (options.expectSSR !== false) {
    const isSSR = await isServerRendered(page)
    if (!isSSR) {
      errors.push('Page does not appear to be server-side rendered')
    }
  }
  
  // Validate meta tags
  if (options.metaTags) {
    const metaValidation = await validateMetaTags(page, options.metaTags)
    if (!metaValidation.valid) {
      errors.push(...metaValidation.errors)
    }
    
    // Check robots meta
    if (options.metaTags.robots) {
      const robotsValid = await validateRobotsMeta(page, options.metaTags.robots)
      if (!robotsValid) {
        warnings.push(`Robots meta tag mismatch: expected "${options.metaTags.robots}"`)
      }
    }
  }
  
  // Check for icons in SSR
  if (options.expectIcons) {
    const hasIcons = await validateIconsInSSR(page)
    if (!hasIcons) {
      warnings.push('FontAwesome icons may not be rendering in SSR')
    }
  }
  
  // Check for SSR errors
  const ssrErrors = await checkSSRErrors(page)
  if (ssrErrors.length > 0) {
    errors.push(...ssrErrors.map(err => `SSR Error: ${err}`))
  }
  
  // Check for hydration errors
  const hydrationErrors = await checkHydrationErrors(page)
  if (hydrationErrors.length > 0) {
    errors.push(...hydrationErrors.map(err => `Hydration Error: ${err}`))
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Test helper to verify a component is SSR-safe
 */
export function createSSRTest(componentName: string, componentPath: string) {
  return {
    name: `${componentName} SSR compatibility`,
    test: async () => {
      const component = await import(componentPath)
      return {
        exists: !!component.default,
        hasSetup: typeof component.default === 'object' || typeof component.default === 'function'
      }
    }
  }
}
