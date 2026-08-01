import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('dra_email_broadcasts')
export class DRAEmailBroadcast {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'varchar', length: 255 })
    subject!: string;

    @Column({ type: 'varchar', length: 255 })
    template_file!: string;

    @Column({ type: 'text' })
    template_data!: string;

    @Column({ type: 'varchar', length: 50 })
    audience!: string;

    @Column({ type: 'timestamptz', nullable: true })
    scheduled_at!: Date | null;

    @Column({ type: 'varchar', length: 20, default: 'pending' })
    status!: string;

    @Column({ type: 'boolean', default: false })
    paused!: boolean;

    @Column({ type: 'int', default: 0 })
    sent_count!: number;

    @Column({ type: 'int', default: 0 })
    total_count!: number;

    @Column({ type: 'timestamptz', nullable: true })
    sent_at!: Date | null;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at!: Date;
}
