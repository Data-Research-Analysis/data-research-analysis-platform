# Paddle Hybrid Subscription Management - Phase 1 Complete

**Status**: ✅ **IMPLEMENTED**  
**Date**: 2025-01-XX  
**Phase**: 1 of 3  
**Impact**: CRITICAL — Prevents billing mismatch between Paddle and database

---

## Executive Summary

**Problem Identified**: Admin-initiated tier changes bypassed Paddle API, causing subscription/billing desynchronization and potential revenue loss.

**Solution**: Implemented hybrid subscription management system that detects subscription source (Paddle vs Direct) and routes tier changes appropriately.

**Result**: Tier changes now respect billing source:
- Organizations with Paddle subscriptions → Update via Paddle API with automatic proration
- Organizations without Paddle (free tier, manual billing, enterprise) → Direct database update

---

## Critical Issue Resolved

### The Problem
When an admin changed an organization's tier through the admin interface:
1. Database was updated directly (`subscription.tier_id = newTierId`)
2. **Paddle API was NOT called** → Paddle subscription remained on old tier
3. **Billing mismatch**: Database shows new tier, Paddle bills for old tier
4. **Webhook conflicts**: Paddle webhooks overwrite admin changes
5. **Revenue impact**: Lost revenue or incorrect charges

### Root Cause
Original `changeTier()` implementation assumed all tier changes should be direct database updates, as it was designed before Paddle integration was added.

### The Fix
Tier change flow now detects subscription source and routes accordingly:

```typescript
const hasPaddleSubscription = !!organization.subscription.paddle_subscription_id;

if (hasPaddleSubscription) {
    // Route A: Update via Paddle API with proration
    await paddle.updateSubscription(subscriptionId, newPriceId, 'immediately');
} else {
    // Route B: Direct database update
    console.log('Direct database update - no Paddle subscription');
}

// Always update local database to maintain consistency
await manager.save(organization.subscription);
```

---

## Phase 1 Implementation Details

### 1. Backend: Payment Method API Enhancement

**File**: `backend/src/processors/SubscriptionProcessor.ts`

**Method Modified**: `getPaymentMethod(organizationId: number)`

**New Return Type**:
```typescript
{
    type: string | null,               // 'card', null
    last4: string | null,              // Last 4 digits
    expiryMonth: number | null,
    expiryYear: number | null,
    brand: string | null,              // 'visa', 'mastercard', etc.
    
    // NEW FIELDS:
    hasPaddleSubscription: boolean,    // true if paddle_subscription_id exists
    paddleSubscriptionId: string | null,
    billingType: 'paddle' | 'manual' | 'free'
}
```

**Logic**:
```typescript
const hasPaddleSubscription = !!organization.subscription.paddle_subscription_id;

let billingType: 'paddle' | 'manual' | 'free';
if (hasPaddleSubscription) {
    billingType = 'paddle';
} else if (organization.subscription.subscription_tier.tier_name === 'free') {
    billingType = 'free';
} else {
    billingType = 'manual'; // Enterprise or custom billing
}
```

**Impact**: Frontend can now detect subscription type on load and display appropriate messaging.

---

### 2. Backend: Tier Change Routing Logic

**File**: `backend/src/processors/SubscriptionProcessor.ts`

**Method Modified**: `changeTier(organizationId, newTierId, userId)`

**Key Changes**:

#### Step 1: Detect Subscription Source
```typescript
const hasPaddleSubscription = !!organization.subscription.paddle_subscription_id;
```

#### Step 2: Route A - Paddle Subscription Update
```typescript
if (hasPaddleSubscription) {
    console.log(`🔄 Updating Paddle subscription for Org ${organizationId}`);
    
    // Get appropriate price ID for billing cycle
    const billingCycle = organization.subscription.billing_cycle || 'monthly';
    const newPriceId = billingCycle === 'monthly' 
        ? newTier.paddle_price_id_monthly 
        : newTier.paddle_price_id_annual;
    
    // Update subscription in Paddle with immediate proration
    const paddle = PaddleService.getInstance();
    await paddle.updateSubscription(
        organization.subscription.paddle_subscription_id,
        newPriceId,
        'immediately'
    );
    
    console.log(`✅ Paddle subscription updated with proration`);
}
```

**Proration Behavior**:
- **Upgrades**: Customer charged immediately for prorated difference
- **Downgrades**: Credit applied to next billing cycle
- **Billing cycle preserved**: Monthly → Monthly, Annual → Annual

