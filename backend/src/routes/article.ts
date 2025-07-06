import express, { Request, Response } from 'express';
import { validateJWT } from '../middleware/authenticate';
import { validate } from '../middleware/validator';
import { body, matchedData, param } from 'express-validator';
import { ArticleProcessor } from '../processors/ArticleProcessor';
const router = express.Router();

router.get('/list', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, async (req: Request, res: Response) => {
    const articles = await ArticleProcessor.getInstance().getPublicArticles();
    if (articles) {
        res.status(200).send(articles);
    } else {
        res.status(400).send(articles);
    }
});

export default router;