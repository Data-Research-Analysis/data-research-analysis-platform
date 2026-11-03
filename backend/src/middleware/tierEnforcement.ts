import { Request, Response, NextFunction } from 'express';
import { TierEnforcementService } from '../services/TierEnforcementService.js';
import { TierLimitError } from '../types/TierLimitError.js';
import { CreditInsufficientError } from '../types/CreditInsufficientError.js';

/**
 * Subscription enforcement middleware.
 *
 * Resource-count limits (projects, channels, data models, dashboards, AI
 * generations, plan builds, seats) were removed in favour of the un-gated
 * credit model. Only the AI fair-use ceiling and the plan-builder feature
 * gates remain.
 */

/**
 * Shared 402 handling for tier limits and credit-insufficient errors
 * (credits mode replaces the fair-use ceiling with the credit balance).
 */
function respondLimitError(error: unknown, res: Response): boolean {
    if (error instanceof TierLimitError || error instanceof CreditInsufficientError) {
        res.status(402).json({
            success: false,
            ...error.toJSON()
        });
        return true;
    }
    return false;
}

/**
 * Enforce the monthly AI cost ceiling (fair use).
 * Use: router.post('/ai/...', authenticate, enforceAICostCeiling, handler)
 */
export async function enforceAICostCeiling(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const userId = req.body.tokenDetails?.user_id;

        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
            return;
        }

        await TierEnforcementService.getInstance().enforceAICostCeiling(userId);
        next();
    } catch (error) {
        if (respondLimitError(error, res)) return;

        console.error('[TierEnforcement] Error checking AI cost ceiling:', error);
        res.status(500).json({ success: false, message: 'Failed to validate AI cost ceiling' });
    }
}
