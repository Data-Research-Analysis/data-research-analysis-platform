import express, { Express, Request, Response } from 'express';
import { AuthProcessor } from '../processors/AuthProcessor';
import { validateJWT } from '../middleware/authenticate';
import { validate, validatePasswordStrength } from '../middleware/validator';
import { body, matchedData } from 'express-validator';

const router = express.Router();
  
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
        res.status(200).send({message: 'User registered successfully'});
    } else {
        res.status(400).send({message: 'User already exists for the given email, please provide a new email'});
    }
});

router.post('/login', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, async (req: Request, res: Response) => {
    
});

export default router;