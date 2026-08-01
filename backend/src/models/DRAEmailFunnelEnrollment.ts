import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { DRAEmailFunnel } from './DRAEmailFunnel.js';

@Entity('dra_email_funnel_enrollments')
export class DRAEmailFunnelEnrollment {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ name: 'funnel_id', type: 'integer' })
    funnel_id!: number;

    @Column({ type: 'varchar', length: 255 })
    lead_email!: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    lead_name!: string | null;

    @Column({ name: 'lead_generator_id', type: 'integer', nullable: true })
    lead_generator_id!: number | null;

    @Column({ name: 'user_id', type: 'integer', nullable: true })
    user_id!: number | null;

    @Column({ type: 'int', default: 0 })
    current_step!: number;

    @Column({ type: 'int' })
    total_steps!: number;

    @CreateDateColumn({ type: 'timestamptz' })
    started_at!: Date;

    @Column({ type: 'timestamptz', nullable: true })
    completed_at!: Date | null;

    @Column({ type: 'boolean', default: true })
    is_active!: boolean;

    @Column({ type: 'timestamptz', nullable: true })
    last_sent_at!: Date | null;

    @ManyToOne(() => DRAEmailFunnel, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'funnel_id' })
    funnel!: DRAEmailFunnel;
}
