# OAuth Security Fix - Manual Testing Guide

**Date:** December 14, 2025  
**Purpose:** Verify OAuth token security implementation works correctly

---

## Test Environment Setup

### Prerequisites
```bash
# 1. Ensure Redis is running
redis-cli ping
# Expected: PONG

# 2. Check encryption key exists
printenv | grep ENCRYPTION_KEY
# Expected: ENCRYPTION_KEY=<64-char-hex-string>

# 3. Start backend server
cd /home/dataresearchanalysis/backend
npm run dev
# Expected: Server running on port 4001

# 4. Start frontend server
cd /home/dataresearchanalysis/frontend
npm run dev
# Expected: Server running on port 3000
```

---

## Test Cases

### Test 1: OAuth Flow - Token Storage
**Objective:** Verify tokens are NOT stored in sessionStorage

**Steps:**
1. Open browser DevTools (F12)
2. Navigate to: `http://localhost:3000/projects/1/data-sources`
3. Click "Connect Google Analytics"
4. Complete Google OAuth flow
5. After redirect to callback page, check sessionStorage:
   - Go to Application tab → Storage → Session Storage
   - Look for `ga_oauth_session` key

**Expected Result:**
- ✅ `ga_oauth_session` exists with UUID value
- ✅ `ga_oauth_tokens` does NOT exist
- ✅ No plain text tokens visible

**Actual Result:**
- [ ] Pass
- [ ] Fail (describe issue): _________________

---

### Test 2: Session Expiration
**Objective:** Verify 15-minute TTL enforcement

**Steps:**
1. Complete OAuth flow (Test 1)
2. Note the session ID from sessionStorage
3. Check Redis for session:
   ```bash
   redis-cli TTL "oauth:session:<session-id>"
   ```
4. Expected: ~900 seconds (15 minutes)
5. Wait 16 minutes
6. Try to access Google Analytics properties
7. Should fail with "Session not found or expired"

**Expected Result:**
- ✅ Initial TTL ~900 seconds
- ✅ After 16 minutes: Session expired
- ✅ User prompted to re-authenticate

**Actual Result:**
- [ ] Pass
- [ ] Fail (describe issue): _________________

---

### Test 3: Token Encryption in Redis
**Objective:** Verify tokens are encrypted at rest

**Steps:**
1. Complete OAuth flow
2. Note session ID from sessionStorage
3. Check Redis:
   ```bash
   redis-cli GET "oauth:session:<session-id>"
   ```
4. Examine the JSON output

**Expected Result:**
- ✅ `access_token` field contains encrypted data (starts with `{"version":1,"iv":`)
- ✅ NO plain text tokens visible
- ✅ `encrypted` field present in nested JSON

**Example Encrypted Token:**
```json
{
  "sessionId": "...",
  "tokens": {
    "access_token": "{\"version\":1,\"iv\":\"abc123...\",\"encrypted\":\"def456...\",\"authTag\":\"ghi789...\"}",
    "refresh_token": "{\"version\":1,\"iv\":\"jkl012...\",\"encrypted\":\"mno345...\",\"authTag\":\"pqr678...\"}"
  }
}
```

**Actual Result:**
- [ ] Pass
- [ ] Fail (describe issue): _________________

---

### Test 4: Token Retrieval
**Objective:** Verify tokens can be retrieved and used

**Steps:**
1. Complete OAuth flow
2. Navigate to property selection page
3. Properties should load successfully
4. Check Network tab for API call to `/api/oauth/session/<session-id>`

**Expected Result:**
- ✅ GET `/api/oauth/session/:sessionId` returns 200
- ✅ Response includes `access_token`, `refresh_token`
- ✅ Google Analytics properties display correctly

**Actual Result:**
- [ ] Pass
- [ ] Fail (describe issue): _________________

---

### Test 5: Session Cleanup
**Objective:** Verify automatic cleanup works

**Steps:**
1. Create 3-5 test sessions via OAuth flow
2. Manually set TTL to -1 (no expiration):
   ```bash
   redis-cli SET "oauth:session:test-orphan-1" '{"test":"data"}'
   redis-cli PERSIST "oauth:session:test-orphan-1"
   ```
3. Wait 31 minutes (cleanup runs every 30 minutes)
4. Check logs for cleanup message
5. Verify orphaned session removed:
   ```bash
   redis-cli EXISTS "oauth:session:test-orphan-1"
   ```

**Expected Result:**
- ✅ Log shows: `🧹 OAuth Session Cleanup: Removed N orphaned sessions`
- ✅ Orphaned session deleted
- ✅ Valid sessions remain

**Actual Result:**
- [ ] Pass
- [ ] Fail (describe issue): _________________

---

### Test 6: Authentication Required
**Objective:** Verify JWT authentication is enforced

**Steps:**
1. Use curl to call session endpoint WITHOUT auth token:
   ```bash
   curl -X GET http://localhost:4001/api/oauth/session/test-session-id
   ```

**Expected Result:**
- ✅ Returns 401 Unauthorized
- ✅ No token data leaked

**Actual Result:**
- [ ] Pass
- [ ] Fail (describe issue): _________________

---

