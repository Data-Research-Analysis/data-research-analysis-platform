import express, { Express, Request, Response } from 'express';
import { UtilityService } from '../services/UtilityService';
import { TokenProcessor } from '../processors/TokenProcessor';
import { validateJWT } from '../middleware/authenticate';
import { User } from '../models/User';
const router = express.Router();




export default router;