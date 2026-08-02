import express, { Request, Response } from 'express';
import { validate } from '../middleware/validator.js';
import { body, query as queryValidator } from 'express-validator';
import { matchedData } from 'express-validator';
import { EmailFunnelProcessor } from '../processors/EmailFunnelProcessor.js';

const router = express.Router();
const processor = EmailFunnelProcessor.getInstance();

// POST /email-funnels/blog-subscribe — subscribe to blog via overlay
router.post(
    '/blog-subscribe',
    validate([
        body('email').notEmpty().isEmail().normalizeEmail(),
        body('name').optional().trim(),
    ]),
    async (req: Request, res: Response) => {
        try {
            const { email, name } = matchedData(req);
            const subscriber = await processor.subscribeToBlog(email, name);

            const blogFunnel = await processor.getFunnelBySlug('blog-subscriber');
            if (blogFunnel) {
                await processor.enroll({
                    funnelId: blogFunnel.id,
                    leadEmail: email,
                    leadName: name,
                });
            }

            res.status(200).json({ success: true, data: { id: subscriber.id, email: subscriber.email } });
        } catch (error: any) {
            console.error('[email-funnels] blog-subscribe error:', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }
);

// GET /email-funnels/unsubscribe — one-click unsubscribe (no auth required)
router.get(
    '/unsubscribe',
    validate([
        queryValidator('token').notEmpty(),
        queryValidator('email').notEmpty().isEmail(),
        queryValidator('funnel_id').optional().toInt(),
    ]),
    async (req: Request, res: Response) => {
        try {
            const { token, email, funnel_id } = matchedData(req);
            const success = await processor.unsubscribe(email, funnel_id || null, token);
            const frontendUrl = process.env.FRONTEND_URL || process.env.SOCKETIO_CLIENT_URL || 'http://localhost:3000';
            if (success) {
                res.redirect(302, `${frontendUrl}/email-funnels/unsubscribed?success=true`);
            } else {
                res.redirect(302, `${frontendUrl}/email-funnels/unsubscribed?success=false`);
            }
        } catch (error: any) {
            console.error('[email-funnels] unsubscribe error:', error);
            const frontendUrl = process.env.FRONTEND_URL || process.env.SOCKETIO_CLIENT_URL || 'http://localhost:3000';
            res.redirect(302, `${frontendUrl}/email-funnels/unsubscribed?success=false`);
        }
    }
);

// GET /email-funnels/track/open — 1x1 tracking pixel
router.get(
    '/track/open',
    validate([
        queryValidator('enrollment_id').notEmpty().toInt(),
        queryValidator('step_id').notEmpty().toInt(),
    ]),
    async (req: Request, res: Response) => {
        try {
            const { enrollment_id, step_id } = matchedData(req);
            await processor.trackOpen(enrollment_id, step_id);
        } catch {
            // Silently fail — tracking should never break the page
        }
        res.set('Content-Type', 'image/gif');
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        // 1x1 transparent GIF
        const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
        res.status(200).end(pixel);
    }
);

// GET /email-funnels/track/click — link click redirect
router.get(
    '/track/click',
    validate([
        queryValidator('redirect').notEmpty(),
        queryValidator('enrollment_id').notEmpty().toInt(),
        queryValidator('step_id').notEmpty().toInt(),
    ]),
    async (req: Request, res: Response) => {
        try {
            const { redirect, enrollment_id, step_id } = matchedData(req);
            await processor.trackClick(enrollment_id, step_id);
            res.redirect(302, redirect);
        } catch {
            res.redirect(302, '/');
        }
    }
);

// GET /email-funnels/track/broadcast-open — 1x1 tracking pixel for broadcasts
router.get(
    '/track/broadcast-open',
    validate([
        queryValidator('log_id').notEmpty().toInt(),
    ]),
    async (req: Request, res: Response) => {
        try {
            const { log_id } = matchedData(req);
            await processor.trackBroadcastOpen(log_id);
        } catch {
            // Silently fail
        }
        res.set('Content-Type', 'image/gif');
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
        res.status(200).end(pixel);
    }
);

// GET /email-funnels/track/broadcast-click — link click redirect for broadcasts
router.get(
    '/track/broadcast-click',
    validate([
        queryValidator('log_id').notEmpty().toInt(),
        queryValidator('redirect').notEmpty(),
    ]),
    async (req: Request, res: Response) => {
        try {
            const { log_id, redirect } = matchedData(req);
            await processor.trackBroadcastClick(log_id);
            res.redirect(302, redirect);
        } catch {
            res.redirect(302, '/');
        }
    }
);

export default router;
