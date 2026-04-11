# Admin: Organization Subscription History Timeline - Implementation Plan

**Status**: Planning  
**Created**: April 9, 2026  
**Replaces**: Issue #274 (obsolete - user subscription system deprecated)  
**Estimated Timeline**: 10-14 hours  
**Priority**: Medium  
**Target Audience**: Platform Administrators only

---

## Executive Summary

Build a comprehensive subscription history tracking system for organization-level subscriptions. Track all tier changes, cancellations, reactivations, grace periods, and payment failures with a timeline UI in the admin panel.

**Key Difference from Issue #274**: This implements history for ORGANIZATION subscriptions (current architecture), not user subscriptions (deprecated system removed in Jan 2026).

---

## Problem Statement

### Current Limitations

Administrators currently have no visibility into an organization's subscription lifecycle:

1. **No tier change history**: When did org X upgrade from FREE to PROFESSIONAL?
2. **No cancellation tracking**: Why and when was subscription cancelled?
3. **No payment failure visibility**: How many times did payment fail before grace period?
4. **No lifecycle context**: Cannot investigate billing disputes or audit subscription changes
5. **No compliance audit trail**: No historical record for financial audits

### What Currently Exists

- ✅ `dra_organization_subscriptions` table stores CURRENT subscription only (updates in place)
- ✅ Payment/invoice history available via Paddle API (`GET /subscription/payment-history`)
- ✅ Paddle webhook events stored in `dra_paddle_webhook_events` (raw webhook data)
- ❌ No structured history of tier changes
- ❌ No UI for viewing subscription timeline

---

## Solution Overview

### Design Principles

1. **Immutable History**: Every tier change creates a new history record (never update)
2. **Comprehensive Tracking**: Capture upgrades, downgrades, cancellations, grace periods, failures
3. **Audit Trail**: Record who triggered changes and why (user-initiated vs system-triggered)
4. **Performance**: Index for fast lookups by organization and date range
5. **Integration**: Leverage existing Paddle webhook infrastructure

### Architecture Approach

```
Subscription Change Event
    ↓
SubscriptionProcessor.changeTier()
    ↓
[1] Update dra_organization_subscriptions (current state)
    ↓
[2] Insert dra_organization_subscription_history (immutable record)
    ↓
Admin UI queries history table for timeline display
```

---

## Database Schema

### New Table: `dra_organization_subscription_history`

```sql
CREATE TABLE dra_organization_subscription_history (
    id                          SERIAL PRIMARY KEY,
    organization_id             INT NOT NULL REFERENCES dra_organizations(id) ON DELETE CASCADE,
    subscription_tier_id        INT NOT NULL REFERENCES dra_subscription_tiers(id),
    previous_tier_id            INT REFERENCES dra_subscription_tiers(id),
    
    -- Event classification
    action                      VARCHAR(50) NOT NULL,  
    -- Values: 'created', 'upgraded', 'downgraded', 'cancelled', 'reactivated', 
    --         'payment_failed', 'grace_period_started', 'grace_period_expired'
    
    trigger_source              VARCHAR(50) NOT NULL,
    -- Values: 'user', 'webhook', 'admin', 'system', 'migration'
    
    -- Paddle integration
    paddle_subscription_id      VARCHAR(100),
    paddle_transaction_id       VARCHAR(100),
    paddle_event_id             VARCHAR(100),  -- Link to webhook event
    
    -- Billing details
    billing_cycle               VARCHAR(20),  -- 'monthly', 'annual'
    price_paid                  NUMERIC(10,2),
    currency                    VARCHAR(3),
    
    -- Metadata
    changed_at                  TIMESTAMP NOT NULL DEFAULT NOW(),
    changed_by_user_id          INT REFERENCES dra_users_platform(id),
    reason                      TEXT,  -- Cancellation reason, admin notes
    metadata                    JSONB DEFAULT '{}',  -- Additional Paddle data
    
    -- Indexes
    CONSTRAINT chk_action CHECK (action IN (
        'created', 'upgraded', 'downgraded', 'cancelled', 'reactivated',
        'payment_failed', 'grace_period_started', 'grace_period_expired',
        'tier_changed_by_admin'
    ))
);

-- Indexes for performance
CREATE INDEX idx_org_subscription_history_org_id 
    ON dra_organization_subscription_history(organization_id);

CREATE INDEX idx_org_subscription_history_changed_at 
    ON dra_organization_subscription_history(changed_at DESC);

CREATE INDEX idx_org_subscription_history_action 
    ON dra_organization_subscription_history(action);

CREATE INDEX idx_org_subscription_history_paddle_sub 
    ON dra_organization_subscription_history(paddle_subscription_id)
    WHERE paddle_subscription_id IS NOT NULL;
```

### Action Type Matrix

| Action | Trigger Source | When It Happens |
|--------|----------------|-----------------|
| `created` | `webhook`, `user` | First subscription created via checkout |
| `upgraded` | `user`, `admin` | Changed to higher tier |
| `downgraded` | `user`, `admin` | Changed to lower tier |
| `cancelled` | `user`, `webhook` | Subscription cancelled (access continues until `ends_at`) |
| `reactivated` | `user`, `webhook` | Cancelled subscription reactivated |
| `payment_failed` | `webhook` | Payment attempt failed |
| `grace_period_started` | `webhook` | Grace period begins after payment failure |
| `grace_period_expired` | `system` | Grace period ended, access revoked |
| `tier_changed_by_admin` | `admin` | Platform admin manually changed tier |

---

## Backend Implementation

### Phase 1: Database Migration

