import { DBDriver } from '../drivers/DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { DRAOrganization } from '../models/DRAOrganization.js';
import { DRASubscriptionTier } from '../models/DRASubscriptionTier.js';
import { DRAOrganizationSubscription } from '../models/DRAOrganizationSubscription.js';
import { getRedisClient } from '../config/redis.config.js';

export interface IBrandingConfig {
    primaryColor: string | null;
    secondaryColor: string | null;
    logoUrl: string | null;
    enabled: boolean;
}

const BRANDING_CACHE_TTL = 300; // 5 minutes
const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;
const IMAGE_URL_EXTENSIONS = /\.(png|jpg|jpeg|gif|svg|webp|ico)($|\?)/i;

export class BrandingService {
    private static instance: BrandingService;
    private redis = getRedisClient();

    private constructor() {}

    public static getInstance(): BrandingService {
        if (!BrandingService.instance) {
            BrandingService.instance = new BrandingService();
        }
        return BrandingService.instance;
    }

    private getCacheKey(orgId: number): string {
        return `branding:org:${orgId}`;
    }

    /**
     * Validate a hex color string
     */
    validateHexColor(color: string): boolean {
        return HEX_COLOR_REGEX.test(color);
    }

    /**
     * Check if the given org has an active subscription at Professional Plus tier or above (tier_rank >= 30).
     */
    async orgEligibleForBranding(orgId: number): Promise<boolean> {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) return false;

        const concreteDriver = await driver.getConcreteDriver();
        if (!concreteDriver?.manager) return false;

        const sub = await concreteDriver.manager.findOne(DRAOrganizationSubscription, {
            where: { organization: { id: orgId }, is_active: true },
            relations: ['subscription_tier'],
        });

        if (!sub || !sub.subscription_tier) return false;

        return sub.subscription_tier.tier_rank >= 30;
    }

    /**
     * Get branding config for an org. Cached in Redis for 5 minutes.
     * Returns null if branding is not enabled or org is not eligible.
     */
    async getBranding(orgId: number): Promise<IBrandingConfig | null> {
        const cacheKey = this.getCacheKey(orgId);

        try {
            const cached = await this.redis.get(cacheKey);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed === null) return null; // cached ineligible result
                return parsed as IBrandingConfig;
            }
        } catch (err) {
            console.warn('[BrandingService] Redis read failed:', err);
        }

        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) return null;

        const concreteDriver = await driver.getConcreteDriver();
        if (!concreteDriver?.manager) return null;

        const org = await concreteDriver.manager.findOne(DRAOrganization, {
            where: { id: orgId },
        });

        if (!org) {
            await this.setCache(cacheKey, null);
            return null;
        }

        if (!org.branding_enabled) {
            const eligible = await this.orgEligibleForBranding(orgId);
            if (!eligible) {
                await this.setCache(cacheKey, null);
                return null;
            }
            // branding_enabled is false even though eligible; return disabled config
            const config: IBrandingConfig = {
                primaryColor: org.primary_color,
                secondaryColor: org.secondary_color,
                logoUrl: org.branding_logo_url,
                enabled: false,
            };
            await this.setCache(cacheKey, config);
            return config;
        }

        const config: IBrandingConfig = {
            primaryColor: org.primary_color,
            secondaryColor: org.secondary_color,
            logoUrl: org.branding_logo_url,
            enabled: true,
        };

        await this.setCache(cacheKey, config);
        return config;
    }

    /**
     * Get branding config for a project's org. Used by public dashboard/report endpoints.
     */
    async getBrandingForProject(projectId: number): Promise<IBrandingConfig | null> {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) return null;

        const concreteDriver = await driver.getConcreteDriver();
        if (!concreteDriver?.manager) return null;

        const result = await concreteDriver.manager.query(
            `SELECT p.organization_id FROM dra_projects p WHERE p.id = $1`,
            [projectId]
        );

        if (!result || result.length === 0) return null;

        return this.getBranding(result[0].organization_id);
    }

    /**
     * Update branding settings for an organization.
     * Only admins/owners should call this (enforced at route level).
     */
    async updateBranding(
        orgId: number,
        data: {
            primaryColor?: string | null;
            secondaryColor?: string | null;
            brandingEnabled?: boolean;
            logoUrl?: string | null;
        }
    ): Promise<IBrandingConfig> {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) throw new Error('Database driver not available');

        const concreteDriver = await driver.getConcreteDriver();
        if (!concreteDriver?.manager) throw new Error('Database manager not available');

        const org = await concreteDriver.manager.findOne(DRAOrganization, { where: { id: orgId } });
        if (!org) throw new Error('Organization not found');

        if (data.primaryColor !== undefined) {
            if (data.primaryColor !== null && !this.validateHexColor(data.primaryColor)) {
                throw new Error('Invalid primary color format. Must be a hex color (e.g., #3C8DBC)');
            }
            org.primary_color = data.primaryColor;
        }

        if (data.secondaryColor !== undefined) {
            if (data.secondaryColor !== null && !this.validateHexColor(data.secondaryColor)) {
                throw new Error('Invalid secondary color format. Must be a hex color (e.g., #1E3050)');
            }
            org.secondary_color = data.secondaryColor;
        }

        if (data.logoUrl !== undefined) {
            org.branding_logo_url = data.logoUrl;
        }

        if (data.brandingEnabled !== undefined) {
            org.branding_enabled = data.brandingEnabled;
        }

        await concreteDriver.manager.save(org);

        const config: IBrandingConfig = {
            primaryColor: org.primary_color,
            secondaryColor: org.secondary_color,
            logoUrl: org.branding_logo_url,
            enabled: org.branding_enabled,
        };

        await this.setCache(this.getCacheKey(orgId), config);

        return config;
    }

    private async setCache(key: string, value: IBrandingConfig | null): Promise<void> {
        try {
            if (value === null) {
                await this.redis.setex(key, BRANDING_CACHE_TTL, JSON.stringify(null));
            } else {
                await this.redis.setex(key, BRANDING_CACHE_TTL, JSON.stringify(value));
            }
        } catch (err) {
            console.warn('[BrandingService] Redis write failed:', err);
        }
    }

    /**
     * Invalidate branding cache for an org. Call after tier changes, branding updates, etc.
     */
    async invalidateCache(orgId: number): Promise<void> {
        try {
            await this.redis.del(this.getCacheKey(orgId));
        } catch (err) {
            console.warn('[BrandingService] Cache invalidation failed:', err);
        }
    }
}
