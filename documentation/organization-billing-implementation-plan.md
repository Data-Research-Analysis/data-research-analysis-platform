# Organization Billing Section - Implementation Plan

**Status**: Planning  
**Created**: April 8, 2026  
**Estimated Timeline**: 14 hours  
**Dependencies**: Paddle integration (already complete)

---

## Executive Summary

Build a full-featured billing management interface for organization owners/admins with:
- Complete subscription lifecycle management (upgrade/downgrade/cancel)
- Immediate tier changes with Paddle's automatic proration
- Payment method and invoice management
- Integration with existing downgrade request tracking
- Admin read-only access for platform oversight

---

## Requirements Gathered

### Billing Operations
- **Scope**: Full subscription management (view, upgrade, downgrade, cancel, payment methods, invoices)
- **Paddle Integration**: Already integrated - SDK configured, webhooks active, ready to use
- **Tier Change Flow**: Immediate effect with proration (upgrades and downgrades both apply instantly)
- **Admin Access**: Read-only view (cannot modify subscriptions)
- **Downgrade Integration**: Show active downgrade request status if exists

### Billing Information Display
1. ✅ Current tier and member count
2. ✅ Billing cycle and next payment date
3. ✅ Payment method preview (last 4 digits, expiry)
4. ✅ Invoice history with download links

---

## Existing Infrastructure Audit

### ✅ Already Implemented

**Backend Services**:
- `PaddleService` (`backend/src/services/PaddleService.ts`)
  - Complete SDK wrapper for Paddle.com
  - Methods: `createCheckoutSession()`, `updateSubscription()`, `cancelSubscription()`, `getCustomer()`, `getPortalSessionUrl()`, `getTransactions()`
  - Environment: Supports both sandbox and production

- `SubscriptionProcessor` (`backend/src/processors/SubscriptionProcessor.ts`)
  - Business logic for all subscription operations
  - Methods: `initiateCheckout()`, `handleSuccessfulPayment()`, `cancelSubscription()`, `getBillingPortalUrl()`, `getPaymentHistory()`
  - Email notifications for tier changes

**Database Schema**:
- `dra_organization_subscriptions` table with all Paddle fields:
  - `paddle_subscription_id`, `paddle_customer_id`, `paddle_transaction_id`
  - `paddle_update_url` (for Paddle portal access)
  - `billing_cycle` (monthly/annual)
  - `is_active`, `started_at`, `ends_at`, `cancelled_at`
  - `grace_period_ends_at`, `last_payment_failed_at`

**Backend Routes** (`backend/src/routes/subscription.ts`):
- `POST /subscription/checkout` - Create checkout session
- `POST /subscription/cancel` - Cancel subscription
- `POST /subscription/portal-url` - Generate Paddle billing portal URL
- `GET /subscription/payment-history/:orgId` - Get invoice history
- `GET /subscription/:organizationId` - Get current subscription
- `POST /subscription/check-activation` - Poll for activation after checkout

**Webhook Handling** (`backend/src/routes/paddle-webhook.ts`):
- `subscription.created` - Create subscription record
- `subscription.updated` - Update tier/billing cycle
- `subscription.payment_succeeded` - Clear grace period
- `subscription.payment_failed` - Start grace period
- Stored in `dra_paddle_webhook_events` for audit trail

**Downgrade Request System**:
- `dra_downgrade_requests` table
- Admin panel at `/admin/downgrade-requests`
- User submission via pricing page
- Status tracking: pending → contacted → approved/declined → completed

### ❌ Missing Components

**Backend**:
1. Route: `POST /subscription/change-tier` - Immediate tier changes with proration
2. Route: `GET /subscription/payment-method/:orgId` - Retrieve payment method details
3. Method: `SubscriptionProcessor.changeTier()` - Upgrade/downgrade business logic
4. Method: `SubscriptionProcessor.getPaymentMethod()` - Fetch payment method from Paddle
5. Integration: Link tier changes to downgrade request creation

**Frontend**:
1. Composable: `useOrganizationSubscription.ts` - API wrapper for subscription operations
2. UI Component: Replace "Coming Soon" in billing tab with full interface
3. Modals: Tier change confirmation, cancellation confirmation
4. Integration: Show active downgrade request in billing section

---

## Architecture Overview

### Data Flow Diagram

```
Frontend                  Backend                    Paddle API
   │                         │                           │
   ├─ Load Billing Tab       │                           │
   │  GET /subscription/:orgId                           │
   │  ◄─────────────────────►│                           │
   │                         │                           │
   ├─ Upgrade/Downgrade      │                           │
   │  POST /subscription/change-tier                     │
   │  ◄─────────────────────►│                           │
   │                         ├─ updateSubscription()     │
   │                         ├───────────────────────────►│
   │                         │  (prorated_immediately)   │
   │                         │◄───────────────────────────│
   │                         ├─ Update DB subscription   │
   │  ◄─────────────────────►│                           │
   │                         │                           │
   ├─ Cancel Subscription    │                           │
   │  POST /subscription/cancel                          │
   │  ◄─────────────────────►│                           │
   │                         ├─ cancelSubscription()     │
   │                         ├───────────────────────────►│
   │                         │  (next_billing_period)    │
   │                         │◄───────────────────────────│
   │                         ├─ Set cancelled_at         │
   │  ◄─────────────────────►│                           │
   │                         │                           │
   ├─ Update Payment Method  │                           │
   │  POST /subscription/portal-url                      │
   │  ◄─────────────────────►│                           │
   │                         ├─ getPortalSessionUrl()    │
   │                         ├───────────────────────────►│
   │  ◄─────────────────────►│                           │
   │  window.location = url  │                           │
   │  ──────────────────────────────────────────────────►│
   │                         │                           │
   ├─ View Invoices          │                           │
   │  GET /subscription/payment-history/:orgId           │
   │  ◄─────────────────────►│                           │
   │                         ├─ getPaymentHistory()      │
   │                         ├───────────────────────────►│
   │  ◄─────────────────────►│                           │
```

