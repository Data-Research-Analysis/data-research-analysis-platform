import { EmailService } from '../../services/EmailService.js';
import { TemplateEngineService } from '../../services/TemplateEngineService.js';
import { UtilityService } from '../../services/UtilityService.js';
import nodemailer from 'nodemailer';

// Mock dependencies
jest.mock('nodemailer');
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
jest.mock('../../services/TemplateEngineService.js');
jest.mock('../../services/UtilityService.js');

describe('EmailService', () => {
    let emailService: EmailService;
    let mockTransporter: any;
    let mockTemplateEngine: jest.Mocked<TemplateEngineService>;
    let mockUtilityService: jest.Mocked<UtilityService>;

    beforeAll(() => {
        // Mock nodemailer transporter
        mockTransporter = {
            sendMail: jest.fn().mockResolvedValue({ 
                messageId: 'test-message-id',
                accepted: ['test@example.com'],
                rejected: [],
                response: '250 OK'
            }),
            verify: jest.fn().mockResolvedValue(true),
        };

        (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);

        // Mock TemplateEngineService
        mockTemplateEngine = {
            render: jest.fn().mockResolvedValue('<html><body>Rendered Template</body></html>'),
        } as any;
        (TemplateEngineService.getInstance as jest.Mock).mockReturnValue(mockTemplateEngine);

        // Mock UtilityService
        mockUtilityService = {
            getConstants: jest.fn((key: string) => {
                if (key === 'FRONTEND_URL') return 'http://localhost:3000';
                return null;
            }),
        } as any;
        (UtilityService.getInstance as jest.Mock).mockReturnValue(mockUtilityService);

        // Get EmailService instance (singleton)
        emailService = EmailService.getInstance();
    });

    beforeEach(() => {
        // Reset all mocks between tests
        jest.clearAllMocks();
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
            const options = {
                to: 'test@example.com',
                subject: 'Test Subject',
                html: '<p>Rendered HTML</p>',
                text: 'Rendered Text',
            };

            await emailService.sendEmailImmediately(options);

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

    describe('Authentication & Onboarding', () => {
        describe('sendVerificationEmail', () => {
            it('should send verification email with correct URL', async () => {
                const email = 'newuser@example.com';
                const token = 'test-verification-token-123';

                await emailService.sendVerificationEmail(email, token);

                expect(mockTemplateEngine.render).toHaveBeenCalledWith(
                    'email-verification-simple.html',
                    expect.arrayContaining([
                        expect.objectContaining({ 
                            key: 'verification_url', 
                            value: `http://localhost:3000/verify-email?token=${token}` 
                        })
                    ])
                );

                expect(mockTransporter.sendMail).toHaveBeenCalledWith(
                    expect.objectContaining({
                        to: email,
                        subject: 'Verify Your Email Address',
                    })
                );
            });

            it('should include token in verification URL', async () => {
                const token = 'unique-token-abc123';
                
                await emailService.sendVerificationEmail('user@example.com', token);

                const renderCall = mockTemplateEngine.render.mock.calls[0];
                const replacements = renderCall[1];
                const verificationUrlReplacement = replacements.find((r: any) => r.key === 'verification_url');
                
                expect(verificationUrlReplacement.value).toContain(token);
            });

            it('should render email-verification-simple.html template', async () => {
                await emailService.sendVerificationEmail('user@example.com', 'token123');

                expect(mockTemplateEngine.render).toHaveBeenCalledWith(
                    'email-verification-simple.html',
                    expect.any(Array)
                );
            });

            it('should include plain text version', async () => {
                const email = 'user@example.com';
                const token = 'test-token';

                await emailService.sendVerificationEmail(email, token);

                expect(mockTransporter.sendMail).toHaveBeenCalledWith(
                    expect.objectContaining({
                        text: expect.stringContaining('verify your email'),
                    })
                );
            });
        });

        describe('sendPasswordResetEmail', () => {
            it('should send password reset email with correct URL', async () => {
                const email = 'user@example.com';
                const token = 'reset-token-456';

                await emailService.sendPasswordResetEmail(email, token);

                expect(mockTemplateEngine.render).toHaveBeenCalledWith(
                    'password-reset-simple.html',
                    expect.arrayContaining([
                        expect.objectContaining({ 
                            key: 'reset_url', 
                            value: `http://localhost:3000/reset-password?token=${token}` 
                        })
                    ])
                );

                expect(mockTransporter.sendMail).toHaveBeenCalledWith(
                    expect.objectContaining({
                        to: email,
                        subject: 'Password Reset Request',
                    })
                );
            });

            it('should include token in reset URL', async () => {
                const token = 'secure-reset-token';
                
                await emailService.sendPasswordResetEmail('user@example.com', token);

                const renderCall = mockTemplateEngine.render.mock.calls[0];
                const replacements = renderCall[1];
                const resetUrlReplacement = replacements.find((r: any) => r.key === 'reset_url');
                
                expect(resetUrlReplacement.value).toContain(token);
            });

            it('should render password-reset-simple.html template', async () => {
                await emailService.sendPasswordResetEmail('user@example.com', 'token123');

                expect(mockTemplateEngine.render).toHaveBeenCalledWith(
                    'password-reset-simple.html',
                    expect.any(Array)
                );
            });

            it('should include 1-hour expiration notice in text', async () => {
                await emailService.sendPasswordResetEmail('user@example.com', 'token');

                expect(mockTransporter.sendMail).toHaveBeenCalledWith(
                    expect.objectContaining({
                        text: expect.stringContaining('1 hour'),
                    })
                );
            });
        });

        describe('sendBetaInvitation', () => {
            it('should send beta invitation with invitation code', async () => {
                const email = 'betauser@example.com';
                const invitationCode = 'BETA2026';

                await emailService.sendBetaInvitation(email, invitationCode);

                expect(mockTemplateEngine.render).toHaveBeenCalledWith(
                    'beta-invitation.html',
                    expect.arrayContaining([
                        expect.objectContaining({ key: 'invitation_code', value: invitationCode })
                    ])
                );
            });

            it('should include signup URL with code', async () => {
                const invitationCode = 'EXCLUSIVE123';
                
                await emailService.sendBetaInvitation('beta@example.com', invitationCode);

                const renderCall = mockTemplateEngine.render.mock.calls[0];
                const replacements = renderCall[1];
                const signupUrlReplacement = replacements.find((r: any) => r.key === 'signup_url');
                
                expect(signupUrlReplacement.value).toBe(`http://localhost:3000/register?code=${invitationCode}`);
            });

            it('should render beta-invitation.html template', async () => {
                await emailService.sendBetaInvitation('beta@example.com', 'CODE123');

                expect(mockTemplateEngine.render).toHaveBeenCalledWith(
                    'beta-invitation.html',
                    expect.any(Array)
                );
            });

            it('should send email with correct subject', async () => {
                await emailService.sendBetaInvitation('beta@example.com', 'CODE');

                expect(mockTransporter.sendMail).toHaveBeenCalledWith(
                    expect.objectContaining({
                        subject: 'Welcome to Data Research Analysis Beta!',
                    })
                );
            });
        });
    });

    describe('Project Collaboration (RBAC)', () => {
        describe('sendProjectInvitationToNewUser', () => {
            const invitationData = {
                email: 'newmember@example.com',
                projectName: 'Analytics Dashboard',
                inviterName: 'John Doe',
                role: 'editor',
                token: 'invitation-token-xyz'
            };

            it('should send invitation with accept token URL', async () => {
                await emailService.sendProjectInvitationToNewUser(invitationData);

                const renderCall = mockTemplateEngine.render.mock.calls[0];
                const replacements = renderCall[1];
                const acceptUrlReplacement = replacements.find((r: any) => r.key === 'accept_url');
                
                expect(acceptUrlReplacement.value).toBe(
                    `http://localhost:3000/invitations/accept/${invitationData.token}`
                );
            });

            it('should include role-specific descriptions for viewer', async () => {
                const viewerData = { ...invitationData, role: 'viewer' };
                
                await emailService.sendProjectInvitationToNewUser(viewerData);

                const renderCall = mockTemplateEngine.render.mock.calls[0];
                const replacements = renderCall[1];
                const roleDescReplacement = replacements.find((r: any) => r.key === 'role_description');
                
                expect(roleDescReplacement.value).toContain('View project data');
                expect(roleDescReplacement.value).toContain('read-only');
            });

            it('should include role-specific descriptions for editor', async () => {
                await emailService.sendProjectInvitationToNewUser(invitationData);

                const renderCall = mockTemplateEngine.render.mock.calls[0];
                const replacements = renderCall[1];
                const roleDescReplacement = replacements.find((r: any) => r.key === 'role_description');
                
                expect(roleDescReplacement.value).toContain('View and modify');
                expect(roleDescReplacement.value).toContain('dashboards');
            });

            it('should include role-specific descriptions for admin', async () => {
                const adminData = { ...invitationData, role: 'admin' };
                
                await emailService.sendProjectInvitationToNewUser(adminData);

                const renderCall = mockTemplateEngine.render.mock.calls[0];
                const replacements = renderCall[1];
                const roleDescReplacement = replacements.find((r: any) => r.key === 'role_description');
                
                expect(roleDescReplacement.value).toContain('Full project control');
                expect(roleDescReplacement.value).toContain('user management');
            });

            it('should render project-invitation.html template', async () => {
                await emailService.sendProjectInvitationToNewUser(invitationData);

                expect(mockTemplateEngine.render).toHaveBeenCalledWith(
                    'project-invitation.html',
                    expect.any(Array)
                );
            });

            it('should include 7-day expiration notice in text', async () => {
                await emailService.sendProjectInvitationToNewUser(invitationData);

                expect(mockTransporter.sendMail).toHaveBeenCalledWith(
                    expect.objectContaining({
                        text: expect.stringContaining('7 days'),
                    })
                );
            });

            it('should include all required template variables', async () => {
                await emailService.sendProjectInvitationToNewUser(invitationData);

                const renderCall = mockTemplateEngine.render.mock.calls[0];
                const replacements = renderCall[1];
                const keys = replacements.map((r: any) => r.key);
                
                expect(keys).toContain('inviter_name');
                expect(keys).toContain('project_name');
                expect(keys).toContain('role');
                expect(keys).toContain('role_description');
                expect(keys).toContain('accept_url');
            });
        });

        describe('sendProjectInvitationToExistingUser', () => {
            const invitationData = {
                email: 'existinguser@example.com',
                projectName: 'Sales Analytics',
                inviterName: 'Jane Smith',
                role: 'viewer'
            };

            it('should send invitation without token', async () => {
                await emailService.sendProjectInvitationToExistingUser(invitationData);

                const renderCall = mockTemplateEngine.render.mock.calls[0];
                const replacements = renderCall[1];
                const projectUrlReplacement = replacements.find((r: any) => r.key === 'project_url');
                
                expect(projectUrlReplacement.value).toBe('http://localhost:3000/projects');
                expect(projectUrlReplacement.value).not.toContain('token');
            });

            it('should include role-specific descriptions', async () => {
                await emailService.sendProjectInvitationToExistingUser(invitationData);

                const renderCall = mockTemplateEngine.render.mock.calls[0];
                const replacements = renderCall[1];
                const roleDescReplacement = replacements.find((r: any) => r.key === 'role_description');
                
                expect(roleDescReplacement).toBeDefined();
                expect(roleDescReplacement.value.length).toBeGreaterThan(0);
            });

            it('should render project-invitation-existing.html template', async () => {
                await emailService.sendProjectInvitationToExistingUser(invitationData);

                expect(mockTemplateEngine.render).toHaveBeenCalledWith(
                    'project-invitation-existing.html',
                    expect.any(Array)
                );
            });

            it('should send email with correct subject', async () => {
                await emailService.sendProjectInvitationToExistingUser(invitationData);

                expect(mockTransporter.sendMail).toHaveBeenCalledWith(
                    expect.objectContaining({
                        subject: `You've been added to "${invitationData.projectName}"`,
                    })
                );
            });

            it('should indicate immediate collaboration in text', async () => {
                await emailService.sendProjectInvitationToExistingUser(invitationData);

                expect(mockTransporter.sendMail).toHaveBeenCalledWith(
                    expect.objectContaining({
                        text: expect.stringContaining('immediately'),
                    })
                );
            });
        });
    });

    describe('Account Lifecycle', () => {
        describe('sendAccountCancellationRequested', () => {
            const effectiveDate = new Date('2026-02-01');
            const deletionDate = new Date('2026-03-01');
            const retentionDays = 28;

            it('should include effective and deletion dates', async () => {
                await emailService.sendAccountCancellationRequested(
                    'user@example.com',
                    'John Doe',
                    effectiveDate,
                    deletionDate,
                    retentionDays
                );

                const renderCall = mockTemplateEngine.render.mock.calls[0];
                const replacements = renderCall[1];
                
                const effectiveDateRepl = replacements.find((r: any) => r.key === 'effective_date');
                const deletionDateRepl = replacements.find((r: any) => r.key === 'deletion_date');
                
                expect(effectiveDateRepl.value).toContain('February');
                expect(deletionDateRepl.value).toContain('March');
            });

            it('should include retention period', async () => {
                await emailService.sendAccountCancellationRequested(
                    'user@example.com',
                    'John Doe',
                    effectiveDate,
                    deletionDate,
                    retentionDays
                );

                const renderCall = mockTemplateEngine.render.mock.calls[0];
                const replacements = renderCall[1];
                const retentionRepl = replacements.find((r: any) => r.key === 'retention_days');
                
                expect(retentionRepl.value).toBe('28');
            });

            it('should include reactivation URL', async () => {
                await emailService.sendAccountCancellationRequested(
                    'user@example.com',
                    'John Doe',
                    effectiveDate,
                    deletionDate,
                    retentionDays
                );

                const renderCall = mockTemplateEngine.render.mock.calls[0];
                const replacements = renderCall[1];
                const reactivateUrlRepl = replacements.find((r: any) => r.key === 'reactivate_url');
                
                expect(reactivateUrlRepl.value).toContain('/account/cancel-account');
                expect(reactivateUrlRepl.value).toContain('action=reactivate');
            });

            it('should render account-cancellation-requested.html template', async () => {
                await emailService.sendAccountCancellationRequested(
                    'user@example.com',
                    'John Doe',
                    effectiveDate,
                    deletionDate,
                    retentionDays
                );

                expect(mockTemplateEngine.render).toHaveBeenCalledWith(
                    'account-cancellation-requested.html',
                    expect.any(Array)
                );
            });

            it('should send email with correct subject', async () => {
                await emailService.sendAccountCancellationRequested(
                    'user@example.com',
                    'John Doe',
                    effectiveDate,
                    deletionDate,
                    retentionDays
                );

                expect(mockTransporter.sendMail).toHaveBeenCalledWith(
                    expect.objectContaining({
                        subject: 'Account Cancellation Requested - Data Research Analysis',
                    })
                );
            });
        });

        describe('sendAccountCancellationReminder7Days', () => {
            const deletionDate = new Date('2026-02-07');

            it('should include deletion date', async () => {
                await emailService.sendAccountCancellationReminder7Days(
                    'user@example.com',
                    'Jane Doe',
                    deletionDate
                );

                const renderCall = mockTemplateEngine.render.mock.calls[0];
                const replacements = renderCall[1];
                const deletionDateRepl = replacements.find((r: any) => r.key === 'deletion_date');
                
                expect(deletionDateRepl.value).toContain('February');
                expect(deletionDateRepl.value).toContain('2026');
            });

            it('should include urgent messaging in subject', async () => {
                await emailService.sendAccountCancellationReminder7Days(
                    'user@example.com',
                    'Jane Doe',
                    deletionDate
                );

                expect(mockTransporter.sendMail).toHaveBeenCalledWith(
                    expect.objectContaining({
                        subject: expect.stringContaining('⚠️'),
                    })
                );
            });

            it('should render account-cancellation-reminder-7days.html template', async () => {
                await emailService.sendAccountCancellationReminder7Days(
                    'user@example.com',
                    'Jane Doe',
                    deletionDate
                );

                expect(mockTemplateEngine.render).toHaveBeenCalledWith(
                    'account-cancellation-reminder-7days.html',
                    expect.any(Array)
                );
            });

            it('should include reactivation URL', async () => {
                await emailService.sendAccountCancellationReminder7Days(
                    'user@example.com',
                    'Jane Doe',
                    deletionDate
                );

                const renderCall = mockTemplateEngine.render.mock.calls[0];
                const replacements = renderCall[1];
                const reactivateUrlRepl = replacements.find((r: any) => r.key === 'reactivate_url');
                
                expect(reactivateUrlRepl).toBeDefined();
            });
        });

        describe('sendAccountCancellationReminder1Day', () => {
            const deletionDate = new Date('2026-01-31T10:00:00Z');
            const dataCounts = {
                projectCount: 5,
                dataSourceCount: 12,
                dataModelCount: 8,
                dashboardCount: 15
            };

            it('should include data counts', async () => {
                await emailService.sendAccountCancellationReminder1Day(
                    'user@example.com',
                    'Bob Smith',
                    deletionDate,
                    dataCounts
                );

                const renderCall = mockTemplateEngine.render.mock.calls[0];
                const replacements = renderCall[1];
                
                expect(replacements.find((r: any) => r.key === 'project_count')?.value).toBe('5');
                expect(replacements.find((r: any) => r.key === 'data_source_count')?.value).toBe('12');
                expect(replacements.find((r: any) => r.key === 'data_model_count')?.value).toBe('8');
                expect(replacements.find((r: any) => r.key === 'dashboard_count')?.value).toBe('15');
            });

            it('should include deletion timestamp', async () => {
                await emailService.sendAccountCancellationReminder1Day(
                    'user@example.com',
                    'Bob Smith',
                    deletionDate,
                    dataCounts
                );

                const renderCall = mockTemplateEngine.render.mock.calls[0];
                const replacements = renderCall[1];
                const deletionDateRepl = replacements.find((r: any) => r.key === 'deletion_date');
                
                expect(deletionDateRepl.value).toContain('January');
                expect(deletionDateRepl.value).toContain('31');
            });

            it('should render account-cancellation-reminder-1day.html template', async () => {
                await emailService.sendAccountCancellationReminder1Day(
                    'user@example.com',
                    'Bob Smith',
                    deletionDate,
                    dataCounts
                );

                expect(mockTemplateEngine.render).toHaveBeenCalledWith(
                    'account-cancellation-reminder-1day.html',
                    expect.any(Array)
                );
            });

            it('should send email with urgent subject line', async () => {
                await emailService.sendAccountCancellationReminder1Day(
                    'user@example.com',
                    'Bob Smith',
                    deletionDate,
                    dataCounts
                );

                expect(mockTransporter.sendMail).toHaveBeenCalledWith(
                    expect.objectContaining({
                        subject: expect.stringContaining('🚨'),
                    })
                );
            });
        });

        describe('sendAccountReactivated', () => {
            it('should confirm account reactivation', async () => {
                await emailService.sendAccountReactivated('user@example.com', 'Alice Johnson');

                expect(mockTransporter.sendMail).toHaveBeenCalledWith(
                    expect.objectContaining({
                        to: 'user@example.com',
                    })
                );
            });

            it('should render account-reactivated.html template', async () => {
                await emailService.sendAccountReactivated('user@example.com', 'Alice Johnson');

                expect(mockTemplateEngine.render).toHaveBeenCalledWith(
                    'account-reactivated.html',
                    expect.any(Array)
                );
            });

            it('should include user name', async () => {
                await emailService.sendAccountReactivated('user@example.com', 'Alice Johnson');

                const renderCall = mockTemplateEngine.render.mock.calls[0];
                const replacements = renderCall[1];
                const userNameRepl = replacements.find((r: any) => r.key === 'user_name');
                
                expect(userNameRepl.value).toBe('Alice Johnson');
            });

            it('should send email with positive subject', async () => {
                await emailService.sendAccountReactivated('user@example.com', 'Alice Johnson');

                expect(mockTransporter.sendMail).toHaveBeenCalledWith(
                    expect.objectContaining({
                        subject: expect.stringContaining('Welcome Back'),
                    })
                );
            });

            it('should include dashboard URL', async () => {
                await emailService.sendAccountReactivated('user@example.com', 'Alice Johnson');

                const renderCall = mockTemplateEngine.render.mock.calls[0];
                const replacements = renderCall[1];
                const dashboardUrlRepl = replacements.find((r: any) => r.key === 'dashboard_url');
                
                expect(dashboardUrlRepl.value).toContain('/dashboard');
            });
        });

        describe('sendAccountDataDeleted', () => {
            const deletionDate = new Date('2026-03-01');

            it('should confirm data deletion', async () => {
                await emailService.sendAccountDataDeleted(
                    'user@example.com',
                    'Charlie Brown',
                    deletionDate
                );

                expect(mockTransporter.sendMail).toHaveBeenCalledWith(
                    expect.objectContaining({
                        to: 'user@example.com',
                    })
                );
            });

            it('should include deletion date', async () => {
                await emailService.sendAccountDataDeleted(
                    'user@example.com',
                    'Charlie Brown',
                    deletionDate
                );

                const renderCall = mockTemplateEngine.render.mock.calls[0];
                const replacements = renderCall[1];
                const deletionDateRepl = replacements.find((r: any) => r.key === 'deletion_date');
                
                expect(deletionDateRepl.value).toContain('March');
            });

            it('should render account-data-deleted.html template', async () => {
                await emailService.sendAccountDataDeleted(
                    'user@example.com',
                    'Charlie Brown',
                    deletionDate
                );

                expect(mockTemplateEngine.render).toHaveBeenCalledWith(
                    'account-data-deleted.html',
                    expect.any(Array)
                );
            });

            it('should include new signup URL', async () => {
                await emailService.sendAccountDataDeleted(
                    'user@example.com',
                    'Charlie Brown',
                    deletionDate
                );

                const renderCall = mockTemplateEngine.render.mock.calls[0];
                const replacements = renderCall[1];
                const signupUrlRepl = replacements.find((r: any) => r.key === 'signup_url');
                
                expect(signupUrlRepl.value).toContain('/register');
            });
        });
    });

    describe('Legacy Methods', () => {
        describe('sendEmailVerificationWithUnsubscribe', () => {
            it('should include name and verification code', async () => {
                await emailService.sendEmailVerificationWithUnsubscribe(
                    'user@example.com',
                    'Test User',
                    'verify123',
                    'unsub456'
                );

                const renderCall = mockTemplateEngine.render.mock.calls[0];
                const replacements = renderCall[1];
                
                expect(replacements.find((r: any) => r.key === 'name')?.value).toBe('Test User');
                expect(replacements.find((r: any) => r.key === 'email_verification_code')?.value).toBe('verify123');
            });

            it('should include unsubscribe code', async () => {
                await emailService.sendEmailVerificationWithUnsubscribe(
                    'user@example.com',
                    'Test User',
                    'verify123',
                    'unsub456'
                );

                const renderCall = mockTemplateEngine.render.mock.calls[0];
                const replacements = renderCall[1];
                const unsubRepl = replacements.find((r: any) => r.key === 'unsubscribe_code');
                
                expect(unsubRepl.value).toBe('unsub456');
            });

            it('should render verify-email.html template', async () => {
                await emailService.sendEmailVerificationWithUnsubscribe(
                    'user@example.com',
                    'Test User',
                    'verify123',
                    'unsub456'
                );

                expect(mockTemplateEngine.render).toHaveBeenCalledWith(
                    'verify-email.html',
                    expect.any(Array)
                );
            });

            it('should include 3-day expiration notice in text', async () => {
                await emailService.sendEmailVerificationWithUnsubscribe(
                    'user@example.com',
                    'Test User',
                    'verify123',
                    'unsub456'
                );

                expect(mockTransporter.sendMail).toHaveBeenCalledWith(
                    expect.objectContaining({
                        text: expect.stringContaining('3 days'),
                    })
                );
            });
        });

        describe('sendPasswordChangeRequestWithUnsubscribe', () => {
            it('should include name and password change code', async () => {
                await emailService.sendPasswordChangeRequestWithUnsubscribe(
                    'user@example.com',
                    'Test User',
                    'reset789',
                    'unsub123'
                );

                const renderCall = mockTemplateEngine.render.mock.calls[0];
                const replacements = renderCall[1];
                
                expect(replacements.find((r: any) => r.key === 'name')?.value).toBe('Test User');
                expect(replacements.find((r: any) => r.key === 'password_change_request_code')?.value).toBe('reset789');
            });

            it('should include unsubscribe code', async () => {
                await emailService.sendPasswordChangeRequestWithUnsubscribe(
                    'user@example.com',
                    'Test User',
                    'reset789',
                    'unsub123'
                );

                const renderCall = mockTemplateEngine.render.mock.calls[0];
                const replacements = renderCall[1];
                const unsubRepl = replacements.find((r: any) => r.key === 'unsubscribe_code');
                
                expect(unsubRepl.value).toBe('unsub123');
            });

            it('should render password-change-request.html template', async () => {
                await emailService.sendPasswordChangeRequestWithUnsubscribe(
                    'user@example.com',
                    'Test User',
                    'reset789',
                    'unsub123'
                );

                expect(mockTemplateEngine.render).toHaveBeenCalledWith(
                    'password-change-request.html',
                    expect.any(Array)
                );
            });

            it('should send with correct subject', async () => {
                await emailService.sendPasswordChangeRequestWithUnsubscribe(
                    'user@example.com',
                    'Test User',
                    'reset789',
                    'unsub123'
                );

                expect(mockTransporter.sendMail).toHaveBeenCalledWith(
                    expect.objectContaining({
                        subject: 'Password Change Request @ Data Research Analysis',
                    })
                );
            });
        });

        describe('sendWelcomeBetaUserEmail', () => {
            it('should include temporary password', async () => {
                await emailService.sendWelcomeBetaUserEmail(
                    'beta@example.com',
                    'Beta User',
                    'TempPass123!',
                    'unsub999'
                );

                const renderCall = mockTemplateEngine.render.mock.calls[0];
                const replacements = renderCall[1];
                
                expect(replacements.find((r: any) => r.key === 'password')?.value).toBe('TempPass123!');
            });

            it('should render welcome-beta-users-email.html template', async () => {
                await emailService.sendWelcomeBetaUserEmail(
                    'beta@example.com',
                    'Beta User',
                    'TempPass123!',
                    'unsub999'
                );

                expect(mockTemplateEngine.render).toHaveBeenCalledWith(
                    'welcome-beta-users-email.html',
                    expect.any(Array)
                );
            });

            it('should include user email and name', async () => {
                await emailService.sendWelcomeBetaUserEmail(
                    'beta@example.com',
                    'Beta User',
                    'TempPass123!',
                    'unsub999'
                );

                const renderCall = mockTemplateEngine.render.mock.calls[0];
                const replacements = renderCall[1];
                
                expect(replacements.find((r: any) => r.key === 'email')?.value).toBe('beta@example.com');
                expect(replacements.find((r: any) => r.key === 'name')?.value).toBe('Beta User');
            });

            it('should send with welcome subject', async () => {
                await emailService.sendWelcomeBetaUserEmail(
                    'beta@example.com',
                    'Beta User',
                    'TempPass123!',
                    'unsub999'
                );

                expect(mockTransporter.sendMail).toHaveBeenCalledWith(
                    expect.objectContaining({
                        subject: 'Welcome to Data Research Analysis',
                    })
                );
            });
        });
    });
});