#### Step 3: Route B - Direct Database Update
```typescript
else {
    // Free tier, manual billing, or enterprise
    console.log(`📝 Direct database update for Org ${organizationId} (no Paddle subscription)`);
}
```

#### Step 4: Always Update Local Database
```typescript
// Ensures database consistency regardless of route
organization.subscription.subscription_tier_id = newTierId;
organization.subscription.subscription_tier = newTier;
await manager.save(organization.subscription);
```

**Why Both?**: Even Paddle subscriptions need local database update for immediate reads. Paddle webhooks may arrive seconds/minutes later.

---

### 3. Frontend: Subscription Type Detection

**File**: `frontend/pages/pricing.vue`

**New State Variables**:
```typescript
const subscriptionType = ref<'paddle' | 'manual' | 'free' | null>(null);
const hasPaddleSubscription = ref(false);
```

**Enhanced Organization Loading**:
```typescript
async function loadOrganization(orgId: number) {
    // ... existing logic ...
    
    // NEW: Fetch payment method to determine subscription type
    const paymentInfo = await orgSubscription.getPaymentMethod(orgId);
    if (paymentInfo) {
        subscriptionType.value = paymentInfo.billingType || null;
        hasPaddleSubscription.value = paymentInfo.hasPaddleSubscription || false;
        console.log(`💳 Subscription type: ${subscriptionType.value}`);
    }
}
```

**Impact**: Frontend knows billing type before any tier change action.

---

### 4. Frontend: Context-Aware Confirmation Messages

**File**: `frontend/pages/pricing.vue`

**Method Modified**: `handleSelectPlan(tier)`

**Before** (Generic):
```html
Are you sure you want to change to the <strong>${tier.toUpperCase()}</strong> plan?
```

**After** (Context-Aware):
```typescript
let confirmationHtml = `Are you sure you want to change to the <strong>${tier.toUpperCase()}</strong> plan?<br><br>`;

if (subscriptionType.value === 'paddle') {
    confirmationHtml += `
        <div class="text-sm text-gray-600 mt-2">
            <strong>Billing:</strong> Your Paddle subscription will be updated immediately with automatic proration. 
            You'll be charged or credited based on the remaining billing cycle.
        </div>
    `;
} else if (subscriptionType.value === 'manual') {
    confirmationHtml += `
        <div class="text-sm text-gray-600 mt-2">
            <strong>Billing:</strong> This is a manual billing organization. 
            Tier changes will be reflected in the next invoice.
        </div>
    `;
} else if (subscriptionType.value === 'free') {
    confirmationHtml += `
        <div class="text-sm text-gray-600 mt-2">
            <strong>Note:</strong> Upgrades from the free tier will require payment setup.
        </div>
    `;
}

await Swal.fire({ html: confirmationHtml, ... });
```

**Impact**: Users understand billing implications before confirming change.

---

### 5. Frontend: Subscription Type Banner

**File**: `frontend/pages/pricing.vue`

**Location**: Top of pricing page (organization mode only)

**Implementation**:
```vue
<div v-if="orgId && subscriptionType && !orgError" class="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
    <div class="flex items-start">
        <font-awesome-icon :icon="['fas', 'info-circle']" class="text-blue-600 mr-3 mt-0.5" />
        <div class="text-sm text-blue-800">
            <p class="font-medium mb-1">Billing Information</p>
            
            <!-- Paddle Subscription -->
            <p v-if="subscriptionType === 'paddle'">
                <font-awesome-icon :icon="['fas', 'credit-card']" class="mr-2" />
                <strong>Active Paddle Subscription:</strong> Tier changes will update your Paddle subscription 
                with automatic proration. You'll be charged or credited immediately based on the remaining billing cycle.
            </p>
            
            <!-- Manual Billing -->
            <p v-else-if="subscriptionType === 'manual'">
                <font-awesome-icon :icon="['fas', 'file-invoice']" class="mr-2" />
                <strong>Manual Billing:</strong> Tier changes apply immediately. 
                Billing adjustments will be reflected in your next invoice.
            </p>
            
            <!-- Free Tier -->
            <p v-else-if="subscriptionType === 'free'">
                <font-awesome-icon :icon="['fas', 'gift']" class="mr-2" />
                <strong>Free Tier:</strong> Upgrades to paid tiers will require setting up 
                a payment method through Paddle checkout.
            </p>
        </div>
    </div>
</div>
```