### Permission Model

| Role | View Billing | Change Tier | Update Payment | Cancel | View Invoices |
|------|--------------|-------------|----------------|--------|---------------|
| **Organization Owner** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Organization Admin** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Organization Member** | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Platform Admin** | ✅ (read-only) | ❌ | ❌ | ❌ | ✅ |

**Enforcement**: 
- Organization context middleware checks membership
- Route handlers verify `owner` or `admin` role
- Platform admins bypass membership check but cannot modify

---

## Implementation Tasks

### Phase 1: Backend Enhancements (2-3 hours)

#### Task 1.1: Add Tier Change Endpoint

**File**: `backend/src/routes/subscription.ts`

```typescript
/**
 * POST /subscription/change-tier
 * Immediately change subscription tier with prorated billing
 * 
 * Body:
 * - organizationId: number (required)
 * - newTierId: number (required)
 * 
 * Auth: validateJWT + organizationContext
 * Permission: Owner or Admin
 * 
 * Returns: Updated subscription object
 */
router.post('/change-tier', validateJWT, organizationContext, async (req, res) => {
    const { organizationId, newTierId } = req.body;
    const userId = req.tokenDetails.user_id;
    
    // Verify owner/admin role (set by organizationContext middleware)
    if (req.organizationRole !== 'owner' && req.organizationRole !== 'admin') {
        return res.status(403).json({ 
            success: false,
            error: 'Only owners and admins can change subscription tier' 
        });
    }
    
    try {
        // Call processor
        const subscription = await SubscriptionProcessor.getInstance()
            .changeTier(organizationId, newTierId, userId);
        
        res.json({ 
            success: true, 
            data: subscription 
        });
    } catch (error: any) {
        console.error('Tier change error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to change subscription tier'
        });
    }
});
```

**Validation**:
- `organizationId`: Integer, required
- `newTierId`: Integer, required, must exist in `dra_subscription_tiers`
- Cannot change to same tier (frontend validation)

---

#### Task 1.2: Add Change Tier Method to SubscriptionProcessor

**File**: `backend/src/processors/SubscriptionProcessor.ts`

```typescript
/**
 * Change organization subscription tier (upgrade or downgrade)
 * 
 * Flow:
 * 1. Validate current subscription exists
 * 2. Check if downgrade - if so, create downgrade request for tracking
 * 3. Get appropriate Paddle price ID based on billing cycle
 * 4. Call Paddle API to update subscription (prorated immediately)
 * 5. Update local database with new tier
 * 6. Send email notification
 * 
 * @param organizationId - Organization ID
 * @param newTierId - Target subscription tier ID
 * @param userId - User initiating the change
 * @returns Updated subscription object
 */
async changeTier(
    organizationId: number,
    newTierId: number,
    userId: number
): Promise<DRAOrganizationSubscription> {
    const manager = AppDataSource.manager;
    
    // Get organization with current subscription
    const org = await manager.findOneOrFail(DRAOrganization, {
        where: { id: organizationId },
        relations: ['subscription', 'subscription.subscription_tier']
    });
    
    if (!org.subscription) {
        throw new Error('Organization does not have an active subscription');
    }
    
    const currentTier = org.subscription.subscription_tier;
    const newTier = await manager.findOneOrFail(DRASubscriptionTier, { 
        where: { id: newTierId } 
    });
    
    if (currentTier.id === newTier.id) {
        throw new Error('Already subscribed to this tier');
    }
    
    // Check if downgrade - if so, create downgrade request for tracking
    const isDowngrade = this.isDowngrade(currentTier.tier_name, newTier.tier_name);
    
    if (isDowngrade) {
        // Create downgrade request record for admin tracking
        await this.createDowngradeRequestFromTierChange(
            organizationId, 
            userId, 
            currentTier.tier_name, 
            newTier.tier_name
        );
        
        console.log(`📊 Downgrade request created: ${currentTier.tier_name} → ${newTier.tier_name}`);
    }
    
    // Get appropriate Paddle price ID based on current billing cycle
    const priceId = org.subscription.billing_cycle === 'monthly'
        ? newTier.paddle_price_id_monthly
        : newTier.paddle_price_id_annual;
    
    if (!priceId) {
        throw new Error(`Price ID not configured for ${newTier.tier_name} (${org.subscription.billing_cycle})`);
    }
    
    // Update subscription in Paddle (prorated immediately)
    const paddle = PaddleService.getInstance();
    const paddleSubscription = await paddle.updateSubscription(
        org.subscription.paddle_subscription_id!,
        priceId
    );
    
    // Update local database
    org.subscription.subscription_tier_id = newTierId;
    org.subscription.paddle_subscription_id = paddleSubscription.id;
    await manager.save(org.subscription);
    
    // Send email notification
    const emailService = EmailService.getInstance();
    await emailService.sendTierChangeConfirmation(
        org,
        currentTier,
        newTier,
        isDowngrade
    );
    
    console.log(`✅ Subscription tier changed: ${currentTier.tier_name} → ${newTier.tier_name}`);
    
    return org.subscription;
}

/**
 * Determine if tier change is a downgrade
 * 
 * @param currentTier - Current tier name (e.g., 'professional')
 * @param newTier - New tier name
 * @returns true if downgrade, false if upgrade
 */
private isDowngrade(currentTier: string, newTier: string): boolean {
    const ranking = ['free', 'starter', 'professional', 'professional_plus', 'enterprise'];
    const currentIndex = ranking.indexOf(currentTier.toLowerCase());
    const newIndex = ranking.indexOf(newTier.toLowerCase());
    
    if (currentIndex === -1 || newIndex === -1) {
        throw new Error('Invalid tier name');
    }
    
    return newIndex < currentIndex;
}

/**
 * Create downgrade request when user downgrades via billing section
 * 
 * This links the billing system with the downgrade request tracking system.
 * Admins can see these requests in /admin/downgrade-requests.
 * 
 * @param organizationId - Organization ID
 * @param userId - User ID
 * @param currentTier - Current tier name
 * @param newTier - Target tier name
 */
private async createDowngradeRequestFromTierChange(
    organizationId: number,
    userId: number,
    currentTier: string,
    newTier: string
): Promise<void> {
    const manager = AppDataSource.manager;
    
    const { DRADowngradeRequest } = await import('../models/DRADowngradeRequest.js');
    
    const request = manager.create(DRADowngradeRequest, {
        user_id: userId,
        organization_id: organizationId,
        current_tier: currentTier.toUpperCase(),
        requested_tier: newTier.toUpperCase(),
        reason: 'Tier change via billing section',
        message: 'User initiated tier change through organization billing settings',
        status: 'completed' // Mark as completed since change is immediate
    });
    
    await manager.save(request);
}
```

