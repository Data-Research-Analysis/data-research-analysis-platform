import express, { Request, Response } from 'express';
import { validateJWT } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validator.js';
import { body, matchedData, param } from 'express-validator';
import { AuthorProcessor, IAuthorInput } from '../../processors/AuthorProcessor.js';

const router = express.Router();

function buildAuthorInput(data: any): IAuthorInput {
    return {
        name: data.name,
        slug: data.slug ?? undefined,
        picture: data.picture ?? null,
        linkedin_url: data.linkedin_url ?? null,
        website_url: data.website_url ?? null,
        bio: data.bio ?? null,
    };
}

router.get('/list', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, async (req: Request, res: Response) => {
    const authors = await AuthorProcessor.getInstance().getAuthors();
    res.status(200).send(authors);
});

router.post('/add', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([
    body('name').notEmpty().trim(),
    body('slug').optional({ nullable: true, checkFalsy: true }).trim().toLowerCase().matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    body('picture').optional({ nullable: true }).trim(),
    body('linkedin_url').optional({ nullable: true, checkFalsy: true }).trim().isURL(),
    body('website_url').optional({ nullable: true, checkFalsy: true }).trim().isURL(),
    body('bio').optional({ nullable: true }).trim().isLength({ max: 512 }),
]), async (req: Request, res: Response) => {
    const data = matchedData(req);
    const author = await AuthorProcessor.getInstance().addAuthor(buildAuthorInput(data));
    if (author) {
        res.status(200).send({ message: 'The author has been added.', author });
    } else {
        res.status(400).send({ message: 'The author could not be added.' });
    }
});

router.post('/edit', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([
    body('author_id').notEmpty().trim().toInt(),
    body('name').notEmpty().trim(),
    body('slug').optional({ nullable: true, checkFalsy: true }).trim().toLowerCase().matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    body('picture').optional({ nullable: true }).trim(),
    body('linkedin_url').optional({ nullable: true, checkFalsy: true }).trim().isURL(),
    body('website_url').optional({ nullable: true, checkFalsy: true }).trim().isURL(),
    body('bio').optional({ nullable: true }).trim().isLength({ max: 512 }),
]), async (req: Request, res: Response) => {
    const data = matchedData(req);
    const result = await AuthorProcessor.getInstance().editAuthor(data.author_id, buildAuthorInput(data));
    if (result) {
        res.status(200).send({ message: 'The author has been updated.' });
    } else {
        res.status(400).send({ message: 'The author could not be updated.' });
    }
});

router.delete('/delete/:author_id', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([param('author_id').notEmpty().trim().toInt()]), async (req: Request, res: Response) => {
    const { author_id } = matchedData(req);
    const result = await AuthorProcessor.getInstance().deleteAuthor(author_id);
    if (result) {
        res.status(200).send({ message: 'The author has been deleted.' });
    } else {
        res.status(400).send({ message: 'The author could not be deleted.' });
    }
});

router.get('/:author_id', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([param('author_id').notEmpty().trim().toInt()]), async (req: Request, res: Response) => {
    const { author_id } = matchedData(req);
    const author = await AuthorProcessor.getInstance().getAuthor(author_id);
    if (author) {
        res.status(200).send(author);
    } else {
        res.status(404).send({ message: 'Author not found.' });
    }
});

export default router;
