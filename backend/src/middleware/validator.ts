import express from 'express';

import { validationResult, ContextRunner } from 'express-validator';

export function validate(validations: ContextRunner[]) {
    return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
        await Promise.all(validations.map(validation => validation.run(req)));
        const result = validationResult(req);
        if (result.isEmpty()) {
            return next();
        }
        res.status(400).json({ errors: result.array() });
    };
}

export function validatePasswordStrength (req: any, res: any, next: any) {
    const password  = req.body.password;
    if (/^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}$/.test(password)) {
        next();
    } else {
        res.status(400).json({ errors: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.' });
    }
}