**Error Handling**:
- Organization not found → 404
- Subscription not active → 400
- Paddle API failure → 500 (retry with exponential backoff)
- Same tier selected → 400

---

#### Task 1.3: Add Payment Method Retrieval Endpoint

**File**: `backend/src/routes/subscription.ts`

```typescript
/**
 * GET /subscription/payment-method/:organizationId
 * Get current payment method details from Paddle
 * 
 * Auth: validateJWT + organizationContext
 * Permission: Owner, Admin, or Platform Admin (read-only)
 * 
 * Returns: { type, last4, expiryMonth, expiryYear, brand }
 */
router.get('/payment-method/:organizationId', validateJWT, 
    organizationContext, async (req, res) => {
    try {
        const orgId = parseInt(req.params.organizationId);
        
        if (isNaN(orgId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid organization ID'
            });
        }
        
        const paymentMethod = await SubscriptionProcessor.getInstance()
            .getPaymentMethod(orgId);
        
        res.json({ 
            success: true, 
            data: paymentMethod 
        });
    } catch (error: any) {
        console.error('Get payment method error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to retrieve payment method'
        });
    }
});
```

**File**: `backend/src/processors/SubscriptionProcessor.ts`

```typescript
/**
 * Get payment method details from Paddle
 * 
 * Retrieves customer payment method information for display purposes.
 * Does NOT expose full card number for PCI compliance.
 * 
 * @param organizationId - Organization ID
 * @returns Payment method details or null if none on file
 */
async getPaymentMethod(organizationId: number): Promise<{
    type: string;
    last4?: string;
    expiryMonth?: number;
    expiryYear?: number;
    brand?: string;
} | null> {
    const manager = AppDataSource.manager;
    
    const org = await manager.findOneOrFail(DRAOrganization, {
        where: { id: organizationId },
        relations: ['subscription']
    });
    
    if (!org.subscription?.paddle_customer_id) {
        return null;
    }
    
    const paddle = PaddleService.getInstance();
    const customer = await paddle.getCustomer(org.subscription.paddle_customer_id);
    
    // Extract payment method from Paddle customer object
    const paymentMethod = customer.payment_method;
    
    if (!paymentMethod) {
        return null;
    }
    
    return {
        type: paymentMethod.type || 'card',
        last4: paymentMethod.card?.last4,
        expiryMonth: paymentMethod.card?.expiry_month,
        expiryYear: paymentMethod.card?.expiry_year,
        brand: paymentMethod.card?.brand || 'Unknown'
    };
}
```

**PCI Compliance**: 
- Never store full card numbers
- Only display last 4 digits
- All payment data stays in Paddle

---

#### Task 1.4: Add Downgrade Request Lookup Endpoint

**File**: `backend/src/routes/subscription.ts`

```typescript
/**
 * GET /subscription/downgrade-requests/:organizationId
 * Get active downgrade requests for organization
 * 
 * Returns only pending/contacted requests for billing section display
 */
router.get('/downgrade-requests/:organizationId', validateJWT, 
    organizationContext, async (req, res) => {
    try {
        const orgId = parseInt(req.params.organizationId);
        const manager = AppDataSource.manager;
        
        const { DRADowngradeRequest } = await import('../models/DRADowngradeRequest.js');
        
        const requests = await manager.find(DRADowngradeRequest, {
            where: { 
                organization_id: orgId,
                status: In(['pending', 'contacted'])
            },
            order: { created_at: 'DESC' }
        });
        
        res.json({ success: true, data: requests });
    } catch (error: any) {
        console.error('Get downgrade requests error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
```

---

### Phase 2: Frontend UI Components (4-5 hours)

#### Task 2.1: Create Subscription Composable

**File**: `frontend/composables/useOrganizationSubscription.ts`

