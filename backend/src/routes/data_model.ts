import express, { Request, Response } from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { validate } from '../middleware/validator.js';
import { body, param, matchedData, query } from 'express-validator';
import { DataModelProcessor } from '../processors/DataModelProcessor.js';
import { CrossSourceJoinService } from '../services/CrossSourceJoinService.js';
import { DataSourceProcessor } from '../processors/DataSourceProcessor.js';
import { QueryEngineProcessor } from '../processors/QueryEngineProcessor.js';
import { authorize } from '../middleware/authorize.js';
import { Permission } from '../constants/permissions.js';
import { 
    requireProjectPermission, 
    requireDataModelPermission 
} from '../middleware/rbacMiddleware.js';
import { EAction } from '../services/PermissionService.js';
import { optionalOrganizationContext, type IOrganizationContextRequest } from '../middleware/organizationContext.js';
import { workspaceContext, type IWorkspaceContextRequest } from '../middleware/workspaceContext.js';
const router = express.Router();

router.get('/list/:project_id', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, optionalOrganizationContext, validate([param('project_id').notEmpty().trim().escape().toInt()]), async (req: IOrganizationContextRequest, res: Response) => {
    const { project_id } = matchedData(req);
    const projectIdNum = parseInt(String(project_id), 10);
    
    if (isNaN(projectIdNum)) {
        return res.status(400).send({ message: 'Invalid project_id' });
    }
    
    const organizationId = req.organizationId || null;
    const data_models_list = await DataModelProcessor.getInstance().getDataModels(projectIdNum, req.body.tokenDetails, organizationId);    
    res.status(200).send(data_models_list);
});
router.delete('/delete/:data_model_id', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, workspaceContext, validate([param('data_model_id').notEmpty().trim().escape().toInt()]), authorize(Permission.DATA_MODEL_DELETE), requireDataModelPermission(EAction.DELETE, 'data_model_id'),
async (req: IWorkspaceContextRequest, res: Response) => {
    const { data_model_id } = matchedData(req);
    const result = await DataModelProcessor.getInstance().deleteDataModel(
        data_model_id,
        req.body.tokenDetails,
        req.organizationId!,
        req.workspaceId!
    );            
    if (result) {
        res.status(200).send({message: 'The data model has been deleted.'});        
    } else {
        res.status(400).send({message: 'The data model could not be deleted.'});
    }
});
router.post('/copy/:data_model_id', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([param('data_model_id').notEmpty().trim().escape().toInt()]), authorize(Permission.DATA_MODEL_CREATE), requireDataModelPermission(EAction.READ, 'data_model_id'),
async (req: Request, res: Response) => {
    const { data_model_id } = matchedData(req);
    try {
        const newModel = await DataModelProcessor.getInstance().copyDataModel(data_model_id, req.body.tokenDetails);
        if (newModel) {
            res.status(200).send(newModel);
        } else {
            res.status(400).send({message: 'The data model could not be copied.'});
        }
    } catch (error: any) {
        console.error('Error copying data model:', error);
        res.status(500).send({message: error.message || 'An error occurred while copying the data model.'});
    }
});
router.post('/refresh/:data_model_id', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([param('data_model_id').notEmpty().trim().escape().toInt()]), requireDataModelPermission(EAction.UPDATE, 'data_model_id'),
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
}, validateJWT, validate([body('data_source_id').notEmpty().trim().escape().toInt(), body('data_model_id').notEmpty().trim().escape().toInt(), body('query').notEmpty().trim(), body('query_json').notEmpty().trim(), body('data_model_name').notEmpty().trim().escape()]), authorize(Permission.DATA_MODEL_EDIT), requireDataModelPermission(EAction.UPDATE, 'data_model_id'),
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
},validateJWT, validate([
    param('project_id').notEmpty().trim(),
    query('includeRows').optional().toBoolean()
]), requireProjectPermission(EAction.READ, 'project_id'), async (req: Request, res: Response) => {
    const validatedData = matchedData(req);
    const project_id = validatedData.project_id;
    const includeRows = validatedData.includeRows || false;
    
    if (includeRows) {
        console.warn('[DEPRECATED] includeRows=true is deprecated. Use /data-model/:id/data endpoint instead.');
        res.setHeader('X-Deprecation-Warning', 'includeRows parameter will be removed in v2.0');
    }
    
    console.log('project_id', project_id, 'includeRows', includeRows);
    const data_models_tables_list = await DataModelProcessor.getInstance().getTablesFromDataModels(project_id, req.body.tokenDetails, includeRows);    
    res.status(200).send(data_models_tables_list);
});

