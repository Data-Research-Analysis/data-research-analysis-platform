import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, type Relation } from 'typeorm';
import { DRAProject } from './DRAProject.js';
import { DRAUsersPlatform } from './DRAUsersPlatform.js';
import { EProjectRole } from '../types/EProjectRole.js';

/**
 * Pending project invitation
 * 
 * Tracks email invitations to join a project. Invitation tokens expire after 7 days.
 * Once accepted, a DRAProjectMember record is created and invitation is marked accepted.
 */
@Entity('dra_project_invitations')
export class DRAProjectInvitation {
    @PrimaryGeneratedColumn()
    id!: number;

    @ManyToOne(() => DRAProject, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'project_id' })
    project!: Relation<DRAProject>;

    @Column({ type: 'varchar', length: 320 })
    invited_email!: string;

    @Column({ type: 'enum', enum: EProjectRole })
    role!: EProjectRole;

    @Column({ type: 'varchar', length: 255, unique: true })
    invitation_token!: string;

    @ManyToOne(() => DRAUsersPlatform)
    @JoinColumn({ name: 'invited_by_user_id' })
    invited_by!: Relation<DRAUsersPlatform>;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at!: Date;

    @Column({ type: 'timestamp' })
    expires_at!: Date; // 7 days from creation

    @Column({ type: 'boolean', default: false })
    accepted!: boolean;

    @Column({ type: 'timestamp', nullable: true })
    accepted_at!: Date | null;
}
