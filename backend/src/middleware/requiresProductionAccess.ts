import { EUserType } from '../types/EUserType.js';

/**
 * Middleware: requiresProductionAccess
 *
 * Blocks non-admin users from creating or syncing data sources that are still
 * under API review (Meta Ads, LinkedIn Ads).
 *
 * Flow:
 *  - Admin users (user_type === 'admin') pass through unchanged.
 *  - All other users receive 403 with a clear message.
 *
 * Usage: apply AFTER validateJWT so that req.body.tokenDetails is populated.
 *
 * To enable a source for all users once production API access is approved,
 * simply remove this middleware from the relevant routes — no other code needs
 * to change.
 */
export function requiresProductionAccess(req: any, res: any, next: any): void {
    const userType = req.body?.tokenDetails?.user_type;

    if (userType === EUserType.ADMIN) {
        return next();
    }

    res.status(403).json({
        success: false,
        error: 'This integration is currently under review and not yet available. Please check back soon.',
    });
}