**File**: `backend/src/migrations/1775000000000-CreateOrganizationSubscriptionHistory.ts`

```typescript
import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateOrganizationSubscriptionHistory1775000000000 implements MigrationInterface {
    name = 'CreateOrganizationSubscriptionHistory1775000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create table
        await queryRunner.query(`
            CREATE TABLE "dra_organization_subscription_history" (
                "id"                        SERIAL PRIMARY KEY,
                "organization_id"           INT NOT NULL,
                "subscription_tier_id"      INT NOT NULL,
                "previous_tier_id"          INT,
                "action"                    VARCHAR(50) NOT NULL,
                "trigger_source"            VARCHAR(50) NOT NULL,
                "paddle_subscription_id"    VARCHAR(100),
                "paddle_transaction_id"     VARCHAR(100),
                "paddle_event_id"           VARCHAR(100),
                "billing_cycle"             VARCHAR(20),
                "price_paid"                NUMERIC(10,2),
                "currency"                  VARCHAR(3),
                "changed_at"                TIMESTAMP NOT NULL DEFAULT NOW(),
                "changed_by_user_id"        INT,
                "reason"                    TEXT,
                "metadata"                  JSONB DEFAULT '{}',
                
                CONSTRAINT "fk_org_sub_history_org" 
                    FOREIGN KEY ("organization_id") 
                    REFERENCES "dra_organizations"("id") 
                    ON DELETE CASCADE,
                    
                CONSTRAINT "fk_org_sub_history_tier" 
                    FOREIGN KEY ("subscription_tier_id") 
                    REFERENCES "dra_subscription_tiers"("id"),
                    
                CONSTRAINT "fk_org_sub_history_prev_tier" 
                    FOREIGN KEY ("previous_tier_id") 
                    REFERENCES "dra_subscription_tiers"("id"),
                    
                CONSTRAINT "fk_org_sub_history_user" 
                    FOREIGN KEY ("changed_by_user_id") 
                    REFERENCES "dra_users_platform"("id"),
                    
                CONSTRAINT "chk_action" CHECK ("action" IN (
                    'created', 'upgraded', 'downgraded', 'cancelled', 'reactivated',
                    'payment_failed', 'grace_period_started', 'grace_period_expired',
                    'tier_changed_by_admin'
                ))
            )
        `);

        // Create indexes
        await queryRunner.query(`
            CREATE INDEX "idx_org_subscription_history_org_id" 
            ON "dra_organization_subscription_history"("organization_id")
        `);

        await queryRunner.query(`
            CREATE INDEX "idx_org_subscription_history_changed_at" 
            ON "dra_organization_subscription_history"("changed_at" DESC)
        `);

        await queryRunner.query(`
            CREATE INDEX "idx_org_subscription_history_action" 
            ON "dra_organization_subscription_history"("action")
        `);

        await queryRunner.query(`
            CREATE INDEX "idx_org_subscription_history_paddle_sub" 
            ON "dra_organization_subscription_history"("paddle_subscription_id")
            WHERE "paddle_subscription_id" IS NOT NULL
        `);

        // Backfill existing subscriptions as 'created' events
        await queryRunner.query(`
            INSERT INTO "dra_organization_subscription_history" (
                organization_id,
                subscription_tier_id,
                action,
                trigger_source,
                paddle_subscription_id,
                billing_cycle,
                changed_at,
                metadata
            )
            SELECT 
                organization_id,
                subscription_tier_id,
                'created',
                'migration',
                paddle_subscription_id,
                billing_cycle,
                started_at,
                jsonb_build_object('backfilled', true, 'migration_date', NOW())
            FROM dra_organization_subscriptions
            WHERE is_active = true
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_org_subscription_history_paddle_sub"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_org_subscription_history_action"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_org_subscription_history_changed_at"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_org_subscription_history_org_id"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "dra_organization_subscription_history"`);
    }
}
```

### Phase 2: TypeORM Model

**File**: `backend/src/models/DRAOrganizationSubscriptionHistory.ts`

