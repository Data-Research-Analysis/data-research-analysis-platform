import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('dra_email_funnel_unsubscribes')
export class DRAEmailFunnelUnsubscribe {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'varchar', length: 255 })
    email!: string;

    @Column({ name: 'funnel_id', type: 'integer', nullable: true })
    funnel_id!: number | null;

    @Column({ type: 'varchar', length: 255 })
    token!: string;

    @CreateDateColumn({ type: 'timestamptz', name: 'unsubscribed_at' })
    unsubscribed_at!: Date;
}