```typescript
/**
 * Organization Subscription Composable
 * 
 * Provides methods for managing organization billing and subscriptions.
 * All methods require authentication and organization membership.
 * 
 * Usage:
 * ```typescript
 * const subscriptionAPI = useOrganizationSubscription();
 * const subscription = await subscriptionAPI.getSubscription(orgId);
 * await subscriptionAPI.changeTier(orgId, newTierId);
 * ```
 */
export const useOrganizationSubscription = () => {
    const config = useRuntimeConfig();
    
    /**
     * Generate authentication headers
     */
    const authHeaders = () => {
        const token = getAuthToken();
        if (!token) throw new Error('Authentication required');
        return {
            'Authorization': `Bearer ${token}`,
            'Authorization-Type': 'auth',
            'Content-Type': 'application/json'
        };
    };
    
    /**
     * Get organization subscription details
     * 
     * @param organizationId - Organization ID
     * @returns Subscription object with tier information
     */
    const getSubscription = async (organizationId: number) => {
        return await $fetch(`${config.public.apiBase}/subscription/${organizationId}`, {
            headers: authHeaders()
        });
    };
    
    /**
     * Get payment history (invoices)
     * 
     * @param organizationId - Organization ID
     * @returns Array of transactions/invoices
     */
    const getPaymentHistory = async (organizationId: number) => {
        return await $fetch(`${config.public.apiBase}/subscription/payment-history/${organizationId}`, {
            headers: authHeaders()
        });
    };
    
    /**
     * Get payment method on file
     * 
     * @param organizationId - Organization ID
     * @returns Payment method details (last4, expiry, brand)
     */
    const getPaymentMethod = async (organizationId: number) => {
        return await $fetch(`${config.public.apiBase}/subscription/payment-method/${organizationId}`, {
            headers: authHeaders()
        });
    };
    
    /**
     * Change subscription tier (upgrade or downgrade)
     * 
     * Triggers immediate proration via Paddle.
     * 
     * @param organizationId - Organization ID
     * @param newTierId - Target subscription tier ID
     * @returns Updated subscription
     */
    const changeTier = async (organizationId: number, newTierId: number) => {
        return await $fetch(`${config.public.apiBase}/subscription/change-tier`, {
            method: 'POST',
            headers: authHeaders(),
            body: { organizationId, newTierId }
        });
    };
    
    /**
     * Cancel subscription
     * 
     * Access continues until end of billing period.
     * 
     * @param organizationId - Organization ID
     * @param reason - Optional cancellation reason
     * @returns Updated subscription
     */
    const cancelSubscription = async (organizationId: number, reason?: string) => {
        return await $fetch(`${config.public.apiBase}/subscription/cancel`, {
            method: 'POST',
            headers: authHeaders(),
            body: { organizationId, reason }
        });
    };
    
    /**
     * Generate Paddle billing portal URL
     * 
     * For updating payment method, viewing invoices, etc.
     * 
     * @param organizationId - Organization ID
     * @returns { url: string }
     */
    const getPortalUrl = async (organizationId: number) => {
        return await $fetch(`${config.public.apiBase}/subscription/portal-url`, {
            method: 'POST',
            headers: authHeaders(),
            body: { organizationId }
        });
    };
    
    /**
     * Get active downgrade requests for organization
     * 
     * @param organizationId - Organization ID
     * @returns Array of downgrade requests
     */
    const getDowngradeRequests = async (organizationId: number) => {
        return await $fetch(`${config.public.apiBase}/subscription/downgrade-requests/${organizationId}`, {
            headers: authHeaders()
        });
    };
    
    /**
     * Format billing cycle for display
     */
    const formatBillingCycle = (cycle: string): string => {
        return cycle === 'monthly' ? 'Monthly' : 'Annual';
    };
    
    /**
     * Format currency for display
     */
    const formatCurrency = (amount: number): string => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    };
    
    return {
        getSubscription,
        getPaymentHistory,
        getPaymentMethod,
        changeTier,
        cancelSubscription,
        getPortalUrl,
        getDowngradeRequests,
        formatBillingCycle,
        formatCurrency
    };
};
```

**Auto-Import**: Nuxt automatically imports composables from `~/composables/`, so this will be available globally without explicit imports.

---

#### Task 2.2: Update Organization Settings Billing Tab

**File**: `frontend/pages/admin/organizations/[orgid]/settings.vue`

Replace the "Coming Soon" section in the billing tab with the full UI implementation. See detailed UI code in the next section.

**Key Features**:
1. Current plan card with tier name, billing cycle, member count
2. Read-only banner for platform admins
3. Active downgrade request notice (if exists)
4. Payment method card with "Update Payment Method" button
5. Tier selection grid (3 columns: FREE, STARTER, PROFESSIONAL, etc.)
6. Invoice history table with download links
7. Cancel subscription button + confirmation modal

**State Management**:
```typescript
const state = reactive({
    subscription: null as any,
    paymentMethod: null as any,
    availableTiers: [] as any[],
    invoices: [] as any[],
    activeDowngradeRequest: null as any,
    showCancelModal: false,
    cancelReason: '',
    loading: {
        subscription: false,
        portalUrl: false,
        cancel: false,
        tierChange: false
    }
});
```

**Computed Properties**:
```typescript
const canManageBilling = computed(() => {
    // Only owners and admins can manage, and NOT platform admins viewing other orgs
    if (isUserAdmin.value && !isOwnerOrAdmin.value) return false;
    return isOwnerOrAdmin.value;
});

const isUserAdmin = computed(() => {
    return loggedInUser.value?.user_type === 'admin';
});
```

**Methods**:
- `loadBillingData()` - Fetch subscription, payment method, tiers, invoices, downgrade requests
- `selectTier(tier)` - Open confirmation modal, change tier
- `getTierChangeAction(tier)` - Return "Upgrade" or "Downgrade"
- `openBillingPortal()` - Redirect to Paddle portal
- `confirmCancel()` - Cancel subscription with reason

---

#### Task 2.3: UI Components Detail

See the full Vue template code in the planning document above. Key sections:

