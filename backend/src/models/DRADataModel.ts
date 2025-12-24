import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { DRAUsersPlatform } from './DRAUsersPlatform.js';
import { DRADataSource } from './DRADataSource.js';
import { DRAAIDataModelConversation } from './DRAAIDataModelConversation.js';
import { DRADataModelSource } from './DRADataModelSource.js';
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
}
