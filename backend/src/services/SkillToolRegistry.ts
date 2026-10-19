import { getAppDataSource } from '../datasources/PostgresDS.js';
import { IGenAIToolDefinition } from './GeminiService.js';
import { ISkillManifest } from './SkillRegistryService.js';
import { PlanStateService } from './PlanStateService.js';
import { PlanArtifactService } from './PlanArtifactService.js';
import { PlanScriptSandbox } from './PlanScriptSandbox.js';
import { SearchProvider } from './SearchProvider.js';
import { DRADataSource } from '../models/DRADataSource.js';
import { DRACampaign } from '../models/DRACampaign.js';
import { DRAPlanBenchmark } from '../models/DRAPlanBenchmark.js';
import { normalizePlatform } from './PlanBenchmarkService.js';

export interface ISkillToolContext {
    planId: number;
    stepId: number | null;
    stepKey: string;
    projectId: number;
    organizationId: number;
    workspaceId: number;
    userId: number;
    askUser: (args: { question: string; options?: Array<{ label: string; value: string }>; purpose?: 'info' | 'confirm'; context?: Record<string, any> }) => Promise<Record<string, any>>;
}

const AD_SOURCE_TYPES = ['google_ads', 'google_analytics', 'google_ad_manager', 'meta_ads', 'linkedin_ads', 'hubspot', 'klaviyo'];

const TOOL_DEFINITIONS: Record<string, IGenAIToolDefinition> = {
    web_search: {
        name: 'web_search',
        description: 'Search the web for current facts, benchmarks, competitors, or market data. Returns a grounded summary and source URLs.',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'The search query, specific and fact-seeking.' },
                limit: { type: 'number', description: 'Maximum number of sources (default 8).' },
            },
            required: ['query'],
        },
    },
    web_fetch: {
        name: 'web_fetch',
        description: 'Fetch a URL and return its readable text content, truncated to a safe size. Use for the company website, landing pages, competitor pages.',
        parameters: {
            type: 'object',
            properties: {
                url: { type: 'string', description: 'The URL to fetch.' },
                maxChars: { type: 'number', description: 'Maximum characters to return (default 12000).' },
            },
            required: ['url'],
        },
    },
    read_state: {
        name: 'read_state',
        description: 'Read the full structured plan state. Use at the start of every step to see core facts and earlier outputs.',
        parameters: { type: 'object', properties: {}, required: [] },
    },
    write_state: {
        name: 'write_state',
        description: 'Merge structured facts into the plan state. Values under verification must be VERIFIED, ESTIMATE or NOT VERIFIED with a source.',
        parameters: {
            type: 'object',
            properties: {
                patch: { type: 'object', description: 'Partial state object merged into the plan state.' },
            },
            required: ['patch'],
        },
    },
    read_artifact: {
        name: 'read_artifact',
        description: 'Read the current version of a previously generated deliverable by its artifact key (e.g. "01-creative-brief", "02-market-research").',
        parameters: {
            type: 'object',
            properties: {
                artifactKey: { type: 'string', description: 'The artifact key to read.' },
            },
            required: ['artifactKey'],
        },
    },
    write_artifact: {
        name: 'write_artifact',
        description: 'Write a deliverable file for this step. The content is the complete deliverable, saved as a new version.',
        parameters: {
            type: 'object',
            properties: {
                artifactKey: { type: 'string', description: 'The artifact key from the step manifest.' },
                title: { type: 'string', description: 'Human-readable deliverable title.' },
                kind: { type: 'string', enum: ['markdown', 'json', 'csv', 'html'], description: 'Deliverable format.' },
                content: { type: 'string', description: 'The full deliverable content.' },
            },
            required: ['artifactKey', 'title', 'content'],
        },
    },
    ask_user: {
        name: 'ask_user',
        description: 'Ask the user one focused question and stop. Use for gates and for any fact the plan cannot determine. Return the question and 2-3 option labels. Never ask for secrets, credentials, API keys, tokens, passwords, or tracking IDs (GA4 Measurement ID, GTM Container ID, Meta Pixel ID); ask only whether a setup exists and use placeholders in the deliverable.',
        parameters: {
            type: 'object',
            properties: {
                question: { type: 'string', description: 'The focused question for the user.' },
                options: {
                    type: 'array',
                    items: { type: 'object', properties: { label: { type: 'string' }, value: { type: 'string' } } },
                    description: '2-3 suggested answers as option buttons.',
                },
                purpose: {
                    type: 'string',
                    enum: ['info', 'confirm'],
                    description: 'Use "confirm" only for the step confirmation gate after the deliverable exists. Use "info" for any missing fact.',
                },
            },
            required: ['question'],
        },
    },
    query_marketing_metrics: {
        name: 'query_marketing_metrics',
        description: 'Query real marketing performance context from the connected accounts: campaigns, targets, spend. Returns campaign summaries for the project.',
        parameters: {
            type: 'object',
            properties: {
                scope: { type: 'string', description: 'Optional scope, e.g. "campaigns".' },
            },
            required: [],
        },
    },
    list_connected_accounts: {
        name: 'list_connected_accounts',
        description: 'List the ad platforms connected to this project (Google Ads, Meta, LinkedIn, GA4, HubSpot, Klaviyo).',
        parameters: { type: 'object', properties: {}, required: [] },
    },
    read_benchmarks: {
        name: 'read_benchmarks',
        description: 'Read learned benchmarks for forecasting (CPC, CPM, CTR, CVR, CPL, ROAS, CPA) by industry, market and platform.',
        parameters: {
            type: 'object',
            properties: {
                industry: { type: 'string' },
                market: { type: 'string' },
                platform: { type: 'string' },
            },
            required: [],
        },
    },
    run_script: {
        name: 'run_script',
        description: 'Run a registered build script to generate a binary deliverable (xlsx or pptx). Only registered script ids are allowed.',
        parameters: {
            type: 'object',
            properties: {
                scriptId: { type: 'string', description: 'Registered script id: media-plan-xlsx, setup-checklist-xlsx or strategy-deck-pptx.' },
                inputs: { type: 'object', description: 'Structured inputs for the script.' },
            },
            required: ['scriptId'],
        },
    },
};

