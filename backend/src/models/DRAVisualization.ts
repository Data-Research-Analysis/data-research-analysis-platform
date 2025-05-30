import { Column, Entity, JoinColumn, JoinTable, ManyToMany, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { DRAUsersPlatform } from './DRAUsersPlatform';
import { DRAProject } from './DRAProject';
import { DRAVisualizationModel } from './DRAVisualizationModel';
@Entity('dra_visualizations')
export class DRAVisualization {
  @PrimaryGeneratedColumn()
  id: number;
  
  @OneToMany(() => DRAVisualizationModel, (visualizationModel) => visualizationModel.visualization)
  visualization_models: DRAVisualizationModel[]

  @ManyToOne(() => DRAUsersPlatform, (usersPlatform) => usersPlatform.visualizations)
  @JoinColumn({ name: 'users_platform_id', referencedColumnName: 'id' })
  users_platform!: DRAUsersPlatform
  
  @ManyToOne(() => DRAProject, (project) => project.visualizations)
  @JoinColumn({ name: 'project_id', referencedColumnName: 'id' })
  project!: DRAProject
  

}