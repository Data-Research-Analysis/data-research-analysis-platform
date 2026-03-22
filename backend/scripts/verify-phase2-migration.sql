-- Phase 2 Migration Verification Script
-- 
-- Run this script AFTER running the Phase 2 migration to verify:
-- 1. All resources have non-null workspace_id
-- 2. Organization IDs match between resources and workspaces
-- 3. No orphaned data exists
-- 4. Constraints are properly applied
--
-- Usage: psql -U postgres -d data_research_analysis -f verify-phase2-migration.sql

\echo '========================================';
\echo 'Phase 2 Migration Verification';
\echo '========================================';
\echo '';

-- Check 1: Data Sources - NULL workspace_id check
\echo 'CHECK 1: Data Sources - NULL workspace_id count';
\echo '------------------------------------------------';
SELECT 
    'dra_data_sources' as table_name,
    COUNT(*) as null_workspace_count,
    CASE 
        WHEN COUNT(*) = 0 THEN '✓ PASS' 
        ELSE '✗ FAIL - Found NULL workspace_id values'
    END as status
FROM dra_data_sources 
WHERE workspace_id IS NULL;
\echo '';

-- Check 2: Data Models - NULL workspace_id check
\echo 'CHECK 2: Data Models - NULL workspace_id count';
\echo '------------------------------------------------';
SELECT 
    'dra_data_models' as table_name,
    COUNT(*) as null_workspace_count,
    CASE 
        WHEN COUNT(*) = 0 THEN '✓ PASS' 
        ELSE '✗ FAIL - Found NULL workspace_id values'
    END as status
FROM dra_data_models 
WHERE workspace_id IS NULL;
\echo '';

-- Check 3: Dashboards - NULL workspace_id check
\echo 'CHECK 3: Dashboards - NULL workspace_id count';
\echo '------------------------------------------------';
SELECT 
    'dra_dashboards' as table_name,
    COUNT(*) as null_workspace_count,
    CASE 
        WHEN COUNT(*) = 0 THEN '✓ PASS' 
        ELSE '✗ FAIL - Found NULL workspace_id values'
    END as status
FROM dra_dashboards 
WHERE workspace_id IS NULL;
\echo '';

-- Check 4: Table Metadata - NULL workspace_id check
\echo 'CHECK 4: Table Metadata - NULL workspace_id count';
\echo '------------------------------------------------';
SELECT 
    'dra_table_metadata' as table_name,
    COUNT(*) as null_workspace_count,
    CASE 
        WHEN COUNT(*) = 0 THEN '✓ PASS' 
        ELSE '✗ FAIL - Found NULL workspace_id values'
    END as status
FROM dra_table_metadata 
WHERE workspace_id IS NULL;
\echo '';

-- Check 5: Column Metadata - NULL workspace_id check
\echo 'CHECK 5: Column Metadata - NULL workspace_id count';
\echo '------------------------------------------------';
SELECT 
    'dra_column_metadata' as table_name,
    COUNT(*) as null_workspace_count,
    CASE 
        WHEN COUNT(*) = 0 THEN '✓ PASS' 
        ELSE '✗ FAIL - Found NULL workspace_id values'
    END as status
FROM dra_column_metadata 
WHERE workspace_id IS NULL;
\echo '';

-- Check 6: Join Metadata - NULL workspace_id check
\echo 'CHECK 6: Join Metadata - NULL workspace_id count';
\echo '------------------------------------------------';
SELECT 
    'dra_join_metadata' as table_name,
    COUNT(*) as null_workspace_count,
    CASE 
        WHEN COUNT(*) = 0 THEN '✓ PASS' 
        ELSE '✗ FAIL - Found NULL workspace_id values'
    END as status
FROM dra_join_metadata 
WHERE workspace_id IS NULL;
\echo '';

-- Check 7: Row Count Metadata - NULL workspace_id check
\echo 'CHECK 7: Row Count Metadata - NULL workspace_id count';
\echo '------------------------------------------------';
SELECT 
    'dra_row_count_metadata' as table_name,
    COUNT(*) as null_workspace_count,
    CASE 
        WHEN COUNT(*) = 0 THEN '✓ PASS' 
        ELSE '✗ FAIL - Found NULL workspace_id values'
    END as status
FROM dra_row_count_metadata 
WHERE workspace_id IS NULL;
\echo '';

-- Check 8: Data Quality Metadata - NULL workspace_id check
\echo 'CHECK 8: Data Quality Metadata - NULL workspace_id count';
\echo '------------------------------------------------';
SELECT 
    'dra_data_quality_metadata' as table_name,
    COUNT(*) as null_workspace_count,
    CASE 
        WHEN COUNT(*) = 0 THEN '✓ PASS' 
        ELSE '✗ FAIL - Found NULL workspace_id values'
    END as status
