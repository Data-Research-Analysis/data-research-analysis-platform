# Account Cancellation & Data Deletion System - Implementation Plan

## Status: Foundation Complete ✅

This document provides the complete implementation plan for the account cancellation and automated data deletion system with admin-configurable retention periods.

---

## What's Been Completed ✅

### 1. **Policy Pages (Frontend)**
- ✅ [return-refund-policy.vue](../frontend/pages/return-refund-policy.vue)
  - Complete refund policy for subscription services
  - 7-day first-time subscriber consideration window
  - Billing error resolution process
  - SEO-optimized with meta tags
  
- ✅ [cancellation-policy.vue](../frontend/pages/cancellation-policy.vue)
  - Self-service and email cancellation methods
  - Data retention and deletion timeline
  - Reactivation process documentation
  - FREE tier downgrade alternative
  - SEO-optimized with meta tags

- ✅ [footer-nav.vue](../frontend/components/footer-nav.vue)
  - Added links to both policy pages

### 2. **Database Schema**
- ✅ [Migration: 1737849600000-CreateAccountCancellationSystem.ts](../backend/src/migrations/1737849600000-CreateAccountCancellationSystem.ts)
  
  **Tables Created:**
  - `dra_platform_settings` - Admin-configurable platform settings
    - setting_key (unique): retention period, notifications, features
    - setting_value, setting_type (string/number/boolean/json)
    - category, is_editable flags
    - Indexed on setting_key and category
  
  - `dra_account_cancellations` - Tracks cancellation lifecycle
    - users_platform_id (FK to dra_users_platform)
    - cancellation_reason, cancellation_reason_category
    - requested_at, effective_at, deletion_scheduled_at
    - status: pending, active, data_deleted, reactivated
    - data_exported flag, data_export_timestamp
    - data_deleted_at, deleted_by_admin_id
    - reactivated_at
    - Notification tracking: notification_7_days_sent, notification_1_day_sent, notification_deletion_sent
    - Admin notes field
    - Indexed on users_platform_id, status, deletion_scheduled_at

### 3. **TypeORM Models**
- ✅ [DRAPlatformSettings.ts](../backend/src/models/DRAPlatformSettings.ts)
  - Enums: ESettingType, ESettingCategory, EPlatformSettingKey
  - Pre-defined setting keys for consistency
  
- ✅ [DRAAccountCancellation.ts](../backend/src/models/DRAAccountCancellation.ts)
  - Enums: ECancellationStatus, ECancellationReasonCategory
  - Relations to DRAUsersPlatform (user and admin)

### 4. **Backend Processors**
- ✅ [PlatformSettingsProcessor.ts](../backend/src/processors/PlatformSettingsProcessor.ts)
  - Singleton pattern
  - Type-safe setting retrieval: `getSetting<T>(key)`
  - Category-based setting groups
  - `getDataRetentionDays()` - Returns configured retention period (default: 30 days)
  - `setDataRetentionDays(days)` - Validation (1-365 days)
  - `initializeDefaults()` - Creates default settings

- ✅ [AccountCancellationProcessor.ts](../backend/src/processors/AccountCancellationProcessor.ts)
  - `requestCancellation()` - Initiates cancellation with retention calculation
  - `reactivateAccount()` - Reactivates within retention period
  - `markDataExported()` - Tracks user data exports
  - `getCancellationsPendingDeletion()` - For scheduled deletion job
  - `getCancellationsRequiringNotification()` - 7-day and 1-day reminders
  - `markDataDeleted()` - Final deletion confirmation
  - `getCancellationStatistics()` - Admin dashboard analytics
  - `getAllCancellations()` - Admin panel with pagination
  - Integrates with NotificationHelperService for user alerts

---

## Remaining Implementation Tasks

### 5. **DataDeletionService** (High Priority)
**Purpose:** Orchestrates the complete data deletion process after retention period

**File:** `backend/src/services/DataDeletionService.ts`

**Key Methods:**
```typescript
class DataDeletionService {
  async deleteUserData(userId: number): Promise<void>
  async deleteAllExpiredAccounts(): Promise<number>
  private async deleteProjects(userId: number): Promise<void>
  private async deleteDataSources(userId: number): Promise<void>
  private async deleteDataModels(userId: number): Promise<void>
  private async deleteDashboards(userId: number): Promise<void>
  private async revokeOAuthTokens(userId: number): Promise<void>
  private async deleteUploadedFiles(userId: number): Promise<void>
  private async anonymizeUserRecord(userId: number): Promise<void>
}
```

