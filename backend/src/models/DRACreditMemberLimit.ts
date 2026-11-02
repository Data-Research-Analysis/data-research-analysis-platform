import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Per-member monthly credit limit (admin-controlled spend guard).
 *
 * A workspace admin can cap how many credits a single member may consume per
 * UTC month. The limit is optional: no row, or a null limit, means the member
 * is only bounded by the workspace balance and the workspace spend cap.
 *
 * `monthly_spent_credits` is reset lazily when the stored period no longer
 * matches the current UTC month, so no separate cron job is required.
 */
@Entity('dra_credit_member_limits')
@Index('idx_credit_member_limits_org_user', ['org_id', 'user_id'], { unique: true })
export class DRACreditMemberLimit {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'int' })
    org_id!: number;

    @Column({ type: 'int' })
    user_id!: number;

    /** Hard monthly cap for this member, or null for no member-specific cap. */
    @Column({ type: 'decimal', precision: 14, scale: 2, nullable: true })
    monthly_limit_credits!: number | null;

    /** Credits consumed by this member in the current period. */
    @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
    monthly_spent_credits!: number;

    /** First day (UTC) of the period the counter belongs to. */
    @Column({ type: 'date' })
    period_start!: string;

    @CreateDateColumn({ type: 'timestamp' })
    created_at!: Date;

    @UpdateDateColumn({ type: 'timestamp' })
    updated_at!: Date;
}
