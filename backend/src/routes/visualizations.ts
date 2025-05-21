import express, { Request, Response } from 'express';
import { validateJWT } from '../middleware/authenticate';
import { validate } from '../middleware/validator';
import { body, param, matchedData } from 'express-validator';
import { DataModelProcessor } from '../processors/DataModelProcessor';
import { VisualizationsProcessor } from '../processors/VisualizationsProcessor';
const router = express.Router();

router.get('/list', async (req: Request, res: Response, next: any) => {
    next();
},validateJWT, async (req: Request, res: Response) => {
    const data_sources_list = await VisualizationsProcessor.getInstance().getVisualizations(req.body.tokenDetails);    
    res.status(200).send(data_sources_list);
});
router.delete('/delete/:visualization_id', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([param('visualization_id').notEmpty().trim().escape().toInt()]),
async (req: Request, res: Response) => {
    const { visualization_id } = matchedData(req);
    const result = await DataModelProcessor.getInstance().deleteDataModel(visualization_id,  req.body.tokenDetails);            
    if (result) {
        res.status(200).send({message: 'The data model has been deleted.'});        
    } else {
        res.status(400).send({message: 'The data model could not be deleted.'});
    }
});

export default router;