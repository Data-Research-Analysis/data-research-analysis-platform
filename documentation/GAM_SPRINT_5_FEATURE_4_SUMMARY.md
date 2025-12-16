# Google Ad Manager Sprint 5 - Feature 5.4: Rate Limiting & Throttling

## Overview

Implemented comprehensive rate limiting and throttling for Google Ad Manager API integration to prevent quota exhaustion and ensure reliable sync operations.

## Summary of Changes

### Backend Rate Limiting

**New Files:**
- `backend/src/utils/RateLimiter.ts` (351 lines) - Token bucket rate limiter
- `backend/src/utils/Throttle.ts` (273 lines) - Throttle & debounce utilities
- `backend/src/utils/__tests__/RateLimiter.integration.test.ts` (312 lines) - Integration tests

**Modified Files:**
- `backend/src/services/GoogleAdManagerService.ts` - Integrated rate limiting into runReport()
- `backend/src/routes/google_ad_manager.ts` - Added rate limit status endpoint

**New API Endpoint:**
- `GET /api/google-ad-manager/rate-limit` - Returns rate limit status and statistics

### Frontend Monitoring

**New Files:**
- `frontend/composables/useGAMRateLimit.ts` (244 lines) - Rate limit monitoring composable

### Documentation

**New Files:**
- `documentation/rate-limiting-implementation.md` (680 lines) - Comprehensive documentation

## Implementation Details

### 1. RateLimiter Class (Token Bucket Algorithm)

Core rate limiting implementation with the following features:

**Algorithm:**
- Token bucket with continuous token refill
- Sliding window request tracking
- FIFO queue for requests exceeding limits
- Minimum interval enforcement between requests

**Configuration:**
```typescript
{
    maxRequests: 10,        // 10 requests per minute
    windowMs: 60000,        // 1 minute window
    burstSize: 20,          // Allow bursts up to 20 requests
    minInterval: 100        // 100ms minimum between requests
}
```

**Key Methods:**
- `acquire()`: Promise-based request permission (blocks until allowed)
- `getStatus()`: Current rate limit status (remaining, reset time, is limited)
- `getStats()`: Detailed statistics (queue, tokens, requests in window)
- `reset()`: Reset rate limiter state

**Token Refill Mechanics:**
```typescript
const elapsed = currentTime - lastRefillTime;
const tokensToAdd = elapsed * (burstSize / windowMs);
tokens = Math.min(tokens + tokensToAdd, burstSize);
```

### 2. RateLimiterRegistry

Singleton registry for managing multiple rate limiters:

**Features:**
- Service-based rate limiter storage (by serviceId)
- Lazy initialization (create on first use)
- Preset configurations (GAM, Testing)
- Bulk operations (getAll, resetAll, getAllStatuses)

**Methods:**
- `getOrCreate(serviceId, config)` - Get or create rate limiter
- `get(serviceId)` - Get existing rate limiter
- `has(serviceId)` - Check if limiter exists
- `remove(serviceId)` - Remove rate limiter
- `getAll()` - Get all rate limiters (Map)
- `resetAll()` - Reset all limiters
- `createForGAM()` - Static factory for GAM preset

### 3. GoogleAdManagerService Integration

Rate limiting applied at service level:

**runReport() Wrapper:**
```typescript
async runReport(/* ... */): Promise<any> {
    // Wait for rate limit permission
    const startWaitTime = Date.now();
    await this.rateLimiter.acquire();
    const waitTime = Date.now() - startWaitTime;
    
    if (waitTime > 0) {
        console.log(`🚦 Rate limiter wait: ${waitTime}ms`);
    }
    
    const status = this.rateLimiter.getStatus();
    console.log(`🚦 Rate limit status: ${status.remainingRequests} requests remaining`);
    
    // Proceed with API call
    return await this.makeAPIRequest();
}
```

**Benefits:**
- All 5 GAM report types automatically rate-limited
- Transparent to callers (promises handle waiting)
- Detailed logging for observability
- No code changes in driver layer

### 4. Throttle & Debounce Utilities

Additional throttling utilities for various use cases:

**Functions:**
- `throttle<T>(fn, waitMs)` - Execute at most once per interval
- `debounce<T>(fn, waitMs)` - Delay execution until after wait period
- `throttleLeadingTrailing<T>(fn, waitMs)` - Execute on both edges

**BatchThrottle Class:**
- Batch processing with size/time limits
- `add(item)` - Add item to batch
- `flush()` - Process batch immediately
- Auto-flush on maxBatchSize or maxWaitMs

