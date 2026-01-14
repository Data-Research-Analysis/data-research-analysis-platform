import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, Relation, UpdateDateColumn } from 'typeorm';
import { DRAUserSubscription } from './DRAUserSubscription.js';

export enum ESubscriptionTier {
    FREE = 'free',
    PRO = 'pro',
    TEAM = 'team',
    BUSINESS = 'business',
    ENTERPRISE = 'enterprise'
}

@Entity('dra_subscription_tiers')
export class DRASubscriptionTier {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'varchar', length: 50, unique: true })
    tier_name!: string;

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

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    price_per_month_usd!: number;

    @Column({ type: 'boolean', default: true })
    is_active!: boolean;

    @CreateDateColumn({ type: 'timestamp' })
    created_at!: Date;

    @UpdateDateColumn({ type: 'timestamp' })
    updated_at!: Date;

    @OneToMany(() => DRAUserSubscription, (subscription) => subscription.subscription_tier)
    user_subscriptions!: Relation<DRAUserSubscription>[];
}
