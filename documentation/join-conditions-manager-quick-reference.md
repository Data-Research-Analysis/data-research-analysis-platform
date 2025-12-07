# JOIN Conditions Manager - Quick Reference

## Overview
Visual manager for controlling how tables are joined together in Data Model Builder.

---

## Key Functions

### User-Facing Functions

| Function | Purpose | Usage |
|----------|---------|-------|
| `hasMultipleTables()` | Check if JOINs needed | Returns true if 2+ tables in model |
| `openJoinDialog()` | Open JOIN creator | Click "Add JOIN Condition" button |
| `createJoinCondition()` | Create new JOIN | Fill form → click "Create JOIN" |
| `removeJoinCondition(index)` | Delete JOIN | Click "Remove" button on JOIN |
| `addAdditionalCondition(joinIndex)` | Add AND/OR clause | Click "Add AND/OR condition" link |

### Internal Functions

| Function | Purpose |
|----------|---------|
| `autoDetectJoinConditions()` | Generate JOINs from FKs |
| `getAvailableTablesForJoin()` | Get tables for dropdowns |
| `parseTableKey(key)` | Parse "schema.table::alias" |
| `getColumnsForTable(table, alias)` | Get columns for table |
| `isJoinFormValid()` | Validate form completeness |
| `getJoinFormPreview()` | Generate SQL preview |

---

## Data Structure

### JOIN Condition Object
```javascript
{
    id: 1234567890,                      // Timestamp ID
    left_table_schema: 'test_schema',
    left_table_name: 'users',
    left_table_alias: 'employees',       // null if not aliased
    left_column_name: 'manager_id',
    
    right_table_schema: 'test_schema',
    right_table_name: 'users',
    right_table_alias: 'managers',
    right_column_name: 'user_id',
    
    join_type: 'INNER',                  // INNER|LEFT|RIGHT|FULL OUTER
    is_auto_detected: true,              // Auto vs manual
    additional_conditions: [             // AND/OR clauses
        {
            logic: 'AND',                // AND|OR
            left_column: 'dept_id',
            operator: '=',               // =|!=|>|<|>=|<=
            right_column: 'dept_id'
        }
    ]
}
```

### State Fields
```javascript
state.join_conditions = []           // Array of JOIN objects
state.show_join_dialog = false       // Dialog visibility
state.join_form = {                  // Dialog form state
    left_table: '',
    left_table_alias: null,
    left_column: '',
    right_table: '',
    right_table_alias: null,
    right_column: '',
    join_type: 'INNER',
    additional_conditions: []
}
```

---

## SQL Generation

### Single Table
```javascript
// No JOINs needed
FROM test_schema.users
```

### Two Tables (INNER JOIN)
```javascript
FROM test_schema.users
INNER JOIN test_schema.orders
ON test_schema.users.user_id = test_schema.orders.user_id
```

### With Table Aliases
```javascript
FROM test_schema.users AS employees
INNER JOIN test_schema.users AS managers
ON test_schema.employees.manager_id = test_schema.managers.user_id
```

### With Additional Conditions
```javascript
FROM test_schema.orders
INNER JOIN test_schema.customers
ON test_schema.orders.customer_id = test_schema.customers.id
AND test_schema.orders.region = test_schema.customers.region
```

### LEFT JOIN
```javascript
FROM test_schema.users
LEFT JOIN test_schema.orders
ON test_schema.users.user_id = test_schema.orders.user_id
```

---

## UI Components

### JOIN Manager Section
**Location:** After Table Alias Manager  
**Visibility:** Only when `hasMultipleTables() === true`  
**Color:** Green border/background (vs blue for aliases)

**Elements:**
- Header with icon
- List of JOINs with details
- Additional conditions (inline editing)
- Remove buttons
- "Add JOIN Condition" button

### JOIN Creation Dialog
**Trigger:** Click "Add JOIN Condition"  
**Width:** 600px  
**Max Height:** 90vh with scroll