1. **Read-Only Banner** (for platform admins):
```vue
<div v-if="isUserAdmin && !isOwnerOrAdmin" class="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
    <p class="text-sm font-medium text-blue-900">Admin View Only</p>
    <p class="text-sm text-blue-700">You cannot modify subscription details.</p>
</div>
```

2. **Current Plan Card**:
- Gradient background (blue to indigo)
- Tier name in large text
- Billing cycle
- Member usage (5/10)
- Next billing date
- Cancellation notice (if cancelled)

3. **Downgrade Request Notice**:
- Orange theme (matches downgrade color scheme)
- Shows requested tier and status
- Submission date

4. **Payment Method Card**:
- Card icon
- Brand and last 4 digits
- Expiry date
- "Update Payment Method" button → opens Paddle portal

5. **Tier Selection Grid**:
- 3 columns for tiers
- Current tier has blue border and "Current Plan" badge
- Other tiers show upgrade/downgrade button
- Clicking opens confirmation modal with prorated pricing details

6. **Invoice History Table**:
- Date, description, status badge, amount, download button
- Empty state with inbox icon

7. **Cancel Modal**:
- Warning banner (yellow)
- Reason dropdown (optional)
- "Keep Subscription" vs "Confirm Cancellation" buttons

---

### Phase 3: Testing (2-3 hours)

#### Unit Tests

**Backend** (`backend/src/tests/processors/SubscriptionProcessor.test.ts`):
```typescript
describe('SubscriptionProcessor', () => {
    describe('isDowngrade', () => {
        it('detects upgrade correctly', () => {
            const result = processor['isDowngrade']('free', 'professional');
            expect(result).toBe(false);
        });
        
        it('detects downgrade correctly', () => {
            const result = processor['isDowngrade']('professional', 'starter');
            expect(result).toBe(true);
        });
    });
    
    describe('changeTier', () => {
        it('creates downgrade request when downgrading', async () => {
            // Setup: org with PROFESSIONAL tier
            // Execute: changeTier to STARTER
            // Assert: downgrade request created with status 'completed'
        });
        
        it('calls Paddle API with correct price ID', async () => {
            // Mock PaddleService.updateSubscription
            // Verify called with annual price ID if billing_cycle = 'annual'
        });
    });
});
```

**Frontend** (`frontend/tests/composables/useOrganizationSubscription.test.ts`):
```typescript
describe('useOrganizationSubscription', () => {
    it('formats billing cycle correctly', () => {
        const { formatBillingCycle } = useOrganizationSubscription();
        expect(formatBillingCycle('monthly')).toBe('Monthly');
        expect(formatBillingCycle('annual')).toBe('Annual');
    });
    
    it('formats currency correctly', () => {
        const { formatCurrency } = useOrganizationSubscription();
        expect(formatCurrency(49.99)).toBe('$49.99');
        expect(formatCurrency(499)).toBe('$499.00');
    });
});
```

---

#### Integration Tests

**Tier Change Flow**:
```typescript
describe('Tier Change Integration', () => {
    it('upgrades from FREE to PROFESSIONAL with proration', async () => {
        // 1. Create organization with FREE tier
        // 2. POST /subscription/change-tier (tierId = PROFESSIONAL)
        // 3. Verify Paddle API called with professional_annual price ID
        // 4. Verify database updated with new tier
        // 5. Verify email sent
    });
    
    it('downgrades create downgrade request record', async () => {
        // 1. Create organization with PROFESSIONAL tier
        // 2. POST /subscription/change-tier (tierId = STARTER)
        // 3. Verify downgrade request created with status 'completed'
        // 4. Verify visible in /admin/downgrade-requests
    });
});
```

**Payment Method Retrieval**:
```typescript
describe('Payment Method API', () => {
    it('returns payment method when customer has card on file', async () => {
        // Mock Paddle customer with payment_method
        // GET /subscription/payment-method/1
        // Verify returns { type, last4, expiryMonth, expiryYear, brand }
    });
    
    it('returns null when no payment method on file', async () => {
        // Mock Paddle customer without payment_method
        // Verify returns null (not 404)
    });
});
```

**Admin Access Control**:
```typescript
describe('Admin Read-Only Access', () => {
    it('platform admin can view billing', async () => {
        // Login as admin user
        // GET /subscription/123
        // Verify 200 OK (not 403)
    });
    
    it('platform admin cannot change tier', async () => {
        // Login as admin user
        // POST /subscription/change-tier
        // Verify 403 Forbidden (middleware blocks based on organizationRole)
    });
});
```

---

