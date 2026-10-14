import express, { Request, Response } from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { validate } from '../middleware/validator.js';
import { body, matchedData, param } from 'express-validator';
import { ArticleProcessor } from '../processors/ArticleProcessor.js';
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

// Public single-article endpoint (full body) by slug. Registered after /list so
// /list is not captured by the :slug parameter.
router.get('/:slug', validateJWT, async (req: Request, res: Response) => {
    const article = await ArticleProcessor.getInstance().getPublicArticleBySlug(String(req.params.slug));
    if (article) {
        res.status(200).send(article);
    } else {
        res.status(404).send({ message: 'Article not found' });
    }
});

export default router;