# Phase 2 Multi-Tenancy Testing Guide

## Overview

This guide covers all testing procedures for Phase 2 multi-tenancy workspace validation. Tests verify that:

1. ✅ All resources (data sources, models, dashboards) are properly isolated by workspace
2. ✅ Users cannot access resources from other workspaces
3. ✅ Frontend validation prevents creation without workspace selection
4. ✅ Backend middleware enforces workspace ownership
5. ✅ Migration successfully backfilled all existing data

---

## ⚡ Quick Start - Run All Tests

Complete test workflow from migration to integration testing:

```bash
# Step 1: Run the Phase 2 migration (if not already run)
cd backend
npm run migration:run

# Step 2: Verify migration success with database checks
psql -U postgres -d data_research_analysis -f scripts/verify-phase2-migration.sql

# Step 3: Run all automated tests (backend + frontend + migration verification)
cd /home/dataresearchanalysis
./backend/scripts/run-phase2-tests.sh all

# Step 4: Run integration tests (requires backend server running)
# First, update tokens/IDs in: backend/scripts/integration-test-phase2.sh
# Then run:
./backend/scripts/integration-test-phase2.sh

# Step 5: Manual frontend testing (see section below for steps)
# - Open browser to http://localhost:3000
# - Clear workspace selection in dev tools
# - Try creating data sources/models/dashboards
# - Verify workspace required modal appears
```

### 🏃 Quick Test Commands

```bash
# Backend API tests only
./backend/scripts/run-phase2-tests.sh backend

# Frontend validation tests only
./backend/scripts/run-phase2-tests.sh frontend

# Migration verification only
./backend/scripts/run-phase2-tests.sh migration

# Individual test suites
cd backend && npm test -- phase2-workspace-validation.test.ts
cd frontend && npm test -- phase2-workspace-validation.test.ts
```

### ✅ Expected Results

All tests passing should show:
```
========================================
Test Summary
========================================
✓ Backend Tests: PASSED
✓ Frontend Tests: PASSED
✓ Migration Verification: PASSED

All Phase 2 tests passed! ✓
```

---

## Test Suites

### 1. Backend API Tests

**File**: `backend/src/__tests__/phase2-workspace-validation.test.ts`

**What it tests**:
- ✅ Data sources: Create, read, update, delete with workspace isolation
- ✅ Data models: Create, read, update, copy, delete with workspace isolation
- ✅ Dashboards: Create, read, update, delete with workspace isolation
- ✅ Cross-workspace access returns 403 Forbidden
- ✅ Workspace context middleware extracts workspace_id correctly
- ✅ Migration verification (all resources have non-null workspace_id)

**Run individually**:
```bash
cd backend
npm test -- phase2-workspace-validation.test.ts
```

> **Note:** The test runner script (`run-phase2-tests.sh`) automatically adds `NODE_OPTIONS="--max-old-space-size=4096"` and `--runInBand` flags to prevent memory issues. If running tests manually and encountering heap errors, use:
> ```bash
> NODE_OPTIONS="--max-old-space-size=4096" npm test -- phase2-workspace-validation.test.ts --runInBand
> ```

**Expected output**:
```
PASS  src/__tests__/phase2-workspace-validation.test.ts
  Phase 2 Workspace Validation
    Data Source Workspace Validation
      ✓ should allow access to data source in same workspace (123ms)
      ✓ should deny access to data source in different workspace (45ms)
      ✓ should deny update to data source in different workspace (32ms)
      ✓ should deny delete of data source in different workspace (28ms)
    Data Model Workspace Validation
      ✓ should allow access to data model in same workspace (89ms)
      ✓ should deny access to data model in different workspace (41ms)
      ✓ should deny copy of data model from different workspace (37ms)
      ✓ should deny delete of data model in different workspace (29ms)
    Dashboard Workspace Validation
      ✓ should allow access to dashboard in same workspace (95ms)
      ✓ should deny access to dashboard in different workspace (43ms)
      ✓ should deny update to dashboard in different workspace (35ms)
      ✓ should deny delete of dashboard in different workspace (31ms)
    Migration Verification
      ✓ all data sources should have non-null workspace_id (12ms)
      ✓ all data models should have non-null workspace_id (10ms)
      ✓ all dashboards should have non-null workspace_id (9ms)
      ✓ all data sources should have matching organization_id (15ms)
    Workspace Context Middleware
      ✓ should extract workspace_id from user context (52ms)
      ✓ should reject requests without workspace context (38ms)

Test Suites: 1 passed, 1 total
Tests:       18 passed, 18 total
```

---

### 2. Frontend Validation Tests

**File**: `frontend/tests/phase2-workspace-validation.test.ts`