#### E2E Tests (Playwright)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Organization Billing', () => {
    test.beforeEach(async ({ page }) => {
        // Login as organization owner
        await page.goto('/login');
        await page.fill('[name="email"]', 'owner@test.com');
        await page.fill('[name="password"]', 'password');
        await page.click('button[type="submit"]');
        
        // Navigate to organization settings
        await page.goto('/admin/organizations/1/settings');
        await page.click('button:has-text("Billing")');
    });
    
    test('displays current plan correctly', async ({ page }) => {
        await expect(page.locator('h3:has-text("FREE")')).toBeVisible();
        await expect(page.locator('text=Monthly billing')).toBeVisible();
    });
    
    test('upgrade flow shows confirmation modal', async ({ page }) => {
        await page.click('button:has-text("Upgrade") >> nth=0');
        
        // Verify modal opened
        await expect(page.locator('.swal2-container')).toBeVisible();
        await expect(page.locator('.swal2-title:has-text("Upgrade")')).toBeVisible();
        
        // Verify prorated pricing shown
        await expect(page.locator('text=/New monthly price/')).toBeVisible();
    });
    
    test('payment method update opens Paddle portal', async ({ page }) => {
        await page.click('button:has-text("Update Payment Method")');
        
        // Verify redirect to Paddle (check URL contains paddle)
        await page.waitForURL(/paddle\.com/);
    });
    
    test('invoice history displays correctly', async ({ page }) => {
        // Assuming organization has invoices
        await expect(page.locator('table').first()).toBeVisible();
        await expect(page.locator('text=/Invoice/')).toBeVisible();
    });
    
    test('cancel subscription shows warning', async ({ page }) => {
        await page.click('button:has-text("Cancel Subscription")');
        
        // Verify warning shown
        await expect(page.locator('.swal2-container')).toBeVisible();
        await expect(page.locator('text=/will remain active until/')).toBeVisible();
    });
    
    test('platform admin sees read-only banner', async ({ page }) => {
        // Logout and login as admin
        await page.goto('/logout');
        await page.goto('/login');
        await page.fill('[name="email"]', 'admin@dataresearchanalysis.com');
        await page.fill('[name="password"]', 'admin');
        await page.click('button[type="submit"]');
        
        await page.goto('/admin/organizations/1/settings');
        await page.click('button:has-text("Billing")');
        
        // Verify read-only banner
        await expect(page.locator('text=/Admin View Only/')).toBeVisible();
        
        // Verify upgrade buttons disabled/hidden
        await expect(page.locator('button:has-text("Upgrade")')).toHaveCount(0);
    });
});
```

---

## Migration & Rollout

### Database Changes

✅ **No new tables required** - All schema already exists:
- `dra_organization_subscriptions` (has all Paddle fields)
- `dra_subscription_tiers` (configured with Paddle price IDs)
- `dra_paddle_webhook_events` (webhook audit trail)
- `dra_downgrade_requests` (tracking system)

### Environment Variables

```bash
# Already configured - verify values:
PADDLE_API_KEY=pdl_test_xxx
PADDLE_ENVIRONMENT=sandbox  # or 'production'

# Frontend already has:
NUXT_API_URL=http://backend.dataresearchanalysis.test:3002
```

**Production Checklist**:
1. Update `PADDLE_ENVIRONMENT` to `production`
2. Use production Paddle API key
3. Update Paddle price IDs in `dra_subscription_tiers` table
4. Configure webhook URL in Paddle dashboard: `https://api.yourdomain.com/paddle/webhook`

---

### Feature Flag (Optional)

If you want to enable billing section gradually:

**File**: `frontend/constants/featureFlags.ts`
```typescript
export const FEATURE_FLAGS = {
    ORGANIZATION_BILLING_ENABLED: true,  // Set to false to hide billing tab
    // ... other flags
} as const;
```

**Usage** in settings page:
```typescript
const tabs = computed(() => [
    { id: 'general', name: 'General', icon: ['fas', 'cog'] },
    { id: 'members', name: 'Members', icon: ['fas', 'users'] },
    ...(FEATURE_FLAGS.ORGANIZATION_BILLING_ENABLED 
        ? [{ id: 'billing', name: 'Billing', icon: ['fas', 'credit-card'] }] 
        : []
    ),
    { id: 'danger', name: 'Danger Zone', icon: ['fas', 'exclamation-triangle'] }
]);
```

---

### Deployment Steps

1. **Deploy Backend First** (zero downtime):
   - New routes are additive, no breaking changes
   - Deploy `SubscriptionProcessor.changeTier()` method
   - Deploy `/subscription/change-tier` route
   - Deploy `/subscription/payment-method/:orgId` route

2. **Database Verification**:
   ```sql
   -- Verify tables exist
   SELECT COUNT(*) FROM dra_organization_subscriptions;
   SELECT COUNT(*) FROM dra_subscription_tiers WHERE paddle_price_id_monthly IS NOT NULL;
   SELECT COUNT(*) FROM dra_downgrade_requests;
   
   -- Verify Paddle IDs configured
   SELECT tier_name, paddle_price_id_monthly, paddle_price_id_annual 
   FROM dra_subscription_tiers;
   ```

3. **Deploy Frontend**:
   - Deploy composable `useOrganizationSubscription.ts`
   - Deploy updated settings page with billing tab UI
   - UI is hidden until user clicks "Billing" tab (no impact on existing users)

4. **Monitor Paddle Webhooks** (24-48 hours):
   ```sql
   -- Monitor webhook events
   SELECT event_type, created_at, processed, error_message
   FROM dra_paddle_webhook_events
   ORDER BY created_at DESC
   LIMIT 50;
   
   -- Check for failed events
   SELECT * FROM dra_paddle_webhook_events 
   WHERE processed = FALSE 
   ORDER BY created_at DESC;
   ```

5. **Enable for Production Organizations**:
   - Start with internal team organization
   - Monitor tier changes for 1 week
   - Gradually roll out to all organizations

---

### Rollback Plan

If critical issues occur:

1. **Frontend Rollback** (instant):
   - Set `ORGANIZATION_BILLING_ENABLED` feature flag to `false`
   - Redeploy frontend
   - Billing tab disappears, no functionality lost

2. **Backend Rollback** (< 5 minutes):
   - Revert to previous backend version
   - New routes will return 404 (frontend handles gracefully)
   - Existing subscriptions continue working via webhooks

3. **Data Integrity**:
   - All tier changes stored in `dra_organization_subscriptions`
   - Downgrade requests preserved in `dra_downgrade_requests`
   - Paddle webhook events logged for audit

---

## Success Metrics

### Adoption Metrics
- **Billing Tab Views**: % of org owners/admins who view billing tab within 7 days
  - Target: >60% of active organizations
  - Measurement: Track page view events