**Deletion Strategy:**
1. Delete all projects (CASCADE deletes data sources, data models, dashboards via FK)
2. Revoke OAuth tokens (Google Analytics, Google Ads, Google Ad Manager)
3. Delete uploaded files from filesystem (PDFs, Excel, CSV)
4. Delete notifications
5. Anonymize user record (keep for billing history, mark as deleted)
6. Update cancellation record status

**Important:** Must respect database foreign key CASCADE relationships and handle transaction rollbacks.

### 6. **Backend API Routes** (High Priority)

**User Routes:** `backend/src/routes/account_cancellation.ts`
```typescript
// User-facing cancellation endpoints
POST   /api/account/cancel                  // Request cancellation
GET    /api/account/cancellation/status     // Check cancellation status
POST   /api/account/reactivate               // Reactivate account
POST   /api/account/export-data              // Export all account data
DELETE /api/account/cancel-cancellation     // Cancel the cancellation request (before effective)
```

**Admin Routes:** `backend/src/routes/admin/platform_settings.ts` + `account_cancellations.ts`
```typescript
// Platform settings management
GET    /api/admin/platform-settings                     // Get all settings
GET    /api/admin/platform-settings/:category          // Get by category
PUT    /api/admin/platform-settings/:key               // Update setting
POST   /api/admin/platform-settings/retention-period   // Set retention days
GET    /api/admin/platform-settings/retention-period   // Get retention days

// Cancelled accounts management
GET    /api/admin/account-cancellations                 // List all (paginated)
GET    /api/admin/account-cancellations/stats          // Statistics
GET    /api/admin/account-cancellations/:id            // Get specific cancellation
PUT    /api/admin/account-cancellations/:id/notes      // Add admin notes
POST   /api/admin/account-cancellations/:id/delete     // Manually trigger deletion
PUT    /api/admin/account-cancellations/:id/extend     // Extend retention period
```

**Middleware Required:**
- `validateJWT` - Authentication
- `authorize(Permission.ADMIN_PLATFORM_SETTINGS)` - Admin only
- Rate limiting for sensitive operations

### 7. **Frontend User Interface**

#### **User Account Cancellation Page**
**File:** `frontend/pages/account/cancel-account.vue`

**Features:**
- Multi-step cancellation wizard:
  1. **Confirmation:** "Are you sure you want to cancel?"
  2. **Alternative:** Suggest downgrade to FREE tier instead
  3. **Data Export:** Remind to export data, provide export buttons
  4. **Reason:** Optional feedback (dropdown + textarea)
  5. **Final Confirmation:** Explain retention period, deletion date
- Display calculated deletion date based on retention period
- Export data buttons (dashboards, data models, projects)
- Option to cancel the cancellation before effective date
- SSR-safe implementation

#### **Account Status Component**
**File:** `frontend/components/AccountCancellationStatus.vue`

**Features:**
- Show cancellation status banner if account is cancelled
- Display days remaining until deletion
- "Reactivate Account" button
- "Export Data" quick action
- Countdown timer

#### **Admin Platform Settings Page**
**File:** `frontend/pages/admin/platform-settings.vue`

**Features:**
- Category tabs: General, Retention, Notifications, Security, Features
- Editable settings with type-specific inputs:
  - Number input for retention days (1-365 validation)
  - Toggle switches for boolean settings
  - Textarea for JSON settings
- Real-time save with validation
- Setting descriptions and help text
- Audit trail (last updated timestamp)

#### **Admin Cancelled Accounts Dashboard**
**File:** `frontend/pages/admin/cancelled-accounts.vue`

**Features:**
- Statistics cards:
  - Total cancellations
  - Pending cancellations
  - Active (in retention period)
  - Completed deletions
  - Reactivations
- Filterable table:
  - User email, cancellation date, status
  - Effective date, deletion scheduled date
  - Reason category
  - Data exported status
- Actions:
  - View details modal
  - Add notes
  - Manually trigger deletion
  - Extend retention period
  - Send reminder notifications
- Export to CSV for analytics
- Pagination (50 per page)

### 8. **Scheduled Job / Cron Task** (Critical)

**File:** `backend/src/services/ScheduledDeletionJob.ts`

**Purpose:** Automated daily job to process cancellations

