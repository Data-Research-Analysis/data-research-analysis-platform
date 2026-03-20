import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

/**
 * ETag Middleware - Implements conditional requests with ETags
 * 
 * This middleware:
 * 1. Generates MD5 hash (ETag) of response data
 * 2. Sets ETag and Cache-Control headers
 * 3. Checks client's If-None-Match header
 * 4. Returns 304 Not Modified if ETag matches (saves bandwidth)
 * 
 * Benefits:
 * - Reduces bandwidth by avoiding re-sending unchanged data
 * - Improves response times (304 responses are very fast)
 * - Works transparently with existing endpoints
 * 
 * Usage:
 * ```typescript
 * router.get('/data-model/list/:project_id', 
 *     etagMiddleware,
 *     validateJWT,
 *     async (req, res) => { ... }
 * );
 * ```
 */
export function etagMiddleware(req: Request, res: Response, next: NextFunction): void {
    // Only apply to GET requests
    if (req.method !== 'GET') {
        next();
        return;
    }
    
    // Store original json method
    const originalJson = res.json.bind(res);
    
    // Override json method to add ETag support
    res.json = function(data: any): Response {
        // Generate ETag from response data
        const dataString = JSON.stringify(data);
        const etag = crypto
            .createHash('md5')
            .update(dataString)
            .digest('hex');
        
        // Set ETag header
        res.setHeader('ETag', `"${etag}"`);
        
        // Set Cache-Control header (private = not cacheable by CDN/proxies, no-cache = must revalidate)
        res.setHeader('Cache-Control', 'private, no-cache, must-revalidate');
        
        // Check if client has current version
        const clientETag = req.headers['if-none-match'];
        
        if (clientETag === `"${etag}"`) {
            // Client has current version - return 304 Not Modified
            console.log(`[ETag] 304 Not Modified for ${req.path} (ETag: ${etag})`);
            res.status(304).end();
            return res;
        }
        
        // Client doesn't have current version - send full response
        console.log(`[ETag] Sending full response for ${req.path} (ETag: ${etag})`);
        return originalJson(data);
    };
    
    next();
}

/**
 * Creates a weak ETag (for data that changes frequently but content is equivalent)
 * Weak ETags use W/ prefix and are useful for dynamic content
 */
export function weakEtagMiddleware(req: Request, res: Response, next: NextFunction): void {
    if (req.method !== 'GET') {
        next();
        return;
    }
    
    const originalJson = res.json.bind(res);
    
    res.json = function(data: any): Response {
        const dataString = JSON.stringify(data);
        const etag = crypto
            .createHash('md5')
            .update(dataString)
            .digest('hex');
        
        // Weak ETag (W/ prefix)
        res.setHeader('ETag', `W/"${etag}"`);
        res.setHeader('Cache-Control', 'private, no-cache, must-revalidate');
        
        const clientETag = req.headers['if-none-match'];
        
        // Check both strong and weak ETags
        if (clientETag === `W/"${etag}"` || clientETag === `"${etag}"`) {
            console.log(`[Weak ETag] 304 Not Modified for ${req.path}`);
            res.status(304).end();
            return res;
        }
        
        return originalJson(data);
    };
    
    next();
}

/**
 * Conditional response middleware with more control
 * Allows custom ETag generation and additional headers
 */
export interface ETagOptions {
    /**
     * Custom ETag generator function
     */
    generateETag?: (data: any) => string;
    
    /**
     * Whether to use weak ETags (W/)
     */
    weak?: boolean;
    
    /**
     * Additional cache control directives
     */
    cacheControl?: string;
    
    /**
     * Maximum age in seconds (for s-maxage directive)
     */
    maxAge?: number;
}

export function conditionalResponseMiddleware(options: ETagOptions = {}) {
    const {
        generateETag = (data: any) => {
            return crypto
                .createHash('md5')
                .update(JSON.stringify(data))
                .digest('hex');
        },
        weak = false,
        cacheControl = 'private, no-cache, must-revalidate',
        maxAge
    } = options;
    
    return (req: Request, res: Response, next: NextFunction): void => {
        if (req.method !== 'GET') {
            next();
            return;
        }
        
        const originalJson = res.json.bind(res);
        
        res.json = function(data: any): Response {
            const etag = generateETag(data);
            const etagHeader = weak ? `W/"${etag}"` : `"${etag}"`;
            
            res.setHeader('ETag', etagHeader);
            
            // Build cache control with optional max-age
            let cacheControlHeader = cacheControl;
            if (maxAge !== undefined) {
                cacheControlHeader += `, max-age=${maxAge}`;
            }
            res.setHeader('Cache-Control', cacheControlHeader);
            
            const clientETag = req.headers['if-none-match'];
            
            if (clientETag === etagHeader) {
                console.log(`[Conditional] 304 Not Modified for ${req.path}`);
                res.status(304).end();
                return res;
            }
            
            return originalJson(data);
        };
        
        next();
    };
}
