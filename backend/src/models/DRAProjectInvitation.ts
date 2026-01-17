import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToOne, type Relation } from 'typeorm';
import { DRAProject } from './DRAProject.js';
import { DRAUsersPlatform } from './DRAUsersPlatform.js';
import { DRAVerificationCode } from './DRAVerificationCode.js';
import { EProjectRole } from '../types/EProjectRole.js';

/**
 * Pending project invitation
 * 
 * Tracks email invitations to join a project. Invitations use the centralized
 * dra_verification_codes table for token management. Tokens expire after 7 days.
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

    @OneToOne(() => DRAVerificationCode, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'verification_code_id' })
    verification_code!: Relation<DRAVerificationCode>;

    @ManyToOne(() => DRAUsersPlatform)
    @JoinColumn({ name: 'invited_by_user_id' })
    invited_by!: Relation<DRAUsersPlatform>;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at!: Date;

    @Column({ type: 'timestamp' })
    expires_at!: Date; // 7 days from creation

    @Column({ type: 'varchar', length: 20, default: 'pending' })
    status!: 'pending' | 'accepted' | 'expired' | 'cancelled';

    @Column({ type: 'timestamp', nullable: true })
    accepted_at!: Date | null;
}
