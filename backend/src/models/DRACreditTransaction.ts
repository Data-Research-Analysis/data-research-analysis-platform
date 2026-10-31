import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type CreditTransactionType =
    | 'grant'      // monthly allowance credited
    | 'purchase'   // pack bought
    | 'consume'    // action charged (negative)
    | 'release'    // reservation released on failure (positive)
    | 'refund'     // pack/overcharge refunded (positive)
    | 'expire'     // rollover policy expiry
    | 'adjust';    // support/admin correction (signed)

export type CreditTransactionStatus = 'reserved' | 'settled' | 'released';

/**
 * Immutable credit transaction ledger (implementation plan §4.2).
 *
 * Every balance change writes a row; rows are never mutated after insert
 * except the one transition of a reservation marker (reserved -> settled /
 * released), which is a hold state, not a completed ledger event.
 * Purchase rows are idempotent on paddle_transaction_id.
 */
@Entity('dra_credit_transactions')
export class DRACreditTransaction {
    @PrimaryGeneratedColumn()
    id!: number;

    @Index('idx_credit_tx_org_created')
    @Column({ type: 'int' })
    org_id!: number;

    /** grant | purchase | consume | release | refund | expire | adjust */
    @Column({ type: 'varchar', length: 20 })
    type!: CreditTransactionType;

    /** Signed credits: positive adds to balance, negative deducts. */
    @Column({ type: 'decimal', precision: 14, scale: 2 })
    amount!: number;

    /** subscription_month | pack | promo | support | refund | system | plan_build */
    @Column({ type: 'varchar', length: 30 })
    source!: string;

    /** AI_FEATURE_KEYS value or non-AI key (plan_deck_export, ...) */
    @Index('idx_credit_tx_action')
    @Column({ type: 'varchar', length: 64, nullable: true })
    action_key!: string | null;

    /** plan_id / ai_call_log id / conversation id */
    @Column({ type: 'varchar', length: 128, nullable: true })
    action_ref_id!: string | null;

    /** Groups reserve/settle/release of one multi-step action. */
    @Index('idx_credit_tx_reservation')
    @Column({ type: 'varchar', length: 64, nullable: true })
    reservation_id!: string | null;

    /** reserved (held) | settled (consumed) | released (refunded) */
    @Column({ type: 'varchar', length: 20, default: 'settled' })
    status!: CreditTransactionStatus;

    /** Paddle transaction id for pack purchases (idempotency key). */
    @Column({ type: 'varchar', length: 100, nullable: true })
    paddle_transaction_id!: string | null;

    @Column({ type: 'text', nullable: true })
    description!: string | null;

    @CreateDateColumn({ type: 'timestamp' })
    created_at!: Date;
}