function isAdSource(dataType: string): boolean {
    return AD_SOURCE_TYPES.includes(dataType);
}

export class SkillToolRegistry {
    private static instance: SkillToolRegistry;

    private constructor() {}

    public static getInstance(): SkillToolRegistry {
        if (!SkillToolRegistry.instance) {
            SkillToolRegistry.instance = new SkillToolRegistry();
        }
        return SkillToolRegistry.instance;
    }

    public getToolDefinitions(manifest: ISkillManifest): IGenAIToolDefinition[] {
        return (manifest.tools ?? [])
            .map((name) => TOOL_DEFINITIONS[name])
            .filter((definition): definition is IGenAIToolDefinition => Boolean(definition));
    }

    public async execute(name: string, args: any, ctx: ISkillToolContext): Promise<any> {
        switch (name) {
            case 'web_search': {
                const result = await SearchProvider.getInstance().search(String(args.query ?? ''), Number(args.limit ?? 8));
                return { summary: result.summary, sources: result.sources.slice(0, Number(args.limit ?? 8)) };
            }
            case 'web_fetch': {
                return this.fetchUrl(String(args.url ?? ''), Number(args.maxChars ?? 12000));
            }
            case 'read_state': {
                const state = await PlanStateService.getInstance().get(ctx.planId);
                return state;
            }
            case 'write_state': {
                const state = await PlanStateService.getInstance().merge(ctx.planId, args.patch ?? {});
                return { ok: true, state };
            }
            case 'read_artifact': {
                const artifact = await PlanArtifactService.getInstance().getCurrentByKey(ctx.planId, String(args.artifactKey ?? ''));
                if (!artifact) {
                    const available = (await PlanArtifactService.getInstance().list(ctx.planId))
                        .filter((item) => item.isCurrent)
                        .map((item) => item.artifactKey);
                    return {
                        error: `Artifact ${args.artifactKey} not found`,
                        availableArtifactKeys: available,
                    };
                }
                return { key: artifact.artifactKey, title: artifact.title, kind: artifact.kind, content: artifact.content ?? null };
            }
            case 'write_artifact': {
                const kind = ['markdown', 'json', 'csv', 'html'].includes(args.kind) ? args.kind : 'markdown';
                const artifact = await PlanArtifactService.getInstance().create({
                    planId: ctx.planId,
                    stepId: ctx.stepId,
                    artifactKey: String(args.artifactKey ?? ''),
                    title: String(args.title ?? ''),
                    kind,
                    content: String(args.content ?? ''),
                });
                return { ok: true, artifactId: artifact.id, artifactKey: artifact.artifactKey, version: artifact.version };
            }
            case 'ask_user': {
                const question = String(args.question ?? '');
                const privateIdPatterns = [
                    /measurement\s*id/i,
                    /container\s*id/i,
                    /pixel\s*id/i,
                    /api\s*key/i,
                    /access\s*token/i,
                    /password/i,
                    /\bsecret\b/i,
                    /credential/i,
                ];
                if (privateIdPatterns.some((pattern) => pattern.test(question))) {
                    return {
                        error: 'Do not ask for private IDs or credentials (GA4 Measurement ID, GTM Container ID, Meta Pixel ID, API keys, tokens, passwords). Ask only whether the setup already exists, and use placeholders such as <GA4_MEASUREMENT_ID>, <GTM_CONTAINER_ID>, and <META_PIXEL_ID> in the deliverable.',
                    };
                }
                const rawOptions = Array.isArray(args.options) ? args.options : [];
                const options = rawOptions
                    .map((o: any) => {
                        if (typeof o === 'string') return { label: o, value: o };
                        const label = String(o?.label ?? o?.value ?? '').trim();
                        return { label, value: String(o?.value ?? label).trim() };
                    })
                    .filter((o) => o.label.length > 0);
                return ctx.askUser({
                    question,
                    options: options.length > 0 ? options : undefined,
                    purpose: args.purpose === 'confirm' ? 'confirm' : 'info',
                });
            }
            case 'query_marketing_metrics': {
                return this.queryCampaigns(ctx.projectId);
            }
            case 'list_connected_accounts': {
                return this.listConnectedAccounts(ctx.projectId, ctx.organizationId, ctx.workspaceId);
            }
            case 'read_benchmarks': {
                return this.readBenchmarks(args.industry, args.market, args.platform);
            }
            case 'run_script': {
                return this.runScript(ctx, args.scriptId, args.inputs ?? {});
            }
            default:
                return { error: `Unknown tool: ${name}` };
        }
    }

