import express, { Request, Response } from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { validate } from '../middleware/validator.js';
import { body, param, matchedData } from 'express-validator';
import { DataModelProcessor } from '../processors/DataModelProcessor.js';
import { CrossSourceJoinService } from '../services/CrossSourceJoinService.js';
import { DataSourceProcessor } from '../processors/DataSourceProcessor.js';
import { authorize } from '../middleware/authorize.js';
import { Permission } from '../constants/permissions.js';
const router = express.Router();

router.get('/list', async (req: Request, res: Response, next: any) => {
    next();
},validateJWT, async (req: Request, res: Response) => {
    const data_sources_list = await DataModelProcessor.getInstance().getDataModels(req.body.tokenDetails);    
    res.status(200).send(data_sources_list);
});
router.delete('/delete/:data_model_id', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([param('data_model_id').notEmpty().trim().escape().toInt()]), authorize(Permission.DATA_MODEL_DELETE),
async (req: Request, res: Response) => {
    const { data_model_id } = matchedData(req);
    const result = await DataModelProcessor.getInstance().deleteDataModel(data_model_id,  req.body.tokenDetails);            
    if (result) {
        res.status(200).send({message: 'The data model has been deleted.'});        
    } else {
        res.status(400).send({message: 'The data model could not be deleted.'});
    }
});
router.post('/refresh/:data_model_id', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([param('data_model_id').notEmpty().trim().escape().toInt()]),
async (req: Request, res: Response) => {
    const { data_model_id } = matchedData(req);
    const result = await DataModelProcessor.getInstance().refreshDataModel(data_model_id, req.body.tokenDetails);
    if (result) {
        res.status(200).send({message: 'The data model has been refreshed successfully.'});
    } else {
        res.status(400).send({message: 'The data model could not be refreshed.'});
    }
});
router.post('/update-data-model-on-query', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([body('data_source_id').notEmpty().trim().escape().toInt(), body('data_model_id').notEmpty().trim().escape().toInt(), body('query').notEmpty().trim(), body('query_json').notEmpty().trim(), body('data_model_name').notEmpty().trim().escape()]), authorize(Permission.DATA_MODEL_EDIT),
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
}, validateJWT, validate([body('query').notEmpty().trim()]), authorize(Permission.DATA_MODEL_EXECUTE),
async (req: Request, res: Response) => {
    const { data_source_id, query } = matchedData(req);
    const response = await DataModelProcessor.getInstance().executeQueryOnDataModel(query, req.body.tokenDetails);
    res.status(200).send(response); 
});

/**
 * NEW ENDPOINTS FOR CROSS-DATA-SOURCE SUPPORT
 */

// Get all tables from all data sources in a project (for cross-source model building)
router.get('/projects/:project_id/all-tables', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([param('project_id').notEmpty().trim().escape().toInt()]),
async (req: Request, res: Response) => {
    try {
        const { project_id } = matchedData(req);
        const projectId = parseInt(String(project_id), 10);
        
        console.log('[CrossSource] Fetching all tables for project:', projectId);
        
        // Get all data sources for this project
        const dataSources = await DataSourceProcessor.getInstance().getDataSourcesByProject(projectId, req.body.tokenDetails);
        
        if (!dataSources || dataSources.length === 0) {
            return res.status(200).send([]);
        }
        
        const allTables: any[] = [];
        
        // Fetch tables from each data source
        for (const dataSource of dataSources) {
            const tables = await DataSourceProcessor.getInstance().getTablesFromDataSource(dataSource.id, req.body.tokenDetails);
            
            if (tables && tables.length > 0) {
                 // Add metadata for each table indicating its source
                const enrichedTables = tables.map((table: any) => ({
                    ...table,
                    data_source_id: dataSource.id,
                    data_source_name: dataSource.name,
                    data_source_type: dataSource.data_type,
                    // Add source info to columns as well
                    columns: table.columns?.map((col: any) => ({
                        ...col,
                        data_source_id: dataSource.id,
                        data_source_type: dataSource.data_type
                    })) || []
                }));
                
                allTables.push({
                    dataSourceId: dataSource.id,
                    dataSourceName: dataSource.name,
                    dataSourceType: dataSource.data_type,
                    tables: enrichedTables
                });
            }
        }
        
        console.log(`[CrossSource] Found ${allTables.length} data sources with tables`);
        res.status(200).send(allTables);
    } catch (error) {
        console.error('[CrossSource] Error fetching all tables:', error);
        res.status(500).send({ message: 'Failed to fetch tables from data sources', error: error instanceof Error ? error.message : 'Unknown error' });
    }
});

// Suggest joins between two tables from different sources
router.post('/suggest-joins', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([
    body('leftTable').notEmpty(),
    body('rightTable').notEmpty()
]),
async (req: Request, res: Response) => {
    try {
        const { leftTable, rightTable } = req.body;
        
        console.log('[CrossSource] Suggesting joins between tables:', {
            left: leftTable.table_name,
            right: rightTable.table_name
        });
        
        const suggestions = await CrossSourceJoinService.getInstance().getCombinedSuggestions(
            leftTable,
            rightTable
        );
        
        console.log(`[CrossSource] Generated ${suggestions.length} join suggestions`);
        res.status(200).send(suggestions);
    } catch (error) {
        console.error('[CrossSource] Error suggesting joins:', error);
        res.status(500).send({ 
            message: 'Failed to suggest joins', 
            error: error instanceof Error ? error.message : 'Unknown error' 
        });
    }
});

// Save a successful join to the catalog
router.post('/save-join-to-catalog', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([
    body('leftDataSourceId').notEmpty().toInt(),
    body('leftTableName').notEmpty().trim(),
    body('leftColumnName').notEmpty().trim(),
    body('rightDataSourceId').notEmpty().toInt(),
    body('rightTableName').notEmpty().trim(),
    body('rightColumnName').notEmpty().trim(),
    body('joinType').notEmpty().trim()
]),
async (req: Request, res: Response) => {
    try {
        const joinDef = {
            leftDataSourceId: req.body.leftDataSourceId,
            leftTableName: req.body.leftTableName,
            leftColumnName: req.body.leftColumnName,
            rightDataSourceId: req.body.rightDataSourceId,
            rightTableName: req.body.rightTableName,
            rightColumnName: req.body.rightColumnName,
            joinType: req.body.joinType,
            createdByUserId: req.body.tokenDetails.user_id
        };
        
        await CrossSourceJoinService.getInstance().saveJoinToCatalog(joinDef);
        
        console.log('[CrossSource] Saved join to catalog:', joinDef);
        res.status(200).send({ message: 'Join saved to catalog successfully' });
    } catch (error) {
        console.error('[CrossSource] Error saving join to catalog:', error);
        res.status(500).send({ 
            message: 'Failed to save join to catalog', 
            error: error instanceof Error ? error.message : 'Unknown error' 
        });
    }
});

export default router;