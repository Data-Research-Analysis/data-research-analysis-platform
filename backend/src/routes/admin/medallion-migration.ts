import { Router, Request, Response } from 'express';
import { validateJWT } from '../../middleware/authenticate.js';
import { EUserType } from '../../types/EUserType.js';
import { AppDataSource } from '../../datasources/PostgresDS.js';
import { DRADataModel } from '../../models/DRADataModel.js';
import { DataModelLayerService } from '../../services/DataModelLayerService.js';
import { EDataLayer } from '../../types/IDataLayer.js';
import { validate } from '../../middleware/validator.js';
import { body, matchedData } from 'express-validator';

const router = Router();

// Middleware to check if user is admin
async function requireAdmin(req: any, res: any, next: any) {
    const tokenDetails = req.tokenDetails || req.body.tokenDetails;
    if (!tokenDetails || tokenDetails.user_type !== EUserType.ADMIN) {
        return res.status(403).send({ message: 'Admin access required' });
    }
    next();
}

/**
 * GET /admin/medallion-migration/candidates
 * Get all data models that need layer classification (null data_layer)
 */
router.get('/candidates', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const manager = AppDataSource.manager;
        
        // Get all models with null data_layer across all organizations
        const unclassifiedModels = await manager
            .createQueryBuilder(DRADataModel, 'dm')
            .leftJoinAndSelect('dm.data_source', 'ds')
            .leftJoinAndSelect('ds.project', 'project')
            .leftJoinAndSelect('dm.users_platform', 'user')
            .where('dm.data_layer IS NULL')
            .orderBy('dm.created_at', 'DESC')
            .getMany();
        
        // Analyze each model to suggest classification
        const layerService = DataModelLayerService.getInstance();
        const candidates = unclassifiedModels.map(model => {
            let suggestedLayer: EDataLayer = EDataLayer.RAW_DATA;
            let reasoning = 'Default classification';
            
            try {
                const queryJSON = model.query ? (typeof model.query === 'string' ? JSON.parse(model.query) : model.query) : null;
                
                if (queryJSON) {
                    // Check for Business Ready indicators (aggregations)
                    const businessValidation = layerService.validateLayerRequirements(EDataLayer.BUSINESS_READY, queryJSON);
                    if (businessValidation.valid) {
                        suggestedLayer = EDataLayer.BUSINESS_READY;
                        reasoning = 'Has aggregation or joins';
                    } else {
                        // Check for Clean Data indicators (transformations/filtering)
                        const cleanValidation = layerService.validateLayerRequirements(EDataLayer.CLEAN_DATA, queryJSON);
                        if (cleanValidation.valid) {
                            suggestedLayer = EDataLayer.CLEAN_DATA;
                            reasoning = 'Has transformations or filtering';
                        } else {
                            suggestedLayer = EDataLayer.RAW_DATA;
                            reasoning = 'No aggregations or transformations detected';
                        }
                    }
                }
            } catch (error) {
                console.warn(`[MedallionMigration] Failed to analyze model ${model.id}:`, error);
            }
            
            return {
                id: model.id,
                name: model.name,
                project_id: model.data_source?.project?.id,
                project_name: model.data_source?.project?.name,
                created_at: model.created_at,
                row_count: model.row_count,
                health_status: model.health_status,
                suggested_layer: suggestedLayer,
                reasoning
            };
        });
        
        return res.status(200).json({
            success: true,
            total: candidates.length,
            candidates
        });
        
    } catch (error: any) {
        console.error('[MedallionMigrationRoutes] Error fetching candidates:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch migration candidates'
        });
    }
});

/**
 * GET /admin/medallion-migration/stats
 * Get overall statistics about layer distribution
 */
router.get('/stats', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const manager = AppDataSource.manager;
        
        const [
            totalCount,
            rawCount,
            cleanCount,
            businessCount,
            unclassifiedCount
        ] = await Promise.all([
            manager.count(DRADataModel),
            manager.count(DRADataModel, { where: { data_layer: EDataLayer.RAW_DATA } }),
            manager.count(DRADataModel, { where: { data_layer: EDataLayer.CLEAN_DATA } }),
            manager.count(DRADataModel, { where: { data_layer: EDataLayer.BUSINESS_READY } }),
            manager.createQueryBuilder(DRADataModel, 'dm')
                .where('dm.data_layer IS NULL')
                .getCount()
        ]);
        
        return res.status(200).json({
            success: true,
            stats: {
                total: totalCount,
                raw_data: {
                    count: rawCount,
                    percentage: totalCount > 0 ? Math.round((rawCount / totalCount) * 100) : 0
                },
                clean_data: {
                    count: cleanCount,
                    percentage: totalCount > 0 ? Math.round((cleanCount / totalCount) * 100) : 0
                },
                business_ready: {
                    count: businessCount,
                    percentage: totalCount > 0 ? Math.round((businessCount / totalCount) * 100) : 0
                },
                unclassified: {
                    count: unclassifiedCount,
                    percentage: totalCount > 0 ? Math.round((unclassifiedCount / totalCount) * 100) : 0
                }
            }
        });
        
    } catch (error: any) {
        console.error('[MedallionMigrationRoutes] Error fetching stats:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch statistics'
        });
    }
});