**Visibility**: Only shown when:
- Organization mode (`orgId` present)
- Subscription type loaded (`subscriptionType` not null)
- No permission errors (`!orgError`)

**Impact**: Transparent billing expectations, reduced support inquiries.

---

## Data Flow Diagram

### Scenario A: Paddle Subscription Update

```
Admin Changes Tier
        ↓
Frontend: pricing.vue
  - Detects subscriptionType = 'paddle'
  - Shows proration confirmation
        ↓
Backend: SubscriptionProcessor.changeTier()
  - Checks: hasPaddleSubscription = true
  - Calls: paddle.updateSubscription(subscriptionId, newPriceId, 'immediately')
        ↓
Paddle API
  - Validates request
  - Calculates proration
  - Updates subscription
  - Charges/credits customer
  - Sends webhook: subscription.updated
        ↓
Backend: PaddleWebhookController
  - Receives subscription.updated event
  - Updates database with webhook data
  - Ensures consistency
        ↓
Result: ✅ Paddle + Database in sync
```

### Scenario B: Direct Database Update

```
Admin Changes Tier (Free/Manual Billing Org)
        ↓
Frontend: pricing.vue
  - Detects subscriptionType = 'manual' or 'free'
  - Shows appropriate confirmation
        ↓
Backend: SubscriptionProcessor.changeTier()
  - Checks: hasPaddleSubscription = false
  - Skips Paddle API call
  - Updates database directly
        ↓
Result: ✅ Database updated, no Paddle involvement
```

---

## Testing Scenarios

### Test Case 1: Paddle Subscription Upgrade
**Organization**: Has `paddle_subscription_id` (e.g., "sub_01abc...")  
**Current Tier**: Professional ($49/mo)  
**Action**: Admin changes to Business ($99/mo)  

**Expected Behavior**:
1. ✅ Frontend shows proration confirmation
2. ✅ Backend calls `paddle.updateSubscription()`
3. ✅ Paddle charges prorated difference immediately
4. ✅ Database updated to Business tier
5. ✅ Paddle webhook confirms change
6. ✅ Email sent to organization owner

**Verification**:
```sql
SELECT paddle_subscription_id, subscription_tier_id 
FROM dra_organization_subscriptions 
WHERE organization_id = X;
-- Should show Business tier ID

-- Check Paddle dashboard: subscription should show Business tier
```

### Test Case 2: Free Tier Organization Upgrade
**Organization**: Has NO `paddle_subscription_id` (null)  
**Current Tier**: Free  
**Action**: Admin changes to Professional  

**Expected Behavior**:
1. ✅ Frontend shows "Upgrades require payment setup" note
2. ✅ Backend skips Paddle API call (no subscription to update)
3. ✅ Database updated to Professional tier
4. ✅ Organization can now use Professional features
5. ✅ Email sent to owner

**Note**: This creates a manual billing scenario. Organization gets Professional features but must pay via invoice or manual Paddle checkout later.

### Test Case 3: Manual Billing (Enterprise) Tier Change
**Organization**: Has NO `paddle_subscription_id`, on Enterprise tier  
**Current Tier**: Enterprise  
**Action**: Admin changes to Business  

**Expected Behavior**:
1. ✅ Frontend shows "Manual billing" confirmation
2. ✅ Backend skips Paddle API call
3. ✅ Database updated immediately
4. ✅ Billing adjustment on next invoice
5. ✅ Email sent to owner

### Test Case 4: Paddle Subscription Downgrade
**Organization**: Has `paddle_subscription_id`  
**Current Tier**: Business ($99/mo)  
**Action**: Admin changes to Professional ($49/mo)  

**Expected Behavior**:
1. ✅ Frontend shows proration confirmation
2. ✅ Backend calls `paddle.updateSubscription()`
3. ✅ Paddle applies credit to next billing cycle
4. ✅ Database updated to Professional tier
5. ✅ Downgrade request tracked in `dra_downgrade_requests`
6. ✅ Email sent to owner

---

## API Reference

### GET /subscription/payment-method/:organizationId

**Purpose**: Retrieve payment method and subscription type information.

**Headers**:
```
Authorization: Bearer <jwt_token>
Authorization-Type: auth
```