```typescript
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    Relation
} from 'typeorm';
import { DRAOrganization } from './DRAOrganization.js';
import { DRASubscriptionTier } from './DRASubscriptionTier.js';
import { DRAUsersPlatform } from './DRAUsersPlatform.js';

export enum SubscriptionHistoryAction {
    CREATED = 'created',
    UPGRADED = 'upgraded',
    DOWNGRADED = 'downgraded',
    CANCELLED = 'cancelled',
    REACTIVATED = 'reactivated',
    PAYMENT_FAILED = 'payment_failed',
    GRACE_PERIOD_STARTED = 'grace_period_started',
    GRACE_PERIOD_EXPIRED = 'grace_period_expired',
    TIER_CHANGED_BY_ADMIN = 'tier_changed_by_admin'
}

export enum SubscriptionHistoryTriggerSource {
    USER = 'user',
    WEBHOOK = 'webhook',
    ADMIN = 'admin',
    SYSTEM = 'system',
    MIGRATION = 'migration'
}

/**
 * Immutable history of organization subscription changes
 * 
 * Every tier change, cancellation, payment failure, etc. creates a new record.
 * NEVER update existing records - this is an audit trail.
 * 
 * Query patterns:
 * - Get timeline for org: filter by organization_id ORDER BY changed_at DESC
 * - Get all upgrades: filter by action='upgraded'
 * - Get payment failures: filter by action='payment_failed'
 * 
 * @see DRAOrganizationSubscription (current state)
 * @see backend/src/services/SubscriptionHistoryService.ts
 */
@Entity('dra_organization_subscription_history')
export class DRAOrganizationSubscriptionHistory {
    @PrimaryGeneratedColumn()
    id!: number;

    @ManyToOne(() => DRAOrganization, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'organization_id' })
    organization!: Relation<DRAOrganization>;

    @Column({ type: 'int', name: 'organization_id' })
    organization_id!: number;

    @ManyToOne(() => DRASubscriptionTier)
    @JoinColumn({ name: 'subscription_tier_id' })
    subscription_tier!: Relation<DRASubscriptionTier>;

    @Column({ type: 'int', name: 'subscription_tier_id' })
    subscription_tier_id!: number;

    @ManyToOne(() => DRASubscriptionTier, { nullable: true })
    @JoinColumn({ name: 'previous_tier_id' })
    previous_tier?: Relation<DRASubscriptionTier>;

    @Column({ type: 'int', nullable: true, name: 'previous_tier_id' })
    previous_tier_id?: number | null;

    @Column({
        type: 'enum',
        enum: SubscriptionHistoryAction
    })
    action!: SubscriptionHistoryAction;

    @Column({
        type: 'enum',
        enum: SubscriptionHistoryTriggerSource
    })
    trigger_source!: SubscriptionHistoryTriggerSource;

    @Column({ type: 'varchar', length: 100, nullable: true })
    paddle_subscription_id?: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    paddle_transaction_id?: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    paddle_event_id?: string | null;

    @Column({ type: 'varchar', length: 20, nullable: true })
    billing_cycle?: string | null;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    price_paid?: number | null;

    @Column({ type: 'varchar', length: 3, nullable: true })
    currency?: string | null;

    @CreateDateColumn({ type: 'timestamp', name: 'changed_at' })
    changed_at!: Date;

    @ManyToOne(() => DRAUsersPlatform, { nullable: true })
    @JoinColumn({ name: 'changed_by_user_id' })
    changed_by_user?: Relation<DRAUsersPlatform>;

    @Column({ type: 'int', nullable: true, name: 'changed_by_user_id' })
    changed_by_user_id?: number | null;

    @Column({ type: 'text', nullable: true })
    reason?: string | null;

    @Column({ type: 'jsonb', default: {} })
    metadata!: Record<string, any>;
}
```

### Phase 3: History Service

**File**: `backend/src/services/SubscriptionHistoryService.ts`

```typescript
import { AppDataSource } from '../datasources/PostgresDS.js';
import { 
    DRAOrganizationSubscriptionHistory, 
    SubscriptionHistoryAction,
    SubscriptionHistoryTriggerSource 
} from '../models/DRAOrganizationSubscriptionHistory.js';
import { EntityManager } from 'typeorm';

export interface ICreateSubscriptionHistoryParams {
    organizationId: number;
    subscriptionTierId: number;
    previousTierId?: number | null;
    action: SubscriptionHistoryAction;
    triggerSource: SubscriptionHistoryTriggerSource;
    paddleSubscriptionId?: string | null;
    paddleTransactionId?: string | null;
    paddleEventId?: string | null;
    billingCycle?: string | null;
    pricePaid?: number | null;
    currency?: string | null;
    changedByUserId?: number | null;
    reason?: string | null;
    metadata?: Record<string, any>;
}

/**
 * SubscriptionHistoryService - Track all organization subscription changes
 * 
 * Creates immutable audit trail for:
 * - Tier changes (upgrades/downgrades)
 * - Cancellations and reactivations
 * - Payment failures and grace periods
 * - Admin-initiated changes
 * 
 * CRITICAL: Always call this service when subscription state changes.
 * Do NOT create history records directly - use this service for consistency.
 * 
 * @see SubscriptionProcessor.changeTier()
 * @see PaddleWebhookProcessor
 */
export class SubscriptionHistoryService {
    private static instance: SubscriptionHistoryService;
    
    private constructor() {
        console.log('📘 Subscription History Service initialized');
    }
    
    public static getInstance(): SubscriptionHistoryService {
        if (!SubscriptionHistoryService.instance) {
            SubscriptionHistoryService.instance = new SubscriptionHistoryService();
        }
        return SubscriptionHistoryService.instance;
    }

    /**
     * Create a subscription history record
     * 
     * @param params - History record parameters
     * @param manager - Optional EntityManager (for transactions)
     * @returns Created history record
     */
    async createHistoryRecord(
        params: ICreateSubscriptionHistoryParams,
        manager?: EntityManager
    ): Promise<DRAOrganizationSubscriptionHistory> {
        const dbManager = manager || AppDataSource.manager;
        
        const historyRecord = dbManager.create(DRAOrganizationSubscriptionHistory, {
            organization_id: params.organizationId,
            subscription_tier_id: params.subscriptionTierId,
            previous_tier_id: params.previousTierId,
            action: params.action,
            trigger_source: params.triggerSource,
            paddle_subscription_id: params.paddleSubscriptionId,
            paddle_transaction_id: params.paddleTransactionId,
            paddle_event_id: params.paddleEventId,
            billing_cycle: params.billingCycle,
            price_paid: params.pricePaid,
            currency: params.currency,
            changed_by_user_id: params.changedByUserId,
            reason: params.reason,
            metadata: params.metadata || {}
        });
        
        return await dbManager.save(historyRecord);
    }

    /**
     * Get full subscription history for an organization
     * 
     * @param organizationId - Organization ID
     * @param limit - Max records to return (default 100)
     * @returns History records ordered by date descending
     */
    async getOrganizationHistory(
        organizationId: number,
        limit: number = 100
    ): Promise<DRAOrganizationSubscriptionHistory[]> {
        return await AppDataSource.manager.find(DRAOrganizationSubscriptionHistory, {
            where: { organization_id: organizationId },
            relations: ['subscription_tier', 'previous_tier', 'changed_by_user'],
            order: { changed_at: 'DESC' },
            take: limit
        });
    }

    /**
     * Get history filtered by action type
     * 
     * @param organizationId - Organization ID
     * @param action - Action type filter
     * @param limit - Max records
     */
    async getHistoryByAction(
        organizationId: number,
        action: SubscriptionHistoryAction,
        limit: number = 50
    ): Promise<DRAOrganizationSubscriptionHistory[]> {
        return await AppDataSource.manager.find(DRAOrganizationSubscriptionHistory, {
            where: { 
                organization_id: organizationId,
                action 
            },
            relations: ['subscription_tier', 'previous_tier'],
            order: { changed_at: 'DESC' },
            take: limit
        });
    }

    /**
     * Get history for date range
     */
    async getHistoryByDateRange(
        organizationId: number,
        startDate: Date,
        endDate: Date
    ): Promise<DRAOrganizationSubscriptionHistory[]> {
        return await AppDataSource.manager
            .createQueryBuilder(DRAOrganizationSubscriptionHistory, 'history')
            .leftJoinAndSelect('history.subscription_tier', 'tier')
            .leftJoinAndSelect('history.previous_tier', 'prev_tier')
            .leftJoinAndSelect('history.changed_by_user', 'user')
            .where('history.organization_id = :orgId', { orgId: organizationId })
            .andWhere('history.changed_at BETWEEN :start AND :end', {
                start: startDate,
                end: endDate
            })
            .orderBy('history.changed_at', 'DESC')
            .getMany();
    }

    /**
     * Get count of specific action type for analytics
     */
    async getActionCount(
        organizationId: number,
        action: SubscriptionHistoryAction
    ): Promise<number> {
        return await AppDataSource.manager.count(DRAOrganizationSubscriptionHistory, {
            where: { 
                organization_id: organizationId,
                action 
            }
        });
    }
}
```

