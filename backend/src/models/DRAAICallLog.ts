import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * AI call log (AI-Usage instrumentation).
 *
 * One row per Gemini call. Cost is computed at write time from the model's
 * published rates (see AICallTrackerService). User-facing actions are formed
 * by grouping rows on (feature_key, action_id).
 */
@Entity('ai_call_logs')
export class DRAAICallLog {
    @PrimaryGeneratedColumn()
    id!: number;

    @Index('idx_ai_call_logs_org_created')
    @Column({ type: 'int', name: 'org_id', nullable: true })
    org_id!: number | null;

    @Column({ type: 'int', name: 'user_id', nullable: true })
    user_id!: number | null;

    @Column({ type: 'int', name: 'project_id', nullable: true })
    project_id!: number | null;

    /** Enum of user-facing AI features — see AICallTrackerService.FEATURE_KEYS */
    @Index('idx_ai_call_logs_feature_created')
    @Column({ type: 'varchar', length: 64, name: 'feature_key' })
    feature_key!: string;

    /** Groups the N calls of one user-facing action (plan_id, conversation_id, ...) */
    @Index('idx_ai_call_logs_action')
    @Column({ type: 'varchar', length: 128, name: 'action_id', nullable: true })
    action_id!: string | null;

    @Column({ type: 'varchar', length: 64, name: 'model_id' })
    model_id!: string;

    @Column({ type: 'int', default: 0, name: 'input_tokens' })
    input_tokens!: number;

    @Column({ type: 'int', default: 0, name: 'cached_input_tokens' })
    cached_input_tokens!: number;

    @Column({ type: 'int', default: 0, name: 'output_tokens' })
    output_tokens!: number;

    /** Subset of output_tokens produced by the model's thinking on reasoning models. */
    @Column({ type: 'int', default: 0, name: 'thought_tokens' })
    thought_tokens!: number;

    @Column({ type: 'int', default: 0, name: 'total_tokens' })
    total_tokens!: number;

    /** success | failed | fallback | skipped_no_data */
    @Column({ type: 'varchar', length: 20, default: 'success', name: 'status' })
    status!: string;

    @Column({ type: 'text', name: 'error_info', nullable: true })
    error_info!: string | null;

    @Column({ type: 'int', default: 0, name: 'latency_ms' })
    latency_ms!: number;

    @Column({ type: 'decimal', precision: 12, scale: 6, default: 0, name: 'cost_usd' })
    cost_usd!: number;

    /** Whether the call used the context-caching config. */
    @Column({ type: 'boolean', default: false, name: 'cache_enabled' })
    cache_enabled!: boolean;

    @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
    created_at!: Date;
}
