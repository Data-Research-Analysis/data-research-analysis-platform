import express, { Request, Response } from 'express';
import { SitemapProcessor } from '../processors/SitemapProcessor.js';

const router = express.Router();
const processor = SitemapProcessor.getInstance();

// XML sitemap endpoint
router.get('/', async (req: Request, res: Response) => {
    try {
        const sitemap = await processor.generateXmlSitemap();
        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.status(200).send(sitemap);
    } catch (error) {
        console.error('Error generating XML sitemap:', error);
        res.status(500).send('<?xml version="1.0" encoding="UTF-8"?>\n<error>Sitemap generation failed</error>');
    }
});

export default router;
