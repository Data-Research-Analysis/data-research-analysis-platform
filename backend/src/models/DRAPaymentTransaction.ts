import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { DRAOrganization } from './DRAOrganization.js';
import { DRAOrganizationSubscription } from './DRAOrganizationSubscription.js';

export type PaymentTransactionType = 'charge' | 'refund' | 'credit' | 'adjustment';
export type PaymentTransactionStatus = 'completed' | 'failed' | 'pending' | 'reversed';

/**
 * Financial transaction ledger.
 *
 * Records every billable event: new subscription charges, renewals, proration
 * charges/credits on upgrade/downgrade, refunds, and Paddle adjustments.
 * Intended as an immutable audit log — rows are never updated after insert.
 */
@Entity('dra_payment_transactions')
export class DRAPaymentTransaction {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'int' })
    organization_id!: number;

    @Column({ type: 'int', nullable: true })
    subscription_id!: number | null;

    /** Paddle transaction ID — unique per billed event */
    @Column({ type: 'varchar', length: 100, nullable: true, unique: true })
    paddle_transaction_id!: string | null;

    /** charge | refund | credit | adjustment */
    @Column({ type: 'varchar', length: 20 })
    transaction_type!: PaymentTransactionType;

    /** Gross amount (positive for charge/adjustment, negative for refund/credit) */
    @Column({ type: 'decimal', precision: 10, scale: 2 })
    amount!: number;

    @Column({ type: 'varchar', length: 3, default: 'USD' })
    currency!: string;

    @Column({ type: 'text', nullable: true })
    description!: string | null;

    /** Direct link to the Paddle-hosted invoice PDF */
    @Column({ type: 'text', nullable: true })
    paddle_invoice_url!: string | null;

    @Column({ type: 'varchar', length: 20, default: 'completed' })
    status!: PaymentTransactionStatus;

    /** Human-readable tier name at the time of charge */
    @Column({ type: 'varchar', length: 50, nullable: true })
    tier_name!: string | null;

    /** monthly | annual */
    @Column({ type: 'varchar', length: 10, nullable: true })
    billing_cycle!: string | null;

    /** When Paddle processed the transaction */
    @Column({ type: 'timestamp', nullable: true })
    processed_at!: Date | null;

    @CreateDateColumn()
    created_at!: Date;

    // -------------------------------------------------- Relations
    @ManyToOne(() => DRAOrganization, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'organization_id' })
    organization!: DRAOrganization;

    @ManyToOne(() => DRAOrganizationSubscription, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'subscription_id' })
    subscription!: DRAOrganizationSubscription | null;
}
