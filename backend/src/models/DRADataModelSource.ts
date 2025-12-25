import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Relation } from 'typeorm';
import { DRADataModel } from './DRADataModel.js';
import { DRADataSource } from './DRADataSource.js';
import { DRAUsersPlatform } from './DRAUsersPlatform.js';

/**
 * Junction table entity for many-to-many relationship between data models and data sources
 * Allows a single data model to reference multiple data sources (cross-source models)
 */
@Entity('dra_data_model_sources')
export class DRADataModelSource {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'int', name: 'data_model_id' })
    data_model_id!: number;

    @Column({ type: 'int', name: 'data_source_id' })
    data_source_id!: number;

    @ManyToOne(() => DRADataModel, model => model.data_model_sources, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'data_model_id' })
    data_model!: DRADataModel;

    @ManyToOne(() => DRADataSource, source => source.data_model_sources, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'data_source_id' })
    data_source!: DRADataSource;

    @Column({ type: 'int', name: 'users_platform_id' })
    users_platform_id!: number;

    @ManyToOne(() => DRAUsersPlatform, user => user.data_model_sources, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'users_platform_id' })
    users_platform!: Relation<DRAUsersPlatform>;

    @CreateDateColumn({ type: 'timestamp', name: 'created_at', default: () => 'NOW()' })
    created_at!: Date;
}
