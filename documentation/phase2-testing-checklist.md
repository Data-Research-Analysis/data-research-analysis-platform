# Phase 2 Testing Checklist

**Date**: ________________  
**Tester**: ________________  
**Environment**: ☐ Local  ☐ Staging  ☐ Production

---

## Pre-Testing Setup

- [ ] Docker containers running (`docker-compose up -d`)
- [ ] Backend server running on port 3002
- [ ] Frontend server running on port 3000
- [ ] Database accessible (test connection)
- [ ] Auth tokens available for testing

---

## 1. Migration Execution

- [ ] Created database backup before migration
- [ ] Ran migration: `cd backend && npm run migration:run`
- [ ] Migration completed without errors
- [ ] Verified migration in `dra_migrations` table

**Migration Output:**
```
Status: ☐ SUCCESS  ☐ FAILED
Error (if any): _________________________________
```

---

## 2. Migration Verification (SQL Script)

- [ ] Ran: `psql -U postgres -d data_research_analysis -f backend/scripts/verify-phase2-migration.sql`

**Results (all should show ✓ PASS):**
- [ ] CHECK 1: Data Sources - NULL workspace_id (0 expected)
- [ ] CHECK 2: Data Models - NULL workspace_id (0 expected)
- [ ] CHECK 3: Dashboards - NULL workspace_id (0 expected)
- [ ] CHECK 4: Table Metadata - NULL workspace_id (0 expected)
- [ ] CHECK 5: Column Metadata - NULL workspace_id (0 expected)
- [ ] CHECK 6: Join Metadata - NULL workspace_id (0 expected)
- [ ] CHECK 7: Row Count Metadata - NULL workspace_id (0 expected)
- [ ] CHECK 8: Data Quality Metadata - NULL workspace_id (0 expected)
- [ ] CHECK 9: Data Sources - Organization consistency (0 mismatches)
- [ ] CHECK 10: Data Models - Organization consistency (0 mismatches)
- [ ] CHECK 11: Dashboards - Organization consistency (0 mismatches)
- [ ] CHECK 12: NOT NULL constraints applied
- [ ] CHECK 13: Foreign key constraints exist
- [ ] CHECK 14: Resource count summary looks correct

**Status**: ☐ All Passed  ☐ Some Failed

---

## 3. Backend Automated Tests

- [ ] Ran: `cd backend && npm test -- phase2-workspace-validation.test.ts`

**Test Results:**
- [ ] Data Source Workspace Validation (4 tests)
  - [ ] Same workspace access allowed
  - [ ] Different workspace access denied (403)
  - [ ] Update denied across workspaces
  - [ ] Delete denied across workspaces
  
- [ ] Data Model Workspace Validation (4 tests)
  - [ ] Same workspace access allowed
  - [ ] Different workspace access denied (403)
  - [ ] Copy denied across workspaces
  - [ ] Delete denied across workspaces
  
- [ ] Dashboard Workspace Validation (4 tests)
  - [ ] Same workspace access allowed
  - [ ] Different workspace access denied (403)
  - [ ] Update denied across workspaces
  - [ ] Delete denied across workspaces
  
- [ ] Migration Verification (4 tests)
  - [ ] All data sources have workspace_id
  - [ ] All data models have workspace_id
  - [ ] All dashboards have workspace_id
  - [ ] Organization IDs match workspace

- [ ] Workspace Context Middleware (2 tests)
  - [ ] Extracts workspace_id correctly
  - [ ] Rejects requests without context

**Total**: ___/18 tests passed  
**Status**: ☐ All Passed  ☐ Some Failed

---

## 4. Frontend Automated Tests

- [ ] Ran: `cd frontend && npm test -- phase2-workspace-validation.test.ts`

**Test Results:**
- [ ] useOrganizationContext Composable (3 tests)
- [ ] Data Source Pages - PostgreSQL (1 test)
- [ ] Data Source Pages - Excel Upload (1 test)
- [ ] Data Source Pages - OAuth Integration (2 tests)
- [ ] Data Model Builder - Save Function (2 tests)
- [ ] Data Model Edit - Copy Function (1 test)
- [ ] Dashboard Create Page (1 test)
- [ ] Dashboard Update Page (1 test)
- [ ] Error Message Consistency (2 tests)
- [ ] Integration Test - Full Flow (1 test)

**Total**: ___/34 tests passed  
**Status**: ☐ All Passed  ☐ Some Failed

---

## 5. Integration Tests (API)

- [ ] Updated tokens in `backend/scripts/integration-test-phase2.sh`
- [ ] Updated project IDs and workspace IDs
- [ ] Ran: `./backend/scripts/integration-test-phase2.sh`

**Test Results:**
- [ ] Test 1: Create Data Source in Workspace 1
- [ ] Test 2: Access from Same Workspace (200 OK)
- [ ] Test 3: Access from Different Workspace (403)
- [ ] Test 4: Create Data Model in Workspace 1
- [ ] Test 5: Access Model from Different Workspace (403)
- [ ] Test 6: Create Dashboard in Workspace 1
- [ ] Test 7: Access Dashboard from Different Workspace (403)
- [ ] Test 8: Update from Different Workspace (403)
- [ ] Test 9: Delete from Different Workspace (403)

