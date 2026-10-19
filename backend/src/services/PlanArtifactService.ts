import { getAppDataSource } from '../datasources/PostgresDS.js';
import { DRAPaidMediaPlanArtifact } from '../models/DRAPaidMediaPlanArtifact.js';
import { PlanArtifactKind, PlanArtifactSource, IPlanArtifact } from '../types/IPaidMediaPlan.js';

export interface ICreateArtifactInput {
    planId: number;
    stepId?: number | null;
    artifactKey: string;
    title: string;
    kind: PlanArtifactKind;
    mimeType?: string;
    content?: string | null;
    storageKey?: string | null;
    metadata?: Record<string, any> | null;
    source?: PlanArtifactSource;
}

const MIME_BY_KIND: Record<PlanArtifactKind, string> = {
    markdown: 'text/markdown',
    json: 'application/json',
    csv: 'text/csv',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    html: 'text/html',
    image: 'image/png',
};

/**
 * Some models return a deliverable as a JSON-escaped string, so literal `\n`
 * and `\'` sequences arrive instead of real line breaks and apostrophes. This
 * makes the whole document render as one giant heading/paragraph. Decode those
 * sequences only when they clearly dominate (i.e. the text has almost no real
 * newlines), so legitimate escapes inside code snippets are left alone.
 */
function normalizeTextContent(content: string): string {
    const realNewlines = (content.match(/\n/g) ?? []).length;
    const literalNewlines = (content.match(/\\n/g) ?? []).length;
    if (literalNewlines === 0 || realNewlines > literalNewlines / 2) return content;

    return content
        .replace(/\\r\\n/g, '\n')
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\'/g, "'")
        .replace(/\\"/g, '"');
}

function toDTO(row: DRAPaidMediaPlanArtifact): IPlanArtifact {    return {
        id: row.id,
        planId: row.plan_id,
        stepId: row.step_id,
        artifactKey: row.artifact_key,
        title: row.title,
        kind: row.kind,
        mimeType: row.mime_type,
        content: row.content,
        storageKey: row.storage_key,
        byteSize: row.byte_size,
        version: row.version,
        isCurrent: row.is_current,
        source: row.source,
        metadata: row.metadata,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
    };
}

export class PlanArtifactService {
    private static instance: PlanArtifactService;

    private constructor() {}

    public static getInstance(): PlanArtifactService {
        if (!PlanArtifactService.instance) {
            PlanArtifactService.instance = new PlanArtifactService();
        }
        return PlanArtifactService.instance;
    }

    public static resetInstance(): void {
        PlanArtifactService.instance = null as any;
    }

    public async create(input: ICreateArtifactInput): Promise<IPlanArtifact> {
        const repository = (await getAppDataSource()).getRepository(DRAPaidMediaPlanArtifact);

        const content = input.content && (input.source ?? 'ai') === 'ai'
            ? normalizeTextContent(input.content)
            : input.content;

        const previous = await repository.findOne({
            where: { plan_id: input.planId, artifact_key: input.artifactKey, is_current: true },
        });
        const version = previous ? previous.version + 1 : 1;

        if (previous) {
            previous.is_current = false;
            await repository.save(previous);
        }

        const row = repository.create({
            plan_id: input.planId,
            step_id: input.stepId ?? null,
            artifact_key: input.artifactKey,
            title: input.title,
            kind: input.kind,
            mime_type: input.mimeType ?? MIME_BY_KIND[input.kind],
            content: content ?? null,
            storage_key: input.storageKey ?? null,
            byte_size: content ? Buffer.byteLength(content, 'utf-8') : 0,
            version,
            is_current: true,
            source: input.source ?? 'ai',
            metadata: input.metadata ?? null,
        });
        await repository.save(row);
        return toDTO(row);
    }

    public async list(planId: number, currentOnly = true): Promise<IPlanArtifact[]> {
        const repository = (await getAppDataSource()).getRepository(DRAPaidMediaPlanArtifact);
        const where = { plan_id: planId, ...(currentOnly ? { is_current: true } : {}) };
        const rows = await repository.find({
            where,
            order: { artifact_key: 'ASC', version: 'ASC' },
        });
        return rows.map(toDTO);
    }

    public async get(id: number): Promise<IPlanArtifact> {
        const repository = (await getAppDataSource()).getRepository(DRAPaidMediaPlanArtifact);
        const row = await repository.findOne({ where: { id } });
        if (!row) {
            throw new Error(`Artifact not found: ${id}`);
        }
        return toDTO(row);
    }

    public async getCurrentByKey(planId: number, artifactKey: string): Promise<IPlanArtifact | null> {
        const repository = (await getAppDataSource()).getRepository(DRAPaidMediaPlanArtifact);
        const row = await repository.findOne({
            where: { plan_id: planId, artifact_key: artifactKey, is_current: true },
        });
        return row ? toDTO(row) : null;
    }

    public async editContent(id: number, content: string, source: PlanArtifactSource = 'user_edited'): Promise<IPlanArtifact> {
        const current = await this.get(id);
        if (current.kind !== 'markdown' && current.kind !== 'json' && current.kind !== 'csv' && current.kind !== 'html') {
            throw new Error(`Artifact kind ${current.kind} cannot be edited as text`);
        }
        return this.create({
            planId: current.planId,
            stepId: current.stepId,
            artifactKey: current.artifactKey,
            title: current.title,
            kind: current.kind,
            content,
            metadata: { ...(current.metadata ?? {}), edited_from_version: current.version },
            source,
        });
    }

    public async registerBinary(input: ICreateArtifactInput & { byteSize?: number }): Promise<IPlanArtifact> {
        const repository = (await getAppDataSource()).getRepository(DRAPaidMediaPlanArtifact);

        const previous = await repository.findOne({
            where: { plan_id: input.planId, artifact_key: input.artifactKey, is_current: true },
        });
        const version = previous ? previous.version + 1 : 1;
        if (previous) {
            previous.is_current = false;
            await repository.save(previous);
        }

        const row = repository.create({
            plan_id: input.planId,
            step_id: input.stepId ?? null,
            artifact_key: input.artifactKey,
            title: input.title,
            kind: input.kind,
            mime_type: input.mimeType ?? MIME_BY_KIND[input.kind],
            content: null,
            storage_key: input.storageKey ?? null,
            byte_size: input.byteSize ?? 0,
            version,
            is_current: true,
            source: input.source ?? 'ai',
            metadata: input.metadata ?? null,
        });
        await repository.save(row);
        return toDTO(row);
    }

    public async artifactCount(planId: number): Promise<number> {
        const repository = (await getAppDataSource()).getRepository(DRAPaidMediaPlanArtifact);
        return repository.count({ where: { plan_id: planId, is_current: true } });
    }
}
