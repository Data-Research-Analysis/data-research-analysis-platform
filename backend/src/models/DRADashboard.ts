import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { DRAUsersPlatform } from './DRAUsersPlatform';
import { DRAProject } from './DRAProject';
import { IDashboard } from '../types/IDashboard';
@Entity('dra_dashboards')
export class DRADashboard {
  @PrimaryGeneratedColumn()
  id: number;
  @Column({ type: 'jsonb' })
  data: IDashboard;
  
  @ManyToOne(() => DRAUsersPlatform, (usersPlatform) => usersPlatform.dashboards)
  @JoinColumn({ name: 'users_platform_id', referencedColumnName: 'id' })
  users_platform!: DRAUsersPlatform
  
  @ManyToOne(() => DRAProject, (project) => project.dashboards)
  @JoinColumn({ name: 'project_id', referencedColumnName: 'id' })
  project!: DRAProject
  

}