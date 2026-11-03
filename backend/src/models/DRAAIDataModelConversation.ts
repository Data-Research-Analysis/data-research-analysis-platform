import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
    Relation,
    UpdateDateColumn,
} from 'typeorm';
import { DRADataSource } from './DRADataSource.js';
import { DRAUsersPlatform } from './DRAUsersPlatform.js';
import { DRADataModel } from './DRADataModel.js';
import { DRAAIDataModelMessage } from './DRAAIDataModelMessage.js';

@Entity('dra_ai_data_model_conversations')
export class DRAAIDataModelConversation {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'varchar', length: 255 })
    title!: string;

    @Column({
        type: 'enum',
        enum: ['draft', 'saved', 'archived'],
        default: 'draft',
    })
    status!: 'draft' | 'saved' | 'archived';

    @Column({ type: 'timestamp', name: 'started_at', default: () => 'CURRENT_TIMESTAMP' })
    started_at!: Date;

    @Column({ type: 'timestamp', name: 'saved_at', nullable: true })
    saved_at!: Date | null;

    @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
    created_at!: Date;

    @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
    updated_at!: Date;

    /** Gemini conversation id (Redis session key). Persisted so the session survives Redis TTL. */
    @Column({ type: 'varchar', length: 255, name: 'conversation_id', nullable: true })
    conversation_id!: string | null;

    /** Schema context (tables + inferred joins). Persisted so a session can be restored after Redis TTL. */
    @Column({ type: 'jsonb', name: 'schema_context', nullable: true })
    schema_context!: Record<string, any> | null;

    /** In-progress model draft (AI Data Modeler). Persisted so the draft survives Redis TTL. */
    @Column({ type: 'jsonb', name: 'model_draft', nullable: true })
    model_draft!: Record<string, any> | null;

    // Relations
    @ManyToOne(() => DRADataSource, (dataSource) => dataSource.ai_conversations, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'data_source_id', referencedColumnName: 'id' })
    data_source!: Relation<DRADataSource>;

    @ManyToOne(() => DRAUsersPlatform, (user) => user.ai_conversations, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id', referencedColumnName: 'id' })
    user!: Relation<DRAUsersPlatform>;

    @ManyToOne(() => DRADataModel, (dataModel) => dataModel.ai_conversations, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'data_model_id', referencedColumnName: 'id' })
    data_model!: Relation<DRADataModel> | null;

    @OneToMany(() => DRAAIDataModelMessage, (message) => message.conversation)
    messages!: Relation<DRAAIDataModelMessage>[];
}
