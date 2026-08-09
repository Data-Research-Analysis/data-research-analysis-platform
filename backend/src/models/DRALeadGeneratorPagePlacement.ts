import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity('dra_lead_generator_page_placements')
export class DRALeadGeneratorPagePlacement {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ name: 'lead_generator_id', type: 'integer' })
    lead_generator_id!: number;

    @Column({ type: 'varchar', length: 500 })
    page_url!: string;

    @Column({ type: 'int', default: 3 })
    frequency!: number;

    @Column({ type: 'text', nullable: true })
    additional_content!: string | null;

    @Column({ type: 'boolean', default: true })
    is_active!: boolean;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at!: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updated_at!: Date;

    @ManyToOne('DRALeadGenerator', 'placements', { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'lead_generator_id' })
    lead_generator!: any;
}
