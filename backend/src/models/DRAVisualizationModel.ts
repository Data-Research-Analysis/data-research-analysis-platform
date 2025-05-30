import { Column, Entity, JoinColumn, JoinTable, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { DRAUsersPlatform } from './DRAUsersPlatform';
import { DRADataSource } from './DRADataSource';
import { DRAVisualization } from './DRAVisualization';
import { DRADataModel } from './DRADataModel';
@Entity('dra_visualization_models')
export class DRAVisualizationModel {
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
    
    @ManyToOne(() => DRAVisualization, (visualization) => visualization.visualization_models)
    @JoinColumn({ name: 'visualization_id', referencedColumnName: 'id' })
    visualization!: DRAVisualization

    @ManyToOne(() => DRADataModel, (dataModel) => dataModel.visualization_models)
    @JoinColumn({ name: 'data_model_id', referencedColumnName: 'id' })
    data_model!: DRADataModel
 
    @ManyToOne(() => DRAUsersPlatform, (usersPlatform) => usersPlatform.visualization_models)
    @JoinColumn({ name: 'users_platform_id', referencedColumnName: 'id' })
    users_platform!: DRAUsersPlatform
    
}
    
