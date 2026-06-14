import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Relation } from 'typeorm';
import { DRADataSource } from './DRADataSource.js';

/**
 * Entity for storing column metadata associated with data models.
 * Maps physical column names to logical names, data types, and analysis metadata.
 */
@Entity('dra_columns')
export class DRAColumn {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'int', name: 'data_model_id' })
    data_model_id!: number;

    @Column({ type: 'varchar', length: 255, name: 'name' })
    name!: string;

    @Column({ type: 'varchar', length: 255, nullable: true, name: 'physical_name' })
    physical_name?: string;

    @Column({ type: 'varchar', length: 100, name: 'data_type' })
    data_type!: string;

    @Column({ type: 'boolean', default: false, name: 'is_nullable' })
    is_nullable!: boolean;

    @Column({ type: 'boolean', default: false, name: 'is_primary_key' })
    is_primary_key!: boolean;

    @Column({ type: 'int', nullable: true, name: 'ordinal_position' })
    ordinal_position?: number;

    @Column({ type: 'text', nullable: true, name: 'description' })
    description?: string;

    @Column({ type: 'varchar', length: 255, nullable: true, name: 'label' })
    label?: string;

    @Column({ type: 'varchar', length: 100, nullable: true, name: 'classification' })
    classification?: string;

    @Column({ type: 'varchar', length: 255, nullable: true, name: 'kpi_pattern' })
    kpi_pattern?: string;

    @Column({ type: 'int', nullable: true, name: 'data_source_id' })
    data_source_id?: number;

    @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
    created_at!: Date;

    @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
    updated_at!: Date;

    @ManyToOne(() => DRADataSource, { onDelete: 'CASCADE', nullable: true })
    @JoinColumn({ name: 'data_source_id' })
    data_source?: Relation<DRADataSource>;
}