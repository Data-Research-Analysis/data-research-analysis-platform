import express, { Express, Request, Response } from 'express';
import { UtilityService } from '../services/UtilityService';
import { TokenProcessor } from '../processors/TokenProcessor';
import { validateJWT } from '../middleware/authenticate';
import { validate } from '../middleware/validator';
import { body, param, matchedData } from 'express-validator';
import { DataSourceProcessor } from '../processors/DataSourceProcessor';
import { IDBConnectionDetails } from '../types/IDBConnectionDetails';
const router = express.Router();

router.post('/connect', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([body('host').notEmpty().trim().escape(), body('port').notEmpty().trim().escape(),
    body('database_name').notEmpty().trim().escape(), body('username').notEmpty().trim().escape(),
    body('password').notEmpty().trim().escape(), body('ssl').notEmpty().trim().escape(),
    body('ssl_mode').notEmpty().trim().escape()
]),
async (req: Request, res: Response) => {
    const { host, port, database_name, username, password, ssl, ssl_mode } = matchedData(req);
    const connection: IDBConnectionDetails = {
        host: host,
        port: port,
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


export default router;