import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Credit pack catalog (implementation plan §4.3).
 *
 * One-time (non-recurring) Paddle prices; paddle_price_id is populated
 * when the Paddle sandbox/production prices are created (Phase 2).
 */
@Entity('dra_credit_packs')
export class DRACreditPack {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'varchar', length: 100 })
    name!: string;

    @Column({ type: 'decimal', precision: 14, scale: 2 })
    credits!: number;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    price_usd!: number;

    @Column({ type: 'varchar', length: 100, nullable: true })
    paddle_price_id!: string | null;

    @Column({ type: 'boolean', default: true })
    is_active!: boolean;

    @Column({ type: 'int', default: 0 })
    sort_order!: number;

    @CreateDateColumn({ type: 'timestamp' })
    created_at!: Date;

    @UpdateDateColumn({ type: 'timestamp' })
    updated_at!: Date;
}
