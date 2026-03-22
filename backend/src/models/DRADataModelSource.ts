import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Relation } from 'typeorm';
import { DRADataModel } from './DRADataModel.js';
import { DRADataSource } from './DRADataSource.js';
import { DRAUsersPlatform } from './DRAUsersPlatform.js';
import { DRAOrganization } from './DRAOrganization.js';
import { DRAWorkspace } from './DRAWorkspace.js';

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
    data_model!: Relation<DRADataModel>;

    @ManyToOne(() => DRADataSource, source => source.data_model_sources, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'data_source_id' })
    data_source!: Relation<DRADataSource>;

    @Column({ type: 'int', name: 'users_platform_id' })
    users_platform_id!: number;

    @ManyToOne(() => DRAUsersPlatform, user => user.data_model_sources, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'users_platform_id' })
    users_platform!: Relation<DRAUsersPlatform>;

    /**
     * REQUIRED: Organization and workspace (Phase 2 Migration)
     * Inherits from parent data model
     */
    @ManyToOne(() => DRAOrganization, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'organization_id' })
    organization!: Relation<DRAOrganization>;

    @Column({ type: 'int', name: 'organization_id' })
    organization_id!: number;

    @ManyToOne(() => DRAWorkspace, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'workspace_id' })
    workspace!: Relation<DRAWorkspace>;

    @Column({ type: 'int', name: 'workspace_id' })
    workspace_id!: number;

    @CreateDateColumn({ type: 'timestamp', name: 'created_at', default: () => 'NOW()' })
    created_at!: Date;
}