### Phase 4: Integration with SubscriptionProcessor

**File**: `backend/src/processors/SubscriptionProcessor.ts` (modifications)

Add history tracking to all subscription state changes:

```typescript
// At top of file
import { SubscriptionHistoryService } from '../services/SubscriptionHistoryService.js';
import { SubscriptionHistoryAction, SubscriptionHistoryTriggerSource } from '../models/DRAOrganizationSubscriptionHistory.js';

// In changeTier() method - after successful tier change
async changeTier(
    organizationId: number,
    newTierId: number,
    userId: number,
    reason?: string
): Promise<DRAOrganizationSubscription> {
    const manager = AppDataSource.manager;
    
    return await manager.transaction(async (transactionalManager) => {
        const organization = await transactionalManager.findOneOrFail(/* ... */);
        const currentTierId = organization.subscription?.subscription_tier_id;
        
        // ... update subscription logic ...
        
        // Determine if upgrade or downgrade
        const action = newTierId > currentTierId 
            ? SubscriptionHistoryAction.UPGRADED 
            : SubscriptionHistoryAction.DOWNGRADED;
        
        // Create history record
        const historyService = SubscriptionHistoryService.getInstance();
        await historyService.createHistoryRecord({
            organizationId,
            subscriptionTierId: newTierId,
            previousTierId: currentTierId,
            action,
            triggerSource: SubscriptionHistoryTriggerSource.USER,
            paddleSubscriptionId: organization.subscription.paddle_subscription_id,
            billingCycle: organization.subscription.billing_cycle,
            changedByUserId: userId,
            reason,
            metadata: {
                old_tier_name: currentTier.tier_name,
                new_tier_name: newTier.tier_name
            }
        }, transactionalManager);
        
        return updatedSubscription;
    });
}

// In cancelSubscription() method
async cancelSubscription(/* ... */): Promise<DRAOrganizationSubscription> {
    // ... cancellation logic ...
    
    // Create history record
    await SubscriptionHistoryService.getInstance().createHistoryRecord({
        organizationId,
        subscriptionTierId: subscription.subscription_tier_id,
        action: SubscriptionHistoryAction.CANCELLED,
        triggerSource: SubscriptionHistoryTriggerSource.USER,
        paddleSubscriptionId: subscription.paddle_subscription_id,
        changedByUserId: userId,
        reason
    });
}

// In handleFailedPayment() method
async handleFailedPayment(subscriptionId: string): Promise<DRAOrganizationSubscription> {
    // ... grace period logic ...
    
    await SubscriptionHistoryService.getInstance().createHistoryRecord({
        organizationId: subscription.organization_id,
        subscriptionTierId: subscription.subscription_tier_id,
        action: SubscriptionHistoryAction.PAYMENT_FAILED,
        triggerSource: SubscriptionHistoryTriggerSource.WEBHOOK,
        paddleSubscriptionId: subscriptionId,
        metadata: {
            grace_period_ends_at: subscription.grace_period_ends_at
        }
    });
}
```

### Phase 5: Admin API Routes

**File**: `backend/src/routes/admin/subscription-history.ts` (NEW)

