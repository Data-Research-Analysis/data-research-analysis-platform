import express, { Express, Request, Response } from 'express';
import { UtilityService } from '../services/UtilityService';
import { TokenProcessor } from '../processors/TokenProcessor';
import { validateJWT } from '../middleware/authenticate';
import { validate } from '../middleware/validator';
import { body, param, matchedData } from 'express-validator';
import { DataSourceProcessor } from '../processors/DataSourceProcessor';
import { IDBConnectionDetails } from '../types/IDBConnectionDetails';
import { DBDriver } from '../drivers/DBDriver';
import { DataSources } from '../models/DataSources';
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
    body('password').notEmpty().trim().escape(), body('ssl').notEmpty().trim().escape(),
    body('ssl_mode').notEmpty().trim().escape()
]),
async (req: Request, res: Response) => {
    const { host, port, schema, database_name, username, password, ssl, ssl_mode } = matchedData(req);
    const connection: IDBConnectionDetails = {
        host: host,
        port: port,
        schema: schema,
        database: database_name,
        user: username,
        password: password,
        ssl: ssl,
        ssl_mode: ssl_mode,
    };
    const response = await DataSourceProcessor.getInstance().connectToDataSource(connection);
    if (response) {
        res.status(200).send({message: 'The data source has been connected.'});        
    } else {
        res.status(400).send({message: 'The data source could not be connected.'});
    }
});

router.post('/save-connection', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([body('host').notEmpty().trim().escape(), body('port').notEmpty().trim().escape(),
    body('schema').notEmpty().trim().escape(), body('database_name').notEmpty().trim().escape(), body('username').notEmpty().trim().escape(),
    body('password').notEmpty().trim().escape(), body('ssl').notEmpty().trim().escape(),
    body('ssl_mode').notEmpty().trim().escape(), body('project_id').notEmpty().trim().escape(),
]),
async (req: Request, res: Response) => {
    const { host, port, schema, database_name, username, password, ssl, ssl_mode, project_id } = matchedData(req);
    const connection: IDBConnectionDetails = {
        host: host,
        port: port,
        schema: schema,
        database: database_name,
        user: username,
        password: password,
        ssl: ssl,
        ssl_mode: ssl_mode,
    };
    const response = await DataSourceProcessor.getInstance().connectToDataSource(connection);
    if (response) {
        console.log('req.body', req.body);
        await DataSourceProcessor.getInstance().saveConnection(connection,  req.body.tokenDetails, project_id);            
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
        console.log('tables', tables);
        res.status(200).send(tables);
    } else {
        res.status(400).send({message: 'Tables could not be accessed for the data source.'});
    }
});

export default router;