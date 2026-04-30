import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Relation,
    Unique
} from 'typeorm';
import { DRAUsersPlatform } from './DRAUsersPlatform.js';
import { DRAOrganization } from './DRAOrganization.js';

@Entity('dra_sso_user_mappings')
@Unique(['user_id', 'organization_id', 'sso_name_id'])
export class DRASSOUserMapping {
    @PrimaryGeneratedColumn()
    id!: number;

    @ManyToOne(() => DRAUsersPlatform, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user!: Relation<DRAUsersPlatform>;

    @Column({ type: 'int', name: 'user_id' })
    user_id!: number;

    @ManyToOne(() => DRAOrganization, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'organization_id' })
    organization!: Relation<DRAOrganization>;

    @Column({ type: 'int', name: 'organization_id' })
    organization_id!: number;

    @Column({ type: 'varchar', length: 512 })
    sso_name_id!: string;

    @Column({ type: 'varchar', length: 100 })
    sso_provider!: string;

    @Column({ type: 'timestamp', nullable: true })
    last_sso_login_at!: Date | null;

    @Column({ type: 'jsonb', nullable: true })
    sso_attributes!: Record<string, any> | null;

    @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
    created_at!: Date;
}