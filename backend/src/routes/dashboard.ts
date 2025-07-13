import express, { Request, Response } from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { validate } from '../middleware/validator.js';
import { body, param, matchedData } from 'express-validator';
import { DataModelProcessor } from '../processors/DataModelProcessor.js';
import { DashboardProcessor } from '../processors/DashboardProcessor.js';
const router = express.Router();

router.get('/list', async (req: Request, res: Response, next: any) => {
    next();
},validateJWT, async (req: Request, res: Response) => {
    const data_sources_list = await DashboardProcessor.getInstance().getDashboards(req.body.tokenDetails);    
    res.status(200).send(data_sources_list);
});
router.post('/add', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([body('project_id').notEmpty().trim().escape().toInt(), body('data').notEmpty()]),
async (req: Request, res: Response) => {
    const { project_id, data } = matchedData(req);
    const result = await DashboardProcessor.getInstance().addDashboard(project_id, data, req.body.tokenDetails);
    if (result) {
        res.status(200).send({message: 'The dashboard has been added.'});
    } else {
        res.status(400).send({message: 'The dashboard could not be added.'});
    }
});
router.post('/update/:dashboard_id', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([param('dashboard_id').notEmpty().trim().escape().toInt(), body('project_id').notEmpty().trim().escape().toInt(), body('data').notEmpty()]),
async (req: Request, res: Response) => {
    const { dashboard_id, project_id, data } = matchedData(req);
    const result = await DashboardProcessor.getInstance().updateDashboard(dashboard_id, project_id, data, req.body.tokenDetails);
    if (result) {
        res.status(200).send({message: 'The dashboard has been updated.'});
    } else {
        res.status(400).send({message: 'The dashboard could not be updated.'});
    }
});
router.delete('/delete/:dashboard_id', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([param('dashboard_id').notEmpty().trim().escape().toInt()]),
async (req: Request, res: Response) => {
    const { dashboard_id } = matchedData(req);
    const result = await DashboardProcessor.getInstance().deleteDashboard(dashboard_id,  req.body.tokenDetails);            
    if (result) {
        res.status(200).send({message: 'The dashboard has been deleted.'});        
    } else {
        res.status(400).send({message: 'The dashboard could not be deleted.'});
    }
});

export default router;