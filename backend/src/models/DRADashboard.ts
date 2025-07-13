import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { DRAUsersPlatform } from './DRAUsersPlatform.js';
import { DRAProject } from './DRAProject.js';
import { IDashboard } from '../types/IDashboard.js';
@Entity('dra_dashboards')
export class DRADashboard {
  @PrimaryGeneratedColumn()
  id!: number;
  @Column({ type: 'jsonb' })
  data!: IDashboard;
  
  @ManyToOne(() => DRAUsersPlatform, (usersPlatform) => usersPlatform.dashboards)
  @JoinColumn({ name: 'users_platform_id', referencedColumnName: 'id' })
  users_platform!: Relation<DRAUsersPlatform>
  
  @ManyToOne(() => DRAProject, (project) => project.dashboards)
  @JoinColumn({ name: 'project_id', referencedColumnName: 'id' })
  project!: Relation<DRAProject>
  

}