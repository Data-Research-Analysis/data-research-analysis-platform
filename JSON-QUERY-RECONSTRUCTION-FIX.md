# JSON Query Reconstruction Fix

## Problem Summary
When loading existing data models in edit mode, the backend was not reconstructing JOIN clauses from the saved JSON query structure. This resulted in queries missing JOINs, causing "missing FROM-clause entry" errors.

**Error Example:**
```
Query failed: missing FROM-clause entry for table "likes"
```

**Root Cause:** 
The backend's `executeQueryOnExternalDataSource` method was using the SQL query string passed from the frontend without considering the JSON query structure that contains JOIN conditions.

## Solution Overview
Implemented a complete SQL reconstruction system that rebuilds queries from JSON, ensuring all JOIN conditions are properly included.

## Changes Made

### 1. Backend - New SQL Reconstruction Function
**File:** `/backend/src/processors/DataSourceProcessor.ts`

Added `reconstructSQLFromJSON()` method that:
- Parses the JSON query structure
- Builds SELECT clause with proper column handling
- Excludes aggregate-only columns from SELECT
- Constructs FROM/JOIN clauses from `join_conditions` array
- Handles table aliases properly
- Adds WHERE, GROUP BY, HAVING, ORDER BY, LIMIT/OFFSET clauses
- Logs the reconstructed SQL for debugging

**Key Features:**
```typescript
public reconstructSQLFromJSON(queryJSON: any): string {
    // Tracks aggregate-only columns
    const aggregateColumns = new Set<string>();
    
    // Builds JOIN clauses from join_conditions array
    if (query.join_conditions && Array.isArray(query.join_conditions)) {
        // Maps left/right table structure to FROM/JOIN SQL
        fromJoinClauses.forEach((clause, index) => {
            if (index === 0) {
                // First JOIN - establish FROM and first JOIN
                fromJoinClause.push(`FROM ${leftTableSQL}`);
                fromJoinClause.push(`${joinType} JOIN ${rightTableSQL}`);
                fromJoinClause.push(`ON ${leftCondition} = ${rightCondition}`);
            } else {
                // Subsequent JOINs - add only missing tables
                if (!leftTableExists) {
                    fromJoinClause.push(`${joinType} JOIN ${leftTableSQL}`);
                    fromJoinClause.push(`ON ${joinCondition}`);
                } else if (!rightTableExists) {
                    fromJoinClause.push(`${joinType} JOIN ${rightTableSQL}`);
                    fromJoinClause.push(`ON ${joinCondition}`);
                }
            }
        });
    }
    
    return sqlParts.join(' ');
}
```

### 2. Backend - Updated Query Execution Method
**File:** `/backend/src/processors/DataSourceProcessor.ts`

Modified `executeQueryOnExternalDataSource()` to accept optional `queryJSON` parameter:

```typescript
public async executeQueryOnExternalDataSource(
    dataSourceId: number, 
    query: string, 
    tokenDetails: ITokenDetails, 
    queryJSON?: string  // NEW: Optional JSON query
): Promise<any>
```

**Logic:**
1. If `queryJSON` is provided, reconstruct SQL from JSON
2. Preserve LIMIT/OFFSET from original query
3. Execute reconstructed query with JOINs included
4. Log both original and reconstructed queries for debugging

### 3. Backend - Route Update
**File:** `/backend/src/routes/data_source.ts`

Updated route to accept and pass `query_json`:

```typescript
router.post('/execute-query-on-external-data-source', async (req: Request, res: Response, next: any) => {
    const { data_source_id, query } = matchedData(req);
    const query_json = req.body.query_json; // NEW: Optional JSON query
    const response = await DataSourceProcessor.getInstance()
        .executeQueryOnExternalDataSource(data_source_id, query, req.body.tokenDetails, query_json);
    res.status(200).send(response); 
});
```

### 4. Frontend - Send JSON Query
**File:** `/frontend/components/data-model-builder.vue`

Updated `executeQueryOnExternalDataSource()` to send JSON query structure:

```typescript
async function executeQueryOnExternalDataSource() {
    // ... existing code ...
    
    console.log('[Data Model Builder] JSON Query being sent:', JSON.stringify(state.data_table));
    
    body: JSON.stringify({
        data_source_id: route.params.datasourceid,
        query: state.sql_query,
        query_json: JSON.stringify(state.data_table),  // NEW: Send JSON structure
    })
}
```

## JSON Query Structure
The `join_conditions` array in the JSON query has this structure:

