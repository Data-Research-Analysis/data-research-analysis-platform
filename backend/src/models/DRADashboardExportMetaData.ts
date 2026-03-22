import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { DRAUsersPlatform } from './DRAUsersPlatform.js';
import { DRADashboard } from './DRADashboard.js';
import { DRAOrganization } from './DRAOrganization.js';
import { DRAWorkspace } from './DRAWorkspace.js';
@Entity('dra_dashboards_exported_metadata')
export class DRADashboardExportMetaData {
  @PrimaryGeneratedColumn()
  id!: number;
  @Column({ type: 'varchar', length: 1024 })
  key!: string;
  @Column({ type: 'timestamp' })
  created_at!: Date;
  @Column({ type: 'timestamp' })
  expiry_at!: Date;
  
  @ManyToOne(() => DRAUsersPlatform, (usersPlatform) => usersPlatform.dashboards, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'users_platform_id', referencedColumnName: 'id' })
  users_platform!: Relation<DRAUsersPlatform>

  @ManyToOne(() => DRADashboard, (dashboard) => dashboard.export_meta_data, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dashboard_id', referencedColumnName: 'id' })
  dashboard!: Relation<DRADashboard>

  /**
   * REQUIRED: Organization and workspace (Phase 2 Migration)
   * Inherits from parent dashboard
   */
  @ManyToOne(() => DRAOrganization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Relation<DRAOrganization>;

  @Column({ type: 'int', name: 'organization_id' })
  organization_id!: number;

  @ManyToOne(() => DRAWorkspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace!: Relation<DRAWorkspace>;

  @Column({ type: 'int', name: 'workspace_id' })
  workspace_id!: number;

}