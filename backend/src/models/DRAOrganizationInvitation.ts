import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    type Relation
} from 'typeorm';
import { DRAOrganization } from './DRAOrganization.js';
import { DRAUsersPlatform } from './DRAUsersPlatform.js';

/**
 * Organization invitation for external users
 * 
 * Tracks email invitations to join an organization. Uses secure tokens
 * that expire after 7 days. Once accepted, a DRAOrganizationMember record
 * is created and invitation is marked accepted.
 * 
 * Flow:
 * 1. Admin/owner invites user by email
 * 2. If user exists → add directly to org, send notification email
 * 3. If user doesn't exist → create invitation, send invitation email with token
 * 4. User clicks link → registers/logs in → accepts invitation
 * 5. Invitation marked "accepted", user added to organization
 * 
 * Statuses:
 * - pending: Invitation sent, awaiting acceptance
 * - accepted: User accepted and joined organization
 * - expired: Past expires_at date
 * - cancelled: Admin cancelled before acceptance
 * 
 * @see organization-first-invitation-implementation-plan.md
 */
@Entity('dra_organization_invitations')
export class DRAOrganizationInvitation {
    @PrimaryGeneratedColumn()
    id!: number;

    @ManyToOne(() => DRAOrganization, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'organization_id' })
    organization!: Relation<DRAOrganization>;

    @Column({ type: 'int', name: 'organization_id' })
    organization_id!: number;

    @Column({ type: 'varchar', length: 320 })
    invited_email!: string;

    @Column({
        type: 'enum',
        enum: ['owner', 'admin', 'member'],
        default: 'member'
    })
    role!: 'owner' | 'admin' | 'member';

    @ManyToOne(() => DRAUsersPlatform)
    @JoinColumn({ name: 'invited_by_user_id' })
    invited_by!: Relation<DRAUsersPlatform>;

    @Column({ type: 'int', name: 'invited_by_user_id' })
    invited_by_user_id!: number;

    @Column({ type: 'varchar', length: 128, unique: true })
    invitation_token!: string;

    @Column({
        type: 'enum',
        enum: ['pending', 'accepted', 'expired', 'cancelled'],
        default: 'pending'
    })
    status!: 'pending' | 'accepted' | 'expired' | 'cancelled';

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at!: Date;

    @Column({ type: 'timestamp' })
    expires_at!: Date;

    @Column({ type: 'timestamp', nullable: true })
    accepted_at!: Date | null;
}
