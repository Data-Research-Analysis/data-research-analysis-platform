# Quick Implementation Guide: Adding Notifications

This guide shows you how to add notifications to any processor or service in the Data Research Analysis platform.

## Step-by-Step Process

### 1. Import the NotificationHelperService

At the top of your processor/service file, add the import:

```typescript
import { NotificationHelperService } from '../services/NotificationHelperService.js';
```

### 2. Add the Helper Instance to Your Class

```typescript
export class YourProcessor {
    private static instance: YourProcessor;
    private notificationHelper = NotificationHelperService.getInstance();
    
    private constructor() {}
    // ... rest of class
}
```

### 3. Call the Appropriate Notification Method

Find the location in your code where the event occurs and add the notification call:

```typescript
// Example: After successfully creating something
await this.notificationHelper.notifyDataSourceCreated(
    userId,
    dataSourceId,
    dataSourceName,
    dataSourceType
);

// Example: After an operation fails
await this.notificationHelper.notifyDataSourceSyncFailed(
    userId,
    dataSourceId,
    dataSourceName,
    error.message
);
```

## Common Patterns

### Pattern 1: Success/Failure Notifications

```typescript
try {
    // Perform operation
    const result = await someOperation();
    
    if (result.success) {
        // Send success notification
        await this.notificationHelper.notifySyncComplete(
            userId,
            resourceId,
            resourceName,
            recordCount
        );
    } else {
        // Send failure notification
        await this.notificationHelper.notifySyncFailed(
            userId,
            resourceId,
            resourceName,
            'Operation failed'
        );
    }
} catch (error) {
    // Send error notification
    await this.notificationHelper.notifySyncFailed(
        userId,
        resourceId,
        resourceName,
        error.message
    );
}
```

### Pattern 2: Before Deletion (Store Data First)

```typescript
// Store necessary data before deletion
const resourceName = resource.name;
const memberIds = members.map(m => m.id);

// Perform deletion
await manager.remove(resource);

// Send notifications (data no longer in DB)
for (const memberId of memberIds) {
    await this.notificationHelper.notifyResourceDeleted(memberId, resourceName);
}
```

### Pattern 3: After Transaction Completes

```typescript
let savedResourceId: number;

await manager.transaction(async (transactionManager) => {
    const resource = new Resource();
    resource.name = name;
    const saved = await transactionManager.save(resource);
    savedResourceId = saved.id;
});

// Transaction committed, now send notification
await this.notificationHelper.notifyResourceCreated(userId, savedResourceId!, name);
```

## Available Notification Methods

### Data Source Operations
- `notifyDataSourceCreated(userId, dataSourceId, name, type)`
- `notifyDataSourceDeleted(userId, name)`
- `notifyDataSourceConnectionFailed(userId, dataSourceId, name, error)`
- `notifyDataSourceSyncComplete(userId, dataSourceId, name, recordCount, duration?)`
- `notifyDataSourceSyncFailed(userId, dataSourceId, name, error)`
- `notifyScheduledSyncComplete(userId, dataSourceId, name, recordCount)`
- `notifyScheduledSyncFailed(userId, dataSourceId, name, error)`
- `notifyLargeDatasetSync(userId, dataSourceId, name, recordCount)`
- `notifySyncScheduleChanged(userId, dataSourceId, name, schedule)`
- `notifyOAuthTokenExpiring(userId, dataSourceId, name, expiresIn)`
- `notifyOAuthTokenExpired(userId, dataSourceId, name)`

### Project Management
- `notifyProjectCreated(userId, projectId, projectName)`
- `notifyProjectUpdated(userId, projectId, projectName)`
- `notifyProjectDeleted(userId, projectName)`
- `notifyProjectShared(userId, projectId, projectName, sharedByName)`
- `notifyProjectMemberAdded(userId, projectId, projectName, memberName, role)`
- `notifyProjectMemberRemoved(userId, projectId, projectName, memberName)`
- `notifyProjectRoleChanged(userId, projectId, projectName, newRole)`
- `notifyInvitationAccepted(userId, projectId, projectName, acceptedByName)`
- `notifyInvitationDeclined(userId, projectId, projectName, declinedByEmail)`
- `notifyInvitationExpired(userId, projectName, invitedEmail)`

### Data Models
- `notifyDataModelCreated(userId, dataModelId, dataModelName, dataSourceName)`
- `notifyDataModelDeleted(userId, dataModelName)`
- `notifyDataModelQueryFailed(userId, dataModelId, dataModelName, error)`

