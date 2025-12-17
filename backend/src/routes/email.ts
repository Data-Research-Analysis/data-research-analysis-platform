import express, { Request, Response } from 'express';
import { emailService } from '../services/EmailService.js';

const router = express.Router();

/**
 * POST /api/email/test-connection
 * Test email service connection
 */
router.post('/test-connection', async (req: Request, res: Response) => {
    try {
        if (!emailService.isConfigured()) {
            return res.status(503).json({
                success: false,
                message: 'Email service not configured. Set SMTP_USER and SMTP_PASS environment variables.'
            });
        }
        
        const result = await emailService.testConnection();
        
        if (result) {
            return res.status(200).json({
                success: true,
                message: 'Email connection test successful'
            });
        } else {
            return res.status(500).json({
                success: false,
                message: 'Email connection test failed'
            });
        }
    } catch (error: any) {
        console.error('❌ Email connection test failed:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Email connection test failed'
        });
    }
});

/**
 * POST /api/email/send-test
 * Send a test email
 */
router.post('/send-test', async (req: Request, res: Response) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email address is required'
            });
        }
        
        if (!emailService.isConfigured()) {
            return res.status(503).json({
                success: false,
                message: 'Email service not configured. Set SMTP_USER and SMTP_PASS environment variables.'
            });
        }
        
        const result = await emailService.sendTestEmail(email);
        
        if (result) {
            return res.status(200).json({
                success: true,
                message: `Test email sent to ${email}`
            });
        } else {
            return res.status(500).json({
                success: false,
                message: 'Failed to send test email'
            });
        }
    } catch (error: any) {
        console.error('❌ Failed to send test email:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to send test email'
        });
    }
});

/**
 * POST /api/email/send-sync-complete
 * Send a sync completion test email
 */
router.post('/send-sync-complete', async (req: Request, res: Response) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email address is required'
            });
        }
        
        if (!emailService.isConfigured()) {
            return res.status(503).json({
                success: false,
                message: 'Email service not configured'
            });
        }
        
        // Send test sync completion email with sample data
        const result = await emailService.sendSyncCompleteEmail(email, {
            dataSourceName: 'Test Data Source',
            reportType: 'Revenue',
            networkCode: '12345678',
            recordCount: 1523,
            duration: 127,
            startDate: '2024-01-01',
            endDate: '2024-01-31'
        });
        
        if (result) {
            return res.status(200).json({
                success: true,
                message: `Sync complete email sent to ${email}`
            });
        } else {
            return res.status(500).json({
                success: false,
                message: 'Failed to send sync complete email'
            });
        }
    } catch (error: any) {
        console.error('❌ Failed to send sync complete email:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to send sync complete email'
        });
    }
});

/**
 * POST /api/email/send-sync-failure
 * Send a sync failure test email
 */
router.post('/send-sync-failure', async (req: Request, res: Response) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email address is required'
            });
        }
        
        if (!emailService.isConfigured()) {
            return res.status(503).json({
                success: false,
                message: 'Email service not configured'
            });
        }
        
        // Send test sync failure email with sample data
        const result = await emailService.sendSyncFailureEmail(email, {
            dataSourceName: 'Test Data Source',
            reportType: 'Revenue',
            networkCode: '12345678',
            error: 'API quota exceeded. Please try again later.',
            timestamp: new Date().toISOString()
        });
        
        if (result) {
            return res.status(200).json({
                success: true,
                message: `Sync failure email sent to ${email}`
            });
        } else {
            return res.status(500).json({
                success: false,
                message: 'Failed to send sync failure email'
            });
        }
    } catch (error: any) {
        console.error('❌ Failed to send sync failure email:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to send sync failure email'
        });
    }
});

/**
 * GET /api/email/status
 * Get email service status and configuration
 */
router.get('/status', (req: Request, res: Response) => {
    try {
        const isConfigured = emailService.isConfigured();
        
        return res.status(200).json({
            success: true,
            data: {
                configured: isConfigured,
                host: isConfigured ? process.env.SMTP_HOST || 'localhost' : null,
                port: isConfigured ? process.env.SMTP_PORT || '587' : null,
                secure: isConfigured ? process.env.SMTP_SECURE === 'true' : null,
                from: isConfigured ? process.env.SMTP_FROM || 'noreply@dataresearch.com' : null
            }
        });
    } catch (error: any) {
        console.error('❌ Failed to get email status:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to get email status'
        });
    }
});

export default router;
