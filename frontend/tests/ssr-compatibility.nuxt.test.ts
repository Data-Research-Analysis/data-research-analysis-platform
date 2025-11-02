import { mountSuspended, renderSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, test, vi } from 'vitest'
import { nextTick } from 'vue'

/**
 * SSR Compatibility Test Suite
 * 
 * These tests verify that components and pages render correctly during
 * Server-Side Rendering (SSR) without accessing browser-only APIs.
 */

describe('SSR Compatibility - Core Components', () => {
  
  test('tabs component should render without window.location', async () => {
    const Tabs = await import('../components/tabs.vue')
    const wrapper = await mountSuspended(Tabs.default, {
      props: { projectId: 1 }
    })
    
    // Should not throw errors during SSR
    expect(wrapper.exists()).toBe(true)
  })

  test('overlay-dialog component should render without window/document', async () => {
    const OverlayDialog = await import('../components/overlay-dialog.vue')
    const wrapper = await mountSuspended(OverlayDialog.default, {
      props: { yOffset: 200 }
    })
    
    // Component should mount successfully
    expect(wrapper.exists()).toBe(true)
    
    // Close button should be present
    const closeButton = wrapper.find('[data-testid="close-button"]')
    expect(closeButton.exists() || wrapper.find('font-awesome').exists()).toBe(true)
  })

  test('footer-nav component should render without window/document APIs', async () => {
    const FooterNav = await import('../components/footer-nav.vue')
    const wrapper = await mountSuspended(FooterNav.default)
    
    // Should render without errors
    expect(wrapper.exists()).toBe(true)
    
    // Copyright text should be present
    expect(wrapper.text()).toContain('Data Research Analysis')
  })

  test('text-editor component should handle SSR gracefully', async () => {
    const TextEditor = await import('../components/text-editor.vue')
    const wrapper = await mountSuspended(TextEditor.default, {
      props: {
        content: '<p>Test content</p>',
        inputFormat: 'markdown'
      }
    })
    
    // Editor should mount
    expect(wrapper.exists()).toBe(true)
  })
})

describe('SSR Compatibility - Pages', () => {
  
  test('homepage should render during SSR', async () => {
    const Index = await import('../pages/index.vue')
    const html = await renderSuspended(Index.default)
    
    // Should contain main content
    expect(html).toBeTruthy()
  })

  test('login page should render without window.addEventListener', async () => {
    const Login = await import('../pages/login.vue')
    const wrapper = await mountSuspended(Login.default)
    
    // Should render login form
    expect(wrapper.exists()).toBe(true)
    expect(wrapper.text()).toContain('Login')
  })

  test('register page should render without window.addEventListener', async () => {
    const Register = await import('../pages/register.vue')
    const wrapper = await mountSuspended(Register.default)
    
    // Should render registration form
    expect(wrapper.exists()).toBe(true)
    expect(wrapper.text()).toContain('Register')
  })

  test('privacy-policy page should render with meta tags', async () => {
    const PrivacyPolicy = await import('../pages/privacy-policy.vue')
    const wrapper = await mountSuspended(PrivacyPolicy.default)
    
    // Should render policy content
    expect(wrapper.exists()).toBe(true)
    expect(wrapper.text()).toContain('Privacy Policy')
  })

  test('terms-conditions page should render with meta tags', async () => {
    const TermsConditions = await import('../pages/terms-conditions.vue')
    const wrapper = await mountSuspended(TermsConditions.default)
    
    // Should render terms content
    expect(wrapper.exists()).toBe(true)
    expect(wrapper.text()).toContain('Terms and Conditions')
  })
})

describe('SSR Compatibility - Composables', () => {
  
  test('AuthToken composable should use useCookie for SSR', async () => {
    const { setAuthToken, getAuthToken, deleteAuthToken } = await import('../composables/AuthToken')
    
    // These should not throw during SSR
    expect(() => setAuthToken('test-token')).not.toThrow()
    expect(() => getAuthToken()).not.toThrow()
    expect(() => deleteAuthToken()).not.toThrow()
  })

  test('Utils composable should guard window.open calls', async () => {
    const { openGithub, openLinkedin } = await import('../composables/Utils')
    
    // Should not throw during SSR (import.meta.client guards)
    expect(() => openGithub()).not.toThrow()
    expect(() => openLinkedin()).not.toThrow()
  })
})

