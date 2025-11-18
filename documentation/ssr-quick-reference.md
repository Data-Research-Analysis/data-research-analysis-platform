# SSR Quick Reference Guide

## 🚀 Quick Commands

```bash
# Validate SSR configuration (8 checks)
npm run validate:ssr

# Run all tests (31+ tests)
npm test

# Build for production
npm run build

# Preview production build
npm run preview

# Development server
npm run dev
```

---

## ✅ SSR Checklist (Before Committing)

- [ ] No `window.`, `document.`, `navigator.`, `localStorage.` without `import.meta.client` guard
- [ ] Used `useCookie()` instead of `document.cookie`
- [ ] DOM operations in `onMounted()` only
- [ ] Event listeners guarded with `import.meta.client`
- [ ] Data fetching uses `onServerPrefetch()` when needed
- [ ] SEO meta tags added with `useHead()`
- [ ] Run `npm run validate:ssr` - all checks pass
- [ ] Run `npm test` - all tests pass
- [ ] No console errors in dev mode

---

## 🛡️ Browser API Guards

### ❌ WRONG (Breaks SSR)
```typescript
function myFunction() {
  window.open('https://example.com')
}
```

### ✅ CORRECT (SSR-Safe)
```typescript
function myFunction() {
  if (import.meta.client) {
    window.open('https://example.com')
  }
}
```

---

## 🍪 Cookie Management

### ❌ WRONG (Not SSR-Safe)
```typescript
const token = document.cookie
```

### ✅ CORRECT (SSR-Safe)
```typescript
const token = useCookie('auth_token')
token.value = 'abc123' // Automatically syncs
```

---

## 📊 Data Fetching

### ❌ WRONG (Client-Only)
```vue
<script setup>
onMounted(async () => {
  await fetchData() // Data not in HTML
})
</script>
```

### ✅ CORRECT (SSR + Client)
```vue
<script setup>
// Option 1: Using onServerPrefetch
onServerPrefetch(async () => {
  await fetchData()
})

// Option 2: Using useAsyncData
const { data } = await useAsyncData('key', () => fetchData())
</script>
```

---

## 🏷️ SEO Meta Tags

```vue
<script setup>
useHead({
  title: 'Page Title',
  meta: [
    { name: 'description', content: 'Page description' },
    { property: 'og:title', content: 'Page Title' },
    { property: 'og:description', content: 'Description' },
    { property: 'og:image', content: 'https://example.com/image.jpg' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ],
  link: [
    { rel: 'canonical', href: 'https://example.com/page' }
  ]
})
</script>
```

---

## 🎨 Client-Only Components

```vue
<template>
  <ClientOnly>
    <HeavyComponent :data="data" />
    
    <!-- Fallback for SSR -->
    <template #fallback>
      <div>Loading...</div>
    </template>
  </ClientOnly>
</template>
```

---

## 🔧 Plugin Configuration

```typescript
// nuxt.config.ts
plugins: [
  // Client-only (DOM-dependent)
  { src: '~/plugins/recaptcha.ts', mode: 'client' },
  
  // Universal (works on server)
  '~/plugins/fontawesome.ts',
]
```

---

## 📈 Performance Monitoring

```vue
<script setup>
const { trackPageLoad, logMetrics, checkPerformanceBudgets } = useSSRPerformance()

onMounted(() => {
  trackPageLoad()
  
  if (import.meta.dev) {
    setTimeout(() => {
      logMetrics()
      checkPerformanceBudgets()
    }, 3000)
  }
})
</script>
```

**Console Output:**
```
🚀 SSR Performance Metrics
  TTFB: 245.30ms
  FCP: 892.15ms
  LCP: 1456.78ms
  Hydration Time: 324.56ms
  TBT: 125.40ms
✅ All performance budgets met!
```

---

## 🐛 Common Errors & Fixes

### Error: "window is not defined"
**Fix:** Add `import.meta.client` guard
```typescript
if (import.meta.client) {
  window.doSomething()
}
```

