import { Column, Entity, JoinTable, ManyToMany, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { DRAUsersPlatform } from './DRAUsersPlatform';
import { DRADataModel } from './DRADataModel';
@Entity('dra_visualizations')
export class DRAVisualization {
  @PrimaryGeneratedColumn()
  id: number;
  
  @ManyToOne(() => DRAUsersPlatform, (usersPlatform) => usersPlatform.visualizations)
  @JoinTable()
  users_platform: DRAUsersPlatform
  @ManyToMany(() => DRADataModel)
  @JoinTable()
  data_models: DRADataModel[]

}