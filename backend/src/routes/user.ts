import express, { Express, Request, Response } from 'express';
import { UtilityService } from '../services/UtilityService';
import { UserProcessor } from '../processors/UserProcessor';
import { validateJWT } from '../middleware/authenticate';
import { User } from '../models/User';
import { TokenProcessor } from '../processors/TokenProcessor';
const router = express.Router();
  
router.post('/register', async (req: Request, res: Response) => {
    
});

router.post('/login', async (req: Request, res: Response, next: any) => {
    
});

export default router;