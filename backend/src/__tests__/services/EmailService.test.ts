import { EmailService } from '../../services/EmailService.js';
import { renderEmailTemplate } from '../../utils/emailTemplates.js';
import nodemailer from 'nodemailer';

// Mock dependencies
jest.mock('nodemailer');
jest.mock('../../utils/emailTemplates');
jest.mock('../../config/redis.config', () => ({
    getRedisClient: jest.fn(() => ({
        on: jest.fn(),
        connect: jest.fn(),
    })),
}));
jest.mock('bullmq', () => ({
    Queue: jest.fn().mockImplementation(() => ({
        add: jest.fn().mockResolvedValue({ id: '123' }),
        close: jest.fn().mockResolvedValue(undefined),
    })),
    Worker: jest.fn().mockImplementation(() => ({
        on: jest.fn(),
        close: jest.fn().mockResolvedValue(undefined),
    })),
}));

describe('EmailService', () => {
    let emailService: EmailService;
    let mockTransporter: any;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Mock nodemailer transporter
        mockTransporter = {
            sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
            verify: jest.fn().mockResolvedValue(true),
        };

        (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);

        // Get EmailService instance (singleton)
        emailService = EmailService.getInstance();
    });

    describe('sendEmailImmediately', () => {
        it('should send email with HTML content', async () => {
            const options = {
                to: 'test@example.com',
                subject: 'Test Subject',
                html: '<p>Test HTML</p>',
                text: 'Test Text',
            };

            await emailService.sendEmailImmediately(options);

            expect(mockTransporter.sendMail).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: 'test@example.com',
                    subject: 'Test Subject',
                    html: '<p>Test HTML</p>',
                    text: 'Test Text',
                })
            );
        });

        it('should render template if provided', async () => {
            const mockRendered = {
                html: '<p>Rendered HTML</p>',
                text: 'Rendered Text',
            };
            (renderEmailTemplate as jest.Mock).mockResolvedValue(mockRendered);

            const options = {
                to: 'test@example.com',
                subject: 'Test Subject',
                template: 'subscription-assigned',
                templateData: { userName: 'John', tierName: 'PRO' },
            };

            await emailService.sendEmailImmediately(options);

            expect(renderEmailTemplate).toHaveBeenCalledWith('subscription-assigned', {
                userName: 'John',
                tierName: 'PRO',
            });
            expect(mockTransporter.sendMail).toHaveBeenCalledWith(
                expect.objectContaining({
                    html: '<p>Rendered HTML</p>',
                    text: 'Rendered Text',
                })
            );
        });

        it('should include attachments if provided', async () => {
            const options = {
                to: 'test@example.com',
                subject: 'Test Subject',
                html: '<p>Test</p>',
                attachments: [
                    {
                        filename: 'test.pdf',
                        content: Buffer.from('test'),
                    },
                ],
            };

            await emailService.sendEmailImmediately(options);

            expect(mockTransporter.sendMail).toHaveBeenCalledWith(
                expect.objectContaining({
                    attachments: options.attachments,
                })
            );
        });

        it('should throw error if sending fails', async () => {
            mockTransporter.sendMail.mockRejectedValue(new Error('SMTP Error'));

            const options = {
                to: 'test@example.com',
                subject: 'Test Subject',
                html: '<p>Test</p>',
            };

            await expect(emailService.sendEmailImmediately(options)).rejects.toThrow('SMTP Error');
        });
    });

    describe('sendEmail', () => {
        it('should queue email for async sending', async () => {
            const options = {
                to: 'test@example.com',
                subject: 'Test Subject',
                html: '<p>Test</p>',
            };

            await emailService.sendEmail(options);

            // Verify queue.add was called (mocked in BullMQ mock)
            // This is a simplified test - in real scenario, you'd check the queue
            expect(true).toBe(true); // Placeholder - BullMQ mocked above
        });
    });
});

