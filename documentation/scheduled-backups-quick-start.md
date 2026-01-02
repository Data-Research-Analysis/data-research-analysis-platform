# Scheduled Backups - Quick Start Guide

## 🚀 Immediate Setup (5 minutes)

### 1. Configuration

Add to `backend/.env`:
```bash
BACKUP_SCHEDULE=0 0 * * *
BACKUP_ENABLED=true
BACKUP_RETENTION_DAYS=30
BACKUP_SYSTEM_USER_ID=1
```

### 2. Run Migration

```bash
cd backend
npm run migration:run
```

### 3. Start Services

```bash
# Backend
cd backend
npm run dev

# Frontend (separate terminal)
cd frontend
npm run dev
```

### 4. Access Admin Dashboard

1. Login as admin: http://localhost:3000/login
2. Navigate to: http://localhost:3000/admin/database
3. Click "Manage Schedule" (green card)

---

## 🧪 Quick Test

### Test Manual Backup (Immediate)

1. Go to scheduled backups page
2. Click "Trigger Backup Now" button
3. Watch backup run appear in history table
4. Wait ~30 seconds for completion
5. Verify status changes to "completed"

### Test Scheduled Backup (Wait 2 minutes)

```bash
# Edit backend/.env
BACKUP_SCHEDULE=*/2 * * * *  # Every 2 minutes

# Restart backend
npm run dev

# Wait 2 minutes, check logs:
# "📅 Scheduled backup triggered at..."
```

---

## 📊 Dashboard Overview

### Scheduler Status Card
- **Running/Stopped badge**: Current state
- **Schedule**: Cron expression (e.g., `0 0 * * *`)
- **Next Run**: Calculated next execution time
- **Last Run**: Last execution timestamp
- **Buttons**: Start, Stop, Trigger Now

### Statistics Dashboard
- **Total Runs**: All backup attempts
- **Successful**: Completed backups
- **Failed**: Failed backups with error details
- **Avg Duration**: Average backup completion time

### Backup Runs Table
- **Run ID**: Unique identifier
- **Type**: Scheduled or Manual
- **Status**: Queued → Processing → Completed/Failed
- **Started At**: Timestamp
- **Size**: Backup file size in MB

---

## 🎛️ Configuration Options

### Cron Schedule Examples

```bash
# Daily at midnight (default)
BACKUP_SCHEDULE=0 0 * * *

# Daily at 2 AM
BACKUP_SCHEDULE=0 2 * * *

# Every 6 hours
BACKUP_SCHEDULE=0 */6 * * *

# Weekly on Sunday
BACKUP_SCHEDULE=0 0 * * 0

# Every 15 minutes (testing)
BACKUP_SCHEDULE=*/15 * * * *
```

### Cron Format
```
* * * * *
│ │ │ │ │
│ │ │ │ └─ Day of Week (0-7, 0=Sunday)
│ │ │ └─── Month (1-12)
│ │ └───── Day of Month (1-31)
│ └─────── Hour (0-23)
└───────── Minute (0-59)
```

---

## 🔧 Common Operations

### Start Scheduler
```bash
# Via UI: Click "Start Scheduler" button

# Via API:
curl -X POST http://localhost:3002/admin/scheduled-backups/start \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Stop Scheduler
```bash
# Via UI: Click "Stop Scheduler" button

# Via API:
curl -X POST http://localhost:3002/admin/scheduled-backups/stop \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Change Schedule
```bash
# Via API:
curl -X PUT http://localhost:3002/admin/scheduled-backups/schedule \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"schedule": "0 3 * * *"}'
```

### Get Status
```bash
curl -X GET http://localhost:3002/admin/scheduled-backups/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🔍 Verification

### Check Backend Logs

Look for these messages on startup:
```
✅ OAuth session service initialized
✅ Scheduled backup service initialized
✅ Scheduled backup service started (schedule: 0 0 * * *)
   Next run: 2026-01-03T00:00:00.000Z
```

### Check Database

```sql
-- View recent backup runs
SELECT id, trigger_type, status, started_at, backup_id
FROM dra_scheduled_backup_runs
ORDER BY started_at DESC
LIMIT 10;

-- Count by status
SELECT status, COUNT(*) 
FROM dra_scheduled_backup_runs 
GROUP BY status;
```

### Check Backup Files

```bash
ls -lh backend/private/backups/
# Should see .zip files and metadata/ directory
```

---

## ⚠️ Troubleshooting

### Scheduler Not Starting
- Check `BACKUP_ENABLED=true` in .env
- Verify cron expression is valid
- Check backend logs for errors
- Ensure user ID exists

### Backups Not Running
- Verify scheduler is running (UI shows "Running")
- Check queue service is active
- Look for worker errors in logs
- Verify database permissions

### Frontend Not Loading
- Check logged in user is admin
- Verify API endpoints are accessible
- Check browser console for errors
- Ensure backend is running

---

## 📝 Quick Reference

### API Endpoints
```
GET    /admin/scheduled-backups/status
POST   /admin/scheduled-backups/start
POST   /admin/scheduled-backups/stop
PUT    /admin/scheduled-backups/schedule
POST   /admin/scheduled-backups/trigger-now
GET    /admin/scheduled-backups/runs
GET    /admin/scheduled-backups/stats
GET    /admin/scheduled-backups/config
PUT    /admin/scheduled-backups/config
```

### Socket.IO Events
```
scheduled-backup-started    - Backup initiated
scheduled-backup-completed  - Backup successful
scheduled-backup-failed     - Backup failed
```

### Environment Variables
```
BACKUP_SCHEDULE          - Cron expression
BACKUP_ENABLED           - true/false
BACKUP_RETENTION_DAYS    - Number of days
BACKUP_SYSTEM_USER_ID    - Admin user ID
BACKUP_MAX_SIZE_MB       - Max file size
BACKUP_AUTO_CLEANUP      - true/false
```

---

## ✅ Success Checklist

- [ ] Migration ran successfully
- [ ] Backend shows initialization message
- [ ] Frontend dashboard loads
- [ ] Can start/stop scheduler
- [ ] Manual backup works
- [ ] Backup runs appear in table
- [ ] Statistics display correctly
- [ ] Scheduled backup runs automatically

---

## 🎯 Next Steps

1. **Test in production**: Set schedule to appropriate time
2. **Monitor first week**: Check for failures
3. **Adjust retention**: Based on storage needs
4. **Set up alerts**: Email on failures (future)
5. **Test restore**: Verify backups are valid

---

**Quick Start Complete!** 🎉

For detailed information, see [scheduled-backups-implementation.md](./scheduled-backups-implementation.md)
