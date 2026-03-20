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
 * Tier limits enforced:
 * - FREE: max_members = 1 (personal org)
 * - STARTER: max_members = 1 (personal org)
 * - PROFESSIONAL: max_members = 5
 * - PROFESSIONAL_PLUS: max_members = 100
 * - ENTERPRISE: max_members = null (unlimited)
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
    stripe_subscription_id!: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    stripe_customer_id!: string | null;

    @Column({ type: 'int', nullable: true })
    max_members!: number | null;  // Tier enforcement (null = unlimited for ENTERPRISE)

    @Column({ type: 'int', default: 1 })
    current_members!: number;  // Dynamically updated via triggers or service layer

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
}
