import { Router, Request, Response } from 'express';
import { AppDataSource } from '../../datasources/PostgresDS.js';
import { DRAUsersPlatform } from '../../models/DRAUsersPlatform.js';
import { DRASubscriptionTier } from '../../models/DRASubscriptionTier.js';
import { EmailService } from '../../services/EmailService.js';
import { validateJWT } from '../../middleware/authenticate.js';
import { EUserType } from '../../types/EUserType.js';

const router = Router();

/**
 * Admin middleware - checks if user is admin
 */
async function requireAdmin(req: any, res: any, next: any) {
    const tokenDetails = req.tokenDetails || req.body.tokenDetails;
    if (!tokenDetails || tokenDetails.user_type !== EUserType.ADMIN) {
        return res.status(403).json({ error: 'Forbidden - Admin access required' });
    }
    next();
}

/**
 * Get list of users interested in paid plans
 * GET /admin/paid-plans/interested-users
 */
router.get('/interested-users', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const manager = AppDataSource.manager;
        
        // Query users who have expressed interest (interested_subscription_tier_id is not null)
        const users = await manager
            .createQueryBuilder(DRAUsersPlatform, 'user')
            .leftJoinAndSelect('user.interested_subscription_tier', 'tier')
            .where('user.interested_subscription_tier_id IS NOT NULL')
            .select([
                'user.id',
                'user.email',
                'user.first_name',
                'user.last_name',
                'user.email_verified_at',
                'tier.id',
                'tier.tier_name',
                'tier.price_per_month_usd'
            ])
            .orderBy('user.email_verified_at', 'DESC')
            .getMany();

        const formattedUsers = users.map(user => ({
            id: user.id,
            email: user.email,
            name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'N/A',
            interestedTier: user.interested_subscription_tier?.tier_name || 'Unknown',
            tierPrice: user.interested_subscription_tier?.price_per_month_usd || 0,
            registeredAt: user.email_verified_at
        }));

        res.json({
            success: true,
            count: formattedUsers.length,
            users: formattedUsers
        });
    } catch (error: any) {
        console.error('[Admin] Error fetching interested users:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Export interested users to CSV
 * GET /admin/paid-plans/export-csv
 */
router.get('/export-csv', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const manager = AppDataSource.manager;
        
        const users = await manager
            .createQueryBuilder(DRAUsersPlatform, 'user')
            .leftJoinAndSelect('user.interested_subscription_tier', 'tier')
            .where('user.interested_subscription_tier_id IS NOT NULL')
            .select([
                'user.id',
                'user.email',
                'user.first_name',
                'user.last_name',
                'user.email_verified_at',
                'tier.tier_name',
                'tier.price_per_month_usd'
            ])
            .orderBy('tier.tier_name', 'ASC')
            .addOrderBy('user.email_verified_at', 'DESC')
            .getMany();

        // Build CSV content
        let csv = 'ID,Email,First Name,Last Name,Interested Tier,Tier Price,Registered Date\n';
        
        for (const user of users) {
            const row = [
                user.id,
                user.email,
                user.first_name || '',
                user.last_name || '',
                user.interested_subscription_tier?.tier_name || '',
                user.interested_subscription_tier?.price_per_month_usd || '',
                user.email_verified_at?.toISOString() || ''
            ];
            
            // Escape quotes and wrap in quotes if contains comma
            const escapedRow = row.map(field => {
                const str = String(field);
                if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            });
            
            csv += escapedRow.join(',') + '\n';
        }

        // Set headers for file download
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="interested-users-${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csv);
    } catch (error: any) {
        console.error('[Admin] Error exporting interested users CSV:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Send paid plans launch notifications to interested users
 * POST /admin/paid-plans/send-notifications
 * 
 * Body: { test: boolean, testEmail?: string }
 */
router.post('/send-notifications', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { test = false, testEmail } = req.body;
        const manager = AppDataSource.manager;
        
        // Get all tiers for reference
        const tiers = await manager.find(DRASubscriptionTier);
        const tierMap = new Map(tiers.map(t => [t.id, t]));
        
        if (test && testEmail) {
            // Test mode: send only to specified email
            console.log(`[Admin] Sending test notification to ${testEmail}`);
            
            const testUser = await manager.findOne(DRAUsersPlatform, { 
                where: { email: testEmail },
                relations: ['interested_subscription_tier']
            });
            
            if (!testUser) {
                res.status(404).json({ success: false, error: 'Test user not found' });
                return;
            }
            
            const tier = testUser.interested_subscription_tier || tiers.find(t => t.tier_name === 'PROFESSIONAL');
            if (!tier) {
                res.status(500).json({ success: false, error: 'Tier not found' });
                return;
            }
            
            const tierMaxRows = tier.max_rows_per_data_model === -1 ? 'Unlimited' : `${(tier.max_rows_per_data_model / 1000000).toFixed(0)}M`;
            const tierMaxMembers = tier.max_members_per_project === -1 || tier.max_members_per_project === null ? 
                'Unlimited' : tier.max_members_per_project.toString();
            
            await EmailService.getInstance().sendPaidPlansLaunch(
                testUser.email,
                `${testUser.first_name || ''} ${testUser.last_name || ''}`.trim() || 'Valued User',
                tier.tier_name,
                Number(tier.price_per_month_usd),
                tierMaxRows,
                tierMaxMembers
            );
            
            res.json({
                success: true,
                message: `Test email sent to ${testEmail}`,
                sent: 1
            });
            return;
        }
        
        // Production mode: send to all interested users
        const users = await manager
            .createQueryBuilder(DRAUsersPlatform, 'user')
            .leftJoinAndSelect('user.interested_subscription_tier', 'tier')
            .where('user.interested_subscription_tier_id IS NOT NULL')
            .getMany();
        
        console.log(`[Admin] Sending notifications to ${users.length} interested users`);
        
        let sent = 0;
        let failed = 0;
        
        for (const user of users) {
            try {
                const tier = user.interested_subscription_tier;
                if (!tier) {
                    console.warn(`[Admin] User ${user.email} has no tier, skipping`);
                    failed++;
                    continue;
                }
                
                const tierMaxRows = tier.max_rows_per_data_model === -1 ? 'Unlimited' : `${(tier.max_rows_per_data_model / 1000000).toFixed(0)}M`;
                const tierMaxMembers = tier.max_members_per_project === -1 || tier.max_members_per_project === null ? 
                    'Unlimited' : tier.max_members_per_project.toString();
                
                await EmailService.getInstance().sendPaidPlansLaunch(
                    user.email,
                    `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Valued User',
                    tier.tier_name,
                    Number(tier.price_per_month_usd),
                    tierMaxRows,
                    tierMaxMembers
                );
                
                sent++;
                console.log(`  ✓ Sent to ${user.email} (${tier.tier_name})`);
            } catch (error: any) {
                console.error(`  ✗ Failed to send to ${user.email}:`, error.message);
                failed++;
            }
        }
        
        res.json({
            success: true,
            message: `Notifications sent to ${sent} users (${failed} failed)`,
            sent,
            failed,
            total: users.length
        });
    } catch (error: any) {
        console.error('[Admin] Error sending notifications:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
