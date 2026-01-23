import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Relation, CreateDateColumn } from 'typeorm';
import { DRAUsersPlatform } from './DRAUsersPlatform.js';
import { DRADataSource } from './DRADataSource.js';
import { DRAAIDataModelConversation } from './DRAAIDataModelConversation.js';
import { DRADataModelSource } from './DRADataModelSource.js';
import { DRADataModelRefreshHistory } from './DRADataModelRefreshHistory.js';
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
    auto_refresh_enabled!: boolean
    
    @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
    created_at!: Date
        
    @ManyToOne(() => DRAUsersPlatform, (usersPlatform) => usersPlatform.data_models)
    @JoinColumn({ name: 'users_platform_id', referencedColumnName: 'id' })
    users_platform!: Relation<DRAUsersPlatform>
    
    @ManyToOne(() => DRADataSource, (dataSource) => dataSource.data_models, { onDelete: 'CASCADE', nullable: true })
    @JoinColumn({ name: 'data_source_id', referencedColumnName: 'id' })
    data_source?: Relation<DRADataSource>
    
    @OneToMany(() => DRADataModelSource, (source) => source.data_model)
    data_model_sources!: Relation<DRADataModelSource>[]

    @OneToMany(() => DRAAIDataModelConversation, (conversation) => conversation.data_model)
    ai_conversations!: Relation<DRAAIDataModelConversation>[];

    @OneToMany(() => DRADataModelRefreshHistory, (history) => history.data_model)
    refresh_history!: Relation<DRADataModelRefreshHistory>[];
}
