# Google Ad Manager Rate Limiting

## Overview

This document describes the rate limiting implementation for the Google Ad Manager (GAM) API integration. Rate limiting ensures that API requests stay within quota limits and prevents service disruptions due to excessive API calls.

## Architecture

### Token Bucket Algorithm

The rate limiter implements a **token bucket algorithm** with the following characteristics:

- **Tokens**: Each API request consumes one token
- **Refill Rate**: Tokens refill continuously over time based on `maxRequests / windowMs`
- **Burst Size**: Maximum number of tokens that can accumulate (allows bursts)
- **Minimum Interval**: Enforced delay between consecutive requests
- **Queue Management**: Requests exceeding limits are queued (FIFO)

### Components

#### 1. RateLimiter Class (`backend/src/utils/RateLimiter.ts`)

Core rate limiting implementation with token bucket algorithm.

**Configuration:**
```typescript
interface RateLimiterConfig {
    maxRequests: number;    // Maximum requests per window
    windowMs: number;       // Time window in milliseconds
    burstSize?: number;     // Maximum burst requests (defaults to maxRequests)
    minInterval?: number;   // Minimum interval between requests in ms
}
```

**Key Methods:**
- `acquire()`: Promise-based request permission (returns when request can proceed)
- `getStatus()`: Current rate limit status (remaining requests, reset time, is limited)
- `getStats()`: Detailed statistics (queue length, tokens, requests in window)
- `reset()`: Reset rate limiter state

**Example Usage:**
```typescript
const limiter = new RateLimiter({
    maxRequests: 10,
    windowMs: 60000,      // 1 minute
    burstSize: 20,
    minInterval: 100       // 100ms between requests
});

// Before making API request
await limiter.acquire();
// Now safe to make request
const result = await apiClient.makeRequest();
```

#### 2. RateLimiterRegistry (`backend/src/utils/RateLimiter.ts`)

Singleton registry for managing multiple rate limiters by service name.

**Key Methods:**
- `getOrCreate(serviceId, config)`: Get or create rate limiter
- `get(serviceId)`: Get existing rate limiter
- `has(serviceId)`: Check if limiter exists
- `remove(serviceId)`: Remove rate limiter
- `getAll()`: Get all rate limiters
- `getAllStatuses()`: Get status of all limiters
- `resetAll()`: Reset all rate limiters

**Preset Configurations:**
```typescript
// Google Ad Manager preset (conservative limits)
const gamLimiter = RateLimiterRegistry.createForGAM();
// Config: 10 req/min, burst 20, 100ms min interval

// Testing preset (permissive limits)
const testLimiter = RateLimiterRegistry.createForTesting();
// Config: 100 req/sec, burst 100, 10ms min interval
```

#### 3. GoogleAdManagerService Integration

Rate limiting is integrated into `GoogleAdManagerService` at the service level.

**Implementation:**
```typescript
class GoogleAdManagerService {
    private rateLimiter: RateLimiter;

    constructor() {
        // Initialize rate limiter
        const registry = RateLimiterRegistry.getInstance();
        this.rateLimiter = registry.getOrCreate('google-ad-manager', {
            maxRequests: 10,
            windowMs: 60000,
            burstSize: 20,
            minInterval: 100,
        });
    }

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
        
        // Make API call
        return await this.makeAPIRequest();
    }
}
```

#### 4. REST API Endpoint

Monitor rate limit status via REST API.

**GET /api/google-ad-manager/rate-limit**

Returns current rate limit status and statistics.

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

#### 5. Frontend Composable (`frontend/composables/useGAMRateLimit.ts`)

Vue composable for monitoring rate limit status in the UI.

**Features:**
- Real-time rate limit status
- Auto-refresh capability
- Warning levels (none, low, medium, high, critical)
- Utilization percentage
- Status color coding

**Example Usage:**
```vue
<script setup lang="ts">
import { useGAMRateLimit } from '~/composables/useGAMRateLimit';

const {
    rateLimitData,
    isRateLimited,
    remainingRequests,
    utilizationPercent,
    statusColor,
    statusMessage,
    fetchRateLimitStatus,
    startAutoRefresh,
    stopAutoRefresh
} = useGAMRateLimit();

// Start auto-refresh (5 second interval)
startAutoRefresh(5000);

// Or fetch once
fetchRateLimitStatus();
</script>

<template>
    <div class="rate-limit-status">
        <div :class="['status-badge', statusColor]">
            {{ statusMessage }}
        </div>
        <div class="details">
            <p>Remaining: {{ remainingRequests }} requests</p>
            <p>Utilization: {{ utilizationPercent }}%</p>
        </div>
    </div>
</template>
```

