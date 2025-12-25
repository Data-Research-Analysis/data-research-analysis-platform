# Table Rename Migration Scripts

Complete toolset for physically renaming existing tables to hash-based names with metadata mapping.

## 📋 Overview

These scripts solve the PostgreSQL 63-character identifier limit for tables created **before** the hash-based naming system was implemented.

**What it does:**
- Analyzes existing tables with long names
- Generates hash-based short names (e.g., `ds23_a7b3c9d1`)
- Physically renames tables using `ALTER TABLE`
- Updates data model `query_json` references
- Creates metadata entries for logical name display
- Verifies rename success

---

## 🛠️ Scripts

### 1. **Analysis Script** (`analyze-tables-for-rename.ts`)

**Purpose:** Identify tables that need renaming and generate a detailed plan.

**Output:** `rename-plan.json`

**What it checks:**
- Table name length
- Existing metadata
- FK constraints (incoming/outgoing)
- Data model usage
- Risk assessment (LOW/MEDIUM/HIGH)

**Usage:**
```bash
npm run rename:analyze
```

**Output Example:**
```json
{
  "tablesToRename": 15,
  "schemaBreakdown": {
    "dra_excel": 8,
    "dra_pdf": 4
  },
  "riskAssessment": {
    "low": 10,
    "medium": 3,
    "high": 2
  }
}
```

---

### 2. **Rename Execution Script** (`rename-existing-tables.ts`)

**Purpose:** Execute the physical table renames with transaction safety.

**Features:**
- ✅ Transaction-based (all-or-nothing)
- ✅ Updates data model queries
- ✅ Creates metadata entries
- ✅ Handles FK constraints
- ✅ Automatic rollback on error
- ✅ Dry-run mode for testing

**Usage:**

**Dry Run (TEST MODE - no changes):**
```bash
npm run rename:execute:dry-run
```

**Live Execution:**
```bash
npm run rename:execute
```

**With custom plan file:**
```bash
node --import tsx scripts/rename-existing-tables.ts custom-plan.json
```

**Force execution (skip confirmation):**
```bash
node --import tsx scripts/rename-existing-tables.ts --force
```

---

### 3. **Verification Script** (`verify-renames.ts`)

**Purpose:** Verify rename success and data integrity.

**Checks:**
- ✓ Metadata exists for new tables
- ✓ New tables exist in database
- ✓ Old tables no longer exist
- ✓ FK constraints valid
- ✓ Data models work correctly

**Usage:**
```bash
npm run rename:verify
```

**Output:** `verification-result.json`

---

## 📖 Complete Workflow

### **Step 1: Analysis (Staging/Production)**
```bash
# Run analysis
npm run rename:analyze

# Review the plan
cat rename-plan.json

# Check high-risk tables
cat rename-plan.json | jq '.tables[] | select(.estimatedImpact == "HIGH")'
```

### **Step 2: Dry Run (Staging)**
```bash
# Test on staging without making changes
npm run rename:execute:dry-run

# Review what would happen
cat rename-result.json
```

### **Step 3: Backup Database**
```bash
# PostgreSQL backup
pg_dump your_database > backup-$(date +%Y%m%d-%H%M%S).sql
```

### **Step 4: Execute Rename (Staging)**
```bash
# Run on staging first
npm run rename:execute

# Verify success
npm run rename:verify
```

### **Step 5: Test Functionality (Staging)**
- Test affected data models
- Verify frontend displays logical names
- Check SQL queries execute correctly
- Test JOIN operations

### **Step 6: Production Deployment (if staging successful)**
```bash
# Schedule maintenance window
# Backup production
pg_dump production_db > production-backup-$(date +%Y%m%d-%H%M%S).sql

# Run analysis on production
npm run rename:analyze

# Execute rename
npm run rename:execute

# Verify immediately
npm run rename:verify
```

---

## ⚠️ Safety Features

### **Transaction Safety**
- All renames in single transaction
- Automatic rollback on any error
- Database remains consistent

### **Pre-Flight Checks**
- Validates rename plan exists
- Checks for duplicate target names
- Confirms data source IDs present
- Requires user confirmation (unless `--force`)

### **Dry Run Mode**
- Simulates entire process
- Shows all operations without executing
- Safe for testing

### **Error Handling**
- Continues on non-critical errors
- Logs all operations
- Detailed error messages

---

## 🔍 What Gets Updated

