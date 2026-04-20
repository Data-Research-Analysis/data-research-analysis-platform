import {
    Column,
    CreateDateColumn,
    Entity,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { DRALeadGeneratorLead } from './DRALeadGeneratorLead.js';

@Entity('dra_lead_generators')
export class DRALeadGenerator {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'varchar', length: 255 })
    title!: string;

    @Column({ type: 'varchar', length: 255, unique: true })
    slug!: string;

    @Column({ type: 'text', nullable: true })
    description!: string | null;

    @Column({ type: 'varchar', length: 500 })
    file_name!: string;

    @Column({ type: 'varchar', length: 500 })
    original_file_name!: string;

    @Column({ type: 'boolean', default: true })
    is_gated!: boolean;

    @Column({ type: 'boolean', default: true })
    is_active!: boolean;

    @Column({ type: 'int', default: 0 })
    view_count!: number;

    @Column({ type: 'int', default: 0 })
    download_count!: number;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at!: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updated_at!: Date;

    @OneToMany(() => DRALeadGeneratorLead, (lead) => lead.lead_generator)
    leads!: DRALeadGeneratorLead[];
}
