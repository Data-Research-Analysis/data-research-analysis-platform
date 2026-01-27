import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * Rate Limiting Middleware
 * Protects API endpoints from abuse, DDoS attacks, and excessive usage
 */

/**
 * Extract real client IP address from request
 * Handles proxies by checking multiple proxy headers in priority order
 * @param req Express request object
 * @returns Client IP address
 */
function getClientIp(req: Request): string {
    // Priority 1: X-Real-IP header (set by nginx and other reverse proxies)
    // This is the most reliable single-IP header
    const realIp = req.headers['x-real-ip'];
    if (realIp && typeof realIp === 'string') {
        return realIp.trim();
    }
    
    // Priority 2: CF-Connecting-IP (Cloudflare)
    const cfIp = req.headers['cf-connecting-ip'];
    if (cfIp && typeof cfIp === 'string') {
        return cfIp.trim();
    }
    
    // Priority 3: X-Forwarded-For header (standard for proxy chains)
    // Format: "client, proxy1, proxy2" - the first IP is the original client
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
        const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
        const firstIp = ips.split(',')[0].trim();
        if (firstIp) {
            return firstIp;
        }
    }
    
    // Priority 4: Fastly-Client-IP (Fastly CDN)
    const fastlyIp = req.headers['fastly-client-ip'];
    if (fastlyIp && typeof fastlyIp === 'string') {
        return fastlyIp.trim();
    }
    
    // Priority 5: True-Client-IP (Akamai and Cloudflare)
    const trueClientIp = req.headers['true-client-ip'];
    if (trueClientIp && typeof trueClientIp === 'string') {
        return trueClientIp.trim();
    }
    
    // Priority 6: X-Client-IP (rare but used by some proxies)
    const clientIp = req.headers['x-client-ip'];
    if (clientIp && typeof clientIp === 'string') {
        return clientIp.trim();
    }
    
    // Fallback: req.ip (works when trust proxy is enabled in Express)
    // This should now work correctly since we have 'trust proxy' enabled
    if (req.ip) {
        // Remove IPv6 prefix if present (::ffff:192.168.1.1 -> 192.168.1.1)
        return req.ip.replace(/^::ffff:/, '');
    }
    
    // Last resort fallback
    return 'unknown';
}

// Extend Express Request type to include rateLimit property
declare module 'express-serve-static-core' {
    interface Request {
        rateLimit?: {
            limit: number;
            current: number;
            remaining: number;
            resetTime?: Date;
        };
    }
}

/**
 * Authentication rate limiter (strict)
 * Protects login, register, and password reset endpoints from brute force attacks
 * 
 * Limits: 5 requests per 15 minutes per IP
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: 'Too many authentication attempts, please try again after 15 minutes',
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    skipSuccessfulRequests: false, // Count all requests
    keyGenerator: (req: Request) => {
        // Use real client IP (handles proxy via X-Forwarded-For)
        return getClientIp(req);
    },
    handler: (req: Request, res: Response) => {
        const clientIp = getClientIp(req);
        console.warn(`[Rate Limit] Auth attempt from IP: ${clientIp}, Path: ${req.path}`);
        res.status(429).json({
            error: 'Too many requests',
            message: 'Too many authentication attempts from this IP, please try again after 15 minutes',
            retryAfter: Math.ceil((req.rateLimit?.resetTime?.getTime() - Date.now()) / 1000)
        });
    },
    skip: (req: Request) => {
        // Skip rate limiting in development if needed
        return process.env.RATE_LIMIT_ENABLED === 'false';
    }
});

/**
 * Expensive operations rate limiter
 * Protects resource-intensive operations like file uploads, sync operations, AI processing
 * 
 * Limits: 10 requests per minute per user/IP
 */
export const expensiveOperationsLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    message: 'Too many requests, please slow down',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
        // Use user ID if authenticated, otherwise use IP
        const userId = req.body?.tokenDetails?.user_id;
        if (userId) {
            return userId.toString();
        }
        // Use real client IP (handles proxy via X-Forwarded-For)
        return getClientIp(req);
    },
    handler: (req: Request, res: Response) => {
        const userId = req.body?.tokenDetails?.user_id;
        const clientIp = getClientIp(req);
        console.warn(`[Rate Limit] Expensive operation from ${userId ? `User ${userId}` : `IP ${clientIp}`}, Path: ${req.path}`);
        res.status(429).json({
            error: 'Too many requests',
            message: 'You are making requests too quickly. Please wait a moment and try again.',
            retryAfter: Math.ceil((req.rateLimit?.resetTime?.getTime() - Date.now()) / 1000)
        });
    },
    skip: (req: Request) => {
        return process.env.RATE_LIMIT_ENABLED === 'false';
    }
});

