import express, { Request, Response } from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { EmailPreferencesProcessor } from '../processors/EmailPreferencesProcessor.js';
import { body, validationResult } from 'express-validator';

const router = express.Router();

// Get current user's email preferences
router.get('/', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, async (req: Request, res: Response) => {
    try {
        const { user_id } = req.body.tokenDetails;
        const processor = EmailPreferencesProcessor.getInstance();
        
        const preferences = await processor.getUserPreferences(user_id);
        
        res.status(200).json({
            success: true,
            data: preferences
        });
    } catch (error: any) {
        console.error('[EmailPreferencesRoute] Error fetching preferences:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch email preferences'
        });
    }
});

// Update current user's email preferences
router.put(
    '/',
    async (req: Request, res: Response, next: any) => {
        next();
    },
    validateJWT,
    [
        body('subscription_updates').optional().isBoolean().withMessage('subscription_updates must be a boolean'),
        body('expiration_warnings').optional().isBoolean().withMessage('expiration_warnings must be a boolean'),
        body('renewal_reminders').optional().isBoolean().withMessage('renewal_reminders must be a boolean'),
        body('promotional_emails').optional().isBoolean().withMessage('promotional_emails must be a boolean'),
    ],
    async (req: Request, res: Response) => {
        try {
            // Validate request
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation error',
                    errors: errors.array()
                });
            }
            
            const { user_id } = req.body.tokenDetails;
            const { subscription_updates, expiration_warnings, renewal_reminders, promotional_emails } = req.body;
            
            const processor = EmailPreferencesProcessor.getInstance();
            
            const updates: any = {};
            if (subscription_updates !== undefined) updates.subscription_updates = subscription_updates;
            if (expiration_warnings !== undefined) updates.expiration_warnings = expiration_warnings;
            if (renewal_reminders !== undefined) updates.renewal_reminders = renewal_reminders;
            if (promotional_emails !== undefined) updates.promotional_emails = promotional_emails;
            
            const preferences = await processor.updateUserPreferences(user_id, updates);
            
            res.status(200).json({
                success: true,
                message: 'Email preferences updated successfully',
                data: preferences
            });
        } catch (error: any) {
            console.error('[EmailPreferencesRoute] Error updating preferences:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to update email preferences'
            });
        }
    }
);

export default router;
