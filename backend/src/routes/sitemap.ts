import express, { Request, Response } from 'express';
import { SitemapProcessor } from '../processors/SitemapProcessor.js';

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
    const entries = await SitemapProcessor.getInstance().getPublishedSitemapEntries();
    
    // Generate plain text sitemap
    const sitemapText = entries.map(entry => entry.url).join('\n');
    
    res.setHeader('Content-Type', 'text/plain');
    res.status(200).send(sitemapText);
});

export default router;