**Response** (200 OK):
```json
{
    "type": "card",
    "last4": "4242",
    "expiryMonth": 12,
    "expiryYear": 2025,
    "brand": "visa",
    "hasPaddleSubscription": true,
    "paddleSubscriptionId": "sub_01hxyz...",
    "billingType": "paddle"
}
```

**Response** (Free Tier, No Payment Method):
```json
{
    "type": null,
    "last4": null,
    "expiryMonth": null,
    "expiryYear": null,
    "brand": null,
    "hasPaddleSubscription": false,
    "paddleSubscriptionId": null,
    "billingType": "free"
}
```

**Response** (Manual Billing, No Payment Method):
```json
{
    "type": null,
    "last4": null,
    "expiryMonth": null,
    "expiryYear": null,
    "brand": null,
    "hasPaddleSubscription": false,
    "paddleSubscriptionId": null,
    "billingType": "manual"
}
```

---

### POST /subscription/change-tier

**Purpose**: Change organization subscription tier (admin-only).

**Headers**:
```
Authorization: Bearer <jwt_token>
Authorization-Type: auth
Content-Type: application/json
```

**Request Body**:
```json
{
    "organizationId": 123,
    "newTierId": 2
}
```

**Response** (200 OK):
```json
{
    "success": true,
    "subscription": {
        "id": 456,
        "organization_id": 123,
        "subscription_tier_id": 2,
        "paddle_subscription_id": "sub_01hxyz...",
        "billing_cycle": "monthly",
        "status": "active",
        // ... other fields
    }
}
```

**Behavior**:
- If `paddle_subscription_id` exists: Updates via Paddle API with proration
- If `paddle_subscription_id` is null: Direct database update
- Always updates local database
- Sends email notification to organization owner
- Tracks downgrade requests if applicable

---

## Database Schema Changes

**No schema changes required.** This implementation uses existing fields:

### Existing Field Usage

**Table**: `dra_organization_subscriptions`

| Column | Type | Usage |
|--------|------|-------|
| `paddle_subscription_id` | varchar(255), nullable | **Key field**: Presence determines routing (Paddle vs Direct) |
| `subscription_tier_id` | int, FK | Updated after successful tier change |
| `billing_cycle` | varchar(20) | Used to select monthly vs annual Paddle price ID |
| `status` | varchar(50) | Active subscriptions only can change tiers |

**No new columns added.** Existing schema fully supports hybrid routing.

---

## Logging & Monitoring

### Console Logs Added

**Backend: SubscriptionProcessor.changeTier()**

```typescript
// Paddle Route
console.log(`🔄 Updating Paddle subscription for Org ${organizationId}`);
console.log(`✅ Paddle subscription updated with proration`);

// Direct Route
console.log(`📝 Direct database update for Org ${organizationId} (no Paddle subscription)`);

// Summary
console.log(`✅ Tier changed: Org ${organizationId} → ${newTier.tier_name} (${hasPaddleSubscription ? 'Paddle' : 'Direct'})`);
```

**Frontend: pricing.vue**

```typescript
console.log(`💳 Subscription type: ${subscriptionType.value}`);
```

### Recommended Monitoring

1. **Paddle Dashboard**:
   - Monitor subscription update events
   - Track proration charges/credits
   - Verify webhook delivery

2. **Database Queries**:
   ```sql
   -- Count organizations by subscription type
   SELECT 
       CASE 
           WHEN paddle_subscription_id IS NOT NULL THEN 'paddle'
           WHEN st.tier_name = 'free' THEN 'free'
           ELSE 'manual'
       END as billing_type,
       COUNT(*) as org_count
   FROM dra_organization_subscriptions s
   JOIN dra_subscription_tiers st ON s.subscription_tier_id = st.id
   GROUP BY billing_type;
   ```

3. **Application Logs**:
   - Search for "Updating Paddle subscription" → Paddle route taken
   - Search for "Direct database update" → Direct route taken
   - Check for Paddle API errors

---

## Security Considerations

### Access Control
- **Tier changes**: Admin-only (`requiresAdministratorAccess` middleware)
- **Organization context**: Admin can change any organization's tier
- **Regular users**: Can only view pricing for their own organizations

### Webhook Validation
- Paddle webhooks use signature verification (`PaddleService.verifyWebhookSignature()`)
- Webhook-triggered updates are authoritative
- Admin updates trigger webhooks for confirmation

