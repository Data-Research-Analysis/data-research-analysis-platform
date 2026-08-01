import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('dra_email_funnel_sent_log')
export class DRAEmailFunnelSentLog {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ name: 'enrollment_id', type: 'integer' })
    enrollment_id!: number;

    @Column({ name: 'step_id', type: 'integer' })
    step_id!: number;

    @CreateDateColumn({ type: 'timestamptz', name: 'sent_at' })
    sent_at!: Date;

    @Column({ type: 'timestamptz', nullable: true })
    opened_at!: Date | null;

    @Column({ type: 'timestamptz', nullable: true })
    clicked_at!: Date | null;

    @Column({ type: 'text', nullable: true })
    error!: string | null;
}
