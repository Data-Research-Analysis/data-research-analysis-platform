# Testing Guide - Phase 2 Multi-Tenancy

## Quick Start

```bash
# Complete test workflow
cd backend && npm run migration:run
psql -U postgres -d data_research_analysis -f scripts/verify-phase2-migration.sql
cd /home/dataresearchanalysis
./backend/scripts/run-phase2-tests.sh all
```

## Test Commands

| Command | Description |
|---------|-------------|
| `./backend/scripts/run-phase2-tests.sh all` | Run all Phase 2 tests |
| `./backend/scripts/run-phase2-tests.sh backend` | Backend API tests only |
| `./backend/scripts/run-phase2-tests.sh frontend` | Frontend validation tests |
| `./backend/scripts/run-phase2-tests.sh migration` | Migration verification |
| `./backend/scripts/integration-test-phase2.sh` | Integration tests (update tokens first) |

## Test Files

- **Backend**: `backend/src/__tests__/phase2-workspace-validation.test.ts` (18 tests)
- **Frontend**: `frontend/tests/phase2-workspace-validation.test.ts` (34 tests)
- **Migration**: `backend/scripts/verify-phase2-migration.sql` (14 checks)
- **Integration**: `backend/scripts/integration-test-phase2.sh` (9 API tests)

## Documentation

- 📘 **[Full Testing Guide](documentation/phase2-testing-guide.md)** - Complete procedures and troubleshooting
- 📋 **[Quick Reference](documentation/phase2-testing-quick-reference.md)** - Command cheat sheet

## Test Coverage

| Component | Backend | Frontend | Total |
|-----------|---------|----------|-------|
| Data Sources | ✅ 4 tests | ✅ 6 tests | 10 tests |
| Data Models | ✅ 4 tests | ✅ 4 tests | 8 tests |
| Dashboards | ✅ 4 tests | ✅ 4 tests | 8 tests |
| Composables | - | ✅ 3 tests | 3 tests |
| Middleware | ✅ 2 tests | - | 2 tests |
| Migration | ✅ 4 tests | - | 4 tests |
| **Total** | **18 tests** | **34 tests** | **52 tests** |

## Success Criteria

Phase 2 testing is successful when:

- ✅ All 52 automated tests pass
- ✅ Migration verification shows 0 NULL workspace_id values
- ✅ Database consistency checks all pass
- ✅ Frontend shows workspace modal when no workspace selected
- ✅ API returns 403 for cross-workspace access attempts
- ✅ Integration tests confirm workspace isolation working

## Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| "JavaScript heap out of memory" | Test runner uses `--max-old-space-size=4096` + `--runInBand` (already optimized) |
| TypeScript "Cannot find module DRAUser" | Already fixed - uses `DRAUsersPlatform` + relation-based creation |
| "Cannot find module" | `cd backend && npm install` |
| "Database connection error" | `docker-compose up -d` |
| "Migration not executed" | `cd backend && npm run migration:run` |
| "Auth token invalid" | Update tokens in integration-test-phase2.sh |

---

For detailed testing procedures, see [documentation/phase2-testing-guide.md](documentation/phase2-testing-guide.md)
