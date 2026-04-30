import express, { Request, Response } from 'express';
import { body, matchedData, param, query } from 'express-validator';
import { validateJWT } from '../middleware/authenticate.js';
import { validate } from '../middleware/validator.js';
import { SSOProcessor } from '../processors/SSOProcessor.js';

const router = express.Router();
const processor = SSOProcessor.getInstance();

router.get(
    '/config/:organizationId',
    validateJWT,
    validate([param('organizationId').isInt().withMessage('Organization ID must be an integer')]),
    async (req: Request, res: Response) => {
        try {
            const { organizationId } = matchedData(req);
            const config = await processor.getConfiguration(parseInt(organizationId), req.body.tokenDetails);
            res.status(200).json({ success: true, data: config });
        } catch (error: any) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
);

router.post(
    '/config/:organizationId',
    validateJWT,
    validate([
        param('organizationId').isInt().withMessage('Organization ID must be an integer'),
        body('idp_name').notEmpty().withMessage('IdP name is required'),
        body('idp_entity_id').notEmpty().withMessage('IdP entity ID is required'),
        body('idp_sso_url').isURL().withMessage('IdP SSO URL must be valid'),
        body('idp_certificate').notEmpty().withMessage('IdP certificate is required'),
        body('sp_entity_id').notEmpty().withMessage('SP entity ID is required'),
        body('attribute_mapping').optional().isObject(),
        body('is_enabled').optional().isBoolean(),
        body('allow_jit_provisioning').optional().isBoolean(),
        body('enforce_sso').optional().isBoolean()
    ]),
    async (req: Request, res: Response) => {
        try {
            const data = matchedData(req);
            const organizationId = parseInt(data.organizationId);
            const config = await processor.upsertConfiguration(
                organizationId,
                {
                    idp_name: data.idp_name,
                    idp_entity_id: data.idp_entity_id,
                    idp_sso_url: data.idp_sso_url,
                    idp_certificate: data.idp_certificate,
                    sp_entity_id: data.sp_entity_id,
                    attribute_mapping: data.attribute_mapping,
                    is_enabled: data.is_enabled,
                    allow_jit_provisioning: data.allow_jit_provisioning,
                    enforce_sso: data.enforce_sso
                },
                req.body.tokenDetails
            );

            res.status(200).json({ success: true, data: config });
        } catch (error: any) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
);

router.delete(
    '/config/:organizationId',
    validateJWT,
    validate([param('organizationId').isInt().withMessage('Organization ID must be an integer')]),
    async (req: Request, res: Response) => {
        try {
            const { organizationId } = matchedData(req);
            await processor.removeConfiguration(parseInt(organizationId), req.body.tokenDetails);
            res.status(200).json({ success: true });
        } catch (error: any) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
);

router.post(
    '/domain-verify/:organizationId',
    validateJWT,
    validate([
        param('organizationId').isInt().withMessage('Organization ID must be an integer'),
        body('domain').notEmpty().withMessage('Domain is required')
    ]),
    async (req: Request, res: Response) => {
        try {
            const { organizationId, domain } = matchedData(req);
            const result = await processor.initiateDomainVerification(parseInt(organizationId), domain, req.body.tokenDetails);
            res.status(200).json({ success: true, data: result });
        } catch (error: any) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
);

router.get(
    '/domain-verify/:organizationId/check',
    validateJWT,
    validate([
        param('organizationId').isInt().withMessage('Organization ID must be an integer'),
        query('domain').notEmpty().withMessage('Domain query parameter is required')
    ]),
    async (req: Request, res: Response) => {
        try {
            const data = matchedData(req);
            const verified = await processor.verifyDomain(
                parseInt(data.organizationId),
                data.domain,
                req.body.tokenDetails
            );
            res.status(200).json({ success: true, verified });
        } catch (error: any) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
);

router.get(
    '/metadata/:organizationId',
    validate([param('organizationId').isInt().withMessage('Organization ID must be an integer')]),
    async (req: Request, res: Response) => {
        try {
            const { organizationId } = matchedData(req);
            const metadata = await processor.getMetadata(parseInt(organizationId));
            res.type('application/xml').status(200).send(metadata);
        } catch (error: any) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
);

export default router;