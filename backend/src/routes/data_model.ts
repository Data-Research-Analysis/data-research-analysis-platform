import express, { Request, Response } from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { validate } from '../middleware/validator.js';
import { body, param, matchedData } from 'express-validator';
import { DataModelProcessor } from '../processors/DataModelProcessor.js';
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
router.post('/update-data-model-on-query', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([body('data_source_id').notEmpty().trim().escape().toInt(), body('data_model_id').notEmpty().trim().escape().toInt(), body('query').notEmpty().trim(), body('query_json').notEmpty().trim(), body('data_model_name').notEmpty().trim().escape()]),
async (req: Request, res: Response) => {
    const { data_source_id, data_model_id, query, query_json, data_model_name } = matchedData(req);
    const response = await DataModelProcessor.getInstance().updateDataModelOnQuery(data_source_id, data_model_id, query, query_json, data_model_name, req.body.tokenDetails);
    if (response) {
        res.status(200).send({message: 'The data model has been rebuilt.'}); 
    } else {
        res.status(400).send({message: 'The data model could not be rebuilt.'});
    }
});
router.get('/tables/project/:project_id', async (req: Request, res: Response, next: any) => {
    next();
},validateJWT, validate([param('project_id').notEmpty().trim()]), async (req: Request, res: Response) => {
    const { project_id } = matchedData(req);
    console.log('project_id', project_id);
    const data_models_tables_list = await DataModelProcessor.getInstance().getTablesFromDataModels(project_id, req.body.tokenDetails);    
    res.status(200).send(data_models_tables_list);
});
router.post('/execute-query-on-data-model', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([body('query').notEmpty().trim()]),
async (req: Request, res: Response) => {
    const { data_source_id, query } = matchedData(req);
    const response = await DataModelProcessor.getInstance().executeQueryOnDataModel(query, req.body.tokenDetails);
    res.status(200).send(response); 
});
export default router;