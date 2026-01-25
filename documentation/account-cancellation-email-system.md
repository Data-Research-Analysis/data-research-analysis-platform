# Email Notification System - Quick Reference

## Overview
All account cancellation flows now send **both** in-app notifications AND emails to the user.

## Email Templates

### 1. Account Cancellation Requested
**Template:** `account-cancellation-requested.html`  
**Sent When:** User initiates account cancellation  
**Contains:**
- Effective date and deletion date
- Retention period (e.g., 30 days)
- Timeline of what happens next
- Export Data CTA button
- Reactivate Account CTA button

**Triggered By:**
```typescript
AccountCancellationProcessor.requestCancellation()
```

---

### 2. 7-Day Deletion Reminder
**Template:** `account-cancellation-reminder-7days.html`  
**Sent When:** 7 days before scheduled deletion  
**Contains:**
- Warning banner with deletion date
- List of what will be deleted
- Reactivate Account CTA (prominent)
- Export Data CTA
- Irreversibility warning

**Triggered By:**
```typescript
ScheduledDeletionJob.send7DayNotifications()
```

---

### 3. 1-Day Final Warning
**Template:** `account-cancellation-reminder-1day.html`  
**Sent When:** 1 day before scheduled deletion  
**Contains:**
- URGENT red-themed design
- Countdown to deletion
- User's data counts (projects, data sources, models, dashboards)
- Large "REACTIVATE NOW" button
- Last chance messaging

**Triggered By:**
```typescript
ScheduledDeletionJob.send1DayNotifications()
```

---

### 4. Account Reactivated
**Template:** `account-reactivated.html`  
**Sent When:** User successfully reactivates cancelled account  
**Contains:**
- Welcome back message
- Confirmation all data preserved
- List of restored items
- Go to Dashboard CTA
- Feedback request

**Triggered By:**
```typescript
AccountCancellationProcessor.reactivateAccount()
```

---

### 5. Account Data Deleted
**Template:** `account-data-deleted.html`  
**Sent When:** After all user data permanently deleted  
**Contains:**
- Deletion confirmation with timestamp
- List of what was deleted
- Option to create new account (FREE tier)
- Create New Account CTA
- Final goodbye message

**Triggered By:**
```typescript
DataDeletionService.deleteUserData()
```

---

## Email Service Methods

### Send Cancellation Request Email
```typescript
import { EmailService } from './services/EmailService.js';

const emailService = EmailService.getInstance();

await emailService.sendAccountCancellationRequested(
    'user@example.com',
    'John Doe',
    new Date('2026-02-01'), // Effective date
    new Date('2026-03-03'), // Deletion date
    30 // Retention days
);
```

### Send 7-Day Reminder
```typescript
await emailService.sendAccountCancellationReminder7Days(
    'user@example.com',
    'John Doe',
    new Date('2026-03-03') // Deletion date
);
```

### Send 1-Day Final Warning
```typescript
await emailService.sendAccountCancellationReminder1Day(
    'user@example.com',
    'John Doe',
    new Date('2026-03-03'),
    {
        projectCount: 5,
        dataSourceCount: 12,
        dataModelCount: 25,
        dashboardCount: 8
    }
);
```

### Send Reactivation Confirmation
```typescript
await emailService.sendAccountReactivated(
    'user@example.com',
    'John Doe'
);
```

### Send Deletion Confirmation
```typescript
await emailService.sendAccountDataDeleted(
    'user@example.com',
    'John Doe',
    new Date() // Deletion completed timestamp
);
```

---

## Email Flow Timeline

```
DAY 0: User requests cancellation
       ├─ In-app notification sent
       └─ Email: account-cancellation-requested.html

DAY 23: 7-day reminder (if retention = 30 days)
        ├─ In-app notification sent
        └─ Email: account-cancellation-reminder-7days.html

DAY 29: 1-day final warning
        ├─ In-app notification sent
        └─ Email: account-cancellation-reminder-1day.html

DAY 30: Deletion executed
        ├─ In-app notification sent
        └─ Email: account-data-deleted.html

OR: User reactivates (anytime before deletion)
    ├─ In-app notification sent
    └─ Email: account-reactivated.html
```

---

## Testing Emails

### Test Single Email
```bash
# SSH into backend container
docker exec -it backend.dataresearchanalysis.test bash

# Node REPL
node
```

```javascript
import { EmailService } from './src/services/EmailService.js';
const emailService = EmailService.getInstance();

// Test cancellation request email
await emailService.sendAccountCancellationRequested(
    'your-email@example.com',
    'Test User',
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    new Date(Date.now() + 37 * 24 * 60 * 60 * 1000), // 37 days from now
    30
);
```

### Test via API
```bash
# Request cancellation (triggers email)
curl -X POST http://localhost:3001/account/cancel \
  -H "Cookie: dra_auth_token=YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Testing email","reasonCategory":"not_using"}'

# Check your email inbox
```

### Test Scheduled Job Manually
```javascript
// This will send reminder emails to any accounts meeting criteria
import { ScheduledDeletionJob } from './src/services/ScheduledDeletionJob.js';
await ScheduledDeletionJob.getInstance().run();
```

---