**Total**: ___/9 tests passed  
**Status**: ☐ All Passed  ☐ Some Failed

---

## 6. Manual Frontend Testing

### Test Case 1: Data Source - No Workspace
- [ ] Opened browser developer tools (F12)
- [ ] Cleared workspace: `localStorage.removeItem('selected_workspace');`
- [ ] Navigated to: `/projects/1/data-sources/connect/postgresql`
- [ ] Filled in connection details
- [ ] Clicked "Connect"
- [ ] ✓ Workspace Required modal appeared
- [ ] Modal styling correct (warning icon, blue button)

**Status**: ☐ Pass  ☐ Fail

### Test Case 2: Data Source - With Workspace
- [ ] Selected workspace from header dropdown
- [ ] Filled in connection details
- [ ] Clicked "Connect"
- [ ] ✓ Classification modal appeared (no workspace error)

**Status**: ☐ Pass  ☐ Fail

### Test Case 3: Data Model - No Workspace
- [ ] Cleared workspace selection
- [ ] Navigated to: `/projects/1/data-models/create`
- [ ] Built data model and clicked "Save Model"
- [ ] ✓ Workspace Required modal appeared

**Status**: ☐ Pass  ☐ Fail

### Test Case 4: Dashboard - No Workspace
- [ ] Cleared workspace selection
- [ ] Navigated to: `/projects/1/dashboards/create`
- [ ] Created charts and clicked "Save Dashboard"
- [ ] ✓ Workspace Required modal appeared

**Status**: ☐ Pass  ☐ Fail

### Test Case 5: Excel Upload - No Workspace
- [ ] Cleared workspace selection
- [ ] Navigated to: `/projects/1/data-sources/connect/excel`
- [ ] Uploaded Excel file and clicked "Create Data Source"
- [ ] ✓ Workspace Required modal appeared

**Status**: ☐ Pass  ☐ Fail

### Test Case 6: OAuth Flow - No Workspace
- [ ] Cleared workspace selection
- [ ] Navigated to: `/projects/1/data-sources/connect/google-analytics`
- [ ] Clicked "Connect with Google"
- [ ] ✓ Workspace Required modal appeared (before OAuth redirect)

**Status**: ☐ Pass  ☐ Fail

---

## 7. Manual API Testing (curl)

### Test: Cross-Workspace Access Protection

**Setup:**
```bash
TOKEN="your-jwt-token"
```

**Create Resource in Workspace 1:**
- [ ] Ran create command with Workspace 1 context
- [ ] Received 200 OK response
- [ ] Noted resource ID: _______

**Access from Workspace 2:**
- [ ] Ran GET request with Workspace 2 context
- [ ] Received 403 Forbidden response
- [ ] Error message mentions workspace

**Status**: ☐ Pass  ☐ Fail

---

## Summary

### Test Results Overview

| Test Suite | Tests | Passed | Failed | Status |
|------------|-------|--------|--------|--------|
| Migration Verification | 14 | ___ | ___ | ☐ Pass ☐ Fail |
| Backend Automated | 18 | ___ | ___ | ☐ Pass ☐ Fail |
| Frontend Automated | 34 | ___ | ___ | ☐ Pass ☐ Fail |
| Integration Tests | 9 | ___ | ___ | ☐ Pass ☐ Fail |
| Manual Frontend | 6 | ___ | ___ | ☐ Pass ☐ Fail |
| Manual API | 1 | ___ | ___ | ☐ Pass ☐ Fail |
| **TOTAL** | **82** | **___** | **___** | **☐ Pass ☐ Fail** |

### Overall Status

- ☐ **READY FOR DEPLOYMENT** - All tests passed
- ☐ **NEEDS FIXES** - Some tests failed (see notes below)
- ☐ **BLOCKED** - Critical failures, do not deploy

---

## Issues Found

**Issue 1:**
- Test: _________________________________
- Description: _________________________________
- Severity: ☐ Critical  ☐ High  ☐ Medium  ☐ Low
- Status: ☐ Fixed  ☐ In Progress  ☐ Pending

**Issue 2:**
- Test: _________________________________
- Description: _________________________________
- Severity: ☐ Critical  ☐ High  ☐ Medium  ☐ Low
- Status: ☐ Fixed  ☐ In Progress  ☐ Pending

**Issue 3:**
- Test: _________________________________
- Description: _________________________________
- Severity: ☐ Critical  ☐ High  ☐ Medium  ☐ Low
- Status: ☐ Fixed  ☐ In Progress  ☐ Pending

---

## Sign-Off

**Tested By**: ________________  **Date**: ________________

**Reviewed By**: ________________  **Date**: ________________

**Approved for Deployment**: ☐ Yes  ☐ No

**Notes:**
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

---

*Phase 2 Multi-Tenancy Testing Checklist - v1.0*
