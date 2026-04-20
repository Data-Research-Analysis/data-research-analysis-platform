import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    Relation,
} from 'typeorm';
import { DRALeadGenerator } from './DRALeadGenerator.js';

@Entity('dra_lead_generator_leads')
export class DRALeadGeneratorLead {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'int' })
    lead_generator_id!: number;

    @Column({ type: 'varchar', length: 255, nullable: true })
    full_name!: string | null;

    @Column({ type: 'varchar', length: 255 })
    email!: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    company!: string | null;

    @Column({ type: 'varchar', length: 50, nullable: true })
    phone!: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    job_title!: string | null;

    @Column({ type: 'varchar', length: 45, nullable: true })
    ip_address!: string | null;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at!: Date;

    @ManyToOne(() => DRALeadGenerator, (lg) => lg.leads, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'lead_generator_id' })
    lead_generator!: Relation<DRALeadGenerator>;
}
