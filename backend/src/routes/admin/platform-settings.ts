import { Router, Request, Response } from 'express';
import { PlatformSettingsProcessor } from '../../processors/PlatformSettingsProcessor.js';
import { validateJWT } from '../../middleware/authenticate.js';
import { EUserType } from '../../types/EUserType.js';

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
 * GET /admin/platform-settings
 * Get all platform settings (grouped by category)
 */
router.get('/', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const processor = PlatformSettingsProcessor.getInstance();
        const settings = await processor.getAllSettings();

        // Group by category
        const grouped = settings.reduce((acc, setting) => {
            if (!acc[setting.category]) {
                acc[setting.category] = [];
            }
            acc[setting.category].push({
                key: setting.setting_key,
                value: setting.setting_value,
                type: setting.setting_type,
                description: setting.description,
                isEditable: setting.is_editable,
                updatedAt: setting.updated_at
            });
            return acc;
        }, {} as Record<string, any[]>);

        return res.status(200).json({
            success: true,
            data: grouped
        });

    } catch (error: any) {
        console.error('[PlatformSettingsRoutes] Error fetching settings:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch platform settings'
        });
    }
});

/**
 * GET /api/admin/platform-settings/:key
 * Get a specific setting by key
 */
router.get('/:key', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { key } = req.params;
        
        const processor = PlatformSettingsProcessor.getInstance();
        const setting = await processor.getSettingRecord(key);

        if (!setting) {
            return res.status(404).json({
                success: false,
                message: 'Setting not found'
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                key: setting.setting_key,
                value: setting.setting_value,
                type: setting.setting_type,
                category: setting.category,
                description: setting.description,
                isEditable: setting.is_editable,
                updatedAt: setting.updated_at
            }
        });

    } catch (error: any) {
        console.error('[PlatformSettingsRoutes] Error fetching setting:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch setting'
        });
    }
});

/**
 * PUT /api/admin/platform-settings/:key
 * Update a specific setting
 */
router.put('/:key', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { key } = req.params;
        const { value } = req.body;

        if (value === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Value is required'
            });
        }

        const processor = PlatformSettingsProcessor.getInstance();
        
        // Check if setting exists and is editable
        const existing = await processor.getSettingRecord(key);
        if (!existing) {
            return res.status(404).json({
                success: false,
                message: 'Setting not found'
            });
        }

        if (!existing.is_editable) {
            return res.status(403).json({
                success: false,
                message: 'This setting is not editable'
            });
        }

        // Special handling for data_retention_days
        if (key === 'data_retention_days') {
            const days = parseInt(value, 10);
            if (isNaN(days) || days < 1 || days > 365) {
                return res.status(400).json({
                    success: false,
                    message: 'Data retention period must be between 1 and 365 days'
                });
            }
            await processor.setDataRetentionDays(days);
        } else {
            await processor.setSetting({
                setting_key: key,
                setting_value: String(value)
            });
        }

        const updated = await processor.getSettingRecord(key);

        return res.status(200).json({
            success: true,
            message: 'Setting updated successfully',
            data: {
                key: updated!.setting_key,
                value: updated!.setting_value,
                updatedAt: updated!.updated_at
            }
        });

    } catch (error: any) {
        console.error('[PlatformSettingsRoutes] Error updating setting:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to update setting'
        });
    }
});

/**
 * POST /api/admin/platform-settings/initialize
 * Initialize default settings (for setup/recovery)
 */
router.post('/initialize', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const processor = PlatformSettingsProcessor.getInstance();
        await processor.initializeDefaults();

        return res.status(200).json({
            success: true,
            message: 'Default settings initialized successfully'
        });

    } catch (error: any) {
        console.error('[PlatformSettingsRoutes] Error initializing settings:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to initialize settings'
        });
    }
});

export default router;
