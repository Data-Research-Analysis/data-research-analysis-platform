import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    Relation,
} from 'typeorm';
import { DRAAIDataModelConversation } from './DRAAIDataModelConversation.js';

@Entity('dra_ai_data_model_messages')
export class DRAAIDataModelMessage {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({
        type: 'enum',
        enum: ['user', 'assistant', 'system'],
    })
    role!: 'user' | 'assistant' | 'system';

    @Column({ type: 'text' })
    content!: string;

    @Column({ type: 'json', nullable: true })
    metadata!: Record<string, any> | null;

    @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
    created_at!: Date;

    // Relations
    @ManyToOne(() => DRAAIDataModelConversation, (conversation) => conversation.messages, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'conversation_id', referencedColumnName: 'id' })
    conversation!: Relation<DRAAIDataModelConversation>;
}
