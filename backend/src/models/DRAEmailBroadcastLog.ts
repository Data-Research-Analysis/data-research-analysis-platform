import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('dra_email_broadcast_log')
export class DRAEmailBroadcastLog {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ name: 'broadcast_id', type: 'integer' })
    broadcast_id!: number;

    @Column({ type: 'varchar', length: 255 })
    recipient_email!: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    recipient_name!: string | null;

    @Column({ type: 'text', nullable: true })
    subject!: string | null;

    @CreateDateColumn({ type: 'timestamptz', name: 'sent_at' })
    sent_at!: Date;

    @Column({ type: 'timestamptz', nullable: true })
    opened_at!: Date | null;

    @Column({ type: 'timestamptz', nullable: true })
    clicked_at!: Date | null;

    @Column({ type: 'text', nullable: true })
    error!: string | null;
}
