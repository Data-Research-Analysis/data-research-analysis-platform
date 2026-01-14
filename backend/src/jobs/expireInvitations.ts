import cron from 'node-cron';
import { InvitationService } from '../services/InvitationService.js';

/**
 * Cron Job: Expire Old Project Invitations
 * 
 * Runs every hour to mark expired invitations as 'expired'
 * Invitations expire 7 days after creation
 * 
 * Schedule: '0 * * * *' = At minute 0 of every hour
 */
export function startInvitationExpirationJob() {
    console.log('📅 Initializing invitation expiration cron job (runs hourly)');
    
    cron.schedule('0 * * * *', async () => {
        try {
            console.log('⏰ Running invitation expiration job...');
            const startTime = Date.now();
            
            const result = await InvitationService.getInstance().expireOldInvitations();
            
            const duration = Date.now() - startTime;
            console.log(`✅ Invitation expiration job complete: ${result.expiredCount} invitations expired (${duration}ms)`);
            
            if (result.expiredCount > 0) {
                console.log(`   🔔 Expired ${result.expiredCount} invitation(s)`);
            }
        } catch (error) {
            console.error('❌ Error in invitation expiration job:', error);
        }
    });
    
    console.log('✅ Invitation expiration cron job scheduled successfully');
}

/**
 * One-time manual execution (useful for testing or immediate cleanup)
 */
export async function expireInvitationsNow(): Promise<{ expiredCount: number }> {
    console.log('🔧 Manually expiring old invitations...');
    try {
        const result = await InvitationService.getInstance().expireOldInvitations();
        console.log(`✅ Manual expiration complete: ${result.expiredCount} invitations expired`);
        return result;
    } catch (error) {
        console.error('❌ Error during manual expiration:', error);
        throw error;
    }
}