**Fields:**
1. JOIN Type dropdown (INNER, LEFT, RIGHT, FULL OUTER)
2. Left Table dropdown
3. Left Column dropdown
4. Right Table dropdown
5. Right Column dropdown
6. SQL Preview (read-only, real-time)
7. Tips section
8. Cancel / Create buttons

---

## Integration Points

### With Auto-Detection
```javascript
// In toggleColumnInDataModel() - after adding column
autoDetectJoinConditions();
await executeQueryOnExternalDataSource();
```

### With SQL Builder
```javascript
// In buildSQLQuery() - multi-table section
fromJoinClauses = state.join_conditions.map(join => ({
    // ... convert to internal format
    join_type: join.join_type || 'INNER'
}));
```

### With Persistence
```javascript
// Saved automatically with data model
query_json: JSON.stringify({
    ...state.data_table,  // includes join_conditions
})

// Loaded in onMounted()
state.data_table = props.dataModel.query;
if (!state.data_table.join_conditions) {
    state.data_table.join_conditions = [];  // Backward compatibility
}
```

---

## Common Patterns

### Pattern 1: Auto-Detected JOIN
```javascript
// User adds columns → auto-detection runs
1. User drags columns from 2 tables
2. autoDetectJoinConditions() finds FK
3. JOIN created with is_auto_detected: true
4. Purple badge shows "Auto-detected"
```

### Pattern 2: Manual JOIN
```javascript
// User creates custom JOIN
1. Click "Add JOIN Condition"
2. Fill form (type, tables, columns)
3. Preview shows SQL
4. Click "Create JOIN"
5. JOIN added with is_auto_detected: false
```

### Pattern 3: Self-Join
```javascript
// Reflexive relationship
1. Create aliases: employees, managers (both from users)
2. Add columns from both aliases
3. Create JOIN: employees.manager_id = managers.user_id
4. SQL uses AS clauses
```

### Pattern 4: Complex AND/OR
```javascript
// Multiple conditions
1. Create basic JOIN
2. Click "Add AND/OR condition"
3. Select AND/OR, columns, operator
4. SQL includes additional conditions
```

---

## Validation Rules

### Form Validation
- ✅ All 4 fields required (left table/column, right table/column)
- ✅ CREATE button disabled until valid
- ✅ Duplicate detection (warns if JOIN exists)

### Orphaned Tables
- ❌ Error if table has no JOIN to other tables
- 💡 Message suggests adding JOIN or removing columns

### Additional Conditions
- Each condition needs: logic + left_column + operator + right_column
- Empty conditions ignored in SQL generation

---

## Debugging

### Console Logs
```javascript
'[autoDetectJoinConditions] Starting auto-detection'
'[autoDetectJoinConditions] Found FK relationships: N'
'[autoDetectJoinConditions] Auto-detected N JOIN conditions'
'[Data Model Builder - buildSQLQuery] Using JOIN conditions from state: N'
```

### Common Issues

**Issue:** JOINs not appearing  
**Fix:** Check `hasMultipleTables()` returns true

**Issue:** Auto-detection not working  
**Fix:** Verify FK relationships exist in `state.tables[].references`

**Issue:** SQL generation fails  
**Fix:** Check for orphaned tables, ensure all tables in JOINs

**Issue:** Duplicate JOINs  
**Fix:** `createJoinCondition()` checks and warns

---

## Performance Notes

- Auto-detection runs on each column add/remove (fast, O(n²) where n = table count)
- SQL generation processes all JOINs each time (acceptable for typical models)
- No performance issues expected for models with <20 tables

---

## Browser Compatibility

- ✅ Chrome/Edge (tested)
- ✅ Firefox (should work)
- ✅ Safari (should work)
- Uses standard Vue 3 + Tailwind CSS

---

## Related Features

| Feature | Relationship |
|---------|--------------|
| **Table Aliases** | JOINs fully support aliased tables |
| **WHERE Clauses** | Similar UI pattern with AND/OR |
| **AI Data Modeler** | Can generate JOINs via prompts |
| **Data Model Persistence** | JOINs saved with models |