// New paginated data endpoint for fetching data model data on-demand
router.get('/:data_model_id/data', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([
    param('data_model_id').notEmpty().toInt(),
    query('page').optional().toInt().default(1),
    query('limit').optional().toInt().default(100),
    query('sort_by').optional().trim(),
    query('sort_order').optional().isIn(['ASC', 'DESC']),
    query('filters').optional().isJSON(),
    query('search').optional().trim()
]), requireDataModelPermission(EAction.READ, 'data_model_id'),
async (req: Request, res: Response) => {
    try {
        const validatedData = matchedData(req);
        const data_model_id = validatedData.data_model_id;
        const page = validatedData.page || 1;
        const limit = Math.min(validatedData.limit || 100, 1000); // Cap at 1000
        const sort_by = validatedData.sort_by;
        const sort_order = validatedData.sort_order;
        const filters = validatedData.filters ? JSON.parse(validatedData.filters) : undefined;
        const search = validatedData.search;
        
        const result = await DataModelProcessor.getInstance().getDataModelData({
            dataModelId: data_model_id,
            page,
            limit,
            sortBy: sort_by,
            sortOrder: sort_order,
            filters,
            search,
            tokenDetails: req.body.tokenDetails
        });
        
        res.status(200).send({
            data: result.rows,
            pagination: {
                page,
                limit,
                total: result.total,
                totalPages: Math.ceil(result.total / limit),
                hasNext: page < Math.ceil(result.total / limit),
                hasPrevious: page > 1
            }
        });
    } catch (error: any) {
        console.error('[DataModelRoute] Error fetching paginated data:', error);
        res.status(500).send({ 
            message: 'Failed to fetch data model data', 
            error: error.message || 'Unknown error' 
        });
    }
});

router.post('/execute-query-on-data-model', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([body('query').notEmpty().trim(), body('data_model_id').optional().trim().escape().toInt()]), authorize(Permission.DATA_MODEL_EXECUTE),
async (req: Request, res: Response) => {
    try {
        const { query, data_model_id } = matchedData(req);
        const dataModelId = data_model_id ? parseInt(String(data_model_id), 10) : undefined;
        const response = await DataModelProcessor.getInstance().executeQueryOnDataModel(query, req.body.tokenDetails, dataModelId);
        res.status(200).send(response);
    } catch (error: any) {
        if (error?.name === 'DataModelOversizedException') {
            return res.status(422).send({
                error: 'DATA_MODEL_OVERSIZED',
                modelId: error.modelId,
                modelName: error.modelName,
                rowCount: error.rowCount,
                sourceRowCount: error.sourceRowCount,
                threshold: error.threshold,
                healthStatus: error.healthStatus,
                healthIssues: error.healthIssues,
                message: error.message,
            });
        }
        res.status(500).send({ message: 'Failed to execute query on data model', error: error.message });
    }
});

/**
 * NEW ENDPOINTS FOR CROSS-DATA-SOURCE SUPPORT
 */

// Get all tables from all data sources in a project (for cross-source model building)
router.get('/projects/:project_id/all-tables', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([param('project_id').notEmpty().trim().escape().toInt()]), requireProjectPermission(EAction.READ, 'project_id'),
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
            const tables = await QueryEngineProcessor.getInstance().getTablesFromDataSource(dataSource.id, req.body.tokenDetails);
            
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
    body('rightTable').notEmpty(),
    body('leftTable.data_source_id').notEmpty().toInt(),
    body('rightTable.data_source_id').notEmpty().toInt()
]), authorize(Permission.DATA_MODEL_CREATE),
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
]), authorize(Permission.DATA_MODEL_CREATE),
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

