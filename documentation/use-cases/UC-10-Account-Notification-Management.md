# UC-10 — Account & Notification Management

**Domain:** Account & Notification Management  
**Version:** 1.0  
**Date:** 2026-02-24  
**Standard:** UML 2.5 / IEEE 830 / Cockburn Fully-Dressed Format

---

## Actor Catalogue

| Actor | Type | Description |
|---|---|---|
| **Registered User** | Primary Human | Any authenticated user managing their own account |
| **Email Service** | Secondary System | Transactional email delivery |
| **NotificationProcessor** | Secondary System | Singleton processor for notification CRUD |
| **AccountCancellationProcessor** | Secondary System | Handles cancellation request lifecycle |
| **UserProcessor / UserSubscriptionProcessor** | Secondary System | Profile updates and subscription management |
| **EmailPreferencesProcessor** | Secondary System | Email preference management |
| **Rate Limiter** | Secondary System | General API limiter on account routes |

---

## Domain Use Case Diagram

```
+-----------------------------------------------------------+
|            <<system boundary>>                            |
|           Account & Notification Management               |
|                                                           |
|  UC-ACC-01  Update Profile / Account Settings            |
|  UC-ACC-02  Change Password                              |
|  UC-ACC-03  Manage Email Notification Preferences        |
|  UC-ACC-04  View Notifications (paginated)               |
|  UC-ACC-05  Get Unread Notification Count                |
|  UC-ACC-06  Mark Notification as Read                    |
|  UC-ACC-07  Mark All Notifications as Read               |
|  UC-ACC-08  Delete Notification                          |
|  UC-ACC-09  View Subscription Plan & Usage               |
|  UC-ACC-10  Request Account Cancellation                 |
|  UC-ACC-11  Unsubscribe via Email Link                   |
+-----------------------------------------------------------+

Registered User ---------> UC-ACC-01 through UC-ACC-11
Email Service <------------ UC-ACC-10, UC-ACC-11
NotificationProcessor <---- UC-ACC-04 through UC-ACC-08
AccountCancellationProcessor <- UC-ACC-10

<<include>>:
  UC-ACC-01 <<include>> Validate JWT
  UC-ACC-02 <<include>> Validate Password Strength
  UC-ACC-06 <<include>> Validate Notification Ownership
  UC-ACC-08 <<include>> Validate Notification Ownership

<<extend>>:
  UC-ACC-10 <<extend>> Cancel Active Subscription
```

---

## UC-ACC-01 — Update Profile / Account Settings

| Field | Value |
|---|---|
| **Use Case ID** | UC-ACC-01 |
| **Use Case Name** | Update Profile / Account Settings |
| **Primary Actor** | Registered User |
| **Priority** | Medium |
| **Trigger** | User edits profile in Settings; `PATCH /account/profile` |
| **Preconditions** | User is authenticated. |
| **Postconditions (Success)** | User's `first_name`, `last_name`, or other profile fields updated in `dra_users`. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Navigates to Settings; edits `first_name`, `last_name`. |
| 2 | Client | `PATCH /account/profile` with `{ first_name, last_name }`. |
| 3 | System | Validates JWT; validates fields (non-empty, sanitised). |
| 4 | System | `UserProcessor.updateProfile()` — persists changes. |
| 5 | System | HTTP 200: *"Profile updated successfully."* |
| 6 | Client | Updates Pinia `logged_in_user` store; syncs localStorage. |

### Alternative Flows

**ALT-ACC01A — Invalid Field Length**
- HTTP 422 with field errors.

---

## UC-ACC-02 — Change Password

| Field | Value |
|---|---|
| **Use Case ID** | UC-ACC-02 |
| **Use Case Name** | Change Password |
| **Primary Actor** | Registered User |
| **Priority** | High |
| **Trigger** | User submits password change form in Account Settings |
| **Preconditions** | 1. User authenticated. 2. Current password correct. |
| **Postconditions (Success)** | Password hash updated; no tokens invalidated (user remains logged in). |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Enters `current_password`, `new_password`, `confirm_new_password`. |
| 2 | Client | Submits via `PATCH /account/change-password`. |
| 3 | System | Validates JWT. |
| 4 | System | Validates `new_password` against strength rules. |
| 5 | System | Verifies `current_password` against stored bcrypt hash. |
| 6 | System | Hashes new password; updates `dra_users`. |
| 7 | System | HTTP 200: *"Password changed successfully."* |

### Alternative Flows

**ALT-ACC02A — Current Password Incorrect**
- At step 5: HTTP 400: *"Current password is incorrect."*

**ALT-ACC02B — New Password Same as Current**
- HTTP 400: *"New password must differ from current password."*

