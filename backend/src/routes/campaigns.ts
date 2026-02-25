import express, { Request, Response } from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { validate } from '../middleware/validator.js';
import { body, param } from 'express-validator';
import { CampaignProcessor } from '../processors/CampaignProcessor.js';

const router = express.Router();
const campaignProcessor = CampaignProcessor.getInstance();

/**
 * List campaigns for a project
 * GET /campaigns/project/:projectId
 */
router.get(
    '/project/:projectId',
    validateJWT,
    validate([param('projectId').notEmpty().isInt().toInt()]),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const projectId = parseInt(req.params.projectId);
            const campaigns = await campaignProcessor.listProjectCampaigns(projectId);
            res.status(200).json(campaigns);
        } catch (err: any) {
            res.status(500).json({ success: false, error: err.message });
        }
    },
);

/**
 * Get single campaign with channels
 * GET /campaigns/:campaignId
 */
router.get(
    '/:campaignId',
    validateJWT,
    validate([param('campaignId').notEmpty().isInt().toInt()]),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const campaignId = parseInt(req.params.campaignId);
            const campaign = await campaignProcessor.getCampaignById(campaignId);
            if (!campaign) {
                res.status(404).json({ success: false, error: 'Campaign not found' });
                return;
            }
            res.status(200).json(campaign);
        } catch (err: any) {
            res.status(500).json({ success: false, error: err.message });
        }
    },
);

/**
 * Create a campaign
 * POST /campaigns
 */
router.post(
    '/',
    validateJWT,
    validate([
        body('project_id').notEmpty().isInt().withMessage('project_id must be a valid integer'),
        body('name').notEmpty().trim().withMessage('name is required'),
        body('objective').notEmpty().trim().withMessage('objective is required'),
        body('status').optional().trim(),
        body('budget_total').optional({ nullable: true }).isNumeric(),
        body('target_leads').optional({ nullable: true }).isInt(),
        body('target_cpl').optional({ nullable: true }).isNumeric(),
        body('target_roas').optional({ nullable: true }).isNumeric(),
        body('target_impressions').optional({ nullable: true }).isInt(),
        body('start_date').optional({ nullable: true }).isISO8601(),
        body('end_date').optional({ nullable: true }).isISO8601(),
    ]),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const tokenDetails = req.body.tokenDetails;
            const {
                project_id,
                name,
                description,
                objective,
                status,
                budget_total,
                target_leads,
                target_cpl,
                target_roas,
                target_impressions,
                start_date,
                end_date,
            } = req.body;

            const campaign = await campaignProcessor.createCampaign(
                parseInt(project_id),
                tokenDetails.user_id,
                {
                    name,
                    description: description ?? null,
                    objective,
                    status,
                    budget_total: budget_total ?? null,
                    target_leads: target_leads ?? null,
                    target_cpl: target_cpl ?? null,
                    target_roas: target_roas ?? null,
                    target_impressions: target_impressions ?? null,
                    start_date: start_date ?? null,
                    end_date: end_date ?? null,
                },
            );
            res.status(201).json(campaign);
        } catch (err: any) {
            res.status(400).json({ success: false, error: err.message });
        }
    },
);

/**
 * Update a campaign
 * PUT /campaigns/:campaignId
 */
router.put(
    '/:campaignId',
    validateJWT,
    validate([
        param('campaignId').notEmpty().isInt().toInt(),
        body('name').optional().trim(),
        body('description').optional({ nullable: true }),
        body('objective').optional().trim(),
        body('budget_total').optional({ nullable: true }).isNumeric(),
        body('target_leads').optional({ nullable: true }).isInt(),
        body('target_cpl').optional({ nullable: true }).isNumeric(),
        body('target_roas').optional({ nullable: true }).isNumeric(),
        body('target_impressions').optional({ nullable: true }).isInt(),
        body('start_date').optional({ nullable: true }).isISO8601(),
        body('end_date').optional({ nullable: true }).isISO8601(),
    ]),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const campaignId = parseInt(req.params.campaignId);
            const updated = await campaignProcessor.updateCampaign(campaignId, req.body);
            if (!updated) {
                res.status(404).json({ success: false, error: 'Campaign not found' });
                return;
            }
            res.status(200).json(updated);
        } catch (err: any) {
            res.status(400).json({ success: false, error: err.message });
        }
    },
);