- **Tier Changes**: Number of tier changes per month
  - Target: 10-15% of organizations change tier within first 30 days
  - Breakdown: Upgrades vs downgrades

### Engagement Metrics
- **Payment Method Updates**: % of orgs that update payment method
  - Indicates trust in self-service billing portal
  - Target: >5% per month

- **Invoice Downloads**: % of orgs that download invoices
  - Indicates billing transparency and trust
  - Target: >20% download at least one invoice

### Conversion Metrics
- **Upgrade Rate**: % of FREE→Paid tier conversions
  - Baseline: Current conversion rate
  - Target: +15% increase with easier upgrade flow

- **Downgrade Prevention**: % of downgrade requests that convert to upgrades
  - Measure via admin panel follow-up
  - Target: 10-15% retention rate

### Technical Metrics
- **Paddle API Response Time**: p95 latency for tier changes
  - Target: <2 seconds
  - Alert if >5 seconds

- **Error Rate**: Failed tier changes / total attempts
  - Target: <0.5%
  - Alert if >2%

- **Webhook Processing**: Webhook success rate
  - Target: >99.5%
  - Alert if <99%

### Revenue Metrics
- **MRR Impact**: Monthly Recurring Revenue change from tier changes
  - Track net MRR gained from upgrades
  - Track MRR lost from downgrades
  - Target: Net positive MRR growth

- **ARPU (Average Revenue Per User)**: Change in ARPU after billing section launch
  - Target: +10% increase in 90 days

---

## Future Enhancements (Post-MVP)

### Phase 4: Automation (1-2 weeks)

1. **Auto-Downgrade Processing**
   - Cron job runs daily
   - Auto-approve downgrades after 24 hours (configurable)
   - Send notification email to user
   - Execute tier change via Paddle API

2. **Usage Alerts**
   - Email notifications when approaching tier limits:
     - 80% of project limit reached
     - 90% of member limit reached
     - 95% of data model row limit reached
   - Suggest upgrade to next tier

3. **Billing Anomaly Detection**
   - Monitor for unusual tier change patterns
   - Flag potential subscription abuse
   - Auto-escalate to admin review

---

### Phase 5: Revenue Optimization (2-3 weeks)

1. **Annual Discount Promotion**
   - Banner in billing section: "Save 20% with annual billing"
   - One-click switch to annual (prorated)
   - A/B test discount percentages

2. **Smart Tier Recommendations**
   - Analyze usage patterns (projects, members, data volume)
   - Suggest optimal tier for user's workload
   - "You're using 95% of PROFESSIONAL features - upgrade to PROFESSIONAL_PLUS?"

3. **Winback Campaigns**
   - Detect downgrades to FREE tier
   - Email campaign with limited-time discount
   - Track conversion rate

---

### Phase 6: Advanced Features (3-4 weeks)

1. **Team Billing (Multi-Workspace)**
   - Separate billing per workspace within organization
   - Workspace owners can manage their own subscription
   - Organization owner sees consolidated billing

2. **Invoice Customization**
   - Add organization logo to Paddle invoices
   - Custom VAT/Tax ID fields
   - Multi-currency support

3. **Spending Insights Dashboard**
   - Chart: Historical spending over time
   - Breakdown: Cost per workspace/project
   - Forecast: Projected spend based on usage trends
   - Export to CSV for accounting

4. **Payment Method Preferences**
   - Support for multiple payment methods
   - Backup payment method for failed charges
   - Preferred currency selection

5. **Subscription Pausing**
   - Pause subscription for 1-3 months (e.g., seasonal businesses)
   - Reduced "pause fee" to maintain account
   - Auto-resume after pause period

---

## Estimated Timeline

| Phase | Tasks | Hours | Dependencies |
|-------|-------|-------|--------------|
| **Phase 1: Backend** | | | |
| 1.1 | Tier change endpoint | 0.5 | None |
| 1.2 | SubscriptionProcessor.changeTier() | 1.5 | Paddle SDK, DRADowngradeRequest |
| 1.3 | Payment method endpoint | 0.5 | Paddle SDK |
| 1.4 | Downgrade request lookup | 0.5 | DRADowngradeRequest |
| **Subtotal** | | **3 hours** | |
| | | | |
| **Phase 2: Frontend** | | | |
| 2.1 | useOrganizationSubscription composable | 1 | Auth composable |
| 2.2 | Billing tab UI skeleton | 1 | Tailwind components |
| 2.3 | Tier selection grid | 1 | SweetAlert2 |
| 2.4 | Payment method card | 0.5 | Font Awesome icons |
| 2.5 | Invoice history table | 0.5 | Date formatting |
| 2.6 | Cancel modal | 0.5 | SweetAlert2 |
| 2.7 | Integration & polish | 0.5 | All above |
| **Subtotal** | | **5 hours** | |
| | | | |
| **Phase 3: Testing** | | | |
| 3.1 | Unit tests (backend) | 1 | Jest |
| 3.2 | Integration tests | 1 | Supertest |
| 3.3 | E2E tests | 1 | Playwright |
| **Subtotal** | | **3 hours** | |
| | | | |
| **Phase 4: QA & Polish** | | | |
| 4.1 | Bug fixes from testing | 1 | Test results |
| 4.2 | UX refinements | 0.5 | Design feedback |
| 4.3 | Error handling | 0.5 | Paddle docs |
| **Subtotal** | | **2 hours** | |
| | | | |
| **Phase 5: Documentation** | | | |
| 5.1 | API documentation | 0.5 | Swagger/OpenAPI |
| 5.2 | User guide | 0.5 | Screenshots |
| **Subtotal** | | **1 hour** | |
| | | | |
| **TOTAL** | | **14 hours** | |