## Email Configuration

### SMTP Settings
Emails use the existing `EmailService` which connects to your SMTP server via `MailDriver`.

**Environment Variables** (in `.env`):
```bash
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_USER=your-email@example.com
MAIL_PASSWORD=your-password
MAIL_FROM=noreply@dataresearchanalysis.com
```

### Email Queue
Emails are sent via **BullMQ queue** with:
- **Retry**: 3 attempts with exponential backoff
- **Rate limit**: 10 emails/second
- **Storage**: Redis-backed queue

### Error Handling
All email sending is **non-blocking**:
- If email fails, the process continues
- Errors are logged but don't throw
- In-app notifications are always sent regardless of email status

---

## Email Features

### HTML Templates
- **Responsive design** - Mobile and desktop friendly
- **Gradient headers** - Professional branded look
- **Action buttons** - Clear CTAs (Reactivate, Export Data)
- **Warning levels** - Color-coded urgency (yellow → orange → red)
- **Data visualization** - Timeline boxes, stat cards

### Plain Text Fallback
Every email includes a **plain text version** for email clients that don't support HTML.

### Template Variables
All templates use `{{variable}}` syntax:
- `{{user_name}}` - User's full name
- `{{effective_date}}` - Formatted cancellation effective date
- `{{deletion_date}}` - Formatted deletion scheduled date
- `{{retention_days}}` - Number of retention days
- `{{dashboard_url}}` - Link to user dashboard
- `{{reactivate_url}}` - Link to reactivation page
- `{{project_count}}` - Number of projects (1-day email)
- `{{data_source_count}}` - Number of data sources (1-day email)
- `{{data_model_count}}` - Number of data models (1-day email)
- `{{dashboard_count}}` - Number of dashboards (1-day email)

---

## Troubleshooting

### Email Not Sent
**Check:**
1. SMTP credentials in `.env`
2. Email service logs: `docker logs backend.dataresearchanalysis.test | grep Email`
3. Redis connection (email queue uses Redis)
4. BullMQ worker status

### Template Not Found
**Error:** `Template not found: account-cancellation-requested.html`

**Solution:**
```bash
# Verify templates exist
ls -la backend/src/templates/account-*.html

# Should show:
# account-cancellation-requested.html
# account-cancellation-reminder-7days.html
# account-cancellation-reminder-1day.html
# account-reactivated.html
# account-data-deleted.html
```

### Wrong Variables in Email
**Check template rendering:**
```javascript
import { TemplateEngineService } from './src/services/TemplateEngineService.js';
const rendered = await TemplateEngineService.getInstance().render(
    'account-cancellation-requested.html',
    [
        { key: 'user_name', value: 'Test User' },
        { key: 'effective_date', value: 'February 1, 2026' },
        // ... other variables
    ]
);
console.log(rendered);
```

---

## Customization

### Modify Email Template
1. Edit template in `backend/src/templates/`
2. Update variables as needed ({{new_variable}})
3. Update EmailService method to pass new variable
4. Restart backend: `docker-compose restart backend.dataresearchanalysis.test`

### Change Email Styling
All styles are **inline CSS** for email client compatibility.

**Example - Change header color:**
```html
<!-- In template file -->
<td style="background: linear-gradient(135deg, #YOUR_COLOR_1 0%, #YOUR_COLOR_2 100%); ...">
```

### Add New Email
1. Create new template in `backend/src/templates/`
2. Add new method to `EmailService.ts`:
```typescript
public async sendYourNewEmail(
    email: string,
    userName: string,
    ...otherParams
): Promise<SendMailResult> {
    const html = await TemplateEngineService.getInstance().render('your-template.html', [
        { key: 'user_name', value: userName },
        // ... more variables
    ]);

    const text = `Plain text version...`;

    return this.mailDriver.sendMail({
        to: email,
        subject: 'Your Subject',
        text,
        html
    });
}
```

3. Call from processor/service at appropriate time

---

## Production Checklist

- [ ] SMTP credentials configured in production `.env`
- [ ] Email templates tested with real SMTP server
- [ ] Plain text versions render correctly
- [ ] All links use production `FRONTEND_URL`
- [ ] Unsubscribe link added (if required by email provider)
- [ ] Rate limiting configured appropriately
- [ ] Redis connection stable for email queue
- [ ] BullMQ worker auto-starts with backend
- [ ] Email sending errors logged to monitoring system
- [ ] Test with various email clients (Gmail, Outlook, Apple Mail)

---

## Email Statistics

Track email performance via:
```sql
-- In future, add email tracking table
SELECT 
    type,
    COUNT(*) as sent,
    COUNT(CASE WHEN opened THEN 1 END) as opened,
    COUNT(CASE WHEN clicked THEN 1 END) as clicked
FROM email_tracking
WHERE DATE(sent_at) >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY type;
```

---

## Related Documentation
- [EmailService.ts](../backend/src/services/EmailService.ts)
- [TemplateEngineService.ts](../backend/src/services/TemplateEngineService.ts)
- [Account Cancellation Complete Summary](./account-cancellation-complete-summary.md)
- [Account Cancellation Quick Start](./account-cancellation-quick-start.md)
