import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    OneToOne,
    ManyToOne,
    JoinColumn,
    Relation
} from 'typeorm';
import { DRAOrganization } from './DRAOrganization.js';
import { DRASubscriptionTier } from './DRASubscriptionTier.js';

/**
 * Organization subscription entity for billing and tier enforcement
 * 
 * Replaces DRAUserSubscription - subscriptions now at organization level.
 * One subscription per organization covers all members.
 *
 * current_members dynamically counts active DRAOrganizationMember records.
 * 
 * @see Issue #283: Multi-Tenant Organization Management
 * @see DRAUserSubscription (deprecated - will be removed after migration)
 */
@Entity('dra_organization_subscriptions')
export class DRAOrganizationSubscription {
    @PrimaryGeneratedColumn()
    id!: number;

    @OneToOne(() => DRAOrganization, org => org.subscription, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'organization_id' })
    organization!: Relation<DRAOrganization>;

    @Column({ type: 'int', unique: true, name: 'organization_id' })
    organization_id!: number;

    @ManyToOne(() => DRASubscriptionTier, tier => tier.organization_subscriptions)
    @JoinColumn({ name: 'subscription_tier_id' })
    subscription_tier!: Relation<DRASubscriptionTier>;

    @Column({ type: 'int', name: 'subscription_tier_id' })
    subscription_tier_id!: number;

    @Column({ type: 'varchar', length: 100, nullable: true })
    paddle_subscription_id!: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    paddle_customer_id!: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    paddle_transaction_id!: string | null;

    @Column({ type: 'text', nullable: true })
    paddle_update_url!: string | null;

    @Column({ type: 'enum', enum: ['monthly', 'annual'], default: 'annual' })
    billing_cycle!: 'monthly' | 'annual';

    @Column({ type: 'timestamp', nullable: true })
    grace_period_ends_at!: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    last_payment_failed_at!: Date | null;

    @Column({ type: 'int', default: 1 })
    current_members!: number;  // Dynamically updated via triggers or service layer

    /** Per-subscription monthly credit allowance for the variable-credit Pro
     *  plan. When set it overrides the tier's fixed credits_per_month. */
    @Column({ type: 'int', nullable: true })
    credits_per_month_override!: number | null;

    @Column({ type: 'boolean', default: true })
    is_active!: boolean;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    started_at!: Date;

    @Column({ type: 'timestamp', nullable: true })
    ends_at!: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    cancelled_at!: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    trial_ends_at!: Date | null;

    /** Paddle error code from the last failed payment attempt (e.g. 'insufficient_funds') */
    @Column({ type: 'varchar', length: 100, nullable: true })
    payment_failure_code!: string | null;

    /** Number of consecutive payment failures in the current grace period cycle */
    @Column({ type: 'int', default: 0 })
    payment_retry_count!: number;
}
