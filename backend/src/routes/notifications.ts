import { Router, Request, Response } from 'express';
import { NotificationProcessor, NotificationNotFoundError, UnauthorizedNotificationAccessError } from '../processors/NotificationProcessor.js';
import { validateJWT } from '../middleware/authenticate.js';
import { NotificationType } from '../types/NotificationTypes.js';

const router = Router();
const notificationProcessor = NotificationProcessor.getInstance();

/**
 * GET /api/notifications
 * Get notifications for authenticated user with pagination
 * 
 * Query params:
 * - page: number (optional, default: 1)
 * - limit: number (optional, default: 20, max: 100)
 * 
 * Auth: Required (JWT)
 */
router.get('/', validateJWT, async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req as any).body.tokenDetails?.user_id;

        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
            return;
        }

        // Parse and validate pagination params
        const page = parseInt(req.query.page as string) || 1;
        const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

        if (page < 1) {
            res.status(400).json({
                success: false,
                message: 'Page must be >= 1'
            });
            return;
        }

        if (limit < 1) {
            res.status(400).json({
                success: false,
                message: 'Limit must be >= 1'
            });
            return;
        }

        const result = await notificationProcessor.getUserNotifications(userId, page, limit);

        res.status(200).json({
            success: true,
            notifications: result.notifications,
            pagination: {
                page,
                limit,
                total: result.total,
                totalPages: Math.ceil(result.total / limit)
            }
        });
    } catch (error: any) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch notifications'
        });
    }
});

/**
 * GET /api/notifications/unread-count
 * Get unread notification count for authenticated user
 * 
 * Auth: Required (JWT)
 */
router.get('/unread-count', validateJWT, async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req as any).body.tokenDetails?.user_id;

        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
            return;
        }

        const count = await notificationProcessor.getUnreadCount(userId);

        res.status(200).json({
            success: true,
            unreadCount: count
        });
    } catch (error: any) {
        console.error('Error fetching unread count:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch unread count'
        });
    }
});

/**
 * PUT /api/notifications/:id/read
 * Mark a notification as read
 * 
 * Auth: Required (JWT)
 */
router.put('/:id/read', validateJWT, async (req: Request, res: Response): Promise<void> => {
    try {
        const notificationId = parseInt(req.params.id);
        const userId = (req as any).body.tokenDetails?.user_id;

        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
            return;
        }

        if (isNaN(notificationId)) {
            res.status(400).json({
                success: false,
                message: 'Invalid notification ID'
            });
            return;
        }

        await notificationProcessor.markAsRead(notificationId, userId);

        res.status(200).json({
            success: true,
            message: 'Notification marked as read'
        });
    } catch (error: any) {
        console.error('Error marking notification as read:', error);

        if (error instanceof NotificationNotFoundError) {
            res.status(404).json({
                success: false,
                message: error.message
            });
            return;
        }

        if (error instanceof UnauthorizedNotificationAccessError) {
            res.status(403).json({
                success: false,
                message: error.message
            });
            return;
        }

        res.status(500).json({
            success: false,
            message: error.message || 'Failed to mark notification as read'
        });
    }
});

/**
 * PUT /api/notifications/mark-all-read
 * Mark all notifications as read for authenticated user
 * 
 * Auth: Required (JWT)
 */
router.put('/mark-all-read', validateJWT, async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req as any).body.tokenDetails?.user_id;

        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
            return;
        }

        await notificationProcessor.markAllAsRead(userId);

        res.status(200).json({
            success: true,
            message: 'All notifications marked as read'
        });
    } catch (error: any) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to mark all notifications as read'
        });
    }
});

/**
 * DELETE /api/notifications/:id
 * Delete a notification
 * 
 * Auth: Required (JWT)
 */
router.delete('/:id', validateJWT, async (req: Request, res: Response): Promise<void> => {
    try {
        const notificationId = parseInt(req.params.id);
        const userId = (req as any).body.tokenDetails?.user_id;

        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
            return;
        }

        if (isNaN(notificationId)) {
            res.status(400).json({
                success: false,
                message: 'Invalid notification ID'
            });
            return;
        }

        await notificationProcessor.deleteNotification(notificationId, userId);

        res.status(200).json({
            success: true,
            message: 'Notification deleted'
        });
    } catch (error: any) {
        console.error('Error deleting notification:', error);

        if (error instanceof NotificationNotFoundError) {
            res.status(404).json({
                success: false,
                message: error.message
            });
            return;
        }

        if (error instanceof UnauthorizedNotificationAccessError) {
            res.status(403).json({
                success: false,
                message: error.message
            });
            return;
        }

        res.status(500).json({
            success: false,
            message: error.message || 'Failed to delete notification'
        });
    }
});

/**
 * POST /api/notifications/cleanup-expired
 * Cleanup expired notifications (cron job endpoint)
 * 
 * Auth: Required (JWT) - Admin only
 * Note: In production, this should be called by a cron job with system credentials
 */
router.post('/cleanup-expired', validateJWT, async (req: Request, res: Response): Promise<void> => {
    try {
        // TODO: Add admin-only check here when admin roles are implemented
        // const isAdmin = (req as any).user.role === 'admin';
        // if (!isAdmin) {
        //     res.status(403).json({ success: false, message: 'Admin access required' });
        //     return;
        // }

        const deletedCount = await notificationProcessor.cleanupExpiredNotifications();

        res.status(200).json({
            success: true,
            message: `${deletedCount} expired notifications deleted`,
            deletedCount
        });
    } catch (error: any) {
        console.error('Error cleaning up expired notifications:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to cleanup expired notifications'
        });
    }
});

export default router;