### Error: "document is not defined"
**Fix:** Use `onMounted()`
```typescript
onMounted(() => {
  document.getElementById('element')
})
```

### Error: Hydration mismatch
**Fix:** Use `<ClientOnly>` for dynamic content
```vue
<ClientOnly>
  {{ new Date().toLocaleString() }}
</ClientOnly>
```

---

## 📊 Performance Budgets

| Metric | Budget | Description |
|--------|--------|-------------|
| TTFB | 600ms | Server response time |
| FCP | 1800ms | First Contentful Paint |
| LCP | 2500ms | Largest Contentful Paint |
| Hydration | 1000ms | Vue hydration time |
| TBT | 300ms | Total Blocking Time |

**Exceeding budget triggers warning in dev console.**

---

## 🧪 Testing

```bash
# Run all SSR tests
npm test

# Run specific test file
npm test tests/ssr-compatibility.nuxt.test.ts

# Run with coverage
npm test -- --coverage

# Watch mode (development)
npm test -- --watch
```

---

## 🚨 Error Pages

**Custom error handling:**
```typescript
// Throw errors that error.vue will catch
throw createError({
  statusCode: 404,
  message: 'Page not found'
})

throw createError({
  statusCode: 500,
  message: 'Internal server error'
})
```

**Error page features:**
- ✅ Custom 404 and 500 pages
- ✅ User-friendly messages
- ✅ Recovery actions (Go Home, Go Back)
- ✅ Technical details in dev mode

---

## 📚 Documentation

1. **Phase 8 & 9 Guide** - `documentation/ssr-phases-8-9-documentation.md`
   - Best practices
   - Common patterns
   - Troubleshooting

2. **Complete Summary** - `documentation/ssr-complete-summary.md`
   - All 9 phases
   - Statistics
   - Production checklist

3. **Completion Report** - `documentation/phase-8-9-completion-report.md`
   - Detailed changes
   - Test results
   - Impact analysis

---

## 🎯 Key Files

### Composables
- `composables/SSRPerformance.ts` - Performance monitoring
- `composables/AuthToken.ts` - SSR-safe auth
- `composables/Utils.ts` - Utility functions

### Layouts
- `layouts/default.vue` - Main layout with `onServerPrefetch()`

### Error Handling
- `error.vue` - Custom error pages

### Config
- `nuxt.config.ts` - SSR and plugin configuration

### Tests
- `tests/ssr-compatibility.nuxt.test.ts` - 31+ SSR tests
- `scripts/validate-ssr.cjs` - Validation script

---

## ✨ Best Practices Summary

1. **Always guard browser APIs** with `import.meta.client`
2. **Use `useCookie()`** for cookie management
3. **Add `onServerPrefetch()`** for SSR data fetching
4. **Use `useHead()`** for SEO meta tags
5. **Configure plugins** correctly (client vs universal)
6. **Test error pages** (404, 500)
7. **Monitor performance** in dev console
8. **Run validation** before committing
9. **Use `<ClientOnly>`** for dynamic content
10. **Document changes** in code comments

---

## 🆘 Getting Help

### Internal Resources
- SSR Documentation: `documentation/ssr-phases-8-9-documentation.md`
- Slack Channel: `#ssr-help`
- Team Lead: Check with development team

### External Resources
- [Nuxt 3 SSR Guide](https://nuxt.com/docs/guide/concepts/rendering)
- [Vue 3 SSR Guide](https://vuejs.org/guide/scaling-up/ssr.html)
- [Web Vitals](https://web.dev/vitals/)

---

## 🎉 Quick Wins

### Before Committing
```bash
npm run validate:ssr && npm test
```

### Check Performance
```bash
npm run dev
# Open browser
# Wait 3 seconds
# Check console for performance metrics
```

### Test Error Pages
```bash
npm run dev
# Navigate to: http://localhost:3000/non-existent-page
# Should show custom 404 page
```

---

**Quick Reference Version:** 1.0  
**Last Updated:** November 2, 2025  
**Keep This Handy!** 📌