**Responsibilities:**
1. **Check for expired accounts** (deletion_scheduled_at <= now)
2. **Send 7-day notifications** to users approaching deletion
3. **Send 1-day notifications** for final warning
4. **Trigger deletion** for expired accounts
5. **Log all operations** for audit trail

**Implementation Options:**

**Option A: Node-cron (Recommended for MVP)**
```typescript
import cron from 'node-cron';

// Run daily at 2:00 AM
cron.schedule('0 2 * * *', async () => {
  await ScheduledDeletionJob.getInstance().run();
});
```

**Option B: PM2 Cron (Production)**
```javascript
// ecosystem.config.cjs
module.exports = {
  apps: [{
    name: 'deletion-job',
    script: './dist/jobs/scheduled-deletion.js',
    cron_restart: '0 2 * * *',
    autorestart: false
  }]
};
```

**Option C: Database-driven Queue (Most Robust)**
- Use existing QueueService from database backup feature
- Add job type: 'account_deletion'
- Process via background worker

**Job Logic:**
```typescript
class ScheduledDeletionJob {
  async run(): Promise<void> {
    // 1. Send 7-day notifications
    const sevenDayReminders = await AccountCancellationProcessor
      .getInstance()
      .getCancellationsRequiringNotification(7);
    for (const cancellation of sevenDayReminders) {
      await this.send7DayNotification(cancellation);
    }

    // 2. Send 1-day notifications
    const oneDayReminders = await AccountCancellationProcessor
      .getInstance()
      .getCancellationsRequiringNotification(1);
    for (const cancellation of oneDayReminders) {
      await this.send1DayNotification(cancellation);
    }

    // 3. Delete expired accounts
    const pendingDeletion = await AccountCancellationProcessor
      .getInstance()
      .getCancellationsPendingDeletion();
    for (const cancellation of pendingDeletion) {
      await DataDeletionService.getInstance().deleteUserData(cancellation.users_platform.id);
      await AccountCancellationProcessor.getInstance().markDataDeleted(cancellation.id);
    }
  }
}
```

### 9. **Database Seeder for Platform Settings**

**File:** `backend/src/seeders/07-20260125-PlatformSettingsSeeder.ts`

**Purpose:** Initialize default platform settings on first deployment

```typescript
export class PlatformSettingsSeeder extends Seeder {
  async run(dataSource: DataSource) {
    await PlatformSettingsProcessor.getInstance().initializeDefaults();
    console.log('✅ Platform settings initialized');
  }
}
```

**Default Settings:**
- `data_retention_days`: 30
- `auto_delete_enabled`: true
- `notification_7_days_enabled`: true
- `notification_1_day_enabled`: true
- `allow_account_reactivation`: true

### 10. **Notification System Updates**

**File:** `backend/src/types/ENotificationType.ts` (Update existing enum)

**New Notification Types:**
```typescript
export enum ENotificationType {
  // ... existing types
  
  // Account Cancellation (5 types)
  ACCOUNT_CANCELLATION_REQUESTED = 'account_cancellation_requested',
  ACCOUNT_CANCELLATION_REMINDER_7_DAYS = 'account_cancellation_reminder_7_days',
  ACCOUNT_CANCELLATION_REMINDER_1_DAY = 'account_cancellation_reminder_1_day',
  ACCOUNT_REACTIVATED = 'account_reactivated',
  ACCOUNT_DATA_DELETED = 'account_data_deleted',
}
```

**File:** `frontend/types/INotification.ts` (Update frontend enum to match)

---

## Database Migration Workflow

1. **Run migration:**
   ```bash
   cd backend
   npm run migration:run
   ```

2. **Run seeder:**
   ```bash
   npm run seed:run -- -d ./src/datasources/PostgresDSMigrations.ts src/seeders/07-20260125-PlatformSettingsSeeder.ts
   ```

3. **Verify tables created:**
   ```sql
   SELECT * FROM dra_platform_settings;
   SELECT * FROM dra_account_cancellations;
   ```

---

## Testing Strategy

### Unit Tests
- `PlatformSettingsProcessor.test.ts`
  - Test setting CRUD operations
  - Test type parsing (string, number, boolean, json)
  - Test retention day validation (1-365 range)

- `AccountCancellationProcessor.test.ts`
  - Test cancellation request creation
  - Test reactivation logic
  - Test notification tracking
  - Test statistics calculation

