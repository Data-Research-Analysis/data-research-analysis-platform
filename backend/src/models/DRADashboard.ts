import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { DRAUsersPlatform } from './DRAUsersPlatform.js';
import { DRAProject } from './DRAProject.js';
import { IDashboardDataStructure } from '../types/IDashboard.js';
import { DRADashboardExportMetaData } from './DRADashboardExportMetaData.js';
@Entity('dra_dashboards')
export class DRADashboard {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name!: string | null;

  @Column({ type: 'jsonb' })
  data!: IDashboardDataStructure;

  @Column({ type: 'boolean', default: false })
  is_template!: boolean;

  @Column({ type: 'int', nullable: true })
  source_template_id!: number | null;

  @ManyToOne(() => DRAUsersPlatform, (usersPlatform) => usersPlatform.dashboards, { nullable: true })
  @JoinColumn({ name: 'users_platform_id', referencedColumnName: 'id' })
  users_platform!: Relation<DRAUsersPlatform> | null;

  @ManyToOne(() => DRAProject, (project) => project.dashboards, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'project_id', referencedColumnName: 'id' })
  project!: Relation<DRAProject> | null;

  @OneToMany(() => DRADashboardExportMetaData, (dashboard) => dashboard.dashboard, { cascade: ["remove", "update"] })
  export_meta_data!: Relation<DRADashboardExportMetaData>[]

}