```json
{
  "columns": [
    {
      "schema": "test_schema",
      "table_name": "posts",
      "column_name": "post_id",
      "is_selected_column": true,
      "alias_name": "posts_post_id"
    }
  ],
  "join_conditions": [
    {
      "left_table_schema": "test_schema",
      "left_table_name": "comments",
      "left_column_name": "post_id",
      "right_table_schema": "test_schema",
      "right_table_name": "posts",
      "right_column_name": "post_id",
      "join_type": "INNER",
      "primary_operator": "=",
      "additional_conditions": []
    },
    {
      "left_table_schema": "test_schema",
      "left_table_name": "likes",
      "left_column_name": "post_id",
      "right_table_schema": "test_schema",
      "right_table_name": "posts",
      "right_column_name": "post_id",
      "join_type": "INNER",
      "primary_operator": "=",
      "additional_conditions": []
    }
  ],
  "query_options": {
    "group_by": {
      "name": "Group by posts",
      "aggregate_functions": [
        {
          "column": "test_schema.likes.user_id",
          "aggregate_function": 2,
          "column_alias_name": "total_likes"
        }
      ]
    }
  }
}
```

## Reconstructed SQL Output
**Before Fix:**
```sql
SELECT test_schema.posts.post_id AS posts_post_id, 
       test_schema.posts.image_url AS posts_image_url, 
       COUNT(test_schema.likes.user_id) AS total_likes
FROM test_schema.posts
GROUP BY test_schema.posts.post_id, test_schema.posts.image_url
LIMIT 5 OFFSET 0
-- Error: missing FROM-clause entry for table "likes"
```

**After Fix:**
```sql
SELECT test_schema.posts.post_id AS posts_post_id, 
       test_schema.posts.image_url AS posts_image_url, 
       COUNT(test_schema.likes.user_id) AS total_likes, 
       COUNT(test_schema.comments.comment_id) AS total_comments
FROM test_schema.comments
INNER JOIN test_schema.posts ON test_schema.comments.post_id = test_schema.posts.post_id
INNER JOIN test_schema.likes ON test_schema.likes.post_id = test_schema.posts.post_id
GROUP BY test_schema.posts.post_id, test_schema.posts.image_url
LIMIT 5 OFFSET 0
-- Success: All tables properly joined
```

## Testing Checklist

### ✅ Backend Changes
- [x] Added `reconstructSQLFromJSON()` method to DataSourceProcessor
- [x] Updated `executeQueryOnExternalDataSource()` signature
- [x] Modified route to accept `query_json` parameter
- [x] Backend compiles without errors
- [x] Backend container restarted successfully

### ✅ Frontend Changes
- [x] Modified `executeQueryOnExternalDataSource()` to send JSON query
- [x] Frontend compiles without errors

### 🧪 Manual Testing Required
1. Open existing data model with JOINs in edit mode
2. Verify preview query executes successfully
3. Check backend logs for reconstructed SQL
4. Confirm results display properly
5. Test with various JOIN types (INNER, LEFT, RIGHT)
6. Test with aggregate functions (COUNT, SUM, AVG)
7. Test with multiple JOINs (3+ tables)
8. Test with table aliases
9. Test with WHERE clauses
10. Test with GROUP BY and HAVING clauses

## Backward Compatibility
- Changes are **backward compatible**
- If `query_json` is not provided, backend uses original SQL query
- Existing functionality preserved for non-JOIN queries
- Frontend now sends both SQL and JSON for maximum flexibility

## Benefits
1. **Reliability:** JOINs are always included when reconstructing from JSON
2. **Consistency:** Single source of truth (JSON query structure)
3. **Debugging:** Both original and reconstructed queries are logged
4. **Flexibility:** Can use either SQL or JSON query as needed
5. **Maintainability:** Centralized SQL reconstruction logic

## Aggregate Column Handling

### Problem
AI-generated models include columns marked for both regular SELECT and aggregate functions. This causes:
1. Columns appearing in both SELECT and aggregate functions (e.g., `COUNT(posts.post_id)`)
2. These columns incorrectly included in GROUP BY clause
3. PostgreSQL errors: "missing FROM-clause entry" or "column must appear in GROUP BY"

**Example Issue:**
```json
{
  "columns": [
    {"column_name": "post_id", "is_selected_column": true},  // ❌ Should be false
    {"column_name": "user_id", "is_selected_column": true}
  ],
  "query_options": {
    "group_by": {
      "aggregate_functions": [
        {"column": "test_schema.posts.post_id", "aggregate_function": "COUNT"}  // post_id used here
      ]
    }
  }
}
```

