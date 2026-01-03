import express, { Request, Response } from 'express';
import { validateJWT } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validator.js';
import { body, matchedData, param } from 'express-validator';
import { SitemapProcessor } from '../../processors/SitemapProcessor.js';
import { EPublishStatus } from '../../types/EPublishStatus.js';

const router = express.Router();

router.get('/list', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, async (req: Request, res: Response) => {
    const entries = await SitemapProcessor.getInstance().getSitemapEntries(req.body.tokenDetails);
    if (entries) {
        res.status(200).send(entries);
    } else {
        res.status(400).send(entries);
    }
});

router.post('/add', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([
    body('url').notEmpty().trim().isURL(),
    body('publish_status').notEmpty().trim().isIn([EPublishStatus.PUBLISHED, EPublishStatus.DRAFT]),
    body('priority').optional().isInt().toInt()
]),
async (req: Request, res: Response) => {
    const { url, publish_status, priority } = matchedData(req);
    const result = await SitemapProcessor.getInstance().addSitemapEntry(
        url,
        publish_status,
        priority || 0,
        req.body.tokenDetails
    );
    if (result) {
        res.status(200).send({message: 'The sitemap entry has been added.'});
    } else {
        res.status(400).send({message: 'The sitemap entry could not be added.'});
    }
});

router.post('/edit', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([
    body('entry_id').notEmpty().trim().toInt(),
    body('url').notEmpty().trim().isURL(),
    body('priority').optional().isInt().toInt()
]),
async (req: Request, res: Response) => {
    const { entry_id, url, priority } = matchedData(req);
    const result = await SitemapProcessor.getInstance().editSitemapEntry(
        entry_id,
        url,
        priority || 0,
        req.body.tokenDetails
    );
    if (result) {
        res.status(200).send({message: 'The sitemap entry has been edited.'});
    } else {
        res.status(400).send({message: 'The sitemap entry could not be edited.'});
    }
});

router.get('/publish/:entry_id', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([param('entry_id').notEmpty().trim().toInt()]),
async (req: Request, res: Response) => {
    const { entry_id } = matchedData(req);
    const result = await SitemapProcessor.getInstance().publishSitemapEntry(entry_id, req.body.tokenDetails);
    if (result) {
        res.status(200).send({message: 'The sitemap entry has been published.'});
    } else {
        res.status(400).send({message: 'The sitemap entry could not be published.'});
    }
});

router.get('/unpublish/:entry_id', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([param('entry_id').notEmpty().trim().toInt()]),
async (req: Request, res: Response) => {
    const { entry_id } = matchedData(req);
    const result = await SitemapProcessor.getInstance().unpublishSitemapEntry(entry_id, req.body.tokenDetails);
    if (result) {
        res.status(200).send({message: 'The sitemap entry has been unpublished.'});
    } else {
        res.status(400).send({message: 'The sitemap entry could not be unpublished.'});
    }
});

router.delete('/delete/:entry_id', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([param('entry_id').notEmpty().trim().toInt()]), 
async (req: Request, res: Response) => {
    const { entry_id } = matchedData(req);
    const response: boolean = await SitemapProcessor.getInstance().deleteSitemapEntry(entry_id, req.body.tokenDetails);
    if (response) {
        res.status(200).send({message: 'The sitemap entry has been deleted.'});
    } else {
        res.status(400).send({message: 'The sitemap entry could not be deleted.'});
    }
});

router.post('/reorder', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([
    body('entry_ids').isArray().notEmpty()
]),
async (req: Request, res: Response) => {
    const { entry_ids } = matchedData(req);
    const result = await SitemapProcessor.getInstance().reorderSitemapEntries(entry_ids, req.body.tokenDetails);
    if (result) {
        res.status(200).send({message: 'The sitemap entries have been reordered.'});
    } else {
        res.status(400).send({message: 'The sitemap entries could not be reordered.'});
    }
});

export default router;
