import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { DRAEmailFunnel } from './DRAEmailFunnel.js';

@Entity('dra_email_funnel_steps')
export class DRAEmailFunnelStep {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ name: 'funnel_id', type: 'integer' })
    funnel_id!: number;

    @Column({ type: 'int' })
    step_order!: number;

    @Column({ type: 'int' })
    delay_hours!: number;

    @Column({ type: 'varchar', length: 500 })
    template_file!: string;

    @Column({ type: 'varchar', length: 255 })
    subject_template!: string;

    @Column({ type: 'boolean', default: true })
    is_active!: boolean;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at!: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updated_at!: Date;

    @ManyToOne(() => DRAEmailFunnel, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'funnel_id' })
    funnel!: DRAEmailFunnel;
}
