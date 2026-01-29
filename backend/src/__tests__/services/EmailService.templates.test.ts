/**
 * Comprehensive Email Service Template Tests
 * 
 * Tests all email template methods in EmailService including:
 * - Authentication & Onboarding (verification, password reset, beta invitations)
 * - Project Collaboration/RBAC (project invitations for new/existing users)
 * - Account Lifecycle (cancellation flow with reminders, reactivation, deletion)
 * - Legacy Methods (old templates with unsubscribe codes)
 * - Missing Implementations (subscription management, data operations)
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';

describe('EmailService Template Methods', () => {
    let EmailService: any;
    let MailDriver: any;
    let TemplateEngineService: any;
    let UtilityService: any;
    
    let mockMailDriver: any;
    let mockTemplateEngine: any;
    let mockUtilityService: any;
    let emailService: any;

    beforeAll(async () => {
        // Dynamically import modules
        const emailServiceModule = await import('../../services/EmailService.js');
        const mailDriverModule = await import('../../drivers/MailDriver.js');
        const templateEngineModule = await import('../../services/TemplateEngineService.js');
        const utilityServiceModule = await import('../../services/UtilityService.js');

        EmailService = emailServiceModule.EmailService;
        MailDriver = mailDriverModule.MailDriver;
        TemplateEngineService = templateEngineModule.TemplateEngineService;
        UtilityService = utilityServiceModule.UtilityService;

        // Setup mocks
        mockMailDriver = {
            sendMail: async () => ({
                messageId: 'test-message-id',
                accepted: ['test@example.com'],
                rejected: [],
                response: '250 OK'
            }),
        };

        mockTemplateEngine = {
            render: async () => '<html>Rendered Template</html>',
        };

        mockUtilityService = {
            getConstants: () => 'http://localhost:3000',
        };

        // Mock getInstance methods
        MailDriver.getInstance = () => mockMailDriver;
        TemplateEngineService.getInstance = () => mockTemplateEngine;
        UtilityService.getInstance = () => mockUtilityService;

        // Get EmailService instance
        emailService = EmailService.getInstance();
    });

    beforeEach(() => {
        // Reset mock call tracking
        mockMailDriver.sendMailCalls = [];
        mockTemplateEngine.renderCalls = [];
        
        // Track calls manually
        const originalSendMail = mockMailDriver.sendMail;
        mockMailDriver.sendMail = async (options: any) => {
            mockMailDriver.sendMailCalls.push(options);
            return originalSendMail(options);
        };

        const originalRender = mockTemplateEngine.render;
        mockTemplateEngine.render = async (template: string, replacements: any[]) => {
            mockTemplateEngine.renderCalls.push({ template, replacements });
            return originalRender(template, replacements);
        };

        // Reset internal state
        emailService.resetState();
    });

    afterAll(async () => {
        // Cleanup
        if (emailService) {
            await emailService.close();
        }
        EmailService.resetInstance();
    });

    describe('Authentication & Onboarding', () => {
        describe('sendVerificationEmail', () => {
            it('should send verification email with correct URL and token', async () => {
                const email = 'newuser@example.com';
                const token = 'test-verification-token-123';

                await emailService.sendVerificationEmail(email, token);

                expect(mockTemplateEngine.renderCalls.length).toBe(1);
                expect(mockTemplateEngine.renderCalls[0].template).toBe('email-verification-simple.html');
                
                const verificationUrlParam = mockTemplateEngine.renderCalls[0].replacements.find(
                    (r: any) => r.key === 'verification_url'
                );
                expect(verificationUrlParam).toBeDefined();
                expect(verificationUrlParam.value).toContain(token);

                expect(mockMailDriver.sendMailCalls.length).toBe(1);
                expect(mockMailDriver.sendMailCalls[0].to).toBe(email);
                expect(mockMailDriver.sendMailCalls[0].subject).toContain('Verify');
                expect(mockMailDriver.sendMailCalls[0].text).toContain('24 hours');
            });

            it('should include verification URL with frontend base', async () => {
                mockUtilityService.getConstants = () => 'https://app.example.com';

                await emailService.sendVerificationEmail('user@example.com', 'token123');

                const verificationUrlParam = mockTemplateEngine.renderCalls[0].replacements.find(
                    (r: any) => r.key === 'verification_url'
                );
                expect(verificationUrlParam.value).toBe('https://app.example.com/verify-email?token=token123');
            });
        });

        describe('sendPasswordResetEmail', () => {
            it('should send password reset email with correct URL and token', async () => {
                const email = 'user@example.com';
                const token = 'reset-token-456';

                await emailService.sendPasswordResetEmail(email, token);

                expect(mockTemplateEngine.renderCalls[0].template).toBe('password-reset-simple.html');
                
                const resetUrlParam = mockTemplateEngine.renderCalls[0].replacements.find(
                    (r: any) => r.key === 'reset_url'
                );
                expect(resetUrlParam.value).toContain(token);

                expect(mockMailDriver.sendMailCalls[0].subject).toContain('Password Reset');
                expect(mockMailDriver.sendMailCalls[0].text).toContain('1 hour');
            });
        });

        describe('sendBetaInvitation', () => {
            it('should send beta invitation with invitation code and signup URL', async () => {
                const email = 'beta@example.com';
                const invitationCode = 'BETA-CODE-2024';

                await emailService.sendBetaInvitation(email, invitationCode);

                expect(mockTemplateEngine.renderCalls[0].template).toBe('beta-invitation.html');
                
                const codeParam = mockTemplateEngine.renderCalls[0].replacements.find(
                    (r: any) => r.key === 'invitation_code'
                );
                expect(codeParam.value).toBe(invitationCode);

                const signupUrlParam = mockTemplateEngine.renderCalls[0].replacements.find(
                    (r: any) => r.key === 'signup_url'
                );
                expect(signupUrlParam.value).toContain(invitationCode);

                expect(mockMailDriver.sendMailCalls[0].subject).toContain('Beta');
            });
        });
    });

    describe('Project Collaboration (RBAC)', () => {
        describe('sendProjectInvitationToNewUser', () => {
            it('should send invitation with accept token URL for new user', async () => {
                const data = {
                    email: 'newuser@example.com',
                    projectName: 'Analytics Project',
                    inviterName: 'John Doe',
                    role: 'editor',
                    token: 'invite-token-789'
                };

                await emailService.sendProjectInvitationToNewUser(data);

                expect(mockTemplateEngine.renderCalls[0].template).toBe('project-invitation.html');
                
                const acceptUrlParam = mockTemplateEngine.renderCalls[0].replacements.find(
                    (r: any) => r.key === 'accept_url'
                );
                expect(acceptUrlParam.value).toContain(data.token);

                expect(mockMailDriver.sendMailCalls[0].subject).toContain(data.projectName);
                expect(mockMailDriver.sendMailCalls[0].text).toContain('7 days');
            });

            it('should include role-specific descriptions', async () => {
                const data = {
                    email: 'viewer@example.com',
                    projectName: 'Test Project',
                    inviterName: 'Jane Smith',
                    role: 'viewer',
                    token: 'token123'
                };

                await emailService.sendProjectInvitationToNewUser(data);

                const roleDescParam = mockTemplateEngine.renderCalls[0].replacements.find(
                    (r: any) => r.key === 'role_description'
                );
                expect(roleDescParam.value).toContain('read-only');
            });
        });

        describe('sendProjectInvitationToExistingUser', () => {
            it('should send invitation without token for existing user', async () => {
                const data = {
                    email: 'existing@example.com',
                    projectName: 'Dashboard Project',
                    inviterName: 'Alice Johnson',
                    role: 'viewer'
                };

                await emailService.sendProjectInvitationToExistingUser(data);

                expect(mockTemplateEngine.renderCalls[0].template).toBe('project-invitation-existing.html');
                
                const projectUrlParam = mockTemplateEngine.renderCalls[0].replacements.find(
                    (r: any) => r.key === 'project_url'
                );
                expect(projectUrlParam.value).toContain('/projects');

                expect(mockMailDriver.sendMailCalls[0].subject).toContain('added to');
                expect(mockMailDriver.sendMailCalls[0].text).toContain('immediately');
            });
        });
    });

    describe('Account Lifecycle', () => {
        describe('sendAccountCancellationRequested', () => {
            it('should send cancellation confirmation with dates and retention info', async () => {
                const email = 'user@example.com';
                const userName = 'John Doe';
                const effectiveDate = new Date('2026-02-01');
                const deletionDate = new Date('2026-03-03');
                const retentionDays = 30;

                await emailService.sendAccountCancellationRequested(
                    email,
                    userName,
                    effectiveDate,
                    deletionDate,
                    retentionDays
                );

                expect(mockTemplateEngine.renderCalls[0].template).toBe('account-cancellation-requested.html');
                
                const retentionParam = mockTemplateEngine.renderCalls[0].replacements.find(
                    (r: any) => r.key === 'retention_days'
                );
                expect(retentionParam.value).toBe('30');

                expect(mockMailDriver.sendMailCalls[0].subject).toContain('Cancellation Requested');
            });
        });

        describe('sendAccountCancellationReminder7Days', () => {
            it('should send 7-day warning with deletion date', async () => {
                const email = 'user@example.com';
                const userName = 'Jane Doe';
                const deletionDate = new Date('2026-02-05');

                await emailService.sendAccountCancellationReminder7Days(
                    email,
                    userName,
                    deletionDate
                );

                expect(mockTemplateEngine.renderCalls[0].template).toBe('account-cancellation-reminder-7days.html');
                expect(mockMailDriver.sendMailCalls[0].subject).toContain('7 Days');
                expect(mockMailDriver.sendMailCalls[0].subject).toContain('⚠️');
            });
        });

        describe('sendAccountCancellationReminder1Day', () => {
            it('should send 1-day warning with data counts', async () => {
                const email = 'user@example.com';
                const userName = 'Bob Smith';
                const deletionDate = new Date('2026-01-30');
                const dataCounts = {
                    projectCount: 5,
                    dataSourceCount: 12,
                    dataModelCount: 8,
                    dashboardCount: 15
                };

                await emailService.sendAccountCancellationReminder1Day(
                    email,
                    userName,
                    deletionDate,
                    dataCounts
                );

                expect(mockTemplateEngine.renderCalls[0].template).toBe('account-cancellation-reminder-1day.html');
                
                const projectCountParam = mockTemplateEngine.renderCalls[0].replacements.find(
                    (r: any) => r.key === 'project_count'
                );
                expect(projectCountParam.value).toBe('5');

                expect(mockMailDriver.sendMailCalls[0].subject).toContain('URGENT');
                expect(mockMailDriver.sendMailCalls[0].subject).toContain('🚨');
            });
        });

        describe('sendAccountReactivated', () => {
            it('should send reactivation confirmation', async () => {
                const email = 'user@example.com';
                const userName = 'Alice Cooper';

                await emailService.sendAccountReactivated(email, userName);

                expect(mockTemplateEngine.renderCalls[0].template).toBe('account-reactivated.html');
                expect(mockMailDriver.sendMailCalls[0].subject).toContain('Welcome Back');
                expect(mockMailDriver.sendMailCalls[0].subject).toContain('🎉');
            });
        });

        describe('sendAccountDataDeleted', () => {
            it('should send deletion confirmation with date', async () => {
                const email = 'user@example.com';
                const userName = 'Charlie Brown';
                const deletionDate = new Date('2026-01-29');

                await emailService.sendAccountDataDeleted(email, userName, deletionDate);

                expect(mockTemplateEngine.renderCalls[0].template).toBe('account-data-deleted.html');
                expect(mockMailDriver.sendMailCalls[0].subject).toContain('Data Deleted');
                
                const signupUrlParam = mockTemplateEngine.renderCalls[0].replacements.find(
                    (r: any) => r.key === 'signup_url'
                );
                expect(signupUrlParam.value).toContain('/register');
            });
        });
    });

    describe('Legacy Methods', () => {
        describe('sendEmailVerificationWithUnsubscribe', () => {
            it('should send verification email with name and codes', async () => {
                const email = 'legacy@example.com';
                const name = 'Legacy User';
                const emailVerificationCode = 'VERIFY-CODE-123';
                const unsubscribeCode = 'UNSUB-456';

                await emailService.sendEmailVerificationWithUnsubscribe(
                    email,
                    name,
                    emailVerificationCode,
                    unsubscribeCode
                );

                expect(mockTemplateEngine.renderCalls[0].template).toBe('verify-email.html');
                
                const codeParam = mockTemplateEngine.renderCalls[0].replacements.find(
                    (r: any) => r.key === 'email_verification_code'
                );
                expect(codeParam.value).toBe(emailVerificationCode);

                expect(mockMailDriver.sendMailCalls[0].subject).toContain('Welcome');
                expect(mockMailDriver.sendMailCalls[0].text).toContain('3 days');
            });
        });

        describe('sendPasswordChangeRequestWithUnsubscribe', () => {
            it('should send password change email with name and codes', async () => {
                const email = 'legacy@example.com';
                const name = 'Legacy User';
                const passwordChangeRequestCode = 'PASS-CHANGE-789';
                const unsubscribeCode = 'UNSUB-101';

                await emailService.sendPasswordChangeRequestWithUnsubscribe(
                    email,
                    name,
                    passwordChangeRequestCode,
                    unsubscribeCode
                );

                expect(mockTemplateEngine.renderCalls[0].template).toBe('password-change-request.html');
                expect(mockMailDriver.sendMailCalls[0].subject).toContain('Password Change Request');
            });
        });

        describe('sendWelcomeBetaUserEmail', () => {
            it('should send welcome email with credentials', async () => {
                const email = 'beta@example.com';
                const name = 'Beta User';
                const password = 'TempPassword123';
                const unsubscribeCode = 'UNSUB-BETA';

                await emailService.sendWelcomeBetaUserEmail(
                    email,
                    name,
                    password,
                    unsubscribeCode
                );

                expect(mockTemplateEngine.renderCalls[0].template).toBe('welcome-beta-users-email.html');
                
                const passwordParam = mockTemplateEngine.renderCalls[0].replacements.find(
                    (r: any) => r.key === 'password'
                );
                expect(passwordParam.value).toBe(password);

                expect(mockMailDriver.sendMailCalls[0].text).toContain(password);
            });
        });
    });

    describe('Subscription Management', () => {
        describe('sendSubscriptionUpgraded', () => {
            it('should send subscription upgraded email with new features', async () => {
                const email = 'user@example.com';
                const userName = 'John Doe';
                const oldTier = 'Basic';
                const newTier = 'Premium';
                const newFeatures = ['Unlimited projects', 'Advanced analytics', 'Priority support'];

                await emailService.sendSubscriptionUpgraded(email, userName, oldTier, newTier, newFeatures);

                expect(mockTemplateEngine.renderCalls[0].template).toBe('subscription-upgraded.html');
                
                const tierParam = mockTemplateEngine.renderCalls[0].replacements.find(
                    (r: any) => r.key === 'new_tier'
                );
                expect(tierParam.value).toBe(newTier);

                expect(mockMailDriver.sendMailCalls[0].subject).toContain('Upgraded');
                expect(mockMailDriver.sendMailCalls[0].subject).toContain('🎉');
            });
        });

        describe('sendSubscriptionDowngraded', () => {
            it('should send subscription downgraded email with effective date', async () => {
                const email = 'user@example.com';
                const userName = 'Jane Smith';
                const oldTier = 'Premium';
                const newTier = 'Basic';
                const effectiveDate = new Date('2026-02-15');

                await emailService.sendSubscriptionDowngraded(email, userName, oldTier, newTier, effectiveDate);

                expect(mockTemplateEngine.renderCalls[0].template).toBe('subscription-downgraded.html');
                
                const dateParam = mockTemplateEngine.renderCalls[0].replacements.find(
                    (r: any) => r.key === 'effective_date'
                );
                expect(dateParam.value).toContain('February');

                expect(mockMailDriver.sendMailCalls[0].subject).toContain('Changed to');
            });
        });

        describe('sendSubscriptionCancelled', () => {
            it('should send subscription cancelled email', async () => {
                const email = 'user@example.com';
                const userName = 'Bob Johnson';
                const tierName = 'Premium';
                const effectiveDate = new Date('2026-03-01');

                await emailService.sendSubscriptionCancelled(email, userName, tierName, effectiveDate);

                expect(mockTemplateEngine.renderCalls[0].template).toBe('subscription-cancelled.html');
                expect(mockMailDriver.sendMailCalls[0].subject).toContain('Cancelled');
            });
        });

        describe('sendSubscriptionExpired', () => {
            it('should send subscription expired email', async () => {
                const email = 'user@example.com';
                const userName = 'Alice Brown';
                const tierName = 'Premium';
                const expirationDate = new Date('2026-01-25');

                await emailService.sendSubscriptionExpired(email, userName, tierName, expirationDate);

                expect(mockTemplateEngine.renderCalls[0].template).toBe('subscription-expired.html');
                expect(mockMailDriver.sendMailCalls[0].subject).toContain('Expired');
                expect(mockMailDriver.sendMailCalls[0].subject).toContain('⚠️');
            });
        });

        describe('sendSubscriptionExpiringWarning', () => {
            it('should send subscription expiring warning with days count', async () => {
                const email = 'user@example.com';
                const userName = 'Charlie Davis';
                const tierName = 'Premium';
                const expirationDate = new Date('2026-02-05');
                const daysUntilExpiration = 7;

                await emailService.sendSubscriptionExpiringWarning(
                    email,
                    userName,
                    tierName,
                    expirationDate,
                    daysUntilExpiration
                );

                expect(mockTemplateEngine.renderCalls[0].template).toBe('subscription-expiring-warning.html');
                
                const daysParam = mockTemplateEngine.renderCalls[0].replacements.find(
                    (r: any) => r.key === 'days_until_expiration'
                );
                expect(daysParam.value).toBe('7');

                expect(mockMailDriver.sendMailCalls[0].subject).toContain('7 Days');
                expect(mockMailDriver.sendMailCalls[0].subject).toContain('⚠️');
            });
        });

        describe('sendSubscriptionAssigned', () => {
            it('should send subscription assigned email with features', async () => {
                const email = 'user@example.com';
                const userName = 'Diana Evans';
                const tierName = 'Enterprise';
                const assignedBy = 'Admin User';
                const features = ['Unlimited everything', 'Dedicated support', 'Custom integrations'];

                await emailService.sendSubscriptionAssigned(
                    email,
                    userName,
                    tierName,
                    assignedBy,
                    features
                );

                expect(mockTemplateEngine.renderCalls[0].template).toBe('subscription-assigned.html');
                
                const assignedByParam = mockTemplateEngine.renderCalls[0].replacements.find(
                    (r: any) => r.key === 'assigned_by'
                );
                expect(assignedByParam.value).toBe(assignedBy);

                expect(mockMailDriver.sendMailCalls[0].subject).toContain('Assigned');
                expect(mockMailDriver.sendMailCalls[0].subject).toContain('🎉');
            });
        });
    });

    describe('Data Operations', () => {
        describe('sendSyncComplete', () => {
            it('should send sync complete email with record count', async () => {
                const email = 'user@example.com';
                const userName = 'Frank Green';
                const dataSourceName = 'PostgreSQL Database';
                const syncTime = new Date('2026-01-29T10:30:00');
                const recordCount = 1542;

                await emailService.sendSyncComplete(
                    email,
                    userName,
                    dataSourceName,
                    syncTime,
                    recordCount
                );

                expect(mockTemplateEngine.renderCalls[0].template).toBe('sync-complete.html');
                
                const recordParam = mockTemplateEngine.renderCalls[0].replacements.find(
                    (r: any) => r.key === 'record_count'
                );
                expect(recordParam.value).toBe('1,542');

                expect(mockMailDriver.sendMailCalls[0].subject).toContain('Sync Complete');
                expect(mockMailDriver.sendMailCalls[0].subject).toContain('✅');
            });
        });

        describe('sendSyncFailure', () => {
            it('should send sync failure email with error message', async () => {
                const email = 'user@example.com';
                const userName = 'Grace Hill';
                const dataSourceName = 'MySQL Database';
                const errorMessage = 'Connection timeout';
                const failureTime = new Date('2026-01-29T11:45:00');

                await emailService.sendSyncFailure(
                    email,
                    userName,
                    dataSourceName,
                    errorMessage,
                    failureTime
                );

                expect(mockTemplateEngine.renderCalls[0].template).toBe('sync-failure.html');
                
                const errorParam = mockTemplateEngine.renderCalls[0].replacements.find(
                    (r: any) => r.key === 'error_message'
                );
                expect(errorParam.value).toBe(errorMessage);

                expect(mockMailDriver.sendMailCalls[0].subject).toContain('Sync Failed');
                expect(mockMailDriver.sendMailCalls[0].subject).toContain('❌');
            });
        });

        describe('sendExportComplete', () => {
            it('should send export complete email with download link', async () => {
                const email = 'user@example.com';
                const userName = 'Henry Irving';
                const dashboardName = 'Sales Dashboard';
                const exportFormat = 'pdf';
                const downloadUrl = 'https://example.com/download/export123';
                const expirationHours = 24;

                await emailService.sendExportComplete(
                    email,
                    userName,
                    dashboardName,
                    exportFormat,
                    downloadUrl,
                    expirationHours
                );

                expect(mockTemplateEngine.renderCalls[0].template).toBe('export-complete.html');
                
                const formatParam = mockTemplateEngine.renderCalls[0].replacements.find(
                    (r: any) => r.key === 'export_format'
                );
                expect(formatParam.value).toBe('PDF');

                const downloadParam = mockTemplateEngine.renderCalls[0].replacements.find(
                    (r: any) => r.key === 'download_url'
                );
                expect(downloadParam.value).toBe(downloadUrl);

                expect(mockMailDriver.sendMailCalls[0].subject).toContain('Export Ready');
                expect(mockMailDriver.sendMailCalls[0].subject).toContain('📊');
            });
        });
    });
});