/**
 * POST /admin/medallion-migration/bulk-classify
 * Bulk classify models using smart classification or manual layer assignment
 */
router.post('/bulk-classify', validateJWT, requireAdmin, validate([
    body('model_ids').isArray({ min: 1 }).withMessage('model_ids must be a non-empty array'),
    body('model_ids.*').isInt({ min: 1 }).withMessage('Each model_id must be a positive integer'),
    body('strategy').isIn(['smart', 'manual']).withMessage('strategy must be "smart" or "manual"'),
    body('manual_layer').optional().isIn(['raw_data', 'clean_data', 'business_ready'])
]), async (req: Request, res: Response) => {
    const { model_ids, strategy, manual_layer } = matchedData(req);
    
    try {
        const manager = AppDataSource.manager;
        const layerService = DataModelLayerService.getInstance();
        
        const results = {
            success: [] as number[],
            failed: [] as { id: number; error: string }[]
        };
        
        for (const modelId of model_ids) {
            try {
                const model = await manager.findOne(DRADataModel, { where: { id: modelId } });
                
                if (!model) {
                    results.failed.push({ id: modelId, error: 'Model not found' });
                    continue;
                }
                
                let targetLayer: EDataLayer;
                
                if (strategy === 'manual' && manual_layer) {
                    targetLayer = manual_layer as EDataLayer;
                } else {
                    // Smart classification
                    const queryJSON = model.query ? (typeof model.query === 'string' ? JSON.parse(model.query) : model.query) : null;
                    
                    if (!queryJSON) {
                        targetLayer = EDataLayer.RAW_DATA;
                    } else {
                        // Check Business Ready first (most specific)
                        const businessValidation = layerService.validateLayerRequirements(EDataLayer.BUSINESS_READY, queryJSON);
                        if (businessValidation.valid) {
                            targetLayer = EDataLayer.BUSINESS_READY;
                        } else {
                            // Then check Clean Data
                            const cleanValidation = layerService.validateLayerRequirements(EDataLayer.CLEAN_DATA, queryJSON);
                            if (cleanValidation.valid) {
                                targetLayer = EDataLayer.CLEAN_DATA;
                            } else {
                                targetLayer = EDataLayer.RAW_DATA;
                            }
                        }
                    }
                }
                
                // Update the model
                model.data_layer = targetLayer;
                await manager.save(model);
                
                results.success.push(modelId);
                
            } catch (error: any) {
                console.error(`[MedallionMigration] Failed to classify model ${modelId}:`, error);
                results.failed.push({ id: modelId, error: error.message || 'Classification failed' });
            }
        }
        
        return res.status(200).json({
            success: true,
            message: `Classified ${results.success.length} models successfully`,
            results: {
                successCount: results.success.length,
                failedCount: results.failed.length,
                success: results.success,
                failed: results.failed
            }
        });
        
    } catch (error: any) {
        console.error('[MedallionMigrationRoutes] Error in bulk classification:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Bulk classification failed'
        });
    }
});

/**
 * POST /admin/medallion-migration/set-all-raw
 * Convenience endpoint to set all unclassified models to raw_data
 */
router.post('/set-all-raw', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const manager = AppDataSource.manager;
        
        const result = await manager
            .createQueryBuilder()
            .update(DRADataModel)
            .set({ data_layer: EDataLayer.RAW_DATA })
            .where('data_layer IS NULL')
            .execute();
        
        return res.status(200).json({
            success: true,
            message: `Set ${result.affected || 0} models to Raw Data layer`,
            count: result.affected || 0
        });
        
    } catch (error: any) {
        console.error('[MedallionMigrationRoutes] Error setting all to raw:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to set all models to raw data'
        });
    }
});

export default router;