### Test 7: Session Deletion
**Objective:** Verify manual session cleanup works

**Steps:**
1. Complete OAuth flow
2. Note session ID
3. Complete data source connection
4. Check sessionStorage - should be cleared
5. Check Redis:
   ```bash
   redis-cli EXISTS "oauth:session:<session-id>"
   ```

**Expected Result:**
- ✅ `ga_oauth_session` removed from sessionStorage
- ✅ Session deleted from Redis (EXISTS returns 0)

**Actual Result:**
- [ ] Pass
- [ ] Fail (describe issue): _________________

---

### Test 8: Rate Limiting
**Objective:** Verify rate limiting protects OAuth callback

**Steps:**
1. Use a script to call OAuth callback 15 times in 1 minute:
   ```bash
   for i in {1..15}; do
     curl -X POST http://localhost:4001/api/oauth/google/callback \
       -H "Content-Type: application/json" \
       -H "Authorization: Bearer <valid-token>" \
       -d '{"code":"test","state":"test"}' &
   done
   wait
   ```

**Expected Result:**
- ✅ First 10 requests succeed (200 OK)
- ✅ Remaining 5 requests fail (429 Too Many Requests)
- ✅ Rate limit message returned

**Actual Result:**
- [ ] Pass
- [ ] Fail (describe issue): _________________

---

### Test 9: Error Handling - Corrupted Session
**Objective:** Verify corrupted sessions are handled gracefully

**Steps:**
1. Create a malformed session in Redis:
   ```bash
   redis-cli SET "oauth:session:corrupt-test" "invalid-json-data"
   redis-cli EXPIRE "oauth:session:corrupt-test" 900
   ```
2. Try to retrieve it via API:
   ```bash
   curl -X GET http://localhost:4001/api/oauth/session/corrupt-test \
     -H "Authorization: Bearer <valid-token>"
   ```

**Expected Result:**
- ✅ Returns 404 or 500 with error message
- ✅ Corrupted session automatically deleted
- ✅ No sensitive data exposed in error

**Actual Result:**
- [ ] Pass
- [ ] Fail (describe issue): _________________

---

### Test 10: Cross-Browser Session Isolation
**Objective:** Verify sessions don't leak across browsers

**Steps:**
1. Complete OAuth flow in Chrome
2. Note session ID
3. Open Firefox
4. Try to manually use Chrome's session ID
5. Call API with different JWT token

**Expected Result:**
- ✅ Session isolated to authenticated user
- ✅ Cannot access session with different user's JWT
- ✅ Returns 404 or 401

**Actual Result:**
- [ ] Pass
- [ ] Fail (describe issue): _________________

---

## Performance Tests

### Load Test: Concurrent OAuth Flows
```bash
# Use Apache Bench to simulate 100 concurrent OAuth flows
ab -n 100 -c 10 -T 'application/json' \
   -H "Authorization: Bearer <token>" \
   -p oauth-payload.json \
   http://localhost:4001/api/oauth/google/callback
```

**Expected:**
- ✅ All requests succeed
- ✅ No Redis connection errors
- ✅ Average response time <100ms

---

## Security Validation

### Checklist
- [ ] No plain text tokens in sessionStorage
- [ ] No plain text tokens in Redis
- [ ] All tokens encrypted with AES-256-GCM
- [ ] 15-minute TTL enforced
- [ ] JWT authentication required
- [ ] Rate limiting active
- [ ] Automatic cleanup working
- [ ] Error messages don't leak sensitive data
- [ ] HTTPS enforced in production

---

## Regression Tests

### Existing Functionality
- [ ] Login/Logout still works
- [ ] Other OAuth providers unaffected (if any)
- [ ] Data source connections succeed
- [ ] Google Analytics data syncs correctly
- [ ] Token refresh works (if implemented)

---

## Test Summary

**Date Tested:** _______________  
**Tested By:** _______________  
**Environment:** [ ] Dev  [ ] Staging  [ ] Production

**Results:**
- Tests Passed: ___ / 10
- Tests Failed: ___ / 10
- Critical Issues: _______________
- Non-Critical Issues: _______________

**Overall Status:**
- [ ] ✅ Ready for Production
- [ ] ⚠️  Needs Minor Fixes
- [ ] ❌ Critical Issues - Do Not Deploy

**Notes:**
_________________________________
_________________________________
_________________________________

---

## Rollback Procedure (If Needed)

If critical issues found:

```bash
# 1. Revert frontend changes
cd frontend
git revert <commit-hash>
npm run build
pm2 restart frontend

# 2. Revert backend changes
cd backend
git revert <commit-hash>
npm run build
pm2 restart backend

# 3. Flush OAuth sessions
redis-cli KEYS "oauth:*" | xargs redis-cli DEL

# 4. Notify users to re-authenticate
```

---

## Sign-off

**Developer:** _______________ Date: _______________  
**QA Engineer:** _______________ Date: _______________  
**Security Team:** _______________ Date: _______________  
**DevOps:** _______________ Date: _______________

---

**Test Status:** [ ] PASS [ ] FAIL  
**Deployment Approval:** [ ] APPROVED [ ] REJECTED