**Computed Properties:**
- `isRateLimited`: Boolean indicating if currently rate limited
- `remainingRequests`: Number of requests remaining in current window
- `queueLength`: Number of queued requests waiting
- `utilizationPercent`: Percentage of rate limit used (0-100)
- `statusColor`: Color indicator ('green', 'yellow', 'orange', 'red')
- `statusMessage`: Human-readable status message
- `shouldDelayRequests`: Whether to show warning before making requests
- `estimatedWaitTimeMs`: Milliseconds to wait before next request
- `estimatedWaitTimeFormatted`: Formatted wait time (e.g., "1.5s")

## Configuration

### Google Ad Manager Limits

Current configuration (conservative approach):

```typescript
{
    maxRequests: 10,        // 10 requests per minute
    windowMs: 60000,        // 1 minute window
    burstSize: 20,          // Allow bursts up to 20 requests
    minInterval: 100        // 100ms minimum between requests
}
```

**Rationale:**
- Google Ad Manager API has varying rate limits depending on account type
- Conservative limits (10/min) prevent quota exhaustion
- Burst size (20) allows occasional spikes in activity
- Minimum interval prevents rapid-fire requests

### Adjusting Limits

To adjust rate limits for your environment:

1. **Backend Service** (`GoogleAdManagerService.ts`):
```typescript
this.rateLimiter = registry.getOrCreate('google-ad-manager', {
    maxRequests: 20,        // Increase to 20/min
    windowMs: 60000,
    burstSize: 40,          // Increase burst
    minInterval: 50,        // Reduce interval
});
```

2. **Registry Preset** (`RateLimiter.ts`):
```typescript
public static createForGAM(): RateLimiter {
    return new RateLimiter({
        maxRequests: 20,    // Updated limit
        windowMs: 60000,
        burstSize: 40,
        minInterval: 50,
    });
}
```

## Token Bucket Mechanics

### How It Works

1. **Token Pool**: Starts with `burstSize` tokens
2. **Token Consumption**: Each request consumes 1 token
3. **Token Refill**: Tokens refill continuously at rate `maxRequests / windowMs`
4. **Request Permission**:
   - If tokens available: request proceeds immediately
   - If no tokens: request is queued
   - Queue processes when tokens become available

### Refill Calculation

```typescript
const elapsed = currentTime - lastRefillTime;
const tokensToAdd = elapsed * (burstSize / windowMs);
tokens = Math.min(tokens + tokensToAdd, burstSize);
```

**Example:**
- Config: 10 req/min, burst 20
- Refill rate: 20 tokens / 60000ms = 0.000333 tokens/ms
- After 1 second (1000ms): +0.333 tokens
- After 6 seconds (6000ms): +2 tokens

### Sliding Window

In addition to tokens, the limiter tracks request timestamps in a sliding window:

```typescript
requestTimestamps = [t1, t2, t3, ...];
// Remove timestamps older than windowMs
```

This ensures:
- No more than `maxRequests` in any `windowMs` period
- Accurate rate limiting even with token refills

### Queue Processing

When requests exceed available tokens:

1. Request is added to FIFO queue
2. Queue processor wakes up
3. Checks token availability
4. If tokens available:
   - Dequeue request
   - Consume token
   - Resolve promise
   - Wait `minInterval` ms
5. If no tokens:
   - Calculate wait time
   - Sleep and retry

## Monitoring & Observability

### Status Metrics

**remainingRequests**: Immediate capacity
```typescript
remainingRequests = min(
    floor(tokens),
    maxRequests - requestsInWindow
);
```

**isLimited**: True when no remaining requests
```typescript
isLimited = remainingRequests <= 0;
```

**queueLength**: Pending requests
```typescript
queueLength = queue.length;
```

**utilizationPercent**: How much of limit is used
```typescript
utilizationPercent = (requestsInWindow / maxRequests) * 100;
```

### Warning Levels

| Level | Condition | Action |
|-------|-----------|--------|
| None | < 50% utilization | Normal operation |
| Low | 50-69% utilization | Monitor |
| Medium | 70-89% utilization | Consider reducing request rate |
| High | 90-99% utilization OR isLimited | Slow down requests |
| Critical | isLimited + queue > 5 | Significant backlog, urgent action |

### Console Logs

Rate limiter logs important events:

```typescript
// When wait occurs
🚦 Rate limiter wait: 1250ms

// After acquiring permission
🚦 Rate limit status: 3 requests remaining

// Service initialization
🚦 Rate limiter initialized: 10 requests/minute, burst 20
```

