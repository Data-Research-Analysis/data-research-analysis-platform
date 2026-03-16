import express, { Express, Request, Response } from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { validate } from '../middleware/validator.js';
import { body, param, matchedData } from 'express-validator';
import { ProjectProcessor } from '../processors/ProjectProcessor.js';
import { DataSourceProcessor } from '../processors/DataSourceProcessor.js';
import { enforceProjectLimit } from '../middleware/tierEnforcement.js';
import { authorize } from '../middleware/authorize.js';
import { Permission } from '../constants/permissions.js';
import { optionalOrganizationContext, type IOrganizationContextRequest } from '../middleware/organizationContext.js';
const router = express.Router();

/**
 * This route is used to add a project
 */
router.post('/add', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, optionalOrganizationContext, enforceProjectLimit, validate([
    body('project_name').notEmpty().trim().escape(),
    body('description').optional().trim()
]),
async (req: IOrganizationContextRequest, res: Response) => {
    const { project_name, description } = matchedData(req);
    const organizationId = req.organizationId || null;
    const response: boolean = await ProjectProcessor.getInstance().addProject(project_name, description, req.body.tokenDetails, organizationId);
    if (response) {
        res.status(200).send({message: 'The project has been added.'});
    } else {
        res.status(400).send({message: 'The project could not be created.'});
    }
});

router.get('/list', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, optionalOrganizationContext, async (req: IOrganizationContextRequest, res: Response) => {
    const organizationId = req.organizationId || null;
    const projects_list = await ProjectProcessor.getInstance().getProjects(req.body.tokenDetails, organizationId);    
    res.status(200).send(projects_list);
});

router.put('/update/:project_id', validateJWT, optionalOrganizationContext, validate([
    param('project_id').notEmpty().trim().toInt(),
    body('name').optional().trim(),
    body('description').optional().trim()
]), authorize(Permission.PROJECT_EDIT), async (req: IOrganizationContextRequest, res: Response) => {
    const { project_id, name, description } = matchedData(req);
    const updates: { name?: string; description?: string } = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    const organizationId = req.organizationId || null;

    const response = await ProjectProcessor.getInstance().updateProject(
        project_id,
        updates,
        req.body.tokenDetails,
        organizationId
    );

    if (response) {
        res.status(200).send({ message: 'Project updated successfully' });
    } else {
        res.status(400).send({ message: 'Failed to update project' });
    }
});

router.post('/transfer-ownership/:project_id', validateJWT, optionalOrganizationContext, validate([
    param('project_id').notEmpty().trim().toInt(),
    body('new_owner_id').notEmpty().isInt()
]), async (req: IOrganizationContextRequest, res: Response) => {
    const { project_id, new_owner_id } = matchedData(req);
    const { user_id } = req.body.tokenDetails;
    const organizationId = req.organizationId || null;

    const response = await ProjectProcessor.getInstance().transferOwnership(
        project_id,
        new_owner_id,
        user_id,
        organizationId
    );

    if (response) {
        res.status(200).send({ message: 'Ownership transferred successfully' });
    } else {
        res.status(400).send({ message: 'Failed to transfer ownership' });
    }
});

router.delete('/delete/:project_id', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, optionalOrganizationContext, validate([param('project_id').notEmpty().trim().toInt().escape().toInt()]), authorize(Permission.PROJECT_DELETE), async (req: IOrganizationContextRequest, res: Response) => {
    const { project_id } = matchedData(req);
    const organizationId = req.organizationId || null;
    // Delete the project (this now handles ALL cascading deletes internally)
    const response: boolean = await ProjectProcessor.getInstance().deleteProject(project_id, req.body.tokenDetails, organizationId);
    if (response) {
        res.status(200).send({message: 'The project has been deleted.'});
    } else {
        res.status(400).send({message: 'The project could not be deleted.'});
    }
});

export default router;