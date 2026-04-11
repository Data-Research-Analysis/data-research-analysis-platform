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

@Entity('dra_enterprise_contact_requests')
export class DRAEnterpriseContactRequest {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'integer', name: 'user_id' })
    @Index('idx_enterprise_requests_user_id')
    user_id!: number;

    @ManyToOne(() => DRAUsersPlatform, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user!: Relation<DRAUsersPlatform>;

    @Column({ type: 'integer', name: 'organization_id', nullable: true })
    organization_id?: number;

    @ManyToOne(() => DRAOrganization, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'organization_id' })
    organization?: Relation<DRAOrganization>;

    @Column({ type: 'varchar', length: 255, name: 'company_name' })
    company_name!: string;

    @Column({ type: 'varchar', length: 50, name: 'team_size' })
    team_size!: string;

    @Column({ type: 'text', nullable: true })
    message?: string;

    @Column({ type: 'varchar', length: 50, default: 'pending' })
    @Index('idx_enterprise_requests_status')
    status!: string;

    @Column({ type: 'text', nullable: true, name: 'admin_notes' })
    admin_notes?: string;

    @CreateDateColumn({ name: 'created_at' })
    @Index('idx_enterprise_requests_created_at')
    created_at!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updated_at!: Date;

    @Column({ type: 'timestamp', nullable: true, name: 'contacted_at' })
    contacted_at?: Date;
}
