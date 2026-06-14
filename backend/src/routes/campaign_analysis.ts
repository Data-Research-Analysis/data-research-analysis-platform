/**
 * Campaign Analysis Routes
 *
 * Defines REST API endpoints for the Campaign Analysis Service (CMP-002).
 *
 * Endpoints:
 *   GET /campaign-analysis/:campaignId              - Full campaign analysis
 *   GET /campaign-analysis/:campaignId/summary      - KPI summary cards only
 *   GET /campaign-analysis/:campaignId/trend        - Daily trend only
 *   GET /campaign-analysis/:campaignId/dimensions   - Dimension breakdowns only
 *
 * All endpoints require authentication via the existing JWT middleware.
 */

import { Router } from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { CampaignController } from '../controllers/CampaignController.js';

const router = Router();

// Apply authentication middleware to all routes in this router
router.use(validateJWT);

/**
 * GET /campaign-analysis/:campaignId
 *
 * Returns full deep campaign analysis including KPIs, daily trend,
 * dimension breakdowns (ad_group, keyword, device, geo), performance
 * scoring, and AI-generated analysis with recommendations.
 *
 * Query params:
 *   dataModelId (required) - ID of the data model to query
 *   startDate   (required) - ISO 8601 date string
 *   endDate     (required) - ISO 8601 date string
 *
 * Response:
 *   {
 *     success: true,
 *     data: {
 *       campaignId, campaignName, channel,
 *       kpis: [{ kpi, label, value }],
 *       dailyTrend: [{ date, spend, impressions, clicks, conversions, revenue, ctr, cpc, cpa, roas }],
 *       dimensionBreakdowns: [{
 *         dimension, available,
 *         rows: [{ label, spend, impressions, clicks, conversions, revenue,
 *                  ctr, cpc, cpa, roas, performanceScore, status }]
 *       }],
 *       aiAnalysis: string | null,
 *       recommendations: string[]
 *     }
 *   }
 */
router.get('/:campaignId', CampaignController.getAnalysis);

/**
 * GET /campaign-analysis/:campaignId/summary
 *
 * Returns just the campaign KPI summary cards (lighter endpoint).
 */
router.get('/:campaignId/summary', CampaignController.getSummary);

/**
 * GET /campaign-analysis/:campaignId/trend
 *
 * Returns only the daily trend data for a campaign.
 */
router.get('/:campaignId/trend', CampaignController.getTrend);

/**
 * GET /campaign-analysis/:campaignId/dimensions
 *
 * Returns only the dimension breakdowns with performance scoring.
 */
router.get('/:campaignId/dimensions', CampaignController.getDimensions);

export default router;