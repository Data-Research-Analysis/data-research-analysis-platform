import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    OneToMany,
    JoinColumn,
    Unique,
    Relation
} from 'typeorm';
import { DRAOrganization } from './DRAOrganization.js';
import { DRAWorkspaceMember } from './DRAWorkspaceMember.js';
import { DRAProject } from './DRAProject.js';

/**
 * Workspace entity for organizing projects within an organization
 * 
 * Workspaces group projects by department/team (e.g., Marketing, Sales, Finance).
 * Users can have different roles in different workspaces within the same organization.
 * 
 * Single-user plans (FREE/STARTER) get one default workspace automatically.
 * Multi-user plans (PROFESSIONAL+) can create multiple workspaces for organization.
 * 
 * @see Issue #283: Multi-Tenant Organization Management
 */
@Entity('dra_workspaces')
@Unique(['organization', 'slug'])  // Slug unique within organization only
export class DRAWorkspace {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'varchar', length: 255 })
    name!: string;  // "Marketing Analytics", "Sales Operations"

    @Column({ type: 'text', nullable: true })
    description!: string | null;

    @Column({ type: 'varchar', length: 100 })
    slug!: string;  // Unique within org: "marketing", "sales"

    @Column({ type: 'boolean', default: true })
    is_active!: boolean;

    @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
    created_at!: Date;

    @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
    updated_at!: Date;

    // Relations
    @ManyToOne(() => DRAOrganization, org => org.workspaces, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'organization_id' })
    organization!: Relation<DRAOrganization>;

    @Column({ type: 'int', name: 'organization_id' })
    organization_id!: number;

    @OneToMany(() => DRAProject, project => project.workspace, { cascade: ['remove', 'update'] })
    projects!: Relation<DRAProject>[];

    @OneToMany(() => DRAWorkspaceMember, member => member.workspace, { cascade: ['remove', 'update'] })
    members!: Relation<DRAWorkspaceMember>[];
}
