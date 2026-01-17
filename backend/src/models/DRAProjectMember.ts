import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique, type Relation } from 'typeorm';
import { DRAProject } from './DRAProject.js';
import { DRAUsersPlatform } from './DRAUsersPlatform.js';
import { EProjectRole } from '../types/EProjectRole.js';

/**
 * Project member with role-based permissions
 * 
 * Tracks which users have access to which projects and their permission level.
 * Unique constraint ensures one role per user per project.
 */
@Entity('dra_project_members')
@Unique(['project', 'user']) // One role per user per project
export class DRAProjectMember {
    @PrimaryGeneratedColumn()
    id!: number;

    @ManyToOne(() => DRAProject, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'project_id' })
    project!: Relation<DRAProject>;

    @ManyToOne(() => DRAUsersPlatform, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'users_platform_id' })
    user!: Relation<DRAUsersPlatform>;

    @Column({ type: 'enum', enum: EProjectRole })
    role!: EProjectRole;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    added_at!: Date;

    @Column({ type: 'timestamp', nullable: true })
    last_accessed_at!: Date | null;

    @ManyToOne(() => DRAUsersPlatform, { nullable: true })
    @JoinColumn({ name: 'invited_by_user_id' })
    invited_by!: Relation<DRAUsersPlatform> | null;
}
