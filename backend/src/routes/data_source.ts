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
import { PDFService } from '../services/PDFService.js';
import { expensiveOperationsLimiter } from '../middleware/rateLimit.js';
import { enforceDataSourceLimit, enforceDataModelLimit } from '../middleware/tierEnforcement.js';
import { authorize } from '../middleware/authorize.js';
import { Permission } from '../constants/permissions.js';
import { 
    requireProjectPermission, 
    requireDataSourcePermission 
} from '../middleware/rbacMiddleware.js';
import { EAction } from '../services/PermissionService.js';

const router = express.Router();

// Multer configuration setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// PDF file upload configuration
const pdfStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../public/uploads/pdfs/'));
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage: pdfStorage });

// Excel file upload configuration - supports large files
const excelStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../public/uploads/excel/'));
  },
  filename: (req, file, cb) => {
    // Add timestamp to prevent filename conflicts
    const timestamp = Date.now();
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${timestamp}_${sanitizedName}`);
  }
});
const excelUpload = multer({ 
  storage: excelStorage,
  limits: { 
    fileSize: 500 * 1024 * 1024 // 500MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Accept only Excel and CSV files
    const allowedMimes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'application/csv'
    ];
    const allowedExts = ['.xlsx', '.xls', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel (.xlsx, .xls) and CSV files are allowed.'));
    }
  }
});

router.get('/list', async (req: Request, res: Response, next: any) => {
    next();
},validateJWT, async (req: Request, res: Response) => {
    const data_sources_list = await DataSourceProcessor.getInstance().getDataSources(req.body.tokenDetails);    
    res.status(200).send(data_sources_list);
});

router.post('/test-connection', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([
    body('data_source_type').notEmpty().trim().escape(),
    body('connection_string').optional().trim(),
    body('host').optional().trim().escape(), 
    body('port').optional().trim().escape(),
    body('schema').optional().trim().escape(), 
    body('database_name').optional().trim().escape(), 
    body('username').optional().trim().escape(),
    body('password').optional().trim().escape(),
]),
async (req: Request, res: Response) => {
    let { data_source_type, connection_string, host, port, schema, database_name, username, password } = matchedData(req);
    
    // For MongoDB, require connection_string
    if (data_source_type === 'mongodb') {
        if (!connection_string) {
            return res.status(400).send({
                message: 'MongoDB requires a connection_string (e.g., mongodb+srv://username:password@host/database).'
            });
        }
    } else {
        // For other data sources, require individual fields
        if (!host || !port || !database_name || !username || !password) {
            return res.status(400).send({
                message: 'Please provide all connection fields (host, port, database_name, username, password).'
            });
        }
    }
    
    // Set synthetic schema for MongoDB (users don't need to specify this)
    if (data_source_type === 'mongodb' && !schema) {
        schema = 'dra_mongodb';
    }
    
    const connection: IDBConnectionDetails = {
        data_source_type: data_source_type,
        connection_string: connection_string,
        host: host || '',
        port: port || 27017,
        schema: schema,
        database: database_name || '',
        username: username || '',
        password: password || '',
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
}, validateJWT, enforceDataSourceLimit, validate([
    body('data_source_type').notEmpty().trim().escape(),
    body('connection_string').optional().trim(),
    body('host').optional().trim().escape(), 
    body('port').optional().trim().escape(),
    body('schema').optional().trim().escape(), 
    body('database_name').optional().trim().escape(), 
    body('username').optional().trim().escape(),
    body('password').optional().trim().escape(), 
    body('project_id').notEmpty().trim().escape(),
    body('classification').optional().trim().escape(),
]), requireProjectPermission(EAction.CREATE, 'project_id'),
async (req: Request, res: Response) => {
    let { data_source_type, connection_string, host, port, schema, database_name, username, password, project_id, classification } = matchedData(req);
    
    // For MongoDB, require connection_string
    if (data_source_type === 'mongodb') {
        if (!connection_string) {
            return res.status(400).send({
                message: 'MongoDB requires a connection_string (e.g., mongodb+srv://username:password@host/database).'
            });
        }
    } else {
        // For other data sources, require individual fields
        if (!host || !port || !database_name || !username || !password) {
            return res.status(400).send({
                message: 'Please provide all connection fields (host, port, database_name, username, password).'
            });
        }
    }
    
    // Set synthetic schema for MongoDB (users don't need to specify this)
    if (data_source_type === 'mongodb' && !schema) {
        schema = 'dra_mongodb';
    }
    
    const connection: IDBConnectionDetails = {
        data_source_type: data_source_type,
        connection_string: connection_string,
        host: host || '',
        port: port || 27017,
        schema: schema,
        database: database_name || '',
        username: username || '',
        password: password || '',
        classification: classification || undefined,
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

router.put('/update-data-source/:data_source_id', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([
    param('data_source_id').notEmpty().trim().escape().toInt(),
    body('data_source_type').notEmpty().trim().escape(), 
    body('host').notEmpty().trim().escape(), 
    body('port').notEmpty().trim().escape(),
    body('schema').notEmpty().trim().escape(), 
    body('database_name').notEmpty().trim().escape(), 
    body('username').notEmpty().trim().escape(),
    body('password').notEmpty().trim().escape(),
]), requireDataSourcePermission(EAction.UPDATE, 'data_source_id'),
async (req: Request, res: Response) => {
    const { data_source_id, data_source_type, host, port, schema, database_name, username, password } = matchedData(req);
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
        const result = await DataSourceProcessor.getInstance().updateDataSource(
            data_source_id, 
            connection, 
            req.body.tokenDetails
        );
        
        if (result) {
            res.status(200).send({message: 'The data source has been updated successfully.'});        
        } else {
            res.status(400).send({message: 'The data source could not be updated.'});
        }
    } catch (error) {
        console.error('Error updating data source:', error);
        res.status(400).send({message: 'The data source could not be updated.'});
    }
});

router.delete('/delete/:data_source_id', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([param('data_source_id').notEmpty().trim().escape().toInt()]), authorize(Permission.DATA_SOURCE_DELETE), requireDataSourcePermission(EAction.DELETE, 'data_source_id'),
async (req: Request, res: Response) => {
    const { data_source_id } = matchedData(req);
    const result = await DataSourceProcessor.getInstance().deleteDataSource(data_source_id,  req.body.tokenDetails);            
    if (result) {
        res.status(200).send({message: 'The data source has been deleted.'});        
    } else {
        res.status(400).send({message: 'The data source could not be deleted.'});
    }
});

/**
 * PATCH /data-source/:data_source_id/classification
 * Update only the classification field of a data source. Works for all source types.
 */
router.patch('/:data_source_id/classification', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([
    param('data_source_id').notEmpty().trim().escape().toInt(),
    body('classification').optional({ nullable: true }).trim().escape(),
]), requireDataSourcePermission(EAction.UPDATE, 'data_source_id'),
async (req: Request, res: Response) => {
    const { data_source_id, classification } = matchedData(req);
    try {
        const result = await DataSourceProcessor.getInstance().updateDataSourceClassification(
            data_source_id,
            classification || null,
            req.body.tokenDetails
        );
        if (result) {
            res.status(200).send({ message: 'Classification updated successfully.' });
        } else {
            res.status(400).send({ message: 'Could not update classification.' });
        }
    } catch (error) {
        console.error('Error updating classification:', error);
        res.status(500).send({ message: 'An error occurred while updating classification.' });
    }
});

router.get('/tables/:data_source_id', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([param('data_source_id').notEmpty().trim().escape().toInt()]), requireDataSourcePermission(EAction.READ, 'data_source_id'),
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
}, validateJWT, validate([
    body('data_source_id').optional().trim().escape().toInt(), 
    body('project_id').optional().trim().escape().toInt(),
    body('is_cross_source').optional().isBoolean().toBoolean(),
    body('query').notEmpty().trim()
]),
async (req: Request, res: Response) => {
    const { data_source_id, project_id, is_cross_source, query } = matchedData(req);
    const query_json = req.body.query_json; // Optional JSON query for reconstruction
    
    console.log('[ROUTE /execute-query-on-external-data-source] ========== REQUEST RECEIVED ==========');
    console.log('[ROUTE] data_source_id:', data_source_id);
    console.log('[ROUTE] project_id:', project_id);
    console.log('[ROUTE] is_cross_source:', is_cross_source);
    console.log('[ROUTE] SQL Query received from frontend:', query);
    if (query_json) {
        try {
            const parsedJSON = JSON.parse(query_json);
            console.log('[ROUTE] Query JSON - WHERE clauses:', JSON.stringify(parsedJSON.query_options?.where, null, 2));
            console.log('[ROUTE] Query JSON - Column count:', parsedJSON.columns?.length);
        } catch (e) {
            console.error('[ROUTE] Failed to parse query_json:', e);
        }
    }
    console.log('[ROUTE] ================================================================');
    
    // Validate that we have either data_source_id OR (project_id + is_cross_source)
    if (!data_source_id && (!project_id || !is_cross_source)) {
        return res.status(400).send({
            message: 'Either data_source_id (for single-source) or project_id + is_cross_source (for cross-source) is required'
        });
    }
    
    try {
        const response = await DataSourceProcessor.getInstance().executeQueryOnExternalDataSource(
            data_source_id, 
            query, 
            req.body.tokenDetails, 
            query_json,
            is_cross_source,
            project_id
        );
        res.status(200).send(response); 
    } catch (error: any) {
        console.error('[ROUTE /execute-query-on-external-data-source] Error:', error?.message || error);
        res.status(400).send({
            message: error?.message || 'Query execution failed',
            sqlError: {
                code: error?.code || null,
                detail: error?.detail || null,
                hint: error?.hint || null,
                position: error?.position || null,
                routine: error?.routine || null
            }
        });
    }
});

router.post('/build-data-model-on-query', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, enforceDataModelLimit, validate([
    body('data_source_id').optional().trim().escape().toInt(),
    body('project_id').optional().trim().escape().toInt(),
    body('data_model_id').optional().trim().escape().toInt(),
    body('is_cross_source').optional().isBoolean().toBoolean(),
    body('query').notEmpty().trim(),
    body('query_json').notEmpty().trim(),
    body('data_model_name').notEmpty().trim().escape()
]),
async (req: Request, res: Response) => {
    const { data_source_id, project_id, data_model_id, is_cross_source, query, query_json, data_model_name } = matchedData(req);
    
    // Validate that we have either data_source_id OR (project_id + is_cross_source)
    if (!data_source_id && (!project_id || !is_cross_source)) {
        return res.status(400).send({
            message: 'Either data_source_id (for single-source) or project_id + is_cross_source (for cross-source) is required'
        });
    }
    
    try {
        const result = await DataSourceProcessor.getInstance().buildDataModelOnQuery(
            data_source_id, 
            query, 
            query_json, 
            data_model_name, 
            req.body.tokenDetails,
            is_cross_source,
            project_id,
            data_model_id
        );
        
        if (result) {
            res.status(200).send({message: 'The data model has been built.', data_model_id: result}); 
        } else {
            res.status(400).send({message: 'The data model could not be built.'});
        }
    } catch (error: any) {
        console.error('[ROUTE /build-data-model-on-query] Error:', error?.message || error);
        res.status(400).send({
            message: error?.message || 'The data model could not be built.',
            sqlError: {
                code: error?.code || null,
                detail: error?.detail || null,
                hint: error?.hint || null,
                position: error?.position || null,
                routine: error?.routine || null
            }
        });
    }
});

router.post('/add-excel-data-source', expensiveOperationsLimiter, async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([
    body('data_source_name').notEmpty().trim().escape(), 
    body('file_id').notEmpty().trim().escape(), 
    body('data').notEmpty(), 
    body('project_id').notEmpty().trim().escape(), 
    body('data_source_id').optional().trim().escape(),
    body('sheet_info').optional(),
    body('classification').optional().trim().escape(),
]), requireProjectPermission(EAction.CREATE, 'project_id'),
async (req: Request, res: Response) => {
    const { data_source_name, file_id, data, project_id, data_source_id, sheet_info, classification } = matchedData(req);
    if (data?.columns && data.columns.length > 0) {
        console.log('Sample columns from request:', data.columns.slice(0, 2));
    }
    if (data?.rows && data.rows.length > 0) {
        console.log('Sample rows from request:', data.rows.slice(0, 2));
    }
    
    try {
        // Sanitize boolean values in the data before processing
        const sanitizedData = UtilityService.getInstance().sanitizeDataForPostgreSQL(data);
        console.log('Data after sanitization:', {
            columnsCount: sanitizedData?.columns?.length || 0,
            rowsCount: sanitizedData?.rows?.length || 0
        });
        
        const result = await DataSourceProcessor.getInstance().addExcelDataSource(
            data_source_name, 
            file_id, 
            JSON.stringify(sanitizedData), 
            req.body.tokenDetails, 
            project_id, 
            data_source_id, 
            sheet_info,
            classification || null
        );
        res.status(200).send({message: 'Excel data source created successfully.', result});
    } catch (error) {
        console.error('Excel data source creation error:', error);
        res.status(400).send({message: 'Excel data source creation failed.'});
    }
});

/**
 * POST /data-source/upload-excel-file
 * Upload Excel file and process server-side (recommended for large files)
 * This route handles the entire Excel file upload and parsing on the backend,
 * avoiding the "request entity too large" error from sending large JSON payloads
 */
router.post('/upload-excel-file', expensiveOperationsLimiter, async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, excelUpload.single('file'), validate([
    body('data_source_name').notEmpty().trim().escape(),
    body('project_id').notEmpty().trim().escape(),
    body('data_source_id').optional().trim().escape()
]), requireProjectPermission(EAction.CREATE, 'project_id'),
async (req: IMulterRequest, res: Response) => {
    const file = req.file;
    if (!file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }
    
    try {
        const { data_source_name, project_id, data_source_id } = matchedData(req);
        
        console.log('Processing Excel file upload:', {
            filename: file.filename,
            size: file.size,
            originalName: file.originalname,
            data_source_name,
            project_id
        });
        
        // Process the Excel file server-side
        const result = await DataSourceProcessor.getInstance().addExcelDataSourceFromFile(
            data_source_name,
            file.filename,
            file.path,
            req.body.tokenDetails,
            parseInt(project_id),
            data_source_id ? parseInt(data_source_id) : null
        );
        
        if (result.status === 'success') {
            res.status(200).json({
                message: 'Excel file uploaded and processed successfully.',
                result: result,
                sheets_count: result.sheets_processed?.length || 0
            });
        } else {
            res.status(400).json({
                message: 'Excel file processing failed.',
                error: result.error || 'Unknown error'
            });
        }
    } catch (error) {
        console.error('Excel file upload error:', error);
        res.status(500).json({ 
            message: 'Excel file upload failed.', 
            error: error.message 
        });
    }
});

router.post('/add-pdf-data-source', expensiveOperationsLimiter, async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([
    body('data_source_name').notEmpty().trim().escape(), 
    body('file_id').notEmpty().trim().escape(), 
    body('data').notEmpty(), 
    body('project_id').notEmpty().trim().escape().toInt(), 
    body('data_source_id').optional().trim().escape().toInt(),
    body('sheet_info').optional()
]), requireProjectPermission(EAction.CREATE, 'project_id'),
async (req: Request, res: Response) => {
    const { data_source_name, file_id, data, project_id, data_source_id, sheet_info } = matchedData(req);
    try {
        // Sanitize boolean values in the data before processing
        const sanitizedData = UtilityService.getInstance().sanitizeDataForPostgreSQL(data);
        
        const result = await DataSourceProcessor.getInstance().addPDFDataSource(
            data_source_name, 
            file_id, 
            JSON.stringify(sanitizedData), 
            req.body.tokenDetails, 
            project_id, 
            data_source_id, 
            sheet_info
        );
        res.status(200).send({message: 'PDF data source created successfully.', result});
    } catch (error) {
        console.error('PDF data source creation error:', error);
        res.status(400).send({message: 'PDF data source creation failed.'});
    }
});

/**
 * POST /data-source/upload-excel-preview
 * Upload Excel file and return parsed data for preview (does NOT create data source yet)
 * Similar to PDF upload flow - user can preview/edit data before creating data source
 */
router.post('/upload-excel-preview', expensiveOperationsLimiter, async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, excelUpload.single('file'), async (req: IMulterRequest, res: Response) => {
    const file = req.file;
    if (!file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }
    
    try {
        console.log('Parsing Excel file for preview:', {
            filename: file.filename,
            size: file.size,
            originalName: file.originalname
        });
        
        // Parse the Excel file and return data without creating data source
        const parseResult = await ExcelFileService.getInstance().parseExcelFileFromPath(file.path);
        
        if (!parseResult.sheets || parseResult.sheets.length === 0) {
            return res.status(400).json({
                message: 'No valid sheets found in Excel file',
                success: false
            });
        }
        
        // Format response similar to PDF extraction
        const formattedSheets = parseResult.sheets.map(sheet => ({
            sheet_id: `sheet_${sheet.index}`,
            sheet_name: sheet.name,
            original_sheet_name: sheet.metadata.originalSheetName,
            sheet_index: sheet.index,
            columns: sheet.columns,
            rows: sheet.rows,
            metadata: {
                rowCount: sheet.metadata.rowCount,
                columnCount: sheet.metadata.columnCount
            }
        }));
        
        res.status(200).json({
            url: file.path,
            file_name: file.filename,
            file_size: file.size,
            original_name: file.originalname,
            sheets: formattedSheets,
            sheets_count: formattedSheets.length,
            success: true
        });
    } catch (error) {
        console.error('Excel parsing error:', error);
        res.status(500).json({
            message: 'Excel file parsing failed.',
            error: error.message,
            success: false
        });
    }
});

router.post('/upload/pdf', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, upload.single('file'), async (req: IMulterRequest, res: Response) => {
    const file = req.file;
    if (!file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }
    try {
        const publicUrl = UtilityService.getInstance().getConstants('PUBLIC_BACKEND_URL');
        if (req?.file?.filename) {
            const fileUrl = `${publicUrl}/uploads/pdfs/${req.file.filename}`;
            console.log('Uploaded file URL:', fileUrl);
            await PDFService.getInstance().preparePDFForDataExtraction(req.file.filename);
            
            res.status(200).json({
                url: fileUrl, 
                file_name: req.file.filename,
                file_size: req.file.size,
                original_name: req.file.originalname,
                // data: pdfData,
                success: true
            });
        } else {
            res.status(400).json({ message: 'File upload failed.' });
        }
    } catch (error) {
        console.error('PDF processing error:', error);
        res.status(500).json({ 
            message: 'PDF processing failed.', 
            error: error.message 
        });
    }
});

/**
 * PUT /data-source/:datasourceid/schedule
 * Update sync schedule configuration for a data source
 */
router.put('/:datasourceid/schedule',
    validateJWT,
    validate([
        param('datasourceid').isInt().toInt(),
        body('sync_enabled').isBoolean(),
        body('sync_schedule').isString().isIn(['manual', 'hourly', 'daily', 'weekly', 'monthly']),
        body('sync_schedule_time').optional({ nullable: true }).matches(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/)
    ]),
    requireDataSourcePermission(EAction.UPDATE, 'datasourceid'),
    async (req: Request, res: Response) => {
        try {
            const { datasourceid, sync_enabled, sync_schedule, sync_schedule_time } = matchedData(req);

            const result = await DataSourceProcessor.getInstance().updateSyncSchedule(
                datasourceid,
                sync_enabled,
                sync_schedule,
                sync_schedule_time,
                req.body.tokenDetails
            );

            if (result.success) {
                res.status(200).json({
                    success: true,
                    message: 'Schedule configuration updated successfully',
                    data: result.data
                });
            } else {
                res.status(400).json({
                    success: false,
                    message: result.message || 'Failed to update schedule configuration'
                });
            }
        } catch (error: any) {
            console.error('Schedule update error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Internal server error'
            });
        }
    }
);

/**
 * POST /data-source/sync/:datasourceid
 * Manually trigger MongoDB data sync
 */
router.post('/sync/:datasourceid',
    validateJWT,
    validate([
        param('datasourceid').isInt().toInt(),
        body('syncType').optional().isIn(['full', 'incremental'])
    ]),
    requireDataSourcePermission(EAction.UPDATE, 'datasourceid'),
    expensiveOperationsLimiter,
    async (req: Request, res: Response) => {
        try {
            const { datasourceid } = matchedData(req);
            const syncType = req.body.syncType || 'full';

            const processor = DataSourceProcessor.getInstance();
            const dataSource = await processor.getDataSourceById(datasourceid);

            if (!dataSource) {
                return res.status(404).json({ 
                    success: false,
                    message: 'Data source not found' 
                });
            }

            if (dataSource.data_type !== 'mongodb') {
                return res.status(400).json({ 
                    success: false,
                    message: 'Only MongoDB data sources support sync' 
                });
            }

            // Check if sync is already in progress
            if (dataSource.sync_status === 'in_progress') {
                return res.status(409).json({ 
                    success: false,
                    message: 'Sync is already in progress for this data source' 
                });
            }

            // Queue sync job
            const QueueService = (await import('../services/QueueService.js')).QueueService;
            await QueueService.getInstance().addJob('mongodb-sync', {
                dataSourceId: datasourceid,
                syncType,
                userId: req.body.tokenDetails.user_id
            });

            res.json({
                success: true,
                message: 'Sync queued successfully',
                dataSourceId: datasourceid,
                syncType
            });

        } catch (error: any) {
            console.error('[DataSource] Sync queue error:', error);
            res.status(500).json({ 
                success: false,
                message: 'Failed to queue sync',
                error: error.message 
            });
        }
    }
);

/**
 * GET /data-source/sync-status/:datasourceid
 * Get sync status and history for a MongoDB data source
 */
router.get('/sync-status/:datasourceid',
    validateJWT,
    validate([
        param('datasourceid').isInt().toInt()
    ]),
    requireDataSourcePermission(EAction.READ, 'datasourceid'),
    async (req: Request, res: Response) => {
        try {
            const { datasourceid } = matchedData(req);

            const processor = DataSourceProcessor.getInstance();
            const dataSource = await processor.getDataSourceById(datasourceid);

            if (!dataSource) {
                return res.status(404).json({ 
                    success: false,
                    message: 'Data source not found' 
                });
            }

            if (dataSource.data_type !== 'mongodb') {
                return res.status(400).json({ 
                    success: false,
                    message: 'Only MongoDB data sources have sync status' 
                });
            }

            // Get recent sync history
            const { DBDriver } = await import('../drivers/DBDriver.js');
            const { EDataSourceType } = await import('../types/EDataSourceType.js');
            const { DRAMongoDBSyncHistory } = await import('../models/DRAMongoDBSyncHistory.js');
            
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return res.status(500).json({ 
                    success: false,
                    message: 'Database driver not available' 
                });
            }
            
            const pgDataSource = await driver.getConcreteDriver();
            const historyRepo = pgDataSource.getRepository(DRAMongoDBSyncHistory);
            const syncHistory = await historyRepo.find({
                where: { data_source_id: datasourceid },
                order: { started_at: 'DESC' },
                take: 10
            });

            res.json({
                success: true,
                sync_status: dataSource.sync_status,
                last_sync_at: dataSource.last_sync_at,
                total_records_synced: dataSource.total_records_synced,
                sync_error_message: dataSource.sync_error_message,
                sync_config: dataSource.sync_config,
                history: syncHistory
            });

        } catch (error: any) {
            console.error('[DataSource] Get sync status error:', error);
            res.status(500).json({ 
                success: false,
                message: 'Failed to get sync status',
                error: error.message 
            });
        }
    }
);

export default router;