import express, { Request, Response } from 'express';
import { validateJWT } from '../../middleware/authenticate.js';
import { EUserType } from '../../types/EUserType.js';
import { validate } from '../../middleware/validator.js';
import { body, matchedData } from 'express-validator';
import { EmailFunnelProcessor } from '../../processors/EmailFunnelProcessor.js';

const router = express.Router();
const processor = EmailFunnelProcessor.getInstance();

async function requireAdmin(req: any, res: any, next: any) {
    const tokenDetails = req.tokenDetails || req.body.tokenDetails;
    if (!tokenDetails || tokenDetails.user_type !== EUserType.ADMIN) {
        return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    next();
}

router.get(
    '/articles',
    validateJWT,
    requireAdmin,
    async (_req: Request, res: Response) => {
        try {
            const articles = await processor.getBlogDigestArticles();
            const data = articles.map(a => ({
                id: a.id,
                title: a.title,
                slug: a.slug,
                created_at: a.created_at,
            }));
            res.status(200).json({ success: true, data });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

router.get(
    '/history',
    validateJWT,
    requireAdmin,
    async (_req: Request, res: Response) => {
        try {
            const digests = await processor.getBlogDigestHistory();
            res.status(200).json({ success: true, data: digests });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

router.post(
    '/send',
    validateJWT,
    requireAdmin,
    validate([
        body('article_ids').isArray({ min: 1 }),
        body('article_ids.*').isInt(),
    ]),
    async (req: Request, res: Response) => {
        try {
            const { article_ids } = matchedData(req);
            const result = await processor.sendBlogDigest(article_ids);
            res.status(200).json({ success: true, data: result });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

export default router;
