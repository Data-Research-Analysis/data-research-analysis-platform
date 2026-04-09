import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
    type Relation
} from 'typeorm';
import { DRAUsersPlatform } from './DRAUsersPlatform.js';
import { DRAOrganization } from './DRAOrganization.js';

@Entity('dra_downgrade_requests')
@Index(['status'])
@Index(['created_at'])
export class DRADowngradeRequest {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'integer', name: 'user_id' })
    user_id!: number;

    @ManyToOne(() => DRAUsersPlatform, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user!: Relation<DRAUsersPlatform>;

    @Column({ type: 'integer', name: 'organization_id', nullable: true })
    organization_id!: number | null;

    @ManyToOne(() => DRAOrganization, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'organization_id' })
    organization!: Relation<DRAOrganization> | null;

    @Column({ type: 'varchar', length: 50 })
    current_tier!: string;

    @Column({ type: 'varchar', length: 50 })
    requested_tier!: string;

    @Column({ type: 'varchar', length: 100 })
    reason!: string;

    @Column({ type: 'text', nullable: true })
    message!: string | null;

    @Column({ type: 'varchar', length: 50, default: 'pending' })
    status!: string; // pending, contacted, approved, declined, completed

    @CreateDateColumn()
    created_at!: Date;

    @Column({ type: 'timestamp', nullable: true })
    contacted_at!: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    completed_at!: Date | null;

    @UpdateDateColumn()
    updated_at!: Date;
}
