/**
 * Marketing Metrics Routes
 *
 * Defines REST API endpoints for the Marketing Metrics Calculation Service.
 *
 * Endpoints:
 *   GET  /summary                          - Aggregated marketing KPIs
 *   GET  /channels                         - Cross-channel comparison
 *   POST /period-comparison                - Period-over-period comparison
 *   GET  /campaigns/:campaignId            - Campaign-level drill-down
 *   GET  /anomalies                        - Anomaly detection (rolling average)
 *   POST /insights                         - AI-enhanced insights (Gemini)
 *
 * All endpoints require authentication via the existing JWT middleware.
 */

import { Router } from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { MarketingMetricsController } from '../controllers/MarketingMetricsController.js';

const router = Router();

// Apply authentication middleware to all routes in this router
router.use(validateJWT);

/**
 * GET /marketing-metrics/summary
 *
 * Returns aggregated marketing KPIs for a data model within a date range,
 * including period-over-period comparison and channel breakdown.
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
 *       kpis: [{ kpi, label, current, previous, changePercent }],
 *       channelBreakdown: [{ channel, spend, impressions, clicks, ... }],
 *       totalSpend, totalImpressions, totalClicks, totalConversions, totalRevenue,
 *       averageCtr, averageCpc, averageCpa, overallRoas, periodDays
 *     }
 *   }
 */
router.get('/summary', MarketingMetricsController.getSummary);

/**
 * GET /marketing-metrics/channels
 *
 * Returns per-channel marketing metrics for cross-channel comparison.
 *
 * Query params:
 *   dataModelId (required)
 *   startDate   (required)
 *   endDate     (required)
 *
 * Response:
 *   {
 *     success: true,
 *     data: [{ channel, spend, impressions, clicks, conversions, revenue, ctr, cpc, cpa, roas }]
 *   }
 */
router.get('/channels', MarketingMetricsController.getChannelComparison);

/**
 * POST /marketing-metrics/period-comparison
 *
 * Compares two time periods side by side.
 *
 * Body:
 *   dataModelId (required)
 *   currentStart (required) - ISO 8601 date string
 *   currentEnd   (required) - ISO 8601 date string
 *   priorStart   (required) - ISO 8601 date string
 *   priorEnd     (required) - ISO 8601 date string
 *
 * Response:
 *   {
 *     success: true,
 *     data: {
 *       current: { [kpi]: number },
 *       previous: { [kpi]: number },
 *       changePercents: { [kpi]: number },
 *       kpis: [{ kpi, label, current, previous, changePercent }]
 *     }
 *   }
 */
router.post('/period-comparison', MarketingMetricsController.getPeriodComparison);

/**
 * GET /marketing-metrics/campaigns
 *
 * Returns a paginated campaign performance list with aggregated KPIs,
 * status, and 7-day spend trends for sparklines.
 *
 * Query params:
 *   dataModelId (required)
 *   startDate   (required) - ISO 8601 date string
 *   endDate     (required) - ISO 8601 date string
 *   search      (optional) - filter by campaign name/id
 *   channel     (optional) - filter by channel
 *   status      (optional) - filter by status (active/paused/completed)
 *   sortBy      (optional, default 'spend') - column to sort by
 *   sortDir     (optional, default 'desc') - sort direction (asc/desc)
 *   page        (optional, default 1)
 *   pageSize    (optional, default 20)
 *
 * Response:
 *   {
 *     success: true,
 *     data: [{ campaignId, campaignName, channel, spend, impressions, clicks,
 *              conversions, revenue, ctr, cpc, cpa, roas, status, dailyTrend }],
 *     total: number
 *   }
 */
router.get('/campaigns', MarketingMetricsController.getCampaignPerformanceList);

/**
 * GET /marketing-metrics/campaigns/:campaignId
 *
 * Returns campaign-level drill-down with daily KPI trend.
 *
 * Path params:
 *   campaignId (required)
 *
 * Query params:
 *   dataModelId (required)
 *   startDate   (required)
 *   endDate     (required)
 *
 * Response:
 *   {
 *     success: true,
 *     data: {
 *       campaignId, campaignName, channel,
 *       kpis: { [kpi]: number },
 *       dailyTrend: [{ date, [kpi]: number }]
 *     }
 *   }
 */
router.get('/campaigns/:campaignId', MarketingMetricsController.getCampaignDetail);

/**
 * GET /marketing-metrics/anomalies
 *
 * Detects anomalies by comparing current period daily values against
 * a 4-week rolling average. Flags deviations exceeding the threshold.
 *
 * Query params:
 *   dataModelId (required)
 *   startDate   (required)
 *   endDate     (required)
 *   threshold   (optional, default 20) - deviation percentage to flag
 *
 * Response:
 *   {
 *     success: true,
 *     data: [{ metric, date, value, expected, deviationPercent, severity }]
 *   }
 */
router.get('/anomalies', MarketingMetricsController.getAnomalies);

/**
 * POST /marketing-metrics/insights
 *
 * Generates AI-powered marketing insights using Gemini.
 * Aggregates summary data and anomalies, then sends to Gemini for analysis.
 *
 * Body:
 *   dataModelId (required)
 *   startDate   (required)
 *   endDate     (required)
 *
 * Response:
 *   {
 *     success: true,
 *     data: [{ title, summary, recommendation, confidence, metrics }]
 *   }
 */
router.post('/insights', MarketingMetricsController.getAIInsights);

export default router;