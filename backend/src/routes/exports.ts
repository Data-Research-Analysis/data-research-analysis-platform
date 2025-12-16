import express, { Request, Response } from 'express';
import { ExportService, ExportFormat, ExportOptions } from '../services/ExportService.js';
import * as fs from 'fs';
import * as path from 'path';

const router = express.Router();
const exportService = ExportService.getInstance();

/**
 * POST /api/exports/create
 * Create a new export
 */
router.post('/create', async (req: Request, res: Response) => {
    try {
        const {
            dataSourceId,
            format,
            reportType,
            networkCode,
            startDate,
            endDate,
            columns,
            limit,
            includeHeaders
        } = req.body;
        
        // Validate required fields
        if (!dataSourceId || !format || !reportType || !networkCode) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: dataSourceId, format, reportType, networkCode'
            });
        }
        
        // Validate format
        if (!Object.values(ExportFormat).includes(format)) {
            return res.status(400).json({
                success: false,
                message: `Invalid format. Must be one of: ${Object.values(ExportFormat).join(', ')}`
            });
        }
        
        // Get user ID and email from session/auth (placeholder - should come from auth middleware)
        const userId = (req as any).user?.id || 1;
        const userEmail = (req as any).user?.email;
        
        const options: ExportOptions = {
            format,
            reportType,
            networkCode,
            startDate,
            endDate,
            columns,
            limit,
            includeHeaders
        };
        
        const result = await exportService.exportData(dataSourceId, options, userId, userEmail);
        
        if (result.success) {
            return res.status(200).json({
                success: true,
                message: 'Export created successfully',
                data: result
            });
        } else {
            return res.status(500).json({
                success: false,
                message: result.error || 'Export failed'
            });
        }
    } catch (error: any) {
        console.error('❌ Export creation failed:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Internal server error'
        });
    }
});

/**
 * GET /api/exports/download/:fileName
 * Download an export file
 */
router.get('/download/:fileName', async (req: Request, res: Response) => {
    try {
        const { fileName } = req.params;
        
        // Validate fileName to prevent directory traversal
        if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
            return res.status(400).json({
                success: false,
                message: 'Invalid file name'
            });
        }
        
        const filePath = exportService.getExportFilePath(fileName);
        
        if (!exportService.exportFileExists(fileName)) {
            return res.status(404).json({
                success: false,
                message: 'Export file not found or expired'
            });
        }
        
        // Set appropriate content type based on file extension
        const ext = path.extname(fileName).toLowerCase();
        let contentType = 'application/octet-stream';
        
        switch (ext) {
            case '.csv':
                contentType = 'text/csv';
                break;
            case '.json':
                contentType = 'application/json';
                break;
            case '.xlsx':
                contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                break;
        }
        
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
    } catch (error: any) {
        console.error('❌ Export download failed:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Internal server error'
        });
    }
});

/**
 * GET /api/exports/history/:dataSourceId
 * Get export history for a data source
 */
router.get('/history/:dataSourceId', async (req: Request, res: Response) => {
    try {
        const dataSourceId = parseInt(req.params.dataSourceId);
        const limit = parseInt(req.query.limit as string) || 20;
        
        if (isNaN(dataSourceId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid data source ID'
            });
        }
        
        const history = await exportService.getExportHistory(dataSourceId, limit);
        
        return res.status(200).json({
            success: true,
            data: history
        });
    } catch (error: any) {
        console.error('❌ Failed to get export history:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Internal server error'
        });
    }
});

/**
 * GET /api/exports/columns/:reportType/:networkCode
 * Get available columns for a report type
 */
router.get('/columns/:reportType/:networkCode', async (req: Request, res: Response) => {
    try {
        const { reportType, networkCode } = req.params;
        
        const columns = await exportService.getAvailableColumns(reportType, networkCode);
        
        return res.status(200).json({
            success: true,
            data: columns
        });
    } catch (error: any) {
        console.error('❌ Failed to get available columns:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Internal server error'
        });
    }
});

/**
 * DELETE /api/exports/:fileName
 * Delete an export file
 */
router.delete('/:fileName', async (req: Request, res: Response) => {
    try {
        const { fileName } = req.params;
        
        // Validate fileName
        if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
            return res.status(400).json({
                success: false,
                message: 'Invalid file name'
            });
        }
        
        const deleted = exportService.deleteExportFile(fileName);
        
        if (deleted) {
            return res.status(200).json({
                success: true,
                message: 'Export file deleted successfully'
            });
        } else {
            return res.status(404).json({
                success: false,
                message: 'Export file not found'
            });
        }
    } catch (error: any) {
        console.error('❌ Failed to delete export file:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Internal server error'
        });
    }
});

/**
 * POST /api/exports/cleanup
 * Cleanup expired exports
 */
router.post('/cleanup', async (req: Request, res: Response) => {
    try {
        const deletedCount = await exportService.cleanupExpiredExports();
        
        return res.status(200).json({
            success: true,
            message: `Cleaned up ${deletedCount} expired exports`,
            deletedCount
        });
    } catch (error: any) {
        console.error('❌ Cleanup failed:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Internal server error'
        });
    }
});

export default router;
