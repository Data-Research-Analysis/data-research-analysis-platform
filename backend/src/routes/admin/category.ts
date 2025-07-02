import express, { Request, Response } from 'express';
import { validateJWT } from '../../middleware/authenticate';
import { validate } from '../../middleware/validator';
import { body, matchedData } from 'express-validator';
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

export default router;