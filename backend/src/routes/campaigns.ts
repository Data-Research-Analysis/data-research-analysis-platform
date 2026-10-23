import express, { Request, Response } from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { validate } from '../middleware/validator.js';
import { body, param, query, matchedData } from 'express-validator';
import { CampaignProcessor } from '../processors/CampaignProcessor.js';
import { requiresProjectRole } from '../middleware/requiresProjectRole.js';
import { MarketingMetricsService } from '../services/MarketingMetricsService.js';

const router = express.Router();
const campaignProcessor = CampaignProcessor.getInstance();

/**
 * List link suggestions for plan-created campaigns.
 * GET /campaigns/project/:projectId/link-suggestions
 *
 * For every plan-created campaign that is not yet linked to a live synced
 * campaign, find candidate external campaigns in the same channel (matched by
 * normalized name). Confirmation is a manager/cmo action.
 */
router.get(
    '/project/:projectId/link-suggestions',
    validateJWT,
    requiresProjectRole(['analyst', 'manager', 'cmo']),
    validate([param('projectId').notEmpty().isInt().toInt()]),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const projectId = parseInt(req.params.projectId);
            const campaigns = await campaignProcessor.listProjectCampaigns(projectId);
            const unlinked = campaigns.filter(c => c.plan_id != null && !c.external_campaign_id);
            if (unlinked.length === 0) {
                res.status(200).json({ success: true, suggestions: [] });
                return;
            }

            const end = new Date();
            const start = new Date();
            start.setMonth(start.getMonth() - 3);

            const { rows } = await MarketingMetricsService.getInstance().getCampaignPerformanceList(
                projectId,
                start,
                end,
                { isProjectId: true, pageSize: 500 },
            );

            const norm = (s: string): string => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

            const suggestions = unlinked.map((c) => {
                const channel = c.channels?.[0]?.channel_type ?? null;
                const cn = norm(c.name);
                const candidates = rows
                    .filter((r) => {
                        const rc = norm(r.channel || '');
                        if (channel && rc && rc !== norm(channel)) return false;
                        const rn = norm(r.campaignName);
                        if (!rn) return false;
                        return rn.includes(cn) || cn.includes(rn);
                    })
                    .slice(0, 10)
                    .map((r) => ({
                        externalCampaignId: String(r.campaignId),
                        externalCampaignName: String(r.campaignName || r.campaignId),
                        channel: r.channel || channel || 'unknown',
                        sourceTable: r.sourceTable,
                    }));

                return {
                    campaignId: c.id,
                    campaignName: c.name,
                    channel,
                    candidates,
                };
            });

            res.status(200).json({ success: true, suggestions });
        } catch (err: any) {
            res.status(500).json({ success: false, error: err.message });
        }
    },
);

/**
 * Link a plan-created campaign to a live synced campaign.
 * PUT /campaigns/:campaignId/link   body: { externalCampaignId, linkedDataSourceId? }
 */
router.put(
    '/:campaignId/link',
    validateJWT,
    requiresProjectRole(['manager', 'cmo']),
    validate([
        param('campaignId').notEmpty().isInt().toInt(),
        body('externalCampaignId').notEmpty().trim(),
        body('linkedDataSourceId').optional({ nullable: true }).isInt().toInt(),
    ]),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const { campaignId, externalCampaignId, linkedDataSourceId } = matchedData(req);
            const campaign = await campaignProcessor.linkCampaign(
                campaignId,
                String(externalCampaignId),
                linkedDataSourceId ?? null,
            );
            if (!campaign) {
                res.status(404).json({ success: false, error: 'Campaign not found' });
                return;
            }
            res.status(200).json({ success: true, data: campaign });
        } catch (err: any) {
            res.status(500).json({ success: false, error: err.message });
        }
    },
);

/**
 * Unlink a plan-created campaign from its live synced campaign.
 * DELETE /campaigns/:campaignId/link
 */
router.delete(
    '/:campaignId/link',
    validateJWT,
    requiresProjectRole(['manager', 'cmo']),
    validate([param('campaignId').notEmpty().isInt().toInt()]),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const campaignId = parseInt(req.params.campaignId);
            const campaign = await campaignProcessor.unlinkCampaign(campaignId);
            if (!campaign) {
                res.status(404).json({ success: false, error: 'Campaign not found' });
                return;
            }
            res.status(200).json({ success: true, data: campaign });
        } catch (err: any) {
            res.status(500).json({ success: false, error: err.message });
        }
    },
);

/**
 * List campaigns for a project
 * GET /campaigns/project/:projectId
 */
router.get(
    '/project/:projectId',
    validateJWT,
    requiresProjectRole(['analyst', 'manager', 'cmo']),
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
    requiresProjectRole(['analyst']),
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
        body('platform_campaign_id').optional({ nullable: true }).trim(),
        body('platform_campaign_name').optional({ nullable: true }).trim(),
    ]),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const campaignId = parseInt(req.params.campaignId);
            const { channel_type, data_source_id, channel_name, is_offline, platform_campaign_id, platform_campaign_name } = req.body;
            const channel = await campaignProcessor.addChannel(campaignId, {
                channel_type,
                data_source_id: data_source_id ?? null,
                channel_name: channel_name ?? null,
                is_offline: is_offline ?? false,
                platform_campaign_id: platform_campaign_id ?? null,
                platform_campaign_name: platform_campaign_name ?? null,
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

/**
 * Get available platform campaigns for a connected data source
 * GET /campaigns/available-platform-campaigns?dataSourceId=X&channelType=Y
 */
router.get(
    '/available-platform-campaigns',
    validateJWT,
    validate([
        query('dataSourceId').notEmpty().isInt().withMessage('dataSourceId must be an integer').toInt(),
        query('channelType').notEmpty().trim().withMessage('channelType is required'),
    ]),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const dataSourceId = parseInt(req.query.dataSourceId as string, 10);
            const channelType = (req.query.channelType as string).trim();
            const result = await campaignProcessor.getAvailablePlatformCampaigns(dataSourceId, channelType);
            res.status(200).json({ success: true, ...result });
        } catch (err: any) {
            console.error('[GET /campaigns/available-platform-campaigns]', err);
            res.status(500).json({ success: false, error: err.message });
        }
    },
);

/**
 * Update a campaign channel (link/unlink platform campaign)
 * PATCH /campaigns/:campaignId/channels/:channelId
 */
router.patch(
    '/:campaignId/channels/:channelId',
    validateJWT,
    validate([
        param('campaignId').notEmpty().isInt().toInt(),
        param('channelId').notEmpty().isInt().toInt(),
        body('data_source_id').optional({ nullable: true }).isInt(),
        body('platform_campaign_id').optional({ nullable: true }).trim(),
        body('platform_campaign_name').optional({ nullable: true }).trim(),
    ]),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const channelId = parseInt(req.params.channelId, 10);
            const { data_source_id, platform_campaign_id, platform_campaign_name } = req.body;
            const updated = await campaignProcessor.updateChannel(channelId, {
                data_source_id: data_source_id ?? undefined,
                platform_campaign_id: platform_campaign_id ?? undefined,
                platform_campaign_name: platform_campaign_name ?? undefined,
            });
            if (!updated) {
                res.status(404).json({ success: false, error: 'Channel not found' });
                return;
            }
            res.status(200).json({ success: true, channel: updated });
        } catch (err: any) {
            console.error('[PATCH /campaigns/:campaignId/channels/:channelId]', err);
            res.status(500).json({ success: false, error: err.message });
        }
    },
);

export default router;