    private async runScript(ctx: ISkillToolContext, scriptId: string, inputs: Record<string, any>): Promise<any> {
        if (typeof scriptId !== 'string' || !scriptId) {
            return { error: 'scriptId is required' };
        }
        const result = await PlanScriptSandbox.getInstance().run(ctx.planId, ctx.stepId, scriptId, inputs ?? {});
        if (!result.ok) {
            return { error: result.error };
        }
        const artifact = await PlanArtifactService.getInstance().registerBinary({
            planId: ctx.planId,
            stepId: ctx.stepId,
            artifactKey: result.artifactKey!,
            title: result.artifactKey === '10-media-plan-xlsx'
                ? 'Media plan (xlsx)'
                : result.artifactKey === '13-setup-checklist-xlsx'
                    ? 'Setup checklist (xlsx)'
                    : 'Digital marketing strategy deck',
            kind: result.filename?.endsWith('.pptx') ? 'pptx' : 'xlsx',
            storageKey: result.storagePath,
            byteSize: result.byteSize,
            metadata: { scriptId, generatedBy: 'plan_script_sandbox' },
        });
        return { ok: true, artifactId: artifact.id, artifactKey: artifact.artifactKey, version: artifact.version, filename: result.filename };
    }

    private async fetchUrl(url: string, maxChars: number): Promise<any> {
        if (!/^https?:\/\//i.test(url)) {
            return { error: 'Invalid URL. Use a full http(s) URL.' };
        }
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 20000);
            const response = await fetch(url, { signal: controller.signal, redirect: 'follow' });
            clearTimeout(timeout);
            if (!response.ok) {
                return { error: `Fetch failed with status ${response.status}` };
            }
            const html = await response.text();
            const text = html
                .replace(/<script[\s\S]*?<\/script>/gi, ' ')
                .replace(/<style[\s\S]*?<\/style>/gi, ' ')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            const body = text.length > maxChars ? `${text.slice(0, maxChars)}…` : text;
            return { url, text: body, byteCount: html.length };
        } catch (error: any) {
            return { error: error.message ?? 'Fetch failed' };
        }
    }

    private async queryCampaigns(projectId: number): Promise<any> {
        const dataSource = await getAppDataSource();
        const rows = await dataSource.getRepository(DRACampaign).find({
            where: { project_id: projectId },
            order: { updated_at: 'DESC' },
            take: 50,
        });
        return {
            campaigns: rows.map((c) => ({
                id: c.id,
                name: c.name,
                status: c.status,
                objective: c.objective,
                budget_total: c.budget_total !== null ? Number(c.budget_total) : null,
                target_leads: c.target_leads,
                target_cpl: c.target_cpl !== null ? Number(c.target_cpl) : null,
                target_roas: c.target_roas !== null ? Number(c.target_roas) : null,
                plan_id: c.plan_id,
            })),
        };
    }

    private async listConnectedAccounts(projectId: number, organizationId: number, workspaceId: number): Promise<any> {
        const dataSource = await getAppDataSource();
        const rows = await dataSource.getRepository(DRADataSource).find({
            where: { project: { id: projectId }, organization_id: organizationId, workspace_id: workspaceId },
        });
        const adAccounts = rows.filter((row) => isAdSource(row.data_type) || row.classification === 'marketing');
        return {
            accounts: adAccounts.map((row) => ({
                id: row.id,
                name: row.name,
                type: row.data_type,
                classification: row.classification,
            })),
        };
    }

    private async readBenchmarks(industry?: string, market?: string, platform?: string): Promise<any> {
        const dataSource = await getAppDataSource();
        const query = dataSource.getRepository(DRAPlanBenchmark).createQueryBuilder('benchmark');
        if (industry) query.andWhere('benchmark.industry IN (:...industries)', { industries: [industry, 'generic'] });
        if (market) query.andWhere('benchmark.market = :market', { market });
        if (platform) query.andWhere('benchmark.platform = :platform', { platform: normalizePlatform(platform) });
        const rows = await query.orderBy('benchmark.updated_at', 'DESC').take(100).getMany();
        return {
            benchmarks: rows.map((row) => ({
                industry: row.industry,
                market: row.market,
                platform: row.platform,
                metric: row.metric,
                value: Number(row.value),
                sampleSize: row.sample_size,
                source: row.source,
                confidence: Number(row.confidence),
            })),
        };
    }
}
