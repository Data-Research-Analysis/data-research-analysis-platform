import express, { Request, Response } from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { validate } from '../middleware/validator.js';
import { body, param, matchedData } from 'express-validator';
import { DashboardProcessor } from '../processors/DashboardProcessor.js';
import { enforceDashboardLimit } from '../middleware/tierEnforcement.js';
const router = express.Router();

router.get('/list', async (req: Request, res: Response, next: any) => {
    next();
},validateJWT, async (req: Request, res: Response) => {
    const data_sources_list = await DashboardProcessor.getInstance().getDashboards(req.body.tokenDetails);    
    res.status(200).send(data_sources_list);
});
router.post('/add', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, enforceDashboardLimit, validate([body('project_id').notEmpty().trim().escape().toInt(), body('data').notEmpty()]),
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
router.get('/generate-public-export-link/:dashboard_id', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([param('dashboard_id').notEmpty().trim().escape().toInt()]),
async (req: Request, res: Response) => {
    const { dashboard_id } = matchedData(req);
    const key = await DashboardProcessor.getInstance().generatePublicExportLink(dashboard_id,  req.body.tokenDetails);            
    if (key) {
        res.status(200).send({message: 'The public export link has been generated.', key: key});        
    } else {
        res.status(400).send({message: 'The public export link could not be generated.'});
    }
});
router.get('/public-dashboard-link/:dashboard_key', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([param('dashboard_key').notEmpty()]),
async (req: Request, res: Response) => {
    const { dashboard_key } = matchedData(req);
    const dashboard = await DashboardProcessor.getInstance().getPublicDashboard(encodeURIComponent(dashboard_key));
    if (dashboard) {
        res.status(200).send(dashboard);
    } else {
        res.status(400).send({message: 'The public dashboard link could not be retrieved.'});
    }
});

export default router;