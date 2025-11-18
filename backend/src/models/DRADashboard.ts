import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { DRAUsersPlatform } from './DRAUsersPlatform.js';
import { DRAProject } from './DRAProject.js';
import { IDashboardDataStructure } from '../types/IDashboard.js';
import { DRADashboardExportMetaData } from './DRADashboardExportMetaData.js';
@Entity('dra_dashboards')
export class DRADashboard {
  @PrimaryGeneratedColumn()
  id!: number;
  @Column({ type: 'jsonb' })
  data!: IDashboardDataStructure; 
  
  @ManyToOne(() => DRAUsersPlatform, (usersPlatform) => usersPlatform.dashboards)
  @JoinColumn({ name: 'users_platform_id', referencedColumnName: 'id' })
  users_platform!: Relation<DRAUsersPlatform>
  
  @ManyToOne(() => DRAProject, (project) => project.dashboards, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id', referencedColumnName: 'id' })
  project!: Relation<DRAProject>

  @OneToMany(() => DRADashboardExportMetaData, (dashboard) => dashboard.dashboard, { cascade: ["remove", "update"] })
  export_meta_data!: Relation<DRADashboardExportMetaData>[]

}