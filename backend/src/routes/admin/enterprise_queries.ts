import express, { Request, Response } from 'express';
import { validateJWT } from '../../middleware/authenticate.js';
import { EnterpriseQueryProcessor } from '../../processors/EnterpriseQueryProcessor.js';
const router = express.Router();

router.get('/list', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, async (req: Request, res: Response) => {
    const queries = await EnterpriseQueryProcessor.getInstance().getEnterpriseQueries(req.body.tokenDetails);
    if (queries) {
        res.status(200).send(queries);
    } else {
        res.status(400).send(queries);
    }
});

export default router;
