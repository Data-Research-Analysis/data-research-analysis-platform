import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { randomUUID } from 'crypto';
import { validate } from '../middleware/validator.js';
import { param, body } from 'express-validator';
import { matchedData } from 'express-validator';
import { LeadGeneratorProcessor } from '../processors/LeadGeneratorProcessor.js';
import { EmailService } from '../services/EmailService.js';
import { getRedisClient } from '../config/redis.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();
const processor = LeadGeneratorProcessor.getInstance();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOWNLOAD_TOKEN_TTL = 3600; // 1 hour in seconds
const DOWNLOAD_TOKEN_PREFIX = 'lgdl:';

const getFrontendUrl = () => process.env.FRONTEND_URL || process.env.SOCKETIO_CLIENT_URL || 'http://localhost:3000';

// GET /lead-generators/download/:token — one-time token file delivery
// IMPORTANT: defined BEFORE /:slug to prevent '/download' being captured as a slug
router.get(
    '/download/:token',
    async (req: Request, res: Response) => {
        try {
            const token = req.params.token;
            const slug = typeof req.query.slug === 'string' ? req.query.slug : '';
            const expiredRedirect = slug
                ? `${getFrontendUrl()}/resources/download-expired?slug=${encodeURIComponent(slug)}`
                : `${getFrontendUrl()}/resources/download-expired`;

            if (!token) {
                return res.redirect(expiredRedirect);
            }

            // Validate token exists
            const redisKey = `${DOWNLOAD_TOKEN_PREFIX}${token}`;
            const redis = getRedisClient();
            const leadGeneratorId = await redis.get(redisKey);

            if (!leadGeneratorId) {
                return res.redirect(expiredRedirect);
            }

            const lg = await processor.getLeadGeneratorById(parseInt(leadGeneratorId, 10));
            const filePath = processor.getFilePathPublic(lg.file_name);

            if (!fs.existsSync(filePath)) {
                console.error('[lead-generators/download] file not found on disk:', filePath);
                // Token is still valid — don't delete it, file is missing
                return res.redirect(`${getFrontendUrl()}/resources/download-expired`);
            }

            // Delete token only after confirming the file exists (one-time use)
            await redis.del(redisKey);

            // Increment download count at actual delivery
            await processor.incrementDownloadCount(lg.id).catch(() => { /* non-fatal */ });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(lg.original_file_name)}"`);
            const stream = fs.createReadStream(filePath);
            stream.on('error', (streamErr) => {
                console.error('[lead-generators/download] stream error:', streamErr);
                if (!res.headersSent) {
                    res.redirect(`${getFrontendUrl()}/resources/download-expired`);
                }
            });
            stream.pipe(res);
        } catch (error: any) {
            console.error('[lead-generators/download] error:', error);
            return res.redirect(`${getFrontendUrl()}/resources/download-expired`);
        }
    }
);

