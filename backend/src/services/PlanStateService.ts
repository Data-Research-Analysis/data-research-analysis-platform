import { getAppDataSource } from '../datasources/PostgresDS.js';
import { DRAPaidMediaPlan } from '../models/DRAPaidMediaPlan.js';
import { IPlanState } from '../types/IPaidMediaPlan.js';

function isPlainObject(value: unknown): value is Record<string, any> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = { ...target };
    for (const [key, value] of Object.entries(source)) {
        if (isPlainObject(value) && isPlainObject(out[key])) {
            out[key] = deepMerge(out[key], value);
        } else {
            out[key] = value;
        }
    }
    return out;
}

export class PlanStateService {
    private static instance: PlanStateService;

    private constructor() {}

    public static getInstance(): PlanStateService {
        if (!PlanStateService.instance) {
            PlanStateService.instance = new PlanStateService();
        }
        return PlanStateService.instance;
    }

    public static resetInstance(): void {
        PlanStateService.instance = null as any;
    }

    public async get(planId: number): Promise<IPlanState> {
        const repository = (await getAppDataSource()).getRepository(DRAPaidMediaPlan);
        const plan = await repository.findOne({ where: { id: planId } });
        if (!plan) {
            throw new Error(`Plan not found: ${planId}`);
        }
        return (plan.state ?? {}) as IPlanState;
    }

    public async merge(planId: number, patch: Record<string, any>): Promise<IPlanState> {
        const repository = (await getAppDataSource()).getRepository(DRAPaidMediaPlan);
        const plan = await repository.findOne({ where: { id: planId } });
        if (!plan) {
            throw new Error(`Plan not found: ${planId}`);
        }
        const current = (plan.state ?? {}) as IPlanState;
        const merged = deepMerge(current as Record<string, any>, patch);
        plan.state = merged as IPlanState;
        await repository.save(plan);
        return plan.state;
    }

    public async replace(planId: number, state: IPlanState): Promise<IPlanState> {
        const repository = (await getAppDataSource()).getRepository(DRAPaidMediaPlan);
        const plan = await repository.findOne({ where: { id: planId } });
        if (!plan) {
            throw new Error(`Plan not found: ${planId}`);
        }
        plan.state = state;
        await repository.save(plan);
        return plan.state;
    }

    public async setVerification(
        planId: number,
        key: string,
        status: 'VERIFIED' | 'ESTIMATE' | 'NOT VERIFIED'
    ): Promise<IPlanState> {
        return this.merge(planId, { verification: { [key]: status } });
    }

    public validate(state: IPlanState): string[] {
        const errors: string[] = [];
        const verification = state.verification ?? {};
        for (const [key, value] of Object.entries(verification)) {
            if (!['VERIFIED', 'ESTIMATE', 'NOT VERIFIED'].includes(value)) {
                errors.push(`verification.${key} must be VERIFIED, ESTIMATE or NOT VERIFIED`);
            }
        }
        const budget = state.core_facts?.budget ?? {};
        if (budget && budget.total !== undefined) {
            const total = Number(budget.total);
            if (Number.isFinite(total) && total <= 0) {
                errors.push('core_facts.budget.total must be a positive number');
            }
        }
        return errors;
    }

    public async projectToMarkdown(planId: number, includeStepOutputs = true): Promise<string> {
        const repository = (await getAppDataSource()).getRepository(DRAPaidMediaPlan);
        const plan = await repository.findOne({ where: { id: planId } });
        if (!plan) {
            throw new Error(`Plan not found: ${planId}`);
        }
        return this.stateToMarkdown(plan.name, plan.state, includeStepOutputs);
    }

