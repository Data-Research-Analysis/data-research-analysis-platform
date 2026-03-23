# Phase 2 Testing - Quick Reference

> **Quick command reference for running Phase 2 multi-tenancy tests**

---

## ⚡ Complete Test Workflow

```bash
# 1️⃣ Run Migration
cd backend
npm run migration:run

# 2️⃣ Verify Migration
psql -U postgres -d data_research_analysis -f scripts/verify-phase2-migration.sql

# 3️⃣ Run All Automated Tests
cd /home/dataresearchanalysis
./backend/scripts/run-phase2-tests.sh all

# 4️⃣ Run Integration Tests (update tokens first)
./backend/scripts/integration-test-phase2.sh
```

---

## 🎯 Individual Test Commands

### Backend API Tests (18 tests)
```bash
cd backend
npm test -- phase2-workspace-validation.test.ts
```

### Frontend Validation Tests (34 tests)
```bash
cd frontend
npm test -- phase2-workspace-validation.test.ts
```

### Migration Verification (14 checks)
```bash
psql -U postgres -d data_research_analysis -f backend/scripts/verify-phase2-migration.sql
```

### Integration Tests (9 API tests)
```bash
# First, edit backend/scripts/integration-test-phase2.sh:
# - Update AUTH_TOKEN_USER1 and AUTH_TOKEN_USER2
# - Update PROJECT_ID_WS1, PROJECT_ID_WS2
# - Update WORKSPACE_ID_1, WORKSPACE_ID_2

./backend/scripts/integration-test-phase2.sh
```

---

## 📊 Test Suite Selector

```bash
# Run all test suites
./backend/scripts/run-phase2-tests.sh all

# Backend only
./backend/scripts/run-phase2-tests.sh backend

# Frontend only
./backend/scripts/run-phase2-tests.sh frontend

# Migration verification only
./backend/scripts/run-phase2-tests.sh migration
```

---

## ✅ Success Indicators

### All Tests Passing
```
========================================
Test Summary
========================================
✓ Backend Tests: PASSED
✓ Frontend Tests: PASSED
✓ Migration Verification: PASSED

All Phase 2 tests passed! ✓
```

### Migration Verification Success
All 14 checks should show: `✓ PASS`
- NULL workspace_id count: 0
- Organization consistency: 0 mismatches
- NOT NULL constraints: Applied
- Foreign keys: Exist

### Integration Tests Success
```
✓ All Integration Tests Passed!

Workspace validation is working correctly:
  • Same-workspace access: ✓ Allowed
  • Cross-workspace access: ✓ Blocked (403)
  • Cross-workspace update: ✓ Blocked (403)
  • Cross-workspace delete: ✓ Blocked (403)
```

---

## 🐛 Quick Troubleshooting

### Memory Error: "JavaScript heap out of memory"
**Problem:** Backend tests fail with heap allocation error

**Solution:** Already fixed in test runner script with:
- `NODE_OPTIONS="--max-old-space-size=4096"` (4GB heap)
- `--runInBand` flag (serial execution)

If still occurring:
```bash
# Run with even more memory
NODE_OPTIONS="--max-old-space-size=8192" npm test -- phase2-workspace-validation.test.ts --runInBand
```

### TypeScript Errors: "Cannot find module DRAUser"
**Problem:** Test file used old/incorrect model names

**Solution:** Already fixed - test now uses:
- `DRAUsersPlatform` instead of `DRAUser`
- Relation-based entity creation (e.g., `organization: testOrg1` instead of `organization_id: testOrg1.id`)
- Minimal Express app for testing instead of importing full server

### Tests fail: "Cannot find module"
```bash
cd backend && npm install
cd frontend && npm install
```

### Tests fail: "Database connection error"
```bash
docker-compose up -d
```

### Tests fail: "Migration not executed"
```bash
cd backend
npm run migration:run
```

### Frontend tests fail: "localStorage is not defined"
- Already mocked in test file
- Check Vitest config has `environment: 'happy-dom'`

### Integration tests fail: "Auth token invalid"
- Update tokens in `backend/scripts/integration-test-phase2.sh`
- Generate real JWT tokens from login endpoint
- Update project IDs and workspace IDs

---

## 📝 Manual Frontend Testing

### Test Workspace Validation Modal

1. **Clear workspace selection:**
   ```javascript
   // In browser console (F12)
   localStorage.removeItem('selected_workspace');
   ```

2. **Navigate to any data source page:**
   - `/projects/1/data-sources/connect/postgresql`
   - `/projects/1/data-sources/connect/excel`
   - `/projects/1/data-sources/connect/google-analytics`

3. **Fill form and click connect/create**

4. **Expected: Modal appears**
   - Title: "Workspace Required"
   - Icon: ⚠️ Warning
   - Button color: Blue (#3C8DBC)
   - Text mentions workspace selection

5. **Select workspace and retry**
   - Expected: Classification modal appears (success)

### Test API Protection

```bash
# Get your auth token from browser dev tools
TOKEN="your-jwt"

# Create resource in Workspace 1
curl -X POST http://localhost:3002/data-source/add-csv \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Workspace-Id: 1" \
  -H "Content-Type: application/json" \
  -d '{"project_id": 1, "name": "Test"}'

# Try to access from Workspace 2 (should get 403)
curl -X GET http://localhost:3002/data-source/42 \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Workspace-Id: 2"
```

---

## 🔗 Full Documentation

For detailed test descriptions, troubleshooting, and procedures:
→ [Phase 2 Testing Guide](./phase2-testing-guide.md)

---

## 📞 Quick Help

**All tests passing?** → Ready for deployment!  
**Migration verification fails?** → Check migration logs, may need rollback  
**Frontend tests fail?** → Verify imports and localStorage mocks  
**Backend tests fail?** → Check database connection and auth tokens  
**Integration tests fail?** → Update tokens/IDs in script configuration

---

*Last updated: Phase 2 implementation - March 2026*