```typescript
import { Router, Request, Response } from 'express';
import { validateJWT } from '../../middleware/authenticate.js';
import { requirePlatformAdmin } from '../../middleware/requirePlatformAdmin.js';
import { SubscriptionHistoryService } from '../../services/SubscriptionHistoryService.js';
import { SubscriptionHistoryAction } from '../../models/DRAOrganizationSubscriptionHistory.js';

const router = Router();
const historyService = SubscriptionHistoryService.getInstance();

/**
 * GET /admin/subscription-history/:organizationId
 * 
 * Get complete subscription history for an organization
 * Admin-only endpoint
 * 
 * Query params:
 * - limit (optional): Max records to return
 * - action (optional): Filter by action type
 * - startDate, endDate (optional): Date range filter
 */
router.get('/:organizationId', validateJWT, requirePlatformAdmin, async (req: Request, res: Response) => {
    try {
        const organizationId = parseInt(req.params.organizationId);
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
        const action = req.query.action as SubscriptionHistoryAction | undefined;
        
        if (isNaN(organizationId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid organization ID'
            });
        }
        
        let history;
        
        if (action) {
            // Filter by action type
            history = await historyService.getHistoryByAction(organizationId, action, limit);
        } else if (req.query.startDate && req.query.endDate) {
            // Date range filter
            const startDate = new Date(req.query.startDate as string);
            const endDate = new Date(req.query.endDate as string);
            history = await historyService.getHistoryByDateRange(organizationId, startDate, endDate);
        } else {
            // Full history
            history = await historyService.getOrganizationHistory(organizationId, limit);
        }
        
        res.json({
            success: true,
            data: history,
            count: history.length
        });
    } catch (error: any) {
        console.error('Get subscription history error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch subscription history'
        });
    }
});

/**
 * GET /admin/subscription-history/:organizationId/stats
 * 
 * Get subscription history statistics
 * - Total upgrades/downgrades
 * - Payment failures count
 * - Cancellation count
 */
router.get('/:organizationId/stats', validateJWT, requirePlatformAdmin, async (req: Request, res: Response) => {
    try {
        const organizationId = parseInt(req.params.organizationId);
        
        if (isNaN(organizationId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid organization ID'
            });
        }
        
        const [upgrades, downgrades, cancellations, paymentFailures] = await Promise.all([
            historyService.getActionCount(organizationId, SubscriptionHistoryAction.UPGRADED),
            historyService.getActionCount(organizationId, SubscriptionHistoryAction.DOWNGRADED),
            historyService.getActionCount(organizationId, SubscriptionHistoryAction.CANCELLED),
            historyService.getActionCount(organizationId, SubscriptionHistoryAction.PAYMENT_FAILED)
        ]);
        
        res.json({
            success: true,
            stats: {
                total_upgrades: upgrades,
                total_downgrades: downgrades,
                total_cancellations: cancellations,
                total_payment_failures: paymentFailures
            }
        });
    } catch (error: any) {
        console.error('Get subscription stats error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch subscription statistics'
        });
    }
});

export default router;
```

**Mount route in** `backend/src/index.ts`:

```typescript
import subscriptionHistory from './routes/admin/subscription-history.js';

// Add after other admin routes (around line 250)
app.use('/admin/subscription-history', subscriptionHistory);
```

---

## Frontend Implementation

### Phase 1: Admin Composable

**File**: `frontend/composables/useAdminSubscriptionHistory.ts` (NEW)

```typescript
export const useAdminSubscriptionHistory = () => {
    const config = useRuntimeConfig();

    const authHeaders = (): Record<string, string> => {
        const token = getAuthToken();
        if (!token) throw new Error('Authentication required');
        return {
            'Authorization': `Bearer ${token}`,
            'Authorization-Type': 'auth',
            'Content-Type': 'application/json'
        };
    };

    /**
     * Get subscription history for an organization
     */
    const getOrganizationHistory = async (
        organizationId: number,
        filters?: {
            limit?: number;
            action?: string;
            startDate?: string;
            endDate?: string;
        }
    ): Promise<any[]> => {
        const params = new URLSearchParams();
        if (filters?.limit) params.append('limit', filters.limit.toString());
        if (filters?.action) params.append('action', filters.action);
        if (filters?.startDate) params.append('startDate', filters.startDate);
        if (filters?.endDate) params.append('endDate', filters.endDate);

        const queryString = params.toString();
        const url = `${config.public.apiBase}/admin/subscription-history/${organizationId}${queryString ? '?' + queryString : ''}`;

        const response = await $fetch<{ success: boolean; data: any[]; count: number }>(
            url,
            { headers: authHeaders() }
        );

        return response.success ? response.data : [];
    };

    /**
     * Get subscription history statistics
     */
    const getHistoryStats = async (organizationId: number): Promise<any> => {
        const response = await $fetch<{ success: boolean; stats: any }>(
            `${config.public.apiBase}/admin/subscription-history/${organizationId}/stats`,
            { headers: authHeaders() }
        );

        return response.success ? response.stats : null;
    };

    /**
     * Format history action for display
     */
    const formatAction = (action: string): string => {
        const actionMap: Record<string, string> = {
            'created': 'Subscription Created',
            'upgraded': 'Upgraded',
            'downgraded': 'Downgraded',
            'cancelled': 'Cancelled',
            'reactivated': 'Reactivated',
            'payment_failed': 'Payment Failed',
            'grace_period_started': 'Grace Period Started',
            'grace_period_expired': 'Grace Period Expired',
            'tier_changed_by_admin': 'Admin Tier Change'
        };
        return actionMap[action] || action;
    };

    /**
     * Get color class for action badge
     */
    const getActionColor = (action: string): string => {
        const colorMap: Record<string, string> = {
            'created': 'bg-green-100 text-green-800',
            'upgraded': 'bg-blue-100 text-blue-800',
            'downgraded': 'bg-orange-100 text-orange-800',
            'cancelled': 'bg-red-100 text-red-800',
            'reactivated': 'bg-green-100 text-green-800',
            'payment_failed': 'bg-red-100 text-red-800',
            'grace_period_started': 'bg-yellow-100 text-yellow-800',
            'grace_period_expired': 'bg-red-100 text-red-800',
            'tier_changed_by_admin': 'bg-purple-100 text-purple-800'
        };
        return colorMap[action] || 'bg-gray-100 text-gray-800';
    };

    /**
     * Format timestamp
     */
    const formatTimestamp = (timestamp: string): string => {
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return {
        getOrganizationHistory,
        getHistoryStats,
        formatAction,
        getActionColor,
        formatTimestamp
    };
};
```

