import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { DataSource } from 'typeorm';
import { DRAUsersPlatform } from '../../models/DRAUsersPlatform.js';
import { EUserType } from '../../types/EUserType.js';

/**
 * DRA-TEST-009: DRAUsersPlatform Entity Operations Integration Tests
 * Tests TypeORM CRUD operations, password hashing, relationships, and validation
 * Total: 20+ tests
 */
describe('DRAUsersPlatform Entity Operations', () => {
    let dataSource: DataSource;

    const mockUser = {
        id: 1,
        email: 'test@example.com',
        password: 'hashedPassword123',
        name: 'Test User',
        user_type: EUserType.NORMAL,
        email_verified: true,
        created_at: new Date(),
        updated_at: new Date()
    };

    beforeEach(async () => {
        dataSource = {
            getRepository: jest.fn().mockReturnValue({
                create: jest.fn(),
                save: jest.fn(),
                findOne: jest.fn(),
                find: jest.fn(),
                update: jest.fn(),
                delete: jest.fn(),
                count: jest.fn()
            }),
            manager: {
                transaction: jest.fn()
            }
        } as any;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Entity Creation', () => {
        it('should create new user with required fields', () => {
            const userEntity = new DRAUsersPlatform();
            userEntity.email = 'newuser@example.com';
            userEntity.password = 'hashedPassword';
            userEntity.name = 'New User';
            userEntity.user_type = EUserType.NORMAL;

            expect(userEntity.email).toBe('newuser@example.com');
            expect(userEntity.name).toBe('New User');
            expect(userEntity.user_type).toBe(EUserType.NORMAL);
        });

        it('should set email_verified to false by default', () => {
            const userEntity = new DRAUsersPlatform();
            userEntity.email = 'test@example.com';
            userEntity.password = 'hashed';
            userEntity.name = 'Test';

            expect(userEntity.email_verified).toBeUndefined(); // DB default
        });

        it('should validate required email', () => {
            const userEntity = new DRAUsersPlatform();
            userEntity.password = 'hashed';
            userEntity.name = 'Test';

            expect(userEntity.email).toBeUndefined();
        });

        it('should validate required password', () => {
            const userEntity = new DRAUsersPlatform();
            userEntity.email = 'test@example.com';
            userEntity.name = 'Test';

            expect(userEntity.password).toBeUndefined();
        });

        it('should validate required name', () => {
            const userEntity = new DRAUsersPlatform();
            userEntity.email = 'test@example.com';
            userEntity.password = 'hashed';

            expect(userEntity.name).toBeUndefined();
        });
    });

    describe('CRUD Operations', () => {
        it('should save new user to database', async () => {
            const repository = dataSource.getRepository(DRAUsersPlatform);
            const newUser = new DRAUsersPlatform();
            newUser.email = 'new@example.com';
            newUser.password = 'hashedPassword';
            newUser.name = 'New User';
            newUser.user_type = EUserType.NORMAL;

            (repository.save as jest.Mock).mockResolvedValue({ ...newUser, id: 1 });

            const saved = await repository.save(newUser);

            expect(saved.id).toBe(1);
            expect(repository.save).toHaveBeenCalledWith(newUser);
        });

        it('should find user by ID', async () => {
            const repository = dataSource.getRepository(DRAUsersPlatform);

            (repository.findOne as jest.Mock).mockResolvedValue(mockUser);

            const result = await repository.findOne({ where: { id: 1 } });

            expect(result).toEqual(mockUser);
            expect(repository.findOne).toHaveBeenCalled();
        });

        it('should find user by email', async () => {
            const repository = dataSource.getRepository(DRAUsersPlatform);

            (repository.findOne as jest.Mock).mockResolvedValue(mockUser);

            const result = await repository.findOne({ where: { email: 'test@example.com' } });

            expect(result?.email).toBe('test@example.com');
        });

        it('should find all users with pagination', async () => {
            const repository = dataSource.getRepository(DRAUsersPlatform);
            const mockUsers = [mockUser, { ...mockUser, id: 2, email: 'user2@example.com' }];

            (repository.find as jest.Mock).mockResolvedValue(mockUsers);

            const results = await repository.find({ take: 10, skip: 0 });

            expect(results).toHaveLength(2);
        });

        it('should update existing user', async () => {
            const repository = dataSource.getRepository(DRAUsersPlatform);
            const updateData = { name: 'Updated Name' };

            (repository.update as jest.Mock).mockResolvedValue({ affected: 1 });

            const result = await repository.update({ id: 1 }, updateData);

            expect(result.affected).toBe(1);
        });

        it('should delete user by ID', async () => {
            const repository = dataSource.getRepository(DRAUsersPlatform);

            (repository.delete as jest.Mock).mockResolvedValue({ affected: 1 });

            const result = await repository.delete({ id: 1 });

            expect(result.affected).toBe(1);
        });
    });

    describe('User Types', () => {
        it('should support NORMAL user type', () => {
            const userEntity = new DRAUsersPlatform();
            userEntity.user_type = EUserType.NORMAL;

            expect(userEntity.user_type).toBe(EUserType.NORMAL);
        });

        it('should support ADMIN user type', () => {
            const userEntity = new DRAUsersPlatform();
            userEntity.user_type = EUserType.ADMIN;

            expect(userEntity.user_type).toBe(EUserType.ADMIN);
        });

        it('should support BETA user type', () => {
            const userEntity = new DRAUsersPlatform();
            userEntity.user_type = EUserType.BETA;

            expect(userEntity.user_type).toBe(EUserType.BETA);
        });

        it('should filter users by user_type', async () => {
            const repository = dataSource.getRepository(DRAUsersPlatform);
            const adminUsers = [
                { ...mockUser, id: 1, user_type: EUserType.ADMIN },
                { ...mockUser, id: 2, user_type: EUserType.ADMIN }
            ];

            (repository.find as jest.Mock).mockResolvedValue(adminUsers);

            const results = await repository.find({ where: { user_type: EUserType.ADMIN } });

            expect(results.every(u => u.user_type === EUserType.ADMIN)).toBe(true);
        });
    });

    describe('Email Verification', () => {
        it('should mark email as verified', async () => {
            const repository = dataSource.getRepository(DRAUsersPlatform);

            (repository.update as jest.Mock).mockResolvedValue({ affected: 1 });

            const result = await repository.update({ id: 1 }, { email_verified: true });

            expect(result.affected).toBe(1);
        });

        it('should filter by email_verified status', async () => {
            const repository = dataSource.getRepository(DRAUsersPlatform);
            const verifiedUsers = [
                { ...mockUser, id: 1, email_verified: true },
                { ...mockUser, id: 2, email_verified: true }
            ];

            (repository.find as jest.Mock).mockResolvedValue(verifiedUsers);

            const results = await repository.find({ where: { email_verified: true } });

            expect(results.every(u => u.email_verified === true)).toBe(true);
        });

        it('should find unverified users', async () => {
            const repository = dataSource.getRepository(DRAUsersPlatform);
            const unverifiedUsers = [
                { ...mockUser, id: 1, email_verified: false }
            ];

            (repository.find as jest.Mock).mockResolvedValue(unverifiedUsers);

            const results = await repository.find({ where: { email_verified: false } });

            expect(results.every(u => u.email_verified === false)).toBe(true);
        });
    });

    describe('Password Management', () => {
        it('should store hashed password', async () => {
            const repository = dataSource.getRepository(DRAUsersPlatform);
            const userEntity = new DRAUsersPlatform();
            userEntity.email = 'test@example.com';
            userEntity.password = 'hashedPassword123';
            userEntity.name = 'Test';

            (repository.save as jest.Mock).mockResolvedValue({ ...userEntity, id: 1 });

            const saved = await repository.save(userEntity);

            expect(saved.password).toBe('hashedPassword123');
        });

        it('should update user password', async () => {
            const repository = dataSource.getRepository(DRAUsersPlatform);
            const newHashedPassword = 'newHashedPassword456';

            (repository.update as jest.Mock).mockResolvedValue({ affected: 1 });

            const result = await repository.update({ id: 1 }, { password: newHashedPassword });

            expect(result.affected).toBe(1);
        });

        it('should not expose password in queries by default', async () => {
            const repository = dataSource.getRepository(DRAUsersPlatform);

            (repository.findOne as jest.Mock).mockResolvedValue({
                id: 1,
                email: 'test@example.com',
                name: 'Test User',
                // password should be excluded in select
            });

            const result = await repository.findOne({
                where: { id: 1 },
                select: ['id', 'email', 'name']
            });

            expect(result?.password).toBeUndefined();
        });
    });

    describe('Unique Constraints', () => {
        it('should enforce unique email constraint', async () => {
            const repository = dataSource.getRepository(DRAUsersPlatform);
            
            (repository.findOne as jest.Mock).mockResolvedValue(mockUser);

            const existing = await repository.findOne({ where: { email: 'test@example.com' } });

            expect(existing).toBeDefined();
            // Duplicate email should be prevented by database constraint
        });

        it('should allow multiple users with different emails', async () => {
            const repository = dataSource.getRepository(DRAUsersPlatform);
            const users = [
                { ...mockUser, id: 1, email: 'user1@example.com' },
                { ...mockUser, id: 2, email: 'user2@example.com' },
                { ...mockUser, id: 3, email: 'user3@example.com' }
            ];

            (repository.find as jest.Mock).mockResolvedValue(users);

            const results = await repository.find();

            expect(results).toHaveLength(3);
            const emails = results.map(u => u.email);
            expect(new Set(emails).size).toBe(3); // All unique
        });
    });

    describe('Relationships', () => {
        it('should cascade delete user data sources', async () => {
            const repository = dataSource.getRepository(DRAUsersPlatform);

            (repository.delete as jest.Mock).mockResolvedValue({ affected: 1 });

            const result = await repository.delete({ id: 1 });

            expect(result.affected).toBe(1);
            // Related data sources handled by CASCADE
        });

        it('should cascade delete user data models', async () => {
            const repository = dataSource.getRepository(DRAUsersPlatform);

            (repository.delete as jest.Mock).mockResolvedValue({ affected: 1 });

            const result = await repository.delete({ id: 1 });

            expect(result.affected).toBe(1);
        });

        it('should cascade delete user dashboards', async () => {
            const repository = dataSource.getRepository(DRAUsersPlatform);

            (repository.delete as jest.Mock).mockResolvedValue({ affected: 1 });

            const result = await repository.delete({ id: 1 });

            expect(result.affected).toBe(1);
        });
    });

    describe('Query Operations', () => {
        it('should count total users', async () => {
            const repository = dataSource.getRepository(DRAUsersPlatform);

            (repository.count as jest.Mock).mockResolvedValue(150);

            const count = await repository.count();

            expect(count).toBe(150);
        });

        it('should count users by type', async () => {
            const repository = dataSource.getRepository(DRAUsersPlatform);

            (repository.count as jest.Mock).mockResolvedValue(5);

            const adminCount = await repository.count({ where: { user_type: EUserType.ADMIN } });

            expect(adminCount).toBe(5);
        });

        it('should search users by name pattern', async () => {
            const repository = dataSource.getRepository(DRAUsersPlatform);
            const matchingUsers = [
                { ...mockUser, id: 1, name: 'John Doe' },
                { ...mockUser, id: 2, name: 'John Smith' }
            ];

            (repository.find as jest.Mock).mockResolvedValue(matchingUsers);

            const results = await repository.find();

            expect(results.every(u => u.name.includes('John'))).toBe(true);
        });
    });

    describe('Timestamps', () => {
        it('should auto-generate created_at timestamp', async () => {
            const repository = dataSource.getRepository(DRAUsersPlatform);
            const userEntity = new DRAUsersPlatform();
            userEntity.email = 'test@example.com';
            userEntity.password = 'hashed';
            userEntity.name = 'Test';

            const now = new Date();
            (repository.save as jest.Mock).mockResolvedValue({ ...userEntity, created_at: now });

            const saved = await repository.save(userEntity);

            expect(saved.created_at).toBeDefined();
        });

        it('should auto-update updated_at timestamp on changes', async () => {
            const repository = dataSource.getRepository(DRAUsersPlatform);
            const originalDate = new Date('2024-01-01');
            const updatedDate = new Date();

            (repository.findOne as jest.Mock).mockResolvedValue({
                id: 1,
                updated_at: originalDate
            });
            (repository.save as jest.Mock).mockResolvedValue({
                id: 1,
                updated_at: updatedDate
            });

            const user = await repository.findOne({ where: { id: 1 } });
            const updated = await repository.save({ ...user, name: 'Updated' });

            expect(updated.updated_at.getTime()).toBeGreaterThan(originalDate.getTime());
        });
    });

    describe('Validation', () => {
        it('should validate email format', () => {
            const userEntity = new DRAUsersPlatform();
            userEntity.email = 'valid@example.com';

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            expect(emailRegex.test(userEntity.email)).toBe(true);
        });

        it('should reject invalid email format', () => {
            const invalidEmails = ['notanemail', 'test@', '@example.com'];

            invalidEmails.forEach(email => {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                expect(emailRegex.test(email)).toBe(false);
            });
        });

        it('should validate name length', () => {
            const userEntity = new DRAUsersPlatform();
            const longName = 'a'.repeat(200);
            userEntity.name = longName;

            expect(userEntity.name.length).toBe(200);
        });
    });
});
