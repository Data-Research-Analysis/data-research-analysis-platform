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
import { aiOperationsLimiter } from '../middleware/rateLimit.js';
import { AppDataSource } from '../datasources/PostgresDS.js';
import { DRADataModel } from '../models/DRADataModel.js';
import { DataModelAnalysisService } from '../services/DataModelAnalysisService.js';
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

// Issue #361: Get data models by layer (Medallion Architecture)
router.get('/by-layer/:layer/project/:project_id', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, optionalOrganizationContext, validate([
    param('layer').notEmpty().trim().isIn(['raw_data', 'clean_data', 'business_ready']),
    param('project_id').notEmpty().trim().escape().toInt()
]), async (req: IOrganizationContextRequest, res: Response) => {
    const { layer, project_id } = matchedData(req);
    const projectIdNum = parseInt(String(project_id), 10);
    
    if (isNaN(projectIdNum)) {
        return res.status(400).send({ message: 'Invalid project_id' });
    }
    
    const organizationId = req.organizationId || null;
    const data_models_list = await DataModelProcessor.getInstance().getDataModelsByLayer(
        layer as any,  // Already validated by express-validator
        projectIdNum,
        req.body.tokenDetails,
        organizationId
    );    
    res.status(200).send(data_models_list);
});

// Issue #361 Phase 5B: Get data model lineage with layer information
router.get('/lineage/:data_model_id', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, optionalOrganizationContext, validate([
    param('data_model_id').notEmpty().trim().escape().toInt()
]), async (req: IOrganizationContextRequest, res: Response) => {
    const { data_model_id } = matchedData(req);
    const dataModelId = parseInt(String(data_model_id), 10);
    
    if (isNaN(dataModelId)) {
        return res.status(400).send({ message: 'Invalid data_model_id' });
    }
    
    const organizationId = req.organizationId || null;
    const lineage = await DataModelProcessor.getInstance().getDataModelLineage(
        dataModelId,
        req.body.tokenDetails,
        organizationId
    );    
    res.status(200).send(lineage);
});

