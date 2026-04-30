import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Relation
} from 'typeorm';
import { DRAOrganization } from './DRAOrganization.js';

@Entity('dra_sso_configurations')
export class DRASSOConfiguration {
    @PrimaryGeneratedColumn()
    id!: number;

    @ManyToOne(() => DRAOrganization, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'organization_id' })
    organization!: Relation<DRAOrganization>;

    @Column({ type: 'int', name: 'organization_id', unique: true })
    organization_id!: number;

    @Column({ type: 'varchar', length: 50 })
    idp_name!: string;

    @Column({ type: 'text' })
    idp_entity_id!: string;

    @Column({ type: 'text' })
    idp_sso_url!: string;

    @Column({ type: 'text' })
    idp_certificate!: string;

    @Column({ type: 'text' })
    sp_entity_id!: string;

    @Column({ type: 'jsonb', nullable: true })
    attribute_mapping!: Record<string, string> | null;

    @Column({ type: 'boolean', default: false })
    is_enabled!: boolean;

    @Column({ type: 'boolean', default: true })
    allow_jit_provisioning!: boolean;

    @Column({ type: 'boolean', default: false })
    enforce_sso!: boolean;

    @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
    created_at!: Date;

    @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
    updated_at!: Date;
}