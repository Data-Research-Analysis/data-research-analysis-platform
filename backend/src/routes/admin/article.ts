import express, { Request, Response } from 'express';
import { validateJWT } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validator.js';
import { body, matchedData, param } from 'express-validator';
import { ArticleProcessor } from '../../processors/ArticleProcessor.js';
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
}, validateJWT, validate([body('title').notEmpty().trim(), body('content').notEmpty(), body('content_markdown').optional(), body('publish_status').notEmpty().trim(), body('categories').notEmpty().isArray()]),
async (req: Request, res: Response) => {
    const { title, content, content_markdown, publish_status, categories } = matchedData(req);
    const result = await ArticleProcessor.getInstance().addArticle(title, content, content_markdown, publish_status, categories, req.body.tokenDetails);
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

router.delete('/delete/:article_id', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([param('article_id').notEmpty().trim().toInt()]), async (req: Request, res: Response) => {
    const { article_id } = matchedData(req);
    //delete the article
    const response: boolean = await ArticleProcessor.getInstance().deleteArticle(article_id, req.body.tokenDetails);
    if (response) {
        res.status(200).send({message: 'The article has been deleted.'});
    } else {
        res.status(400).send({message: 'The article could not be deleted.'});
    }
});

router.post('/edit', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([body('article_id').notEmpty().trim().toInt(), body('title').notEmpty().trim(), body('content').notEmpty(), body('content_markdown').optional(), body('categories').notEmpty().isArray()]),
async (req: Request, res: Response) => {
    const { article_id, title, content, content_markdown, categories } = matchedData(req);
    const result = await ArticleProcessor.getInstance().editArticle(article_id, title, content, content_markdown, categories, req.body.tokenDetails);
    if (result) {
        res.status(200).send({message: 'The article has been edited.'});
    } else {
        res.status(400).send({message: 'The article could not be edited.'});
    }
});

export default router;