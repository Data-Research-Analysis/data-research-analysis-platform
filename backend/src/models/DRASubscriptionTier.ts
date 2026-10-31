import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, Relation, UpdateDateColumn } from 'typeorm';
import { DRAOrganizationSubscription } from './DRAOrganizationSubscription.js';

/**
 * Subscription Tier Entity
 * 
 * Tier comparison is done via numeric tier_rank field:
 * - 0: Free
 * - 10: Starter
 * - 20: Professional
 * - 30: Professional Plus
 * - 40: Enterprise
 * 
 * tier_name can be any display name (e.g., "Data Research Analysis Professional Plus Plan")
 * The rank determines upgrade/downgrade logic.
 */
@Entity('dra_subscription_tiers')
export class DRASubscriptionTier {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'varchar', length: 100, unique: true })
    tier_name!: string;

    @Column({ type: 'int', default: 0, comment: 'Numeric rank for tier comparison (higher = better tier)' })
    tier_rank!: number;

    @Column({ type: 'bigint' })
    max_rows_per_data_model!: number;

    /** Monthly AI cost ceiling per org in USD for fair-use enforcement.
     *  Null = no ceiling (Enterprise negotiates). */
    @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
    ai_cost_ceiling_usd!: number | null;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    price_per_month_usd!: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    price_per_year_usd!: number | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    paddle_price_id_monthly!: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    paddle_price_id_annual!: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    paddle_product_id!: string | null;

    /** Paddle recurring price for 1,000 Pro credits, billed monthly.
     *  Used with quantity = credits / 1000 for the variable-credit Pro plan. */
    @Column({ type: 'varchar', length: 100, nullable: true })
    paddle_credits_unit_price_id_monthly!: string | null;

    /** Paddle recurring price for 1,000 Pro credits, billed annually. */
    @Column({ type: 'varchar', length: 100, nullable: true })
    paddle_credits_unit_price_id_annual!: string | null;

    @Column({ type: 'boolean', default: true })
    is_active!: boolean;

    /** How many days the org retains access after a payment failure before being downgraded */
    @Column({ type: 'int', default: 14 })
    grace_period_days!: number;

    /** Monthly credit allowance granted to the org wallet in credit-pricing
     *  mode (0 = custom/admin-managed, e.g. ENTERPRISE). */
    @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
    credits_per_month!: number;

    /** Whether unused monthly credits roll over to the next month (FREE = false). */
    @Column({ type: 'boolean', default: true })
    credits_rollover!: boolean;

    @CreateDateColumn({ type: 'timestamp' })
    created_at!: Date;

    @UpdateDateColumn({ type: 'timestamp' })
    updated_at!: Date;

    @OneToMany(() => DRAOrganizationSubscription, (subscription) => subscription.subscription_tier)
    organization_subscriptions!: Relation<DRAOrganizationSubscription>[];
}
