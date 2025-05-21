import { Column, Entity, JoinColumn, JoinTable, ManyToMany, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { DRAUsersPlatform } from './DRAUsersPlatform';
import { DRADataModel } from './DRADataModel';
@Entity('dra_visualizations')
export class DRAVisualization {
  @PrimaryGeneratedColumn()
  id: number;
  
  @ManyToOne(() => DRAUsersPlatform, (usersPlatform) => usersPlatform.visualizations)
  @JoinTable()
  @JoinColumn({ name: 'users_platform_id', referencedColumnName: 'id' })
  users_platform: DRAUsersPlatform
  @ManyToMany(() => DRADataModel)
  @JoinTable()
  @JoinColumn({ name: 'data_model_id', referencedColumnName: 'id' })
  data_models: DRADataModel[]

}