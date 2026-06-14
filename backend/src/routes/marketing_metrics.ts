/**
 * Marketing Metrics Routes
 *
 * Defines REST API endpoints for the Marketing Metrics Calculation Service.
 *
 * **Primary identifier:** projectId (for API-based data sources).
 * The backend resolves physical tables via project_id instead of data_model_id.
 * dataModelId is still accepted as a fallback for file-based sources that
 * don't belong to a project.
 *
 * Endpoints:
 *   GET  /summary                          - Aggregated marketing KPIs
 *   GET  /channels                         - Cross-channel comparison
 *   POST /period-comparison                - Period-over-period comparison
 *   GET  /campaigns                        - Campaign performance list
 *   GET  /campaigns/:campaignId            - Campaign-level drill-down
 *   GET  /anomalies                        - Anomaly detection (rolling average)
 *   POST /anomalies                        - Advanced anomaly detection & AI alerts (MKT-005)
 *   POST /budget-optimize                  - AI-powered budget allocation optimizer (CMP-004)
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
 * Returns aggregated marketing KPIs for a project within a date range,
 * including period-over-period comparison and channel breakdown.
 *
 * Query params:
 *   projectId   (required, primary) - ID of the project to query
 *   dataModelId (optional, fallback) - ID of the data model (file-based sources)
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
 *   projectId   (required, primary) - ID of the project to query
 *   dataModelId (optional, fallback) - ID of the data model (file-based sources)
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
 *   projectId   (required, primary) - ID of the project to query
 *   dataModelId (optional, fallback) - ID of the data model (file-based sources)
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
 *   projectId   (required, primary) - ID of the project to query
 *   dataModelId (optional, fallback) - ID of the data model (file-based sources)
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
 *   projectId   (required, primary) - ID of the project to query
 *   dataModelId (optional, fallback) - ID of the data model (file-based sources)
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
 *   projectId   (required, primary) - ID of the project to query
 *   dataModelId (optional, fallback) - ID of the data model (file-based sources)
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
 * POST /marketing-metrics/anomalies
 *
 * Advanced anomaly detection and AI-powered alerts (MKT-005).
 * Runs four detection methods: sudden change, trend break, budget pacing,
 * and performance threshold. Optionally enhances alerts with Gemini AI.
 *
 * Body:
 *   project_id           (required, primary) - ID of the project to analyze
 *   data_model_id        (optional, fallback) - ID of the data model (file-based sources)
 *   date_range           (required) - { start: ISO 8601, end: ISO 8601 }
 *   thresholds           (optional) - { suddenChange, budgetHigh, budgetLow, cpaMultiplier, roasMultiplier }
 *   include_ai_enhancement (optional, default false) - enhance alerts with Gemini
 *   daily_budget         (optional) - expected daily budget for pacing analysis
 *   cpa_target           (optional) - CPA target for threshold analysis
 *   roas_target          (optional) - ROAS target for threshold analysis
 *
 * Response:
 *   {
 *     success: true,
 *     data: {
 *       alerts: [{
 *         id, severity, type, metric, message, suggestedAction,
 *         currentValue, expectedValue, deviationPercent,
 *         campaignContext, channelContext, date, createdAt
 *       }],
 *       summary: {
 *         total, critical, warning, info,
 *         byType: { anomaly, performance, budget }
 *       }
 *     }
 *   }
 */
router.post('/anomalies', MarketingMetricsController.detectAnomalies);

/**
 * POST /marketing-metrics/budget-optimize
 *
 * AI-powered budget allocation optimizer that recommends optimal spend
 * allocation across channels based on ROAS/CPA performance with
 * diminishing returns modeling and optional AI-enhanced explanation.
 *
 * Body:
 *   project_id             (required, primary) - ID of the project to analyze
 *   data_model_id          (optional, fallback) - ID of the data model (file-based sources)
 *   total_budget           (required) - total budget to allocate
 *   date_range             (required) - { start: ISO 8601, end: ISO 8601 }
 *   optimization_goal      (required) - 'maximize_conversions' | 'minimize_cpa' | 'maximize_roas'
 *   include_ai_enhancement (optional, default false) - enhance with Gemini AI explanation
 *
 * Response:
 *   {
 *     success: true,
 *     data: {
 *       optimization_goal, total_budget,
 *       current_allocation: [{ channel, current_spend, current_roas, current_cpa, efficiency_score, ... }],
 *       recommended_allocation: [{ channel, recommended_spend, recommended_conversions, recommended_cpa, recommended_roas, ... }],
 *       estimated_impact: { additional_conversions, cpa_change, roas_change, shift_summary },
 *       reasoning: string,
 *       ai_explanation?: string,
 *       daily_pacing: [{ date, actual_spend, recommended_spend, variance, variance_percent, status }],
 *       constraints_applied: string[]
 *     }
 *   }
 */
router.post('/budget-optimize', MarketingMetricsController.optimizeBudget);

/**
 * POST /marketing-metrics/insights
 *
 * Generates AI-powered marketing insights using Gemini.
 * Aggregates summary data and anomalies, then sends to Gemini for analysis.
 *
 * Body:
 *   projectId   (required, primary) - ID of the project to query
 *   dataModelId (optional, fallback) - ID of the data model (file-based sources)
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