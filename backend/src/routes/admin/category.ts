import express, { Request, Response } from 'express';
import { validateJWT } from '../../middleware/authenticate';
import { validate } from '../../middleware/validator';
import { body, matchedData, param } from 'express-validator';
import { CategoryProcessor } from '../../processors/CategoryProcessor';
const router = express.Router();

router.get('/list', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, async (req: Request, res: Response) => {
    const categories = await CategoryProcessor.getInstance().getCategories(req.body.tokenDetails);
    if (categories) {
        res.status(200).send(categories);
    } else {
        res.status(400).send(categories);
    }
});

router.post('/add', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([body('title').notEmpty().trim().escape()]),
async (req: Request, res: Response) => {
    const { title } = matchedData(req);
    const result = await CategoryProcessor.getInstance().addCategory(title, req.body.tokenDetails);
    if (result) {
        res.status(200).send({message: 'The category has been added.'});
    } else {
        res.status(400).send({message: 'The category could not be added.'});
    }
});

router.delete('/delete/:category_id', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([param('category_id').notEmpty().trim().toInt()]), async (req: Request, res: Response) => {
    const { category_id } = matchedData(req);
    //delete the category
    const response: boolean = await CategoryProcessor.getInstance().deleteCategory(category_id, req.body.tokenDetails);
    if (response) {
        res.status(200).send({message: 'The category has been deleted.'});
    } else {
        res.status(400).send({message: 'The category could not be deleted.'});
    }
});

export default router;