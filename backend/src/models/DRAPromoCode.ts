import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
    type Relation
} from 'typeorm';
import { DRAUsersPlatform } from './DRAUsersPlatform.js';
import { DRASubscriptionTier } from './DRASubscriptionTier.js';

export enum EDiscountType {
    PERCENTAGE = 'percentage',
    FIXED_AMOUNT = 'fixed_amount',
    FREE_TRIAL = 'free_trial',
    UPGRADED_TIER = 'upgraded_tier'
}

@Entity('dra_promo_codes')
@Index(['code'], { unique: true })
@Index(['is_active', 'valid_from', 'valid_until'])
@Index(['campaign_name'])
export class DRAPromoCode {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'varchar', length: 50, unique: true })
    code!: string;

    // Discount details
    @Column({ 
        type: 'varchar', 
        length: 20,
        comment: 'percentage, fixed_amount, free_trial, upgraded_tier'
    })
    discount_type!: EDiscountType;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    discount_value!: number | null;

    @Column({ 
        type: 'integer', 
        nullable: true,
        comment: 'null = apply once, -1 = forever, N = apply for N months'
    })
    discount_duration_months!: number | null;

    // Tier upgrade (for upgraded_tier type)
    @Column({ type: 'integer', nullable: true })
    upgraded_tier_id!: number | null;

    @ManyToOne(() => DRASubscriptionTier, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'upgraded_tier_id' })
    upgraded_tier!: Relation<DRASubscriptionTier> | null;

    @Column({ type: 'integer', nullable: true })
    upgraded_tier_duration_months!: number | null;

    // Validity
    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    valid_from!: Date;

    @Column({ type: 'timestamp', nullable: true })
    valid_until!: Date | null;

    @Column({ type: 'boolean', default: true })
    is_active!: boolean;

    // Usage limits
    @Column({ type: 'integer', nullable: true, comment: 'null = unlimited' })
    max_uses!: number | null;

    @Column({ type: 'integer', default: 1 })
    max_uses_per_user!: number;

    @Column({ type: 'integer', default: 0 })
    current_uses!: number;

    // Restrictions
    @Column({ 
        type: 'jsonb', 
        nullable: true,
        comment: 'null = all tiers, or array of tier IDs'
    })
    applicable_tiers!: number[] | null;

    @Column({ 
        type: 'jsonb', 
        nullable: true,
        comment: 'null = all users, or array of user IDs/emails'
    })
    applicable_users!: (number | string)[] | null;

    @Column({ 
        type: 'varchar', 
        length: 255, 
        nullable: true,
        comment: 'e.g., .edu for students'
    })
    email_domain_restriction!: string | null;

    @Column({ type: 'boolean', default: false })
    new_users_only!: boolean;

    // Metadata
    @Column({ type: 'integer', nullable: true })
    created_by!: number | null;

    @ManyToOne(() => DRAUsersPlatform, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'created_by' })
    creator!: Relation<DRAUsersPlatform> | null;

    @CreateDateColumn()
    created_at!: Date;

    @Column({ type: 'text', nullable: true })
    description!: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    campaign_name!: string | null;

    // Paddle integration
    @Column({ type: 'varchar', length: 255, nullable: true })
    paddle_discount_id!: string | null;
}
