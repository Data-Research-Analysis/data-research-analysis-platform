import { describe, it, expect } from '@jest/globals';
import { DRAUsersPlatform } from '../../models/DRAUsersPlatform.js';
import { EUserType } from '../../types/EUserType.js';

describe('DRAUsersPlatform Model', () => {
    describe('Entity Structure', () => {
        it('should create a user instance with required fields', () => {
            const user = new DRAUsersPlatform();
            user.id = 1;
            user.email = 'test@example.com';
            user.first_name = 'John';
            user.last_name = 'Doe';
            user.password = 'hashed_password_123';
            user.user_type = EUserType.NORMAL;

            expect(user.id).toBe(1);
            expect(user.email).toBe('test@example.com');
            expect(user.first_name).toBe('John');
            expect(user.last_name).toBe('Doe');
            expect(user.password).toBe('hashed_password_123');
            expect(user.user_type).toBe(EUserType.NORMAL);
        });

        it('should support both ADMIN and NORMAL user types', () => {
            const normalUser = new DRAUsersPlatform();
            normalUser.user_type = EUserType.NORMAL;
            expect(normalUser.user_type).toBe(EUserType.NORMAL);

            const adminUser = new DRAUsersPlatform();
            adminUser.user_type = EUserType.ADMIN;
            expect(adminUser.user_type).toBe(EUserType.ADMIN);
        });

        it('should have nullable email_verified_at timestamp', () => {
            const user = new DRAUsersPlatform();
            expect(user.email_verified_at).toBeUndefined();

            user.email_verified_at = new Date('2026-01-01');
            expect(user.email_verified_at).toBeInstanceOf(Date);
        });

        it('should have nullable unsubscribe_from_emails_at timestamp', () => {
            const user = new DRAUsersPlatform();
            expect(user.unsubscribe_from_emails_at).toBeUndefined();

            user.unsubscribe_from_emails_at = new Date('2026-06-15');
            expect(user.unsubscribe_from_emails_at).toBeInstanceOf(Date);
        });
    });

    describe('User Types', () => {
        it('should create admin users', () => {
            const admin = new DRAUsersPlatform();
            admin.email = 'admin@dataresearchanalysis.com';
            admin.first_name = 'Admin';
            admin.last_name = 'User';
            admin.user_type = EUserType.ADMIN;

            expect(admin.user_type).toBe(EUserType.ADMIN);
        });

        it('should create normal users', () => {
            const user = new DRAUsersPlatform();
            user.email = 'user@example.com';
            user.first_name = 'Normal';
            user.last_name = 'User';
            user.user_type = EUserType.NORMAL;

            expect(user.user_type).toBe(EUserType.NORMAL);
        });
    });

    describe('Email Field', () => {
        it('should accept valid email addresses', () => {
            const user = new DRAUsersPlatform();
            user.email = 'test.user+tag@example.co.uk';

            expect(user.email).toBe('test.user+tag@example.co.uk');
        });

        it('should handle email up to 320 characters', () => {
            const user = new DRAUsersPlatform();
            const longEmail = 'a'.repeat(308) + '@example.com'; // 320 chars total
            user.email = longEmail;

            expect(user.email).toBe(longEmail);
            expect(user.email.length).toBe(320);
        });
    });

    describe('Name Fields', () => {
        it('should store first_name and last_name separately', () => {
            const user = new DRAUsersPlatform();
            user.first_name = 'Jane';
            user.last_name = 'Smith';

            expect(user.first_name).toBe('Jane');
            expect(user.last_name).toBe('Smith');
        });

        it('should handle names up to 255 characters', () => {
            const user = new DRAUsersPlatform();
            const longName = 'A'.repeat(255);
            user.first_name = longName;
            user.last_name = longName;

            expect(user.first_name.length).toBe(255);
            expect(user.last_name.length).toBe(255);
        });

        it('should handle multi-word names', () => {
            const user = new DRAUsersPlatform();
            user.first_name = 'Mary Jane';
            user.last_name = 'Van Der Berg';

            expect(user.first_name).toBe('Mary Jane');
            expect(user.last_name).toBe('Van Der Berg');
        });
    });

    describe('Email Verification', () => {
        it('should track unverified email state', () => {
            const user = new DRAUsersPlatform();
            user.email = 'unverified@example.com';
            
            expect(user.email_verified_at).toBeUndefined();
        });

        it('should track verified email with timestamp', () => {
            const user = new DRAUsersPlatform();
            user.email = 'verified@example.com';
            const verificationDate = new Date('2025-12-01T10:30:00Z');
            user.email_verified_at = verificationDate;

            expect(user.email_verified_at).toBe(verificationDate);
            expect(user.email_verified_at).toBeInstanceOf(Date);
        });
    });

    describe('Email Subscription', () => {
        it('should default to subscribed (no unsubscribe date)', () => {
            const user = new DRAUsersPlatform();
            user.email = 'subscribed@example.com';

            expect(user.unsubscribe_from_emails_at).toBeUndefined();
        });

        it('should track unsubscription with timestamp', () => {
            const user = new DRAUsersPlatform();
            user.email = 'unsubscribed@example.com';
            const unsubscribeDate = new Date('2025-11-15T08:00:00Z');
            user.unsubscribe_from_emails_at = unsubscribeDate;

            expect(user.unsubscribe_from_emails_at).toBe(unsubscribeDate);
        });
    });

    describe('Entity Relations', () => {
        it('should have projects relation property', () => {
            const user = new DRAUsersPlatform();
            expect('projects' in user).toBe(true);
        });

        it('should have data_sources relation property', () => {
            const user = new DRAUsersPlatform();
            expect('data_sources' in user).toBe(true);
        });

        it('should have data_models relation property', () => {
            const user = new DRAUsersPlatform();
            expect('data_models' in user).toBe(true);
        });

        it('should have verification_codes relation property', () => {
            const user = new DRAUsersPlatform();
            expect('verification_codes' in user).toBe(true);
        });

        it('should have dashboards relation property', () => {
            const user = new DRAUsersPlatform();
            expect('dashboards' in user).toBe(true);
        });

        it('should have articles relation property', () => {
            const user = new DRAUsersPlatform();
            expect('articles' in user).toBe(true);
        });

        it('should have categories relation property', () => {
            const user = new DRAUsersPlatform();
            expect('categories' in user).toBe(true);
        });

        it('should have articles_categories relation property', () => {
            const user = new DRAUsersPlatform();
            expect('articles_categories' in user).toBe(true);
        });

        it('should have ai_conversations relation property', () => {
            const user = new DRAUsersPlatform();
            expect('ai_conversations' in user).toBe(true);
        });

        it('should have data_model_sources relation property', () => {
            const user = new DRAUsersPlatform();
            expect('data_model_sources' in user).toBe(true);
        });

        it('should have table_metadata relation property', () => {
            const user = new DRAUsersPlatform();
            expect('table_metadata' in user).toBe(true);
        });
    });

    describe('Password Storage', () => {
        it('should store password field', () => {
            const user = new DRAUsersPlatform();
            user.password = '$2b$10$abcdefghijklmnopqrstuvwxyz123456';

            expect(user.password).toBeDefined();
            expect(user.password.length).toBeGreaterThan(0);
        });

        it('should handle bcrypt hashed passwords', () => {
            const user = new DRAUsersPlatform();
            // Typical bcrypt hash format
            user.password = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

            expect(user.password).toContain('$2b$');
            expect(user.password.length).toBe(60); // Standard bcrypt length
        });
    });

    describe('Complete User Profile', () => {
        it('should create a complete admin user profile', () => {
            const admin = new DRAUsersPlatform();
            admin.id = 1;
            admin.email = 'admin@dataresearchanalysis.com';
            admin.first_name = 'Test';
            admin.last_name = 'Admin';
            admin.password = '$2b$10$hashedpassword';
            admin.user_type = EUserType.ADMIN;
            admin.email_verified_at = new Date('2025-01-15');

            expect(admin.id).toBe(1);
            expect(admin.email).toBe('admin@dataresearchanalysis.com');
            expect(admin.first_name).toBe('Test');
            expect(admin.last_name).toBe('Admin');
            expect(admin.user_type).toBe(EUserType.ADMIN);
            expect(admin.email_verified_at).toBeInstanceOf(Date);
            expect(admin.unsubscribe_from_emails_at).toBeUndefined();
        });

        it('should create a complete normal user profile', () => {
            const user = new DRAUsersPlatform();
            user.id = 42;
            user.email = 'user@example.com';
            user.first_name = 'Regular';
            user.last_name = 'User';
            user.password = '$2b$10$hashedpassword';
            user.user_type = EUserType.NORMAL;
            user.email_verified_at = new Date('2025-06-20');
            user.unsubscribe_from_emails_at = null;

            expect(user.id).toBe(42);
            expect(user.email).toBe('user@example.com');
            expect(user.first_name).toBe('Regular');
            expect(user.last_name).toBe('User');
            expect(user.user_type).toBe(EUserType.NORMAL);
            expect(user.email_verified_at).toBeInstanceOf(Date);
        });

        it('should create unverified user awaiting email confirmation', () => {
            const user = new DRAUsersPlatform();
            user.email = 'new.user@example.com';
            user.first_name = 'New';
            user.last_name = 'User';
            user.password = '$2b$10$hashedpassword';
            user.user_type = EUserType.NORMAL;
            // email_verified_at remains undefined

            expect(user.email_verified_at).toBeUndefined();
            expect(user.user_type).toBe(EUserType.NORMAL);
        });
    });
});
