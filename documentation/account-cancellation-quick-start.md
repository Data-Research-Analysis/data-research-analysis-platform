# Account Cancellation System - Quick Start Guide

## 🚀 Deploy in 5 Minutes

### Prerequisites
- Backend running (Node.js + TypeScript)
- PostgreSQL database connected
- Redis connected
- Migrations up to date

### Step 1: Run Migration (30 seconds)
```bash
cd backend
npm run migration:run
```

**Expected Output:**
```
✓ Migration 1737849600000-CreateAccountCancellationSystem executed successfully
```

**Verifies:**
- `dra_platform_settings` table created
- `dra_account_cancellations` table created
- Indexes and foreign keys established

### Step 2: Run Seeder (10 seconds)
```bash
npm run seed:run -- -d ./src/datasources/PostgresDSMigrations.ts src/seeders/07-20260125-PlatformSettingsSeeder.ts
```

**Expected Output:**
```
Running PlatformSettingsSeeder
  ✅ Data retention period set to: 30 days
  ✅ Auto-deletion enabled: true
  ✅ All platform settings initialized successfully
```

**Default Settings Created:**
| Setting Key | Value | Description |
|------------|-------|-------------|
| `data_retention_days` | 30 | Days to keep data after cancellation |
| `auto_delete_enabled` | true | Enable scheduled deletion job |
| `notification_7_days_enabled` | true | Send 7-day warnings |
| `notification_1_day_enabled` | true | Send 1-day warnings |
| `allow_account_reactivation` | true | Allow users to reactivate |

### Step 3: Restart Backend Server (10 seconds)
The new routes and scheduled job will be registered on startup.

```bash
# If using docker-compose
docker-compose restart backend.dataresearchanalysis.test

# If running locally
npm run dev
```

**Verify in Logs:**
```
✅ OAuth session service initialized
✅ Scheduled backup service initialized
✅ Data source sync scheduler initialized
✅ Invitation expiration job started
✅ Scheduled deletion job started    <-- NEW
Socket.IO server initialized successfully
Data Research Analysis server is running at http://localhost:3001
```

### Step 4: Verify Routes (20 seconds)
Test that new endpoints are accessible:

```bash
# Test platform settings endpoint (requires admin JWT)
curl http://localhost:3001/admin/platform-settings

# Test account routes (requires user JWT)
curl http://localhost:3001/account/cancellation/status \
  -H "Cookie: dra_auth_token=YOUR_TOKEN"
```

**Expected:** 404 or authentication error (routes exist, just need auth)

### Step 5: Optional - Test Scheduled Job Manually (30 seconds)
```bash
# SSH into backend container or use Node REPL
node
```

```javascript
import { ScheduledDeletionJob } from './src/services/ScheduledDeletionJob.js';

// Run job manually
await ScheduledDeletionJob.getInstance().run();

// Check status
const status = ScheduledDeletionJob.getInstance().getStatus();
console.log(status);
// Output: { running: true, scheduled: true, isExecuting: false }
```

---

## 🧪 Test User Flow (10 minutes)

### Scenario: User Cancels Account → Gets Reminders → Data Deleted

#### Step 1: User Requests Cancellation
```bash
curl -X POST http://localhost:3001/account/cancel \
  -H "Cookie: dra_auth_token=USER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Found a better alternative",
    "reasonCategory": "found_alternative",
    "exportDataBeforeDeletion": true
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Account cancellation requested successfully",
  "data": {
    "cancellationId": 1,
    "effectiveAt": "2025-02-01T00:00:00.000Z",
    "deletionScheduledAt": "2025-03-03T00:00:00.000Z",
    "status": "pending"
  }
}
```

**Database Check:**
```sql
SELECT * FROM dra_account_cancellations WHERE id = 1;
```

#### Step 2: Check Cancellation Status
```bash
curl http://localhost:3001/account/cancellation/status \
  -H "Cookie: dra_auth_token=USER_JWT_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "status": "active",
    "requestedAt": "2025-01-25T...",
    "effectiveAt": "2025-02-01T...",
    "deletionScheduledAt": "2025-03-03T...",
    "dataExported": false,
    "notificationSent7Days": false,
    "notificationSent1Day": false
  }
}
```