### **1. Physical Tables**
```sql
-- Before
dra_excel."excel_ABC123_data_source_23_very_long_sheet_name_that_exceeds_limit"

-- After
dra_excel."ds23_a7b3c9d1"
```

### **2. Data Model Queries**
```json
// Before
{
  "tables": [
    {
      "table_name": "excel_ABC123_data_source_23_very_long_sheet_name",
      "schema": "dra_excel"
    }
  ],
  "generated_sql": "SELECT * FROM dra_excel.\"excel_ABC123_data_source_23...\""
}

// After
{
  "tables": [
    {
      "table_name": "ds23_a7b3c9d1",
      "schema": "dra_excel"
    }
  ],
  "generated_sql": "SELECT * FROM dra_excel.\"ds23_a7b3c9d1\""
}
```

### **3. Metadata Table**
```sql
INSERT INTO dra_table_metadata (
    physical_table_name,  -- ds23_a7b3c9d1
    logical_table_name,   -- very long sheet name
    schema_name,          -- dra_excel
    ...
)
```

---

## 📊 Output Files

| File | Description |
|------|-------------|
| `rename-plan.json` | Analysis results and rename plan |
| `rename-result.json` | Execution results and operation log |
| `verification-result.json` | Verification results and checks |

---

## 🚨 Troubleshooting

### **"Target name already exists"**
**Cause:** Hash collision or table already renamed  
**Solution:** Check if table already has metadata, skip if already hash-named

### **"Data model update failed"**
**Cause:** Invalid query_json format or missing field  
**Solution:** Check data model structure, may need manual fix

### **"FK constraint violation"**
**Cause:** Foreign key references to renamed table  
**Solution:** Script handles this, but check FK definition if error persists

### **"Transaction rollback"**
**Cause:** Any error during execution triggers rollback  
**Solution:** Check error log, fix issue, re-run. Database unchanged due to rollback

---

## 📝 Best Practices

1. **Always test on staging first**
2. **Schedule during maintenance window**
3. **Create full database backup**
4. **Review high-risk tables manually**
5. **Run dry-run before live execution**
6. **Verify immediately after execution**
7. **Monitor data model functionality**
8. **Keep backup for 24-48 hours**

---

## 🔄 Rollback

If issues are detected:

1. **Automatic Rollback** (during execution):
   - Transaction fails → automatic rollback
   - Database unchanged

2. **Manual Rollback** (after execution):
   ```bash
   # Restore from backup
   psql your_database < backup-YYYYMMDD-HHMMSS.sql
   ```

3. **Partial Rollback** (individual tables):
   ```sql
   -- Rename back manually
   ALTER TABLE "schema"."newname" RENAME TO "oldname";
   
   -- Delete metadata
   DELETE FROM dra_table_metadata 
   WHERE physical_table_name = 'newname';
   ```

---

## ✅ Success Criteria

After execution, verify:
- [ ] All tables renamed successfully
- [ ] Metadata exists for all renamed tables
- [ ] Data models execute without errors
- [ ] Frontend displays logical names
- [ ] SQL queries use new physical names
- [ ] FK constraints intact
- [ ] Zero data loss
- [ ] Old tables no longer exist

---

## 🎯 Example Session

```bash
# 1. Run analysis
$ npm run rename:analyze
📊 Analyzing schema: dra_excel...
📊 Analyzing schema: dra_pdf...
✅ Analysis complete! Report saved to: rename-plan.json

# 2. Review plan
$ cat rename-plan.json | jq '.tablesToRename'
15

# 3. Dry run
$ npm run rename:execute:dry-run
🎯 Mode: DRY RUN
📋 Renaming 15 tables...
✅ SUCCESS

# 4. Execute
$ npm run rename:execute
⚠️  WARNING: This will physically rename tables!
Are you sure? (yes/no): yes
🔧 Renaming 15 tables...
✅ Transaction committed successfully

# 5. Verify
$ npm run rename:verify
✅ PASS
Tables Verified: 15
Check Results:
  metadataExists: 15 passed, 0 failed
  tableExists: 15 passed, 0 failed
```

---

## 💡 Additional Notes

- Scripts are **idempotent** - safe to run multiple times
- Only renames tables marked as `safeToRename: true`
- Preserves all data and relationships
- Minimal downtime (< 1 minute for typical database)
- Can be run in batches for large databases
- Detailed logging for audit trail

---

**For questions or issues, refer to the implementation plan:**
`/root/.gemini/antigravity/brain/[conversation-id]/table_rename_migration_plan.md`
