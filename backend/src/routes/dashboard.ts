import express, { Request, Response } from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { validate } from '../middleware/validator.js';
import { body, param, matchedData } from 'express-validator';
import { DashboardProcessor } from '../processors/DashboardProcessor.js';
import { enforceDashboardLimit } from '../middleware/tierEnforcement.js';
import { authorize } from '../middleware/authorize.js';
import { Permission } from '../constants/permissions.js';
import { 
    requireProjectPermission, 
    requireDashboardPermission 
} from '../middleware/rbacMiddleware.js';
import { EAction } from '../services/PermissionService.js';
const router = express.Router();

router.get('/list', async (req: Request, res: Response, next: any) => {
    next();
},validateJWT, async (req: Request, res: Response) => {
    const data_sources_list = await DashboardProcessor.getInstance().getDashboards(req.body.tokenDetails);    
    res.status(200).send(data_sources_list);
});
router.post('/add', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, enforceDashboardLimit, validate([body('project_id').notEmpty().toInt(), body('data').notEmpty()]), authorize(Permission.DASHBOARD_CREATE), requireProjectPermission(EAction.CREATE, 'project_id'),
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
}, validateJWT, validate([param('dashboard_id').notEmpty().toInt(), body('project_id').notEmpty().toInt(), body('data').notEmpty()]), authorize(Permission.DASHBOARD_EDIT), requireDashboardPermission(EAction.UPDATE, 'dashboard_id'),
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
}, validateJWT, validate([param('dashboard_id').notEmpty().toInt()]), authorize(Permission.DASHBOARD_DELETE), requireDashboardPermission(EAction.DELETE, 'dashboard_id'),
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
}, validateJWT, validate([param('dashboard_id').notEmpty().trim().escape().toInt()]), authorize(Permission.DASHBOARD_SHARE), requireDashboardPermission(EAction.READ, 'dashboard_id'),
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

router.get('/templates', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, async (req: Request, res: Response) => {
    const templates = await DashboardProcessor.getInstance().getTemplates();
    res.status(200).send(templates);
});

router.post('/clone-template', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, enforceDashboardLimit, validate([
    body('template_id').notEmpty().toInt(),
    body('project_id').notEmpty().toInt(),
]), authorize(Permission.DASHBOARD_CREATE), requireProjectPermission(EAction.CREATE, 'project_id'),
async (req: Request, res: Response) => {
    const { template_id, project_id } = matchedData(req);
    const { user_id } = req.body.tokenDetails;
    const result = await DashboardProcessor.getInstance().cloneDashboard(template_id, project_id, user_id);
    if (result) {
        res.status(200).send({ message: 'Dashboard created from template.', dashboard: result });
    } else {
        res.status(400).send({ message: 'The dashboard could not be cloned from the template.' });
    }
});

export default router;