---

## Quick Start Examples

### Example 1: Basic Employee-Manager Self-Join
```javascript
// 1. Create aliases
"employees" → users table
"managers" → users table

// 2. Add columns
employees.employee_id, employees.name, employees.manager_id
managers.name (as manager_name)

// 3. Create JOIN
LEFT: test_schema.employees.manager_id
RIGHT: test_schema.managers.user_id
TYPE: LEFT JOIN

// Result SQL:
FROM test_schema.users AS employees
LEFT JOIN test_schema.users AS managers
ON test_schema.employees.manager_id = test_schema.managers.user_id
```

### Example 2: Multi-Table with Additional Condition
```javascript
// Tables: orders, customers, products
// Auto-detected: orders → customers, orders → products

// Add condition to orders-customers JOIN:
AND orders.ship_region = customers.billing_region

// Result SQL:
FROM test_schema.orders
INNER JOIN test_schema.customers
ON test_schema.orders.customer_id = test_schema.customers.id
AND test_schema.orders.ship_region = test_schema.customers.billing_region
INNER JOIN test_schema.products
ON test_schema.orders.product_id = test_schema.products.id
```

---

## Troubleshooting Common Issues

### Issue 1: Backend SQL Missing JOINs

**Symptoms:**
- ✅ Frontend displays SQL with correct JOINs
- ❌ Backend error: `missing FROM-clause entry for table "X"`
- ❌ Backend log shows SQL without JOIN clauses
- ❌ Query works in frontend preview but fails on execution

**Diagnosis:**
```javascript
// Check sync status
console.log('Frontend JOINs:', state.join_conditions.length);
console.log('Backend will receive:', state.data_table.join_conditions?.length || 0);

// They should be equal!
if (state.join_conditions.length !== state.data_table.join_conditions?.length) {
    console.error('❌ JOIN SYNC FAILED');
}
```

**Root Cause:**  
`state.join_conditions` (used by frontend) and `state.data_table.join_conditions` (sent to backend) are separate arrays that aren't automatically synced.

**Fix:**  
Ensure sync happens after auto-detection:
```javascript
// In applyAIGeneratedModel()
autoDetectJoinConditions();
state.data_table.join_conditions = [...state.join_conditions];  // ← CRITICAL
```

**Verification:**
```javascript
// Look for this in console logs:
'[applyAIGeneratedModel] JOINs detected: 5'
'[applyAIGeneratedModel] Synced 5 JOINs to data_table'  // ← Should see this

// Backend should log:
'[DataSourceProcessor] Found 5 JOIN conditions in query JSON'
```

---

### Issue 2: GROUP BY Contains Aggregate Columns

**Symptoms:**
- ❌ PostgreSQL error with columns used in COUNT/SUM/etc in GROUP BY
- ❌ Backend receives 6+ columns in `group_by_columns` array
- ❌ Error message: "column must appear in GROUP BY or be used in aggregate function"

**Diagnosis:**
```javascript
// Check GROUP BY array
console.log('GROUP BY columns:', 
    state.data_table.query_options.group_by.group_by_columns);

// Check aggregate functions
console.log('Aggregate columns:', 
    state.data_table.query_options.group_by.aggregate_functions.map(a => a.column));

// GROUP BY should NOT contain columns from aggregate_functions
```

**Example Problem:**
```sql
-- ❌ WRONG
SELECT user_id, username, COUNT(post_id)
FROM users
INNER JOIN posts ON users.user_id = posts.user_id
GROUP BY user_id, username, post_id  ← post_id should NOT be here

-- ✅ CORRECT
SELECT user_id, username, COUNT(post_id)
FROM users
INNER JOIN posts ON users.user_id = posts.user_id
GROUP BY user_id, username  ← Only non-aggregated columns
```

**Root Cause:**  
AI generates models with all columns in `group_by_columns` array, including those that should only be in aggregate functions.

