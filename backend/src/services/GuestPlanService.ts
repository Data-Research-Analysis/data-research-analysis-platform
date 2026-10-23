import crypto from 'crypto';
import { getRedisClient, RedisTTL } from '../config/redis.config.js';

/**
 * Guest plan access tokens.
 *
 * A guest plan is a real Postgres plan row (is_guest = true) that is
 * reachable only through a high-entropy token mapped in Redis with a 24h
 * TTL. The token lives in the guest's localStorage, so the plan expires
 * from access once the TTL lapses — the "plan lasts 24h unless you
 * register" lead-in contract.
 */

const TOKEN_KEY_PREFIX = 'guest-plan:token:';
const PLAN_KEY_PREFIX = 'guest-plan:plan:';
const GUEST_PLAN_TTL = RedisTTL.AI_SESSION; // 86400s = 24h

export class GuestPlanService {
    private static instance: GuestPlanService;

    private constructor() {}

    public static getInstance(): GuestPlanService {
        if (!GuestPlanService.instance) {
            GuestPlanService.instance = new GuestPlanService();
        }
        return GuestPlanService.instance;
    }

    public static resetInstance(): void {
        GuestPlanService.instance = null as any;
    }

    public generateToken(): string {
        return crypto.randomBytes(32).toString('base64url');
    }

    /** Bind a new token to a plan id with the 24h TTL. */
    public async bind(token: string, planId: number): Promise<void> {
        const redis = getRedisClient();
        await redis.setex(`${TOKEN_KEY_PREFIX}${token}`, GUEST_PLAN_TTL, String(planId));
        await redis.setex(`${PLAN_KEY_PREFIX}${planId}`, GUEST_PLAN_TTL, token);
    }

    /** Resolve a token to a plan id. Returns null when missing/expired. */
    public async resolve(token: string): Promise<number | null> {
        if (!token) return null;
        const redis = getRedisClient();
        const planId = await redis.get(`${TOKEN_KEY_PREFIX}${token}`);
        return planId ? parseInt(planId, 10) : null;
    }

    /** Find the current token for a plan id (used by the claim flow). */
    public async tokenForPlan(planId: number): Promise<string | null> {
        const redis = getRedisClient();
        return redis.get(`${PLAN_KEY_PREFIX}${planId}`);
    }

    /** Delete both bindings (on claim or cleanup). */
    public async revoke(token: string | null, planId: number | null): Promise<void> {
        const redis = getRedisClient();
        if (token) await redis.del(`${TOKEN_KEY_PREFIX}${token}`);
        if (planId) await redis.del(`${PLAN_KEY_PREFIX}${planId}`);
    }
}