**ALT-ACC02C — Weak New Password**
- At step 4: HTTP 422 with policy message.

**ALT-ACC02D — New Password / Confirm Mismatch**
- Client-side validation; HTTP 422 if bypassed.

### Business Rules
- BR-ACC-01: Passwords must be at least 8 characters and meet strength requirements.
- BR-ACC-02: Current password must always be verified before allowing a change.

---

## UC-ACC-03 — Manage Email Notification Preferences

| Field | Value |
|---|---|
| **Use Case ID** | UC-ACC-03 |
| **Use Case Name** | Manage Email Notification Preferences |
| **Primary Actor** | Registered User |
| **Trigger** | User toggles preferences in `/settings/notifications`; `PATCH /email-preferences` |
| **Postconditions (Success)** | User's email preference flags updated; no further emails sent for disabled categories. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Opens notification preferences; toggles categories (marketing, product updates, security alerts). |
| 2 | Client | `PATCH /email-preferences` with `{ marketing_emails: false, ... }`. |
| 3 | System | Validates JWT; validates preference flags (boolean). |
| 4 | System | `EmailPreferencesProcessor.updatePreferences()` — persists changes. |
| 5 | System | HTTP 200 confirmation. |

### Alternative Flows

**ALT-ACC03A — Unsubscribe All**
- All flags set to `false`; equivalent to UC-ACC-11.

---

## UC-ACC-04 — View Notifications (Paginated)

| Field | Value |
|---|---|
| **Use Case ID** | UC-ACC-04 |
| **Use Case Name** | View Notifications (Paginated) |
| **Primary Actor** | Registered User |
| **Priority** | Medium |
| **Trigger** | User opens notification panel; `GET /notifications` |
| **Preconditions** | User authenticated. |
| **Postconditions (Success)** | Paginated notification list returned with read/unread status. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Clicks notification bell; panel opens. |
| 2 | Client | `GET /notifications?page=1&limit=20`. |
| 3 | System | Validates JWT; extracts `user_id`. |
| 4 | System | Validates pagination params: `page ≥ 1`, `1 ≤ limit ≤ 100`. |
| 5 | System | `NotificationProcessor.getUserNotifications()` — queries `dra_notifications` by `user_id` ordered by `created_at DESC`. |
| 6 | System | Returns `{ notifications, pagination: { page, limit, total, totalPages } }`. |

### Alternative Flows

**ALT-ACC04A — Invalid Page Parameter**
- At step 4: HTTP 400: *"Page must be >= 1."*

**ALT-ACC04B — Limit Exceeds Max (100)**
- `limit` clamped to 100 silently.

**ALT-ACC04C — No Notifications**
- Returns empty array with `total: 0`.

### Business Rules
- BR-ACC-03: Notification list is scoped strictly to the authenticated user; no cross-user access.
- BR-ACC-04: Maximum page size is 100.

---

## UC-ACC-05 — Get Unread Notification Count

| Field | Value |
|---|---|
| **Use Case ID** | UC-ACC-05 |
| **Use Case Name** | Get Unread Notification Count |
| **Primary Actor** | Registered User |
| **Trigger** | `GET /notifications/unread-count` on page load / polling |
| **Postconditions (Success)** | Integer count of unread notifications returned. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Client | Polls `GET /notifications/unread-count`. |
| 2 | System | Validates JWT; `user_id` extracted. |
| 3 | System | `NotificationProcessor.getUnreadCount()` — `COUNT WHERE user_id = ? AND read = false`. |
| 4 | System | Returns `{ success: true, unreadCount: N }`. |
| 5 | Client | Updates notification badge in header nav. |

---

## UC-ACC-06 — Mark Notification as Read

| Field | Value |
|---|---|
| **Use Case ID** | UC-ACC-06 |
| **Use Case Name** | Mark Notification as Read |
| **Primary Actor** | Registered User |
| **Trigger** | User clicks a notification; `PATCH /notifications/:id/read` |
| **Preconditions** | Notification exists and belongs to the user. |
| **Postconditions (Success)** | Notification `read = true`; unread count decremented. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Clicks a notification item. |
| 2 | Client | `PATCH /notifications/:id/read`. |
| 3 | System | Validates JWT; validates notification belongs to user (`NotificationNotFoundError` / `UnauthorizedNotificationAccessError`). |
| 4 | System | `NotificationProcessor.markAsRead()` — sets `read = true`. |
| 5 | System | HTTP 200. |
| 6 | Client | Updates badge count; marks item visually as read. |

### Alternative Flows

**ALT-ACC06A — Notification Not Found**
- HTTP 404 (`NotificationNotFoundError`).

**ALT-ACC06B — Notification Belongs to Different User**
- HTTP 403 (`UnauthorizedNotificationAccessError`).

