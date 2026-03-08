import express, { Express, Request, Response } from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { validate } from '../middleware/validator.js';
import { body, param, matchedData } from 'express-validator';
import { ProjectProcessor } from '../processors/ProjectProcessor.js';
import { DataSourceProcessor } from '../processors/DataSourceProcessor.js';
import { enforceProjectLimit } from '../middleware/tierEnforcement.js';
import { authorize } from '../middleware/authorize.js';
import { Permission } from '../constants/permissions.js';
const router = express.Router();

/**
 * This route is used to add a project
 */
router.post('/add', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, enforceProjectLimit, validate([
    body('project_name').notEmpty().trim().escape(),
    body('description').optional().trim()
]),
async (req: Request, res: Response) => {
    const { project_name, description } = matchedData(req);
    const response: boolean = await ProjectProcessor.getInstance().addProject(project_name, description, req.body.tokenDetails);
    if (response) {
        res.status(200).send({message: 'The project has been added.'});
    } else {
        res.status(400).send({message: 'The project could not be created.'});
    }
});

router.get('/list', async (req: Request, res: Response, next: any) => {
    next();
},validateJWT, async (req: Request, res: Response) => {
    const projects_list = await ProjectProcessor.getInstance().getProjects(req.body.tokenDetails);    
    res.status(200).send(projects_list);
});

router.put('/update/:project_id', validateJWT, validate([
    param('project_id').notEmpty().trim().toInt(),
    body('name').optional().trim(),
    body('description').optional().trim()
]), authorize(Permission.PROJECT_EDIT), async (req: Request, res: Response) => {
    const { project_id, name, description } = matchedData(req);
    const updates: { name?: string; description?: string } = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;

    const response = await ProjectProcessor.getInstance().updateProject(
        project_id,
        updates,
        req.body.tokenDetails
    );

    if (response) {
        res.status(200).send({ message: 'Project updated successfully' });
    } else {
        res.status(400).send({ message: 'Failed to update project' });
    }
});

router.post('/transfer-ownership/:project_id', validateJWT, validate([
    param('project_id').notEmpty().trim().toInt(),
    body('new_owner_id').notEmpty().isInt()
]), async (req: Request, res: Response) => {
    const { project_id, new_owner_id } = matchedData(req);
    const { user_id } = req.body.tokenDetails;

    const response = await ProjectProcessor.getInstance().transferOwnership(
        project_id,
        new_owner_id,
        user_id
    );

    if (response) {
        res.status(200).send({ message: 'Ownership transferred successfully' });
    } else {
        res.status(400).send({ message: 'Failed to transfer ownership' });
    }
});

router.delete('/delete/:project_id', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([param('project_id').notEmpty().trim().toInt().escape().toInt()]), authorize(Permission.PROJECT_DELETE), async (req: Request, res: Response) => {
    const { project_id } = matchedData(req);
    // Delete the project (this now handles ALL cascading deletes internally)
    const response: boolean = await ProjectProcessor.getInstance().deleteProject(project_id, req.body.tokenDetails);
    if (response) {
        res.status(200).send({message: 'The project has been deleted.'});
    } else {
        res.status(400).send({message: 'The project could not be deleted.'});
    }
});

export default router;