### Phase 2: Timeline Component

**File**: `frontend/components/admin/SubscriptionHistoryTimeline.vue` (NEW)

```vue
<template>
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div class="flex justify-between items-center mb-6">
            <h3 class="text-lg font-semibold text-gray-900">Subscription History</h3>
            
            <!-- Filter Controls -->
            <div class="flex gap-2">
                <select
                    v-model="state.filterAction"
                    class="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                    @change="loadHistory"
                >
                    <option value="">All Events</option>
                    <option value="upgraded">Upgrades</option>
                    <option value="downgraded">Downgrades</option>
                    <option value="cancelled">Cancellations</option>
                    <option value="payment_failed">Payment Failures</option>
                </select>
                
                <button
                    @click="exportHistory"
                    class="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                    <font-awesome-icon :icon="['fas', 'download']" class="mr-1" />
                    Export
                </button>
            </div>
        </div>

        <!-- Statistics Cards -->
        <div v-if="state.stats" class="grid grid-cols-4 gap-4 mb-6">
            <div class="bg-blue-50 rounded-lg p-4">
                <div class="text-2xl font-bold text-blue-700">{{ state.stats.total_upgrades }}</div>
                <div class="text-sm text-blue-600">Total Upgrades</div>
            </div>
            <div class="bg-orange-50 rounded-lg p-4">
                <div class="text-2xl font-bold text-orange-700">{{ state.stats.total_downgrades }}</div>
                <div class="text-sm text-orange-600">Total Downgrades</div>
            </div>
            <div class="bg-red-50 rounded-lg p-4">
                <div class="text-2xl font-bold text-red-700">{{ state.stats.total_cancellations }}</div>
                <div class="text-sm text-red-600">Cancellations</div>
            </div>
            <div class="bg-yellow-50 rounded-lg p-4">
                <div class="text-2xl font-bold text-yellow-700">{{ state.stats.total_payment_failures }}</div>
                <div class="text-sm text-yellow-600">Payment Failures</div>
            </div>
        </div>

        <!-- Loading State -->
        <div v-if="state.loading" class="flex justify-center py-12">
            <font-awesome-icon :icon="['fas', 'spinner']" class="text-3xl text-blue-600 animate-spin" />
        </div>

        <!-- Empty State -->
        <div v-else-if="state.history.length === 0" class="text-center py-12">
            <font-awesome-icon :icon="['fas', 'clock-rotate-left']" class="text-5xl text-gray-300 mb-4" />
            <p class="text-gray-500">No subscription history found</p>
        </div>

        <!-- Timeline -->
        <div v-else class="relative">
            <!-- Vertical line -->
            <div class="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>

            <!-- Timeline items -->
            <div
                v-for="(item, index) in state.history"
                :key="item.id"
                class="relative pl-12 pb-8 last:pb-0"
            >
                <!-- Timeline dot -->
                <div
                    class="absolute left-0 w-8 h-8 rounded-full flex items-center justify-center"
                    :class="getActionColor(item.action).replace('text-', 'bg-').replace('100', '200')"
                >
                    <font-awesome-icon
                        :icon="getActionIcon(item.action)"
                        class="text-sm"
                        :class="getActionColor(item.action).split(' ')[1]"
                    />
                </div>

                <!-- Event card -->
                <div class="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow">
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            <span
                                class="inline-block px-2.5 py-1 rounded-full text-xs font-medium"
                                :class="getActionColor(item.action)"
                            >
                                {{ formatAction(item.action) }}
                            </span>
                            <h4 class="text-base font-semibold text-gray-900 mt-2">
                                {{ getTierDisplay(item) }}
                            </h4>
                        </div>
                        <span class="text-sm text-gray-500">
                            {{ formatTimestamp(item.changed_at) }}
                        </span>
                    </div>

                    <!-- Event details -->
                    <div class="text-sm text-gray-600 space-y-1">
                        <div v-if="item.previous_tier">
                            <span class="font-medium">Previous Tier:</span>
                            {{ item.previous_tier.tier_name.toUpperCase() }}
                        </div>
                        <div v-if="item.billing_cycle">
                            <span class="font-medium">Billing Cycle:</span>
                            {{ item.billing_cycle }}
                        </div>
                        <div v-if="item.price_paid">
                            <span class="font-medium">Amount:</span>
                            {{ item.currency || 'USD' }} ${{ item.price_paid }}
                        </div>
                        <div v-if="item.changed_by_user">
                            <span class="font-medium">Changed By:</span>
                            {{ item.changed_by_user.email }}
                        </div>
                        <div v-if="item.trigger_source">
                            <span class="font-medium">Source:</span>
                            {{ formatSource(item.trigger_source) }}
                        </div>
                        <div v-if="item.reason" class="mt-2 p-2 bg-white rounded border border-gray-200">
                            <span class="font-medium">Reason:</span> {{ item.reason }}
                        </div>
                    </div>

                    <!-- Paddle links -->
                    <div v-if="item.paddle_subscription_id || item.paddle_transaction_id" class="mt-3 pt-3 border-t border-gray-200">
                        <div class="text-xs text-gray-500 font-mono">
                            <div v-if="item.paddle_subscription_id">
                                Paddle Sub: {{ item.paddle_subscription_id }}
                            </div>
                            <div v-if="item.paddle_transaction_id">
                                Transaction: {{ item.paddle_transaction_id }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Load More -->
        <div v-if="state.history.length >= state.limit" class="text-center mt-6">
            <button
                @click="loadMore"
                class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium"
            >
                Load More
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { reactive, onMounted } from 'vue';
import { useAdminSubscriptionHistory } from '~/composables/useAdminSubscriptionHistory';

const props = defineProps<{
    organizationId: number;
}>();

const history = useAdminSubscriptionHistory();

const state = reactive({
    history: [] as any[],
    stats: null as any,
    loading: false,
    filterAction: '',
    limit: 50
});

onMounted(async () => {
    await Promise.all([
        loadHistory(),
        loadStats()
    ]);
});

async function loadHistory() {
    state.loading = true;
    try {
        state.history = await history.getOrganizationHistory(props.organizationId, {
            limit: state.limit,
            action: state.filterAction || undefined
        });
    } catch (error) {
        console.error('Failed to load history:', error);
    } finally {
        state.loading = false;
    }
}

async function loadStats() {
    try {
        state.stats = await history.getHistoryStats(props.organizationId);
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

async function loadMore() {
    state.limit += 50;
    await loadHistory();
}

function getTierDisplay(item: any): string {
    const tierName = item.subscription_tier?.tier_name?.toUpperCase() || 'UNKNOWN';
    
    if (item.action === 'upgraded' && item.previous_tier) {
        return `Upgraded to ${tierName}`;
    } else if (item.action === 'downgraded' && item.previous_tier) {
        return `Downgraded to ${tierName}`;
    } else if (item.action === 'created') {
        return `Subscribed to ${tierName}`;
    } else {
        return tierName;
    }
}

function getActionIcon(action: string): [string, string] {
    const iconMap: Record<string, [string, string]> = {
        'created': ['fas', 'plus'],
        'upgraded': ['fas', 'arrow-up'],
        'downgraded': ['fas', 'arrow-down'],
        'cancelled': ['fas', 'xmark'],
        'reactivated': ['fas', 'rotate-right'],
        'payment_failed': ['fas', 'exclamation-triangle'],
        'grace_period_started': ['fas', 'clock'],
        'grace_period_expired': ['fas', 'ban'],
        'tier_changed_by_admin': ['fas', 'user-shield']
    };
    return iconMap[action] || ['fas', 'circle'];
}

function formatSource(source: string): string {
    const sourceMap: Record<string, string> = {
        'user': 'User Action',
        'webhook': 'Paddle Webhook',
        'admin': 'Admin Action',
        'system': 'System',
        'migration': 'Data Migration'
    };
    return sourceMap[source] || source;
}

function exportHistory() {
    // Convert to CSV
    const csv = [
        ['Date', 'Action', 'Tier', 'Previous Tier', 'Source', 'Changed By', 'Reason'].join(','),
        ...state.history.map(item => [
            new Date(item.changed_at).toISOString(),
            item.action,
            item.subscription_tier?.tier_name || '',
            item.previous_tier?.tier_name || '',
            item.trigger_source,
            item.changed_by_user?.email || '',
            item.reason || ''
        ].join(','))
    ].join('\n');

    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subscription-history-org-${props.organizationId}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
}

const { formatAction, getActionColor, formatTimestamp } = history;
</script>
```

