import express, { Request, Response } from 'express';
import { validateJWT } from '../middleware/authenticate';
import { validate } from '../middleware/validator';
import { body, param, matchedData } from 'express-validator';
import { DataModelProcessor } from '../processors/DataModelProcessor';
const router = express.Router();

router.get('/list', async (req: Request, res: Response, next: any) => {
    next();
},validateJWT, async (req: Request, res: Response) => {
    const data_sources_list = await DataModelProcessor.getInstance().getDataModels(req.body.tokenDetails);    
    res.status(200).send(data_sources_list);
});
router.delete('/delete/:data_model_id', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([param('data_model_id').notEmpty().trim().escape().toInt()]),
async (req: Request, res: Response) => {
    const { data_model_id } = matchedData(req);
    const result = await DataModelProcessor.getInstance().deleteDataModel(data_model_id,  req.body.tokenDetails);            
    if (result) {
        res.status(200).send({message: 'The data model has been deleted.'});        
    } else {
        res.status(400).send({message: 'The data model could not be deleted.'});
    }
});
export default router;