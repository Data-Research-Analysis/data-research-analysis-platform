import express, { Express, Request, Response } from 'express';
import { AuthProcessor } from '../processors/AuthProcessor.js';
import { validateJWT } from '../middleware/authenticate.js';
import { validate, validatePasswordStrength } from '../middleware/validator.js';
import { body, param, matchedData } from 'express-validator';

const router = express.Router();
  
/**
 * This route is used to register a user
 */
router.post('/register', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([body('email').notEmpty().isEmail().trim().escape(),
    body('first_name').notEmpty().trim().escape(),
    body('last_name').notEmpty().trim().escape(),
    body('password').notEmpty().isLength({ min: 8}).trim().escape()]),
    validatePasswordStrength, async (req: Request, res: Response) => {
    const { first_name, last_name, email, password } = matchedData(req);
    const response: boolean = await AuthProcessor.getInstance().register(first_name, last_name, email, password);
    if (response) {
        res.status(200).send({message: 'User registered successfully. Please check your email inbox and follow the instructions in the email to verify your email address.'});
    } else {
        res.status(400).send({message: 'User already exists for the given email, please provide a new email.'});
    }
});

/**
 * This route is used to login a user
 */
router.post('/login', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([body('email').notEmpty(), body('password').notEmpty()]), async (req: Request, res: Response) => {
    const { email, password } = matchedData(req);
    try {
        const response: any = await AuthProcessor.getInstance().login(email, password);
        console.log('login response', response);
        if (response) {
            console.log('sending response');
            res.status(200).send(response);
        }
        else {
            res.status(400).send({message: 'User not found for the provided email and password.'});
        }
    } catch (error) {
        res.status(400).send({message: 'User not found for the provided email and password.'});
    }
});

/**
 * This route is used to verify the email address of a user
 */
router.get('/verify-email/:code', async (req: Request, res: Response, next: any) => {
    next();
}, validate([param('code').notEmpty()]), async (req: Request, res: Response) => {
    const { code } = matchedData(req);
    const response: boolean = await AuthProcessor.getInstance().verifyEmail(code);
    if (response) {
        res.status(200).send({message: 'Email verified successfully. Please login to continue.'});
    } else {
        res.status(400).send({message: 'Email verification failed. The code has expired. Please try again.'});
    }
});

/**
 * This route is used to unsubscribe a user from the mailing list
 */
router.get('/unsubscribe/:code', async (req: Request, res: Response, next: any) => {
    next();
}, validate([param('code').notEmpty()]), async (req: Request, res: Response) => {
    const { code } = matchedData(req);
    const response: boolean = await AuthProcessor.getInstance().unsubscribe(code);
    if (response) {
        res.status(200).send({message: 'Unsubscribed successfully.'});
    } else {
        res.status(400).send({message: 'Unsubscription failed. Please try again.'});
    }
});

router.get('/resend-code/:code', async (req: Request, res: Response, next: any) => {
    next();
}, validate([param('code').notEmpty()]), async (req: Request, res: Response) => {
    const { code } = matchedData(req);
    const response: boolean = await AuthProcessor.getInstance().resendCode(code);
    if (response) {
        res.status(200).send({message: 'New code sent.'});
    } else {
        res.status(400).send({message: 'New code generation has failed. It is most likely that the provided code is incorrect and a new code can not be sent.'});
    }
});

router.get('/validate-token', async (req: Request, res: Response, next: any) => {
    next();
},validateJWT, async (req: Request, res: Response) => {
    res.status(200).send({message: 'validated token'});
});

/**
 * This route is used to get the current authenticated user's information
 */
router.get('/me', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, async (req: Request, res: Response) => {
    try {
        console.log('req.body:', req.body);
        const userId = req?.body?.tokenDetails?.user_id || null; // Set by validateJWT middleware
        if (!userId) {
            return res.status(401).send({message: 'User not authenticated'});
        }
        
        const user = await AuthProcessor.getInstance().getUserById(userId);
        if (user) {
            res.status(200).send(user);
        } else {
            res.status(404).send({message: 'User not found'});
        }
    } catch (error) {
        res.status(500).send({message: 'Error fetching user information'});
    }
});

/**
 * This route is used to request a password change
 */
router.post('/password-change-request', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([body('email').notEmpty()]), async (req: Request, res: Response) => {
    const { email } = matchedData(req);
    try {
        // Always call the method, which handles security internally
        await AuthProcessor.getInstance().changePasswordRequest(email);
        
        // Always return success to prevent email enumeration attacks
        res.status(200).send({
            message: 'If this email address exists in our system, you will receive a password reset link shortly. Please check your email and spam folder.'
        });
    } catch (error) {
        // Even on error, return success message to prevent information leakage
        res.status(200).send({
            message: 'If this email address exists in our system, you will receive a password reset link shortly. Please check your email and spam folder.'
        });
    }
});

/**
 * This route is used to verify a password change token
 */
router.get('/verify-change-password-token/:code', async (req: Request, res: Response, next: any) => {
    next();
}, validate([param('code').notEmpty()]), async (req: Request, res: Response) => {
    const { code } = matchedData(req);
    try {
        const response: boolean = await AuthProcessor.getInstance().verifyChangePasswordToken(code);
        if (response) {
            res.status(200).send({message: 'Password change token is valid.'});
        } else {
            res.status(400).send({message: 'Password change token verification failed. The token has expired or is invalid.'});
        }
    } catch (error) {
        res.status(400).send({message: 'Password change token verification failed. The token has expired or is invalid.'});
    }
});

/**
 * This route is used to update a user's password with a valid token
 */
router.post('/update-password', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([
    body('code').notEmpty().withMessage('Password change token is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[#?!@$%^&*-])/)
        .withMessage('Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character (#?!@$%^&*-)')
]), async (req: Request, res: Response) => {
    const { code, password } = matchedData(req);
    try {
        const response: boolean = await AuthProcessor.getInstance().updatePassword(code, password);
        if (response) {
            res.status(200).send({message: 'Password updated successfully. You can now login with your new password.'});
        } else {
            res.status(400).send({message: 'Password update failed. The token has expired, is invalid, or the new password is the same as your current password.'});
        }
    } catch (error) {
        res.status(400).send({message: 'Password update failed. The token has expired, is invalid, or the new password is the same as your current password.'});
    }
});

export default router;