### Phase 3: Admin Page Integration

**File**: `frontend/pages/admin/organizations/[orgid]/settings.vue`

Add new tab for subscription history:

```vue
<!-- In tabs section, add new tab -->
<button
    @click="activeTab = 'subscription-history'"
    :class="[
        'px-4 py-2 text-sm font-medium rounded-t-lg',
        activeTab === 'subscription-history'
            ? 'bg-white text-blue-600 border-t border-l border-r border-gray-200'
            : 'text-gray-600 hover:text-gray-900'
    ]"
>
    <font-awesome-icon :icon="['fas', 'clock-rotate-left']" class="mr-2" />
    Subscription History
</button>

<!-- In tab content section -->
<div v-else-if="activeTab === 'subscription-history'">
    <SubscriptionHistoryTimeline :organization-id="orgId" />
</div>
```

---

## Testing Strategy

### Unit Tests

**File**: `backend/src/__tests__/services/SubscriptionHistoryService.test.ts`

```typescript
describe('SubscriptionHistoryService', () => {
    it('creates history record with all fields', async () => { /* ... */ });
    it('retrieves organization history ordered by date', async () => { /* ... */ });
    it('filters history by action type', async () => { /* ... */ });
    it('filters history by date range', async () => { /* ... */ });
    it('counts action occurrences correctly', async () => { /* ... */ });
    it('handles missing optional fields gracefully', async () => { /* ... */ });
});
```

### Integration Tests

**File**: `backend/src/__tests__/integration/subscription-history.test.ts`

```typescript
describe('Subscription History Integration', () => {
    it('creates history record when tier changes', async () => { /* ... */ });
    it('creates history record on cancellation', async () => { /* ... */ });
    it('creates history record on payment failure', async () => { /* ... */ });
    it('admin endpoint returns formatted history', async () => { /* ... */ });
    it('non-admin users cannot access history endpoint', async () => { /* ... */ });
});
```

### Manual Testing Checklist

