import express, { Request, Response } from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { validate } from '../middleware/validator.js';
import { body, param } from 'express-validator';
import { OfflineTrackingProcessor } from '../processors/OfflineTrackingProcessor.js';

const router = express.Router();
const offlineProcessor = OfflineTrackingProcessor.getInstance();

/**
 * Get aggregated offline summary for a campaign
 * GET /campaigns/:campaignId/offline/summary
 */
router.get(
    '/:campaignId/offline/summary',
    validateJWT,
    validate([param('campaignId').notEmpty().isInt().toInt()]),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const campaignId = parseInt(req.params.campaignId);
            const summary = await offlineProcessor.getOfflineSummaryForCampaign(campaignId);
            res.status(200).json(summary);
        } catch (err: any) {
            res.status(500).json({ success: false, error: err.message });
        }
    },
);

/**
 * List offline entries for a channel
 * GET /campaigns/channels/:channelId/offline
 */
router.get(
    '/channels/:channelId/offline',
    validateJWT,
    validate([param('channelId').notEmpty().isInt().toInt()]),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const channelId = parseInt(req.params.channelId);
            const entries = await offlineProcessor.getEntriesForChannel(channelId);
            res.status(200).json(entries);
        } catch (err: any) {
            res.status(500).json({ success: false, error: err.message });
        }
    },
);

/**
 * Add an offline entry for a channel
 * POST /campaigns/channels/:channelId/offline
 */
router.post(
    '/channels/:channelId/offline',
    validateJWT,
    validate([
        param('channelId').notEmpty().isInt().toInt(),
        body('entry_date').notEmpty().isISO8601().withMessage('entry_date must be a valid date'),
        body('actual_spend').notEmpty().isNumeric().withMessage('actual_spend must be a number'),
        body('impressions_estimated').optional({ nullable: true }).isInt({ min: 0 }),
        body('leads_generated').optional({ nullable: true }).isInt({ min: 0 }),
        body('pipeline_value').optional({ nullable: true }).isNumeric(),
        body('notes').optional({ nullable: true }).isString(),
    ]),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const channelId = parseInt(req.params.channelId);
            const { entry_date, actual_spend, impressions_estimated, leads_generated, pipeline_value, notes } = req.body;
            const entry = await offlineProcessor.addEntry(channelId, {
                entry_date,
                actual_spend: Number(actual_spend),
                impressions_estimated: impressions_estimated ?? null,
                leads_generated: leads_generated ?? null,
                pipeline_value: pipeline_value ?? null,
                notes: notes ?? null,
            });
            res.status(201).json(entry);
        } catch (err: any) {
            if (err.message?.includes('duplicate') || err.code === '23505') {
                res.status(409).json({ success: false, error: 'An entry for this channel and date already exists' });
                return;
            }
            res.status(500).json({ success: false, error: err.message });
        }
    },
);

/**
 * Update an offline entry
 * PUT /campaigns/offline/:entryId
 */
router.put(
    '/offline/:entryId',
    validateJWT,
    validate([
        param('entryId').notEmpty().isInt().toInt(),
        body('entry_date').optional().isISO8601(),
        body('actual_spend').optional().isNumeric(),
        body('impressions_estimated').optional({ nullable: true }).isInt({ min: 0 }),
        body('leads_generated').optional({ nullable: true }).isInt({ min: 0 }),
        body('pipeline_value').optional({ nullable: true }).isNumeric(),
        body('notes').optional({ nullable: true }).isString(),
    ]),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const entryId = parseInt(req.params.entryId);
            const { entry_date, actual_spend, impressions_estimated, leads_generated, pipeline_value, notes } = req.body;

            const updateData: Record<string, any> = {};
            if (entry_date !== undefined) updateData.entry_date = entry_date;
            if (actual_spend !== undefined) updateData.actual_spend = Number(actual_spend);
            if (impressions_estimated !== undefined) updateData.impressions_estimated = impressions_estimated;
            if (leads_generated !== undefined) updateData.leads_generated = leads_generated;
            if (pipeline_value !== undefined) updateData.pipeline_value = pipeline_value;
            if (notes !== undefined) updateData.notes = notes;

            const updated = await offlineProcessor.updateEntry(entryId, updateData);
            if (!updated) {
                res.status(404).json({ success: false, error: 'Entry not found' });
                return;
            }
            res.status(200).json(updated);
        } catch (err: any) {
            if (err.message?.includes('duplicate') || err.code === '23505') {
                res.status(409).json({ success: false, error: 'An entry for this channel and date already exists' });
                return;
            }
            res.status(500).json({ success: false, error: err.message });
        }
    },
);

/**
 * Delete an offline entry
 * DELETE /campaigns/offline/:entryId
 */
router.delete(
    '/offline/:entryId',
    validateJWT,
    validate([param('entryId').notEmpty().isInt().toInt()]),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const entryId = parseInt(req.params.entryId);
            const deleted = await offlineProcessor.deleteEntry(entryId);
            if (!deleted) {
                res.status(404).json({ success: false, error: 'Entry not found' });
                return;
            }
            res.status(200).json({ success: true });
        } catch (err: any) {
            res.status(500).json({ success: false, error: err.message });
        }
    },
);

export default router;
