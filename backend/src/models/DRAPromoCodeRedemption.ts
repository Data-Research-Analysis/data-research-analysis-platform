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
import { DRAPromoCode } from './DRAPromoCode.js';
import { DRAUsersPlatform } from './DRAUsersPlatform.js';
import { DRAOrganization } from './DRAOrganization.js';
import { DRAOrganizationSubscription } from './DRAOrganizationSubscription.js';

export enum ERedemptionStatus {
    ACTIVE = 'active',
    EXPIRED = 'expired',
    CANCELLED = 'cancelled'
}

@Entity('dra_promo_code_redemptions')
@Index(['user_id'])
@Index(['promo_code_id'])
@Index(['status'])
@Index(['organization_id'])
@Index(['promo_code_id', 'user_id'], { unique: true })
export class DRAPromoCodeRedemption {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'integer' })
    promo_code_id!: number;

    @ManyToOne(() => DRAPromoCode, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'promo_code_id' })
    promo_code!: Relation<DRAPromoCode>;

    @Column({ type: 'integer' })
    user_id!: number;

    @ManyToOne(() => DRAUsersPlatform, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user!: Relation<DRAUsersPlatform>;

    @Column({ type: 'integer', nullable: true })
    organization_id!: number | null;

    @ManyToOne(() => DRAOrganization, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'organization_id' })
    organization!: Relation<DRAOrganization> | null;

    @Column({ type: 'integer', nullable: true })
    subscription_id!: number | null;

    @ManyToOne(() => DRAOrganizationSubscription, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'subscription_id' })
    subscription!: Relation<DRAOrganizationSubscription> | null;

    // Redemption details
    @CreateDateColumn()
    redeemed_at!: Date;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    discount_applied!: number;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    original_price!: number;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    final_price!: number;

    // Status
    @Column({ 
        type: 'varchar', 
        length: 20, 
        default: 'active',
        comment: 'active, expired, cancelled'
    })
    status!: ERedemptionStatus;

    @Column({ type: 'timestamp', nullable: true })
    expires_at!: Date | null;
}
