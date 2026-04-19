import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { validateJWT } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validator.js';
import { body, matchedData, param, query } from 'express-validator';
import { LeadGeneratorProcessor } from '../../processors/LeadGeneratorProcessor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();
const processor = LeadGeneratorProcessor.getInstance();

const uploadDir = path.join(__dirname, '../../../private/lead-generators');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    },
});

const upload = multer({
    storage,
    fileFilter: (_req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
            return cb(new Error('Only PDF files are allowed'));
        }
        cb(null, true);
    },
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

// GET /admin/lead-generators — list all
router.get(
    '/list',
    validateJWT,
    async (req: Request, res: Response) => {
        try {
            const leadGenerators = await processor.getAllLeadGenerators();
            res.status(200).json({ success: true, data: leadGenerators });
        } catch (error: any) {
            console.error('[admin/lead-generators] list error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

// POST /admin/lead-generators/add — create
router.post(
    '/add',
    validateJWT,
    upload.single('pdf'),
    validate([
        body('title').notEmpty().trim(),
        body('slug').optional().trim(),
        body('description').optional().trim(),
        body('isGated').optional().isBoolean().toBoolean(),
    ]),
    async (req: Request, res: Response) => {
        try {
            if (!req.file) {
                return res.status(400).json({ success: false, error: 'PDF file is required' });
            }
            const data = matchedData(req);
            const leadGenerator = await processor.createLeadGenerator({
                title: data.title,
                slug: data.slug || undefined,
                description: data.description || undefined,
                fileName: req.file.filename,
                originalFileName: req.file.originalname,
                isGated: data.isGated !== undefined ? data.isGated : true,
            });
            res.status(200).json({ success: true, data: leadGenerator });
        } catch (error: any) {
            // Clean up uploaded file if DB save failed
            if (req.file) {
                const filePath = path.join(uploadDir, req.file.filename);
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }
            console.error('[admin/lead-generators] add error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

// GET /admin/lead-generators/:id — get one
router.get(
    '/:id',
    validateJWT,
    validate([param('id').notEmpty().toInt()]),
    async (req: Request, res: Response) => {
        try {
            const { id } = matchedData(req);
            const leadGenerator = await processor.getLeadGeneratorById(id);
            res.status(200).json({ success: true, data: leadGenerator });
        } catch (error: any) {
            console.error('[admin/lead-generators] get error:', error);
            res.status(404).json({ success: false, error: 'Lead generator not found' });
        }
    }
);

// PUT /admin/lead-generators/:id — update
router.put(
    '/:id',
    validateJWT,
    upload.single('pdf'),
    validate([
        param('id').notEmpty().toInt(),
        body('title').optional().trim(),
        body('slug').optional().trim(),
        body('description').optional().trim(),
        body('isGated').optional().isBoolean().toBoolean(),
        body('isActive').optional().isBoolean().toBoolean(),
    ]),
    async (req: Request, res: Response) => {
        try {
            const data = matchedData(req);
            const updateParams: Parameters<typeof processor.updateLeadGenerator>[1] = {};

            if (data.title !== undefined) updateParams.title = data.title;
            if (data.slug !== undefined) updateParams.slug = data.slug;
            if (data.description !== undefined) updateParams.description = data.description || null;
            if (data.isGated !== undefined) updateParams.isGated = data.isGated;
            if (data.isActive !== undefined) updateParams.isActive = data.isActive;
            if (req.file) {
                updateParams.fileName = req.file.filename;
                updateParams.originalFileName = req.file.originalname;
            }

            const updated = await processor.updateLeadGenerator(data.id, updateParams);
            res.status(200).json({ success: true, data: updated });
        } catch (error: any) {
            if (req.file) {
                const filePath = path.join(uploadDir, req.file.filename);
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }
            console.error('[admin/lead-generators] update error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

// DELETE /admin/lead-generators/:id — delete
router.delete(
    '/:id',
    validateJWT,
    validate([param('id').notEmpty().toInt()]),
    async (req: Request, res: Response) => {
        try {
            const { id } = matchedData(req);
            await processor.deleteLeadGenerator(id);
            res.status(200).json({ success: true, message: 'Lead generator deleted successfully' });
        } catch (error: any) {
            console.error('[admin/lead-generators] delete error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

// GET /admin/lead-generators/:id/leads — list leads (paginated)
router.get(
    '/:id/leads',
    validateJWT,
    validate([
        param('id').notEmpty().toInt(),
        query('page').optional().toInt(),
        query('limit').optional().toInt(),
    ]),
    async (req: Request, res: Response) => {
        try {
            const data = matchedData(req);
            const page = data.page || 1;
            const limit = Math.min(data.limit || 50, 200);
            const result = await processor.getLeadsForGenerator(data.id, page, limit);
            res.status(200).json({ success: true, ...result, page, limit });
        } catch (error: any) {
            console.error('[admin/lead-generators] leads error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

export default router;
