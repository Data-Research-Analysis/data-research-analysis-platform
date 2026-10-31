import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Workspace-level credit wallet (implementation plan §4.1).
 *
 * One row per org. All credit balance changes go through
 * CreditWalletService so the ledger (DRACreditTransaction) stays in sync.
 */
@Entity('dra_credit_wallets')
export class DRACreditWallet {
    @PrimaryGeneratedColumn()
    id!: number;

    @Index('idx_credit_wallets_org')
    @Column({ type: 'int', unique: true })
    org_id!: number;

    /** Current spendable balance (grant + packs - consumption). */
    @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
    balance_credits!: number;

    /** Portion of the balance that rolled over from a previous month. */
    @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
    rollover_balance!: number;

    /**
     * Unused part of the current month's grant. Non-rollover plans expire only
     * this amount at the next grant, so purchased pack credits are preserved.
     */
    @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
    monthly_credits_remaining!: number;

    /** Monthly grant amount for this org (set from the mapped plan). */
    @Column({ type: 'decimal', precision: 14, scale: 2, default: 500 })
    monthly_grant_amount!: number;

    /** When the current month's grant was applied (idempotency guard). */
    @Column({ type: 'timestamp', nullable: true })
    monthly_credits_granted_at!: Date | null;

    /** Auto-recharge: recharge when balance drops below this threshold. */
    @Column({ type: 'decimal', precision: 14, scale: 2, nullable: true })
    auto_recharge_threshold!: number | null;

    /** Auto-recharge: which pack to purchase on recharge. */
    @Column({ type: 'int', nullable: true })
    auto_recharge_pack_id!: number | null;

    @Column({ type: 'varchar', length: 3, default: 'USD' })
    currency!: string;

    @CreateDateColumn({ type: 'timestamp' })
    created_at!: Date;

    @UpdateDateColumn({ type: 'timestamp' })
    updated_at!: Date;
}
