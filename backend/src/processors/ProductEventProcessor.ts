import { Request, Response } from 'express';
import { ProductAnalyticsService } from '../services/ProductAnalyticsService.js';
import { IOrganizationContextRequest } from '../middleware/organizationContext.js';

const MAX_EVENTS_PER_BATCH = 100;
const MAX_PROPERTIES_SIZE = 32 * 1024;

export class ProductEventProcessor {
    private analyticsService = ProductAnalyticsService.getInstance();

    async ingest(req: IOrganizationContextRequest, res: Response): Promise<void> {
        try {
            const userId = req.tokenDetails?.user_id || req.user?.id || null;
            const events = Array.isArray(req.body?.events) ? req.body.events : [];

            if (events.length === 0) {
                res.status(400).json({ success: false, error: 'events array is required' });
                return;
            }

            const payload = events.slice(0, MAX_EVENTS_PER_BATCH);
            const inputs = payload.map((raw: any) => ({
                eventName: String(raw.name || 'unknown'),
                userId,
                organizationId: req.organizationId ?? null,
                workspaceId: (req as any).workspaceId ?? null,
                projectId: raw.projectId ? parseInt(String(raw.projectId), 10) : null,
                planId: raw.planId ? parseInt(String(raw.planId), 10) : null,
                properties: raw.properties ?? null,
                sessionId: raw.sessionId ? String(raw.sessionId).slice(0, 64) : null,
                source: 'frontend' as const,
                timestamp: raw.ts ? new Date(raw.ts) : undefined,
            }));

            const oversized = JSON.stringify(inputs.map((i: any) => i.properties)).length > MAX_PROPERTIES_SIZE * payload.length;
            if (oversized) {
                res.status(413).json({ success: false, error: 'Event payload too large' });
                return;
            }

            await this.analyticsService.recordBatch(inputs);
            res.status(200).json({ success: true, ingested: inputs.length });
        } catch (error: any) {
            console.error('[ProductEventProcessor] ingest error:', error);
            res.status(500).json({ success: false, error: 'Failed to record events' });
        }
    }
}