### Solution Architecture

**Three-Layer Defense System:**

1. **Validation Phase** - `validateAndTransformAIModel()`
   - Identifies columns used ONLY in aggregate functions
   - Forces `is_selected_column = false` for aggregate-only columns
   - Filters `group_by_columns` array to remove aggregate-only columns

2. **Application Phase** - `applyAIGeneratedModel()`
   - Defensive post-processing check
   - Re-filters any aggregate columns that slipped through validation
   - Ensures data_table state is clean before query execution

3. **Query Building Phase** - `buildSQLQuery()`
   - Uses `is_selected_column` flag to exclude aggregate-only columns from SELECT
   - Uses filtered `group_by_columns` for GROUP BY clause
   - Only includes aggregate columns in aggregate functions

### Implementation Details

**Step 1: Mark Aggregate-Only Columns (Validation)**
```javascript
// In validateAndTransformAIModel()
if (aiModel.query_options.group_by?.aggregate_functions?.length > 0) {
    const aggregateColumns = new Set();
    
    // Collect all columns used in aggregates
    aiModel.query_options.group_by.aggregate_functions.forEach(aggFunc => {
        if (aggFunc.column) {
            aggregateColumns.add(aggFunc.column);
        }
    });
    
    // FORCE is_selected_column = false for aggregate-only columns
    aiModel.columns.forEach(col => {
        const fullPath = `${col.schema}.${col.table_name}.${col.column_name}`;
        if (aggregateColumns.has(fullPath)) {
            const beforeValue = col.is_selected_column;
            col.is_selected_column = false;  // FORCE override
            console.log(`[Validation] FORCED ${fullPath} to false (was: ${beforeValue})`);
        }
    });
}
```

**Step 2: Filter GROUP BY Columns (Validation)**
```javascript
// Remove aggregate-only columns from group_by_columns array
if (aiModel.query_options.group_by.group_by_columns) {
    const beforeCount = aiModel.query_options.group_by.group_by_columns.length;
    aiModel.query_options.group_by.group_by_columns = 
        aiModel.query_options.group_by.group_by_columns.filter(col => 
            !aggregateColumns.has(col)
        );
    const afterCount = aiModel.query_options.group_by.group_by_columns.length;
    console.log(`[Validation] Filtered GROUP BY: ${beforeCount} → ${afterCount}`);
}
```

**Step 3: Defensive Check (Application)**
```javascript
// In applyAIGeneratedModel() - safety net
if (state.data_table.query_options?.group_by?.aggregate_functions?.length > 0) {
    const aggregateColumns = new Set();
    state.data_table.query_options.group_by.aggregate_functions.forEach(aggFunc => {
        if (aggFunc.column) aggregateColumns.add(aggFunc.column);
    });
    
    // Re-check is_selected_column
    state.data_table.columns.forEach(col => {
        const fullPath = `${col.schema}.${col.table_name}.${col.column_name}`;
        if (aggregateColumns.has(fullPath) && col.is_selected_column === true) {
            console.warn(`[Defensive] Fixing ${fullPath}`);
            col.is_selected_column = false;
        }
    });
    
    // Re-filter group_by_columns
    if (state.data_table.query_options.group_by.group_by_columns) {
        state.data_table.query_options.group_by.group_by_columns = 
            state.data_table.query_options.group_by.group_by_columns.filter(col => 
                !aggregateColumns.has(col)
            );
    }
}
```

### Before and After

**Before Fix:**
```sql
-- Incorrect: aggregate columns in SELECT and GROUP BY
SELECT test_schema.users.user_id, 
       test_schema.users.username,
       test_schema.posts.post_id,        -- ❌ Should only be in COUNT()
       COUNT(test_schema.posts.post_id) AS total_posts
FROM test_schema.users
GROUP BY test_schema.users.user_id, 
         test_schema.users.username,
         test_schema.posts.post_id        -- ❌ Causes error
```

**After Fix:**
```sql
-- Correct: aggregate columns ONLY in aggregate functions
SELECT test_schema.users.user_id, 
       test_schema.users.username,
       COUNT(test_schema.posts.post_id) AS total_posts
FROM test_schema.users
INNER JOIN test_schema.posts ON test_schema.users.user_id = test_schema.posts.user_id
GROUP BY test_schema.users.user_id, 
         test_schema.users.username      -- ✅ Only non-aggregated columns
```