### AI Data Modeler
- `notifyAIModelReady(userId, dataSourceId, conversationId, modelCount)`
- `notifyAIProcessingError(userId, dataSourceId, error)`

### Dashboards
- `notifyDashboardCreated(userId, dashboardId, dashboardName)`
- `notifyDashboardShared(userId, dashboardId, dashboardName, sharedByName)`
- `notifyDashboardExportComplete(userId, dashboardId, dashboardName, downloadUrl)`
- `notifyDashboardExportFailed(userId, dashboardId, dashboardName, error)`

### User Account
- `notifyAccountCreated(userId, userName)`
- `notifyEmailVerified(userId)`
- `notifyPasswordChanged(userId)`
- `notifySecurityAlert(userId, alertType, details)`

### Subscriptions
- `notifySubscriptionAssigned(userId, tierName, expiresAt)`
- `notifySubscriptionUpgraded(userId, oldTier, newTier)`
- `notifySubscriptionExpiring(userId, tierName, daysRemaining)`
- `notifySubscriptionExpired(userId, tierName)`
- `notifyTierLimitReached(userId, limitType, currentCount, maxAllowed)`

### Admin Operations
- `notifyBackupCompleted(userId, backupId, size)`
- `notifyBackupFailed(userId, error)`
- `notifyRestoreCompleted(userId, backupId)`
- `notifyRestoreFailed(userId, backupId, error)`

### System Notifications
- `notifySystemUpdate(userIds[], version, features[])`
- `notifyMaintenanceScheduled(userIds[], startTime, duration)`

## Best Practices

### 1. Always Wrap in Try-Catch
Never let notification failures break your core operation:

```typescript
try {
    await this.notificationHelper.notifyEvent(...);
} catch (error) {
    console.error('Failed to send notification:', error);
    // Continue execution - notification failure shouldn't stop operation
}
```

### 2. Use Meaningful Metadata
Include relevant information in notifications:

```typescript
await this.notificationHelper.notifyDataSourceSyncComplete(
    userId,
    dataSourceId,
    dataSourceName,
    recordCount,  // Include metrics
    duration      // Include timing
);
```

### 3. Consider User Experience
- Success notifications: Low priority, can be less verbose
- Failure notifications: High priority, include error details
- Warning notifications: Medium priority, actionable information

### 4. Notify Appropriate Users
```typescript
// Notify owner
await this.notificationHelper.notifyResourceCreated(ownerId, ...);

// Notify all project members
for (const member of projectMembers) {
    await this.notificationHelper.notifyProjectUpdated(member.userId, ...);
}
```

## Testing Your Notifications

### 1. Check Notification Was Created
```typescript
// In your test
const notifications = await notificationRepository.find({ where: { user: { id: userId } } });
expect(notifications).toHaveLength(1);
expect(notifications[0].type).toBe(NotificationType.DATA_SOURCE_CREATED);
```

### 2. Check Socket.IO Emission
```typescript
// Mock Socket.IO and verify emission
expect(mockSocketIO.emitToUser).toHaveBeenCalledWith(
    userId,
    ISocketEvent.NOTIFICATION_NEW,
    expect.objectContaining({ notification: expect.any(Object) })
);
```

### 3. Test Frontend Display
```typescript
// Load notifications page and verify display
await page.goto('/notifications');
await expect(page.locator('.notification-item')).toContainText('Data source created');
```

## Troubleshooting

### Notification Not Appearing
1. Check database: `SELECT * FROM dra_notifications WHERE users_platform_id = X ORDER BY created_at DESC;`
2. Check Socket.IO connection in browser console
3. Check notification store state in Vue DevTools
4. Verify user ID matches logged-in user

### Error: "Cannot read property 'createNotification'"
- Ensure NotificationProcessor is initialized in backend startup
- Check that NotificationHelperService import path is correct

### Error: "Invalid notification type"
- Verify enum value exists in `NotificationTypes.ts`
- Run the database migration to add new enum values
- Restart backend after migration

## Quick Reference: When to Notify

| Event | When to Notify | Priority |
|-------|---------------|----------|
| Resource Created | After save succeeds | Low |
| Resource Deleted | After delete completes | Medium |
| Operation Failed | Immediately on error | High |
| Scheduled Task Complete | After cron job finishes | Medium |
| Security Event | Immediately | Critical |
| Subscription Expiring | 7 days before | High |
| Limit Reached | When hit | High |
| Share/Invite | After permission granted | Medium |

---

For more details, see [notifications-implementation-summary.md](./notifications-implementation-summary.md)
