import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Relation, CreateDateColumn } from 'typeorm';
import { DRAUsersPlatform } from './DRAUsersPlatform.js';
import { DRADataSource } from './DRADataSource.js';
import { DRAOrganization } from './DRAOrganization.js';
import { DRAWorkspace } from './DRAWorkspace.js';
import { DRAAIDataModelConversation } from './DRAAIDataModelConversation.js';
import { DRADataModelSource } from './DRADataModelSource.js';
import { DRADataModelRefreshHistory } from './DRADataModelRefreshHistory.js';
import { DRADataModelLineage } from './DRADataModelLineage.js';
@Entity('dra_data_models')
export class DRADataModel {
    @PrimaryGeneratedColumn()
    id!: number
    @Column({ type: 'varchar', length: 255 })
    schema!: string
    @Column({ type: 'varchar', length: 255 })
    name!: string
    @Column({ type: 'text' })
    sql_query!: string
    @Column({ type: 'jsonb' })
    query!: JSON
    
    @Column({ type: 'boolean', default: false, name: 'is_cross_source' })
    is_cross_source!: boolean
    
    @Column({ type: 'jsonb', default: {}, name: 'execution_metadata' })
    execution_metadata!: Record<string, any>
    
    @Column({ type: 'timestamp', nullable: true, name: 'last_refreshed_at' })
    last_refreshed_at?: Date
    
    @Column({ type: 'varchar', length: 20, default: 'IDLE', name: 'refresh_status' })
    refresh_status!: 'IDLE' | 'QUEUED' | 'REFRESHING' | 'COMPLETED' | 'FAILED'
    
    @Column({ type: 'text', nullable: true, name: 'refresh_error' })
    refresh_error?: string
    
    @Column({ type: 'int', nullable: true, name: 'row_count' })
    row_count?: number
    
    @Column({ type: 'int', nullable: true, name: 'last_refresh_duration_ms' })
    last_refresh_duration_ms?: number
    
    @Column({ type: 'boolean', default: true, name: 'auto_refresh_enabled' })
    auto_refresh_enabled!: boolean;

    // ── Data Model Composition (Issue #361) ────────────────────────────────
    // uses_data_models: indicates if this model is built from other data models
    @Column({ type: 'boolean', default: false, name: 'uses_data_models' })
    uses_data_models!: boolean;

    // ── Health enforcement columns (Issue #1) ──────────────────────────────
    // model_type: user/AI classification. NULL = unclassified.
    // 'dimension' models bypass all aggregation enforcement checks.
    @Column({ type: 'varchar', length: 50, nullable: true, name: 'model_type' })
    model_type?: 'dimension' | 'fact' | 'aggregated' | null

    // health_status: computed by DataModelHealthService and persisted at save.
    @Column({ type: 'varchar', length: 50, default: 'unknown', name: 'health_status' })
    health_status!: 'healthy' | 'warning' | 'blocked' | 'unknown'

    // health_issues: serialised array of IHealthIssue objects from DataModelHealthService.
    @Column({ type: 'jsonb', default: [], name: 'health_issues' })
    health_issues!: Record<string, any>[]

    // source_row_count: cached total rows across all source tables (from dra_table_metadata).
    @Column({ type: 'bigint', nullable: true, name: 'source_row_count' })
    source_row_count?: number | null
    
    @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
    created_at!: Date
        
    @ManyToOne(() => DRAUsersPlatform, (usersPlatform) => usersPlatform.data_models)
    @JoinColumn({ name: 'users_platform_id', referencedColumnName: 'id' })
    users_platform!: Relation<DRAUsersPlatform>
    
    @ManyToOne(() => DRADataSource, (dataSource) => dataSource.data_models, { onDelete: 'CASCADE', nullable: true })
    @JoinColumn({ name: 'data_source_id', referencedColumnName: 'id' })
    data_source?: Relation<DRADataSource>
    
    /**
     * REQUIRED: Organization and workspace membership (Phase 2 Migration)
     * Data models inherit organization/workspace from their parent data source.
     * These fields ensure multi-tenant isolation at the data model level.
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
    
    @OneToMany(() => DRADataModelSource, (source) => source.data_model)
    data_model_sources!: Relation<DRADataModelSource>[]

    @OneToMany(() => DRAAIDataModelConversation, (conversation) => conversation.data_model)
    ai_conversations!: Relation<DRAAIDataModelConversation>[];

    @OneToMany(() => DRADataModelRefreshHistory, (history) => history.data_model)
    refresh_history!: Relation<DRADataModelRefreshHistory>[];

    // ── Data Model Composition lineage relationships ───────────────────────
    @OneToMany(() => DRADataModelLineage, (lineage) => lineage.child_data_model)
    parent_lineages!: Relation<DRADataModelLineage>[];

    @OneToMany(() => DRADataModelLineage, (lineage) => lineage.parent_data_model)
    child_lineages!: Relation<DRADataModelLineage>[];
}