    /**
     * The facts the advanced-mode start form / Client Brief form already captured.
     * Rendered into the prompt so the model can see exactly which briefing items
     * are answered and stop re-asking them.
     */
    private briefingAnsweredFields(name: string, state: IPlanState): Array<[string, string]> {
        const core = (state.core_facts ?? {}) as Record<string, any>;
        const company = (core.company ?? {}) as Record<string, any>;
        const budget = (core.budget ?? {}) as Record<string, any>;
        const dates = (core.dates ?? {}) as Record<string, any>;
        const funnel = (state.funnel_and_scale ?? {}) as Record<string, any>;

        const text = (value: any): string => {
            if (value === null || value === undefined || value === '') return '';
            if (Array.isArray(value)) {
                return value
                    .map((item) => {
                        if (item && typeof item === 'object') return item.name ?? item.label ?? '';
                        return String(item ?? '');
                    })
                    .filter((item) => item.trim().length > 0)
                    .join(', ');
            }
            if (typeof value === 'object') {
                return Object.entries(value)
                    .filter(([, v]) => v !== null && v !== undefined && v !== '')
                    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
                    .join(' · ');
            }
            return String(value);
        };

        const budgetText =
            budget.total !== null && budget.total !== undefined && budget.total !== ''
                ? `${budget.total} ${budget.currency ?? ''}`.trim()
                : '';
        const datesText = dates.start || dates.end ? `${dates.start ?? '?'} → ${dates.end ?? '?'}` : '';

        const candidates: Array<[string, string]> = [
            ['Company / brand name and website', [name, text(core.website)].filter(Boolean).join(' — ')],
            ['Product or service', text(company.product_service)],
            ['Industry / category', text(core.industry)],
            ['Target markets', text(core.markets)],
            ['Ad platforms', text(core.platforms)],
            ['Media budget and currency', budgetText],
            ['Campaign dates / test window', datesText],
            ['Funnel coverage', text(funnel.coverage)],
            ['Build mode', text(funnel.build_mode)],
            ['Competitors', text(core.competitors)],
            ['Existing channels / social profiles', text(company.channels)],
            ['Team size', text(company.team_size)],
            ['Additional notes', text(core.notes)],
        ];

        return candidates.filter(([, value]) => value.trim().length > 0);
    }

    public stateToMarkdown(name: string, state: IPlanState, includeStepOutputs = true): string {
        const lines: string[] = [];
        lines.push(`# Plan state — ${name}`);
        lines.push('');
        const clientBrief = (state.client_brief ?? '').trim();
        if (clientBrief) {
            lines.push('## Client brief (authoritative — set via the Client Brief form)');
            lines.push('');
            lines.push(clientBrief);
            lines.push('');
            const answered = this.briefingAnsweredFields(name, state);
            if (answered.length > 0) {
                lines.push('## Client briefing form — already answered (DO NOT ASK AGAIN)');
                lines.push('');
                lines.push(
                    'The client supplied the facts below in the plan start form / Client Brief. Treat every one as answered: never call ask_user for any of them, and never ask a question that maps to one of them. Only ask for a briefing item that is genuinely absent from this list, from the state above, and from the prior deliverables.'
                );
                lines.push('');
                for (const [label, value] of answered) {
                    lines.push(`- **${label}:** ${value}`);
                }
                lines.push('');
            }
        }
        const userNotes = state.user_notes ?? [];
        if (userNotes.length > 0) {
            lines.push('## Client-supplied information (from chat)');
            lines.push('');
            lines.push('The client already provided the facts below. Use them instead of asking again; treat them as authoritative where they overlap with assumptions.');
            lines.push('');
            for (const note of userNotes) {
                const noteText = note.text.trim();
                if (!noteText) continue;
                const source = note.source === 'gate_answer' ? 'gate answer' : 'chat';
                lines.push(`- [${source}] ${noteText.replace(/\n/g, '\n  ').slice(0, 4000)}`);
            }
            lines.push('');
        }
        const coreFacts = state.core_facts ?? {};
        lines.push('## Core facts');
        lines.push('');
        for (const [key, value] of Object.entries(coreFacts)) {
            if (Array.isArray(value)) {
                lines.push(`- **${key}:** ${value.join(', ')}`);
            } else if (value && typeof value === 'object') {
                const inner = Object.entries(value as Record<string, any>)
                    .filter(([, v]) => v !== null && v !== undefined && v !== '')
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(' · ');
                if (inner) lines.push(`- **${key}:** ${inner}`);
            } else if (value !== null && value !== undefined && value !== '') {
                lines.push(`- **${key}:** ${value}`);
            }
        }
        lines.push('');
        const funnel = state.funnel_and_scale ?? {};
        lines.push('## Funnel and scale');
        lines.push('');
        for (const [key, value] of Object.entries(funnel)) {
            if (value && typeof value === 'object') {
                lines.push(`- **${key}:** ${JSON.stringify(value)}`);
            } else if (value !== null && value !== undefined && value !== '') {
                lines.push(`- **${key}:** ${value}`);
            }
        }
        lines.push('');
        lines.push('## Verification');
        lines.push('');
        const verification = state.verification ?? {};
        if (Object.keys(verification).length === 0) {
            lines.push('- _none yet_');
        } else {
            for (const [key, value] of Object.entries(verification)) {
                lines.push(`- **${key}:** ${value}`);
            }
        }
        if (includeStepOutputs) {
            const stepOutputs = state.step_outputs ?? {};
            if (Object.keys(stepOutputs).length > 0) {
                lines.push('');
                lines.push('## Step outputs');
                lines.push('');
                for (const [stepKey, output] of Object.entries(stepOutputs)) {
                    lines.push(`- **${stepKey}:** artifact=${output.artifact ?? '-'}`);
                }
            }
        }
        lines.push('');
        return lines.join('\n');
    }
}