**AdaptiveThrottle Class:**
- Auto-adjust wait time based on success/error patterns
- Increases wait on errors (1.5x multiplier)
- Decreases wait on sustained success (5+ successes)
- Min/max wait time bounds (100ms - 5000ms)

### 5. REST API Endpoint

Monitor rate limit status via REST API:

**Endpoint:** `GET /api/google-ad-manager/rate-limit`

**Response:**
```json
{
    "success": true,
    "data": {
        "status": {
            "remainingRequests": 8,
            "resetTime": "2025-01-14T10:15:30.000Z",
            "isLimited": false,
            "retryAfterMs": null
        },
        "stats": {
            "queueLength": 0,
            "tokens": 18,
            "requestsInWindow": 2,
            "config": {
                "maxRequests": 10,
                "windowMs": 60000,
                "burstSize": 20,
                "minInterval": 100
            }
        }
    }
}
```

**Use Cases:**
- Frontend monitoring dashboards
- Health checks
- Debugging rate limit issues
- Capacity planning

### 6. Frontend Composable

Vue composable for rate limit monitoring:

**Features:**
- Real-time rate limit status
- Auto-refresh capability (configurable interval)
- Warning levels (none, low, medium, high, critical)
- Utilization percentage calculation
- Status color coding (green, yellow, orange, red)
- Human-readable status messages

**Computed Properties:**
- `isRateLimited` - Currently rate limited
- `remainingRequests` - Requests remaining in window
- `queueLength` - Queued requests waiting
- `utilizationPercent` - Percentage of limit used (0-100)
- `statusColor` - Color indicator
- `statusMessage` - Human-readable status
- `shouldDelayRequests` - Warning before making requests
- `estimatedWaitTimeMs` - Milliseconds to wait
- `estimatedWaitTimeFormatted` - Formatted wait time

**Example Usage:**
```vue
<script setup>
const {
    isRateLimited,
    remainingRequests,
    utilizationPercent,
    statusColor,
    statusMessage,
    startAutoRefresh
} = useGAMRateLimit();

// Start auto-refresh every 5 seconds
startAutoRefresh(5000);
</script>

<template>
    <div :class="['status-badge', statusColor]">
        {{ statusMessage }}
    </div>
    <p>Remaining: {{ remainingRequests }} requests</p>
    <p>Utilization: {{ utilizationPercent }}%</p>
</template>
```

## Testing

### Integration Tests (14 tests, all passing)

**Test Coverage:**
- ✅ Token bucket algorithm
  - Allow requests up to burst size
  - Queue requests exceeding limit
  - Refill tokens over time
- ✅ Minimum interval enforcement
- ✅ Status and statistics reporting
  - Accurate status
  - Sliding window tracking
  - Queue length tracking
- ✅ Reset functionality
- ✅ RateLimiterRegistry
  - Create and retrieve by service name
  - Separate limiters for different services
  - List all registered limiters
  - GAM preset support
  - Remove limiter
  - Reset all limiters

**Run Tests:**
```bash
cd backend
npm test -- RateLimiter.integration.test.ts --testTimeout=20000
```

**Test Results:**
```
Test Suites: 1 passed, 1 total
Tests:       14 passed, 14 total
Time:        42.057 s
```

## Configuration

### Current Settings (Conservative)

```typescript
{
    maxRequests: 10,        // 10 requests per minute
    windowMs: 60000,        // 1 minute window
    burstSize: 20,          // Allow bursts up to 20 requests
    minInterval: 100        // 100ms minimum between requests
}
```

**Rationale:**
- Google Ad Manager API limits vary by account type
- Conservative limits prevent quota exhaustion
- Burst size allows occasional spikes
- Minimum interval prevents rapid-fire requests

### Adjusting Limits

To adjust for your environment, modify `GoogleAdManagerService.ts`:

```typescript
this.rateLimiter = registry.getOrCreate('google-ad-manager', {
    maxRequests: 20,        // Increase to 20/min
    windowMs: 60000,
    burstSize: 40,          // Increase burst
    minInterval: 50,        // Reduce interval
});
```

## Performance Impact

### Memory Usage
- Token storage: Constant (few numbers)
- Request timestamps: O(maxRequests) - ~10 timestamps
- Queue: O(n) where n = queued requests (usually 0-10)

**Total:** < 1KB per rate limiter instance

### CPU Usage
- Token refill: O(1) per acquire()
- Timestamp cleanup: O(maxRequests) per acquire()
- Queue processing: O(1) per request

**Impact:** Negligible - simple arithmetic operations

