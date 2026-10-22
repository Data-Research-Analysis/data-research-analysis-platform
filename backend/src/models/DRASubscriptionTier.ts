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

    @Column({ type: 'int', nullable: true })
    max_projects!: number | null;

    @Column({ type: 'int', nullable: true })
    max_data_sources_per_project!: number | null;

    @Column({ type: 'int', nullable: true })
    max_data_models_per_data_source!: number | null;

    @Column({ type: 'int', nullable: true })
    max_dashboards!: number | null;

    @Column({ type: 'int', nullable: true })
    max_members_per_project!: number | null;

    @Column({ type: 'int', nullable: true })
    ai_generations_per_month!: number | null;

    /** Paid media plan builds per month (-1/null = unlimited). Counter is
     *  consumed on plan creation and never refunded on deletion. */
    @Column({ type: 'int', nullable: true })
    max_plans_per_month!: number | null;

    /** Whether the paid media plan builder allows the advanced (questionnaire) mode. */
    @Column({ type: 'boolean', default: false })
    plan_advanced_mode_allowed!: boolean;

    /** Whether the plan AI chat is available. */
    @Column({ type: 'boolean', default: false })
    plan_ai_chat_allowed!: boolean;

    /** Whether the client presentation deck (PPTX) export is available. */
    @Column({ type: 'boolean', default: false })
    plan_deck_export_allowed!: boolean;

    /** Whether the BI layer (data models, dashboards, reports, AI insights,
     *  engineering connectors) is available on this tier. */
    @Column({ type: 'boolean', default: false })
    advanced_tools_allowed!: boolean;

    /** Monthly AI cost ceiling per org in USD for fair-use enforcement.
     *  Null = no ceiling (Free/Starter enforce via ai_generations_per_month;
     *  Enterprise negotiates). */
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

    @Column({ type: 'boolean', default: true })
    is_active!: boolean;

    /** How many days the org retains access after a payment failure before being downgraded */
    @Column({ type: 'int', default: 14 })
    grace_period_days!: number;

    @CreateDateColumn({ type: 'timestamp' })
    created_at!: Date;

    @UpdateDateColumn({ type: 'timestamp' })
    updated_at!: Date;

    @OneToMany(() => DRAOrganizationSubscription, (subscription) => subscription.subscription_tier)
    organization_subscriptions!: Relation<DRAOrganizationSubscription>[];
}
