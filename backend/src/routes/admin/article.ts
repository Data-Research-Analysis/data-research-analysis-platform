import express, { Request, Response } from 'express';
import { validateJWT } from '../../middleware/authenticate';
import { validate } from '../../middleware/validator';
import { body, matchedData, param } from 'express-validator';
import { ArticleProcessor } from '../../processors/ArticleProcessor';
const router = express.Router();

router.get('/list', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, async (req: Request, res: Response) => {
    const articles = await ArticleProcessor.getInstance().getArticles(req.body.tokenDetails);
    if (articles) {
        res.status(200).send(articles);
    } else {
        res.status(400).send(articles);
    }
});

router.post('/add', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([body('title').notEmpty().trim().escape(), body('content').notEmpty(), body('publish_status').notEmpty().trim(), body('categories').notEmpty().isArray()]),
async (req: Request, res: Response) => {
    const { title, content, publish_status, categories } = matchedData(req);
    const result = await ArticleProcessor.getInstance().addArticle(title, content, publish_status, categories, req.body.tokenDetails);
    if (result) {
        res.status(200).send({message: 'The article has been added.'});
    } else {
        res.status(400).send({message: 'The article could not be added.'});
    }
});

router.get('/publish/:article_id', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([param('article_id').notEmpty().trim().toInt()]),
async (req: Request, res: Response) => {
    const { article_id } = matchedData(req);
    const result = await ArticleProcessor.getInstance().publishArticle(article_id, req.body.tokenDetails);
    if (result) {
        res.status(200).send({message: 'The article has been published.'});
    } else {
        res.status(400).send({message: 'The article could not be published.'});
    }
});

export default router;