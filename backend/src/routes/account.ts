import { Router, Request, Response } from 'express';
import { AccountCancellationProcessor } from '../processors/AccountCancellationProcessor.js';
import { DataModelExportService } from '../services/DataModelExportService.js';
import { DataDeletionService } from '../services/DataDeletionService.js';
import { validateJWT } from '../middleware/authenticate.js';
import { ECancellationReasonCategory } from '../models/DRAAccountCancellation.js';

const router = Router();

/**
 * POST /api/account/cancel
 * Request account cancellation
 */
router.post('/cancel', validateJWT, async (req: Request, res: Response) => {
    try {
        const userId = res.locals.jwtPayload.id;
        const { reason, reasonCategory, exportDataBeforeDeletion } = req.body;

        // Validate reason category
        if (reasonCategory && !Object.values(ECancellationReasonCategory).includes(reasonCategory)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid cancellation reason category'
            });
        }

        const processor = AccountCancellationProcessor.getInstance();
        const cancellation = await processor.requestCancellation({
            userId,
            reason,
            reasonCategory,
            effectiveDate: undefined // Use default
        });

        return res.status(200).json({
            success: true,
            message: 'Account cancellation requested successfully',
            data: {
                cancellationId: cancellation.id,
                effectiveAt: cancellation.effective_at,
                deletionScheduledAt: cancellation.deletion_scheduled_at,
                status: cancellation.status
            }
        });

    } catch (error: any) {
        console.error('[AccountRoutes] Error requesting cancellation:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to request account cancellation'
        });
    }
});

/**
 * GET /api/account/cancellation/status
 * Get current cancellation status
 */
router.get('/cancellation/status', validateJWT, async (req: Request, res: Response) => {
    try {
        const userId = res.locals.jwtPayload.id;
        
        const processor = AccountCancellationProcessor.getInstance();
        const cancellation = await processor.getActiveCancellation(userId);

        if (!cancellation) {
            return res.status(404).json({
                success: false,
                message: 'No active cancellation found'
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                id: cancellation.id,
                status: cancellation.status,
                requestedAt: cancellation.requested_at,
                effectiveAt: cancellation.effective_at,
                deletionScheduledAt: cancellation.deletion_scheduled_at,
                dataExported: cancellation.data_exported,
                notification7DaysSent: cancellation.notification_7_days_sent,
                notification1DaySent: cancellation.notification_1_day_sent
            }
        });

    } catch (error: any) {
        console.error('[AccountRoutes] Error fetching cancellation status:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch cancellation status'
        });
    }
});

/**
 * POST /api/account/reactivate
 * Reactivate cancelled account
 */
router.post('/reactivate', validateJWT, async (req: Request, res: Response) => {
    try {
        const userId = res.locals.jwtPayload.id;
        
        const processor = AccountCancellationProcessor.getInstance();
        const cancellation = await processor.reactivateAccount(userId);

        return res.status(200).json({
            success: true,
            message: 'Account reactivated successfully',
            data: {
                cancellationId: cancellation.id,
                status: cancellation.status,
                reactivatedAt: cancellation.reactivated_at
            }
        });

    } catch (error: any) {
        console.error('[AccountRoutes] Error reactivating account:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to reactivate account'
        });
    }
});

/**
 * POST /api/account/export-data
 * Get estimate of user data size before deletion
 */
router.post('/export-data', validateJWT, async (req: Request, res: Response) => {
    try {
        const userId = res.locals.jwtPayload.id;
        
        const deletionService = DataDeletionService.getInstance();
        const estimate = await deletionService.estimateUserDataSize(userId);

        return res.status(200).json({
            success: true,
            message: 'Data size estimated successfully',
            data: estimate
        });

    } catch (error: any) {
        console.error('[AccountRoutes] Error estimating data size:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to estimate data size'
        });
    }
});

/**
 * POST /api/account/data-model/export
 * Export a data model to Excel/CSV/JSON
 */
router.post('/data-model/export', validateJWT, async (req: Request, res: Response) => {
    try {
        const userId = res.locals.jwtPayload.id;
        const { dataModelId, format = 'excel', includeMetadata = true, maxRows } = req.body;

        if (!dataModelId) {
            return res.status(400).json({
                success: false,
                message: 'Data model ID is required'
            });
        }

        if (!['excel', 'csv', 'json'].includes(format)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid format. Must be excel, csv, or json'
            });
        }

        const exportService = DataModelExportService.getInstance();
        const result = await exportService.exportDataModel(dataModelId, {
            format,
            includeMetadata,
            maxRows
        });

        // Set appropriate headers
        const contentTypes = {
            excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            csv: 'text/csv',
            json: 'application/json'
        };

        res.setHeader('Content-Type', contentTypes[format as keyof typeof contentTypes]);
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        
        return res.send(result.buffer);

    } catch (error: any) {
        console.error('[AccountRoutes] Error exporting data model:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to export data model'
        });
    }
});

/**
 * POST /api/account/data-models/export-multiple
 * Export multiple data models to a single Excel workbook
 */
router.post('/data-models/export-multiple', validateJWT, async (req: Request, res: Response) => {
    try {
        const userId = res.locals.jwtPayload.id;
        const { dataModelIds, includeMetadata = true, maxRows } = req.body;

        if (!dataModelIds || !Array.isArray(dataModelIds) || dataModelIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Data model IDs array is required'
            });
        }

        const exportService = DataModelExportService.getInstance();
        const result = await exportService.exportMultipleToExcel(dataModelIds, {
            format: 'excel',
            includeMetadata,
            maxRows
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        
        return res.send(result.buffer);

    } catch (error: any) {
        console.error('[AccountRoutes] Error exporting multiple data models:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to export data models'
        });
    }
});

export default router;