### Latency
- **No rate limit:** ~0ms overhead (token check only)
- **Rate limited:** Wait time = time until next token available
- **Queue processing:** FIFO, processes immediately when tokens available

## Monitoring & Observability

### Console Logs

Rate limiter provides detailed logging:

```
🚦 Rate limiter initialized: 10 requests/minute, burst 20
🚦 Rate limiter wait: 1250ms
🚦 Rate limit status: 3 requests remaining
```

### Warning Levels

| Level | Condition | Description |
|-------|-----------|-------------|
| None | < 50% utilization | Normal operation |
| Low | 50-69% utilization | Monitor usage |
| Medium | 70-89% utilization | Consider reducing request rate |
| High | 90-99% OR isLimited | Slow down requests |
| Critical | isLimited + queue > 5 | Significant backlog |

### Metrics Available

- `remainingRequests` - Immediate capacity
- `isLimited` - Currently rate limited
- `queueLength` - Pending requests
- `tokens` - Available tokens
- `requestsInWindow` - Requests in current window
- `utilizationPercent` - Percentage of limit used
- `retryAfterMs` - Milliseconds until next token

## Documentation

Comprehensive documentation added:

**File:** `documentation/rate-limiting-implementation.md`

**Sections:**
1. Overview & Architecture
2. Components (RateLimiter, Registry, Service Integration)
3. Token Bucket Mechanics (detailed algorithm explanation)
4. Configuration & Tuning
5. Monitoring & Observability
6. Testing
7. Performance Considerations
8. Troubleshooting
9. Future Enhancements

## Benefits

1. **Prevents API Quota Exhaustion**
   - Conservative limits ensure we stay within GAM API quotas
   - Burst tolerance handles occasional spikes

2. **Reliable Sync Operations**
   - No sync failures due to rate limit errors
   - Automatic queueing and retry

3. **Transparent Integration**
   - No changes required in driver layer
   - Works automatically for all report types

4. **Real-time Monitoring**
   - API endpoint for status checks
   - Frontend composable for dashboard
   - Console logging for debugging

5. **Flexible Configuration**
   - Per-service rate limiters
   - Adjustable limits
   - Preset configurations

6. **Thoroughly Tested**
   - 14 integration tests covering all scenarios
   - Real timing tests (not mocked)
   - All tests passing

## Future Enhancements

1. **Adaptive Rate Limiting**
   - Automatically adjust based on API responses (429 errors)
   - Use API headers for hints (X-RateLimit-Remaining)

2. **Distributed Rate Limiting**
   - Redis-backed rate limiter for multiple instances
   - Shared quota across service instances

3. **Per-Network Rate Limiting**
   - Different limits for each GAM network
   - Account for network-specific quotas

4. **Rate Limit Dashboard**
   - Visual monitoring in admin panel
   - Historical rate limit data
   - Quota usage trends

## Related Files

### Created
- `backend/src/utils/RateLimiter.ts`
- `backend/src/utils/Throttle.ts`
- `backend/src/utils/__tests__/RateLimiter.integration.test.ts`
- `frontend/composables/useGAMRateLimit.ts`
- `documentation/rate-limiting-implementation.md`

### Modified
- `backend/src/services/GoogleAdManagerService.ts`
- `backend/src/routes/google_ad_manager.ts`

## Dependencies

No new dependencies required. Uses:
- Native Promises for async queue management
- Built-in Date/timestamp tracking
- TypeScript interfaces for type safety

## Migration Notes

No migration required. Rate limiting is:
- Automatically applied to all existing GAM API calls
- Transparent to existing code
- Backward compatible (no breaking changes)

## Sprint 5 Progress

- ✅ Feature 5.1: Sync History Tracking (Complete)
- ✅ Feature 5.2: Enhanced Error Handling (Complete)
- ✅ Feature 5.3: Real-time Updates (Complete)
- ✅ Feature 5.4: Rate Limiting & Throttling (Complete)
- ⏳ Feature 5.5: Performance Metrics & Monitoring (Next)

---

**Commit Type:** feat
**Scope:** gam, rate-limiting
**Breaking Changes:** None

**Testing:**
- [x] Unit tests passing (14/14)
- [x] Integration tests passing
- [x] No TypeScript errors
- [x] Manual testing of rate limiting behavior
- [x] API endpoint tested
- [x] Frontend composable verified

**Documentation:**
- [x] Comprehensive implementation guide
- [x] API documentation
- [x] Configuration guide
- [x] Troubleshooting guide
- [x] Code examples included
