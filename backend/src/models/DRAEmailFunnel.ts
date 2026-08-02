import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity('dra_email_funnels')
export class DRAEmailFunnel {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'varchar', length: 255 })
    name!: string;

    @Column({ type: 'varchar', length: 255, unique: true })
    slug!: string;

    @Column({ type: 'varchar', length: 50 })
    trigger_type!: string;

    @Column({ type: 'varchar', length: 50 })
    target_user_type!: string;

    @Column({ type: 'boolean', default: true })
    is_active!: boolean;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at!: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updated_at!: Date;
}
