import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { DRAUsersPlatform } from './DRAUsersPlatform.js';
import { DRASubscriptionTier } from './DRASubscriptionTier.js';

@Entity('dra_user_subscriptions')
export class DRAUserSubscription {
    @PrimaryGeneratedColumn()
    id!: number;

    @ManyToOne(() => DRAUsersPlatform, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'users_platform_id' })
    users_platform!: Relation<DRAUsersPlatform>;

    @ManyToOne(() => DRASubscriptionTier, (tier) => tier.user_subscriptions)
    @JoinColumn({ name: 'subscription_tier_id' })
    subscription_tier!: Relation<DRASubscriptionTier>;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    started_at!: Date;

    @Column({ type: 'timestamp', nullable: true })
    ends_at!: Date | null;

    @Column({ type: 'boolean', default: true })
    is_active!: boolean;

    @Column({ type: 'varchar', length: 100, nullable: true })
    stripe_subscription_id!: string | null;

    @Column({ type: 'timestamp', nullable: true })
    cancelled_at!: Date | null;
}
