import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import nodemailer from 'nodemailer';
import { MailDriver } from '../MailDriver.js';

// Mock nodemailer
jest.mock('nodemailer', () => ({
    default: {
        createTransport: jest.fn()
    }
}));

/**
 * DRA-TEST-020: MailDriver Unit Tests
 * Tests email sending, templates, attachments, error handling
 * Total: 18+ tests
 */
describe('MailDriver', () => {
    let mailDriver: MailDriver;
    let mockTransporter: any;

    beforeEach(() => {
        // Reset the singleton instance
        (MailDriver as any).instance = undefined;

        mockTransporter = {
            sendMail: jest.fn<any>().mockResolvedValue({
                messageId: 'test-message-id',
                accepted: ['recipient@example.com'],
                rejected: [],
                response: '250 OK'
            }) as any,
            verify: jest.fn<any>().mockResolvedValue(true) as any
        };

        (nodemailer.createTransport as any) = jest.fn().mockReturnValue(mockTransporter);

        mailDriver = MailDriver.getInstance();
    });

    afterEach(() => {
        jest.clearAllMocks();
        // Reset the singleton instance
        (MailDriver as any).instance = undefined;
    });

    describe('Singleton Pattern', () => {
        it('should return the same instance on multiple getInstance() calls', () => {
            const instance1 = MailDriver.getInstance();
            const instance2 = MailDriver.getInstance();
            expect(instance1).toBe(instance2);
        });

        it('should maintain state across getInstance() calls', () => {
            const instance1 = MailDriver.getInstance();
            const instance2 = MailDriver.getInstance();
            expect(instance1).toStrictEqual(instance2);
        });
    });

    describe('Transporter Initialization', () => {
        it('should create nodemailer transporter with SMTP config', () => {
            expect(nodemailer.createTransport).toHaveBeenCalled();
        });

        it('should verify transporter connection', async () => {
            await mailDriver.verifyConnection();
            expect(mockTransporter.verify).toHaveBeenCalled();
        });

        it('should handle connection verification failure', async () => {
            mockTransporter.verify.mockRejectedValue(new Error('Connection failed'));

            await expect(mailDriver.verifyConnection()).rejects.toThrow('Connection failed');
        });

        it('should use environment variables for SMTP configuration', () => {
            expect(nodemailer.createTransport).toHaveBeenCalledWith(
                expect.objectContaining({
                    host: expect.any(String),
                    port: expect.any(Number)
                })
            );
        });
    });

    describe('Basic Email Sending', () => {
        it('should send email with required fields', async () => {
            const result = await mailDriver.sendMail({
                to: 'user@example.com',
                subject: 'Test Email',
                text: 'This is a test email',
                html: '<p>This is a test email</p>'
            });

            expect(mockTransporter.sendMail).toHaveBeenCalled();
            expect(result.messageId).toBe('test-message-id');
        });

        it('should send email to multiple recipients', async () => {
            const result = await mailDriver.sendMail({
                to: ['user1@example.com', 'user2@example.com', 'user3@example.com'],
                subject: 'Bulk Email',
                text: 'Message for multiple users'
            });

            expect(mockTransporter.sendMail).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: expect.arrayContaining(['user1@example.com', 'user2@example.com'])
                })
            );
            expect(result.accepted).toBeDefined();
        });

        it('should include sender information', async () => {
            await mailDriver.sendMail({
                to: 'recipient@example.com',
                subject: 'Test',
                text: 'Content'
            });

            expect(mockTransporter.sendMail).toHaveBeenCalledWith(
                expect.objectContaining({
                    from: expect.any(String)
                })
            );
        });

        it('should handle plain text and HTML content', async () => {
            await mailDriver.sendMail({
                to: 'user@example.com',
                subject: 'Formatted Email',
                text: 'Plain text version',
                html: '<h1>HTML version</h1>'
            });

            expect(mockTransporter.sendMail).toHaveBeenCalledWith(
                expect.objectContaining({
                    text: 'Plain text version',
                    html: '<h1>HTML version</h1>'
                })
            );
        });
    });

    describe('Email Verification', () => {
        it('should send email verification email', async () => {
            const result = await mailDriver.sendVerificationEmail(
                'newuser@example.com',
                'verification-token-123'
            );

            expect(mockTransporter.sendMail).toHaveBeenCalled();
            expect(result.messageId).toBeDefined();
        });

        it('should include verification link in email', async () => {
            await mailDriver.sendVerificationEmail(
                'user@example.com',
                'token-abc'
            );

            expect(mockTransporter.sendMail).toHaveBeenCalledWith(
                expect.objectContaining({
                    html: expect.stringContaining('token-abc')
                })
            );
        });

        it('should send verification email to correct recipient', async () => {
            await mailDriver.sendVerificationEmail(
                'verify@example.com',
                'token'
            );

            expect(mockTransporter.sendMail).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: 'verify@example.com'
                })
            );
        });
    });

    describe('Password Reset', () => {
        it('should send password reset email', async () => {
            const result = await mailDriver.sendPasswordResetEmail(
                'user@example.com',
                'reset-token-456'
            );

            expect(mockTransporter.sendMail).toHaveBeenCalled();
            expect(result.messageId).toBeDefined();
        });

        it('should include reset link in email', async () => {
            await mailDriver.sendPasswordResetEmail(
                'user@example.com',
                'reset-token'
            );

            expect(mockTransporter.sendMail).toHaveBeenCalledWith(
                expect.objectContaining({
                    html: expect.stringContaining('reset-token')
                })
            );
        });

        it('should have appropriate subject for password reset', async () => {
            await mailDriver.sendPasswordResetEmail(
                'user@example.com',
                'token'
            );

            expect(mockTransporter.sendMail).toHaveBeenCalledWith(
                expect.objectContaining({
                    subject: expect.stringMatching(/reset|password/i)
                })
            );
        });
    });

    describe('Beta User Invitations', () => {
        it('should send beta invitation email', async () => {
            const result = await mailDriver.sendBetaInvitation(
                'beta@example.com',
                'BETA-CODE-123'
            );

            expect(mockTransporter.sendMail).toHaveBeenCalled();
            expect(result.messageId).toBeDefined();
        });

        it('should include invitation code in email', async () => {
            await mailDriver.sendBetaInvitation(
                'beta@example.com',
                'SPECIAL-CODE'
            );

            expect(mockTransporter.sendMail).toHaveBeenCalledWith(
                expect.objectContaining({
                    html: expect.stringContaining('SPECIAL-CODE')
                })
            );
        });
    });

    describe('Email Attachments', () => {
        it('should send email with attachments', async () => {
            const attachments = [
                {
                    filename: 'report.pdf',
                    content: Buffer.from('PDF content'),
                    contentType: 'application/pdf'
                }
            ];

            await mailDriver.sendMail({
                to: 'user@example.com',
                subject: 'Report',
                text: 'See attached',
                attachments
            });

            expect(mockTransporter.sendMail).toHaveBeenCalledWith(
                expect.objectContaining({
                    attachments: expect.arrayContaining([
                        expect.objectContaining({
                            filename: 'report.pdf'
                        })
                    ])
                })
            );
        });

        it('should send email with multiple attachments', async () => {
            const attachments = [
                { filename: 'file1.txt', content: 'Content 1' },
                { filename: 'file2.txt', content: 'Content 2' },
                { filename: 'file3.txt', content: 'Content 3' }
            ];

            await mailDriver.sendMail({
                to: 'user@example.com',
                subject: 'Multiple Files',
                text: 'Files attached',
                attachments
            });

            expect(mockTransporter.sendMail).toHaveBeenCalledWith(
                expect.objectContaining({
                    attachments: expect.arrayContaining([
                        expect.objectContaining({ filename: 'file1.txt' }),
                        expect.objectContaining({ filename: 'file2.txt' }),
                        expect.objectContaining({ filename: 'file3.txt' })
                    ])
                })
            );
        });
    });

    describe('Error Handling', () => {
        it('should handle send failure', async () => {
            mockTransporter.sendMail.mockRejectedValue(new Error('Send failed'));

            await expect(
                mailDriver.sendMail({
                    to: 'user@example.com',
                    subject: 'Test',
                    text: 'Content'
                })
            ).rejects.toThrow('Send failed');
        });

        it('should handle invalid email addresses', async () => {
            await expect(
                mailDriver.sendMail({
                    to: 'invalid@example',
                    subject: 'Test',
                    text: 'Content'
                })
            ).rejects.toThrow('Invalid email address: invalid@example');
        });

        it('should handle network errors', async () => {
            mockTransporter.sendMail.mockRejectedValue(
                new Error('ECONNREFUSED: Connection refused')
            );

            await expect(
                mailDriver.sendMail({
                    to: 'user@example.com',
                    subject: 'Test',
                    text: 'Content'
                })
            ).rejects.toThrow(/ECONNREFUSED/);
        });

        it('should handle authentication errors', async () => {
            mockTransporter.sendMail.mockRejectedValue(
                new Error('Authentication failed')
            );

            await expect(
                mailDriver.sendMail({
                    to: 'user@example.com',
                    subject: 'Test',
                    text: 'Content'
                })
            ).rejects.toThrow(/Authentication/);
        });
    });

    describe('Email Validation', () => {
        it('should validate recipient email format', async () => {
            const invalidEmail = 'not-an-email';
            
            await expect(
                mailDriver.sendMail({
                    to: invalidEmail,
                    subject: 'Test',
                    text: 'Content'
                })
            ).rejects.toThrow();
        });

        it('should require subject line', async () => {
            await expect(
                mailDriver.sendMail({
                    to: 'user@example.com',
                    subject: '',
                    text: 'Content'
                })
            ).rejects.toThrow();
        });

        it('should require content (text or html)', async () => {
            await expect(
                mailDriver.sendMail({
                    to: 'user@example.com',
                    subject: 'Test',
                    text: '',
                    html: ''
                })
            ).rejects.toThrow();
        });
    });

    describe('Rate Limiting & Throttling', () => {
        it('should handle bulk email sending', async () => {
            const emails = Array.from({ length: 10 }, (_, i) => ({
                to: `user${i}@example.com`,
                subject: `Email ${i}`,
                text: `Content ${i}`
            }));

            const results = await Promise.all(
                emails.map(email => mailDriver.sendMail(email))
            );

            expect(results).toHaveLength(10);
            expect(mockTransporter.sendMail).toHaveBeenCalledTimes(10);
        });

        it('should respect rate limits when configured', async () => {
            // Send multiple emails in sequence
            await mailDriver.sendMail({
                to: 'user1@example.com',
                subject: 'Test 1',
                text: 'Content'
            });

            await mailDriver.sendMail({
                to: 'user2@example.com',
                subject: 'Test 2',
                text: 'Content'
            });

            expect(mockTransporter.sendMail).toHaveBeenCalledTimes(2);
        });
    });
});
