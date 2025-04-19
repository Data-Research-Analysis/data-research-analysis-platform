import express, { Express, Request, Response } from 'express';
import { validateJWT } from '../middleware/authenticate';
import { validate } from '../middleware/validator';
import { body, param, matchedData } from 'express-validator';
import { ProjectProcessor } from '../processors/ProjectProcessor';
import { DataSourceProcessor } from '../processors/DataSourceProcessor';
const router = express.Router();

/**
 * This route is used to add a project
 */
router.post('/add', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([body('project_name').notEmpty().trim().escape(),]),
async (req: Request, res: Response) => {
    const { project_name } = matchedData(req);
    const response: boolean = await ProjectProcessor.getInstance().addProject(project_name, req.body.tokenDetails);
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

router.delete('/delete/:project_id', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([param('project_id').notEmpty().trim().toInt().escape().toInt()]), async (req: Request, res: Response) => {
    const { project_id } = matchedData(req);
    //delete all of the data sources contained in the project
    await DataSourceProcessor.getInstance().deleteDataSourcesForProject(project_id, req.body.tokenDetails);
    //delete the project
    const response: boolean = await ProjectProcessor.getInstance().deleteProject(project_id, req.body.tokenDetails);
    if (response) {
        res.status(200).send({message: 'The project has been deleted.'});
    } else {
        res.status(400).send({message: 'The project could not be deleted.'});
    }
});

export default router;