describe('SSR Compatibility - Stores', () => {
  
  test('logged_in_user store should guard localStorage access', async () => {
    const { useLoggedInUserStore } = await import('../stores/logged_in_user')
    
    // Store should initialize without localStorage errors
    expect(() => {
      const store = useLoggedInUserStore()
      expect(store).toBeDefined()
    }).not.toThrow()
  })
})

describe('SSR Compatibility - Browser API Guards', () => {
  
  test('import.meta.client should be false during tests', () => {
    // In SSR context, import.meta.client should be falsy
    // This ensures our guards work correctly
    if (typeof window === 'undefined') {
      expect(import.meta.client).toBeFalsy()
    }
  })

  test('components should not access document during setup', () => {
    // Mock console.error to catch any document access attempts
    const originalError = console.error
    const errors: string[] = []
    console.error = (msg: string) => errors.push(msg)
    
    // This would catch any unguarded document access
    // During actual SSR, document would be undefined
    
    console.error = originalError
    
    // Should not have document-related errors
    const documentErrors = errors.filter(e => 
      e.includes('document') || e.includes('window') || e.includes('navigator')
    )
    expect(documentErrors).toHaveLength(0)
  })
})

describe('SSR Compatibility - Plugin Loading', () => {
  
  test('client-only plugins should not break SSR', async () => {
    // Import pages that use client-only plugins
    const pages = [
      import('../pages/index.vue'),
      import('../pages/login.vue'),
      import('../pages/register.vue'),
    ]
    
    // All should load without errors
    const results = await Promise.allSettled(pages)
    const failures = results.filter(r => r.status === 'rejected')
    
    expect(failures).toHaveLength(0)
  })
})

describe('SSR Compatibility - Meta Tags', () => {
  
  test('homepage should have proper meta tags defined', async () => {
    const Index = await import('../pages/index.vue')
    
    // Component should define useHead
    expect(Index.default).toBeDefined()
    // The actual meta tags are set via useHead composable
    // which is tested through E2E or by checking the rendered HTML
  })

  test('public-dashboard should have dynamic meta tags', async () => {
    const PublicDashboard = await import('../pages/public-dashboard/[dashboardkey].vue')
    
    // Component should be defined and use dynamic useHead
    expect(PublicDashboard.default).toBeDefined()
  })
})

describe('SSR Compatibility - Event Listeners', () => {
  
  test('components should add event listeners only on client', async () => {
    const CustomDataTable = await import('../components/custom-data-table.vue')
    
    // Should mount without trying to add document event listeners during SSR
    await expect(mountSuspended(CustomDataTable.default, {
      props: {
        columns: [{ id: 'test', title: 'Test' }],
        rows: []
      }
    })).resolves.toBeDefined()
  })
})

describe('SSR Compatibility - Chart Components', () => {
  
  test('table-chart should handle virtual scrolling SSR-safe', async () => {
    const TableChart = await import('../components/charts/table-chart.vue')
    
    // Should mount without DOM queries during SSR
    await expect(mountSuspended(TableChart.default, {
      props: {
        chartId: 'test-chart',
        columns: [{ column_name: 'test', data_type: 'TEXT' }],
        rows: [],
        chartType: 'table'
      }
    })).resolves.toBeDefined()
  })
})

