import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import xlsx from 'node-xlsx';
import { PlanArtifactService } from './PlanArtifactService.js';
import { resolveSkillsRoot } from './SkillRegistryService.js';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const WORKDIR_ROOT = process.env.PLAN_SCRIPT_WORKDIR ?? join(process.cwd(), 'public', 'uploads', 'plans');

interface IRegisteredScript {
    artifactKey: string;
    filename: string;
    kind: 'xlsx' | 'pptx';
    title: string;
}

const REGISTERED_SCRIPTS: Record<string, IRegisteredScript> = {
    'media-plan-xlsx': {
        artifactKey: '10-media-plan-xlsx',
        filename: '10-media-plan.xlsx',
        kind: 'xlsx',
        title: 'Media plan (xlsx)',
    },
    'setup-checklist-xlsx': {
        artifactKey: '13-setup-checklist-xlsx',
        filename: '13-setup-checklist.xlsx',
        kind: 'xlsx',
        title: 'Setup checklist (xlsx)',
    },
    'strategy-deck-pptx': {
        artifactKey: '00-digital-marketing-strategy-deck',
        filename: '00-digital-marketing-strategy-deck.pptx',
        kind: 'pptx',
        title: 'Digital marketing strategy deck',
    },
};

export interface IPlanScriptResult {
    ok: boolean;
    artifactKey?: string;
    filename?: string;
    storagePath?: string;
    byteSize?: number;
    error?: string;
}

function parseMarkdownTable(markdown: string): Array<Record<string, string>> {
    const lines = markdown.split('\n').filter((line) => line.includes('|'));
    if (lines.length < 2) return [];
    const header = lines[0].split('|').map((cell) => cell.trim()).filter(Boolean);
    const rows: Array<Record<string, string>> = [];
    for (const line of lines.slice(2)) {
        const cells = line.split('|').map((cell) => cell.trim()).filter(Boolean);
        if (cells.length === 0) continue;
        const row: Record<string, string> = {};
        header.forEach((key, index) => {
            row[key] = cells[index] ?? '';
        });
        rows.push(row);
    }
    return rows;
}

export class PlanScriptSandbox {
    private static instance: PlanScriptSandbox;

    private constructor() {}

    public static getInstance(): PlanScriptSandbox {
        if (!PlanScriptSandbox.instance) {
            PlanScriptSandbox.instance = new PlanScriptSandbox();
        }
        return PlanScriptSandbox.instance;
    }

    private workdir(planId: number): string {
        const dir = join(WORKDIR_ROOT, String(planId));
        mkdirSync(dir, { recursive: true });
        return dir;
    }

    public async run(planId: number, stepId: number | null, scriptId: string, inputs: Record<string, any> = {}): Promise<IPlanScriptResult> {
        const script = REGISTERED_SCRIPTS[scriptId];
        if (!script) {
            return { ok: false, error: `Unknown script id "${scriptId}". Registered: ${Object.keys(REGISTERED_SCRIPTS).join(', ')}` };
        }
        const dir = this.workdir(planId);
        const outputPath = join(dir, script.filename);

        try {
            if (script.kind === 'xlsx') {
                const buffer = this.buildXlsx(scriptId, inputs);
                writeFileSync(outputPath, buffer);
                return {
                    ok: true,
                    artifactKey: script.artifactKey,
                    filename: script.filename,
                    storagePath: outputPath,
                    byteSize: buffer.length,
                };
            }
            const result = await this.buildPptx(planId, outputPath, inputs);
            if (!result.ok) return result;
            return {
                ok: true,
                artifactKey: script.artifactKey,
                filename: script.filename,
                storagePath: outputPath,
                byteSize: existsSync(outputPath) ? statSync(outputPath).size : 0,
            };
        } catch (error: any) {
            return { ok: false, error: error.message ?? String(error) };
        }
    }

    private buildXlsx(scriptId: string, inputs: Record<string, any>): Buffer {
        const rows = Array.isArray(inputs.rows)
            ? inputs.rows
            : typeof inputs.content === 'string'
                ? parseMarkdownTable(inputs.content)
                : [];

        if (rows.length === 0) {
            throw new Error('No rows provided. Pass {rows: [...]} or {content: "markdown table"} to the script.');
        }

        const keys = Array.from(new Set(rows.flatMap((row: Record<string, any>) => Object.keys(row))));
        const header = keys.map((key) => key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
        const data: Array<Array<string | number>> = [header];
        for (const row of rows) {
            data.push(keys.map((key) => row[key] ?? ''));
        }

        const sheetName = scriptId === 'media-plan-xlsx' ? 'Media Plan' : 'Setup Checklist';
        return xlsx.build([{ name: sheetName, data, options: {} }]) as Buffer;
    }

    private async buildPptx(planId: number, outputPath: string, inputs: Record<string, any>): Promise<IPlanScriptResult> {
        const scriptPath = join(resolveSkillsRoot(), '15-pm-client-presentation', 'scripts', 'build_deck.py');
        if (!existsSync(scriptPath)) {
            return { ok: false, error: `build_deck.py not found in the vendored skill pack (looked at ${scriptPath})` };
        }

        const artifactService = PlanArtifactService.getInstance();
        const contentArtifact = await artifactService.getCurrentByKey(planId, '00-strategy-deck-content').catch(() => null);
        let content = inputs.contentJson ?? contentArtifact?.content ?? null;
        if (typeof content === 'string') {
            try {
                content = JSON.parse(content);
            } catch {
                // keep raw string
            }
        }
        if (!content) {
            return { ok: false, error: 'Strategy deck content is missing. Write 00-strategy-deck-content first.' };
        }

        const contentPath = join(this.workdir(planId), '00-strategy-deck-content.json');
        writeFileSync(contentPath, typeof content === 'string' ? content : JSON.stringify(content, null, 2));

        const python = process.env.PLAN_SCRIPT_RUNTIME ?? 'python3';
        const timeoutMs = Number(process.env.PLAN_SCRIPT_TIMEOUT_MS ?? 120000);

        try {
            await execFileAsync(python, [scriptPath, contentPath, outputPath], {
                timeout: timeoutMs,
                maxBuffer: 64 * 1024 * 1024,
            });
            return { ok: true };
        } catch (error: any) {
            const detail = error?.stderr?.toString?.() ?? error?.message ?? String(error);
            if (detail.includes('No module named') || detail.includes('ModuleNotFoundError')) {
                return { ok: false, error: `The strategy deck script requires python-pptx on the server (${python}). ${detail.slice(0, 300)}` };
            }
            return { ok: false, error: `Strategy deck script failed: ${String(detail).slice(0, 500)}` };
        }
    }
}
