import { Router, Request, Response } from 'express';
import { AccountCancellationProcessor } from '../../processors/AccountCancellationProcessor.js';
import { DataDeletionService } from '../../services/DataDeletionService.js';
import { validateJWT } from '../../middleware/authenticate.js';
import { EUserType } from '../../types/EUserType.js';
import { ECancellationStatus } from '../../models/DRAAccountCancellation.js';

const router = Router();

// Middleware to check if user is admin
async function requireAdmin(req: any, res: any, next: any) {
    const tokenDetails = req.tokenDetails || req.body.tokenDetails;
    if (!tokenDetails || tokenDetails.user_type !== EUserType.ADMIN) {
        return res.status(403).send({ message: 'Admin access required' });
    }
    next();
}

/**
 * GET /api/admin/account-cancellations
 * Get all account cancellations with pagination and filtering
 */
router.get('/', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const statusParam = req.query.status as string | undefined;
        const status = statusParam ? (statusParam as ECancellationStatus) : undefined;

        const processor = AccountCancellationProcessor.getInstance();
        const result = await processor.getAllCancellations(page, limit, status);

        const totalPages = Math.ceil(result.total / limit);

        return res.status(200).json({
            success: true,
            data: {
                cancellations: result.data.map(c => ({
                    id: c.id,
                    userId: c.users_platform.id,
                    userEmail: c.users_platform.email,
                    status: c.status,
                    requestedAt: c.requested_at,
                    effectiveAt: c.effective_at,
                    deletionScheduledAt: c.deletion_scheduled_at,
                    dataDeletedAt: c.data_deleted_at,
                    reasonCategory: c.cancellation_reason_category,
                    reason: c.cancellation_reason
                })),
                pagination: {
                    page,
                    limit,
                    total: result.total,
                    totalPages
                }
            }
        });

    } catch (error: any) {
        console.error('[AccountCancellationRoutes] Error fetching cancellations:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch account cancellations'
        });
    }
});

/**
 * GET /api/admin/account-cancellations/statistics
 * Get cancellation statistics
 */
router.get('/statistics', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const processor = AccountCancellationProcessor.getInstance();
        const stats = await processor.getCancellationStatistics();

        return res.status(200).json({
            success: true,
            data: stats
        });

    } catch (error: any) {
        console.error('[AccountCancellationRoutes] Error fetching statistics:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch cancellation statistics'
        });
    }
});

/**
 * GET /api/admin/account-cancellations/pending-deletion
 * Get accounts pending deletion (past retention period)
 */
router.get('/pending-deletion', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const processor = AccountCancellationProcessor.getInstance();
        const cancellations = await processor.getCancellationsPendingDeletion();

        return res.status(200).json({
            success: true,
            data: cancellations.map(c => ({
                id: c.id,
                userId: c.users_platform.id,
                userEmail: c.users_platform.email,
                deletionScheduledAt: c.deletion_scheduled_at,
                daysPastScheduled: Math.floor(
                    (Date.now() - (c.deletion_scheduled_at?.getTime() || 0)) / (1000 * 60 * 60 * 24)
                )
            }))
        });

    } catch (error: any) {
        console.error('[AccountCancellationRoutes] Error fetching pending deletions:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch pending deletions'
        });
    }
});

/**
 * POST /api/admin/account-cancellations/:id/delete-now
 * Manually trigger immediate deletion for a specific account
 */
router.post('/:id/delete-now', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const cancellationId = parseInt(req.params.id);
        const adminId = res.locals.jwtPayload.id;

        const processor = AccountCancellationProcessor.getInstance();
        const cancellation = await processor.getCancellationById(cancellationId);

        if (!cancellation) {
            return res.status(404).json({
                success: false,
                message: 'Cancellation not found'
            });
        }

        if (cancellation.data_deleted_at) {
            return res.status(400).json({
                success: false,
                message: 'Account data already deleted'
            });
        }

        // Execute deletion
        const deletionService = DataDeletionService.getInstance();
        await deletionService.deleteUserData(cancellation.users_platform.id);

        // Mark as deleted
        await processor.markDataDeleted(cancellationId, adminId);

        return res.status(200).json({
            success: true,
            message: 'Account deleted successfully'
        });

    } catch (error: any) {
        console.error('[AccountCancellationRoutes] Error deleting account:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to delete account'
        });
    }
});

/**
 * GET /api/admin/account-cancellations/:id/estimate
 * Get data size estimate for a cancelled account
 */
router.get('/:id/estimate', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const cancellationId = parseInt(req.params.id);

        const processor = AccountCancellationProcessor.getInstance();
        const cancellation = await processor.getCancellationById(cancellationId);

        if (!cancellation) {
            return res.status(404).json({
                success: false,
                message: 'Cancellation not found'
            });
        }

        const deletionService = DataDeletionService.getInstance();
        const estimate = await deletionService.estimateUserDataSize(cancellation.users_platform.id);

        return res.status(200).json({
            success: true,
            data: {
                cancellationId,
                userId: cancellation.users_platform.id,
                userEmail: cancellation.users_platform.email,
                estimate
            }
        });

    } catch (error: any) {
        console.error('[AccountCancellationRoutes] Error estimating data size:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to estimate data size'
        });
    }
});

export default router;