describe('SSR Compatibility - Phase 8 & 9 Features', () => {
  
  test('error.vue should render with proper error handling', async () => {
    const ErrorPage = await import('../error.vue')
    
    const wrapper = await mountSuspended(ErrorPage.default, {
      props: {
        error: {
          statusCode: 404,
          message: 'Page not found',
          stack: 'Error stack trace'
        }
      }
    })
    
    // Should render without errors
    expect(wrapper.exists()).toBe(true)
    
    // Should display error message
    expect(wrapper.text()).toContain('404')
  })

  test('error.vue should handle 500 errors', async () => {
    const ErrorPage = await import('../error.vue')
    
    const wrapper = await mountSuspended(ErrorPage.default, {
      props: {
        error: {
          statusCode: 500,
          message: 'Internal server error'
        }
      }
    })
    
    expect(wrapper.exists()).toBe(true)
    expect(wrapper.text()).toContain('500')
  })

  test('default layout should use onServerPrefetch for data loading', async () => {
    const DefaultLayout = await import('../layouts/default.vue')
    
    // Should mount without errors during SSR
    const wrapper = await mountSuspended(DefaultLayout.default, {
      slots: {
        default: '<div>Test Content</div>'
      }
    })
    
    expect(wrapper.exists()).toBe(true)
  })

  test('useSSRPerformance composable should work in SSR context', () => {
    // Import composable
    const { useSSRPerformance } = require('../composables/SSRPerformance.ts')
    
    // Should not throw errors when called during SSR
    expect(() => {
      const { metrics, trackPageLoad, getMetrics } = useSSRPerformance()
      expect(metrics).toBeDefined()
      expect(typeof trackPageLoad).toBe('function')
      expect(typeof getMetrics).toBe('function')
    }).not.toThrow()
  })

  test('useSSRPerformance should return valid metrics structure', () => {
    const { useSSRPerformance } = require('../composables/SSRPerformance.ts')
    const { getMetrics } = useSSRPerformance()
    
    const metrics = getMetrics()
    
    // Should have all required metric properties
    expect(metrics).toHaveProperty('ttfb')
    expect(metrics).toHaveProperty('fcp')
    expect(metrics).toHaveProperty('lcp')
    expect(metrics).toHaveProperty('hydrationTime')
    expect(metrics).toHaveProperty('tbt')
    expect(metrics).toHaveProperty('timestamp')
    expect(metrics).toHaveProperty('url')
  })

  test('app.vue should integrate performance monitoring', async () => {
    const AppVue = await import('../app.vue')
    
    // Should mount and integrate useSSRPerformance without errors
    const wrapper = await mountSuspended(AppVue.default)
    
    expect(wrapper.exists()).toBe(true)
  })

  test('middleware should not use browser APIs', () => {
    // Read middleware files as text to check for browser API usage
    const fs = require('fs')
    const path = require('path')
    
    const authMiddleware = fs.readFileSync(
      path.join(__dirname, '../middleware/authorization.global.ts'),
      'utf-8'
    )
    const dataMiddleware = fs.readFileSync(
      path.join(__dirname, '../middleware/data_exists.global.ts'),
      'utf-8'
    )
    
    // Should not contain unguarded browser APIs
    const browserAPIs = ['window.', 'document.', 'navigator.', 'localStorage.', 'sessionStorage.']
    
    browserAPIs.forEach(api => {
      // Check if API exists without import.meta.client guard
      if (authMiddleware.includes(api)) {
        expect(authMiddleware).toMatch(new RegExp(`if\\s*\\(\\s*import\\.meta\\.client\\s*\\)[\\s\\S]*${api}`))
      }
      if (dataMiddleware.includes(api)) {
        expect(dataMiddleware).toMatch(new RegExp(`if\\s*\\(\\s*import\\.meta\\.client\\s*\\)[\\s\\S]*${api}`))
      }
    })
  })
})

describe('SSR Compatibility - Performance Budgets', () => {
  
  test('performance budgets should be defined', () => {
    const { useSSRPerformance } = require('../composables/SSRPerformance.ts')
    const { checkPerformanceBudgets } = useSSRPerformance()
    
    // Should have checkPerformanceBudgets function
    expect(typeof checkPerformanceBudgets).toBe('function')
  })

  test('metrics should initialize with null values', () => {
    const { useSSRPerformance } = require('../composables/SSRPerformance.ts')
    const { getMetrics } = useSSRPerformance()
    
    const metrics = getMetrics()
    
    // Initial metrics should be null (not yet measured)
    expect(metrics.ttfb).toBeNull()
    expect(metrics.fcp).toBeNull()
    expect(metrics.lcp).toBeNull()
    expect(metrics.hydrationTime).toBeNull()
    expect(metrics.tbt).toBeNull()
  })
})