- [ ] Create organization subscription → verify 'created' history record
- [ ] Upgrade tier → verify 'upgraded' record with previous_tier_id
- [ ] Downgrade tier → verify 'downgraded' record
- [ ] Cancel subscription → verify 'cancelled' record with reason
- [ ] Trigger payment failure (sandbox) → verify webhook creates record
- [ ] Admin UI displays timeline correctly
- [ ] Timeline filters work (action type, date range)
- [ ] Statistics cards show correct counts
- [ ] Export CSV downloads with correct data
- [ ] Non-admin users cannot access page (403 error)
- [ ] Timeline handles 100+ records with pagination

---

## Rollout Plan

### Phase 1: Backend Foundation (4 hours)
1. Create migration (`1775000000000-CreateOrganizationSubscriptionHistory.ts`)
2. Create model (`DRAOrganizationSubscriptionHistory.ts`)
3. Create service (`SubscriptionHistoryService.ts`)
4. Run migration with backfill
5. Write unit tests

### Phase 2: Backend Integration (3 hours)
1. Update `SubscriptionProcessor.changeTier()` to create history
2. Update `SubscriptionProcessor.cancelSubscription()` to create history
3. Update webhook handlers to create history
4. Create admin API routes
5. Write integration tests

### Phase 3: Frontend Components (4 hours)
1. Create composable (`useAdminSubscriptionHistory.ts`)
2. Create timeline component (`SubscriptionHistoryTimeline.vue`)
3. Integrate into admin organization settings page
4. Style and responsive design

### Phase 4: Testing & Polish (3 hours)
1. Manual testing with real data
2. Cross-browser testing
3. Mobile responsive testing
4. Export CSV functionality testing
5. Performance testing with large datasets

---

## Success Metrics

After deployment, track:

1. **Usage Analytics**:
   - % of admins who view subscription history
   - Most common filter (action type)
   - Average history records per organization

2. **Support Impact**:
   - Reduction in billing dispute support tickets
   - Reduction in "when did we upgrade?" inquiries
   - Time saved investigating subscription issues

3. **Data Quality**:
   - 100% of tier changes captured in history
   - No missing history records after changes
   - Accurate backfill for existing subscriptions

4. **Performance**:
   - History page load time < 2s for 500 records
   - Export CSV completes < 5s for 1000 records
   - Database query time < 100ms

---

## Future Enhancements (Out of Scope)

1. **User-Facing History**: Allow org owners to view their own history
2. **Advanced Analytics**: Charts showing tier distribution over time
3. **Automated Alerts**: Email admins when payment fails or grace period starts
4. **Audit Reports**: Generate monthly subscription audit PDFs
5. **History Comparison**: Compare two organizations' subscription patterns
6. **Churn Prediction**: ML model based on downgrade/cancellation patterns
7. **Retention Tools**: Automated win-back campaigns for cancelled subscriptions

---

## Security Considerations

1. **Admin-Only Access**: requirePlatformAdmin middleware enforces platform admin role
2. **Data Privacy**: No sensitive payment data exposed (only last4, transaction IDs)
3. **Rate Limiting**: History endpoints use generalApiLimiter (100 req/min)
4. **SQL Injection**: TypeORM parameterized queries prevent injection
5. **Audit Trail**: All history changes logged (immutable records)

---

## Documentation Updates

After implementation:

1. Update `comprehensive-architecture-documentation.md`:
   - Add subscription history architecture diagram
   - Document history service patterns
   - Add entity relationship diagram

2. Update `paddle-integration-plan.md`:
   - Document history creation in webhook handlers
   - Add history service integration points

3. Create `admin-subscription-history-usage-guide.md`:
   - How to view organization history
   - Filter and export instructions
   - Interpreting timeline events

4. Update API documentation:
   - Document `/admin/subscription-history` endpoints
   - Add example responses
   - Document query parameters

---

## Dependencies & Prerequisites

### Must Have:
- ✅ Paddle integration complete (webhooks active)
- ✅ Organization multi-tenant architecture implemented
- ✅ Admin authentication and authorization middleware
- ✅ TypeORM migrations infrastructure

### Nice to Have:
- CSV export library (or use built-in browser functionality)
- Chart.js for future analytics visualizations

---

## Open Questions & Risks

### Questions to Resolve:
1. Should history be visible to organization owners (not just platform admins)?
2. How long should history be retained? (Recommendation: indefinitely for compliance)
3. Should we expose history via public API for integrations?

### Risks & Mitigations:
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Large history datasets slow down UI | Medium | Medium | Implement pagination, lazy loading |
| Missing history for edge cases | Low | High | Comprehensive webhook testing, fallback logging |
| Storage costs for long-term history | Low | Low | History records are small (~1KB each), millions fit in GB |
| Compliance concerns (GDPR) | Low | High | Include organization_id in cascade delete, export functionality |

---

## Estimated Timeline Summary

| Phase | Hours | Tasks |
|-------|-------|-------|
| Backend Foundation | 4 | Migration, model, service, tests |
| Backend Integration | 3 | Processor updates, routes, tests |
| Frontend Components | 4 | Composable, timeline, integration |
| Testing & Polish | 3 | Manual testing, fixes, optimization |
| **Total** | **14 hours** | **Complete implementation** |

---

## References

- Issue #274 (obsolete): Original user subscription history proposal
- `comprehensive-architecture-documentation.md`: Platform architecture
- `paddle-integration-plan.md`: Paddle webhook documentation
- `organization-billing-implementation-plan.md`: Current billing features
- Paddle API docs: https://developer.paddle.com/api-reference

---

**Created**: April 9, 2026  
**Author**: AI Development Team  
**Status**: Ready for Implementation  
**Next Steps**: Review with product team, prioritize in sprint planning
