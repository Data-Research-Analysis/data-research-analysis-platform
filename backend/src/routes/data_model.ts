import express, { Request, Response } from 'express';
import { validateJWT } from '../middleware/authenticate';
import { DataModelProcessor } from '../processors/DataModelProcessor';
const router = express.Router();

router.get('/list', async (req: Request, res: Response, next: any) => {
    next();
},validateJWT, async (req: Request, res: Response) => {
    const data_sources_list = await DataModelProcessor.getInstance().getDataModels(req.body.tokenDetails);    
    res.status(200).send(data_sources_list);
});

export default router;