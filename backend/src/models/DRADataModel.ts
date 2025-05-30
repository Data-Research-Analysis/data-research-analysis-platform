import { Column, Entity, JoinColumn, JoinTable, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { DRAUsersPlatform } from './DRAUsersPlatform';
import { DRADataSource } from './DRADataSource';
import { DRAVisualizationModel } from './DRAVisualizationModel';
@Entity('dra_data_models')
export class DRADataModel {
    @PrimaryGeneratedColumn()
    id: number
    @Column({ type: 'varchar', length: 255 })
    schema: string
    @Column({ type: 'varchar', length: 255 })
    name: string
    @Column({ type: 'text' })
    sql_query: string
    @Column({ type: 'jsonb' })
    query: JSON
    
    @OneToMany(() => DRAVisualizationModel, (visualizationModel) => visualizationModel.data_model)
    visualization_models!: DRAVisualizationModel[]
    
    @ManyToOne(() => DRAUsersPlatform, (usersPlatform) => usersPlatform.data_models)
    @JoinColumn({ name: 'users_platform_id', referencedColumnName: 'id' })
    users_platform!: DRAUsersPlatform
    
    @ManyToOne(() => DRADataSource, (dataSource) => dataSource.data_models)
    @JoinColumn({ name: 'data_source_id', referencedColumnName: 'id' })
    data_source!: DRADataSource
}
