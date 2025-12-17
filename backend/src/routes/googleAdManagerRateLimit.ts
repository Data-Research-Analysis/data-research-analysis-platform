import express from 'express';
import { GoogleAdManagerService } from '../services/GoogleAdManagerService.js';
import { RateLimiterRegistry } from '../utils/RateLimiter.js';

const router = express.Router();

/**
 * Get rate limit status for Google Ad Manager API
 * GET /api/google-ad-manager/rate-limit
 */
router.get('/rate-limit', async (req, res) => {
    try {
        const gamService = GoogleAdManagerService.getInstance();
        const status = gamService.getRateLimitStatus();
        const stats = gamService.getRateLimitStats();
        
        res.json({
            success: true,
            data: {
                status,
                stats,
            },
        });
    } catch (error: any) {
        console.error('Failed to get rate limit status:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to retrieve rate limit status',
        });
    }
});

/**
 * Get rate limit status for all services
 * GET /api/google-ad-manager/rate-limits/all
 */
router.get('/rate-limits/all', async (req, res) => {
    try {
        const registry = RateLimiterRegistry.getInstance();
        const statuses = registry.getAllStatuses();
        const serviceIds = registry.getServiceIds();
        
        res.json({
            success: true,
            data: {
                services: serviceIds,
                statuses,
            },
        });
    } catch (error: any) {
        console.error('Failed to get all rate limit statuses:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to retrieve rate limit statuses',
        });
    }
});

export default router;