#### Step 3: Export Data Before Deletion
```bash
# Export single data model as Excel
curl -X POST http://localhost:3001/account/data-model/export \
  -H "Cookie: dra_auth_token=USER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dataModelId": 123,
    "format": "excel",
    "includeMetadata": true
  }' \
  --output my_data_model.xlsx

# Export multiple models
curl -X POST http://localhost:3001/account/data-models/export-multiple \
  -H "Cookie: dra_auth_token=USER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dataModelIds": [123, 456, 789],
    "includeMetadata": true
  }' \
  --output all_my_models.xlsx
```

**Expected:** Excel file downloads with styled headers and data

#### Step 4: Simulate 7-Day Reminder (Manual Test)
```bash
# Update deletion_scheduled_at to 7 days from now
UPDATE dra_account_cancellations 
SET deletion_scheduled_at = NOW() + INTERVAL '7 days',
    status = 'active',
    effective_at = NOW()
WHERE id = 1;

# Run scheduled job manually
node
```

```javascript
import { ScheduledDeletionJob } from './src/services/ScheduledDeletionJob.js';
await ScheduledDeletionJob.getInstance().run();
```

**Expected:**
- User receives notification: "7 Days Until Account Deletion"
- `notification_sent_7_days` set to `true`
- Console log: "7-day notifications sent: 1"

#### Step 5: Simulate 1-Day Final Warning
```bash
# Update to 1 day from now
UPDATE dra_account_cancellations 
SET deletion_scheduled_at = NOW() + INTERVAL '1 day'
WHERE id = 1;

# Run job again
```

**Expected:**
- User receives notification: "FINAL WARNING: Account Deletion Tomorrow"
- `notification_sent_1_day` set to `true`
- Console log: "1-day notifications sent: 1"

#### Step 6: Simulate Deletion Day
```bash
# Update to past date
UPDATE dra_account_cancellations 
SET deletion_scheduled_at = NOW() - INTERVAL '1 day'
WHERE id = 1;

# Run job
```

**Expected:**
- All user projects, data sources, data models, dashboards deleted
- OAuth tokens revoked
- Uploaded files deleted
- User anonymized: `deleted_user_1@dataresearchanalysis.local`
- `status` = `data_deleted`
- `data_deleted_at` = current timestamp
- Console log: "Accounts deleted: 1"

**Verification Queries:**
```sql
-- Check user was anonymized
SELECT email, first_name, last_name FROM dra_users_platform WHERE id = USER_ID;
-- Expected: deleted_user_1@dataresearchanalysis.local, Deleted, User

-- Check projects deleted
SELECT COUNT(*) FROM dra_projects WHERE created_by_user_id = USER_ID;
-- Expected: 0

-- Check cancellation marked as deleted
SELECT status, data_deleted, data_deleted_at FROM dra_account_cancellations WHERE id = 1;
-- Expected: data_deleted, true, <timestamp>
```

#### Step 7: Test Reactivation (Before Deletion)
```bash
# Reset cancellation to active status
UPDATE dra_account_cancellations 
SET status = 'active',
    deletion_scheduled_at = NOW() + INTERVAL '20 days'
WHERE id = 1;

# User reactivates account
curl -X POST http://localhost:3001/account/reactivate \
  -H "Cookie: dra_auth_token=USER_JWT_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Account reactivated successfully",
  "data": {
    "cancellationId": 1,
    "status": "reactivated",
    "reactivatedAt": "2025-01-25T..."
  }
}
```

---

## 🔧 Admin Testing (5 minutes)

### Test Platform Settings Management

#### Get All Settings
```bash
curl http://localhost:3001/admin/platform-settings \
  -H "Cookie: dra_auth_token=ADMIN_JWT_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "retention": [
      {
        "key": "data_retention_days",
        "value": "30",
        "type": "number",
        "description": "Number of days to retain user data...",
        "isEditable": true,
        "updatedAt": "2025-01-25T..."
      },
      {
        "key": "auto_delete_enabled",
        "value": "true",
        "type": "boolean",
        ...
      }
    ],
    "notifications": [...],
    "security": [...]
  }
}
```

#### Update Retention Period
```bash
curl -X PUT http://localhost:3001/admin/platform-settings/data_retention_days \
  -H "Cookie: dra_auth_token=ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": "60"}'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Setting updated successfully",
  "data": {
    "key": "data_retention_days",
    "value": "60",
    "updatedAt": "2025-01-25T..."
  }
}
```

**Validation Test (Should Fail):**
```bash
# Try invalid value (outside 1-365 range)
curl -X PUT http://localhost:3001/admin/platform-settings/data_retention_days \
  -H "Cookie: dra_auth_token=ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": "500"}'
```

