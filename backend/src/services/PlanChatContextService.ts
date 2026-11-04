import { PlanStateService } from './PlanStateService.js';
import { PaidMediaPlanService } from './PaidMediaPlanService.js';
import { PlanArtifactService } from './PlanArtifactService.js';
import type { IPlanArtifact, IPlanStep } from '../types/IPaidMediaPlan.js';

const TEXT_KINDS = new Set(['markdown', 'json', 'csv', 'html']);
// Two-tier chat context:
// 1) A compact plan index — state facts, the step list, and one abstract per
//    deliverable — is ALWAYS injected, so the model knows what exists and can
//    answer broad questions from the index alone.
// 2) The FULL text of only the deliverables the question targets is retrieved
//    on demand and appended. The highest-ranked deliverable (the one the user
//    is most likely asking to modify) is always injected in full so the model
//    can rewrite it wholesale into a json-change block. Stuffing every
//    deliverable into the prompt grows without bound and drowns specific
//    answers (a question about "10-media-plan" was previously answered "not in
//    context" because the tail of the prompt was truncated).
const TOTAL_BUDGET_CHARS = Number(process.env.PLAN_CHAT_CONTEXT_BUDGET ?? 150000);
const INDEX_STATE_CHARS = 10000;
const INDEX_ARTIFACT_ABSTRACT_CHARS = 2000;
const RETRIEVAL_ARTIFACT_CHARS = 15000;
const RETRIEVAL_TOP_K = 3;
const MAX_ARTIFACTS_IN_CONTEXT = 30;

export interface IPlanChangeBlock {
    artifactKey: string;
    content: string;
    title?: string;
}

export interface IPlanChatContext {
    markdown: string;
    steps: IPlanStep[];
    artifacts: IPlanArtifact[];
}

export class PlanChatContextService {
    private static instance: PlanChatContextService;

    private constructor() {}

    public static getInstance(): PlanChatContextService {
        if (!PlanChatContextService.instance) {
            PlanChatContextService.instance = new PlanChatContextService();
        }
        return PlanChatContextService.instance;
    }

    /**
     * Build the chat context for a plan.
     *
     * Without a question this returns the compact plan index only. With a
     * question, the deliverables most likely to contain the answer are
     * retrieved and their full text is appended, so the model answers from the
     * targeted content instead of a diluted mega-prompt.
     */
    public async buildContext(planId: number, question?: string): Promise<IPlanChatContext> {
        const [stateMarkdown, steps, artifacts] = await Promise.all([
            PlanStateService.getInstance().projectToMarkdown(planId, false),
            PaidMediaPlanService.getInstance().listSteps(planId),
            PlanArtifactService.getInstance().list(planId, true),
        ]);

        const ordered = [...artifacts].sort((a, b) => (a.stepId ?? 0) - (b.stepId ?? 0) || a.artifactKey.localeCompare(b.artifactKey));
        const textArtifacts = ordered.filter((a) => TEXT_KINDS.has(a.kind)).slice(0, MAX_ARTIFACTS_IN_CONTEXT);

        // ---- Compact plan index (always injected) ----
        const index: string[] = [];
        index.push(stateMarkdown.trimEnd().slice(0, INDEX_STATE_CHARS));

        if (steps.length > 0) {
            index.push('');
            index.push('## Steps');
            index.push('');
            for (const step of steps) {
                const summary = (step.outputSummary ?? '').replace(/\n/g, ' ').slice(0, 300);
                index.push(`- [${step.stepNumber}] ${step.stepKey} — ${step.title} — ${step.status}${summary ? ` — ${summary}` : ''}`);
            }
        }

        if (textArtifacts.length > 0) {
            index.push('');
            index.push('## Step deliverables (abstracts)');
            index.push('');
            for (const artifact of textArtifacts) {
                const step = steps.find((s) => s.id === artifact.stepId);
                const stepLabel = step ? `${step.stepNumber}. ${step.title}` : 'Plan-level';
                index.push(`### ${artifact.title} (${artifact.artifactKey}, v${artifact.version}, ${stepLabel})`);
                index.push('');
                const abstract = (artifact.content ?? '').replace(/\s+/g, ' ').trim().slice(0, INDEX_ARTIFACT_ABSTRACT_CHARS);
                index.push(abstract ? abstract : '_empty_');
                index.push('');
            }
        }

        // ---- On-demand retrieval (targeted by the user's question) ----
        const retrieved = question?.trim()
            ? this.rankArtifacts(question, textArtifacts, steps).slice(0, RETRIEVAL_TOP_K)
            : [];

        const indexMarkdown = index.join('\n').trim();
        // The highest-ranked deliverable gets the full prompt budget so its
        // complete content is available for a wholesale rewrite; secondary
        // matches share a cap that shrinks first when the prompt runs over.
        const primaryCap = Math.max(0, TOTAL_BUDGET_CHARS - indexMarkdown.length);
        let secondaryCap = RETRIEVAL_ARTIFACT_CHARS;
        for (;;) {
            const extra: string[] = [];
            if (retrieved.length > 0) {
                extra.push('');
                extra.push('## Retrieved deliverable content (targeted by your question)');
                extra.push('');
                for (let i = 0; i < retrieved.length; i++) {
                    const artifact = retrieved[i];
                    const step = steps.find((s) => s.id === artifact.stepId);
                    const stepLabel = step ? `${step.stepNumber}. ${step.title}` : 'Plan-level';
                    extra.push(`### ${artifact.title} (${artifact.artifactKey}, v${artifact.version}, ${stepLabel})`);
                    extra.push('');
                    const cap = i === 0 ? primaryCap : secondaryCap;
                    const content = (artifact.content ?? '').slice(0, cap);
                    extra.push(content.trim() ? content : '_empty_');
                    extra.push('');
                }
            }

            const markdown = index.concat(extra).join('\n').trim();
            const over = markdown.length - TOTAL_BUDGET_CHARS;
            if (over <= 0) {
                return { markdown, steps, artifacts };
            }
            const hasSecondary = retrieved.length > 1;
            if (!hasSecondary || secondaryCap <= 4000) {
                return { markdown: markdown.slice(0, TOTAL_BUDGET_CHARS), steps, artifacts };
            }
            secondaryCap = Math.max(4000, Math.floor(secondaryCap * 0.8));
        }
    }

