import express from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { UserProcessor } from '../processors/UserProcessor.js';

const router = express.Router();

/**
 * Look up user by email
 * GET /user/lookup-by-email?email=user@example.com
 * 
 * Returns basic user information (id, email, name) without sensitive data.
 * Used for adding members to projects.
 */
router.get('/lookup-by-email', validateJWT, async (req, res) => {
    try {
        const email = req.query.email as string;
        
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email parameter required' });
        }
        
        const user = await UserProcessor.getInstance().lookupUserByEmail(email);
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found. Please check the email address.' });
        }
        
        res.json({ success: true, data: user });
    } catch (error: any) {
        console.error('Error looking up user:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to lookup user'
        });
    }
});

/**
 * Dismiss paid plan banner
 * POST /user/dismiss-paid-plan-banner
 * Body: { dismissUntil: ISO date string }
 * 
 * Updates user's dismissed_paid_plan_banner_until field to hide the banner temporarily.
 */
router.post('/dismiss-paid-plan-banner', validateJWT, async (req, res) => {
    try {
        const userId = req.body.tokenDetails?.user_id;
        const { dismissUntil } = req.body;
        
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }
        
        if (!dismissUntil) {
            return res.status(400).json({ success: false, message: 'dismissUntil parameter required' });
        }
        
        const dismissedUntilDate = new Date(dismissUntil);
        if (isNaN(dismissedUntilDate.getTime())) {
            return res.status(400).json({ success: false, message: 'Invalid date format for dismissUntil' });
        }
        
        await UserProcessor.getInstance().updateBannerDismissal(userId, dismissedUntilDate);
        
        res.json({ success: true, message: 'Banner dismissed successfully' });
    } catch (error: any) {
        console.error('Error dismissing banner:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to dismiss banner'
        });
    }
});

export default router;
