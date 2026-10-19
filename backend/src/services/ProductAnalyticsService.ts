import { getAppDataSource } from '../datasources/PostgresDS.js';
import { DRAProductEvent } from '../models/DRAProductEvent.js';

export interface IProductEventInput {
    eventName: string;
    userId?: number | null;
    organizationId?: number | null;
    workspaceId?: number | null;
    projectId?: number | null;
    planId?: number | null;
    properties?: Record<string, any> | null;
    sessionId?: string | null;
    source?: 'backend' | 'frontend';
    timestamp?: Date;
}

const PII_PATTERN = /(^|[^a-z0-9])([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/gi;

export class ProductAnalyticsService {
    private static instance: ProductAnalyticsService;

    private constructor() {}

    public static getInstance(): ProductAnalyticsService {
        if (!ProductAnalyticsService.instance) {
            ProductAnalyticsService.instance = new ProductAnalyticsService();
        }
        return ProductAnalyticsService.instance;
    }

    public stripPII(value: unknown, depth = 0): unknown {
        if (depth > 6) return value;
        if (typeof value === 'string') {
            return value.replace(PII_PATTERN, '$1[redacted]');
        }
        if (Array.isArray(value)) {
            return value.map((item) => this.stripPII(item, depth + 1));
        }
        if (value && typeof value === 'object') {
            const cleaned: Record<string, any> = {};
            for (const [key, val] of Object.entries(value as Record<string, any>)) {
                const lowerKey = key.toLowerCase();
                if (['email', 'token', 'password', 'authorization', 'secret', 'api_key', 'apikey'].includes(lowerKey)) {
                    continue;
                }
                cleaned[key] = this.stripPII(val, depth + 1);
            }
            return cleaned;
        }
        return value;
    }

    public async record(input: IProductEventInput): Promise<void> {
        if (process.env.PLAN_ANALYTICS_ENABLED === 'false') return;

        const repository = (await getAppDataSource()).getRepository(DRAProductEvent);
        const event = repository.create({
            user_id: input.userId ?? null,
            organization_id: input.organizationId ?? null,
            workspace_id: input.workspaceId ?? null,
            project_id: input.projectId ?? null,
            plan_id: input.planId ?? null,
            event_name: input.eventName,
            properties: (this.stripPII(input.properties ?? {}) as Record<string, any>) ?? null,
            session_id: input.sessionId ?? null,
            source: input.source ?? 'backend',
        });
        if (input.timestamp) {
            event.created_at = input.timestamp;
        }
        await repository.save(event);
    }

    public async recordBatch(inputs: IProductEventInput[]): Promise<void> {
        if (process.env.PLAN_ANALYTICS_ENABLED === 'false' || inputs.length === 0) return;

        const repository = (await getAppDataSource()).getRepository(DRAProductEvent);
        const events = inputs.map((input) => {
            const event = repository.create({
                user_id: input.userId ?? null,
                organization_id: input.organizationId ?? null,
                workspace_id: input.workspaceId ?? null,
                project_id: input.projectId ?? null,
                plan_id: input.planId ?? null,
                event_name: input.eventName,
                properties: (this.stripPII(input.properties ?? {}) as Record<string, any>) ?? null,
                session_id: input.sessionId ?? null,
                source: input.source ?? 'frontend',
            });
            if (input.timestamp) {
                event.created_at = input.timestamp;
            }
            return event;
        });
        await repository.save(events);
    }
}