---

## UC-ACC-07 — Mark All Notifications as Read

| Field | Value |
|---|---|
| **Use Case ID** | UC-ACC-07 |
| **Use Case Name** | Mark All Notifications as Read |
| **Primary Actor** | Registered User |
| **Trigger** | `PATCH /notifications/read-all` |
| **Postconditions (Success)** | All user notifications set to `read = true`; unread count becomes 0. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Clicks "Mark all as read". |
| 2 | Client | `PATCH /notifications/read-all`. |
| 3 | System | Validates JWT; `NotificationProcessor.markAllAsRead(userId)`. |
| 4 | System | Bulk UPDATE on `dra_notifications WHERE user_id = ? AND read = false`. |
| 5 | System | HTTP 200. |

---

## UC-ACC-08 — Delete Notification

| Field | Value |
|---|---|
| **Use Case ID** | UC-ACC-08 |
| **Use Case Name** | Delete Notification |
| **Primary Actor** | Registered User |
| **Trigger** | `DELETE /notifications/:id` |
| **Preconditions** | Notification exists and belongs to user. |
| **Postconditions (Success)** | Notification record permanently deleted. |

### Alternative Flows

**ALT-ACC08A — Notification Not Found**
- HTTP 404.

**ALT-ACC08B — Unauthorised**
- HTTP 403.

---

## UC-ACC-09 — View Subscription Plan & Usage

| Field | Value |
|---|---|
| **Use Case ID** | UC-ACC-09 |
| **Use Case Name** | View Subscription Plan & Usage |
| **Primary Actor** | Registered User |
| **Trigger** | User navigates to account/billing page; `GET /subscription/current` and `GET /subscription/usage` |
| **Postconditions (Success)** | Current subscription tier, usage metrics (projects, data sources, dashboards, row counts, AI generations) returned. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Opens account/subscription page. |
| 2 | Client | Parallel: `GET /subscription/current` and `GET /subscription/usage`. |
| 3 | System | `RowLimitService.getUsageStats(userId)` — project count, data source count, row counts. |
| 4 | System | `TierEnforcementService.getUsageStats(userId)` — tier limit flags (near/over limit). |
| 5 | System | Returns both datasets. |
| 6 | Client | Renders usage bars, tier name, upgrade CTA if near limits. |

### Alternative Flows

**ALT-ACC09A — No Subscription Record**
- Defaults to free tier display.

---

## UC-ACC-10 — Request Account Cancellation

| Field | Value |
|---|---|
| **Use Case ID** | UC-ACC-10 |
| **Use Case Name** | Request Account Cancellation |
| **Primary Actor** | Registered User |
| **Secondary Actors** | Email Service, AccountCancellationProcessor |
| **Priority** | Medium |
| **Trigger** | User submits cancellation request form |
| **Preconditions** | User is authenticated. |
| **Postconditions (Success)** | Cancellation request recorded in `dra_account_cancellations`; confirmation email sent; Platform Admin notified. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Navigates to account cancellation page; provides reason (optional); confirms intent. |
| 2 | Client | `POST /account/cancel` with `{ reason }`. |
| 3 | System | Validates JWT; validates request is not duplicate. |
| 4 | System | `AccountCancellationProcessor.createRequest()` — inserts cancellation record with `status = pending`. |
| 5 | System | Sends confirmation email to user: *"We've received your cancellation request…"* |
| 6 | System | Sends admin notification. |
| 7 | System | HTTP 200 confirmation. |

### Alternative Flows

**ALT-ACC10A — Cancellation Already Pending**
- HTTP 409: *"A cancellation request is already pending for your account."*

**ALT-ACC10B — Active Paid Subscription**
- At step 4: system notes subscription details; admin must process manual subscription cancellation before account deletion.

**ALT-ACC10C — User Changes Mind (Withdrawal Period)**
- User submits `POST /account/cancel/withdraw` before admin processes: request status set to `withdrawn`.

### Business Rules
- BR-ACC-05: Cancellation requests are not auto-processed; admin review is required (see UC-ADM-12).
- BR-ACC-06: Active paid subscriptions must be manually cancelled before account deletion is finalised.

---

## UC-ACC-11 — Unsubscribe via Email Link

*(See UC-AUTH-10; same flow but routed from the Account domain context.)*

| Field | Value |
|---|---|
| **Use Case ID** | UC-ACC-11 |
| **Use Case Name** | Unsubscribe via Email Link |
| **Primary Actor** | Registered User |
| **Trigger** | User clicks unsubscribe link in any platform email |
| **Postconditions (Success)** | `email_subscribed = false`; no further marketing/notification emails. |

*Delegates to UC-AUTH-10.*