### Testing Aggregate Handling

**Console Verification:**
```javascript
// Check if columns are properly marked
state.data_table.columns.forEach(col => {
    const fullPath = `${col.schema}.${col.table_name}.${col.column_name}`;
    console.log(fullPath, '→ is_selected_column:', col.is_selected_column);
});

// Check GROUP BY array
console.log('GROUP BY columns:', 
    state.data_table.query_options.group_by.group_by_columns);

// Verify aggregate functions
console.log('Aggregate functions:', 
    state.data_table.query_options.group_by.aggregate_functions);
```

**Expected Output:**
```
test_schema.users.user_id → is_selected_column: true
test_schema.users.username → is_selected_column: true
test_schema.posts.post_id → is_selected_column: false     ✅
test_schema.comments.comment_id → is_selected_column: false ✅
test_schema.likes.post_id → is_selected_column: false      ✅

GROUP BY columns: ['test_schema.users.user_id', 'test_schema.users.username']

Aggregate functions: [
  {column: 'test_schema.posts.post_id', aggregate_function: 'COUNT'},
  {column: 'test_schema.comments.comment_id', aggregate_function: 'COUNT'},
  {column: 'test_schema.likes.post_id', aggregate_function: 'COUNT'}
]
```

## GROUP BY Column Filtering

### The Issue
Backend's `reconstructSQLFromJSON()` uses the `group_by_columns` array directly to build the GROUP BY clause. If this array contains aggregate-only columns, the reconstructed SQL will be invalid.

**Problem Flow:**
1. AI generates model with all columns in `group_by_columns` array (including aggregate-only)
2. Frontend sends JSON with unfiltered array to backend
3. Backend reconstructs: `GROUP BY col1, col2, aggregate_col1, aggregate_col2` ❌
4. PostgreSQL error: Column referenced in COUNT/SUM/etc cannot be in GROUP BY

### Filter Locations

**Location 1: Validation (Primary Filter)**
- **File:** `validateAndTransformAIModel()`
- **When:** During AI model validation, after marking `is_selected_column`
- **Purpose:** Clean the data before it enters the application state

```javascript
// Primary filtering in validation
if (aiModel.query_options.group_by.group_by_columns) {
    aiModel.query_options.group_by.group_by_columns = 
        aiModel.query_options.group_by.group_by_columns.filter(col => 
            !aggregateColumns.has(col)
        );
}
```

**Location 2: Application (Defensive Filter)**
- **File:** `applyAIGeneratedModel()`
- **When:** After model is applied to state, before query execution
- **Purpose:** Safety net to catch anything that slipped through validation

```javascript
// Defensive filtering in application
if (state.data_table.query_options.group_by.group_by_columns) {
    state.data_table.query_options.group_by.group_by_columns = 
        state.data_table.query_options.group_by.group_by_columns.filter(col => 
            !aggregateColumns.has(col)
        );
}
```

### Backend Reconstruction Logic

**File:** `/backend/src/processors/DataSourceProcessor.ts`

```typescript
// Backend uses group_by_columns array directly
let groupByClause = '';
if (query.query_options?.group_by?.group_by_columns?.length > 0) {
    groupByClause = ` GROUP BY ${query.query_options.group_by.group_by_columns.join(', ')}`;
}
```

**Critical:** Backend does NOT filter - it trusts the frontend has sent clean data. This is why frontend filtering is essential.

## JOIN Conditions Sync Issue

### Critical Problem
Frontend auto-detects JOINs and stores them in `state.join_conditions`, but backend receives empty `state.data_table.join_conditions`.

**Root Cause:**
- `state.join_conditions` (component-level state) - Used by `buildSQLQuery()` for frontend display
- `state.data_table.join_conditions` (data model state) - Sent to backend in JSON
- These are **separate arrays** that are not automatically synced

**Symptoms:**
1. Frontend SQL shows correct JOINs
2. Backend log: "Reconstructing query from JSON to ensure JOINs are included"
3. Backend reconstructed SQL has no JOINs
4. PostgreSQL error: "missing FROM-clause entry for table"

### Solution

