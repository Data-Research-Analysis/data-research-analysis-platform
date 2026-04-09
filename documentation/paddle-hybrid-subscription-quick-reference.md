# Paddle Hybrid Subscription - Quick Reference

**Status**: ✅ Phase 1 Complete  
**Critical Fix**: Admin tier changes now respect Paddle subscriptions

---

## 🚨 The Problem We Solved

**Before**: Admin tier changes bypassed Paddle → billing mismatch → wrong charges  
**After**: System detects subscription source and routes correctly

---

## 🔄 How Tier Changes Work Now

```typescript
if (organization has paddle_subscription_id) {
    → Update via Paddle API with proration ✅
} else {
    → Direct database update (free/manual billing) ✅
}

// Always update local database for consistency
```

---

## 📍 Key Files

### Backend
[backend/src/processors/SubscriptionProcessor.ts](../backend/src/processors/SubscriptionProcessor.ts)
- `getPaymentMethod()` — Returns subscription type info
- `changeTier()` — Hybrid routing logic

### Frontend
[frontend/pages/pricing.vue](../frontend/pages/pricing.vue)
- Subscription type detection
- Context-aware confirmation messages
- Billing info banner

---

## 🔍 Detecting Subscription Type

### Backend API
```typescript
GET /subscription/payment-method/:organizationId

Response: {
    type, last4, expiryMonth, expiryYear, brand,
    hasPaddleSubscription: boolean,        // KEY FIELD
    paddleSubscriptionId: string | null,
    billingType: 'paddle' | 'manual' | 'free'
}
```

### Frontend Usage
```typescript
const paymentInfo = await orgSubscription.getPaymentMethod(orgId);
subscriptionType.value = paymentInfo.billingType;
hasPaddleSubscription.value = paymentInfo.hasPaddleSubscription;
```

---

## 🎯 Tier Change Flow

### Route A: Paddle Subscription
```typescript
// Organization has paddle_subscription_id
async changeTier(orgId, newTierId, userId) {
    const hasPaddleSubscription = !!org.subscription.paddle_subscription_id;
    
    if (hasPaddleSubscription) {
        // Get correct price ID for billing cycle
        const billingCycle = org.subscription.billing_cycle; // 'monthly' or 'annual'
        const newPriceId = billingCycle === 'monthly' 
            ? newTier.paddle_price_id_monthly 
            : newTier.paddle_price_id_annual;
        
        // Update in Paddle (with automatic proration)
        await paddle.updateSubscription(
            org.subscription.paddle_subscription_id,
            newPriceId,
            'immediately'
        );
        
        console.log('✅ Paddle subscription updated with proration');
    }
    
    // Always update local database
    org.subscription.tier_id = newTierId;
    await save(org.subscription);
}
```

**What Happens**:
1. Paddle calculates proration
2. Customer charged/credited immediately
3. Paddle sends `subscription.updated` webhook
4. Database updated from webhook
5. Email sent to organization owner

### Route B: Direct Database Update
```typescript
else {
    // Free tier, manual billing, or enterprise
    console.log('📝 Direct database update (no Paddle subscription)');
    
    // Just update database
    org.subscription.tier_id = newTierId;
    await save(org.subscription);
}
```

**What Happens**:
1. Database updated immediately
2. No Paddle API call
3. No charge/credit
4. Email sent to organization owner
5. Manual billing adjustment (if applicable)

---

## 💬 User-Facing Messages

### Paddle Subscription
```
Your Paddle subscription will be updated immediately with automatic proration. 
You'll be charged or credited based on the remaining billing cycle.
```

### Manual Billing
```
This is a manual billing organization. Tier changes will be reflected 
in the next invoice.
```

### Free Tier
```
Upgrades from the free tier will require payment setup.
```

---

## 🧪 Testing Checklist

- [ ] **Paddle Org Upgrade**: Professional → Business (verify Paddle charge + webhook)
- [ ] **Paddle Org Downgrade**: Business → Professional (verify Paddle credit)
- [ ] **Free Tier Upgrade**: Free → Professional (verify no Paddle call, DB updated)
- [ ] **Manual Billing**: Enterprise → Business (verify no Paddle call, DB updated)
- [ ] **Banner Display**: Verify correct message for each billing type
- [ ] **Confirmation Dialog**: Verify correct message for each billing type

---

## 🐛 Troubleshooting

### Issue: Paddle subscription not updating
**Check**:
1. Does organization have `paddle_subscription_id`?
   ```sql
   SELECT paddle_subscription_id FROM dra_organization_subscriptions WHERE organization_id = X;
   ```
2. Backend logs show "Updating Paddle subscription"?
3. Paddle dashboard shows subscription update event?
4. Webhook delivered? (may be delayed seconds/minutes)

### Issue: Database not updating
**Check**:
1. Backend logs show tier change completion?
2. Transaction committed successfully?
3. Webhook overwriting admin change? (webhook is authoritative)

### Issue: Wrong billing message shown
**Check**:
1. Frontend loaded subscription type from `getPaymentMethod()`?
2. `subscriptionType` state variable populated?
3. Console log shows "💳 Subscription type: paddle/manual/free"?

---

## 📊 Monitoring

### Backend Logs
```bash
# Paddle route taken
grep "Updating Paddle subscription" backend.log

# Direct route taken
grep "Direct database update" backend.log

# Tier change summary
grep "Tier changed:" backend.log
```

### Database Queries
```sql
-- Count organizations by billing type
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

### Paddle Dashboard
- Monitor `subscription.updated` events
- Check proration transactions
- Verify webhook delivery timestamps

---

## 🔐 Security Notes

- **Access Control**: Admin-only (`requiresAdministratorAccess` middleware)
- **Webhook Validation**: Paddle signature verification required
- **Data Consistency**: Webhooks are authoritative (overwrites admin changes if different)

---

## 📝 Database Fields

### dra_organization_subscriptions

| Field | Type | Purpose |
|-------|------|---------|
| `paddle_subscription_id` | varchar(255), nullable | **Key field** for routing decision |
| `subscription_tier_id` | int, FK | Updated after tier change |
| `billing_cycle` | varchar(20) | Determines which Paddle price ID to use |
| `status` | varchar(50) | Must be 'active' for tier changes |

**No schema changes required** — existing fields support hybrid routing.

---

## 🚀 Next Steps (Phase 2)

- [ ] Proration preview before confirmation
- [ ] Billing history with Paddle transaction IDs
- [ ] Cancel/pause subscription UI
- [ ] Self-service tier changes for organization owners

---

## 📚 Related Documentation

- [Full Implementation Details](paddle-hybrid-subscription-phase-1-complete.md)
- [Architecture Overview](comprehensive-architecture-documentation.md)
- [Paddle Integration Plan](PADDLE_INTEGRATION_PLAN.md)
- [Subscription Processor](../backend/src/processors/SubscriptionProcessor.ts)
- [Pricing Page](../frontend/pages/pricing.vue)

---

## 💡 Key Takeaways

1. **Always check `paddle_subscription_id`** before tier changes
2. **Paddle route = proration**, Direct route = immediate change
3. **Webhooks are authoritative** — may overwrite admin changes
4. **Billing type shown to users** — transparent expectations
5. **No breaking changes** — all existing orgs continue working

---

**Quick Reference Version**: 1.0  
**Last Updated**: 2025-01-XX  
**For**: Developers & Support Team