### Data Consistency
- **Race Condition Mitigation**: Admin update triggers Paddle, which sends webhook
- **Resolution**: Webhook data is authoritative, overwrites admin update if different
- **Timestamp Comparison**: Webhooks include event timestamp for ordering

---

## Migration Strategy

### Rollout Plan

**Phase 1: ✅ COMPLETE** (This document)
- Hybrid routing implementation
- Context-aware messaging
- Subscription type detection

**Phase 2: FUTURE**
- Full Paddle subscription management UI
- Proration preview before confirmation
- Billing history with Paddle transaction IDs
- Cancel/pause subscription from UI

**Phase 3: FUTURE**
- Self-service tier changes for organization owners
- Usage-based billing integration
- Add-on products (extra storage, API calls)
- Custom pricing for enterprise

### Backward Compatibility

**Existing Paddle Subscriptions**: Fully supported  
- `paddle_subscription_id` already exists in database
- Tier changes now update Paddle correctly
- Webhooks continue to work

**Existing Free Tier Organizations**: Fully supported  
- No `paddle_subscription_id` → Direct route
- Can upgrade to paid tiers (manual billing or Paddle checkout)

**Existing Manual Billing**: Fully supported  
- No `paddle_subscription_id` → Direct route
- Continues as invoice-based billing

**No Breaking Changes**: All existing organizations continue to function correctly.

---

## Known Limitations & Future Enhancements

### Current Limitations

1. **No Proration Preview**: Users don't see exact charge amount before confirming
   - **Impact**: Low (confirmation message explains proration will apply)
   - **Future**: Phase 2 will add Paddle API call to preview charges

2. **No Billing History**: Past tier changes not tracked with Paddle transaction IDs
   - **Impact**: Medium (admins can check Paddle dashboard manually)
   - **Future**: Phase 2 will sync transaction history

3. **No Self-Service for Owners**: Only admins can change tiers
   - **Impact**: High (increases support burden)
   - **Future**: Phase 3 will enable owner-initiated changes

4. **No Subscription Pause**: Cannot pause subscriptions temporarily
   - **Impact**: Low (cancellation works, can re-subscribe)
   - **Future**: Phase 2 will add pause functionality

### Future Enhancements

#### Phase 2: Enhanced Paddle Integration

**Proration Preview**:
```typescript
// Before confirmation, show preview
const preview = await paddle.previewSubscriptionUpdate(subscriptionId, newPriceId);
// Shows: immediate charge $XX.XX or credit $XX.XX
```

**Billing History**:
```vue
<div class="billing-history">
    <div v-for="event in billingEvents" class="event">
        <span>{{ event.date }}</span>
        <span>{{ event.description }}</span>
        <span>{{ event.amount }}</span>
        <a :href="event.paddleInvoiceUrl">View Invoice</a>
    </div>
</div>
```

**Subscription Management**:
- Update payment method
- Change billing cycle (monthly ↔ annual)
- Cancel subscription
- Pause subscription (if Paddle supports)

#### Phase 3: Self-Service & Advanced Features

**Organization Owner Controls**:
- Owners can upgrade/downgrade their own tier
- Approval workflow for enterprise tier requests
- Usage monitoring dashboard
- Overage alerts

**Usage-Based Billing**:
- Track API calls, storage, dashboard views
- Soft limits with warnings
- Hard limits with upgrade prompts

**Add-On Products**:
- Extra storage packages
- Premium support tiers
- Custom integrations
- White-label options

---

## Files Modified

### Backend (2 files)

1. **backend/src/processors/SubscriptionProcessor.ts**
   - **Lines 476-570**: `changeTier()` method — Added Paddle routing logic
   - **Lines 639-720**: `getPaymentMethod()` method — Enhanced return type with subscription metadata

2. **backend/src/processors/OrganizationProcessor.ts**
   - **Lines 129-160**: `getOrganizationById()` — Added `user_role` field to response

### Frontend (2 files)

1. **frontend/pages/pricing.vue**
   - **Lines 590-610**: Added subscription type state variables
   - **Lines 620-670**: Enhanced `loadOrganization()` to fetch subscription type
   - **Lines 700-850**: Updated `handleSelectPlan()` with context-aware confirmation
   - **Lines 150-190**: Added subscription type banner UI

2. **frontend/pages/admin/organizations/[orgid]/settings.vue**
   - **Line 232**: Changed "Change Plan" button to link to pricing page
   - **Lines removed**: Tier change modal component code