/**
 * Update campaign status only
 * PATCH /campaigns/:campaignId/status
 */
router.patch(
    '/:campaignId/status',
    validateJWT,
    validate([
        param('campaignId').notEmpty().isInt().toInt(),
        body('status').notEmpty().trim().withMessage('status is required'),
    ]),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const campaignId = parseInt(req.params.campaignId);
            const { status } = req.body;
            const updated = await campaignProcessor.updateCampaignStatus(campaignId, status);
            if (!updated) {
                res.status(404).json({ success: false, error: 'Campaign not found' });
                return;
            }
            res.status(200).json({ success: true, status });
        } catch (err: any) {
            res.status(400).json({ success: false, error: err.message });
        }
    },
);

/**
 * Delete a campaign (cascades to channels)
 * DELETE /campaigns/:campaignId
 */
router.delete(
    '/:campaignId',
    validateJWT,
    validate([param('campaignId').notEmpty().isInt().toInt()]),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const campaignId = parseInt(req.params.campaignId);
            const deleted = await campaignProcessor.deleteCampaign(campaignId);
            if (!deleted) {
                res.status(404).json({ success: false, error: 'Campaign not found' });
                return;
            }
            res.status(200).json({ success: true, message: 'Campaign deleted.' });
        } catch (err: any) {
            res.status(500).json({ success: false, error: err.message });
        }
    },
);

/**
 * Add a channel to a campaign
 * POST /campaigns/:campaignId/channels
 */
router.post(
    '/:campaignId/channels',
    validateJWT,
    validate([
        param('campaignId').notEmpty().isInt().toInt(),
        body('channel_type').notEmpty().trim().withMessage('channel_type is required'),
        body('data_source_id').optional({ nullable: true }).isInt(),
        body('channel_name').optional({ nullable: true }).trim(),
        body('is_offline').optional().isBoolean(),
    ]),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const campaignId = parseInt(req.params.campaignId);
            const { channel_type, data_source_id, channel_name, is_offline } = req.body;
            const channel = await campaignProcessor.addChannel(campaignId, {
                channel_type,
                data_source_id: data_source_id ?? null,
                channel_name: channel_name ?? null,
                is_offline: is_offline ?? false,
            });
            res.status(201).json(channel);
        } catch (err: any) {
            res.status(400).json({ success: false, error: err.message });
        }
    },
);

/**
 * Remove a channel from a campaign
 * DELETE /campaigns/channels/:channelId
 */
router.delete(
    '/channels/:channelId',
    validateJWT,
    validate([param('channelId').notEmpty().isInt().toInt()]),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const channelId = parseInt(req.params.channelId);
            const deleted = await campaignProcessor.removeChannel(channelId);
            if (!deleted) {
                res.status(404).json({ success: false, error: 'Channel not found' });
                return;
            }
            res.status(200).json({ success: true, message: 'Channel removed.' });
        } catch (err: any) {
            res.status(500).json({ success: false, error: err.message });
        }
    },
);

/**
 * List channels for a campaign
 * GET /campaigns/:campaignId/channels
 */
router.get(
    '/:campaignId/channels',
    validateJWT,
    validate([param('campaignId').notEmpty().isInt().toInt()]),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const campaignId = parseInt(req.params.campaignId);
            const channels = await campaignProcessor.listCampaignChannels(campaignId);
            res.status(200).json(channels);
        } catch (err: any) {
            res.status(500).json({ success: false, error: err.message });
        }
    },
);

export default router;
