import { createReadStream, existsSync } from 'node:fs';
import archiver from 'archiver';
import { Response } from 'express';
import { PaidMediaPlanService } from './PaidMediaPlanService.js';
import { PlanArtifactService } from './PlanArtifactService.js';
import { PlanChecklistExcelService } from './PlanChecklistExcelService.js';
import { PlanPdfService } from './PlanPdfService.js';
import { PlanStateService } from './PlanStateService.js';
import { SkillRegistryService } from './SkillRegistryService.js';

const EXT_BY_KIND: Record<string, string> = {
    markdown: 'md',
    json: 'json',
    csv: 'csv',
    xlsx: 'xlsx',
    pptx: 'pptx',
    html: 'html',
    image: 'png',
};

export class PlanExportService {
    private static instance: PlanExportService;

    private constructor() {}

    public static getInstance(): PlanExportService {
        if (!PlanExportService.instance) {
            PlanExportService.instance = new PlanExportService();
        }
        return PlanExportService.instance;
    }

    private fileNameFor(artifactKey: string, kind: string): string {
        const pack = SkillRegistryService.getInstance()
            .list()
            .find((p) => p.artifacts.some((a) => a.key === artifactKey));
        const contract = pack?.artifacts.find((a) => a.key === artifactKey);
        if (contract?.path) return contract.path;
        return `${artifactKey}.${EXT_BY_KIND[kind] ?? kind}`;
    }

    private pdfNameFor(artifactKey: string): string {
        return this.fileNameFor(artifactKey, 'markdown').replace(/\.md$/i, '.pdf');
    }

    public async exportPlan(planId: number, res: Response): Promise<void> {
        const service = PaidMediaPlanService.getInstance();
        const artifactService = PlanArtifactService.getInstance();
        const pdfService = PlanPdfService.getInstance();
        const plan = await service.get(planId);
        const artifacts = await artifactService.list(planId);

        const stateMarkdown = await PlanStateService.getInstance().projectToMarkdown(planId, true);

        // Render before streaming so a renderer failure can still return a clean error.
        const pdfByArtifactId = new Map<number, Buffer>();
        for (const artifact of artifacts) {
            if (artifact.kind === 'markdown') {
                pdfByArtifactId.set(
                    artifact.id,
                    await pdfService.renderMarkdownToPdf(artifact.content ?? '', artifact.title),
                );
            }
        }
        const statePdf = await pdfService.renderMarkdownToPdf(stateMarkdown, `${plan.name} — Plan state`);

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${plan.slug}.zip"`);

        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.on('error', (error) => {
            console.error('[PlanExportService] zip error:', error);
            if (!res.headersSent) res.status(500).json({ success: false, error: 'Export failed' });
        });
        archive.pipe(res);

        archive.append(`# ${plan.name}\n\nPlan id: ${plan.id}\nStatus: ${plan.status}\n\n`, { name: 'README.txt' });
        archive.append(statePdf, { name: 'plan-state.pdf' });

        for (const artifact of artifacts) {
            if (artifact.kind === 'markdown') {
                archive.append(pdfByArtifactId.get(artifact.id) as Buffer, {
                    name: this.pdfNameFor(artifact.artifactKey),
                });
                // The setup checklist is exported as both PDF and a markable
                // Excel workbook.
                if (artifact.artifactKey.includes('checklist')) {
                    const xlsx = await PlanChecklistExcelService.getInstance().renderChecklistXlsx(
                        artifact.content ?? '',
                        artifact.title,
                    );
                    archive.append(xlsx, {
                        name: this.fileNameFor(artifact.artifactKey, 'markdown').replace(/\.md$/i, '.xlsx'),
                    });
                }
                continue;
            }

            const fileName = this.fileNameFor(artifact.artifactKey, artifact.kind);
            if (artifact.kind === 'xlsx' || artifact.kind === 'pptx' || artifact.kind === 'image') {
                if (artifact.storageKey && existsSync(artifact.storageKey)) {
                    archive.append(createReadStream(artifact.storageKey), { name: fileName });
                }
                continue;
            }
            const content = artifact.content ?? '';
            archive.append(content, { name: fileName });
        }

        await archive.finalize();
    }
}