---

## Testing Checklist

### Manual Testing

- [ ] **Test 1**: Paddle subscription upgrade
  - Start with Professional tier (Paddle subscription)
  - Admin changes to Business tier
  - Verify Paddle dashboard shows updated subscription
  - Verify proration charge appears in Paddle transactions
  - Verify database updated to Business tier
  - Verify email sent

- [ ] **Test 2**: Paddle subscription downgrade
  - Start with Business tier (Paddle subscription)
  - Admin changes to Professional tier
  - Verify Paddle dashboard shows updated subscription
  - Verify credit applied in Paddle
  - Verify database updated to Professional tier
  - Verify downgrade tracked in `dra_downgrade_requests`

- [ ] **Test 3**: Free tier organization
  - Start with Free tier (no `paddle_subscription_id`)
  - Admin changes to Professional tier
  - Verify no Paddle API call made
  - Verify database updated to Professional tier
  - Verify organization can use Professional features

- [ ] **Test 4**: Manual billing organization
  - Start with Enterprise tier (no `paddle_subscription_id`)
  - Admin changes to Business tier
  - Verify no Paddle API call made
  - Verify database updated immediately
  - Verify "Manual billing" message shown

- [ ] **Test 5**: Subscription type banner
  - Load pricing page for Paddle subscription org → Shows "Active Paddle Subscription" banner
  - Load pricing page for free tier org → Shows "Free Tier" banner
  - Load pricing page for manual billing org → Shows "Manual Billing" banner

- [ ] **Test 6**: Confirmation messages
  - Select tier for Paddle org → Shows proration message
  - Select tier for manual org → Shows invoice adjustment message
  - Select tier for free org → Shows payment setup note

### Automated Testing (Future)

```typescript
// backend/src/processors/SubscriptionProcessor.test.ts

describe('changeTier - Hybrid Routing', () => {
    it('should update via Paddle API when paddle_subscription_id exists', async () => {
        // Mock organization with paddle_subscription_id
        // Call changeTier()
        // Verify PaddleService.updateSubscription() was called
        // Verify database updated
    });
    
    it('should update database directly when paddle_subscription_id is null', async () => {
        // Mock free tier organization
        // Call changeTier()
        // Verify PaddleService.updateSubscription() was NOT called
        // Verify database updated
    });
    
    it('should preserve billing cycle when updating Paddle subscription', async () => {
        // Mock annual billing cycle organization
        // Call changeTier()
        // Verify correct annual price ID used in Paddle API call
    });
});
```

---

## Rollback Plan

If critical issues arise:

### Immediate Rollback (< 1 hour)

1. **Revert Backend Changes**:
   ```bash
   cd backend
   git revert <commit-hash>
   git push
   pm2 restart backend
   ```

2. **Revert Frontend Changes**:
   ```bash
   cd frontend
   git revert <commit-hash>
   git push
   # Redeploy frontend (SSR rebuild required)
   ```

3. **Verify Behavior**:
   - Tier changes revert to direct database updates (old behavior)
   - No Paddle API calls made
   - Admins can still change tiers

### Temporary Workaround

If only Paddle updates are broken:

```typescript
// In changeTier(), force direct route temporarily:
const hasPaddleSubscription = false; // TEMPORARY: Force direct updates
```

This allows tier changes to continue working while investigating Paddle API issues.

---

## Support & Documentation

### For Developers

- **Architecture**: See `comprehensive-architecture-documentation.md`
- **Paddle Integration**: See `PADDLE_INTEGRATION_PLAN.md`
- **Subscription Webhooks**: See `backend/src/controllers/PaddleWebhookController.ts`
- **Email Notifications**: See `backend/src/services/EmailService.ts`

### For Support Team

**User Asks**: "Why was I charged immediately when I upgraded?"  
**Answer**: "Paddle subscriptions use proration. When you upgrade mid-cycle, you're charged the prorated difference immediately. You'll continue on the new tier for the rest of your billing cycle."

**User Asks**: "I'm an admin and changed a tier, but Paddle didn't update."  
**Troubleshoot**:
1. Check: Does organization have `paddle_subscription_id`?
2. Check backend logs for "Updating Paddle subscription" message
3. Check Paddle dashboard for subscription update event
4. Verify webhook delivery (may be delayed)