**What it tests**:
- ✅ `useOrganizationContext` composable validation logic
- ✅ Data source connection pages (13 pages) show workspace modal
- ✅ Data model save/copy functions block without workspace
- ✅ Dashboard create/update functions block without workspace
- ✅ Error messages are consistent across all pages
- ✅ Full integration flow with workspace selected

**Run individually**:
```bash
cd frontend
npm test -- phase2-workspace-validation.test.ts
```

**Expected output**:
```
✓ frontend/tests/phase2-workspace-validation.test.ts (34 tests) 1245ms
  ✓ Phase 2 Frontend Workspace Validation
    ✓ useOrganizationContext Composable
      ✓ should return invalid when no workspace selected
      ✓ should return valid when workspace is selected
      ✓ should return workspace name when selected
    ✓ Data Source Connection Pages - Workspace Validation
      ✓ PostgreSQL Connection Page
        ✓ should show workspace required modal when connecting without workspace
      ✓ Excel Upload Page
        ✓ should block data source creation without workspace
      ✓ OAuth Integration Pages
        ✓ should block Google Analytics OAuth flow without workspace
        ✓ should allow OAuth flow with valid workspace
    ✓ Data Model Pages - Workspace Validation
      ✓ Data Model Builder - Save Function
        ✓ should block save without workspace
        ✓ should allow save with valid workspace
      ✓ Edit Page - Copy Function
        ✓ should block copy without workspace
    ✓ Dashboard Pages - Workspace Validation
      ✓ Dashboard Create Page
        ✓ should block dashboard save without workspace
      ✓ Dashboard Update Page
        ✓ should block dashboard update without workspace
    ✓ Error Message Consistency
      ✓ all workspace validation modals should have consistent styling
      ✓ all workspace validation error messages should mention workspace
    ✓ Integration Test - Full Create Flow
      ✓ should complete full data source creation flow with workspace

Test Files  1 passed (1)
     Tests  34 passed (34)
```

---

## Manual Testing Procedures

### Step 1: Verify Migration

After running the migration (`npm run migration:run`), verify the database:

```bash
cd backend
npm run migration:run

# Check migration output for:
# ✓ Migration 1742682400000-Phase2AddWorkspaceColumns has been executed successfully
```

**Verify in database**:
```sql
-- All data sources should have workspace_id
SELECT COUNT(*) FROM dra_data_sources WHERE workspace_id IS NULL;
-- Expected: 0

-- All data models should have workspace_id
SELECT COUNT(*) FROM dra_data_models WHERE workspace_id IS NULL;
-- Expected: 0

-- All dashboards should have workspace_id
SELECT COUNT(*) FROM dra_dashboards WHERE workspace_id IS NULL;
-- Expected: 0

-- Check consistency: org_id matches workspace.org_id
SELECT COUNT(*) 
FROM dra_data_sources ds
JOIN dra_workspaces w ON ds.workspace_id = w.id
WHERE ds.organization_id != w.organization_id;
-- Expected: 0
```

---

### Step 2: Frontend Validation Testing

**Test Case 1: No Workspace Selected**

1. Open browser developer tools (F12)
2. Clear localStorage workspace selection:
   ```javascript
   localStorage.removeItem('selected_workspace');
   ```
3. Navigate to any data source connection page: `/projects/:id/data-sources/connect/postgresql`
4. Fill in connection details and click "Connect"
5. **Expected**: Modal appears with:
   - Title: "Workspace Required"
   - Text: "Please select a workspace before creating a data source."
   - Icon: Warning (⚠️)
   - Button color: `#3C8DBC` (blue)

**Test Case 2: Workspace Selected**

1. Select a workspace from the header workspace dropdown
2. Repeat steps 3-4 from Test Case 1
3. **Expected**: Classification modal appears (no workspace error)

**Test Case 3: Data Model Creation**

1. Clear workspace: `localStorage.removeItem('selected_workspace');`
2. Navigate to: `/projects/:id/data-models/create`
3. Build a data model and click "Save Model"
4. **Expected**: Workspace required modal appears (same styling as above)

**Test Case 4: Dashboard Creation**

1. Clear workspace selection
2. Navigate to: `/projects/:id/dashboards/create`
3. Create charts and click "Save Dashboard"
4. **Expected**: Workspace required modal appears

---

### Step 3: Backend API Testing

**Test Case 1: Cross-Workspace Access (403 Forbidden)**

Use Postman, curl, or similar tool to test API endpoints:

