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
    const response: any = await AuthProcessor.getInstance().login(email, password);
    if (response) {
        res.status(200).send(response);
    }
    else {
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

export default router;