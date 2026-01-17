import { EProjectRole } from '../types/EProjectRole.js';

/**
 * Interface for creating a new project invitation
 */
export interface IInvitationCreate {
    projectId: number;
    email: string;
    role: EProjectRole;
    invitedByUserId: number;
}

/**
 * Interface for invitation response data
 */
export interface IInvitationResponse {
    id: number;
    project_id: number;
    project_name: string;
    invited_by_name: string;
    invited_email: string;
    role: EProjectRole;
    status: 'pending' | 'accepted' | 'expired' | 'cancelled';
    invitation_token: string;
    created_at: Date;
    expires_at: Date;
    accepted_at?: Date;
}

/**
 * Interface for accepting an invitation
 */
export interface IInvitationAccept {
    token: string;
    userId?: number; // Optional - for existing users
}

/**
 * Interface for invitation status update
 */
export interface IInvitationStatusUpdate {
    status: 'cancelled' | 'expired';
    updatedBy: number;
}
