import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Relation
} from 'typeorm';
import { DRAOrganization } from './DRAOrganization.js';

@Entity('dra_domain_verifications')
export class DRADomainVerification {
    @PrimaryGeneratedColumn()
    id!: number;

    @ManyToOne(() => DRAOrganization, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'organization_id' })
    organization!: Relation<DRAOrganization>;

    @Column({ type: 'int', name: 'organization_id' })
    organization_id!: number;

    @Column({ type: 'varchar', length: 255 })
    domain!: string;

    @Column({ type: 'varchar', length: 100 })
    verification_token!: string;

    @Column({ type: 'varchar', length: 20, default: 'pending' })
    status!: 'pending' | 'verified' | 'failed';

    @Column({ type: 'timestamp', nullable: true })
    verified_at!: Date | null;

    @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
    created_at!: Date;
}