```bash
# Get your auth token
TOKEN="your-jwt-token-here"

# Create a data source in Workspace A
curl -X POST http://localhost:3002/data-source/add-csv \
  -H "Authorization: Bearer $TOKEN" \
  -H "Authorization-Type: auth" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": 1,
    "name": "Test CSV",
    "workspace_id": 1
  }'
# Note the returned data_source_id (e.g., 42)

# Switch to Workspace B in frontend header
# Try to access the data source from Workspace A
curl -X GET http://localhost:3002/data-source/42 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Authorization-Type: auth" \
  -H "X-Workspace-Id: 2"
# Expected: 403 Forbidden
# Response: {"success": false, "message": "Access denied: resource does not belong to your workspace"}
```

**Test Case 2: Same Workspace Access (200 OK)**

```bash
# Access the same data source with correct workspace context
curl -X GET http://localhost:3002/data-source/42 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Authorization-Type: auth" \
  -H "X-Workspace-Id: 1"
# Expected: 200 OK
# Response: {"success": true, "data_source": {...}}
```

---

## Automated Test Coverage

### Backend Coverage

| Component | Test Coverage | Lines Tested |
|-----------|--------------|--------------|
| DataSourceProcessor | ✅ Full | Workspace validation in all CRUD operations |
| DataModelProcessor | ✅ Full | Workspace validation + copy functionality |
| DashboardProcessor | ✅ Full | Workspace validation in create/update/delete |
| Workspace Middleware | ✅ Full | Context extraction + rejection |
| Migration | ✅ Full | NULL check + org consistency |

### Frontend Coverage

| Component | Test Coverage | Lines Tested |
|-----------|--------------|--------------|
| useOrganizationContext | ✅ Full | requireWorkspace + getWorkspaceName |
| Data Source Pages | ✅ All 13 | Modal display + API blocking |
| Data Model Pages | ✅ All 3 | Save + copy validation |
| Dashboard Pages | ✅ All 2 | Create + update validation |
| Error Consistency | ✅ Full | Modal styling + messaging |

---

## Troubleshooting

### Tests Failing: "Cannot find module"

**Solution**: Install dependencies
```bash
cd backend && npm install
cd frontend && npm install
```

### Tests Failing: "Database connection error"

**Solution**: Start Docker containers
```bash
docker-compose up -d
```

### Tests Failing: "Migration not executed"

**Solution**: Run migration first
```bash
cd backend
npm run migration:run
```

### Frontend Tests Failing: "localStorage is not defined"

**Solution**: Already handled in test file with mock. If still failing, ensure Vitest config has:
```javascript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'happy-dom', // or 'jsdom'
  },
});
```

### Backend Tests Failing: "Auth token invalid"

**Note**: The backend test file uses placeholder tokens (`mock-token-user1`). For integration tests with actual API calls, you need to:

1. Generate real JWT tokens using `AuthProcessor.generateToken()`
2. Update `beforeAll()` section with actual token generation:
```typescript
authToken1 = await AuthProcessor.getInstance().generateToken(user1.id);
authToken2 = await AuthProcessor.getInstance().generateToken(user2.id);
```

---

## Success Criteria

Phase 2 testing is considered successful when:

- ✅ All automated tests pass (backend + frontend + migration)
- ✅ Manual testing confirms workspace modals appear correctly
- ✅ Database verification shows 0 NULL workspace_id values
- ✅ API returns 403 for cross-workspace access attempts
- ✅ No compilation errors in frontend or backend
- ✅ Migration runs successfully without errors

---

## Next Steps After Testing

Once all tests pass:

1. **Create database backup**: Always backup before production deployment
2. **Deploy to staging**: Test in staging environment first
3. **Run tests in staging**: Verify behavior matches local testing
4. **Production deployment**:
   - Run migration: `npm run migration:run`
   - Monitor logs for 403 errors (expected for cross-workspace attempts)
   - Verify users can create resources with workspace selected
5. **Monitor for issues**: Watch for workspace-related errors in first 24-48 hours

---

## Test Maintenance

When adding new features requiring workspace validation:

1. **Backend**: Add test cases to `phase2-workspace-validation.test.ts`
2. **Frontend**: Add test cases to frontend test file
3. **Update this guide**: Document new manual testing procedures
4. **Run full suite**: Ensure no regressions

---

## Support

If tests fail and you need assistance:

1. Check error messages carefully - they often indicate the exact issue
2. Verify Docker containers are running: `docker-compose ps`
3. Check database connection: Test a simple query in your DB client
4. Review migration output for any failed steps
5. Check browser console for frontend errors (F12)

For Phase 2 implementation questions, refer to:
- Main documentation: `/documentation/comprehensive-architecture-documentation.md`
- Migration guide: Phase 2 migration file comments
- Processor implementations: `backend/src/processors/*Processor.ts`