router.delete('/delete/:data_model_id', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, optionalOrganizationContext, workspaceContext, validate([param('data_model_id').notEmpty().trim().escape().toInt()]), authorize(Permission.DATA_MODEL_DELETE), requireDataModelPermission(EAction.DELETE, 'data_model_id'),
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
}, validateJWT, validate([body('data_source_id').notEmpty().trim().escape().toInt(), body('data_model_id').notEmpty().trim().escape().toInt(), body('query').notEmpty().trim(), body('query_json').notEmpty().trim(), body('data_model_name').notEmpty().trim().escape(), body('data_layer').optional().isIn(['raw_data', 'clean_data', 'business_ready'])]), authorize(Permission.DATA_MODEL_EDIT), requireDataModelPermission(EAction.UPDATE, 'data_model_id'),
async (req: Request, res: Response) => {
    const { data_source_id, data_model_id, query, query_json, data_model_name, data_layer } = matchedData(req);
    
    try {
        const response = await DataModelProcessor.getInstance().updateDataModelOnQuery(data_source_id, data_model_id, query, query_json, data_model_name, req.body.tokenDetails, data_layer);
        if (response) {
            res.status(200).send({message: 'The data model has been rebuilt.'}); 
        } else {
            res.status(400).send({message: 'The data model could not be rebuilt.'});
        }
    } catch (error: any) {
        console.error('[ROUTE /update-data-model-on-query] Error:', error?.message || error);
        
        // Check if it's a DataModelOversizedException (blocking condition)
        if (error?.name === 'DataModelOversizedException') {
            return res.status(422).json({
                error: 'DATA_MODEL_OVERSIZED',
                message: error.message,
                modelId: error.modelId,
                modelName: error.modelName,
                rowCount: error.rowCount,
                sourceRowCount: error.sourceRowCount,
                healthStatus: error.healthStatus,
                healthIssues: error.healthIssues,
                threshold: error.threshold,
            });
        }
        
        res.status(400).send({
            message: error?.message || 'The data model could not be rebuilt.',
        });
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
}, validateJWT, optionalOrganizationContext, validate([
    param('data_model_id').notEmpty().toInt(),
    query('page').optional().toInt().default(1),
    query('limit').optional().toInt().default(100),
    query('sort_by').optional().trim(),
    query('sort_order').optional().isIn(['ASC', 'DESC']),
    query('filters').optional().isJSON(),
    query('search').optional().trim()
]), requireDataModelPermission(EAction.READ, 'data_model_id'),
async (req: IOrganizationContextRequest, res: Response) => {
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
    optionalOrganizationContext,
    workspaceContext,
    validate([param('data_model_id').notEmpty().trim().escape().toInt()]),
    requireDataModelPermission(EAction.UPDATE, 'data_model_id'),
    async (req: IWorkspaceContextRequest, res: Response) => {
        try {
            const { data_model_id } = matchedData(req);
            const dataModelId = parseInt(String(data_model_id), 10);
            
            // Only allow updating specific fields (Issue #361: Added data_layer and layer_config)
            const allowedFields = ['auto_refresh_enabled', 'data_layer', 'layer_config'];
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
    optionalOrganizationContext,
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
 * GET /:data_model_id/kpi-classification
 * DM-002: Auto-KPI Column Detection
 * Returns per-column classification (metric, dimension, time) with confidence scores
 * and detected composite KPIs that can be derived from the available columns.
 */
router.get('/:data_model_id/kpi-classification',
    validateJWT,
    optionalOrganizationContext,
    workspaceContext,
    validate([
        param('data_model_id').notEmpty().trim().escape().toInt(),
        query('force_refresh').optional().toBoolean(),
    ]),
    requireDataModelPermission(EAction.READ, 'data_model_id'),
    async (req: IWorkspaceContextRequest, res: Response) => {
        try {
            const { data_model_id } = matchedData(req);
            const dataModelId = parseInt(String(data_model_id), 10);
            const forceRefresh = (req.query.force_refresh as any) === true || (req.query.force_refresh as any) === 'true';

            const result = await DataModelAnalysisService.getInstance().getKPIClassification(
                dataModelId,
                req.body.tokenDetails,
                req.organizationId || null,
                forceRefresh
            );

            res.status(200).send(result);
        } catch (error: any) {
            console.error('[DataModel] Error getting KPI classification:', error);
            if (error.message?.includes('not found')) {
                return res.status(404).send({ message: error.message });
            }
            res.status(500).send({
                message: 'Failed to get KPI classification',
                error: error.message
            });
        }
    }
);

/**
 * PATCH /:data_model_id/model-type
 * Set the model_type for a data model, then re-run and persist health analysis.
 */
router.patch('/:data_model_id/model-type',
    validateJWT,
    optionalOrganizationContext,
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

/**
 * POST /:data_model_id/suggest-optimization
 * Issue #10 — AI-assisted model fix suggestions.
 * Returns up to 3 structured suggestions with plain-English description and
 * revised SELECT SQL. Rate-limited by aiOperationsLimiter.
 */
router.post('/:data_model_id/suggest-optimization',
    validateJWT,
    aiOperationsLimiter,
    validate([param('data_model_id').notEmpty().trim().escape().toInt()]),
    requireDataModelPermission(EAction.READ, 'data_model_id'),
    async (req: Request, res: Response) => {
        try {
            const { data_model_id } = matchedData(req);
            const dataModelId = parseInt(String(data_model_id), 10);

            const result = await DataModelProcessor.getInstance().suggestModelOptimization(dataModelId);
            res.status(200).send(result);
        } catch (error: any) {
            console.error('[DataModel] Error suggesting optimization:', error);
            res.status(500).send({ message: error.message || 'Failed to generate optimization suggestions' });
        }
    }
);

// Issue #361 - Data Model Composition: Get all data models as source tables for the data model builder
router.get('/project/:projectId/data-models-as-tables',
    validateJWT,
    validate([param('projectId').notEmpty().trim().escape().toInt()]),
    async (req: Request, res: Response) => {
        try {
            const { projectId } = matchedData(req);
            const projectIdNum = parseInt(String(projectId), 10);
            
            const tables = await DataModelProcessor.getInstance().getDataModelsAsSourceTables(
                projectIdNum,
                req.body.tokenDetails
            );
            
            res.json({ success: true, tables });
        } catch (error: any) {
            console.error('[DataModel] Error fetching data models as tables:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

// Issue #361 - Data Model Composition: Check staleness of data models built from other data models
router.get('/staleness/:dataModelId',
    validateJWT,
    validate([param('dataModelId').notEmpty().trim().escape().toInt()]),
    async (req: Request, res: Response) => {
        try {
            const { dataModelId } = matchedData(req);
            const dataModelIdNum = parseInt(String(dataModelId), 10);
            
            const result = await DataModelProcessor.getInstance().checkDataModelStaleness(
                dataModelIdNum,
                req.body.tokenDetails
            );
            
            res.json({ success: true, ...result });
        } catch (error: any) {
            console.error('[DataModel] Error checking staleness:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

// Issue #361 - Medallion Architecture: Validate layer assignment for a data model
router.post('/validate-layer',
    validateJWT,
    validate([
        body('dataModelId').notEmpty().withMessage('dataModelId is required').toInt(),
        body('layer').notEmpty().withMessage('layer is required').isIn(['raw_data', 'clean_data', 'business_ready'])
    ]),
    async (req: Request, res: Response) => {
        try {
            const { dataModelId, layer } = matchedData(req);
            const dataModelIdNum = parseInt(String(dataModelId), 10);

            // Fetch the data model directly from database
            const manager = AppDataSource.manager;
            const dataModel = await manager.findOne(DRADataModel, {
                where: { id: dataModelIdNum },
                relations: ['data_source', 'data_source.project', 'organization']
            });
            
            if (!dataModel) {
                return res.status(404).json({ success: false, error: 'Data model not found' });
            }

            // Verify user has access to this data model's organization
            if (req.body.tokenDetails?.organizationId && 
                dataModel.organization_id !== req.body.tokenDetails.organizationId) {
                return res.status(404).json({ success: false, error: 'Data model not found' });
            }

            const { validation, recommendation } = await DataModelProcessor.getInstance().validateDataModelLayer(
                layer,
                JSON.stringify(dataModel.query),
                true // validate=true, will throw on errors
            );

            res.json({ 
                success: true, 
                validation,
                recommendation
            });
        } catch (error: any) {
            console.error('[DataModel] Error validating layer:', error);
            res.status(400).json({ 
                success: false, 
                error: error.message,
                details: error.stack 
            });
        }
    }
);

// Issue #361 - Medallion Architecture: Get layer recommendation for a data model
router.get('/recommend-layer/:dataModelId',
    validateJWT,
    validate([param('dataModelId').notEmpty().trim().escape().toInt()]),
    async (req: Request, res: Response) => {
        try {
            const { dataModelId } = matchedData(req);
            const dataModelIdNum = parseInt(String(dataModelId), 10);

            // Fetch the data model directly from database
            const manager = AppDataSource.manager;
            const dataModel = await manager.findOne(DRADataModel, {
                where: { id: dataModelIdNum },
                relations: ['data_source', 'data_source.project', 'organization']
            });
            
            if (!dataModel) {
                return res.status(404).json({ success: false, error: 'Data model not found' });
            }

            // Verify user has access to this data model's organization
            if (req.body.tokenDetails?.organizationId && 
                dataModel.organization_id !== req.body.tokenDetails.organizationId) {
                return res.status(404).json({ success: false, error: 'Data model not found' });
            }

            const { recommendation } = await DataModelProcessor.getInstance().validateDataModelLayer(
                null, // no layer specified, just get recommendation
                JSON.stringify(dataModel.query),
                false // validate=false
            );

            res.json({ 
                success: true, 
                recommendation
            });
        } catch (error: any) {
            console.error('[DataModel] Error recommending layer:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

// Issue #361 - Medallion Architecture Phase 4: Get unclassified models with layer recommendations
router.get('/project/:projectId/layer-migration',
    validateJWT,
    optionalOrganizationContext,
    validate([param('projectId').notEmpty().trim().escape().toInt()]),
    requireProjectPermission(EAction.READ, 'projectId'),
    async (req: IOrganizationContextRequest, res: Response) => {
        try {
            const { projectId } = matchedData(req);
            const projectIdNum = parseInt(String(projectId), 10);
            const userId = req.body.tokenDetails.user_id;
            const organizationId = req.organizationId || null;

            const candidates = await DataModelProcessor.getInstance().getLayerMigrationCandidates(
                projectIdNum,
                userId,
                organizationId
            );

            res.json({ 
                success: true, 
                count: candidates.length,
                candidates
            });
        } catch (error: any) {
            console.error('[DataModel] Error getting layer migration candidates:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

// Issue #361 - Medallion Architecture Phase 4: Bulk assign layers to multiple models
router.post('/bulk-assign-layers',
    validateJWT,
    validate([
        body('assignments').isArray().withMessage('assignments must be an array'),
        body('assignments.*.dataModelId').notEmpty().isInt().withMessage('dataModelId must be an integer'),
        body('assignments.*.layer').notEmpty().isIn(['raw_data', 'clean_data', 'business_ready']).withMessage('layer must be raw_data, clean_data, or business_ready')
    ]),
    async (req: Request, res: Response) => {
        try {
            const { assignments } = matchedData(req);
            const userId = req.body.tokenDetails.user_id;

            // Verify user has permission to update each data model (checked in processor)
            const result = await DataModelProcessor.getInstance().bulkAssignLayers(
                assignments,
                userId
            );

            res.json({ 
                success: true,
                ...result
            });
        } catch (error: any) {
            console.error('[DataModel] Error bulk assigning layers:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

// Issue #361 - Medallion Architecture Phase 5: Get layer recommendation for composition
router.post('/composition-layer-recommendation',
    validateJWT,
    validate([
        body('sourceDataModelIds').isArray().withMessage('sourceDataModelIds must be an array'),
        body('sourceDataModelIds.*').isInt().withMessage('Each sourceDataModelId must be an integer')
    ]),
    async (req: Request, res: Response) => {
        try {
            const { sourceDataModelIds } = matchedData(req);
            const userId = req.body.tokenDetails.user_id;

            if (sourceDataModelIds.length === 0) {
                return res.status(400).json({ success: false, error: 'At least one source model is required' });
            }

            const recommendation = await DataModelProcessor.getInstance().getCompositionLayerRecommendation(
                sourceDataModelIds,
                userId
            );

            res.json({ 
                success: true, 
                ...recommendation
            });
        } catch (error: any) {
            console.error('[DataModel] Error getting composition recommendation:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

/**
 * POST /data-model/auto-create
 * 
 * Auto Data Model Creation Service
 * 
 * Automatically detects schema and creates data models for a data source.
 * For each table, creates a base SELECT * data model (raw_data layer).
 * For marketing/API sources, also creates derived metric data models
 * (business_ready layer) based on MarketingKPIMatcher templates.
 * 
 * Body params:
 *   - data_source_id (required): ID of the data source to create models for
 *   - schema_name (optional): Override schema name for detection
 *   - table_names (optional): Array of specific table names to process
 *   - skip_existing (optional, default true): Skip tables that already have data models
 */
router.post('/auto-create',
    validateJWT,
    authorize(Permission.DATA_MODEL_CREATE),
    optionalOrganizationContext,
    workspaceContext,
    validate([
        body('data_source_id').notEmpty().isInt().withMessage('data_source_id is required and must be an integer'),
        body('schema_name').optional().isString().trim(),
        body('table_names').optional().isArray().withMessage('table_names must be an array of strings'),
        body('table_names.*').optional().isString().trim(),
        body('skip_existing').optional().isBoolean().withMessage('skip_existing must be a boolean'),
    ]),
    async (req: IOrganizationContextRequest & IWorkspaceContextRequest, res: Response) => {
        try {
            const { data_source_id, schema_name, table_names, skip_existing } = matchedData(req);
            const userId = req.body.tokenDetails.user_id;

            // Get users_platform_id from the data source
            const { DRADataSource } = await import('../models/DRADataSource.js');
            const dataSource = await AppDataSource.manager.findOne(DRADataSource, {
                where: { id: data_source_id },
                relations: ['users_platform'],
            });

            if (!dataSource) {
                return res.status(404).json({
                    success: false,
                    message: 'Data source not found',
                });
            }

            // Authorization: verify user owns the data source or belongs to the same org
            if (dataSource.users_platform?.id !== userId) {
                // Additional org check could go here if needed
                console.warn(`[DataModel] User ${userId} attempting auto-create on data source ${data_source_id} owned by user ${dataSource.users_platform?.id}`);
            }

            const { AutoDataModelService } = await import('../services/AutoDataModelService.js');
            const autoService = AutoDataModelService.getInstance();

            const result = await autoService.autoCreate({
                data_source_id: data_source_id as number,
                schema_name: schema_name as string | undefined,
                table_names: table_names as string[] | undefined,
                skip_existing: skip_existing !== undefined ? skip_existing as boolean : true,
                users_platform_id: userId,
                organization_id: (req as any).organizationId || undefined,
                workspace_id: (req as any).workspaceId || undefined,
            });

            res.status(201).json({
                success: true,
                message: `Auto-created ${result.summary.total_models_created} data models`,
                data: result,
            });
        } catch (error: any) {
            console.error('[DataModel] Auto-create error:', error);
            res.status(500).json({
                success: false,
                message: 'Auto data model creation failed',
                error: error.message,
            });
        }
    }
);

/**
 * POST /data-model/detect-and-create
 * 
 * convenience endpoint: Detect schema first, then auto-create data models.
 * Combines schema detection with auto-creation in a single call.
 * 
 * Body params:
 *   - data_source_id (required): ID of the data source
 *   - schema_name (optional): Override schema name for detection
 *   - table_names (optional): Array of specific table names to process
 *   - skip_existing (optional, default true): Skip tables with existing data models
 *   - detect_only (optional, default false): Only detect schema, don't create models
 */
router.post('/detect-and-create',
    validateJWT,
    authorize(Permission.DATA_MODEL_CREATE),
    optionalOrganizationContext,
    workspaceContext,
    validate([
        body('data_source_id').notEmpty().isInt().withMessage('data_source_id is required and must be an integer'),
        body('schema_name').optional().isString().trim(),
        body('table_names').optional().isArray(),
        body('table_names.*').optional().isString().trim(),
        body('skip_existing').optional().isBoolean(),
        body('detect_only').optional().isBoolean(),
    ]),
    async (req: IOrganizationContextRequest & IWorkspaceContextRequest, res: Response) => {
        try {
            const { data_source_id, schema_name, table_names, skip_existing, detect_only } = matchedData(req);
            const userId = req.body.tokenDetails.user_id;

            const { DRADataSource } = await import('../models/DRADataSource.js');
            const dataSource = await AppDataSource.manager.findOne(DRADataSource, {
                where: { id: data_source_id },
                relations: ['users_platform'],
            });

            if (!dataSource) {
                return res.status(404).json({
                    success: false,
                    message: 'Data source not found',
                });
            }

            const { AutoDataModelService } = await import('../services/AutoDataModelService.js');
            const autoService = AutoDataModelService.getInstance();

            // If detect_only, just return the detection result without creating models
            if (detect_only) {
                const { SchemaAutoDetectionService } = await import('../services/SchemaAutoDetectionService.js');
                const detectionService = SchemaAutoDetectionService.getInstance();
                const detectionResult = await detectionService.detect({
                    source_type: dataSource.data_type,
                    data_source_id: data_source_id as number,
                    schema_name: schema_name as string | undefined,
                    include_row_estimates: true,
                });

                return res.status(200).json({
                    success: true,
                    detect_only: true,
                    message: `Detected ${detectionResult.tables.length} tables`,
                    data: {
                        detection_result: detectionResult,
                        tables_count: detectionResult.tables.length,
                        has_kpi_columns: detectionResult.summary.total_kpi_columns > 0,
                    },
                });
            }

            // Full auto-create
            const result = await autoService.autoCreate({
                data_source_id: data_source_id as number,
                schema_name: schema_name as string | undefined,
                table_names: table_names as string[] | undefined,
                skip_existing: skip_existing !== undefined ? skip_existing as boolean : true,
                users_platform_id: userId,
                organization_id: (req as any).organizationId || undefined,
                workspace_id: (req as any).workspaceId || undefined,
            });

            res.status(201).json({
                success: true,
                message: `Detected ${result.summary.tables_detected} tables and auto-created ${result.summary.total_models_created} data models`,
                data: result,
            });
        } catch (error: any) {
            console.error('[DataModel] Detect-and-create error:', error);
            res.status(500).json({
                success: false,
                message: 'Detect and create failed',
                error: error.message,
            });
        }
    }
);

/**
 * POST /data-model/auto-create-batch
 * 
 * Multi-source batch auto data model creation.
 * Creates data models for multiple data sources in a single call
 * and generates cross-source join suggestions.
 * 
 * Body params:
 *   - data_sources (required): Array of { data_source_id, schema_name?, table_names? }
 *   - skip_existing (optional, default true): Skip tables that already have auto-created data models
 */
router.post('/auto-create-batch',
    validateJWT,
    authorize(Permission.DATA_MODEL_CREATE),
    optionalOrganizationContext,
    workspaceContext,
    validate([
        body('data_sources').isArray({ min: 1 }).withMessage('data_sources must be a non-empty array'),
        body('data_sources.*.data_source_id').notEmpty().isInt().withMessage('Each entry must have a data_source_id integer'),
        body('data_sources.*.schema_name').optional().isString().trim(),
        body('data_sources.*.table_names').optional().isArray(),
        body('data_sources.*.table_names.*').optional().isString().trim(),
        body('skip_existing').optional().isBoolean().withMessage('skip_existing must be a boolean'),
    ]),
    async (req: IOrganizationContextRequest & IWorkspaceContextRequest, res: Response) => {
        try {
            const { data_sources, skip_existing } = matchedData(req);
            const userId = req.body.tokenDetails.user_id;

            const { AutoDataModelService } = await import('../services/AutoDataModelService.js');
            const autoService = AutoDataModelService.getInstance();

            const result = await autoService.autoCreateBatch({
                data_sources: data_sources as Array<{ data_source_id: number; schema_name?: string; table_names?: string[] }>,
                skip_existing: skip_existing !== undefined ? skip_existing as boolean : true,
                users_platform_id: userId,
                organization_id: (req as any).organizationId || undefined,
                workspace_id: (req as any).workspaceId || undefined,
            });

            res.status(201).json({
                success: true,
                message: `Batch auto-created ${result.summary.total_models_created} data models across ${result.summary.total_data_sources} data sources`,
                data: result,
            });
        } catch (error: any) {
            console.error('[DataModel] Batch auto-create error:', error);
            res.status(500).json({
                success: false,
                message: 'Batch auto data model creation failed',
                error: error.message,
            });
        }
    }
);

// ── DM-003: Data Model Statistical Analysis ──────────────────────────
// POST /:data_model_id/analyze
// Computes full statistical analysis: summary stats, correlations, anomalies, and trends.
router.post('/:data_model_id/analyze',
    validateJWT,
    optionalOrganizationContext,
    validate([param('data_model_id').notEmpty().trim().escape().toInt()]),
    requireDataModelPermission(EAction.READ, 'data_model_id'),
    async (req: IOrganizationContextRequest, res: Response) => {
        try {
            const { data_model_id } = matchedData(req);
            const dataModelId = parseInt(String(data_model_id), 10);
            const organizationId = req.organizationId || null;
            const forceRefresh = req.query.force_refresh === 'true';

            const analysisService = DataModelAnalysisService.getInstance();
            const analysis = await analysisService.analyzeModel(
                dataModelId,
                req.body.tokenDetails,
                organizationId,
                forceRefresh
            );

            return res.status(200).json({
                success: true,
                message: analysis.from_cache
                    ? 'Analysis retrieved from cache'
                    : 'Statistical analysis completed successfully',
                data: analysis,
            });
        } catch (error: any) {
            console.error('[DataModel] Analyze model error:', error);
            const statusCode = error.message?.includes('not found') ? 404 : 500;
            return res.status(statusCode).json({
                success: false,
                message: error.message || 'Failed to perform statistical analysis',
            });
        }
    }
);

// ── DM-001: Data Model Summary Statistics ─────────────────────────────
// POST /:data_model_id/compute-summary
// Computes or retrieves cached per-column summary statistics for a data model.
router.post('/:data_model_id/compute-summary',
    validateJWT,
    optionalOrganizationContext,
    validate([param('data_model_id').notEmpty().trim().escape().toInt()]),
    requireDataModelPermission(EAction.READ, 'data_model_id'),
    async (req: IOrganizationContextRequest, res: Response) => {
        try {
            const { data_model_id } = matchedData(req);
            const dataModelId = parseInt(String(data_model_id), 10);
            const organizationId = req.organizationId || null;
            const forceRefresh = req.query.force_refresh === 'true';

            const analysisService = DataModelAnalysisService.getInstance();
            const summary = await analysisService.computeSummary(
                dataModelId,
                req.body.tokenDetails,
                organizationId,
                forceRefresh
            );

            return res.status(200).json({
                success: true,
                message: summary.from_cache
                    ? 'Summary retrieved from cache'
                    : 'Summary computed successfully',
                data: summary,
            });
        } catch (error: any) {
            console.error('[DataModel] Compute summary error:', error);
            const statusCode = error.message?.includes('not found') ? 404 : 500;
            return res.status(statusCode).json({
                success: false,
                message: error.message || 'Failed to compute summary statistics',
            });
        }
    }
);

// GET /:data_model_id/summary
// Retrieves cached summary statistics for a data model (no computation).
router.get('/:data_model_id/summary',
    validateJWT,
    optionalOrganizationContext,
    validate([param('data_model_id').notEmpty().trim().escape().toInt()]),
    requireDataModelPermission(EAction.READ, 'data_model_id'),
    async (req: IOrganizationContextRequest, res: Response) => {
        try {
            const { data_model_id } = matchedData(req);
            const dataModelId = parseInt(String(data_model_id), 10);

            const analysisService = DataModelAnalysisService.getInstance();
            const cached = await analysisService.getCachedSummary(dataModelId);

            if (!cached) {
                return res.status(404).json({
                    success: false,
                    message: 'No cached summary found. Use POST /compute-summary to generate one.',
                });
            }

            return res.status(200).json({
                success: true,
                data: cached,
            });
        } catch (error: any) {
            console.error('[DataModel] Get summary error:', error);
            return res.status(500).json({
                success: false,
                message: error.message || 'Failed to retrieve summary statistics',
            });
        }
    }
);

// POST /:data_model_id/refresh-summary
// Forces recomputation of summary statistics (ignores cache).
router.post('/:data_model_id/refresh-summary',
    validateJWT,
    optionalOrganizationContext,
    validate([param('data_model_id').notEmpty().trim().escape().toInt()]),
    requireDataModelPermission(EAction.READ, 'data_model_id'),
    async (req: IOrganizationContextRequest, res: Response) => {
        try {
            const { data_model_id } = matchedData(req);
            const dataModelId = parseInt(String(data_model_id), 10);
            const organizationId = req.organizationId || null;

            const analysisService = DataModelAnalysisService.getInstance();
            const summary = await analysisService.computeSummary(
                dataModelId,
                req.body.tokenDetails,
                organizationId,
                true // force refresh
            );

            return res.status(200).json({
                success: true,
                message: 'Summary recomputed successfully',
                data: summary,
            });
        } catch (error: any) {
            console.error('[DataModel] Refresh summary error:', error);
            const statusCode = error.message?.includes('not found') ? 404 : 500;
            return res.status(statusCode).json({
                success: false,
                message: error.message || 'Failed to refresh summary statistics',
            });
        }
    }
);

export default router;