    // ===== Lightweight retrieval =====

    private readonly STOP_WORDS = new Set([
        'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'else', 'of', 'to', 'in', 'on', 'for',
        'with', 'about', 'at', 'by', 'from', 'up', 'out', 'over', 'under', 'is', 'are', 'was', 'were',
        'be', 'been', 'being', 'do', 'does', 'did', 'have', 'has', 'had', 'will', 'would', 'can',
        'could', 'should', 'shall', 'may', 'might', 'must', 'what', 'which', 'when', 'where', 'who',
        'whom', 'whose', 'why', 'how', 'this', 'that', 'these', 'those', 'it', 'its', 'they', 'them',
        'their', 'there', 'here', 'we', 'our', 'you', 'your', 'i', 'me', 'my', 'he', 'she', 'him',
        'her', 'his', 'hers', 'not', 'no', 'yes', 'all', 'any', 'each', 'some', 'please', 'tell',
        'show', 'give', 'get', 'want', 'like', 'more', 'also', 'say', 'see', 'look', 'know', 'need',
    ]);

    private tokenize(text: string): string[] {
        return text.toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter((t) => t.length > 2 && !this.STOP_WORDS.has(t));
    }

    /**
     * Rank deliverables by how well they match the question. The score uses
     * token overlap against the artifact key, title, owning step, and the
     * abstract, with an explicit boost when the question names the key
     * (e.g. "10-media-plan"). Zero-score artifacts are dropped.
     */
    private rankArtifacts(question: string, artifacts: IPlanArtifact[], steps: IPlanStep[]): IPlanArtifact[] {
        const questionTokens = [...new Set(this.tokenize(question))];
        if (questionTokens.length === 0) return [];

        const scored = artifacts.map((artifact) => {
            const step = steps.find((s) => s.id === artifact.stepId);
            const key = artifact.artifactKey ?? '';
            const title = artifact.title ?? '';
            const stepTitle = step?.title ?? '';
            const stepKey = step?.stepKey ?? '';
            const abstract = (artifact.content ?? '').slice(0, INDEX_ARTIFACT_ABSTRACT_CHARS);

            const hits = (text: string): number => this.tokenize(text).filter((t) => questionTokens.includes(t)).length;

            let score = 0;
            score += Math.min(hits(key), 4) * 6;
            score += Math.min(hits(title), 4) * 3;
            score += Math.min(hits(stepTitle), 4) * 3;
            score += Math.min(hits(stepKey), 4) * 3;
            score += Math.min(hits(abstract), 8) * 1;

            const keyParts = key.toLowerCase().split(/[^a-z0-9]/).filter(Boolean);
            if (questionTokens.some((t) => keyParts.includes(t))) {
                score += 10;
            }

            return { artifact, score };
        });

        return scored
            .filter((s) => s.score > 0)
            .sort((a, b) => b.score - a.score || (a.artifact.stepId ?? 0) - (b.artifact.stepId ?? 0))
            .map((s) => s.artifact);
    }

    /**
     * Extract a structured change request the assistant embedded in its answer.
     * Accepts a fenced ```json-change block, then falls back to a plain
     * ```json fence. Returns null when the answer is a discussion only.
     */
    public extractChangeBlock(answer: string): IPlanChangeBlock | null {
        const jsonChange = answer.match(/```json-change\s*\n([\s\S]*?)```/);
        if (jsonChange) {
            const parsed = this.parseBlock(jsonChange[1]);
            if (parsed) return parsed;
        }
        const jsonFence = answer.match(/```json\s*\n([\s\S]*?)```/);
        if (jsonFence) {
            const parsed = this.parseBlock(jsonFence[1]);
            if (parsed) return parsed;
        }
        return null;
    }

    private parseBlock(raw: string): IPlanChangeBlock | null {
        const trimmed = raw.trim();
        if (!trimmed) return null;
        const start = trimmed.indexOf('{');
        const end = trimmed.lastIndexOf('}');
        if (start === -1 || end === -1 || end <= start) return null;
        try {
            const parsed = JSON.parse(trimmed.slice(start, end + 1));
            const artifactKey = typeof parsed.artifactKey === 'string' ? parsed.artifactKey.trim() : '';
            const content = typeof parsed.content === 'string' ? parsed.content : '';
            if (!artifactKey || !content) return null;
            return {
                artifactKey,
                content,
                title: typeof parsed.title === 'string' ? parsed.title : undefined,
            };
        } catch {
            return null;
        }
    }

    /**
     * Remove an embedded change block from the text shown to the user.
     */
    public stripChangeBlock(answer: string): string {
        return answer
            .replace(/```json-change\s*\n[\s\S]*?```/g, '')
            .replace(/```json\s*\n[\s\S]*?```/g, '')
            .trim();
    }
}