/**
 * General API rate limiter
 * Protects general API endpoints with moderate limits
 * 
 * Limits: 100 requests per minute per user/IP
 */
export const generalApiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    message: 'Too many API requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
        // Use user ID if authenticated, otherwise use IP
        const userId = req.body?.tokenDetails?.user_id;
        if (userId) {
            return userId.toString();
        }
        // Use real client IP (handles proxy via X-Forwarded-For)
        return getClientIp(req);
    },
    handler: (req: Request, res: Response) => {
        const userId = req.body?.tokenDetails?.user_id;
        const clientIp = getClientIp(req);
        console.warn(`[Rate Limit] General API limit exceeded from ${userId ? `User ${userId}` : `IP ${clientIp}`}`);
        res.status(429).json({
            error: 'Too many requests',
            message: 'Rate limit exceeded. Please try again in a minute.',
            retryAfter: Math.ceil((req.rateLimit?.resetTime?.getTime() - Date.now()) / 1000)
        });
    },
    skip: (req: Request) => {
        return process.env.RATE_LIMIT_ENABLED === 'false';
    }
});

/**
 * OAuth callback rate limiter
 * Protects OAuth callback endpoints from abuse
 * 
 * Limits: 10 requests per 5 minutes per IP
 */
export const oauthCallbackLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10,
    message: 'Too many OAuth attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Only count failed requests
    keyGenerator: (req: Request) => {
        // Use real client IP (handles proxy via X-Forwarded-For)
        return getClientIp(req);
    },
    handler: (req: Request, res: Response) => {
        const clientIp = getClientIp(req);
        console.warn(`[Rate Limit] OAuth callback abuse from IP: ${clientIp}`);
        res.status(429).json({
            error: 'Too many requests',
            message: 'Too many OAuth attempts. Please try again in a few minutes.',
            retryAfter: Math.ceil((req.rateLimit?.resetTime?.getTime() - Date.now()) / 1000)
        });
    },
    skip: (req: Request) => {
        return process.env.RATE_LIMIT_ENABLED === 'false';
    }
});

/**
 * Strict rate limiter for AI operations
 * AI operations are computationally expensive and should be heavily rate limited
 * 
 * Limits: 5 requests per minute per user
 */
export const aiOperationsLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5,
    message: 'Too many AI requests, please wait before trying again',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
        const userId = req.body?.tokenDetails?.user_id;
        if (userId) {
            return userId.toString();
        }
        // Use real client IP (handles proxy via X-Forwarded-For)
        return getClientIp(req);
    },
    handler: (req: Request, res: Response) => {
        const userId = req.body?.tokenDetails?.user_id;
        const clientIp = getClientIp(req);
        console.warn(`[Rate Limit] AI operations limit exceeded from ${userId ? `User ${userId}` : `IP ${clientIp}`}, Path: ${req.path}`);
        res.status(429).json({
            error: 'Too many requests',
            message: 'You are making too many AI requests. Please wait a moment before trying again.',
            retryAfter: Math.ceil((req.rateLimit?.resetTime?.getTime() - Date.now()) / 1000)
        });
    },
    skip: (req: Request) => {
        return process.env.RATE_LIMIT_ENABLED === 'false';
    }
});
/**
 * Invitation rate limiter
 * Protects project invitation endpoints from spam
 * 
 * Limits: 10 requests per 15 minutes per user
 */
export const invitationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: 'Too many invitation requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
        const userId = req.body?.tokenDetails?.user_id;
        if (userId) {
            return userId.toString();
        }
        // Use real client IP (handles proxy via X-Forwarded-For)
        return getClientIp(req);
    },
    handler: (req: Request, res: Response) => {
        const userId = req.body?.tokenDetails?.user_id;
        const clientIp = getClientIp(req);
        console.warn(`[Rate Limit] Invitation limit exceeded from ${userId ? `User ${userId}` : `IP ${clientIp}`}`);
        res.status(429).json({
            error: 'Too many requests',
            message: 'Too many invitation requests. Please try again in 15 minutes.',
            retryAfter: Math.ceil((req.rateLimit?.resetTime?.getTime() - Date.now()) / 1000)
        });
    },
    skip: (req: Request) => {
        return process.env.RATE_LIMIT_ENABLED === 'false';
    }
});