**Explicit Sync After Auto-Detection:**
```javascript
// In applyAIGeneratedModel() after autoDetectJoinConditions()
autoDetectJoinConditions();
console.log(`[applyAIGeneratedModel] JOINs detected: ${state.join_conditions.length}`);

// CRITICAL: Sync to data_table so backend receives them
state.data_table.join_conditions = [...state.join_conditions];
console.log(`[applyAIGeneratedModel] Synced ${state.data_table.join_conditions.length} JOINs to data_table`);

// Also sync table_aliases
if (state.table_aliases && state.table_aliases.length > 0) {
    state.data_table.table_aliases = [...state.table_aliases];
    console.log(`[applyAIGeneratedModel] Synced ${state.data_table.table_aliases.length} aliases`);
}
```

### Verification

**Check Sync Status:**
```javascript
// Component state (used by frontend)
console.log('Component JOINs:', state.join_conditions.length);
console.log('Component JOINs:', JSON.stringify(state.join_conditions, null, 2));

// Data table state (sent to backend)
console.log('Data table JOINs:', state.data_table.join_conditions.length);
console.log('Data table JOINs:', JSON.stringify(state.data_table.join_conditions, null, 2));

// Should be identical
if (state.join_conditions.length !== state.data_table.join_conditions.length) {
    console.error('❌ JOIN sync failed!');
}
```

**Backend Verification:**
```
[DataSourceProcessor] Reconstructing query from JSON to ensure JOINs are included
[DataSourceProcessor] Found 5 JOIN conditions in query JSON
[DataSourceProcessor] Reconstructed SQL: SELECT ... FROM test_schema.users 
  INNER JOIN test_schema.comments ON ...
  INNER JOIN test_schema.posts ON ...
  INNER JOIN test_schema.likes ON ...
```

## Common Issues and Solutions

### Issue 1: Aggregate Columns in GROUP BY Clause
**Symptoms:**
- PostgreSQL error with columns used in COUNT/SUM/etc
- Backend receives 6+ columns in `group_by_columns`

**Diagnosis:**
```javascript
console.log('GROUP BY columns:', 
    state.data_table.query_options.group_by.group_by_columns);
// Should NOT contain any columns from aggregate_functions array
```

**Fix:**
- Ensure filtering runs in both `validateAndTransformAIModel()` and `applyAIGeneratedModel()`
- Check console for "Filtered GROUP BY columns: X → Y" messages

### Issue 2: Backend SQL Missing JOINs
**Symptoms:**
- Frontend shows correct SQL with JOINs
- Backend error: "missing FROM-clause entry for table"
- Backend log shows SQL without JOINs

**Diagnosis:**
```javascript
console.log('Frontend JOINs:', state.join_conditions.length);
console.log('Backend will receive:', state.data_table.join_conditions.length);
```

**Fix:**
- Verify sync happens after `autoDetectJoinConditions()`
- Look for log: "Synced X JOINs to data_table"

### Issue 3: Columns Marked for Both SELECT and Aggregate
**Symptoms:**
- Column appears in both SELECT list and aggregate function
- Unexpected results or cartesian products

**Diagnosis:**
```javascript
state.data_table.columns.forEach(col => {
    const fullPath = `${col.schema}.${col.table_name}.${col.column_name}`;
    const inAggregate = state.data_table.query_options.group_by.aggregate_functions
        .some(agg => agg.column === fullPath);
    console.log(fullPath, {
        is_selected_column: col.is_selected_column,
        in_aggregate: inAggregate,
        should_be_false: col.is_selected_column && inAggregate  // ❌ Problem
    });
});
```

**Fix:**
- Check for "FORCED ... to is_selected_column = false" logs
- Verify defensive check runs in `applyAIGeneratedModel()`

## Related Issues
- Fixed infinite recursive loop in watchers (completed)
- Fixed duplicate column error during save (completed)
- Fixed missing aggregate columns from SELECT (completed)
- Fixed missing JOINs when loading saved models (completed)
- **Fixed aggregate columns in GROUP BY clause (completed)**
- **Fixed JOIN conditions not syncing to backend (completed)**

## Next Steps
1. ✅ Test AI-generated models with aggregates
2. ✅ Verify GROUP BY filtering works correctly
3. ✅ Confirm JOIN sync happens after auto-detection
4. Test edge cases (self-joins, multiple aggregates, complex WHERE clauses)
5. Monitor backend logs for reconstruction errors
6. Update user documentation with aggregate best practices

---
**Last Updated:** December 6, 2025
**Related Documentation:** 
- `join-conditions-manager-implementation.md` - JOIN detection and sync
- `join-conditions-manager-quick-reference.md` - Quick troubleshooting guide