/**
 * PATCH /:data_model_id
 * Update data model settings (e.g., auto_refresh_enabled)
 */
router.patch('/:data_model_id',
    validateJWT,
    workspaceContext,
    validate([param('data_model_id').notEmpty().trim().escape().toInt()]),
    requireDataModelPermission(EAction.UPDATE, 'data_model_id'),
    async (req: IWorkspaceContextRequest, res: Response) => {
        try {
            const { data_model_id } = matchedData(req);
            const dataModelId = parseInt(String(data_model_id), 10);
            
            // Only allow updating specific fields
            const allowedFields = ['auto_refresh_enabled'];
            const updates: any = {};
            
            for (const field of allowedFields) {
                if (req.body[field] !== undefined) {
                    updates[field] = req.body[field];
                }
            }
            
            if (Object.keys(updates).length === 0) {
                return res.status(400).send({ message: 'No valid fields to update' });
            }
            
            const result = await DataModelProcessor.getInstance().updateDataModelSettings(
                dataModelId,
                updates,
                req.body.tokenDetails,
                req.organizationId!,
                req.workspaceId!
            );
            
            if (result) {
                res.status(200).send({ 
                    message: 'Data model settings updated successfully',
                    updates 
                });
            } else {
                res.status(400).send({ message: 'Failed to update data model settings' });
            }
        } catch (error: any) {
            console.error('[DataModel] Error updating settings:', error);
            res.status(500).send({ 
                message: 'Failed to update data model settings',
                error: error.message 
            });
        }
    }
);

/**
 * GET /:data_model_id/health
 * Returns the persisted health report and a live re-analysis side-by-side.
 * `stale: true` means source data has changed since last model save.
 */
router.get('/:data_model_id/health',
    validateJWT,
    workspaceContext,
    validate([param('data_model_id').notEmpty().trim().escape().toInt()]),
    requireDataModelPermission(EAction.READ, 'data_model_id'),
    async (req: IWorkspaceContextRequest, res: Response) => {
        try {
            const { data_model_id } = matchedData(req);
            const dataModelId = parseInt(String(data_model_id), 10);

            const result = await DataModelProcessor.getInstance().getModelHealth(
                dataModelId,
                req.body.tokenDetails,
            );

            if (!result) {
                return res.status(404).send({ message: 'Data model not found' });
            }

            res.status(200).send(result);
        } catch (error: any) {
            console.error('[DataModel] Error fetching health:', error);
            res.status(500).send({ message: 'Failed to fetch model health', error: error.message });
        }
    }
);

/**
 * PATCH /:data_model_id/model-type
 * Set the model_type for a data model, then re-run and persist health analysis.
 */
router.patch('/:data_model_id/model-type',
    validateJWT,
    workspaceContext,
    validate([
        param('data_model_id').notEmpty().trim().escape().toInt(),
        body('model_type').optional({ nullable: true }).isIn(['dimension', 'fact', 'aggregated', null]),
    ]),
    requireDataModelPermission(EAction.UPDATE, 'data_model_id'),
    async (req: IWorkspaceContextRequest, res: Response) => {
        try {
            const { data_model_id } = matchedData(req);
            const dataModelId = parseInt(String(data_model_id), 10);

            const validTypes = ['dimension', 'fact', 'aggregated', null];
            const modelType = req.body.model_type !== undefined ? req.body.model_type : null;
            if (!validTypes.includes(modelType)) {
                return res.status(400).send({ message: `Invalid model_type. Must be one of: ${validTypes.filter(Boolean).join(', ')}, or null` });
            }

            const report = await DataModelProcessor.getInstance().setModelType(
                dataModelId,
                modelType,
                req.body.tokenDetails,
            );

            if (!report) {
                return res.status(404).send({ message: 'Data model not found' });
            }

            res.status(200).send({ message: 'Model type updated', report });
        } catch (error: any) {
            console.error('[DataModel] Error setting model type:', error);
            res.status(500).send({ message: 'Failed to set model type', error: error.message });
        }
    }
);

export default router;