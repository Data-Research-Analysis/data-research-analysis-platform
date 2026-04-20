import { Router } from 'express';
import { GeolocationService, ConsentRegion } from '../services/GeolocationService.js';
import { generalApiLimiter } from '../middleware/rateLimit.js';

const router = Router();
const geoService = GeolocationService.getInstance();

/**
 * GET /geolocation/consent-region
 * Returns the appropriate consent strategy for the user's location
 */
router.get('/consent-region', generalApiLimiter, async (req, res) => {
    try {
        const clientIP = geoService.getClientIP(req);
        const region = geoService.getConsentRegion(clientIP);

        res.json({
            success: true,
            region,
            ip: process.env.NODE_ENV === 'development' ? clientIP : undefined // Only in dev
        });
    } catch (error: any) {
        console.error('Geolocation error:', error);
        // Safe fallback: treat as EU (strictest privacy)
        res.json({
            success: true,
            region: ConsentRegion.EU_EEA_UK
        });
    }
});

export default router;