**Expected Error:**
```json
{
  "success": false,
  "message": "Data retention period must be between 1 and 365 days"
}
```

### Test Cancellation Management

#### Get All Cancellations
```bash
curl "http://localhost:3001/admin/account-cancellations?page=1&limit=20&status=active" \
  -H "Cookie: dra_auth_token=ADMIN_JWT_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "cancellations": [
      {
        "id": 1,
        "userId": 123,
        "userEmail": "user@example.com",
        "status": "active",
        "requestedAt": "2025-01-25T...",
        "effectiveAt": "2025-02-01T...",
        "deletionScheduledAt": "2025-03-03T...",
        "reasonCategory": "found_alternative",
        "reason": "Found a better alternative"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

#### Get Statistics
```bash
curl http://localhost:3001/admin/account-cancellations/statistics \
  -H "Cookie: dra_auth_token=ADMIN_JWT_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "totalCancellations": 5,
    "pendingCancellations": 2,
    "activeCancellations": 2,
    "deletedAccounts": 1,
    "reactivatedAccounts": 0,
    "byReasonCategory": {
      "found_alternative": 2,
      "too_expensive": 1,
      "missing_features": 1,
      "not_using": 1
    },
    "averageRetentionDays": 28.5
  }
}
```

#### Get Pending Deletions
```bash
curl http://localhost:3001/admin/account-cancellations/pending-deletion \
  -H "Cookie: dra_auth_token=ADMIN_JWT_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "userId": 123,
      "userEmail": "user@example.com",
      "deletionScheduledAt": "2025-01-20T...",
      "daysPastScheduled": 5
    }
  ]
}
```

#### Manual Deletion (Admin Override)
```bash
curl -X POST http://localhost:3001/admin/account-cancellations/1/delete-now \
  -H "Cookie: dra_auth_token=ADMIN_JWT_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Account deleted successfully"
}
```

**Requires Permission:** `Permission.ADMIN_DELETE_USERS`

#### Get Data Size Estimate
```bash
curl http://localhost:3001/admin/account-cancellations/1/estimate \
  -H "Cookie: dra_auth_token=ADMIN_JWT_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "cancellationId": 1,
    "userId": 123,
    "userEmail": "user@example.com",
    "estimate": {
      "projectCount": 5,
      "dataSourceCount": 12,
      "dataModelCount": 25,
      "dashboardCount": 8,
      "notificationCount": 143,
      "uploadedFileCount": 3,
      "exportFileCount": 15,
      "estimatedSizeMB": 245.7
    }
  }
}
```

---

## ⚙️ Scheduled Job Configuration

### Cron Schedule
**Default:** Daily at 2:00 AM server time

**Change Schedule:**
Edit `backend/src/services/ScheduledDeletionJob.ts`:

```typescript
// Current: Daily at 2:00 AM
this.cronTask = cron.schedule('0 2 * * *', async () => {

// Every hour:
this.cronTask = cron.schedule('0 * * * *', async () => {

// Every 15 minutes (testing):
this.cronTask = cron.schedule('*/15 * * * *', async () => {
```

### Disable Scheduled Job
Add to `.env`:
```bash
SCHEDULED_DELETION_ENABLED=false
```

Restart backend - job will not start.

### Manual Job Execution
```javascript
// Node REPL or test script
import { ScheduledDeletionJob } from './src/services/ScheduledDeletionJob.js';

// Run once
await ScheduledDeletionJob.getInstance().run();

// Check status
const status = ScheduledDeletionJob.getInstance().getStatus();
console.log(status);
// { running: true, scheduled: true, isExecuting: false }

// Stop scheduled job
ScheduledDeletionJob.getInstance().stop();
```

---

## 🐛 Troubleshooting

### Issue: Migration Fails
**Error:** `Table dra_platform_settings already exists`

**Solution:**
```bash
# Check migration status
npm run typeorm migration:show

# Revert last migration
npm run migration:revert

# Re-run migration
npm run migration:run
```

### Issue: Seeder Fails
**Error:** `Cannot read properties of undefined (reading 'getInstance')`

**Solution:** Ensure database connection is established before seeder runs.

```bash
# Verify database is running
docker ps | grep database

# Check backend logs for database connection
docker logs backend.dataresearchanalysis.test
```

### Issue: Scheduled Job Not Running
**Check 1:** Verify job started in logs
```bash
docker logs backend.dataresearchanalysis.test | grep "Scheduled deletion job"
```

**Check 2:** Manually trigger job
```javascript
import { ScheduledDeletionJob } from './src/services/ScheduledDeletionJob.js';
await ScheduledDeletionJob.getInstance().run();
```

**Check 3:** Verify cron library installed
```bash
npm list node-cron
```

### Issue: Routes Return 404
**Check 1:** Verify routes registered in `index.ts`
```bash
grep "'/account'" backend/src/index.ts
grep "'/admin/platform-settings'" backend/src/index.ts
```

**Check 2:** Restart backend server
```bash
docker-compose restart backend.dataresearchanalysis.test
```

### Issue: Export Fails
**Error:** `Cannot find module 'exceljs'`

**Solution:**
```bash
cd backend
npm install exceljs @json2csv/plainjs
npm run build
```

### Issue: Deletion Transaction Rollback
**Check Logs:** Look for specific error:
```bash
docker logs backend.dataresearchanalysis.test | grep "Error deleting user data"
```

**Common Causes:**
- Foreign key constraints not set up correctly
- Manual SQL modifications bypassing ORM
- File permission issues (uploads directory)

**Solution:** Check migration ran successfully, verify FK constraints exist.

---

## 📊 Database Queries for Monitoring

### Check Active Cancellations
```sql
SELECT 
  ac.id,
  u.email,
  ac.status,
  ac.deletion_scheduled_at,
  EXTRACT(DAY FROM ac.deletion_scheduled_at - NOW()) as days_until_deletion
FROM dra_account_cancellations ac
JOIN dra_users_platform u ON ac.users_platform_id = u.id
WHERE ac.status = 'active'
ORDER BY ac.deletion_scheduled_at ASC;
```

### Check Accounts Pending Deletion (Past Due)
```sql
SELECT 
  ac.id,
  u.email,
  ac.deletion_scheduled_at,
  EXTRACT(DAY FROM NOW() - ac.deletion_scheduled_at) as days_past_due
FROM dra_account_cancellations ac
JOIN dra_users_platform u ON ac.users_platform_id = u.id
WHERE ac.status = 'active'
  AND ac.deletion_scheduled_at <= NOW()
ORDER BY ac.deletion_scheduled_at ASC;
```

### Check Notification Status
```sql
SELECT 
  status,
  notification_sent_7_days,
  notification_sent_1_day,
  COUNT(*) as count
FROM dra_account_cancellations
WHERE status = 'active'
GROUP BY status, notification_sent_7_days, notification_sent_1_day;
```

### Platform Settings
```sql
SELECT 
  setting_key,
  setting_value,
  setting_type,
  category,
  is_editable
FROM dra_platform_settings
ORDER BY category, setting_key;
```

### Cancellation Statistics
```sql
SELECT 
  status,
  COUNT(*) as count,
  AVG(EXTRACT(DAY FROM deletion_scheduled_at - effective_at)) as avg_retention_days
FROM dra_account_cancellations
GROUP BY status;
```

---

## ✅ Success Checklist

- [ ] Migration ran successfully
- [ ] Seeder created default settings
- [ ] Scheduled job starts on server startup
- [ ] User can request cancellation
- [ ] User can export data (Excel/CSV/JSON)
- [ ] User can reactivate account
- [ ] Admin can view all cancellations
- [ ] Admin can update platform settings
- [ ] Admin can manually delete accounts
- [ ] 7-day notification sent correctly
- [ ] 1-day notification sent correctly
- [ ] Automatic deletion works after retention period
- [ ] Transaction rollback works on errors
- [ ] OAuth tokens revoked on deletion
- [ ] Files deleted from filesystem

---

## 🔗 Next Steps

1. **Build Frontend UIs** (see [account-cancellation-complete-summary.md](./account-cancellation-complete-summary.md) Section "Remaining Frontend Work")
2. **Write End-to-End Tests** - Playwright/Cypress for full user flow
3. **Load Testing** - Test scheduled job with 1000+ cancellations
4. **Monitoring** - Set up alerts for failed deletions
5. **Documentation** - Update user-facing docs with cancellation process

---

## 📚 Additional Resources

- [Complete Implementation Summary](./account-cancellation-complete-summary.md)
- [Original Implementation Plan](./account-cancellation-implementation-plan.md)
- [Architecture Documentation](./comprehensive-architecture-documentation.md)
- [SSR Guidelines](./ssr-quick-reference.md)
