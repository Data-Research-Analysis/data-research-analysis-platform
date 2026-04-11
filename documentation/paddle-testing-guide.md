# Paddle Integration Testing & Deployment Guide

This guide provides comprehensive instructions for testing and deploying the Paddle payment gateway integration for Data Research Analysis platform subscriptions.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Paddle Sandbox Setup](#paddle-sandbox-setup)
3. [Environment Configuration](#environment-configuration)
4. [Database Setup](#database-setup)
5. [Integration Testing](#integration-testing)
6. [Webhook Testing](#webhook-testing)
7. [End-to-End Testing](#end-to-end-testing)
8. [Production Deployment Checklist](#production-deployment-checklist)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Accounts
- **Paddle Sandbox Account**: Create at https://sandbox-vendors.paddle.com/signup
- **Paddle Production Account**: Create at https://vendors.paddle.com/signup (only after sandbox testing complete)

### Development Environment
- Node.js 18+ installed
- Docker and Docker Compose for local testing
- PostgreSQL database running
- Redis server running (for email queue)

---

## Paddle Sandbox Setup

### 1. Create Sandbox Account
1. Visit https://sandbox-vendors.paddle.com/signup
2. Complete vendor registration
3. Navigate to **Developer Tools** → **Authentication** → **API Keys**
4. Generate a new **Server-side key** (not Client-side key)
5. Copy the API key - you'll need this for `PADDLE_API_KEY` environment variable

### 2. Get Client Token
1. In Paddle Sandbox, go to **Developer Tools** → **Authentication** → **Client-side tokens**
2. Create a new client-side token for your domain (e.g., `localhost:3000` for dev, `yourdomain.com` for production)
3. Copy the client token - you'll need this for `PADDLE_CLIENT_TOKEN` environment variable

### 3. Create Products and Prices
Navigate to **Catalog** → **Products** in the Paddle Sandbox dashboard.

#### Create Products
Create **4 products** (one for each paid tier):

1. **STARTER**
   - Name: "DRA Starter Plan"
   - Description: "Perfect for small teams getting started with data analytics"
   - Tax category: "Software as a Service"
   
2. **PROFESSIONAL**
   - Name: "DRA Professional Plan"
   - Description: "Advanced analytics for growing teams"
   - Tax category: "Software as a Service"
   
3. **PROFESSIONAL PLUS**
   - Name: "DRA Professional Plus Plan"
   - Description: "Enterprise-grade analytics with priority support"
   - Tax category: "Software as a Service"
   
4. **ENTERPRISE**
   - Name: "DRA Enterprise Plan"
   - Description: "Complete analytics solution for large organizations"
   - Tax category: "Software as a Service"

#### Create Prices for Each Product
For **each product**, create **2 prices** (monthly and annual):

**STARTER**:
- Monthly: $23.00 USD, billing interval: month
- Annual: $276.00 USD, billing interval: year

**PROFESSIONAL**:
- Monthly: $103.00 USD, billing interval: month
- Annual: $1,236.00 USD, billing interval: year

**PROFESSIONAL PLUS**:
- Monthly: $319.00 USD, billing interval: month
- Annual: $3,828.00 USD, billing interval: year

**ENTERPRISE**:
- Monthly: $1,999.00 USD, billing interval: month
- Annual: $23,988.00 USD, billing interval: year

#### Copy Product and Price IDs
After creating products and prices:
1. Click on each product to view details
2. Copy the **Product ID** (format: `pro_xxxxx`)
3. Click on each price within the product
4. Copy the **Price ID** (format: `pri_xxxxx`)

You should have:
- 4 Product IDs (one per tier)
- 8 Price IDs (monthly + annual for each tier)

---

## Environment Configuration

### Backend Environment Variables

Create or update `backend/.env`:

```bash
# Paddle API Configuration
PADDLE_API_KEY=your_sandbox_api_key_here
PADDLE_ENVIRONMENT=sandbox  # Change to 'production' for live
PADDLE_WEBHOOK_SECRET=your_webhook_secret_here

# Frontend URL (for post-checkout redirects)
FRONTEND_URL=http://localhost:3000

# Email Configuration (for payment notifications)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=noreply@dataresearchanalysis.com
```

**How to get PADDLE_WEBHOOK_SECRET**:
1. Go to **Developer Tools** → **Notifications** → **Notification Settings**
2. Create a new webhook destination: `https://yourdomain.com/paddle/webhook`
3. Copy the **Webhook Secret** shown

### Frontend Environment Variables

Create or update `frontend/.env`:

```bash
# Paddle Client Token
NUXT_PUBLIC_PADDLE_CLIENT_TOKEN=your_client_token_here
NUXT_PUBLIC_PADDLE_ENVIRONMENT=sandbox  # Change to 'production' for live

# Backend API URL
NUXT_API_URL=http://localhost:3002
```

### Update Database Seeder

Edit `backend/src/seeders/09-20260405-PaddlePriceIdSeeder.ts` and replace placeholder IDs:

```typescript
const tierUpdates = [
    {
        tier_name: ESubscriptionTier.STARTER,
        paddle_product_id: 'pro_abc123def456',  // Replace with your STARTER product ID
        paddle_price_id_monthly: 'pri_starter_monthly_789',  // Replace with STARTER monthly price ID
        paddle_price_id_annual: 'pri_starter_annual_012'     // Replace with STARTER annual price ID
    },
    // ... update all other tiers
];
```

Run the seeder:
```bash
cd backend
npm run seed:run -- -d ./src/datasources/PostgresDSMigrations.ts src/seeders/09-20260405-PaddlePriceIdSeeder.ts
```

Verify the update:
```sql
SELECT tier_name, paddle_product_id, paddle_price_id_monthly, paddle_price_id_annual 
FROM dra_subscription_tiers 
WHERE tier_name != 'FREE';
```

All 4 paid tiers should have Paddle IDs populated.

---

## Database Setup

### Run Migrations

Ensure all Paddle-related migrations are applied:

```bash
cd backend
npm run migration:run
```

Expected migrations:
1. `AddPaddleFieldsToSubscriptions` - Adds Paddle columns to `dra_organization_subscriptions`
2. `AddPaddlePriceIds` - Adds Paddle ID columns to `dra_subscription_tiers`
3. `CreatePaddleWebhookEventsTable` - Creates `dra_paddle_webhook_events` table

### Verify Database Schema

Run this SQL to verify tables:

```sql
-- Check subscription table has Paddle columns
\d dra_organization_subscriptions

-- Check tier table has Paddle columns
\d dra_subscription_tiers

-- Check webhook events table exists
\d dra_paddle_webhook_events
```

Expected columns in `dra_organization_subscriptions`:
- `paddle_subscription_id` (varchar, nullable)
- `paddle_customer_id` (varchar, nullable)
- `grace_period_ends_at` (timestamp, nullable)
- `last_payment_failed_at` (timestamp, nullable)

Expected columns in `dra_subscription_tiers`:
- `paddle_product_id` (varchar, nullable)
- `paddle_price_id_monthly` (varchar, nullable)
- `paddle_price_id_annual` (varchar, nullable)

---

## Integration Testing

### Run Backend Integration Tests

```bash
cd backend

# Run all tests
npm test

# Run only Paddle tests
npm test -- paddle

# Run with coverage
npm run test:coverage
```

### Test Suites

**paddle-subscription.test.ts** - Tests subscription API routes:
- `GET /subscription/:organizationId` - Fetch subscription details
- `POST /subscription/checkout` - Create checkout session
- `POST /subscription/check-activation` - Poll activation status
- `POST /subscription/cancel` - Cancel subscription
- `GET /subscription/payment-history/:organizationId` - Fetch payment history
- `POST /subscription/portal-url` - Generate billing portal URL

**paddle-webhook.test.ts** - Tests webhook event handling:
- Signature verification (valid/invalid/missing)
- Event idempotency (duplicate detection)
- `subscription.created` event processing
- `transaction.completed` event processing
- `transaction.payment_failed` event processing
- `subscription.canceled` event processing
- Error logging for malformed events

### Expected Test Results

All tests should pass:
```
PASS  src/__tests__/integration/paddle-subscription.test.ts
  ✓ GET /subscription/:organizationId - should return subscription for member (200)
  ✓ GET /subscription/:organizationId - should reject non-member (403)
  ✓ POST /subscription/checkout - should validate required fields (400)
  ✓ POST /subscription/checkout - should reject invalid billing cycle (400)
  ... (20+ more tests)

PASS  src/__tests__/integration/paddle-webhook.test.ts
  ✓ should reject webhook without signature
  ✓ should reject webhook with invalid signature
  ✓ should accept webhook with valid signature
  ✓ should process duplicate events only once
  ... (10+ more tests)

Test Suites: 2 passed, 2 total
Tests:       30+ passed, 30+ total
```

---

## Webhook Testing

### 1. Set Up Local Webhook Endpoint

Use **ngrok** or **localtunnel** to expose your local server:

```bash
# Install ngrok
npm install -g ngrok

# Start your backend server
cd backend
npm run dev

# In another terminal, create tunnel
ngrok http 3002
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`).

### 2. Configure Webhook in Paddle Sandbox

1. Go to **Developer Tools** → **Notifications** → **Notification Settings**
2. Click **New Notification Destination**
3. Enter URL: `https://abc123.ngrok.io/paddle/webhook`
4. Select events to send:
   - `subscription.created`
   - `subscription.updated`
   - `subscription.canceled`
   - `transaction.completed`
   - `transaction.payment_failed`
5. Save and copy the **Webhook Secret**
6. Update `PADDLE_WEBHOOK_SECRET` in `backend/.env`

### 3. Use Paddle Event Simulator

Paddle provides an event simulator in the sandbox:

1. Go to **Developer Tools** → **Notifications** → **Event Simulator**
2. Select event type (e.g., `transaction.completed`)
3. Fill in sample data or use auto-generated payload
4. Click **Send Event**
5. Webhook will be sent to your configured endpoint

### 4. Verify Webhook Processing

Check database for logged events:

```sql
SELECT event_id, event_type, processed_successfully, error_message, created_at
FROM dra_paddle_webhook_events
ORDER BY created_at DESC
LIMIT 10;
```

Successful events should have:
- `processed_successfully = true`
- `error_message = null`

### 5. Monitor Webhook Logs

Check backend console for webhook processing logs:

```
[PaddleWebhook] Received event: subscription.created (evt_abc123)
[PaddleWebhook] Signature verified successfully
[PaddleWebhook] Event processed successfully: subscription.created
```

---

## End-to-End Testing

### 1. Test Checkout Flow

1. **Start Application**:
   ```bash
   # Terminal 1: Backend
   cd backend && npm run dev
   
   # Terminal 2: Frontend
   cd frontend && npm run dev
   ```

2. **Create Test Account**:
   - Navigate to http://localhost:3000/register
   - Create a test user account
   - Verify email (check console logs for verification link if needed)

3. **Create Organization**:
   - Log in and create a new organization
   - Note the organization ID from URL

4. **Initiate Checkout**:
   - Navigate to pricing page: http://localhost:3000/pricing
   - **IMPORTANT**: Set `PADDLE_CHECKOUT_ENABLED = true` in `frontend/components/pricing-section.vue` (line ~20)
   - Click "Get Started" on any paid tier
   - Select billing cycle (Monthly/Annual)
   - Paddle checkout overlay should open

5. **Complete Test Checkout**:
   - Use Paddle test card numbers:
     - **Success**: `4242 4242 4242 4242`
     - **Declined**: `4000 0000 0000 0002`
     - **Requires 3DS**: `4000 0025 0000 3155`
   - Expiry: Any future date
   - CVC: Any 3 digits
   - Complete checkout

6. **Verify Activation**:
   - After checkout, should redirect to `/billing`
   - Check that subscription shows as active
   - Verify tier upgraded from FREE
   - Check database:
     ```sql
     SELECT * FROM dra_organization_subscriptions 
     WHERE organization_id = YOUR_ORG_ID;
     ```

### 2. Test Billing Portal

1. Navigate to `/billing` page
2. Click "Update Payment Method" button
3. Paddle billing portal should open in new tab
4. Verify you can view/update payment details

### 3. Test Subscription Cancellation

1. On `/billing` page, click "Cancel Subscription"
2. Select a cancellation reason
3. Confirm cancellation
4. Verify subscription shows:
   - Status: "Active until [date]"
   - `cancelled_at` timestamp in database
5. Check webhook event was received:
   ```sql
   SELECT * FROM dra_paddle_webhook_events 
   WHERE event_type = 'subscription.canceled' 
   ORDER BY created_at DESC LIMIT 1;
   ```

### 4. Test Payment Failure & Grace Period

**Using Paddle Event Simulator**:

1. Go to Paddle Sandbox → **Event Simulator**
2. Select `transaction.payment_failed`
3. Fill in:
   - `subscription_id`: Your test subscription's Paddle ID
   - `custom_data.organizationId`: Your organization ID
4. Send event
5. Verify in database:
   ```sql
   SELECT grace_period_ends_at, last_payment_failed_at 
   FROM dra_organization_subscriptions 
   WHERE organization_id = YOUR_ORG_ID;
   ```
6. Grace period should be set to 14 days from now

**Check Grace Period Warning**:
1. Refresh `/billing` page
2. Red alert banner should appear: "Payment failed. Grace period expires in X days"

### 5. Test Grace Period Expiry

**Manual Cron Job Trigger**:

1. Set grace period to past date:
   ```sql
   UPDATE dra_organization_subscriptions 
   SET grace_period_ends_at = NOW() - INTERVAL '1 day' 
   WHERE organization_id = YOUR_ORG_ID;
   ```

2. Trigger cron job manually:
   ```bash
   cd backend
   node -e "import('./src/jobs/subscriptionGracePeriodJob.js').then(m => m.processExpiredGracePeriods())"
   ```

3. Check results:
   - Email sent to organization owner (check email logs)
   - Subscription tier downgraded to FREE:
     ```sql
     SELECT s.tier_id, t.tier_name 
     FROM dra_organization_subscriptions s 
     JOIN dra_subscription_tiers t ON s.subscription_tier_id = t.id 
     WHERE s.organization_id = YOUR_ORG_ID;
     ```

---

## Production Deployment Checklist

### Pre-Deployment

- [ ] All integration tests passing in CI/CD pipeline
- [ ] End-to-end testing completed in Paddle sandbox
- [ ] Webhook handling verified with event simulator
- [ ] Grace period cron job tested successfully
- [ ] Email templates reviewed and tested
- [ ] SSL certificate installed for webhook endpoint
- [ ] Database backups configured

### Paddle Production Setup

- [ ] Create Paddle production account at https://vendors.paddle.com
- [ ] Complete vendor verification (tax info, bank details)
- [ ] Create production products and prices (same structure as sandbox)
- [ ] Copy production Product IDs and Price IDs
- [ ] Update `09-20260405-PaddlePriceIdSeeder.ts` with production IDs
- [ ] Generate production API key
- [ ] Generate production client token
- [ ] Configure production webhook endpoint: `https://yourdomain.com/paddle/webhook`
- [ ] Copy production webhook secret

### Environment Variable Updates

**Backend Production `.env`**:
```bash
PADDLE_API_KEY=your_production_api_key
PADDLE_ENVIRONMENT=production
PADDLE_WEBHOOK_SECRET=your_production_webhook_secret
FRONTEND_URL=https://yourdomain.com
```

**Frontend Production `.env`**:
```bash
NUXT_PUBLIC_PADDLE_CLIENT_TOKEN=your_production_client_token
NUXT_PUBLIC_PADDLE_ENVIRONMENT=production
NUXT_API_URL=https://api.yourdomain.com
```

### Database Migration

- [ ] Run migrations on production database:
  ```bash
  cd backend
  NODE_ENV=production npm run migration:run
  ```
- [ ] Run seeder with production Paddle IDs:
  ```bash
  NODE_ENV=production npm run seed:run -- -d ./src/datasources/PostgresDSMigrations.ts src/seeders/09-20260405-PaddlePriceIdSeeder.ts
  ```
- [ ] Verify seeder results:
  ```sql
  SELECT tier_name, paddle_product_id, paddle_price_id_monthly, paddle_price_id_annual 
  FROM dra_subscription_tiers 
  WHERE tier_name != 'FREE';
  ```

### Code Deployment

- [ ] Deploy backend first (zero-downtime deployment)
- [ ] Verify backend health check: `GET /health`
- [ ] Verify webhook endpoint responds: `POST /paddle/webhook` (should return 200)
- [ ] Deploy frontend
- [ ] Enable feature flag in `frontend/components/pricing-section.vue`:
  ```typescript
  const PADDLE_CHECKOUT_ENABLED = true;
  ```
- [ ] Clear CDN cache for frontend assets

### Post-Deployment Validation

- [ ] Test checkout flow with real credit card (small amount)
- [ ] Verify webhook received in production database
- [ ] Test subscription cancellation
- [ ] Trigger test payment failure (if possible)
- [ ] Verify emails sent correctly
- [ ] Monitor error logs for 24 hours
- [ ] Check Paddle dashboard for transaction records

### Monitoring Setup

- [ ] Set up alerts for webhook failures
- [ ] Monitor `dra_paddle_webhook_events.processed_successfully = false`
- [ ] Set up daily cron job monitoring (check last run time)
- [ ] Configure Sentry/error tracking for Paddle routes
- [ ] Set up billing anomaly alerts (failed payments, cancellations)

---

## Troubleshooting

### Checkout Overlay Doesn't Open

**Symptoms**: Click "Get Started" button, nothing happens.

**Possible Causes**:
1. `PADDLE_CHECKOUT_ENABLED` still set to `false`
2. Paddle SDK not loaded (check browser console)
3. Client token invalid

**Solutions**:
```typescript
// frontend/components/pricing-section.vue
const PADDLE_CHECKOUT_ENABLED = true;  // Line ~20

// Check browser console for errors
// Should see: "Paddle SDK loaded successfully"
```

**Verify Paddle SDK**:
```javascript
// In browser console:
console.log(window.Paddle);
// Should output Paddle object, not undefined
```

### Webhook Signature Verification Fails

**Symptoms**: Webhook events logged with error: "Invalid signature".

**Possible Causes**:
1. Wrong webhook secret in `.env`
2. Webhook destination configured for different URL
3. Raw body not preserved (Express middleware issue)

**Solutions**:
1. Verify webhook secret matches Paddle dashboard
2. Check `backend/src/index.ts` has raw body middleware **before** `app.use(express.json())`:
   ```typescript
   app.use(express.text({ type: 'application/json' })); // MUST come first
   app.use(express.json());
   ```

**Debug Signature**:
```typescript
// In backend/src/routes/paddle-webhook.ts
console.log('Received signature:', req.headers['paddle-signature']);
console.log('Webhook secret:', process.env.PADDLE_WEBHOOK_SECRET);
console.log('Raw body:', req.body);
```

### Grace Period Not Triggering

**Symptoms**: Payment failed but no grace period set.

**Check**:
1. Webhook event received:
   ```sql
   SELECT * FROM dra_paddle_webhook_events 
   WHERE event_type = 'transaction.payment_failed';
   ```
2. Error message in webhook log
3. SubscriptionProcessor.handleFailedPayment() called

**Manual Fix**:
```sql
-- Set grace period manually if webhook missed
UPDATE dra_organization_subscriptions 
SET grace_period_ends_at = NOW() + INTERVAL '14 days',
    last_payment_failed_at = NOW()
WHERE paddle_subscription_id = 'sub_xxxxx';
```

### Cron Job Not Running

**Symptoms**: Grace periods expired but no downgrade emails sent.

**Check Cron Job**:
```bash
# Check PM2 logs
pm2 logs backend

# Should see daily at 2 AM UTC:
# [SubscriptionGracePeriodJob] Running grace period check...
# [SubscriptionGracePeriodJob] Found X expired subscriptions
```

**Manual Trigger**:
```bash
cd backend
node -e "import('./src/jobs/subscriptionGracePeriodJob.js').then(m => m.processExpiredGracePeriods())"
```

**Verify Cron Schedule**:
```typescript
// backend/src/jobs/subscriptionGracePeriodJob.ts
// Should be: '0 2 * * *' (2 AM UTC daily)

// backend/src/index.ts
// Should have: startSubscriptionGracePeriodJob();
```

### Checkout Polling Times Out

**Symptoms**: After checkout, stuck on "Verifying activation..." message.

**Possible Causes**:
1. Webhook not received by backend
2. Subscription not created in database
3. Network issues between Paddle and your server

**Debug**:
1. Check webhook events:
   ```sql
   SELECT * FROM dra_paddle_webhook_events 
   WHERE event_type = 'subscription.created' 
   ORDER BY created_at DESC LIMIT 5;
   ```
2. Check subscription created:
   ```sql
   SELECT * FROM dra_organization_subscriptions 
   WHERE organization_id = YOUR_ORG_ID;
   ```
3. Increase polling timeout in `frontend/composables/usePaddle.ts`:
   ```typescript
   const maxAttempts = 10;  // Increase to 20
   const pollingInterval = 2000;  // Or increase to 3000ms
   ```

### Emails Not Sending

**Symptoms**: Payment events processed but no emails received.

**Check Email Queue**:
```bash
# Check BullMQ dashboard or logs
# Should see jobs in 'active' or 'completed' state
```

**Verify Email Service**:
```typescript
// Backend console should show:
// [EmailService] Email sent successfully: subscription-activated
```

**Test Email Manually**:
```bash
cd backend
node -e "
import('./src/services/EmailService.js').then(m => {
  const svc = m.EmailService.getInstance();
  svc.sendSubscriptionActivatedEmail('test@example.com', 'Test User', 'STARTER');
})
"
```

**Common Issues**:
- Invalid SMTP credentials
- Email blocked by spam filter
- FROM address not verified in email provider

---

## Additional Resources

- **Paddle Documentation**: https://developer.paddle.com/
- **Paddle Sandbox Dashboard**: https://sandbox-vendors.paddle.com/
- **Paddle Production Dashboard**: https://vendors.paddle.com/
- **Paddle API Reference**: https://developer.paddle.com/api-reference/overview
- **Paddle Webhooks Guide**: https://developer.paddle.com/webhooks/overview
- **Paddle Test Cards**: https://developer.paddle.com/concepts/payment-methods/credit-debit-card

---

## Support Contacts

For Paddle-related issues:
- **Paddle Support**: support@paddle.com
- **Paddle Community**: https://community.paddle.com/

For DRA platform issues:
- **Internal Dev Team**: devteam@dataresearchanalysis.com
- **On-call Engineer**: Check PagerDuty rotation

---

**Document Version**: 1.0  
**Last Updated**: 2026-04-05  
**Maintained By**: Platform Engineering Team
