import express, { Request, Response } from 'express';
import { validateJWT } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validator.js';
import { body, matchedData, param } from 'express-validator';
import { UserManagementProcessor } from '../../processors/UserManagementProcessor.js';
import { EUserType } from '../../types/EUserType.js';
import { validatePasswordStrength } from '../../middleware/validator.js';
const router = express.Router();

// Create new user
router.post('/', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([
    body('first_name').notEmpty().trim().isLength({ min: 1 }).withMessage('First name is required'),
    body('last_name').notEmpty().trim().isLength({ min: 1 }).withMessage('Last name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
    body('user_type').optional().isIn(['admin', 'normal']).withMessage('User type must be admin or normal')
]), validatePasswordStrength, async (req: Request, res: Response) => {
    const { first_name, last_name, email, password, user_type } = matchedData(req);
    
    const userData = {
        first_name,
        last_name,
        email,
        password,
        user_type: user_type === 'admin' ? EUserType.ADMIN : EUserType.NORMAL
    };

    const result = await UserManagementProcessor.getInstance().createUser(userData, req.body.tokenDetails);
    if (result) {
        res.status(201).send({ 
            message: 'User created successfully',
            user: result
        });
    } else {
        res.status(400).send({ message: 'Failed to create user. Email may already exist.' });
    }
});

// List all users
router.get('/list', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, async (req: Request, res: Response) => {
    const users = await UserManagementProcessor.getInstance().getUsers(req.body.tokenDetails);
    if (users) {
        res.status(200).send(users);
    } else {
        res.status(400).send([]);
    }
});

// Get user by ID
router.get('/:user_id', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([param('user_id').notEmpty().trim().toInt()]), async (req: Request, res: Response) => {
    const { user_id } = matchedData(req);
    const user = await UserManagementProcessor.getInstance().getUserById(user_id, req.body.tokenDetails);
    if (user) {
        res.status(200).send(user);
    } else {
        res.status(404).send({ message: 'User not found' });
    }
});

// Update user
router.put('/:user_id', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([
    param('user_id').notEmpty().trim().toInt(),
    body('first_name').optional().trim().isLength({ min: 1 }),
    body('last_name').optional().trim().isLength({ min: 1 }),
    body('email').optional().isEmail().normalizeEmail(),
    body('user_type').optional().isIn(['admin', 'normal'])
]), async (req: Request, res: Response) => {
    const { user_id, first_name, last_name, email, user_type } = matchedData(req);
    
    const userData: any = {};
    if (first_name) userData.first_name = first_name;
    if (last_name) userData.last_name = last_name;
    if (email) userData.email = email;
    if (user_type) userData.user_type = user_type === 'admin' ? EUserType.ADMIN : EUserType.NORMAL;

    const result = await UserManagementProcessor.getInstance().updateUser(user_id, userData, req.body.tokenDetails);
    if (result) {
        res.status(200).send({ message: 'User updated successfully' });
    } else {
        res.status(400).send({ message: 'Failed to update user' });
    }
});

// Change user type
router.post('/:user_id/change-type', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([
    param('user_id').notEmpty().trim().toInt(),
    body('user_type').notEmpty().isIn(['admin', 'normal'])
]), async (req: Request, res: Response) => {
    const { user_id, user_type } = matchedData(req);
    const userType = user_type === 'admin' ? EUserType.ADMIN : EUserType.NORMAL;
    
    const result = await UserManagementProcessor.getInstance().changeUserType(user_id, userType, req.body.tokenDetails);
    if (result) {
        res.status(200).send({ message: 'User type changed successfully' });
    } else {
        res.status(400).send({ message: 'Failed to change user type' });
    }
});

// Toggle email verification status
router.post('/:user_id/toggle-email-verification', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([param('user_id').notEmpty().trim().toInt()]), async (req: Request, res: Response) => {
    const { user_id } = matchedData(req);
    
    const result = await UserManagementProcessor.getInstance().toggleEmailVerificationStatus(user_id, req.body.tokenDetails);
    if (result) {
        res.status(200).send({ message: 'Email verification status toggled successfully' });
    } else {
        res.status(400).send({ message: 'Failed to toggle email verification status' });
    }
});

// Delete user
router.delete('/:user_id', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([param('user_id').notEmpty().trim().toInt()]), async (req: Request, res: Response) => {
    const { user_id } = matchedData(req);
    
    const result = await UserManagementProcessor.getInstance().deleteUser(user_id, req.body.tokenDetails);
    if (result) {
        res.status(200).send({ message: 'User deleted successfully' });
    } else {
        res.status(400).send({ message: 'Failed to delete user' });
    }
});

export default router;