**Fix:**  
Filter runs automatically in validation and application phases:
```javascript
// Look for these console logs:
'[Data Model Builder] Filtered GROUP BY columns: 6 → 3'
'[Data Model Builder] Remaining GROUP BY columns: [...]'
```

**Manual Fix (if needed):**
```javascript
const aggregateColumns = new Set();
state.data_table.query_options.group_by.aggregate_functions.forEach(agg => {
    aggregateColumns.add(agg.column);
});

state.data_table.query_options.group_by.group_by_columns = 
    state.data_table.query_options.group_by.group_by_columns.filter(col => 
        !aggregateColumns.has(col)
    );
```

---

### Issue 3: Columns Marked for Both SELECT and Aggregate

**Symptoms:**
- Column appears in both SELECT list and aggregate function
- Unexpected results or cartesian products
- Column has `is_selected_column: true` but is used in COUNT/SUM

**Diagnosis:**
```javascript
// Check each column
state.data_table.columns.forEach(col => {
    const fullPath = `${col.schema}.${col.table_name}.${col.column_name}`;
    const inAggregate = state.data_table.query_options.group_by.aggregate_functions
        .some(agg => agg.column === fullPath);
    
    if (col.is_selected_column && inAggregate) {
        console.error(`❌ PROBLEM: ${fullPath} is marked for both SELECT and aggregate`);
    }
});
```

**Expected Behavior:**
```javascript
// Aggregate-only column
{
    column_name: 'post_id',
    is_selected_column: false,  // ← Should be false
    // Used in aggregate_functions array
}

// Regular SELECT column
{
    column_name: 'user_id',
    is_selected_column: true,   // ← Can be true
    // NOT in aggregate_functions array
}
```

**Root Cause:**  
AI sets `is_selected_column: true` for all columns, even those that should only be in aggregates.

**Fix:**  
Validation automatically forces aggregate-only columns to `false`:
```javascript
// Look for console logs:
'[Data Model Builder] FORCED test_schema.posts.post_id to is_selected_column = false (was: true)'
```

---

### Issue 4: Query Executes Before JOINs Detected

**Symptoms:**
- First query execution fails
- Subsequent queries succeed
- Multiple backend errors in logs

**Diagnosis:**
```javascript
// Check execution order in logs
'[Data Model Builder] Clearing existing model'
'[buildSQLQuery] Using JOIN conditions from state: 0'  ← Problem!
'[autoDetectJoinConditions] Auto-detected 5 JOIN conditions'
'[buildSQLQuery] Using JOIN conditions from state: 5'  ← Now works
```

**Root Cause:**  
Reactive watcher triggers query execution before auto-detection completes.

**Expected Flow:**
1. Apply model to state
2. Auto-detect JOINs
3. Sync JOINs to data_table
4. Execute query

**Fix:**  
Auto-detection and sync now happen before query execution in `applyAIGeneratedModel()`.

---

## State Management Reference

### Dual State for JOIN Conditions

**Component State (`state.join_conditions`):**
- **Type:** Array of JOIN objects
- **Used by:** `buildSQLQuery()` for frontend SQL generation
- **Populated by:** `autoDetectJoinConditions()`
- **Displayed in:** JOIN Conditions Manager UI
- **Modified by:** User actions (create/remove JOINs)

**Data Table State (`state.data_table.join_conditions`):**
- **Type:** Array of JOIN objects (should mirror component state)
- **Used by:** Backend `reconstructSQLFromJSON()`
- **Sent to:** Backend in API requests
- **Persisted:** Saved with data model to database
- **Must be synced:** After auto-detection or manual changes

**Critical:** These must stay in sync or backend will not receive JOINs!

### Sync Verification Commands