## Testing

### Integration Tests

Comprehensive test suite: `backend/src/utils/__tests__/RateLimiter.integration.test.ts`

**Test Coverage:**
- ✅ Token bucket algorithm
- ✅ Queue management
- ✅ Token refill over time
- ✅ Minimum interval enforcement
- ✅ Status reporting
- ✅ Sliding window tracking
- ✅ Reset functionality
- ✅ Registry management

**Run Tests:**
```bash
cd backend
npm test -- RateLimiter.integration.test.ts --testTimeout=20000
```

### Manual Testing

1. **Test Rate Limiting:**
```typescript
// Make rapid requests
for (let i = 0; i < 30; i++) {
    await gamService.runReport(/* params */);
}
// Should see rate limiter wait logs
```

2. **Monitor Status:**
```bash
# API endpoint
curl -H "Authorization: Bearer <token>" \
  http://localhost:3002/api/google-ad-manager/rate-limit
```

3. **Frontend Monitoring:**
```vue
<!-- Add to GAM wizard component -->
<GAMRateLimitMonitor />
```

## Performance Considerations

### Memory Usage

- **Token storage**: Constant (few numbers)
- **Request timestamps**: O(maxRequests) - grows with window size
- **Queue**: O(n) where n = queued requests (usually 0-10)

**Optimization**: Old timestamps are cleaned regularly:
```typescript
this.requestTimestamps = this.requestTimestamps.filter(
    timestamp => now - timestamp < this.config.windowMs
);
```

### CPU Usage

- **Token refill**: O(1) calculation per acquire()
- **Timestamp cleanup**: O(maxRequests) per acquire()
- **Queue processing**: O(1) per request

**Impact**: Negligible - operations are simple arithmetic

### Latency

- **No rate limit**: ~0ms overhead (token check + timestamp update)
- **Rate limited**: Wait time = time until next token available
- **Queue processing**: FIFO, processes as soon as tokens available

## Troubleshooting

### Issue: Requests Always Queued

**Symptoms:**
- All requests show wait times
- Queue length always > 0

**Possible Causes:**
1. `maxRequests` too low for actual usage
2. `burstSize` exhausted
3. `minInterval` too long

**Solutions:**
- Increase `maxRequests`
- Increase `burstSize`
- Reduce `minInterval`
- Check actual GAM API limits

### Issue: Rate Limit Errors from GAM API

**Symptoms:**
- 429 (Too Many Requests) errors
- GAM API quota exceeded

**Possible Causes:**
1. Rate limiter config too permissive
2. Multiple service instances using same quota
3. Other applications using same GAM account

**Solutions:**
- Reduce `maxRequests` (more conservative)
- Coordinate across service instances
- Use separate GAM accounts for different environments

### Issue: Slow Sync Performance

**Symptoms:**
- Sync takes much longer than expected
- Many rate limiter wait logs

**Possible Causes:**
1. Rate limiter too restrictive
2. Burst size too small
3. minInterval too long

**Solutions:**
- Increase rate limits if GAM quota allows
- Increase burst size for better burst handling
- Reduce minInterval (if API allows)

## Future Enhancements

### Adaptive Rate Limiting

Automatically adjust limits based on API responses:

```typescript
class AdaptiveRateLimiter extends RateLimiter {
    adjustLimits(response) {
        if (response.status === 429) {
            // API said too many requests - reduce rate
            this.config.maxRequests *= 0.8;
        } else if (response.headers['x-rate-limit-remaining']) {
            // API provides hints - use them
            const remaining = parseInt(response.headers['x-rate-limit-remaining']);
            this.adjustForRemaining(remaining);
        }
    }
}
```

### Distributed Rate Limiting

For multiple backend instances:

```typescript
class RedisRateLimiter extends RateLimiter {
    // Use Redis for shared state across instances
    async acquire(): Promise<void> {
        return await redis.rateLimit(this.serviceId, this.config);
    }
}
```

### Per-Network Rate Limiting

Different limits for each GAM network:

```typescript
const limiter = registry.getOrCreate(
    `google-ad-manager:${networkCode}`,
    networkConfig
);
```

## References

- [Token Bucket Algorithm](https://en.wikipedia.org/wiki/Token_bucket)
- [Google Ad Manager API Documentation](https://developers.google.com/ad-manager/api/start)
- [Rate Limiting Best Practices](https://cloud.google.com/architecture/rate-limiting-strategies-techniques)
