import express, { Request, Response } from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { validate } from '../middleware/validator.js';
import { body, param, matchedData } from 'express-validator';
import { DataSourceProcessor } from '../processors/DataSourceProcessor.js';
import { IDBConnectionDetails } from '../types/IDBConnectionDetails.js';
import multer from 'multer';
import { IMulterRequest } from '../types/IMulterRequest.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { UtilityService } from '../services/UtilityService.js';
import { ExcelFileService } from '../services/ExcelFileService.js';

const router = express.Router();

router.get('/list', async (req: Request, res: Response, next: any) => {
    next();
},validateJWT, async (req: Request, res: Response) => {
    const data_sources_list = await DataSourceProcessor.getInstance().getDataSources(req.body.tokenDetails);    
    res.status(200).send(data_sources_list);
});

router.post('/test-connection', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([body('data_source_type').notEmpty().trim().escape(), body('host').notEmpty().trim().escape(), body('port').notEmpty().trim().escape(),
    body('schema').notEmpty().trim().escape(), body('database_name').notEmpty().trim().escape(), body('username').notEmpty().trim().escape(),
    body('password').notEmpty().trim().escape(),
]),
async (req: Request, res: Response) => {
    const { data_source_type, host, port, schema, database_name, username, password, } = matchedData(req);
    const connection: IDBConnectionDetails = {
        data_source_type: data_source_type,
        host: host,
        port: port,
        schema: schema,
        database: database_name,
        username: username,
        password: password,
    };
    try {
        const response = await DataSourceProcessor.getInstance().connectToDataSource(connection);
        if (response) {
            res.status(200).send({message: 'The data source has been connected.'});        
        } else {
            res.status(400).send({message: 'The data source could not be connected.'});
        }
    } catch (error) {
        res.status(400).send({message: 'The data source could not be connected.'});
    }
});

router.post('/add-data-source', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([body('data_source_type').notEmpty().trim().escape(), body('host').notEmpty().trim().escape(), body('port').notEmpty().trim().escape(),
    body('schema').notEmpty().trim().escape(), body('database_name').notEmpty().trim().escape(), body('username').notEmpty().trim().escape(),
    body('password').notEmpty().trim().escape(), body('project_id').notEmpty().trim().escape(),
]),
async (req: Request, res: Response) => {
    const { data_source_type, host, port, schema, database_name, username, password, project_id } = matchedData(req);
    const connection: IDBConnectionDetails = {
        data_source_type: data_source_type,
        host: host,
        port: port,
        schema: schema,
        database: database_name,
        username: username,
        password: password,
    };
    try {
        const response = await DataSourceProcessor.getInstance().connectToDataSource(connection);
        if (response) {
            await DataSourceProcessor.getInstance().addDataSource(connection,  req.body.tokenDetails, project_id);            
            res.status(200).send({message: 'The data source has been connected.'});        
        } else {
            res.status(400).send({message: 'The data source could not be connected.'});
        }
    } catch (error) {
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
}, validateJWT, validate([body('data_source_id').notEmpty().trim().escape().toInt(), body('query').notEmpty().trim(), body('query_json').notEmpty().trim(), body('data_model_name').notEmpty().trim().escape()]),
async (req: Request, res: Response) => {
    const { data_source_id, query, query_json, data_model_name } = matchedData(req);
    const response = await DataSourceProcessor.getInstance().buildDataModelOnQuery(data_source_id, query, query_json, data_model_name, req.body.tokenDetails);
    if (response) {
        res.status(200).send({message: 'The data model has been built.'}); 
    } else {
        res.status(400).send({message: 'The data model could not be built.'});
    }
});

router.post('/add-excel-data-source', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([body('file_name').notEmpty().trim().escape(), body('data_source_name').notEmpty().trim().escape(), body('file_id').notEmpty().trim().escape(), body('data').notEmpty(), body('project_id').notEmpty().trim().escape(), body('data_source_id').trim().escape(),
]),
async (req: Request, res: Response) => {
    const { file_name, data_source_name, file_id, data, project_id, data_source_id } = matchedData(req);
    try {
        const result = await DataSourceProcessor.getInstance().addExcelDataSource(file_name, data_source_name, file_id, JSON.stringify(data),  req.body.tokenDetails, project_id, data_source_id);
        res.status(200).send({message: 'The data source has been connected.', result});
    } catch (error) {
        res.status(400).send({message: 'The data source could not be connected.'});
    }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Set the destination directory for uploaded files
    // Ensure this directory exists in your backend project
    cb(null, path.join(__dirname, '../../public/uploads/pdf/'));
  },
  filename: (req, file, cb) => {
    // Generate a unique filename to prevent overwrites
    // e.g., image-16789012345.jpg
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });
router.post('/upload/pdf', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, upload.single('file'), async (req: IMulterRequest, res: Response) => {
    const file = req.file;
    if (!file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }
    const publicUrl = UtilityService.getInstance().getConstants('PUBLIC_BACKEND_URL');
    if (req?.file?.filename) {
      const fileUrl = `${publicUrl}/uploads/pdf/${req.file.filename}`;
    //   const data = await ExcelFileService.getInstance().readExcelFile(req.file.filename);
      res.status(200).json({ url: fileUrl, file_name: req.file.filename });
    } else {
      res.status(400).json({ message: 'File upload failed.' });
    }
});
export default router;