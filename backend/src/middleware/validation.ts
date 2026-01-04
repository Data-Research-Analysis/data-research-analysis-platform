import { Request, Response, NextFunction } from 'express';
import { EDataSourceType } from '../types/EDataSourceType.js';

/**
 * Sanitizes string input to prevent XSS attacks
 */
function sanitizeInput(input: string): string {
    if (typeof input !== 'string') return input;
    
    // Remove HTML tags
    return input.replace(/<[^>]*>/g, '');
}

/**
 * Validates email format
 */
function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validates password strength (min 8 chars)
 */
function isStrongPassword(password: string): boolean {
    return password && password.length >= 8;
}

/**
 * Detects SQL injection patterns
 */
function hasSQLInjection(input: string): boolean {
    const sqlInjectionPattern = /('|--|;|\/\*|\*\/|xp_|sp_|exec|execute|union|select|insert|update|delete|drop|create|alter|'.*OR.*'|'.*AND.*')/i;
    return sqlInjectionPattern.test(input);
}

/**
 * Validates data source creation/update request
 */
export function validateDataSource(req: Request, res: Response, next: NextFunction): void {
    const { name, type, connection_details } = req.body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        res.status(400).json({ error: 'Data source name is required' });
        return;
    }

    if (!type) {
        res.status(400).json({ error: 'Data source type is required' });
        return;
    }

    // Validate type is valid enum value
    if (!Object.values(EDataSourceType).includes(type)) {
        res.status(400).json({ error: 'Invalid data source type' });
        return;
    }

    // Sanitize name to prevent XSS
    req.body.name = sanitizeInput(name);

    next();
}

/**
 * Validates data model creation/update request
 */
export function validateDataModel(req: Request, res: Response, next: NextFunction): void {
    const { name, data_source_id, selected_tables } = req.body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        res.status(400).json({ error: 'Data model name is required' });
        return;
    }

    if (!data_source_id) {
        res.status(400).json({ error: 'Data source ID is required' });
        return;
    }

    if (!selected_tables) {
        res.status(400).json({ error: 'Selected tables are required' });
        return;
    }

    if (!Array.isArray(selected_tables) || selected_tables.length === 0) {
        res.status(400).json({ error: 'At least one table must be selected' });
        return;
    }

    // Check for SQL injection in table names
    for (const table of selected_tables) {
        if (typeof table === 'string' && hasSQLInjection(table)) {
            res.status(400).json({ error: 'Invalid table name' });
            return;
        }
    }

    // Sanitize name to prevent XSS
    req.body.name = sanitizeInput(name);

    next();
}

/**
 * Validates dashboard creation/update request
 */
export function validateDashboard(req: Request, res: Response, next: NextFunction): void {
    const { name, data_model_id } = req.body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        res.status(400).json({ error: 'Dashboard name is required' });
        return;
    }

    if (!data_model_id) {
        res.status(400).json({ error: 'Data model ID is required' });
        return;
    }

    // Sanitize name to prevent XSS
    req.body.name = sanitizeInput(name);

    next();
}

/**
 * Validates user input (registration, profile updates)
 */
export function validateUserInput(req: Request, res: Response, next: NextFunction): void {
    const { email, password, name } = req.body;

    // Validate email
    if (email) {
        if (!isValidEmail(email)) {
            res.status(400).json({ error: 'Invalid email format' });
            return;
        }

        // Check for SQL injection in email
        if (hasSQLInjection(email)) {
            res.status(400).json({ error: 'Invalid email format' });
            return;
        }
    }

    // Validate password strength
    if (password && !isStrongPassword(password)) {
        res.status(400).json({ error: 'Password must be at least 8 characters long' });
        return;
    }

    // Sanitize name to prevent XSS
    if (name) {
        req.body.name = sanitizeInput(name);
    }

    next();
}
