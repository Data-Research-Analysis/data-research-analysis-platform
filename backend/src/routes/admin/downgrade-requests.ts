import express, { Request, Response } from 'express';
import { validateJWT } from '../../middleware/authenticate.js';
import { AppDataSource } from '../../datasources/PostgresDS.js';
import { DRADowngradeRequest } from '../../models/DRADowngradeRequest.js';
import { EUserType } from '../../types/EUserType.js';

const router = express.Router();

// Middleware to check if user is admin
async function requireAdmin(req: any, res: any, next: any) {
    const tokenDetails = req.tokenDetails || req.body.tokenDetails;
    if (!tokenDetails || tokenDetails.user_type !== EUserType.ADMIN) {
        return res.status(403).send({ message: 'Admin access required' });
    }
    next();
}

// Get all downgrade requests with filtering
router.get('/list', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { status } = req.query;
        const manager = AppDataSource.manager;
        
        const queryBuilder = manager
            .createQueryBuilder(DRADowngradeRequest, 'request')
            .leftJoinAndSelect('request.user', 'user')
            .leftJoinAndSelect('request.organization', 'organization')
            .orderBy('request.created_at', 'DESC');
        
        // Filter by status if provided
        if (status && status !== 'all') {
            queryBuilder.andWhere('request.status = :status', { status });
        }
        
        const requests = await queryBuilder.getMany();
        
        res.json({
            success: true,
            data: requests
        });
    } catch (error: any) {
        console.error('Error fetching downgrade requests:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Update request status
router.patch('/:id/status', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const manager = AppDataSource.manager;
        
        // Validate status against allowed values
        const allowedStatuses = ['pending', 'contacted', 'approved', 'declined', 'completed'];
        if (status && !allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                error: `Invalid status. Allowed values: ${allowedStatuses.join(', ')}`
            });
        }
        
        const request = await manager.findOne(DRADowngradeRequest, {
            where: { id: parseInt(id) }
        });
        
        if (!request) {
            return res.status(404).json({
                success: false,
                error: 'Request not found'
            });
        }
        
        // Update status
        if (status) {
            request.status = status;
        }
        
        // Set timestamps based on status
        if (status === 'contacted' && !request.contacted_at) {
            request.contacted_at = new Date();
        }
        if (status === 'completed' && !request.completed_at) {
            request.completed_at = new Date();
        }
        
        await manager.save(request);
        
        res.json({
            success: true,
            data: request
        });
    } catch (error: any) {
        console.error('Error updating downgrade request:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Delete request
router.delete('/:id', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const manager = AppDataSource.manager;
        
        const request = await manager.findOne(DRADowngradeRequest, {
            where: { id: parseInt(id) }
        });
        
        if (!request) {
            return res.status(404).json({
                success: false,
                error: 'Request not found'
            });
        }
        
        await manager.remove(request);
        
        res.json({
            success: true,
            message: 'Request deleted successfully'
        });
    } catch (error: any) {
        console.error('Error deleting downgrade request:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;
