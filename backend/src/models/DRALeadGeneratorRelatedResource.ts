import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { DRALeadGenerator } from './DRALeadGenerator.js';

@Entity('dra_lead_generator_related_resources')
export class DRALeadGeneratorRelatedResource {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ name: 'lead_generator_id', type: 'integer' })
    lead_generator_id!: number;

    @Column({ type: 'varchar', length: 50 })
    related_type!: string;

    @Column({ name: 'related_id', type: 'integer' })
    related_id!: number;

    @Column({ type: 'int', default: 0 })
    sort_order!: number;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at!: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updated_at!: Date;

    @ManyToOne(() => DRALeadGenerator, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'lead_generator_id' })
    lead_generator!: DRALeadGenerator;
}