// GET /lead-generators/:slug — public metadata for landing page
router.get(
    '/:slug',
    validate([param('slug').notEmpty().trim()]),
    async (req: Request, res: Response) => {
        try {
            const { slug } = matchedData(req);
            const lg = await processor.getBySlug(slug);
            if (!lg) {
                return res.status(404).json({ success: false, error: 'Not found' });
            }
            res.status(200).json({
                success: true,
                data: {
                    id: lg.id,
                    title: lg.title,
                    slug: lg.slug,
                    description: lg.description,
                    is_gated: lg.is_gated,
                },
            });
        } catch (error: any) {
            console.error('[lead-generators] get by slug error:', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }
);

// POST /lead-generators/:slug/view — fire-and-forget view tracking
router.post(
    '/:slug/view',
    async (req: Request, res: Response) => {
        res.status(200).json({ success: true });
        // Async, non-blocking — errors are intentionally swallowed
        try {
            const slug = req.params.slug;
            if (!slug) return;
            const lg = await processor.getBySlug(slug);
            if (lg) {
                await processor.incrementViewCount(lg.id);
            }
        } catch (e) {
            // Silently ignore — view tracking must not block the response
        }
    }
);

// GET /lead-generators/:slug/file — open PDFs only
router.get(
    '/:slug/file',
    validate([param('slug').notEmpty().trim()]),
    async (req: Request, res: Response) => {
        try {
            const { slug } = matchedData(req);
            const lg = await processor.getBySlug(slug);
            if (!lg) {
                return res.status(404).json({ success: false, error: 'Not found' });
            }
            if (lg.is_gated) {
                return res.status(403).json({ success: false, error: 'This resource requires registration' });
            }

            const filePath = processor.getFilePathPublic(lg.file_name);
            if (!fs.existsSync(filePath)) {
                console.error('[lead-generators] file not found on disk:', filePath);
                return res.status(404).json({ success: false, error: 'File not found' });
            }

            await processor.incrementDownloadCount(lg.id);

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(lg.original_file_name)}"`);
            fs.createReadStream(filePath).pipe(res);
        } catch (error: any) {
            console.error('[lead-generators] file download error:', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }
);

// POST /lead-generators/:slug/gate — gated PDFs: capture lead, issue token, send email
router.post(
    '/:slug/gate',
    validate([
        param('slug').notEmpty().trim(),
        body('email').notEmpty().trim().isEmail(),
        body('fullName').optional().trim(),
        body('company').optional().trim(),
        body('phone').optional().trim(),
        body('jobTitle').optional().trim(),
    ]),
    async (req: Request, res: Response) => {
        try {
            const data = matchedData(req);
            const { slug, email, fullName, company, phone, jobTitle } = data;

            if (!EMAIL_REGEX.test(email)) {
                return res.status(400).json({ success: false, error: 'Invalid email address' });
            }

            const lg = await processor.getBySlug(slug);
            if (!lg) {
                return res.status(404).json({ success: false, error: 'Not found' });
            }
            if (!lg.is_gated) {
                return res.status(400).json({ success: false, error: 'This resource is not gated' });
            }

            // Get real client IP (respects trust proxy setting in Express)
            const ipAddress = (req.ip || req.socket.remoteAddress || '').replace(/^::ffff:/, '');

            // Record lead
            await processor.recordLead({
                leadGeneratorId: lg.id,
                email,
                fullName: fullName || undefined,
                company: company || undefined,
                phone: phone || undefined,
                jobTitle: jobTitle || undefined,
                ipAddress: ipAddress || undefined,
            });

            // Generate two one-time Redis download tokens: one for the immediate frontend download, one for the email link
            const frontendToken = randomUUID();
            const emailToken = randomUUID();
            const redis = getRedisClient();
            await redis.set(`${DOWNLOAD_TOKEN_PREFIX}${frontendToken}`, String(lg.id), 'EX', DOWNLOAD_TOKEN_TTL);
            await redis.set(`${DOWNLOAD_TOKEN_PREFIX}${emailToken}`, String(lg.id), 'EX', DOWNLOAD_TOKEN_TTL);

            // Build email download URL using the email-specific token; include slug so expired page can link back to the resource
            const backendUrl = process.env.BACKEND_URL || 'http://localhost:3002';
            const downloadUrl = `${backendUrl}/lead-generators/download/${emailToken}?slug=${encodeURIComponent(lg.slug)}`;

            // Send email (queued, non-blocking on error)
            try {
                await EmailService.getInstance().sendLeadGeneratorEmail({
                    toEmail: email,
                    recipientName: fullName || '',
                    pdfTitle: lg.title,
                    downloadUrl,
                });
            } catch (emailErr) {
                console.error('[lead-generators] email send error (non-fatal):', emailErr);
            }

            res.status(200).json({ success: true, downloadToken: frontendToken });
        } catch (error: any) {
            console.error('[lead-generators] gate error:', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }
);

export default router;