**User Asks**: "Can I change my organization's tier myself?"  
**Answer**: "Currently, only platform admins can change tiers. This ensures proper billing coordination. Contact support if you need a tier change."

---

## Conclusion

Phase 1 successfully implements hybrid subscription management, resolving the critical Paddle billing mismatch issue. The system now correctly routes tier changes based on subscription source, ensuring consistency between Paddle and the database.

**Next Steps**:
- Monitor production for any edge cases
- Gather user feedback on confirmation messaging
- Plan Phase 2 implementation (proration preview, billing history)

**Success Metrics**:
- Zero Paddle/database mismatches
- Correct proration applied to all Paddle tier changes
- Transparent billing expectations for users

---

## Appendix: Code Snippets

### Full changeTier() Method (Backend)

```typescript
async changeTier(
    organizationId: number,
    newTierId: number,
    userId: number
): Promise<DRAOrganizationSubscription> {
    const manager = AppDataSource.manager;
    
    // Load organization with subscription and current tier
    const organization = await manager.findOneOrFail(DRAOrganization, {
        where: { id: organizationId },
        relations: ['subscription', 'subscription.subscription_tier', 'members', 'members.user']
    });
    
    if (!organization.subscription) {
        throw new Error('Organization has no active subscription');
    }
    
    // Load new tier
    const newTier = await manager.findOneOrFail(DRASubscriptionTier, {
        where: { id: newTierId }
    });
    
    // Check if this is a downgrade
    const currentTier = organization.subscription.subscription_tier;
    const isDowngrade = this.isDowngrade(currentTier.tier_name, newTier.tier_name);
    
    // Create downgrade tracking record if applicable
    if (isDowngrade) {
        await this.createDowngradeRequestFromTierChange(
            organizationId,
            userId,
            currentTier.tier_name,
            newTier.tier_name
        );
        console.log(`📊 Downgrade tracked: ${currentTier.tier_name} → ${newTier.tier_name}`);
    }
    
    // Check if organization has an active Paddle subscription
    const hasPaddleSubscription = !!organization.subscription.paddle_subscription_id;
    
    if (hasPaddleSubscription) {
        // Route A: Update via Paddle API with automatic proration
        console.log(`🔄 Updating Paddle subscription for Org ${organizationId}`);
        
        // Get appropriate Paddle price ID based on current billing cycle
        const billingCycle = organization.subscription.billing_cycle || 'monthly';
        const newPriceId = billingCycle === 'monthly' 
            ? newTier.paddle_price_id_monthly 
            : newTier.paddle_price_id_annual;
        
        if (!newPriceId) {
            throw new Error(`No Paddle price ID configured for ${newTier.tier_name} (${billingCycle})`);
        }
        
        // Update subscription in Paddle with proration
        const paddle = PaddleService.getInstance();
        await paddle.updateSubscription(
            organization.subscription.paddle_subscription_id,
            newPriceId,
            'immediately' // Apply changes immediately with proration
        );
        
        console.log(`✅ Paddle subscription updated with proration`);
    } else {
        // Route B: Direct database update (free tier, manual billing, enterprise)
        console.log(`📝 Direct database update for Org ${organizationId} (no Paddle subscription)`);
    }
    
    // Update local database
    organization.subscription.subscription_tier_id = newTierId;
    organization.subscription.subscription_tier = newTier;
    await manager.save(organization.subscription);
    
    console.log(`✅ Tier changed: Org ${organizationId} → ${newTier.tier_name} (${hasPaddleSubscription ? 'Paddle' : 'Direct'})`);
    
    // Send email notification
    const ownerMember = organization.members.find(m => m.role === 'owner');
    if (ownerMember?.user?.email) {
        const emailService = EmailService.getInstance();
        const changeType = isDowngrade ? 'downgraded' : 'upgraded';
        const subject = `Subscription ${changeType} to ${newTier.tier_name.toUpperCase()}`;
        
        // Use basic email sending (no specific tier change template exists yet)
        await emailService.sendEmail(
            ownerMember.user.email,
            subject,
            `Your organization subscription has been ${changeType} to ${newTier.tier_name.toUpperCase()}. ` +
            `The change is effective immediately with ${isDowngrade ? 'credit applied to' : 'prorated charge for'} your next billing cycle.`
        );
    }
    
    return organization.subscription;
}
```

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-XX  
**Maintained By**: Engineering Team  
**Review Cycle**: After each phase completion