- `DataDeletionService.test.ts`
  - Test cascade deletion logic
  - Test transaction rollback on error
  - Test OAuth token revocation
  - Test file cleanup

### Integration Tests
- **Cancellation Flow:** Request → Retention → Notification → Deletion
- **Reactivation Flow:** Cancel → Reactivate → Verify data intact
- **Admin Actions:** Update retention period → Verify deletion dates recalculated
- **Scheduled Job:** Mock date → Trigger job → Verify deletions

### Manual Testing Checklist
- [ ] User can request cancellation with reason
- [ ] User sees cancellation status banner
- [ ] User can export data before deletion
- [ ] User can reactivate within retention period
- [ ] 7-day notification is sent
- [ ] 1-day notification is sent
- [ ] Data is deleted after retention period
- [ ] Deletion confirmation notification is sent
- [ ] Admin can view all cancellations
- [ ] Admin can change retention period
- [ ] Admin can manually trigger deletion
- [ ] Admin can add notes to cancellations
- [ ] Statistics are accurate

---

## Security Considerations

1. **Data Deletion Verification:**
   - Log all deletion operations with timestamps
   - Store deletion audit trail in separate table (not deleted with user)
   - Verify cascading deletes are complete

2. **OAuth Token Revocation:**
   - Ensure all OAuth refresh tokens are revoked
   - Clear OAuth session data from Redis
   - Verify no lingering API access

3. **File System Cleanup:**
   - Delete uploaded files from `backend/private/uploads/`
   - Remove dashboard exports from `backend/exports/`
   - Verify no orphaned files remain

4. **Admin Access Control:**
   - Platform settings require `ADMIN_PLATFORM_SETTINGS` permission
   - Manual deletion requires `ADMIN_DELETE_USER_DATA` permission
   - All admin actions are logged with admin user ID

5. **User Notification:**
   - Email notifications for all critical stages
   - In-app banner warnings before deletion
   - Export data instructions in every notification

---

## Performance Considerations

1. **Batch Processing:**
   - Process deletions in batches (10 users at a time)
   - Use database transactions for atomicity
   - Implement exponential backoff for failures

2. **Database Indexes:**
   - Already indexed: status, deletion_scheduled_at, users_platform_id
   - Monitor query performance for large datasets

3. **File Deletion:**
   - Use async file operations
   - Don't block on file deletion errors (log and continue)

4. **Notification Throttling:**
   - Batch email notifications (max 50 per batch)
   - Use email service queue to avoid rate limits

---

## Deployment Checklist

1. **Backend:**
   - [ ] Run database migration
   - [ ] Run platform settings seeder
   - [ ] Deploy new processors and services
   - [ ] Deploy API routes
   - [ ] Configure scheduled job (cron/PM2)
   - [ ] Update environment variables if needed

2. **Frontend:**
   - [ ] Deploy policy pages
   - [ ] Deploy account cancellation UI
   - [ ] Deploy admin settings UI
   - [ ] Deploy admin cancellations dashboard
   - [ ] Update footer navigation
   - [ ] Run SSR validation: `npm run validate:ssr`

3. **Testing:**
   - [ ] Test cancellation flow end-to-end
   - [ ] Test reactivation flow
   - [ ] Test admin settings changes
   - [ ] Verify scheduled job runs correctly
   - [ ] Monitor logs for errors

4. **Documentation:**
   - [ ] Update README with cancellation feature
   - [ ] Document admin settings for operators
   - [ ] Create runbook for manual deletion operations

---

## Future Enhancements (Post-MVP)

1. **Soft Delete vs Hard Delete:**
   - Option for "soft delete" (anonymize but keep data for analytics)
   - GDPR "right to be forgotten" compliance mode

2. **Granular Data Retention:**
   - Different retention periods for different data types
   - User-selectable retention period (7, 14, 30, 60, 90 days)

3. **Data Portability:**
   - Automated full account export on cancellation
   - Export in standardized format (CSV, JSON)
   - Include all data sources, models, visualizations

4. **Cancellation Analytics:**
   - Churn prediction based on reason categories
   - Win-back campaigns for cancelled users
   - A/B testing on retention offers

5. **Self-Service Deletion:**
   - "Delete immediately" option (bypass retention)
   - Two-factor authentication required for immediate deletion

---

## Contact & Support

For questions about this implementation:
- Email: hello@dataresearchanalysis.com
- Company: Data Research Analysis (SMC-Private) Limited
