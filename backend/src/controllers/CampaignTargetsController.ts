/**
 * Campaign Targets Controller
 *
 * HTTP handlers for user-authored campaign and ad set / ad group targets
 * (north-star metrics). Delegates persistence to CampaignTargetsService.
 */

import { Request, Response } from 'express';
import {
    CampaignTargetsService,
    CampaignTargetEntityLevel,
} from '../services/CampaignTargetsService.js';

export class CampaignTargetsController {
    /**
     * GET /campaign-targets
     *
     * Query: projectId (required), dataSourceId?, channel?, campaignId?, entityLevel?
     */
    static async list(req: Request, res: Response): Promise<void> {
        try {
            const projectId = Number(req.query.projectId);
            if (!projectId) {
                res.status(400).json({ success: false, error: 'projectId is required' });
                return;
            }

            const dataSourceId = req.query.dataSourceId ? Number(req.query.dataSourceId) : null;
            const service = CampaignTargetsService.getInstance();
            const targets = await service.list({
                projectId,
                dataSourceId,
                channel: (req.query.channel as string) || null,
                campaignId: (req.query.campaignId as string) || null,
                entityLevel: (req.query.entityLevel as CampaignTargetEntityLevel) || null,
            });

            res.json({ success: true, data: targets });
        } catch (error: any) {
            console.error('[CampaignTargetsController] list error:', error);
            res.status(500).json({ success: false, error: error.message || 'Failed to load campaign targets' });
        }
    }

    /**
     * PUT /campaign-targets
     *
     * Body: { projectId, dataSourceId?, channel?, entityLevel, campaignId?, entityId, ...target fields }
     */
    static async upsert(req: Request, res: Response): Promise<void> {
        try {
            const body = req.body || {};
            const projectId = Number(body.projectId);
            const entityLevel = body.entityLevel as CampaignTargetEntityLevel;
            const entityId = body.entityId != null ? String(body.entityId) : '';

            if (!projectId) {
                res.status(400).json({ success: false, error: 'projectId is required' });
                return;
            }
            if (entityLevel !== 'campaign' && entityLevel !== 'ad_set') {
                res.status(400).json({ success: false, error: "entityLevel must be 'campaign' or 'ad_set'" });
                return;
            }
            if (!entityId) {
                res.status(400).json({ success: false, error: 'entityId is required' });
                return;
            }

            const tokenDetails = (req as any).body?.tokenDetails;
            const userId: number | null = tokenDetails?.user_id ?? (req as any).user?.id ?? null;

            const service = CampaignTargetsService.getInstance();
            const target = await service.upsert(
                {
                    projectId,
                    dataSourceId: body.dataSourceId != null ? Number(body.dataSourceId) : null,
                    channel: body.channel ?? null,
                    entityLevel,
                    campaignId: body.campaignId != null ? String(body.campaignId) : null,
                    entityId,
                    entityName: body.entityName ?? null,
                    buyingModel: body.buyingModel ?? null,
                    audienceSize: body.audienceSize ?? null,
                    targetCtr: body.targetCtr ?? null,
                    targetClicks: body.targetClicks ?? null,
                    targetImpressions: body.targetImpressions ?? null,
                    targetRoas: body.targetRoas ?? null,
                    targetLeads: body.targetLeads ?? null,
                    targetConversions: body.targetConversions ?? null,
                    targetRevenue: body.targetRevenue ?? null,
                    targetCpc: body.targetCpc ?? null,
                    targetCpm: body.targetCpm ?? null,
                    targetCpa: body.targetCpa ?? null,
                    targetCpl: body.targetCpl ?? null,
                    targetFrequency: body.targetFrequency ?? null,
                    initialInvestment: body.initialInvestment ?? null,
                    dailyBudget: body.dailyBudget ?? null,
                    lifetimeBudget: body.lifetimeBudget ?? null,
                    currency: body.currency ?? null,
                    flightStartDate: body.flightStartDate ?? null,
                    flightEndDate: body.flightEndDate ?? null,
                    notes: body.notes ?? null,
                },
                userId,
            );

            res.json({ success: true, data: target });
        } catch (error: any) {
            console.error('[CampaignTargetsController] upsert error:', error);
            res.status(500).json({ success: false, error: error.message || 'Failed to save campaign target' });
        }
    }

    /**
     * POST /campaign-targets/copy
     *
     * Body: { projectId, dataSourceId?, channel?, campaignId?, sourceEntityId,
     *        targets: [{ entityId, entityName? }] }
     */
    static async copy(req: Request, res: Response): Promise<void> {
        try {
            const body = req.body || {};
            const projectId = Number(body.projectId);
            const sourceEntityId = body.sourceEntityId != null ? String(body.sourceEntityId) : '';
            const targets: { entityId: string; entityName?: string | null }[] =
                Array.isArray(body.targets) ? body.targets : [];

            if (!projectId) {
                res.status(400).json({ success: false, error: 'projectId is required' });
                return;
            }
            if (!sourceEntityId) {
                res.status(400).json({ success: false, error: 'sourceEntityId is required' });
                return;
            }
            if (targets.length === 0) {
                res.status(400).json({ success: false, error: 'targets must be a non-empty list' });
                return;
            }

            const tokenDetails = (req as any).body?.tokenDetails;
            const userId: number | null = tokenDetails?.user_id ?? (req as any).user?.id ?? null;

            const service = CampaignTargetsService.getInstance();
            const rows = await service.copyTo({
                projectId,
                dataSourceId: body.dataSourceId != null ? Number(body.dataSourceId) : null,
                channel: body.channel ?? null,
                campaignId: body.campaignId != null ? String(body.campaignId) : null,
                entityLevel: 'ad_set',
                sourceEntityId,
                targets: targets.map(t => ({
                    entityId: String(t.entityId),
                    entityName: t.entityName ?? null,
                })),
                userId,
            });

            res.json({ success: true, data: rows });
        } catch (error: any) {
            console.error('[CampaignTargetsController] copy error:', error);
            res.status(500).json({ success: false, error: error.message || 'Failed to copy campaign targets' });
        }
    }

    /**
     * DELETE /campaign-targets/:id
     *
     * Query: projectId (required)
     */
    static async remove(req: Request, res: Response): Promise<void> {
        try {
            const id = Number(req.params.id);
            const projectId = Number(req.query.projectId);
            if (!id || !projectId) {
                res.status(400).json({ success: false, error: 'id and projectId are required' });
                return;
            }

            const service = CampaignTargetsService.getInstance();
            const deleted = await service.remove(id, projectId);
            if (!deleted) {
                res.status(404).json({ success: false, error: 'Campaign target not found' });
                return;
            }

            res.json({ success: true });
        } catch (error: any) {
            console.error('[CampaignTargetsController] remove error:', error);
            res.status(500).json({ success: false, error: error.message || 'Failed to delete campaign target' });
        }
    }
}

export default CampaignTargetsController;
