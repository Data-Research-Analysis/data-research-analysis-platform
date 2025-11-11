# Navigation Performance Instrumentation

## Overview
The application now has comprehensive instrumentation to measure navigation performance and identify bottlenecks.

## What's Being Measured

### 1. **Middleware Execution Times**
- `00-route-loader.global.ts` - Route loader (shows/hides loading indicator)
- `01-authorization.global.ts` - Authentication and authorization checks
- `02-load-data.global.ts` - Data loading (projects, dashboards, etc.)
- `03-validate-data.global.ts` - Data validation and entity selection

### 2. **Individual API Call Durations**
Each API call made by stores is timed:
- `retrieveProjects()`
- `retrieveDataSources()`
- `retrieveDataModels()`
- `retrieveDashboards()`
- `retrieveCategories()`
- `retrieveArticles()`
- `retrievePrivateBetaUsers()`
- `retrieveUsers()`

### 3. **Fetch Request Timing**
All `fetch()` calls are intercepted and timed with URL and status code.

### 4. **Total Navigation Time**
Complete end-to-end timing from click to page load.

## How to Use

### Step 1: Open Browser DevTools
1. Press `F12` or right-click and select "Inspect"
2. Go to the **Console** tab
3. Make sure all log levels are enabled

### Step 2: Navigate Between Pages
Click any `NuxtLink` in the application (e.g., navigate between projects, dashboards, etc.)

### Step 3: Review the Console Output

You'll see output like this:

```
[NAVIGATION START] /projects → /projects/123
───────────────────────────────────────────────────────
[00-route-loader] Navigation started: /projects → /projects/123 at 1234.56ms
[01-authorization] Started at 1235.12ms
[01-authorization] Completed at 1298.45ms (duration: 63.33ms)
[02-load-data] Started at 1299.01ms
[02-load-data] Skipped (no refresh needed) at 1299.23ms
[02-load-data] Completed at 1299.45ms (duration: 0.44ms)
[03-validate-data] Started at 1300.12ms
[03-validate-data] Completed at 1302.89ms (duration: 2.77ms)
[00-route-loader] Navigation completed at 1450.23ms (duration: 215.67ms)
───────────────────────────────────────────────────────
[NAVIGATION COMPLETE] /projects → /projects/123
Total Duration: 215.67ms
✓ FAST - Excellent performance
───────────────────────────────────────────────────────
```

### Step 4: Identify Bottlenecks

Look for:

1. **Slow Middleware** (> 100ms)
   - If `01-authorization` is slow: Token validation may be the issue
   - If `02-load-data` is slow: API calls are blocking navigation
   - If `03-validate-data` is slow: Data lookup or validation logic needs optimization

2. **Slow API Calls** (> 200ms)
   - Check `[fetch]` logs for individual API endpoints
   - Multiple sequential API calls compound the delay

3. **Total Navigation Time**
   - **< 200ms**: Fast ✓
   - **200-500ms**: Moderate ⚠
   - **500-1000ms**: Slow ⚠
   - **> 1000ms**: Very Slow ✗

## Performance Targets

### Immediate Goals
- Total navigation time: **< 300ms**
- Middleware execution: **< 50ms each**
- API calls: **< 150ms each**

### Stretch Goals
- Total navigation time: **< 200ms**
- Perceived instant navigation (UI updates within **100ms**)

## Common Bottlenecks & Solutions

### 1. `02-load-data` Taking Too Long
**Problem**: Awaiting multiple API calls sequentially blocks navigation

**Solution**: 
- Make API calls in background (non-blocking)
- Use cached data initially, refresh in background
- Only await critical data needed for page render

### 2. Multiple Sequential API Calls
**Problem**: `retrieveProjects()` → `retrieveDataSources()` → etc. runs in sequence

**Solution**:
- Run API calls in parallel with `Promise.all()`
- Skip unnecessary API calls if data hasn't changed
- Implement smarter caching with timestamps

### 3. Token Validation on Every Navigation
**Problem**: `01-authorization` validates token with backend on every route

**Solution**:
- Cache validation result for short period (e.g., 30 seconds)
- Only validate on sensitive routes
- Use local JWT expiry check first

### 4. Large Payload Responses
**Problem**: API returns too much data (e.g., all projects with all relations)

**Solution**:
- Implement pagination
- Add `fields` query parameter to limit response
- Use GraphQL for selective field fetching

## Next Steps

Based on the instrumentation data, we can:

1. **Identify the top 3 slowest operations**
2. **Implement targeted optimizations**:
   - Non-blocking data loading
   - Parallel API calls
   - Smarter caching
   - Prefetching
3. **Add skeleton loaders** for perceived performance
4. **Measure improvement** and iterate

## Removing Instrumentation

Once optimization is complete, instrumentation can be removed or disabled with a feature flag:

```typescript
const ENABLE_PERF_LOGGING = import.meta.dev // Only in development
if (ENABLE_PERF_LOGGING) {
  console.log(...)
}
```
