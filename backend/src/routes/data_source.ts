import express, { Request, Response } from 'express';
import { validateJWT } from '../middleware/authenticate';
import { validate } from '../middleware/validator';
import { body, param, matchedData } from 'express-validator';
import { DataSourceProcessor } from '../processors/DataSourceProcessor';
import { IDBConnectionDetails } from '../types/IDBConnectionDetails';
const router = express.Router();


router.get('/list', async (req: Request, res: Response, next: any) => {
    next();
},validateJWT, async (req: Request, res: Response) => {
    const data_sources_list = await DataSourceProcessor.getInstance().getDataSources(req.body.tokenDetails);    
    res.status(200).send(data_sources_list);
});

router.post('/test-connection', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([body('host').notEmpty().trim().escape(), body('port').notEmpty().trim().escape(),
    body('schema').notEmpty().trim().escape(), body('database_name').notEmpty().trim().escape(), body('username').notEmpty().trim().escape(),
    body('password').notEmpty().trim().escape(),
]),
async (req: Request, res: Response) => {
    const { host, port, schema, database_name, username, password, } = matchedData(req);
    const connection: IDBConnectionDetails = {
        host: host,
        port: port,
        schema: schema,
        database: database_name,
        user: username,
        password: password,
    };
    const response = await DataSourceProcessor.getInstance().connectToDataSource(connection);
    if (response) {
        res.status(200).send({message: 'The data source has been connected.'});        
    } else {
        res.status(400).send({message: 'The data source could not be connected.'});
    }
});

router.post('/add-data-source', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([body('host').notEmpty().trim().escape(), body('port').notEmpty().trim().escape(),
    body('schema').notEmpty().trim().escape(), body('database_name').notEmpty().trim().escape(), body('username').notEmpty().trim().escape(),
    body('password').notEmpty().trim().escape(), body('project_id').notEmpty().trim().escape(),
]),
async (req: Request, res: Response) => {
    const { host, port, schema, database_name, username, password, project_id } = matchedData(req);
    const connection: IDBConnectionDetails = {
        host: host,
        port: port,
        schema: schema,
        database: database_name,
        user: username,
        password: password,
    };
    const response = await DataSourceProcessor.getInstance().connectToDataSource(connection);
    if (response) {
        await DataSourceProcessor.getInstance().addDataSource(connection,  req.body.tokenDetails, project_id);            
        res.status(200).send({message: 'The data source has been connected.'});        
    } else {
        res.status(400).send({message: 'The data source could not be connected.'});
    }
});

router.delete('/delete/:data_source_id', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([param('data_source_id').notEmpty().trim().escape().toInt()]),
async (req: Request, res: Response) => {
    const { data_source_id } = matchedData(req);
    const result = await DataSourceProcessor.getInstance().deleteDataSource(data_source_id,  req.body.tokenDetails);            
    if (result) {
        res.status(200).send({message: 'The data source has been deleted.'});        
    } else {
        res.status(400).send({message: 'The data source could not be deleted.'});
    }
});

router.get('/tables/:data_source_id', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([param('data_source_id').notEmpty().trim().escape().toInt()]),
async (req: Request, res: Response) => {
    const { data_source_id } = matchedData(req);
    const tables = await DataSourceProcessor.getInstance().getTablesFromDataSource(data_source_id, req.body.tokenDetails);
    if (tables) {
        res.status(200).send(tables);
    } else {
        res.status(400).send({message: 'Tables could not be accessed for the data source.'});
    }
});

router.post('/execute-query-on-external-data-source', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([body('data_source_id').notEmpty().trim().escape().toInt(), body('query').notEmpty().trim()]),
async (req: Request, res: Response) => {
    const { data_source_id, query } = matchedData(req);
    const response = await DataSourceProcessor.getInstance().executeQueryOnExternalDataSource(data_source_id, query, req.body.tokenDetails);
    res.status(200).send(response); 
});

router.post('/build-data-model-on-query', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([body('data_source_id').notEmpty().trim().escape().toInt(), body('query').notEmpty().trim(), body('data_model_name').notEmpty().trim().escape()]),
async (req: Request, res: Response) => {
    const { data_source_id, query, data_model_name } = matchedData(req);
    const response = await DataSourceProcessor.getInstance().buildDataModelOnQuery(data_source_id, query, data_model_name, req.body.tokenDetails);
    if (response) {
        res.status(200).send({message: 'The data model has been built.'}); 
    } else {
        res.status(400).send({message: 'The data model could not be built.'});
    }
});

export default router;