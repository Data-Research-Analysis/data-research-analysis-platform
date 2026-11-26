import express, { Request, Response } from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { AuthorProcessor } from '../processors/AuthorProcessor.js';
import { ArticleProcessor } from '../processors/ArticleProcessor.js';

const router = express.Router();

// Public author profile (with their published articles) by slug.
router.get('/:slug', validateJWT, async (req: Request, res: Response) => {
    const author = await AuthorProcessor.getInstance().getAuthorBySlug(String(req.params.slug));
    if (!author) {
        return res.status(404).send({ message: 'Author not found' });
    }
    const articles = await ArticleProcessor.getInstance().getPublicArticlesByAuthor(author.id);
    res.status(200).send({ author, articles });
});

export default router;