```javascript
// Quick diagnostic function
function checkJoinSync() {
    const component = state.join_conditions.length;
    const dataTable = state.data_table.join_conditions?.length || 0;
    
    console.log('=== JOIN SYNC STATUS ===');
    console.log('Component JOINs:', component);
    console.log('Data Table JOINs:', dataTable);
    console.log('Status:', component === dataTable ? '✅ In Sync' : '❌ OUT OF SYNC');
    
    return component === dataTable;
}

// Check aggregate columns
function checkAggregateColumns() {
    const aggregates = new Set();
    state.data_table.query_options.group_by?.aggregate_functions?.forEach(agg => {
        if (agg.column) aggregates.add(agg.column);
    });
    
    console.log('=== AGGREGATE COLUMN STATUS ===');
    state.data_table.columns.forEach(col => {
        const fullPath = `${col.schema}.${col.table_name}.${col.column_name}`;
        const isAggregate = aggregates.has(fullPath);
        const status = isAggregate && col.is_selected_column ? '❌' : '✅';
        
        console.log(`${status} ${fullPath}:`, {
            is_selected_column: col.is_selected_column,
            used_in_aggregate: isAggregate
        });
    });
}

// Check GROUP BY columns
function checkGroupByColumns() {
    const aggregates = new Set();
    state.data_table.query_options.group_by?.aggregate_functions?.forEach(agg => {
        if (agg.column) aggregates.add(agg.column);
    });
    
    const groupBy = state.data_table.query_options.group_by?.group_by_columns || [];
    
    console.log('=== GROUP BY STATUS ===');
    console.log('GROUP BY columns:', groupBy);
    console.log('Aggregate columns:', Array.from(aggregates));
    
    const hasAggregatesInGroupBy = groupBy.some(col => aggregates.has(col));
    console.log('Status:', hasAggregatesInGroupBy ? '❌ Contains aggregate columns!' : '✅ Clean');
    
    return !hasAggregatesInGroupBy;
}

// Run all checks
function runDiagnostics() {
    console.log('\n🔍 Running Data Model Diagnostics...\n');
    const joinSync = checkJoinSync();
    const aggregates = checkAggregateColumns();
    const groupBy = checkGroupByColumns();
    console.log('\n📊 Diagnostics Complete\n');
    return joinSync && groupBy;
}
```

---

## PostgreSQL Error Reference

| Error Code | Message | Likely Cause | Fix |
|------------|---------|--------------|-----|
| **42P01** | missing FROM-clause entry for table "X" | JOINs not synced to backend | Sync `join_conditions` arrays |
| **42P01** | column "X" does not exist | Aggregate column in GROUP BY | Filter `group_by_columns` |
| **42803** | column "X" must appear in GROUP BY | Column in SELECT but not GROUP BY | Add to GROUP BY or remove from SELECT |
| **42703** | column "X" does not exist | Table not joined | Add JOIN condition |
| **42P10** | invalid reference to FROM-clause entry | Alias mismatch | Check table aliases |

---

## Quick Commands for Console

```javascript
// Copy-paste into browser console for debugging

// 1. Check sync status
console.log('Component:', state.join_conditions.length, 'Data Table:', state.data_table.join_conditions?.length);

// 2. View all JOINs
console.table(state.join_conditions);
console.table(state.data_table.join_conditions);

// 3. Check GROUP BY
console.log('GROUP BY:', state.data_table.query_options.group_by?.group_by_columns);
console.log('Aggregates:', state.data_table.query_options.group_by?.aggregate_functions?.map(a => a.column));

// 4. Check column flags
state.data_table.columns.forEach(c => console.log(`${c.schema}.${c.table_name}.${c.column_name}: is_selected=${c.is_selected_column}`));

// 5. Force sync (emergency fix)
state.data_table.join_conditions = [...state.join_conditions];
console.log('✅ Forced sync complete');
```

---

**Version:** 1.1  
**Last Updated:** December 6, 2025  
**Status:** Production Ready ✅  
**Related Docs:**
- `JSON-QUERY-RECONSTRUCTION-FIX.md` - Backend reconstruction details
- `join-conditions-manager-implementation.md` - Full implementation guide