FROM dra_data_quality_metadata 
WHERE workspace_id IS NULL;
\echo '';

-- Check 9: Organization consistency - Data Sources
\echo 'CHECK 9: Data Sources - Organization consistency';
\echo '------------------------------------------------';
SELECT 
    COUNT(*) as mismatch_count,
    CASE 
        WHEN COUNT(*) = 0 THEN '✓ PASS - All organization IDs match workspace'
        ELSE '✗ FAIL - Found mismatched organization_id values'
    END as status
FROM dra_data_sources ds
JOIN dra_workspaces w ON ds.workspace_id = w.id
WHERE ds.organization_id != w.organization_id;
\echo '';

-- Check 10: Organization consistency - Data Models
\echo 'CHECK 10: Data Models - Organization consistency';
\echo '------------------------------------------------';
SELECT 
    COUNT(*) as mismatch_count,
    CASE 
        WHEN COUNT(*) = 0 THEN '✓ PASS - All organization IDs match workspace'
        ELSE '✗ FAIL - Found mismatched organization_id values'
    END as status
FROM dra_data_models dm
JOIN dra_workspaces w ON dm.workspace_id = w.id
WHERE dm.organization_id != w.organization_id;
\echo '';

-- Check 11: Organization consistency - Dashboards
\echo 'CHECK 11: Dashboards - Organization consistency';
\echo '------------------------------------------------';
SELECT 
    COUNT(*) as mismatch_count,
    CASE 
        WHEN COUNT(*) = 0 THEN '✓ PASS - All organization IDs match workspace'
        ELSE '✗ FAIL - Found mismatched organization_id values'
    END as status
FROM dra_dashboards d
JOIN dra_workspaces w ON d.workspace_id = w.id
WHERE d.organization_id != w.organization_id;
\echo '';

-- Check 12: Verify NOT NULL constraints exist
\echo 'CHECK 12: NOT NULL Constraints Verification';
\echo '------------------------------------------------';
SELECT 
    table_name,
    column_name,
    is_nullable,
    CASE 
        WHEN is_nullable = 'NO' THEN '✓ PASS - NOT NULL constraint applied'
        ELSE '✗ FAIL - Column allows NULLs'
    END as status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('dra_data_sources', 'dra_data_models', 'dra_dashboards', 
                     'dra_table_metadata', 'dra_column_metadata', 'dra_join_metadata',
                     'dra_row_count_metadata', 'dra_data_quality_metadata')
  AND column_name IN ('organization_id', 'workspace_id')
ORDER BY table_name, column_name;
\echo '';

-- Check 13: Foreign key constraints verification
\echo 'CHECK 13: Foreign Key Constraints Verification';
\echo '------------------------------------------------';
SELECT 
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    '✓ PASS - FK constraint exists' as status
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('dra_data_sources', 'dra_data_models', 'dra_dashboards',
                        'dra_table_metadata', 'dra_column_metadata', 'dra_join_metadata',
                        'dra_row_count_metadata', 'dra_data_quality_metadata')
  AND kcu.column_name IN ('organization_id', 'workspace_id')
ORDER BY tc.table_name, kcu.column_name;
\echo '';

-- Check 14: Resource count summary
\echo 'CHECK 14: Resource Count Summary';
\echo '------------------------------------------------';
SELECT 
    'Data Sources' as resource_type,
    COUNT(*) as total_count,
    COUNT(DISTINCT workspace_id) as unique_workspaces,
    COUNT(DISTINCT organization_id) as unique_organizations
FROM dra_data_sources
UNION ALL
SELECT 
    'Data Models' as resource_type,
    COUNT(*) as total_count,
    COUNT(DISTINCT workspace_id) as unique_workspaces,
    COUNT(DISTINCT organization_id) as unique_organizations
FROM dra_data_models
UNION ALL
SELECT 
    'Dashboards' as resource_type,
    COUNT(*) as total_count,
    COUNT(DISTINCT workspace_id) as unique_workspaces,
    COUNT(DISTINCT organization_id) as unique_organizations
FROM dra_dashboards;
\echo '';

-- Summary Report
\echo '========================================';
\echo 'VERIFICATION SUMMARY';
\echo '========================================';
\echo '';
\echo 'If all checks show "✓ PASS", the migration was successful!';
\echo '';
\echo 'If any checks show "✗ FAIL":';
\echo '1. Review the failed check details above';
\echo '2. Check migration logs for errors';
\echo '3. Consider rolling back and re-running migration';
\echo '';
\echo 'Next steps:';
\echo '- Run automated tests: ./backend/scripts/run-phase2-tests.sh all';
\echo '- Perform manual frontend testing (see documentation/phase2-testing-guide.md)';
\echo '- Monitor production logs after deployment';
\echo '';
