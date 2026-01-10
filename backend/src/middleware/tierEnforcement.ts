import { Request, Response, NextFunction } from 'express';
import { TierEnforcementService } from '../services/TierEnforcementService.js';
import { TierLimitError } from '../types/TierLimitError.js';

/**
 * Tier Enforcement Middleware
 * 
 * Enforces subscription tier limits at the API route level.
 * Returns 402 Payment Required with upgrade information when limits are exceeded.
 * Admins bypass all limits automatically.
 */

/**
 * Enforce project creation limit
 * Use: router.post('/projects', authenticate, enforceProjectLimit, handler)
 */
export async function enforceProjectLimit(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const userId = req.body.tokenDetails?.user_id;
        
        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
            return;
        }

        const tierService = TierEnforcementService.getInstance();
        await tierService.canCreateProject(userId);
        
        next();
    } catch (error) {
        if (error instanceof TierLimitError) {
            res.status(402).json({
                success: false,
                ...error.toJSON()
            });
            return;
        }
        
        console.error('[TierEnforcement] Error checking project limit:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to validate tier limits'
        });
    }
}

/**
 * Enforce data source creation limit (per-project)
 * Use: router.post('/data-sources', authenticate, enforceDataSourceLimit, handler)
 * Requires: req.body.project_id or req.body.projectId
 */
export async function enforceDataSourceLimit(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const userId = req.body.tokenDetails?.user_id;
        const projectId = req.body.project_id || req.body.projectId;
        
        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
            return;
        }

        if (!projectId) {
            res.status(400).json({
                success: false,
                message: 'project_id is required'
            });
            return;
        }

        const tierService = TierEnforcementService.getInstance();
        await tierService.canCreateDataSource(userId, parseInt(String(projectId), 10));
        
        next();
    } catch (error) {
        if (error instanceof TierLimitError) {
            res.status(402).json({
                success: false,
                ...error.toJSON()
            });
            return;
        }
        
        console.error('[TierEnforcement] Error checking data source limit:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to validate tier limits'
        });
    }
}

/**
 * Enforce data model creation limit (per-data-source)
 * Use: router.post('/data-models', authenticate, enforceDataModelLimit, handler)
 * Requires: req.body.data_source_id or req.body.dataSourceId (skips check for cross-source models)
 */
export async function enforceDataModelLimit(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const userId = req.body.tokenDetails?.user_id;
        const dataSourceId = req.body.data_source_id || req.body.dataSourceId;
        const isCrossSource = req.body.is_cross_source;
        
        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
            return;
        }

        // Skip check for cross-source models (no single data source)
        if (isCrossSource || !dataSourceId) {
            next();
            return;
        }

        const tierService = TierEnforcementService.getInstance();
        await tierService.canCreateDataModel(userId, parseInt(String(dataSourceId), 10));
        
        next();
    } catch (error) {
        if (error instanceof TierLimitError) {
            res.status(402).json({
                success: false,
                ...error.toJSON()
            });
            return;
        }
        
        console.error('[TierEnforcement] Error checking data model limit:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to validate tier limits'
        });
    }
}

/**
 * Enforce dashboard creation limit
 * Use: router.post('/dashboards', authenticate, enforceDashboardLimit, handler)
 */
export async function enforceDashboardLimit(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const userId = req.body.tokenDetails?.user_id;
        
        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
            return;
        }

        const tierService = TierEnforcementService.getInstance();
        await tierService.canCreateDashboard(userId);
        
        next();
    } catch (error) {
        if (error instanceof TierLimitError) {
            res.status(402).json({
                success: false,
                ...error.toJSON()
            });
            return;
        }
        
        console.error('[TierEnforcement] Error checking dashboard limit:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to validate tier limits'
        });
    }
}

/**
 * Enforce AI generation limit (monthly quota)
 * Use: router.post('/ai-data-modeler/chat', authenticate, enforceAIGenerationLimit, handler)
 * Automatically increments counter on successful validation
 */
export async function enforceAIGenerationLimit(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const userId = req.body.tokenDetails?.user_id;
        
        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
            return;
        }

        const tierService = TierEnforcementService.getInstance();
        
        // Check if user can use AI generation
        await tierService.canUseAIGeneration(userId);
        
        // Increment counter (will be used after successful AI response)
        await tierService.incrementAIGenerationCount(userId);
        
        next();
    } catch (error) {
        if (error instanceof TierLimitError) {
            res.status(402).json({
                success: false,
                ...error.toJSON()
            });
            return;
        }
        
        console.error('[TierEnforcement] Error checking AI generation limit:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to validate tier limits'
        });
    }
}
