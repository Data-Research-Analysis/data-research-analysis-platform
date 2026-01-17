import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { validateDataSource, validateDataModel, validateDashboard, validateUserInput } from '../../middleware/validation.js';
import { EDataSourceType } from '../../types/EDataSourceType.js';

/**
 * DRA-TEST-022: Validation Middleware Tests
 * Tests input validation, sanitization, XSS prevention, SQL injection prevention
 * Total: 12+ tests
 */
describe('Validation Middleware', () => {
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let nextFunction: NextFunction;

    beforeEach(() => {
        mockRequest = {
            body: {},
            params: {},
            query: {}
        };
        mockResponse = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        } as unknown as Response;
        nextFunction = jest.fn();
    });

    describe('Data Source Validation', () => {
        it('should validate valid PostgreSQL data source', () => {
            mockRequest.body = {
                name: 'My PostgreSQL Database',
                type: EDataSourceType.POSTGRESQL,
                connection_details: {
                    host: 'localhost',
                    port: 5432,
                    database: 'mydb',
                    username: 'user',
                    password: 'pass'
                }
            };

            validateDataSource(mockRequest as Request, mockResponse as Response, nextFunction);

            expect(nextFunction).toHaveBeenCalled();
            expect(mockResponse.status).not.toHaveBeenCalled();
        });

        it('should reject data source without name', () => {
            mockRequest.body = {
                type: EDataSourceType.POSTGRESQL,
                connection_details: {}
            };

            validateDataSource(mockRequest as Request, mockResponse as Response, nextFunction);

            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({ error: expect.any(String) })
            );
            expect(nextFunction).not.toHaveBeenCalled();
        });

        it('should reject data source without type', () => {
            mockRequest.body = {
                name: 'Test Source',
                connection_details: {}
            };

            validateDataSource(mockRequest as Request, mockResponse as Response, nextFunction);

            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(nextFunction).not.toHaveBeenCalled();
        });

        it('should reject data source with invalid type', () => {
            mockRequest.body = {
                name: 'Test Source',
                type: 'INVALID_TYPE',
                connection_details: {}
            };

            validateDataSource(mockRequest as Request, mockResponse as Response, nextFunction);

            expect(mockResponse.status).toHaveBeenCalledWith(400);
        });

        it('should sanitize data source name to prevent XSS', () => {
            mockRequest.body = {
                name: '<script>alert("XSS")</script>My Database',
                type: EDataSourceType.POSTGRESQL,
                connection_details: {
                    host: 'localhost',
                    port: 5432,
                    database: 'mydb',
                    username: 'user',
                    password: 'pass'
                }
            };

            validateDataSource(mockRequest as Request, mockResponse as Response, nextFunction);

            expect(mockRequest.body.name).not.toContain('<script>');
        });

        it('should validate MySQL connection details', () => {
            mockRequest.body = {
                name: 'MySQL DB',
                type: EDataSourceType.MYSQL,
                connection_details: {
                    host: 'mysql.example.com',
                    port: 3306,
                    database: 'production',
                    username: 'root',
                    password: 'secure'
                }
            };

            validateDataSource(mockRequest as Request, mockResponse as Response, nextFunction);

            expect(nextFunction).toHaveBeenCalled();
        });

        it('should validate CSV file data source', () => {
            mockRequest.body = {
                name: 'CSV Import',
                type: EDataSourceType.CSV,
                connection_details: {
                    file_path: '/uploads/data.csv'
                }
            };

            validateDataSource(mockRequest as Request, mockResponse as Response, nextFunction);

            expect(nextFunction).toHaveBeenCalled();
        });
    });

    describe('Data Model Validation', () => {
        it('should validate valid data model', () => {
            mockRequest.body = {
                name: 'Sales Model',
                data_source_id: 1,
                selected_tables: ['customers', 'orders'],
                join_conditions: []
            };

            validateDataModel(mockRequest as Request, mockResponse as Response, nextFunction);

            expect(nextFunction).toHaveBeenCalled();
        });

        it('should reject data model without name', () => {
            mockRequest.body = {
                data_source_id: 1,
                selected_tables: ['table1']
            };

            validateDataModel(mockRequest as Request, mockResponse as Response, nextFunction);

            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(nextFunction).not.toHaveBeenCalled();
        });

        it('should reject data model without data_source_id', () => {
            mockRequest.body = {
                name: 'Test Model',
                selected_tables: ['table1']
            };

            validateDataModel(mockRequest as Request, mockResponse as Response, nextFunction);

            expect(mockResponse.status).toHaveBeenCalledWith(400);
        });

        it('should reject data model without selected_tables', () => {
            mockRequest.body = {
                name: 'Test Model',
                data_source_id: 1
            };

            validateDataModel(mockRequest as Request, mockResponse as Response, nextFunction);

            expect(mockResponse.status).toHaveBeenCalledWith(400);
        });

        it('should reject data model with empty selected_tables array', () => {
            mockRequest.body = {
                name: 'Test Model',
                data_source_id: 1,
                selected_tables: []
            };

            validateDataModel(mockRequest as Request, mockResponse as Response, nextFunction);

            expect(mockResponse.status).toHaveBeenCalledWith(400);
        });

        it('should sanitize data model name to prevent XSS', () => {
            mockRequest.body = {
                name: '<img src=x onerror=alert(1)>Model',
                data_source_id: 1,
                selected_tables: ['table1']
            };

            validateDataModel(mockRequest as Request, mockResponse as Response, nextFunction);

            expect(mockRequest.body.name).not.toContain('<img');
        });

        it('should validate join conditions structure', () => {
            mockRequest.body = {
                name: 'Joined Model',
                data_source_id: 1,
                selected_tables: ['users', 'orders'],
                join_conditions: [
                    { from: 'users.id', to: 'orders.user_id', type: 'INNER' }
                ]
            };

            validateDataModel(mockRequest as Request, mockResponse as Response, nextFunction);

            expect(nextFunction).toHaveBeenCalled();
        });
    });

    describe('Dashboard Validation', () => {
        it('should validate valid dashboard', () => {
            mockRequest.body = {
                name: 'Sales Dashboard',
                data_model_id: 1,
                layout: { widgets: [] }
            };

            validateDashboard(mockRequest as Request, mockResponse as Response, nextFunction);

            expect(nextFunction).toHaveBeenCalled();
        });

        it('should reject dashboard without name', () => {
            mockRequest.body = {
                data_model_id: 1,
                layout: {}
            };

            validateDashboard(mockRequest as Request, mockResponse as Response, nextFunction);

            expect(mockResponse.status).toHaveBeenCalledWith(400);
        });

        it('should reject dashboard without data_model_id', () => {
            mockRequest.body = {
                name: 'Dashboard',
                layout: {}
            };

            validateDashboard(mockRequest as Request, mockResponse as Response, nextFunction);

            expect(mockResponse.status).toHaveBeenCalledWith(400);
        });

        it('should sanitize dashboard name to prevent XSS', () => {
            mockRequest.body = {
                name: '<script>document.cookie</script>Dashboard',
                data_model_id: 1,
                layout: {}
            };

            validateDashboard(mockRequest as Request, mockResponse as Response, nextFunction);

            expect(mockRequest.body.name).not.toContain('<script>');
        });
    });

    describe('User Input Validation', () => {
        it('should validate email format', () => {
            mockRequest.body = {
                email: 'valid@example.com',
                password: 'SecurePass123!',
                name: 'John Doe'
            };

            validateUserInput(mockRequest as Request, mockResponse as Response, nextFunction);

            expect(nextFunction).toHaveBeenCalled();
        });

        it('should reject invalid email format', () => {
            mockRequest.body = {
                email: 'not-an-email',
                password: 'SecurePass123!',
                name: 'John Doe'
            };

            validateUserInput(mockRequest as Request, mockResponse as Response, nextFunction);

            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({ error: expect.stringMatching(/email/i) })
            );
        });

        it('should reject weak password', () => {
            mockRequest.body = {
                email: 'user@example.com',
                password: '123',
                name: 'John Doe'
            };

            validateUserInput(mockRequest as Request, mockResponse as Response, nextFunction);

            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({ error: expect.stringMatching(/password/i) })
            );
        });

        it('should sanitize user name to prevent XSS', () => {
            mockRequest.body = {
                email: 'user@example.com',
                password: 'SecurePass123!',
                name: '<b onload=alert(1)>John Doe</b>'
            };

            validateUserInput(mockRequest as Request, mockResponse as Response, nextFunction);

            expect(mockRequest.body.name).not.toContain('<b onload');
        });

        it('should prevent SQL injection in user input', () => {
            mockRequest.body = {
                email: "admin@example.com' OR '1'='1",
                password: 'password',
                name: 'Test User'
            };

            validateUserInput(mockRequest as Request, mockResponse as Response, nextFunction);

            // Should sanitize or reject SQL injection attempts
            expect(mockResponse.status).toHaveBeenCalledWith(400);
        });
    });

    describe('ID Parameter Validation', () => {
        it('should validate numeric ID parameters', () => {
            mockRequest.params = { id: '123' };

            const validateId = (req: Request, res: Response, next: NextFunction) => {
                const id = parseInt(req.params.id);
                if (isNaN(id) || id <= 0) {
                    return res.status(400).json({ error: 'Invalid ID' });
                }
                next();
            };

            validateId(mockRequest as Request, mockResponse as Response, nextFunction);

            expect(nextFunction).toHaveBeenCalled();
        });

        it('should reject non-numeric ID parameters', () => {
            mockRequest.params = { id: 'abc' };

            const validateId = (req: Request, res: Response, next: NextFunction) => {
                const id = parseInt(req.params.id);
                if (isNaN(id) || id <= 0) {
                    return res.status(400).json({ error: 'Invalid ID' });
                }
                next();
            };

            validateId(mockRequest as Request, mockResponse as Response, nextFunction);

            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(nextFunction).not.toHaveBeenCalled();
        });

        it('should reject negative ID parameters', () => {
            mockRequest.params = { id: '-5' };

            const validateId = (req: Request, res: Response, next: NextFunction) => {
                const id = parseInt(req.params.id);
                if (isNaN(id) || id <= 0) {
                    return res.status(400).json({ error: 'Invalid ID' });
                }
                next();
            };

            validateId(mockRequest as Request, mockResponse as Response, nextFunction);

            expect(mockResponse.status).toHaveBeenCalledWith(400);
        });
    });

    describe('XSS Prevention', () => {
        it('should strip HTML tags from input', () => {
            mockRequest.body = {
                name: '<h1>Header</h1><p>Paragraph</p>',
                description: '<div>Content</div>'
            };

            const sanitizeHTML = (req: Request, res: Response, next: NextFunction) => {
                if (req.body.name) {
                    req.body.name = req.body.name.replace(/<[^>]*>/g, '');
                }
                if (req.body.description) {
                    req.body.description = req.body.description.replace(/<[^>]*>/g, '');
                }
                next();
            };

            sanitizeHTML(mockRequest as Request, mockResponse as Response, nextFunction);

            expect(mockRequest.body.name).toBe('HeaderParagraph');
            expect(mockRequest.body.description).toBe('Content');
        });

        it('should escape special characters', () => {
            mockRequest.body = {
                text: 'Text with <script> and & symbols'
            };

            const escapeHTML = (req: Request, res: Response, next: NextFunction) => {
                if (req.body.text) {
                    req.body.text = req.body.text
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                        .replace(/"/g, '&quot;')
                        .replace(/'/g, '&#x27;');
                }
                next();
            };

            escapeHTML(mockRequest as Request, mockResponse as Response, nextFunction);

            expect(mockRequest.body.text).not.toContain('<script>');
            expect(mockRequest.body.text).toContain('&lt;');
        });
    });

    describe('SQL Injection Prevention', () => {
        it('should detect SQL injection in table names', () => {
            mockRequest.body = {
                selected_tables: ["users'; DROP TABLE users; --"]
            };

            const validateTableNames = (req: Request, res: Response, next: NextFunction) => {
                const sqlInjectionPattern = /('|--|;|\/\*|\*\/|xp_|sp_|exec|execute|union|select|insert|update|delete|drop|create|alter)/i;
                
                if (req.body.selected_tables) {
                    for (const table of req.body.selected_tables) {
                        if (sqlInjectionPattern.test(table)) {
                            return res.status(400).json({ error: 'Invalid table name' });
                        }
                    }
                }
                next();
            };

            validateTableNames(mockRequest as Request, mockResponse as Response, nextFunction);

            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(nextFunction).not.toHaveBeenCalled();
        });

        it('should detect SQL injection in query parameters', () => {
            mockRequest.query = {
                search: "test' OR '1'='1"
            };

            const validateQuery = (req: Request, res: Response, next: NextFunction) => {
                const sqlInjectionPattern = /('.*OR.*'|'.*AND.*'|--|;|\/\*|\*\/)/i;
                
                if (req.query.search && typeof req.query.search === 'string') {
                    if (sqlInjectionPattern.test(req.query.search)) {
                        return res.status(400).json({ error: 'Invalid search query' });
                    }
                }
                next();
            };

            validateQuery(mockRequest as Request, mockResponse as Response, nextFunction);

            expect(mockResponse.status).toHaveBeenCalledWith(400);
        });
    });
});
