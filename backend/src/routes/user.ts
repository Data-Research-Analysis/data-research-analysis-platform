import express from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { DBDriver } from '../drivers/DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { DRAUsersPlatform } from '../models/DRAUsersPlatform.js';

const router = express.Router();

/**
 * Look up user by email
 * GET /user/lookup-by-email?email=user@example.com
 * 
 * Returns basic user information (id, email, name) without sensitive data.
 * Used for adding members to projects.
 */
router.get('/lookup-by-email', validateJWT, async (req, res) => {
    try {
        const email = req.query.email as string;
        
        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email parameter required'
            });
        }
        
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        const concreteDriver = await driver.getConcreteDriver();
        if (!concreteDriver) {
            throw new Error('Database driver not available');
        }
        
        const manager = concreteDriver.manager;
        const user = await manager.findOne(DRAUsersPlatform, {
            where: { email: email.toLowerCase() },
            select: ['id', 'email', 'first_name', 'last_name']
        });
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found. Please check the email address.'
            });
        }
        
        // Return limited user info (don't expose sensitive data)
        res.json({
            success: true,
            data: {
                id: user.id,
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name
            }
        });
    } catch (error: any) {
        console.error('Error looking up user:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to lookup user'
        });
    }
});

export default router;