---

## Risk Assessment

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Paddle API downtime during tier change | Low | High | Implement retry logic with exponential backoff; show user-friendly error |
| Proration calculation mismatch | Medium | Medium | Use Paddle's built-in proration (don't calculate manually); show preview before confirming |
| Webhook delivery failure | Low | High | Implement webhook retry queue; monitor via `dra_paddle_webhook_events` table |
| Payment method retrieval timeout | Low | Medium | Cache payment method for 1 hour; fallback to "Payment method on file" generic message |
| Concurrent tier changes (race condition) | Very Low | Medium | Use database transaction locks; Paddle handles subscription updates atomically |

### Business Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Users confused by immediate tier changes | Medium | Low | Clear messaging: "Changes apply immediately with proration"; show before/after pricing |
| Increased downgrade rate | Low | High | Track downgrade reasons; A/B test retention offers; follow up via email |
| Support tickets for billing questions | High | Low | Comprehensive FAQ; inline help text; link to Paddle portal for payment issues |
| Revenue loss from easier downgrades | Medium | Medium | Downgrade requests still go through admin for retention opportunities |

---

## Support & Documentation

### User Documentation

Create user guide at `documentation/user-guides/managing-billing.md`:

**Topics**:
1. How to view your current plan
2. How to upgrade your subscription
3. How to downgrade your subscription
4. How to update payment method
5. How to view and download invoices
6. How to cancel your subscription
7. Understanding prorated billing
8. Payment failure grace period
9. Reactivating a cancelled subscription

**Screenshots**: Include screenshots for each major action

---

### Developer Documentation

**API Documentation** (`documentation/api/subscription-endpoints.md`):

```markdown
# Subscription API Endpoints

## POST /subscription/change-tier
Change organization subscription tier with prorated billing.

**Auth**: Required (JWT + organizationContext)
**Permission**: Owner or Admin

**Request Body**:
```json
{
  "organizationId": 123,
  "newTierId": 3
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 456,
    "subscription_tier_id": 3,
    "billing_cycle": "annual",
    "is_active": true,
    "ends_at": "2027-04-08T00:00:00Z"
  }
}
```

**Errors**:
- 400: Invalid tier or same as current
- 403: Insufficient permissions
- 500: Paddle API failure
```

---

### Internal Documentation

**Runbook** (`documentation/runbooks/billing-incidents.md`):

**Scenario 1: Paddle API Timeout**
```bash
# Check Paddle status
curl https://status.paddle.com

# Check recent webhook events
SELECT * FROM dra_paddle_webhook_events 
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

# Retry failed tier change manually
curl -X POST http://backend:3002/subscription/change-tier \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"organizationId": 123, "newTierId": 3}'
```

**Scenario 2: Proration Dispute**
```bash
# Get Paddle transaction details
# Login to Paddle dashboard
# Navigate to Transactions > Search by org email
# Verify proration calculation matches
```

---

## Appendix

### UI Wireframes

*Include screenshots or Figma mockups of:*
1. Current plan card (FREE, STARTER, PROFESSIONAL states)
2. Tier selection grid
3. Payment method card
4. Invoice history table
5. Cancel modal
6. Upgrade confirmation modal
7. Downgrade request notice

---

### API Payload Examples

**Paddle Customer Object**:
```json
{
  "id": "ctm_01h1234567890abcdef",
  "email": "owner@company.com",
  "payment_method": {
    "type": "card",
    "card": {
      "last4": "4242",
      "brand": "visa",
      "expiry_month": 12,
      "expiry_year": 2027
    }
  }
}
```

**Paddle Subscription Object**:
```json
{
  "id": "sub_01h1234567890abcdef",
  "status": "active",
  "billing_cycle": {
    "interval": "year",
    "frequency": 1
  },
  "next_billed_at": "2027-04-08T00:00:00.000Z",
  "items": [
    {
      "price": {
        "id": "pri_01h1234567890abcdef",
        "product_id": "pro_01h1234567890abcdef"
      },
      "quantity": 1
    }
  ]
}
```

---

### Database Schema Reference

**dra_organization_subscriptions**:
```sql
CREATE TABLE dra_organization_subscriptions (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER UNIQUE NOT NULL REFERENCES dra_organizations(id) ON DELETE CASCADE,
    subscription_tier_id INTEGER NOT NULL REFERENCES dra_subscription_tiers(id),
    
    -- Paddle fields
    paddle_subscription_id VARCHAR(100),
    paddle_customer_id VARCHAR(100),
    paddle_transaction_id VARCHAR(100),
    paddle_update_url TEXT,
    
    -- Billing
    billing_cycle VARCHAR(20) DEFAULT 'annual',
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ends_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    
    -- Grace period (failed payment)
    grace_period_ends_at TIMESTAMP,
    last_payment_failed_at TIMESTAMP,
    
    -- Tier enforcement
    max_members INTEGER,
    current_members INTEGER DEFAULT 1
);
```

---

## Conclusion

This implementation plan provides a complete roadmap for building a production-ready organization billing section that:

✅ Leverages existing Paddle integration  
✅ Handles immediate tier changes with proration  
✅ Integrates with downgrade request tracking  
✅ Provides admin oversight with read-only access  
✅ Includes comprehensive testing and documentation  
✅ Follows established architectural patterns  

**Next Steps**:
1. Review and approve this plan
2. Create GitHub issues for each phase
3. Begin Phase 1 (Backend Enhancements)
4. Set up test environment with Paddle sandbox
5. Schedule daily standups during implementation

**Questions? Contact**: Development Team Lead
