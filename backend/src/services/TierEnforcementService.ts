import { DBDriver } from '../drivers/DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { DRAUsersPlatform } from '../models/DRAUsersPlatform.js';
import { EUserType } from '../types/EUserType.js';
import { TierLimitError } from '../types/TierLimitError.js';
import { OrganizationService } from './OrganizationService.js';
import { AICallTrackerService } from './AICallTrackerService.js';
import { CreditWalletService } from './CreditWalletService.js';

/**
 * Usage and entitlement summary for the current organization.
 *
 * Only the data row allowance remains as a capacity guardrail; resource
 * counts (projects, channels, models, dashboards, AI generations, plan builds,
 * seats) are unlimited on every plan.
 */
export interface IEnhancedUsageStats {
    tier: string;
    tierDetails: {
        id: number;
        tierName: string;
        pricePerMonth: number;
    };
    rowLimit: number;
    /** Credits mode (CREDITS_ENABLED): true when consumption is metered by credits. */
    creditsEnabled: boolean;
    /** Org credit balance in credits mode (null when disabled). */
    creditBalance: number | null;
}

/**
 * Subscription entitlement and fair-use checks.
 *
 * Resource-count limits were removed in favour of the un-gated credit model.
 * What remains:
 * - data row allowance (capacity guardrail)
 * - monthly AI cost ceiling (fair use, replaced by credits when enabled)
 * - plan-builder feature flags
 */
export class TierEnforcementService {
    private static instance: TierEnforcementService;

    private constructor() {}

    public static getInstance(): TierEnforcementService {
        if (!TierEnforcementService.instance) {
            TierEnforcementService.instance = new TierEnforcementService();
        }
        return TierEnforcementService.instance;
    }

    /**
     * Credit-pricing mode (plan §5.3): when CREDITS_ENABLED, feature gates and
     * resource-count limits are removed. Capacity guardrails that REMAIN are
     * the row allowance, sync cadence, RBAC, and the credit balance itself.
     */
    private isCreditsMode(): boolean {
        return CreditWalletService.isEnabled();
    }

    /**
     * Check if user is admin (bypasses all limits)
     */
    async isAdmin(userId: number): Promise<boolean> {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) {
            console.error('[TierEnforcement] PostgreSQL driver not available');
            return false;
        }

        const concreteDriver = await driver.getConcreteDriver();
        if (!concreteDriver?.manager) {
            console.error('[TierEnforcement] Database manager not available');
            return false;
        }

        const user = await concreteDriver.manager.findOne(DRAUsersPlatform, {
            where: { id: userId }
        });

        const isAdminUser = user?.user_type === EUserType.ADMIN;

        if (isAdminUser) {
            console.log(`[TierEnforcement] Admin user ${userId} bypassing tier limits`);
        }

        return isAdminUser;
    }

    /**
     * Get user's current subscription tier via their personal organization.
     */
    private async getUserSubscription(userId: number) {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) {
            throw new Error('Database driver not available');
        }

        const concreteDriver = await driver.getConcreteDriver();
        if (!concreteDriver?.manager) {
            throw new Error('Database manager not available');
        }

        return await OrganizationService.getInstance().getOrgSubscriptionTierForUser(
            userId,
            concreteDriver.manager
        );
    }

    /**
     * Fair-use ceiling: monthly AI cost per org vs the tier's
     * ai_cost_ceiling_usd (final numbers set from rollups after ~2 months of
     * data, per plan doc §6.4).
     *
     * No ceiling when the tier has no ai_cost_ceiling_usd (null) or -1.
     * @throws TierLimitError if the org is above its ceiling
     */
    async enforceAICostCeiling(userId: number): Promise<void> {
        if (await this.isAdmin(userId)) return;
        // Credits mode: the fair-use cost ceiling is replaced by the credit
        // balance — credits ARE the fair-use mechanism.
        if (this.isCreditsMode()) return;

        const { tier, orgSubscription } = await this.getUserSubscription(userId);
        const ceiling = tier.ai_cost_ceiling_usd;

        if (ceiling === null || ceiling === undefined || Number(ceiling) < 0) return;

        const orgId = orgSubscription?.organization_id;
        if (!orgId) return;

        const now = new Date();
        const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const end = new Date(start);
        end.setUTCMonth(end.getUTCMonth() + 1);

        const used = await AICallTrackerService.getInstance().getMonthlyOrgCost(orgId, start, end);

        if (used >= Number(ceiling)) {
            throw new TierLimitError(
                tier.tier_name,
                'ai_generation',
                used,
                Number(ceiling)
            );
        }
    }

    /**
     * Get the current organization's plan and remaining entitlements.
     */
    async getUsageStats(userId: number): Promise<IEnhancedUsageStats> {
        const { tier, orgSubscription } = await this.getUserSubscription(userId);
        const creditsMode = this.isCreditsMode();

        let creditBalance: number | null = null;
        if (creditsMode && orgSubscription?.organization_id) {
            try {
                creditBalance = await CreditWalletService.getInstance().getBalance(orgSubscription.organization_id);
            } catch {
                creditBalance = 0;
            }
        }

        return {
            tier: tier.tier_name,
            tierDetails: {
                id: tier.id,
                tierName: tier.tier_name,
                pricePerMonth: Number(tier.price_per_month_usd)
            },
            rowLimit: Number(tier.max_rows_per_data_model),
            creditsEnabled: creditsMode,
            creditBalance,
        };
    }
}
