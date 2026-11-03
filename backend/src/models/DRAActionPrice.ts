import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Per-action credit pricing (implementation plan §4.4).
 *
 * action_key matches AI_FEATURE_KEYS plus non-AI keys (plan_deck_export,
 * plan_pack_export, report_pdf_export, data_model_generate, data_quality).
 *
 * charge_mode:
 *  - per_call  : one credit charge per AI call (chats, grounding, join inference)
 *  - per_action: one credit charge per user-facing deliverable (plan build,
 *                analyses, exports) — charged via reserve/settle at the
 *                action boundary, never per call.
 *
 * band_type + band_multipliers: for actions whose cost scales with data size
 * (row_band / event_band), the base credit price is multiplied by the band
 * multiplier selected by the caller (e.g. 15/30/60 for model analysis).
 */
@Entity('dra_action_prices')
export class DRAActionPrice {
    @PrimaryGeneratedColumn()
    id!: number;

    @Index('idx_action_prices_key')
    @Column({ type: 'varchar', length: 64, unique: true })
    action_key!: string;

    @Column({ type: 'varchar', length: 100 })
    display_name!: string;

    @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
    credits!: number;

    @Column({ type: 'varchar', length: 20, default: 'per_action' })
    charge_mode!: 'per_call' | 'per_action';

    @Column({ type: 'varchar', length: 20, default: 'fixed' })
    band_type!: 'fixed' | 'row_band' | 'event_band';

    /** JSON array of multipliers, e.g. [1, 2, 3] for ×1/×2/×3 bands. */
    @Column({ type: 'jsonb', nullable: true })
    band_multipliers!: number[] | null;

    @Column({ type: 'boolean', default: true })
    is_active!: boolean;

    @CreateDateColumn({ type: 'timestamp' })
    created_at!: Date;

    @UpdateDateColumn({ type: 'timestamp' })
    updated_at!: Date;
}
